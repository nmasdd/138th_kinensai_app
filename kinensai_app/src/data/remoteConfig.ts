import Constants from 'expo-constants';

/**
 * 全世界配信 (リモートコンテンツ) の設定と取得。
 *
 * 仕組み:
 * - 運営が `/admin/data` の「全世界に公開」を押すと、各共有キー (`*.json`) が
 *   Worker (`POST /api/content/publish`、管理者トークン必須) 経由でKVに保存される。
 * - 全端末のアプリは起動・フォーカス時に `contentUrl` (`${base}/${name}`) から
 *   共有コンテンツを取得し、端末プレビューが無い場合に同梱の正本より優先する。
 *   取得失敗時は同梱値にフォールバックする。
 * - 配信URLはビルド時定数 (`app.json` の `extra.contentUrl`、
 *   本番 `https://app.kinensai.jp/api/content`) で全端末共通。
 *   Web静的exportでは extra が埋め込まれないためコード側既定値を持つ。
 *   空文字の場合はリモート取得をせず、同梱値を使う。
 *
 * 管理者ページの変更を全世界へ反映する手順:
 *   1. `/admin/*` で内容を編集し、この端末のプレビューで確認する。
 *   2. `/admin/data` で「全世界に公開」を実行する。
 *   3. 各端末は次回起動・再表示時に新内容を取得する (最大 CACHE_TTL_MS 遅延)。
 */

const CACHE_TTL_MS = 5 * 60 * 1000;
const FETCH_TIMEOUT_MS = 8000;

/**
 * 既定の配信ベースURL。Expo Web の静的exportでは
 * `Constants.expoConfig.extra` がバンドルに埋め込まれないため、
 * コード側の既定値を持つ (app.json の同名設定があればそちらを優先)。
 */
const DEFAULT_CONTENT_URL = 'https://app.kinensai.jp/api/content';

const cache = new Map<string, { at: number; value: unknown }>();

/** 全端末共通の配信ベースURL。未設定なら既定値。末尾スラッシュなしに正規化。 */
export function getContentUrl(): string {
  try {
    const extra = (Constants.expoConfig?.extra ?? {}) as { contentUrl?: unknown };
    const raw = typeof extra.contentUrl === 'string' ? extra.contentUrl.trim() : '';
    return (raw || DEFAULT_CONTENT_URL).replace(/\/+$/, '');
  } catch {
    return DEFAULT_CONTENT_URL;
  }
}

/** リモート配信が設定済みか。 */
export function isRemoteContentConfigured(): boolean {
  return getContentUrl().length > 0;
}

/**
 * 共有キー (`volunteers.json` 等) のリモート値を取得する。
 * 取得不可・未設定・タイムアウト時は null (呼び出し側は同梱値を使う)。
 */
export async function fetchSharedJSON(name: string): Promise<unknown | null> {
  const base = getContentUrl();
  if (!base) return null;
  const now = Date.now();
  const hit = cache.get(name);
  if (hit && now - hit.at < CACHE_TTL_MS) return hit.value;
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), FETCH_TIMEOUT_MS);
    try {
      const res = await fetch(`${base}/${name}`, { signal: ctrl.signal });
      if (!res.ok) return null;
      const parsed: unknown = await res.json();
      cache.set(name, { at: now, value: parsed });
      return parsed;
    } finally {
      clearTimeout(timer);
    }
  } catch {
    return null;
  }
}

/** テスト・再取得用にメモリキャッシュを破棄する。 */
export function clearRemoteCache(): void {
  cache.clear();
}
