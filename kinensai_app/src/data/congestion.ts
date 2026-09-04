import * as FileSystem from 'expo-file-system/legacy';

export type CongestionLevel = 'unknown' | 'empty' | 'normal' | 'crowded';

const FILE = `${FileSystem.documentDirectory}congestion.json`;

const label: Record<CongestionLevel, string> = {
  unknown: '混雑状況: 確認中',
  empty: '混雑状況: 空いています',
  normal: '混雑状況: やや混雑',
  crowded: '混雑状況: 混雑しています',
};

export function congestionLabel(level: CongestionLevel): string {
  return label[level];
}

/**
 * 講堂混雑のリアルタイム配信受け口。現地配信が来るまでは unknown。
 * congestion.json を置けば {"level": "crowded"} で差し替え可能。
 */
export async function loadCongestion(): Promise<CongestionLevel> {
  if (!FileSystem.documentDirectory) return 'unknown';
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return 'unknown';
    const raw = await FileSystem.readAsStringAsync(FILE);
    const parsed = JSON.parse(raw) as { level?: CongestionLevel };
    if (parsed.level === 'empty' || parsed.level === 'normal' || parsed.level === 'crowded') {
      return parsed.level;
    }
  } catch {}
  return 'unknown';
}
