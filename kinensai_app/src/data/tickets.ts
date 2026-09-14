import { loadJSON, saveJSON } from './kvStore';
import ticketJson from './bundled/tickets.json';

export interface TicketInfo {
  required: 'none' | 'required';
  time: string | null;
}

const KEY = 'tickets.json';

/**
 * 整理券情報の同梱正本。完成パンフレットのクラス企画「整理券 有/無」バッジに基づく
 * (`bundled/tickets.json`)。有志企画・高校3年模擬店は「不要」。
 */
export const bundledTickets = ticketJson as unknown as Record<string, TicketInfo>;

/**
 * 整理券情報。管理者ページから {"1A": {"required": "required", "time": "10:00〜"}}
 * の形で保存・差分替えできる。未保存・未配信のときは同梱正本を使う。
 */
export async function loadTicketMap(): Promise<Record<string, TicketInfo>> {
  const parsed = await loadJSON<unknown>(KEY, null);
  if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
    return parsed as Record<string, TicketInfo>;
  }
  return bundledTickets;
}

export async function saveTicketMap(map: Record<string, TicketInfo>): Promise<void> {
  await saveJSON(KEY, map);
}
