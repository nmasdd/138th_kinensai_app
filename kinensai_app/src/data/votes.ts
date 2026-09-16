import { loadJSON, saveJSON } from './kvStore';
import { getAdminApiBase, getAdminToken } from '../components/AdminGuard';

/**
 * オーディエンス投票のクライアント側処理。
 *
 * - 投票は Worker (`POST /api/votes`) へ送信し、団体別の得票数をKVで集計する。
 * - 「1台1票」を守るため、端末ごとの投票者ID (`vote-voter.json`、端末個人データ) を
 *   生成して送る。同じIDで再投票するとサーバ側が旧団体を減算して変更する。
 * - 集計の確認は管理者のみ (`POST /api/votes/results`、管理者トークン必須)。
 *
 * 送信失敗時は false を返す (呼び出し側は端末の表示だけ更新し、集計には反映されない)。
 */

/** 端末個人データ。配信対象外 (publish.ts の PER_USER_KEYS)。 */
const VOTER_KEY = 'vote-voter.json';
const VOTER_ID_RE = /^[A-Za-z0-9_-]{8,64}$/;
const REQUEST_TIMEOUT_MS = 10000;

let cachedVoterId: string | null = null;

/** 推測困難な投票者IDを生成する (crypto が無い環境では Math.random で代替)。 */
function generateVoterId(): string {
  const bytes = new Uint8Array(16);
  try {
    const c = globalThis.crypto;
    if (c && typeof c.getRandomValues === 'function') c.getRandomValues(bytes);
    else throw new Error('no crypto');
  } catch {
    for (let i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
  }
  return [...bytes].map((b) => b.toString(16).padStart(2, '0')).join('');
}

/** この端末の投票者IDを取得する (無ければ生成して端末保存)。 */
export async function getVoterId(): Promise<string> {
  if (cachedVoterId) return cachedVoterId;
  const stored = await loadJSON<unknown>(VOTER_KEY, null);
  if (typeof stored === 'string' && VOTER_ID_RE.test(stored)) {
    cachedVoterId = stored;
    return stored;
  }
  const id = generateVoterId();
  cachedVoterId = id;
  await saveJSON(VOTER_KEY, id).catch(() => {});
  return id;
}

async function postJson(path: string, payload: unknown): Promise<{ status: number; body: unknown } | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  try {
    const res = await fetch(`${getAdminApiBase()}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    let body: unknown = null;
    try {
      body = (await res.json()) as unknown;
    } catch {}
    return { status: res.status, body };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 投票を送信する。`groupId` が null なら取消。成功したら true。
 * 送信に失敗しても端末の表示は呼び出し側で更新済みのため、例外は投げない。
 */
export async function submitVote(groupId: string | null): Promise<boolean> {
  const voterId = await getVoterId();
  const res = await postJson('/api/votes', { voterId, groupId: groupId ?? '' });
  if (!res) return false;
  const body = res.body as { ok?: unknown } | null;
  return res.status === 200 && body?.ok === true;
}

export interface VoteResults {
  /** 有効票の合計 */
  total: number;
  /** 団体ID → 得票数 */
  counts: Record<string, number>;
  /** サーバが集計した時刻 (epoch ms) */
  updatedAt: number;
}

/** 集計結果を取得する (管理者トークン必須)。失敗時は例外。 */
export async function fetchVoteResults(): Promise<VoteResults> {
  const token = getAdminToken();
  if (!token) throw new Error('認証が切れています。ページを開き直して再認証してください');
  const res = await postJson('/api/votes/results', { token });
  if (!res) throw new Error('集計結果を取得できませんでした (接続を確認してください)');
  if (res.status === 401) throw new Error('認証が切れています。再認証してください');
  const body = res.body as { ok?: unknown; total?: unknown; counts?: unknown; updatedAt?: unknown } | null;
  if (res.status !== 200 || body?.ok !== true) throw new Error('集計結果を取得できませんでした');

  const counts: Record<string, number> = {};
  if (body.counts && typeof body.counts === 'object' && !Array.isArray(body.counts)) {
    for (const [id, value] of Object.entries(body.counts as Record<string, unknown>)) {
      const n = Number(value);
      if (id && Number.isFinite(n) && n > 0) counts[id] = n;
    }
  }
  const total = Number(body.total);
  const updatedAt = Number(body.updatedAt);
  return {
    total: Number.isFinite(total) && total > 0 ? total : 0,
    counts,
    updatedAt: Number.isFinite(updatedAt) ? updatedAt : Date.now(),
  };
}
