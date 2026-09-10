import { loadJSON, saveJSON } from './kvStore';

export interface TicketInfo {
  required: 'none' | 'required';
  time: string | null;
}

const KEY = 'tickets.json';

/**
 * 整理券情報の受口。管理者ページから {"1A": {"required": "required", "time": "10:00〜"}}
 * の形で保存できる。なければ全企画「確認中」のまま。
 */
export async function loadTicketMap(): Promise<Record<string, TicketInfo>> {
  const parsed = await loadJSON<unknown>(KEY, {});
  if (parsed && typeof parsed === 'object') return parsed as Record<string, TicketInfo>;
  return {};
}

export async function saveTicketMap(map: Record<string, TicketInfo>): Promise<void> {
  await saveJSON(KEY, map);
}
