import { loadJSON, saveJSON } from './kvStore';
import type { Exhibition } from './exhibitions';
import bundledJson from './bundled/volunteers.json';

const KEY = 'volunteers.json';

/**
 * クラブ・有志企画の同梱データ (「クラブ・融資確定版.xlsx」No.1〜45 全45件)。
 * 正本は `bundled/volunteers.json` (差分レビュー・一括編集しやすいよう
 * TS リテラルから分離)。管理者ページから volunteers.json として保存・
 * 差し替えできる (保存済みがあればそちらが優先)。
 * id は `club-<No.2桁>`。個人情報列 (担当者氏名・所属・連絡先・備考等) は取り込んでいない。
 */
export const bundled: Exhibition[] = bundledJson as Exhibition[];

export async function loadVolunteers(): Promise<Exhibition[]> {
  const parsed = await loadJSON<unknown>(KEY, null);
  if (Array.isArray(parsed)) return parsed as Exhibition[];
  return bundled;
}

export async function saveVolunteers(list: Exhibition[]): Promise<void> {
  await saveJSON(KEY, list);
}
