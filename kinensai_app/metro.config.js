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
  'club',
  'corridor',
  'stairs',
  'elevator',
  'vending',
  'toilet',
  'outdoor',
  'hall',
]);
const VECTOR_ROOMS_START = 'export const VECTOR_ROOMS: Record<VectorFloor, VectorRoom[]> = {';

function num(v) {
  return typeof v === 'number' && Number.isFinite(v) ? Math.round(v * 100) / 100 : 0;
}

function str(v, fallback = '') {
  return typeof v === 'string' ? v : fallback;
}

/** 部屋配列から `VECTOR_ROOMS` の TypeScript リテラルを生成する。 */
function buildRoomsLiteral(roomsByFloor) {
  const lines = [VECTOR_ROOMS_START];
  for (const floor of FLOORS) {
    const rooms = Array.isArray(roomsByFloor[floor]) ? roomsByFloor[floor] : [];
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
  return lines.join('\n');
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
      const rooms = parsed && typeof parsed === 'object' ? parsed.rooms : null;
      if (!rooms || typeof rooms !== 'object') throw new Error('rooms is required');
      const filePath = path.join(__dirname, 'src', 'data', 'vectorMap.ts');
      const src = fs.readFileSync(filePath, 'utf8');
      const start = src.indexOf(VECTOR_ROOMS_START);
      const end = start >= 0 ? src.indexOf('\n};', start) : -1;
      if (start < 0 || end < 0) throw new Error('VECTOR_ROOMS not found in vectorMap.ts');
      const next = `${src.slice(0, start)}${buildRoomsLiteral(rooms)}${src.slice(end + 3)}`;
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
