import * as FileSystem from 'expo-file-system/legacy';
import { Asset } from 'expo-asset';
import type { Exhibition, DayType, TimeSlot } from './types';

const RESERVATION_DIR = `${FileSystem.documentDirectory}reservation`;

function isTimeFormat(value: string): boolean {
  return /^\d{1,2}:\d{2}$/.test(value.trim());
}

export function getCsvStoragePath(className: string, day: string): string {
  return `${RESERVATION_DIR}/${className}/${day}.csv`;
}

export function parseCsvText(csvText: string): {
  timeValues: string[];
  capacity: number;
  reservedCounts: number[];
} {
  const lines = csvText
    .replace(/\r\n/g, '\n')
    .replace(/\r/g, '\n')
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0);

  const timeValues = lines[0].split(',').map((v) => v.trim()).filter((v) => v.length > 0);
  const capacity = parseInt(lines[1], 10) || 0;
  const reservedCounts = lines[2].split(',').map((v) => parseInt(v.trim(), 10) || 0);

  return { timeValues, capacity, reservedCounts };
}

export function formatCsvText(timeValues: string[], capacity: number, reservedCounts: number[]): string {
  return [timeValues.join(','), String(capacity), reservedCounts.join(',')].join('\n') + '\n';
}

export function buildTimeSlots(timeValues: string[], capacity: number, reservedCounts: number[]): TimeSlot[] {
  const slots: TimeSlot[] = [];
  for (let i = 0; i + 1 < timeValues.length; i += 2) {
    if (isTimeFormat(timeValues[i]) && isTimeFormat(timeValues[i + 1])) {
      const slotIndex = slots.length;
      slots.push({
        start: timeValues[i],
        end: timeValues[i + 1],
        capacity,
        reservedCount: reservedCounts[slotIndex] ?? 0,
      });
    }
  }
  return slots;
}

export function buildExhibition(
  day: DayType,
  className: string,
  title: string,
  detail: string,
  timeSlots: TimeSlot[],
): Exhibition {
  return {
    id: `${day === 'saturday' ? '土曜日' : '日曜日'}_${className}`,
    day,
    className,
    projectName: title.trim(),
    description: detail.trim(),
    timeSlots,
  };
}

export async function loadCsvFromBundle(csvAsset: any): Promise<string> {
  const asset = Asset.fromModule(csvAsset);
  await asset.downloadAsync();
  if (!asset.localUri) {
    throw new Error('アセットの読み込みに失敗');
  }
  return await FileSystem.readAsStringAsync(asset.localUri);
}

export async function loadCsvFromStorage(className: string, day: string): Promise<string | null> {
  try {
    const path = getCsvStoragePath(className, day);
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      return await FileSystem.readAsStringAsync(path);
    }
  } catch {}
  return null;
}

export async function writeCsvToStorage(className: string, day: string, csvText: string): Promise<void> {
  const dir = `${RESERVATION_DIR}/${className}`;
  const dirInfo = await FileSystem.getInfoAsync(dir);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(dir, { intermediates: true });
  }
  await FileSystem.writeAsStringAsync(getCsvStoragePath(className, day), csvText, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}
