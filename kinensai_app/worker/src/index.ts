/**
 * kinensai-app Worker: 管理者認証API + 全世界配信 (共有コンテンツ) API + 静的アセット配信。
 *
 * - POST /api/admin/login  { password } → 200 { ok:true, token, expiresAt } / 401 { ok:false }
 * - POST /api/admin/verify { token }    → 200 { ok:true } / 200 { ok:false }
 * - GET  /api/content/<name>.json       → KVから共有コンテンツを公開配信 (認証不要・5分キャッシュ)
 * - POST /api/content/publish { token, files: { name: value } } → 管理者トークンでKVへ公開
 * - POST /api/images/upload { token, contentType, data(base64) } → 画像をKVへ格納し公開URLを返す
 * - GET  /api/images/<key>                 → 画像を公開配信 (認証不要・長期キャッシュ)
 * - 上記以外 → ASSETS.fetch(request) (Expo Web の静的配信。SPAフォールバックは
 *   wrangler.toml の assets.not_found_handling に従う)
 *
 * パスワード本体は Worker シークレット ADMIN_PASSWORD にのみ保持し、
 * クライアントバンドルには一切含めない。認証成功時に返すトークンは
 * HMAC-SHA256(ADMIN_SESSION_SECRET, "admin:v1:<exp>") 署名付きの自己完結型で、
 * 有効期限 (12時間) 付き。検証はタイミングセーフな比較で行う。
 */

interface AssetsBinding {
  fetch: (request: Request) => Promise<Response>;
}

interface KvBinding {
  get: {
    (key: string, type: 'text'): Promise<string | null>;
    (key: string, type: 'arrayBuffer'): Promise<ArrayBuffer | null>;
  };
  put: {
    (key: string, value: string): Promise<void>;
    (key: string, value: ArrayBuffer): Promise<void>;
  };
  delete: (key: string) => Promise<void>;
}

interface Env {
  ASSETS: AssetsBinding;
  CONTENT: KvBinding;
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
}

/** Workers拡張のエッジキャッシュ (DOM libには無いため最小宣言)。 */
declare const caches: {
  default: {
    match: (request: Request) => Promise<Response | undefined>;
    put: (request: Request, response: Response) => Promise<void>;
  };
};

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 2 * 1024 * 1024;
const MAX_FILE_BYTES = 1024 * 1024;
/** 画像1枚の上限 (バイト)。base64受信なので余裕を見る。 */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;

/** アップロード許可する画像形式と拡張子。 */
const IMAGE_MIME_TO_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};
/** 画像キー形式 (KV列挙・パストラバーサル防止のため厳密に検証)。 */
const IMAGE_KEY_RE = /^img-[a-z0-9]+\.(jpg|png|webp|gif)$/;

/** 公開対象の共有コンテンツキー (/admin/data の公開バンドルと一致させる)。 */
const CONTENT_KEYS = new Set([
  'class-overrides.json',
  'custom-classes.json',
  'volunteers.json',
  'tickets.json',
  'notifications.json',
  'stage-groups.json',
  'congestion.json',
  'delays.json',
  'timetable-overrides.json',
  'picks.json',
  'now-override.json',
  'map-layout.json',
]);

/** isolate内ベストエフォートの総当たり対策 (分散環境では完全ではない)。 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const LOGIN_ATTEMPT_LIMIT = 10;
const PUBLISH_ATTEMPT_LIMIT = 30;
const ATTEMPT_WINDOW_MS = 5 * 60 * 1000;

const te = new TextEncoder();

function toHex(bytes: ArrayBuffer): string {
  return [...new Uint8Array(bytes)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** タイミングセーフな文字列比較 (長さ漏洩のみ許容)。 */
function timingSafeEqual(a: string, b: string): boolean {
  const ba = te.encode(a);
  const bb = te.encode(b);
  if (ba.length !== bb.length) {
    // 長さが違ってもダミーループで時間を揃える
    let d = 0;
    const n = Math.max(ba.length, bb.length);
    for (let i = 0; i < n; i++) d |= (ba[i % ba.length] ?? 0) ^ (bb[i % bb.length] ?? 0);
    return d === -1; // 常に false
  }
  let diff = 0;
  for (let i = 0; i < ba.length; i++) diff |= ba[i] ^ bb[i];
  return diff === 0;
}

async function importSessionKey(secret: string): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', te.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, [
    'sign',
  ]);
}

async function signExpiry(key: CryptoKey, exp: number): Promise<string> {
  const sig = await crypto.subtle.sign('HMAC', key, te.encode(`admin:v1:${exp}`));
  return toHex(sig);
}

/** 管理者トークンの検証。秘密未設定・期限切れ・署名不一致はすべて false。 */
async function verifyAdminToken(token: string, sessionSecret: string): Promise<boolean> {
  if (!sessionSecret || !token) return false;
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(exp) || exp <= Date.now()) return false;
  const key = await importSessionKey(sessionSecret);
  const expected = await signExpiry(key, exp);
  return timingSafeEqual(sig, expected);
}

function json(data: unknown, status = 200, cacheControl = 'no-store'): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': cacheControl,
    },
  });
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'
  );
}

function rateLimited(ip: string, key: string, limit: number): boolean {
  const now = Date.now();
  const mapKey = `${key}:${ip}`;
  const cur = attempts.get(mapKey);
  if (!cur || now >= cur.resetAt) {
    attempts.set(mapKey, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > limit;
}

function resetAttempts(ip: string, key: string): void {
  attempts.delete(`${key}:${ip}`);
}

async function readBodyText(request: Request): Promise<string | null> {
  try {
    return await request.text();
  } catch {
    return null;
  }
}

function safeParseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}

async function readJsonBody(request: Request): Promise<unknown> {
  const text = await readBodyText(request);
  if (text === null || text.length > MAX_BODY_BYTES) return null;
  const parsed = safeParseJson(text);
  return parsed === undefined ? null : parsed;
}

async function handleLogin(request: Request, env: Env): Promise<Response> {
  const password = env.ADMIN_PASSWORD ?? '';
  const sessionSecret = env.ADMIN_SESSION_SECRET ?? '';
  if (!password || !sessionSecret) return json({ ok: false }, 500);

  const body = await readJsonBody(request);
  const candidate =
    typeof body === 'object' && body !== null && 'password' in body
      ? String((body as { password: unknown }).password ?? '')
      : '';
  if (!candidate) return json({ ok: false }, 401);

  const ip = clientIp(request);
  if (rateLimited(ip, 'login', LOGIN_ATTEMPT_LIMIT)) return json({ ok: false }, 429);

  if (!timingSafeEqual(candidate, password)) return json({ ok: false }, 401);

  resetAttempts(ip, 'login');
  const exp = Date.now() + TOKEN_TTL_MS;
  const key = await importSessionKey(sessionSecret);
  const sig = await signExpiry(key, exp);
  return json({ ok: true, token: `${exp}.${sig}`, expiresAt: exp });
}

async function handleVerify(request: Request, env: Env): Promise<Response> {
  const sessionSecret = env.ADMIN_SESSION_SECRET ?? '';
  if (!sessionSecret) return json({ ok: false });
  const body = await readJsonBody(request);
  const token =
    typeof body === 'object' && body !== null && 'token' in body
      ? String((body as { token: unknown }).token ?? '')
      : '';
  if (!(await verifyAdminToken(token, sessionSecret))) return json({ ok: false });
  return json({ ok: true });
}

/** 共有コンテンツの公開配信 (認証不要)。 */
async function handleContentGet(name: string, env: Env): Promise<Response> {
  if (!CONTENT_KEYS.has(name)) return json({ ok: false }, 404);
  const raw = await env.CONTENT.get(name, 'text');
  if (raw === null) return json({ ok: false }, 404);
  return new Response(raw, {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'public, max-age=300',
    },
  });
}

function randomImageKey(ext: string): string {
  const rand = [...crypto.getRandomValues(new Uint8Array(9))]
    .map((b) => b.toString(36))
    .join('')
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 12);
  return `img-${Date.now().toString(36)}${rand}.${ext}`;
}

function base64ToBytes(data: string): Uint8Array | null {
  if (!/^[A-Za-z0-9+/=]*$/.test(data) || data.length % 4 !== 0) return null;
  try {
    const bin = atob(data);
    const out = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
    return out;
  } catch {
    return null;
  }
}

/** 画像の公開配信 (認証不要・長期キャッシュ)。 */
async function handleImageGet(request: Request, key: string, env: Env): Promise<Response> {
  if (!IMAGE_KEY_RE.test(key)) return json({ ok: false }, 404);
  const cache = caches.default;
  const cached = await cache.match(request);
  if (cached) return cached;
  const buf = await env.CONTENT.get(key, 'arrayBuffer');
  if (!buf) return json({ ok: false }, 404);
  const ext = key.slice(key.lastIndexOf('.') + 1);
  const mime =
    ext === 'jpg' ? 'image/jpeg' : ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : 'image/gif';
  const res = new Response(buf, {
    headers: {
      'content-type': mime,
      'cache-control': 'public, max-age=31536000, immutable',
    },
  });
  await cache.put(request, res.clone());
  return res;
}

/** 画像のアップロード (管理者トークン必須)。R2の代わりにKVへ格納する。 */
async function handleImageUpload(request: Request, env: Env): Promise<Response> {
  const sessionSecret = env.ADMIN_SESSION_SECRET ?? '';
  if (!sessionSecret) return json({ ok: false }, 500);
  const ip = clientIp(request);
  if (rateLimited(ip, 'imgupload', PUBLISH_ATTEMPT_LIMIT)) return json({ ok: false }, 429);

  const rawUpload = await readBodyText(request);
  if (rawUpload === null) return json({ ok: false }, 400);
  if (rawUpload.length > MAX_BODY_BYTES) return json({ ok: false }, 413);
  const body = safeParseJson(rawUpload);
  const obj =
    typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  if (!obj) return json({ ok: false }, 400);
  const token = String(obj.token ?? '');
  if (!(await verifyAdminToken(token, sessionSecret))) return json({ ok: false }, 401);
  const contentType = String(obj?.contentType ?? '');
  const ext = IMAGE_MIME_TO_EXT[contentType];
  const data = String(obj?.data ?? '');
  if (!ext || !data) return json({ ok: false }, 400);
  const bytes = base64ToBytes(data);
  if (!bytes || bytes.byteLength === 0 || bytes.byteLength > MAX_IMAGE_BYTES) {
    return json({ ok: false }, 413);
  }
  const key = randomImageKey(ext);
  await env.CONTENT.put(key, bytes.buffer as ArrayBuffer);
  resetAttempts(ip, 'imgupload');
  const url = new URL(request.url);
  return json({ ok: true, url: `${url.origin}/api/images/${key}`, key });
}

/** 共有コンテンツの公開 (管理者トークン必須)。files の値はそのまま各キーに保存する。 */
async function handleContentPublish(request: Request, env: Env): Promise<Response> {
  const sessionSecret = env.ADMIN_SESSION_SECRET ?? '';
  if (!sessionSecret) return json({ ok: false }, 500);
  const ip = clientIp(request);
  if (rateLimited(ip, 'publish', PUBLISH_ATTEMPT_LIMIT)) return json({ ok: false }, 429);

  const rawPublish = await readBodyText(request);
  if (rawPublish === null) return json({ ok: false }, 400);
  if (rawPublish.length > MAX_BODY_BYTES) return json({ ok: false }, 413);
  const body = safeParseJson(rawPublish);
  const token =
    typeof body === 'object' && body !== null && 'token' in body
      ? String((body as { token: unknown }).token ?? '')
      : '';
  if (!(await verifyAdminToken(token, sessionSecret))) return json({ ok: false }, 401);
  const files =
    typeof body === 'object' && body !== null && 'files' in body
      ? ((body as { files: unknown }).files as Record<string, unknown>)
      : null;
  if (!files || typeof files !== 'object' || Array.isArray(files)) return json({ ok: false }, 400);

  const names = Object.keys(files);
  if (names.length === 0 || names.length > CONTENT_KEYS.size) return json({ ok: false }, 400);
  const serialized = new Map<string, string>();
  for (const name of names) {
    if (!CONTENT_KEYS.has(name)) return json({ ok: false }, 400);
    let raw: string;
    try {
      raw = JSON.stringify(files[name] ?? null);
    } catch {
      return json({ ok: false }, 400);
    }
    if (te.encode(raw).length > MAX_FILE_BYTES) return json({ ok: false }, 413);
    serialized.set(name, raw);
  }
  for (const [name, raw] of serialized) {
    await env.CONTENT.put(name, raw);
  }
  resetAttempts(ip, 'publish');
  return json({ ok: true, published: names });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === 'POST' && url.pathname === '/api/admin/login') {
      return handleLogin(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/admin/verify') {
      return handleVerify(request, env);
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname.startsWith('/api/content/')
    ) {
      return handleContentGet(url.pathname.slice('/api/content/'.length), env);
    }
    if (request.method === 'POST' && url.pathname === '/api/content/publish') {
      return handleContentPublish(request, env);
    }
    if (request.method === 'POST' && url.pathname === '/api/images/upload') {
      return handleImageUpload(request, env);
    }
    if (
      (request.method === 'GET' || request.method === 'HEAD') &&
      url.pathname.startsWith('/api/images/')
    ) {
      return handleImageGet(request, url.pathname.slice('/api/images/'.length), env);
    }
    return env.ASSETS.fetch(request);
  },
};
