const { getDefaultConfig } = require('expo/metro-config');
const fs = require('fs');
const path = require('path');

const config = getDefaultConfig(__dirname);

// CSVファイルをアセット（画像などと同じ扱い）として読み込めるようにする
config.resolver.assetExts.push('csv', 'txt');

/**
 * 管理者用・マップ配置 (/admin/map) から送られた配置で `src/data/vectorMap.ts` の
 * `VECTOR_ROOMS` 定義を書き換える開発サーバー専用エンドポイント。
 * 本番 (expo export / 静的配信) では enhanceMiddleware が適用されないため無効。
 */
const MAP_WRITE_PATH = '/__admin/write-map';
const FLOORS = ['1階', '2階', '3階', '4階 5階'];
const KINDS = new Set([
  'class',
  'jclass',
  'club',
  'corridor',
  'stairs',
  'elevator',
  'vending',
  'toilet',
  'outdoor',
  'hall',
]);
const ANN_KINDS = new Set(['badge', 'label', 'note']);
const VECTOR_ROOMS_START = 'export const VECTOR_ROOMS: Record<VectorFloor, VectorRoom[]> = {';
const VECTOR_ANNOTATIONS_START =
  'export const VECTOR_ANNOTATIONS: Partial<Record<VectorFloor, VectorAnnotation[]>> = {';

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function str(v, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

/** 部屋配列から `VECTOR_ROOMS` の TypeScript リテラルを生成する。 */
function buildRoomsLiteral(roomsByFloor, eol) {
  const lines = [VECTOR_ROOMS_START];
  for (const floor of FLOORS) {
    const rooms = Array.isArray(roomsByFloor[floor]) ? roomsByFloor[floor] : [];
    if (rooms.length === 0) {
      lines.push(`  ${JSON.stringify(floor)}: [],`);
      continue;
    }
    lines.push(`  ${JSON.stringify(floor)}: [`);
    for (const r of rooms) {
      if (!r || typeof r !== 'object') continue;
      const id = str(r.id);
      if (!id) continue;
      const kind = KINDS.has(r.kind) ? r.kind : 'hall';
      lines.push(
        `    { id: ${JSON.stringify(id)}, label: ${JSON.stringify(str(r.label))}, name: ${JSON.stringify(str(r.name, id))}, x: ${num(r.x)}, y: ${num(r.y)}, w: ${num(r.w)}, h: ${num(r.h)}, kind: ${JSON.stringify(kind)} },`,
      );
    }
    lines.push('  ],');
  }
  lines.push('};');
  return lines.join(eol);
}

/** 注記配列から `VECTOR_ANNOTATIONS` の TypeScript リテラルを生成する。 */
function buildAnnotationsLiteral(annByFloor, eol) {
  const lines = [VECTOR_ANNOTATIONS_START];
  for (const floor of FLOORS) {
    const list = Array.isArray(annByFloor[floor]) ? annByFloor[floor] : [];
    if (list.length === 0) {
      lines.push(`  ${JSON.stringify(floor)}: [],`);
      continue;
    }
    lines.push(`  ${JSON.stringify(floor)}: [`);
    for (const a of list) {
      if (!a || typeof a !== 'object') continue;
      const text = str(a.text);
      if (!text) continue;
      const kind = ANN_KINDS.has(a.kind) ? a.kind : 'label';
      const tone = a.tone === 'danger' ? ', tone: "danger"' : '';
      lines.push(
        `    { kind: ${JSON.stringify(kind)}, text: ${JSON.stringify(text)}, x: ${num(a.x)}, y: ${num(a.y)}${tone} },`,
      );
    }
    lines.push('  ],');
  }
  lines.push('};');
  return lines.join(eol);
}

/** `START` で始まるブロック (`\n};` まで) を `literal` に置き換える。 */
function replaceBlock(src, start, literal) {
  const at = src.indexOf(start);
  const end = at >= 0 ? src.indexOf('\n};', at) : -1;
  if (at < 0 || end < 0) throw new Error(`${start.split(' ')[2]} not found in vectorMap.ts`);
  return `${src.slice(0, at)}${literal}${src.slice(end + 3)}`;
}

function writeMapRooms(req, res) {
  let body = '';
  req.on('data', (chunk) => {
    body += chunk;
    if (body.length > 2_000_000) req.destroy();
  });
  req.on('end', () => {
    try {
      const parsed = JSON.parse(body || '{}');
      const layout = parsed && typeof parsed === 'object' ? parsed.layout : null;
      if (!layout || typeof layout !== 'object') throw new Error('layout is required');
      const roomsByFloor = {};
      const annByFloor = {};
      for (const floor of FLOORS) {
        const entry = layout[floor];
        roomsByFloor[floor] = entry && Array.isArray(entry.rooms) ? entry.rooms : [];
        annByFloor[floor] = entry && Array.isArray(entry.annotations) ? entry.annotations : [];
      }
      const filePath = path.join(__dirname, 'src', 'data', 'vectorMap.ts');
      const src = fs.readFileSync(filePath, 'utf8');
      // 既存の改行コードを踏襲する (Windows の CRLF を LF に変えない)
      const eol = src.includes('\r\n') ? '\r\n' : '\n';
      let next = src;
      next = replaceBlock(next, VECTOR_ROOMS_START, buildRoomsLiteral(roomsByFloor, eol));
      next = replaceBlock(next, VECTOR_ANNOTATIONS_START, buildAnnotationsLiteral(annByFloor, eol));
      fs.writeFileSync(filePath, next, 'utf8');
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: true }));
    } catch (e) {
      res.writeHead(400, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ok: false, error: e instanceof Error ? e.message : String(e) }));
    }
  });
}

const baseEnhance = config.server.enhanceMiddleware;
config.server.enhanceMiddleware = (metroMiddleware, server) => {
  const wrapped = baseEnhance ? baseEnhance(metroMiddleware, server) : metroMiddleware;
  return (req, res, next) => {
    if (req.method === 'POST' && req.url && req.url.split('?')[0] === MAP_WRITE_PATH) {
      writeMapRooms(req, res);
      return;
    }
    return wrapped(req, res, next);
  };
};

module.exports = config;
