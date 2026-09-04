import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

export interface StageGroup {
  id: string;
  name: string;
  detail: string;
}

/**
 * ステージ出演団体。団体名・写真・詳細の本データが来たらここで結合する。
 * 写真は未定のため null 表示 (プレースホルダ枠)。
 */
const bundledGroups: StageGroup[] = [
  { id: 'group-a', name: '出演団体A (仮)', detail: '詳細準備中' },
  { id: 'group-b', name: '出演団体B (仮)', detail: '詳細準備中' },
];

const VOTES_FILE = `${FileSystem.documentDirectory}stage-votes.json`;
const GROUPS_FILE = `${FileSystem.documentDirectory}stage-groups.json`;

async function loadGroups(): Promise<StageGroup[]> {
  try {
    if (!FileSystem.documentDirectory) return bundledGroups;
    const info = await FileSystem.getInfoAsync(GROUPS_FILE);
    if (!info.exists) return bundledGroups;
    const raw = await FileSystem.readAsStringAsync(GROUPS_FILE);
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) return parsed as StageGroup[];
  } catch {}
  return bundledGroups;
}

export function useStageGroups() {
  const [groups, setGroups] = useState<StageGroup[]>(bundledGroups);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedGroups, savedVote] = await Promise.all([
        loadGroups(),
        (async () => {
          try {
            if (!FileSystem.documentDirectory) return null;
            const info = await FileSystem.getInfoAsync(VOTES_FILE);
            if (!info.exists) return null;
            const raw = await FileSystem.readAsStringAsync(VOTES_FILE);
            const parsed: unknown = JSON.parse(raw);
            return typeof parsed === 'string' ? parsed : null;
          } catch {
            return null;
          }
        })(),
      ]);
      if (cancelled) return;
      setGroups(loadedGroups);
      if (savedVote) setVotedId(savedVote);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const vote = useCallback((id: string) => {
    setVotedId(id);
    if (!FileSystem.documentDirectory) return;
    FileSystem.writeAsStringAsync(VOTES_FILE, JSON.stringify(id), {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => {});
  }, []);

  return { groups, votedId, vote, isLoading };
}
