import * as FileSystem from 'expo-file-system/legacy';

export interface TicketInfo {
  required: 'none' | 'required';
  time: string | null;
}

const FILE = `${FileSystem.documentDirectory}tickets.json`;

/**
 * 整理券情報の受口。tickets.json を端末に置けば
 * {"1A": {"required": "required", "time": "10:00〜"}} の形で差し替え可能。
 * なければ全企画「確認中」のまま。
 */
export async function loadTicketMap(): Promise<Record<string, TicketInfo>> {
  try {
    if (!FileSystem.documentDirectory) return {};
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return {};
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed: unknown = JSON.parse(raw);
    if (parsed && typeof parsed === 'object') return parsed as Record<string, TicketInfo>;
  } catch {}
  return {};
}
