import { loadJSON, saveJSON } from './kvStore';

export type CongestionLevel = 'unknown' | 'empty' | 'normal' | 'crowded';

const KEY = 'congestion.json';

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
 * 講堂混雑のリアルタイム配信受け口。管理者ページから {"level": "crowded"}
 * の形で保存できる。なければ unknown。
 */
export async function loadCongestion(): Promise<CongestionLevel> {
  const parsed = await loadJSON<{ level?: CongestionLevel }>(KEY, { level: 'unknown' });
  if (parsed.level === 'empty' || parsed.level === 'normal' || parsed.level === 'crowded') {
    return parsed.level;
  }
  return 'unknown';
}

export async function saveCongestion(level: CongestionLevel): Promise<void> {
  await saveJSON(KEY, { level });
}
