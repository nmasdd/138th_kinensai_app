import { useCallback, useState } from 'react';
import { clearLocalKey, loadJSON, saveJSON } from './kvStore';
import { getVoterId, submitVote } from './votes';
import { useContentEffect } from '../context/useContentRefreshKey';
import type { StageItem } from './timetable';
import stageGroupsJson from './bundled/stage-groups.json';
import auditoriumGroupsJson from './bundled/auditorium-groups.json';
import { withContentImage } from './contentImages';

/**
 * 出演団体。ステージ (野外ステージ) と講堂でデータを分けて管理する。
 * 時間割は `time/Stage.csv` (ステージ) / `time/Auditorium.csv` (講堂) を正とし、
 * ここには詳細モーダル用の紹介文・写真・ジャンルなどのメタ情報を持たせる。
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
}

/**
 * ステージ (野外ステージ) 出演団体。時間割は `time/Stage.csv` を正とし、
 * ここには紹介文・写真などのメタ情報を持たせる。
 */
export const bundledGroups: StageGroup[] = stageGroupsJson as StageGroup[];

/**
 * 講堂出演団体。時間割は time/Auditorium.csv (講堂タイムテーブル) を正とし、
 * ここには詳細モーダル用の紹介文・ジャンルなどのメタ情報を持たせる。
 * 同じ団体名が両方にあれば講堂タブで紹介文を表示できる。
 */
export const bundledAuditoriumGroups: StageGroup[] = auditoriumGroupsJson as StageGroup[];

const VOTES_KEY = 'stage-votes.json';
const GROUPS_KEY = 'stage-groups.json';
const AUDITORIUM_GROUPS_KEY = 'auditorium-groups.json';

/**
 * オーディエンス投票を受け付けるか。
 * 現在は受付を停止している (vote.tsx で「現在は投票できません」を表示し操作を無効化)。
 * 再開するときは true に戻す。
 */
export const VOTING_ENABLED = false;

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
  const [groups, setGroups] = useState<StageGroup[]>(() => fallback.map(withContentImage));
  const [votedId, setVotedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 管理者ページの保存・公開コンテンツの更新・画面フォーカスで再読込する
  useContentEffect(() => {
    let cancelled = false;
    (async () => {
      // 投票者IDを早めに確定させる (未生成なら作成して端末保存)
      void getVoterId();
      const [loadedGroups, savedVote] = await Promise.all([
        loadGroupsOf(key, fallback),
        loadJSON<unknown>(VOTES_KEY, null),
      ]);
      if (cancelled) return;
      setGroups(loadedGroups.map(withContentImage));
      if (typeof savedVote === 'string') setVotedId(savedVote);
      else setVotedId(null);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [key, fallback]);

  // 投票/変更。端末の表示を即更新しつつ Worker へ送信して集計に反映する。
  const vote = useCallback((id: string) => {
    setVotedId(id);
    saveJSON(VOTES_KEY, id).catch(() => {});
    void submitVote(id);
  }, []);

  // 投票の取消。端末の表示を消し、サーバ側の票も取り消す。
  const clearVote = useCallback(() => {
    setVotedId(null);
    clearLocalKey(VOTES_KEY).catch(() => {});
    void submitVote(null);
  }, []);

  return { groups, votedId, vote, clearVote, isLoading };
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
      m ??
        withContentImage({
          id: `aud-${it.team}`,
          name: it.team,
          detail: '紹介文は準備中です。',
        }),
    );
  }
  return out;
}
