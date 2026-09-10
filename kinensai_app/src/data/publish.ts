/**
 * 公開ビルド安全のための区分。
 * - 端末個人データ (お気に入り・投票): 公開ビルドでも端末保存してよい。
 * - 共有コンテンツ (企画・通知・ステージ・混雑・整理券・運営設定):
 *   公開ビルドでは端末の上書きを無視し、同梱の正本だけを使う。
 *   管理者ページの変更が「全世界のアプリ」に波及することはない。
 *   コンテンツ更新はソース (planning/・time/・src/data/*) の差し替え +
 *   ストア更新 (再ビルド/OTA) で行う。
 */

declare const __DEV__: boolean;

/** 公開ビルド (リリース) か。開発中は false。 */
export function isProductionBuild(): boolean {
  try {
    return !__DEV__;
  } catch {
    return false;
  }
}

/** 端末個人データのキー (公開ビルドでも読み書き可)。 */
const PER_USER_KEYS = new Set<string>(['favorites.json', 'stage-votes.json']);

/** 端末個人データのキーか (公開ビルドでも読み書き可)。 */
export function isPerUserKey(key: string): boolean {
  return PER_USER_KEYS.has(key);
}

/** 指定キーの端末上書きを公開ビルドで許可するか。 */
export function isLocalOverrideAllowed(key: string): boolean {
  if (PER_USER_KEYS.has(key)) return true;
  return !isProductionBuild();
}
