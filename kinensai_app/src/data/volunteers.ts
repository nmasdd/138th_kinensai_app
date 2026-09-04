import * as FileSystem from 'expo-file-system/legacy';
import type { Exhibition } from './exhibitions';

const FILE = `${FileSystem.documentDirectory}volunteers.json`;

const bundled: Exhibition[] = [
  {
    id: 'vol-1',
    className: '有志A (仮)',
    projectName: '(タイトル未定)',
    description: '(説明準備中)',
    ticketRequired: 'unknown',
    ticketTime: null,
    kind: 'volunteer',
    place: null,
  },
  {
    id: 'vol-2',
    className: '有志B (仮)',
    projectName: '(タイトル未定)',
    description: '(説明準備中)',
    ticketRequired: 'unknown',
    ticketTime: null,
    kind: 'volunteer',
    place: null,
  },
];

/**
 * 教室有志企画。部活・組織の本データが来たら volunteers.json で差し替え可能。
 */
export async function loadVolunteers(): Promise<Exhibition[]> {
  try {
    if (!FileSystem.documentDirectory) return bundled;
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return bundled;
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as Exhibition[];
  } catch {}
  return bundled;
}
