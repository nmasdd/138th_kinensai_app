import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import * as FileSystem from 'expo-file-system/legacy';
import { loadJSON, saveJSON } from './kvStore';
import type { StageItem } from './timetable';

export interface StageGroup {
  id: string;
  name: string;
  detail: string;
  /** 管理者ページで登録した画像 (file:// URI または dataURL)。なければ null */
  imageUri?: string | null;
  /** ステージ演目の曜日 (0=土, 1=日)。未定なら undefined */
  day?: number;
  /** 開始時刻 "HH:MM"。未定なら undefined */
  start?: string;
  /** 終了時刻 "HH:MM"。未定なら undefined */
  end?: string;
  /** 遅延分数 (既定0)。リアルタイム配信が来たらここに反映する */
  delayMinutes?: number;
}

/**
 * ステージ出演団体。日時が確定しているものは講堂と同じ時間割として描画する。
 * 本データが来たらここを差し替える (現在は動作確認用サンプル)。
 */
export const bundledGroups: StageGroup[] = [
  { id: 'group-a', name: '吹奏楽部', detail: 'クラシックからポップスまで幅広く演奏します。', day: 0, start: '12:15', end: '12:45' },
  { id: 'group-b', name: '合唱部', detail: '混声合唱で名曲をお届けします。', day: 0, start: '12:55', end: '13:25' },
  { id: 'group-c', name: 'ダンス部', detail: '迫力のステージパフォーマンス。', day: 0, start: '13:35', end: '14:10' },
  { id: 'group-d', name: '軽音楽部', detail: 'バンドサウンドで会場を盛り上げます。', day: 0, start: '14:20', end: '15:00' },
  { id: 'group-e', name: '弦楽部', detail: '弦楽合奏をお楽しみください。', day: 1, start: '09:15', end: '09:45' },
  { id: 'group-f', name: '演劇部', detail: 'オリジナル短編を上演します。', day: 1, start: '09:55', end: '10:35' },
  { id: 'group-g', name: 'コーラス部', detail: 'みんなで歌う企画もあります。', day: 1, start: '10:45', end: '11:15' },
];

/**
 * 日時が確定している出演団体をタイムテーブル用の演目に変換する。
 * day/start/end が未設定の団体は時間割に載せない (出演団体一覧には表示)。
 */
export function groupStageItems(groups: StageGroup[]): StageItem[] {
  const timeRe = /^\d{1,2}:\d{2}$/;
  const out: StageItem[] = [];
  for (const g of groups) {
    if ((g.day === 0 || g.day === 1) && timeRe.test(g.start ?? '') && timeRe.test(g.end ?? '')) {
      out.push({
        id: g.id,
        team: g.name,
        day: g.day,
        start: g.start as string,
        end: g.end as string,
        delayMinutes: typeof g.delayMinutes === 'number' && g.delayMinutes > 0 ? g.delayMinutes : 0,
      });
    }
  }
  return out;
}

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
