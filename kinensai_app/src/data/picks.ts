import { loadJSON, saveJSON } from './kvStore';

/**
 * ホームの「おすすめ企画」で表示する企画ID列。
 * 管理者ページで選択し、`picks.json` (`{ids: string[]}`) に永続化する。
 * ホーム側はこのID群を抽選プールとして使い、表示のたびにランダムで2件を表示する。
 * 未設定 (空配列) のときは全企画をプールにする。
 */

const PICKS_KEY = 'picks.json';

export interface PicksData {
  ids: string[];
}

function isPicksData(value: unknown): value is PicksData {
  return !!value && typeof value === 'object' && Array.isArray((value as PicksData).ids);
}

/** 保存済みの企画ID列を読む。未設定・破損時は空配列を返す。 */
export async function loadPickIds(): Promise<string[]> {
  const parsed = await loadJSON<unknown>(PICKS_KEY, null);
  if (!isPicksData(parsed)) return [];
  return parsed.ids.filter((id): id is string => typeof id === 'string');
}

/** 企画ID列を保存する。 */
export async function savePickIds(ids: string[]): Promise<void> {
  const data: PicksData = { ids: [...ids] };
  await saveJSON(PICKS_KEY, data);
}
