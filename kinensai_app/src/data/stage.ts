import { useCallback, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';
import { loadJSON, saveJSON } from './kvStore';
import { useContentEffect } from '../context/useContentRefreshKey';
import type { StageItem } from './timetable';
import stageGroupsJson from './bundled/stage-groups.json';
import auditoriumGroupsJson from './bundled/auditorium-groups.json';

/**
 * 出演団体。ステージ (野外ステージ) と講堂でデータを分けて管理する。
 * 詳細モーダルで紹介文・写真を表示するため、`detail` (短い紹介) とは別に
 * `intro` (モーダル用の長い紹介文) を持つ。
 */
export interface StageGroup {
  id: string;
  name: string;
  detail: string;
  /** 詳細モーダル用の長い紹介文。未設定なら detail を使う */
  intro?: string;
  /** 所属・活動ジャンルなどの短い見出し (任意) */
  genre?: string;
  /** 管理者ページで登録した画像 (file:// URI または dataURL)。なければ null */
  imageUri?: string | null;
  /** 演目の曜日 (0=土, 1=日)。未定なら undefined */
  day?: number;
  /** 開始時刻 "HH:MM"。未定なら undefined */
  start?: string;
  /** 終了時刻 "HH:MM"。未定なら undefined */
  end?: string;
  /** 遅延分数 (既定0)。リアルタイム配信が来たらここに反映する */
  delayMinutes?: number;
}

/**
 * ステージ (野外ステージ) 出演団体。日時が確定しているものは
 * タイムテーブルの時間割として描画する。
 * 本データが来たらここを差し替える (現在は動作確認用サンプル)。
 */
export const bundledGroups: StageGroup[] = stageGroupsJson as StageGroup[];

/**
 * 講堂出演団体。時間割は time/Auditorium.csv (講堂タイムテーブル) を正とし、
 * ここには詳細モーダル用の紹介文・ジャンルなどのメタ情報を持たせる。
 * 同じ団体名が両方にあれば講堂タブで紹介文を表示できる。
 */
export const bundledAuditoriumGroups: StageGroup[] = auditoriumGroupsJson as StageGroup[];

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
const AUDITORIUM_GROUPS_KEY = 'auditorium-groups.json';

async function loadGroupsOf(key: string, fallback: StageGroup[]): Promise<StageGroup[]> {
  const parsed = await loadJSON<unknown>(key, null);
  if (Array.isArray(parsed)) return parsed as StageGroup[];
  return fallback;
}

/** 管理者ページからステージ出演団体一覧を保存する */
export async function saveStageGroups(groups: StageGroup[]): Promise<void> {
  await saveJSON(GROUPS_KEY, groups);
}

/** 管理者ページから講堂出演団体一覧を保存する */
export async function saveAuditoriumGroups(groups: StageGroup[]): Promise<void> {
  await saveJSON(AUDITORIUM_GROUPS_KEY, groups);
}

/**
 * 出演団体の一覧を読み込む。`kind` でステージ/講堂を切り替える。
 * 表示のたびに再読込して管理者の保存を即反映する。
 */
export function usePerformerGroups(kind: 'stage' | 'auditorium' = 'stage') {
  const fallback = kind === 'auditorium' ? bundledAuditoriumGroups : bundledGroups;
  const key = kind === 'auditorium' ? AUDITORIUM_GROUPS_KEY : GROUPS_KEY;
  const [groups, setGroups] = useState<StageGroup[]>(fallback);
  const [votedId, setVotedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 管理者ページの保存・公開コンテンツの更新・画面フォーカスで再読込する
  useContentEffect(() => {
    let cancelled = false;
    (async () => {
      const [loadedGroups, savedVote] = await Promise.all([
        loadGroupsOf(key, fallback),
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
  }, [key, fallback]);

  const vote = useCallback((id: string) => {
    setVotedId(id);
    if (!FileSystem.documentDirectory) return;
    FileSystem.writeAsStringAsync(VOTES_FILE, JSON.stringify(id), {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => {});
  }, []);

  return { groups, votedId, vote, isLoading };
}

/** 後方互換: ステージ出演団体のフック。 */
export function useStageGroups() {
  return usePerformerGroups('stage');
}

/**
 * 講堂の演目名 (Auditorium.csv) と講堂出演団体メタ情報を突き合わせて
 * 紹介文付きの団体を返す。メタ情報がない演目は名前のみの団体として返す。
 */
export function auditoriumGroupsForItems(items: StageItem[], meta: StageGroup[]): StageGroup[] {
  const byName = new Map(meta.map((g) => [g.name, g]));
  const seen = new Set<string>();
  const out: StageGroup[] = [];
  for (const it of items) {
    if (seen.has(it.team)) continue;
    seen.add(it.team);
    const m = byName.get(it.team);
    out.push(
      m ?? {
        id: `aud-${it.team}`,
        name: it.team,
        detail: '紹介文は準備中です。',
      },
    );
  }
  return out;
}
