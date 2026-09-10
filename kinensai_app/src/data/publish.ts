/**
 * 共有コンテンツと端末個人データの区分。
 * - 端末個人データ (お気に入り・投票): 配信対象外。端末保存のみ。
 * - 共有コンテンツ (企画・通知・ステージ・混雑・整理券・運営設定):
 *   端末保存は「この端末のプレビュー」で、他端末には波及しない。
 *   全世界への反映は /admin/data の「全世界に公開」(サーバ経由) で行う。
 */

/** 端末個人データのキー (配信対象外)。 */
const PER_USER_KEYS = new Set<string>(['favorites.json', 'stage-votes.json']);

/** 端末個人データのキーか (配信対象外)。 */
export function isPerUserKey(key: string): boolean {
  return PER_USER_KEYS.has(key);
}
