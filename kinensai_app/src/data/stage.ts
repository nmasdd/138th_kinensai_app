import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { loadJSON, saveJSON } from './kvStore';

export interface StageGroup {
  id: string;
  name: string;
  detail: string;
  /** 管理者ページで登録した画像 (file:// URI または dataURL)。なければ null */
  imageUri?: string | null;
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
const GROUPS_KEY = 'stage-groups.json';

async function loadGroups(): Promise<StageGroup[]> {
  const parsed = await loadJSON<unknown>(GROUPS_KEY, null);
  if (Array.isArray(parsed)) return parsed as StageGroup[];
  return bundledGroups;
}

/** 管理者ページから出演団体一覧を保存する */
export async function saveStageGroups(groups: StageGroup[]): Promise<void> {
  await saveJSON(GROUPS_KEY, groups);
}

export function useStageGroups() {
  const [groups, setGroups] = useState<StageGroup[]>(bundledGroups);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 管理者ページの保存を即反映するため、表示のたびに再読込する
  useFocusEffect(
    useCallback(() => {
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
    }, []),
  );

  const vote = useCallback((id: string) => {
    setVotedId(id);
    if (!FileSystem.documentDirectory) return;
    FileSystem.writeAsStringAsync(VOTES_FILE, JSON.stringify(id), {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => {});
  }, []);

  return { groups, votedId, vote, isLoading };
}
