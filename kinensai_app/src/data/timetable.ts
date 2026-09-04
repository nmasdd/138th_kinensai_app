import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

export interface StageItem {
  id: string;
  team: string;
  /** 0=土, 1=日 */
  day: number;
  start: string;
  end: string;
  /** 遅延分数。現地配信が来たらここに反映する。未定は0 */
  delayMinutes: number;
}

function parseCsv(csv: string): StageItem[] {
  return csv
    .trim()
    .split('\n')
    .map((line, index) => {
      const parts = line.split(',').map((p) => p.trim());
      if (parts.length === 5) {
        return {
          id: parts[0],
          team: parts[1],
          day: parseInt(parts[2], 10),
          start: parts[3],
          end: parts[4],
          delayMinutes: 0,
        };
      }
      if (parts.length === 4) {
        return {
          id: String(index),
          team: parts[0],
          day: parseInt(parts[1], 10),
          start: parts[2],
          end: parts[3],
          delayMinutes: 0,
        };
      }
      return null;
    })
    .filter((v): v is StageItem => v !== null);
}

export async function loadAuditorium(): Promise<StageItem[]> {
  const asset = Asset.fromModule(require('../../time/Auditorium.csv'));
  await asset.downloadAsync();
  if (!asset.localUri) return [];
  const text = await FileSystem.readAsStringAsync(asset.localUri);
  return parseCsv(text);
}

function toMinutes(t: string): number {
  const [h, m] = t.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

/** 現在開催中のものを返す。delayMinutes を加味した開始時刻で判定する */
export function findNow(items: StageItem[], now: Date): StageItem | null {
  const day = now.getDay() === 6 ? 0 : now.getDay() === 0 ? 1 : -1;
  if (day < 0) return null;
  const cur = now.getHours() * 60 + now.getMinutes();
  return (
    items.find((it) => {
      if (it.day !== day) return false;
      const s = toMinutes(it.start) + it.delayMinutes;
      const e = toMinutes(it.end) + it.delayMinutes;
      return s <= cur && cur < e;
    }) ?? null
  );
}
