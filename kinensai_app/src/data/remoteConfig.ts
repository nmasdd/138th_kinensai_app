import Constants from 'expo-constants';

/**
 * 全世界配信 (リモートコンテンツ) の設定と取得。
 *
 * 仕組み:
 * - 運営が `/admin/data` の「全世界に公開」を押すと、各共有キー (`*.json`) が
 *   Worker (`POST /api/content/publish`、管理者トークン必須) 経由でKVに保存され、
 *   同時に `_meta.json` の `version` が更新される。
 * - 全端末のアプリは `contentUrl` (`${base}/${name}`) から共有コンテンツを取得し、
 *   端末プレビューが無い場合に同梱の正本より優先する。取得失敗時は同梱値。
 * - 配信URLはビルド時定数 (`app.json` の `extra.contentUrl`、
 *   本番 `https://app.kinensai.jp/api/content`) で全端末共通。
 *   Web静的exportでは extra が埋め込まれないためコード側既定値を持つ。
 *
 * 反映遅延を30秒以内にする仕組み:
 * - `_meta.json` の version を起動時・フォアグラウンド復帰時・在席中は
 *   `POLL_INTERVAL_MS` ごとに軽く確認する。version が変わればメモリキャッシュを
 *   破棄し、購読者 (画面) へ通知する。
 * - 各キーの取得URLに `?v=<version>` を付けるため、公開のたびに CDN/ブラウザの
 *   キャッシュキーが変わり、古いキャッシュを引かない (Workerの max-age は15秒)。
 * - 画面側は `subscribeContentUpdate()` で再読込し、フォーカス時にも再取得する。
 *
 * 開発と本番の分離 (重要):
 * - **開発時 (`__DEV__`) は既定でリモート取得を行わない。** 同梱値だけで動く。
 * - 開発中に配信値を確認したい場合だけ `EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1`。
 *   配信先を変える場合は `EXPO_PUBLIC_CONTENT_URL`。
 * - 本番ビルド (`__DEV__ === false`) では常にリモート取得が有効。
 */

/** メモリキャッシュの寿命。version 不一致時は即破棄されるため補助的な値。 */
const CACHE_TTL_MS = 15 * 1000;
/** 在席中に `_meta.json` を確認する間隔 (反映目標30秒以内)。 */
const POLL_INTERVAL_MS = 15 * 1000;
const FETCH_TIMEOUT_MS = 8000;

/**
 * 既定の配信ベースURL。Expo Web の静的exportでは
 * `Constants.expoConfig.extra` がバンドルに埋め込まれないため、
 * コード側の既定値を持つ (app.json の同名設定があればそちらを優先)。
 */
const DEFAULT_CONTENT_URL = 'https://app.kinensai.jp/api/content';

/** 環境変数を安全に読む (未定義の process.env でも落ちない)。 */
function envValue(name: string): string {
  try {
    const v = process.env?.[name];
    return typeof v === 'string' ? v.trim() : '';
  } catch {
    return '';
  }
}

/**
 * リモート取得を有効にするか。
 * 本番ビルドでは常に有効。開発時は明示的に有効化したときだけ有効
 * (`EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1`)。
 */
export function isRemoteContentEnabled(): boolean {
  if (!__DEV__) return true;
  const flag = envValue('EXPO_PUBLIC_ENABLE_REMOTE_CONTENT');
  return flag === '1' || flag === 'true';
}

/**
 * 全端末共通の配信ベースURL。未設定なら既定値。末尾スラッシュなしに正規化。
 * 開発時は `EXPO_PUBLIC_CONTENT_URL` で任意の配信先へ差し替えられる。
 */
export function getContentUrl(): string {
  const override = envValue('EXPO_PUBLIC_CONTENT_URL');
  if (override) return override.replace(/\/+$/, '');
  try {
    const extra = (Constants.expoConfig?.extra ?? {}) as { contentUrl?: unknown };
    const raw = typeof extra.contentUrl === 'string' ? extra.contentUrl.trim() : '';
    return (raw || DEFAULT_CONTENT_URL).replace(/\/+$/, '');
  } catch {
    return DEFAULT_CONTENT_URL;
  }
}

/** リモート配信が有効かつURLが設定済みか。 */
export function isRemoteContentConfigured(): boolean {
  return isRemoteContentEnabled() && getContentUrl().length > 0;
}

type CacheEntry = { at: number; version: number; value: unknown };
const cache = new Map<string, CacheEntry>();

/** 現在把握している公開版数。0 は「未取得/未公開」。 */
let currentVersion = 0;
let metaFetchedAt = 0;

const updateListeners = new Set<() => void>();

/**
 * 公開版数が更新されたときの購読。返り値で解除する。
 * 画面はこれを購読して再読込する (アンマウント時に解除)。
 */
export function subscribeContentUpdate(cb: () => void): () => void {
  updateListeners.add(cb);
  return () => {
    updateListeners.delete(cb);
  };
}

function notifyUpdate(): void {
  updateListeners.forEach((cb) => {
    try {
      cb();
    } catch {
      // 購読者側の例外で他へ波及させない
    }
  });
}

/** タイムアウト付き fetch (JSON)。失敗時は null。 */
async function fetchJson(url: string, noStore = false): Promise<unknown | null> {
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(url, {
        signal: ctrl.signal,
        cache: noStore ? 'no-store' : 'default',
      });
      if (!res.ok) return null;
      return (await res.json()) as unknown;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/**
 * `_meta.json` を確認し、版数が変わっていればキャッシュを破棄して購読者へ通知する。
 * `force` 時はキャッシュを無視して取得する (フォアグラウンド復帰・手動更新用)。
 * リモート無効時は何もしない。
 */
export async function refreshContentVersion(options: { force?: boolean } = {}): Promise<boolean> {
  if (!isRemoteContentEnabled()) return false;
  const base = getContentUrl();
  if (!base) return false;
  const now = Date.now();
  if (!options.force && now - metaFetchedAt < POLL_INTERVAL_MS) return false;
  const bust = options.force ? `?v=${now}` : '';
  const meta = await fetchJson(`${base}/_meta.json${bust}`, options.force);
  metaFetchedAt = now;
  if (!meta || typeof meta !== 'object') return false;
  const version = Number((meta as { version?: unknown }).version);
  if (!Number.isFinite(version) || version <= 0) return false;
  if (version !== currentVersion) {
    currentVersion = version;
    cache.clear();
    notifyUpdate();
    return true;
  }
  return false;
}

/**
 * 共有キー (`volunteers.json` 等) のリモート値を取得する。
 * 取得不可・未設定・タイムアウト時は null (呼び出し側は同梱値を使う)。
 * 開発時にリモートが無効ならネットワークアクセスせず即 null を返す。
 * 取得URLには現在の版数を付け、公開のたびにキャッシュキーを変える。
 */
export async function fetchSharedJSON(name: string): Promise<unknown | null> {
  if (!isRemoteContentEnabled()) return null;
  const base = getContentUrl();
  if (!base) return null;
  const now = Date.now();
  const hit = cache.get(name);
  if (hit && now - hit.at < CACHE_TTL_MS && hit.version === currentVersion) return hit.value;
  const q = currentVersion > 0 ? `?v=${currentVersion}` : '';
  const parsed = await fetchJson(`${base}/${name}${q}`);
  if (parsed === null) return null;
  cache.set(name, { at: now, version: currentVersion, value: parsed });
  return parsed;
}

/**
 * メモリキャッシュを破棄する。公開直後 (管理者端末) や
 * フォアグラウンド復帰時に呼ぶ。currentVersion は据え置く。
 */
export function clearRemoteCache(): void {
  cache.clear();
}

/** 版数・キャッシュ・メタ確認時刻をすべて初期化する (テスト用)。 */
export function resetRemoteState(): void {
  cache.clear();
  currentVersion = 0;
  metaFetchedAt = 0;
}

let pollTimer: ReturnType<typeof setInterval> | null = null;

/**
 * 在席中の定期ポーリングを開始する。アプリ起動時に1回呼ぶ。
 * `_meta.json` の版数を `POLL_INTERVAL_MS` ごとに確認し、更新があれば通知する。
 */
export function startContentPolling(): () => void {
  if (!isRemoteContentEnabled()) return () => {};
  // 起動直後に一度確認 (前回起動から時間が経っている場合に即反映)
  void refreshContentVersion({ force: true });
  if (pollTimer) clearInterval(pollTimer);
  pollTimer = setInterval(() => {
    void refreshContentVersion();
  }, POLL_INTERVAL_MS);
  return () => {
    if (pollTimer) {
      clearInterval(pollTimer);
      pollTimer = null;
    }
  };
}

/**
 * 配信中の値を (キャッシュを無視して) 取得する。取得不可なら null。
 * `/admin/data` の「配信中の値を確認」で、本番KVに入っている値＝
 * 他端末が見る値 (最新の版数) をそのまま確認するために使う。
 */
export async function fetchPublishedJSON(name: string, cacheBust?: number): Promise<unknown | null> {
  const base = getContentUrl();
  if (!base) return null;
  const bust = cacheBust ?? Date.now();
  return fetchJson(`${base}/${name}?v=${bust}`, true);
}
