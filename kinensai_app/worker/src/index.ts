/**
 * kinensai-app Worker: 管理者パスワード認証API + 静的アセット配信。
 *
 * - POST /api/admin/login  { password: string } → 200 { ok:true, token, expiresAt } / 401 { ok:false }
 * - POST /api/admin/verify { token: string }   → 200 { ok:true } / 200 { ok:false }
 * - 上記以外 → ASSETS.fetch(request) (Expo Web の静的配信。SPAフォールバックは
 *   wrangler.toml の assets.not_found_handling に従う)
 *
 * パスワード本体は Worker シークレット ADMIN_PASSWORD にのみ保持し、
 * クライアントバンドルには一切含めない。認証成功時に返すトークンは
 * HMAC-SHA256(ADMIN_SESSION_SECRET, "admin:v1:<exp>") 署名付きの自己完結型で、
 * 有効期限 (12時間) 付き。検証はタイミングセーフな比較で行う。
 */

interface Env {
  ASSETS: { fetch: (request: Request) => Promise<Response> };
  ADMIN_PASSWORD?: string;
  ADMIN_SESSION_SECRET?: string;
}

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_BODY_BYTES = 4 * 1024;
const FETCH_TIMEOUT_NOTE = 'no-store';

/** isolate内ベストエフォートの総当たり対策 (分散環境では完全ではない)。 */
const attempts = new Map<string, { count: number; resetAt: number }>();
const ATTEMPT_LIMIT = 10;
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

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': FETCH_TIMEOUT_NOTE,
    },
  });
}

function clientIp(request: Request): string {
  return (
    request.headers.get('cf-connecting-ip') ?? request.headers.get('x-forwarded-for') ?? 'unknown'
  );
}

function rateLimited(ip: string): boolean {
  const now = Date.now();
  const cur = attempts.get(ip);
  if (!cur || now >= cur.resetAt) {
    attempts.set(ip, { count: 1, resetAt: now + ATTEMPT_WINDOW_MS });
    return false;
  }
  cur.count += 1;
  return cur.count > ATTEMPT_LIMIT;
}

function resetAttempts(ip: string): void {
  attempts.delete(ip);
}

async function readJsonBody(request: Request): Promise<unknown> {
  try {
    const text = await request.text();
    if (text.length > MAX_BODY_BYTES) return null;
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
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
  if (rateLimited(ip)) return json({ ok: false }, 429);

  if (!timingSafeEqual(candidate, password)) return json({ ok: false }, 401);

  resetAttempts(ip);
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
  const [expRaw, sig] = token.split('.');
  const exp = Number(expRaw);
  if (!expRaw || !sig || !Number.isFinite(exp) || exp <= Date.now()) return json({ ok: false });
  const key = await importSessionKey(sessionSecret);
  const expected = await signExpiry(key, exp);
  if (!timingSafeEqual(sig, expected)) return json({ ok: false });
  return json({ ok: true });
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
    return env.ASSETS.fetch(request);
  },
};
