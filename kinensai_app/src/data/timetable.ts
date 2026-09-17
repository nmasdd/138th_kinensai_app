import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { loadJSON, saveJSON } from './kvStore';

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

/**
 * ステージ (野外ステージ) の演目IDの接頭辞。
 * 講堂CSVのIDは行番号 (数字) のため、講堂と共有する上書き・遅延データ
 * (`timetable-overrides.json` / `delays.json`) で衝突しないよう区別する。
 */
export const STAGE_ID_PREFIX = 'stage-';

/** IDがステージ (CSV) 由来かを返す。 */
export function isStageId(id: string): boolean {
  return id.startsWith(STAGE_ID_PREFIX);
}

/** "team,day,start,end" (任意で先頭ID) を解析する。4列のIDは idPrefix + 行番号。 */
function parseCsv(csv: string, idPrefix = ''): StageItem[] {
  return csv
    .trim()
    .split(/\r?\n/)
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
          id: `${idPrefix}${index}`,
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

/** 同梱のタイムテーブルCSV (`time/*.csv`) を読み込む。 */
async function loadCsvAsset(module: number, idPrefix = ''): Promise<StageItem[]> {
  try {
    const asset = Asset.fromModule(module);
    await asset.downloadAsync();
    const uri = asset.localUri ?? (asset as { uri?: string }).uri;
    if (!uri) return [];
    let text: string;
    // Web: asset URI は相対パスのため fetch で読む (同一オリジン解決)。
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      if (!res.ok) return [];
      text = await res.text();
    } else if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const res = await fetch(uri);
      if (!res.ok) return [];
      text = await res.text();
    } else {
      text = await FileSystem.readAsStringAsync(uri);
    }
    return parseCsv(text, idPrefix);
  } catch {
    return [];
  }
}

/** 講堂タイムテーブル (`time/Auditorium.csv`) の同梱値。 */
export async function loadAuditoriumBase(): Promise<StageItem[]> {
  return loadCsvAsset(require('../../time/Auditorium.csv'));
}

/** ステージタイムテーブル (`time/Stage.csv`) の同梱値。出演は1団体につき複数行になり得る。 */
export async function loadStageBase(): Promise<StageItem[]> {
  return loadCsvAsset(require('../../time/Stage.csv'), STAGE_ID_PREFIX);
}

/**
 * タイムテーブル (講堂 `time/Auditorium.csv` / ステージ `time/Stage.csv`) の管理者上書き。
 * CSV は同梱アセットで上書き不可のため、追加・編集・削除の差分を kvStore に保存し、
 * 読込時にマージする。ステージのIDは `stage-` 接頭辞で講堂と区別する。
 */
export interface TimetableOverrides {
  added: StageItem[];
  edited: Record<string, Partial<StageItem>>;
  deleted: string[];
}

/** タイムテーブルの会場。 */
export type TimetableVenue = 'auditorium' | 'stage';

const TIMETABLE_OVERRIDES_KEY = 'timetable-overrides.json';

export const EMPTY_TIMETABLE_OVERRIDES: TimetableOverrides = { added: [], edited: {}, deleted: [] };

export async function loadTimetableOverrides(): Promise<TimetableOverrides> {
  const parsed = await loadJSON<unknown>(TIMETABLE_OVERRIDES_KEY, null);
  if (parsed && typeof parsed === 'object') {
    const o = parsed as Partial<TimetableOverrides>;
    return {
      added: Array.isArray(o.added) ? (o.added as StageItem[]) : [],
      edited: o.edited && typeof o.edited === 'object' ? (o.edited as Record<string, Partial<StageItem>>) : {},
      deleted: Array.isArray(o.deleted) ? (o.deleted as string[]) : [],
    };
  }
  return { added: [], edited: {}, deleted: [] };
}

export async function saveTimetableOverrides(overrides: TimetableOverrides): Promise<void> {
  await saveJSON(TIMETABLE_OVERRIDES_KEY, overrides);
}

/** 追加分のIDから会場を判定する (ステージは `stage-` 接頭辞、それ以外は講堂)。 */
export function venueOfId(id: string): TimetableVenue {
  return isStageId(id) ? 'stage' : 'auditorium';
}

/**
 * CSV解析結果に管理者の差分をマージする。
 * `venue` の追加分だけを対象にする (削除・編集はIDが会場ごとに一意なため共通)。
 */
export function mergeTimetable(
  base: StageItem[],
  overrides: TimetableOverrides,
  venue: TimetableVenue = 'auditorium',
): StageItem[] {
  const deleted = new Set(overrides.deleted);
  const merged = base
    .filter((it) => !deleted.has(it.id))
    .map((it) => {
      const patch = overrides.edited[it.id];
      if (!patch) return it;
      return {
        ...it,
        team: typeof patch.team === 'string' && patch.team ? patch.team : it.team,
        day: patch.day === 0 || patch.day === 1 ? patch.day : it.day,
        start: typeof patch.start === 'string' && patch.start ? patch.start : it.start,
        end: typeof patch.end === 'string' && patch.end ? patch.end : it.end,
      };
    });
  const added = overrides.added.filter((it) => !deleted.has(it.id) && venueOfId(it.id) === venue);
  return [...merged, ...added];
}

/** 遅延分数を反映する。 */
function applyDelays(items: StageItem[], delayMap: Record<string, number>): StageItem[] {
  return items.map((it) => ({ ...it, delayMinutes: delayMap[it.id] ?? it.delayMinutes ?? 0 }));
}

export async function loadAuditorium(): Promise<StageItem[]> {
  const delayMap = await loadDelayMap().catch((): Record<string, number> => ({}));
  const [base, overrides] = await Promise.all([
    loadAuditoriumBase(),
    loadTimetableOverrides().catch((): TimetableOverrides => ({ added: [], edited: {}, deleted: [] })),
  ]);
  return applyDelays(mergeTimetable(base, overrides, 'auditorium'), delayMap);
}

/**
 * ステージタイムテーブルを読み込む。講堂と同じ差し替え (上書き・遅延) を適用する。
 * 出演団体の紹介文などのメタ情報は `stage-groups.json` (`stage.ts`) を正とし、
 * 時間割は `time/Stage.csv` を正とする。
 */
export async function loadStage(): Promise<StageItem[]> {
  const delayMap = await loadDelayMap().catch((): Record<string, number> => ({}));
  const [base, overrides] = await Promise.all([
    loadStageBase(),
    loadTimetableOverrides().catch((): TimetableOverrides => ({ added: [], edited: {}, deleted: [] })),
  ]);
  return applyDelays(mergeTimetable(base, overrides, 'stage'), delayMap);
}

/**
 * タイムテーブルの遅延分数 (管理者ページから保存)。
 * キーは StageItem.id (講堂はCSVの行番号、ステージは `stage-<行番号>`)。
 */
const DELAY_KEY = 'delays.json';

export async function loadDelayMap(): Promise<Record<string, number>> {
  const parsed = await loadJSON<Record<string, unknown>>(DELAY_KEY, {});
  if (parsed && typeof parsed === 'object') {
    const out: Record<string, number> = {};
    for (const [k, v] of Object.entries(parsed)) {
      const n = typeof v === 'number' ? v : parseInt(String(v), 10);
      if (Number.isFinite(n) && n >= 0) out[k] = n;
    }
    return out;
  }
  return {};
}

export async function saveDelayMap(map: Record<string, number>): Promise<void> {
  await saveJSON(DELAY_KEY, map);
}

function toMinutesExport(t: string): number {
  const [h, m] = t.split(':').map((v) => parseInt(v, 10));
  return h * 60 + m;
}

/** "HH:MM" を当日0時からの分数に換算する */
export const toMinutes = toMinutesExport;

/** 日付が記念祭のどちらの曜日に当たるかを返す (0=土, 1=日, -1=開催日以外) */
export function timetableDayOfDate(date: Date): number {
  if (date.getDay() === 6) return 0;
  if (date.getDay() === 0) return 1;
  return -1;
}

/** 現在開催中のものを返す。delayMinutes を加味した開始時刻で判定する */
export function findNow(items: StageItem[], now: Date): StageItem | null {
  const day = timetableDayOfDate(now);
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

/**
 * 遅延状態の表示文言。保存値 delayMinutes から描画時に算出する。
 * 0 の場合は「遅れなし」、0 超の場合は「N分遅れ」。
 */
export function delayStatusText(delayMinutes: number): string {
  const n = Number.isFinite(delayMinutes) && delayMinutes > 0 ? Math.floor(delayMinutes) : 0;
  return n > 0 ? `${n}分遅れ` : '遅れなし';
}

/** 講堂演目の時間帯表示。「開始–終了・遅れ状態」の形式で描画時に組み立てる */
export function formatStageTime(item: StageItem): string {
  return `${item.start}–${item.end}・${delayStatusText(item.delayMinutes)}`;
}

/**
 * 管理者による「いま開催中」の手動選択 (自動判定の上書き用)。
 * kvStore の now-override.json に {auditoriumId: string|null} 形式で保存する。
 * null は選択解除=自動判定に戻すことを表す。
 */
export interface NowOverride {
  auditoriumId: string | null;
}

const NOW_OVERRIDE_KEY = 'now-override.json';

export async function loadNowOverride(): Promise<NowOverride> {
  const parsed = await loadJSON<unknown>(NOW_OVERRIDE_KEY, null);
  if (parsed && typeof parsed === 'object') {
    const id = (parsed as { auditoriumId?: unknown }).auditoriumId;
    if (typeof id === 'string' && id) return { auditoriumId: id };
  }
  return { auditoriumId: null };
}

export async function saveNowOverride(override: NowOverride): Promise<void> {
  await saveJSON(NOW_OVERRIDE_KEY, { auditoriumId: override.auditoriumId });
}

/**
 * 自動判定 (findNow、遅延加味) と管理者の手動選択を統合して
 * 「現在」の演目を決める。手動選択が items 内に存在すれば優先し、
 * なければ (未選択・削除済み) 自動判定にフォールバックする。
 */
export function resolveNow(items: StageItem[], now: Date, override: NowOverride | null): StageItem | null {
  const id = override?.auditoriumId;
  if (typeof id === 'string' && id) {
    const hit = items.find((it) => it.id === id);
    if (hit) return hit;
  }
  return findNow(items, now);
}

/**
 * 指定日のタイムライン上に現在時刻の赤線を出すべきかを返す。
 * その曜日当日であり、かつ現在時刻がその日の開催時間帯
 * (遅延加味の最早開始〜最遅終了) の内側にある場合のみ true。
 */
export function isNowLineVisible(day: number, now: Date, itemsOfDay: StageItem[]): boolean {
  if (timetableDayOfDate(now) !== day) return false;
  if (itemsOfDay.length === 0) return false;
  const cur = now.getHours() * 60 + now.getMinutes();
  const starts = itemsOfDay.map((it) => toMinutes(it.start) + it.delayMinutes);
  const ends = itemsOfDay.map((it) => toMinutes(it.end) + it.delayMinutes);
  return Math.min(...starts) <= cur && cur <= Math.max(...ends);
}

/**
 * 赤線の挿入位置を返す (遅延加味の開始時刻が現在時刻以前の件数)。
 * 開始時刻順に並べた行のうち、この件数の直後に赤線を描画する。
 */
export function nowLineIndex(sortedItemsOfDay: StageItem[], now: Date): number {
  const cur = now.getHours() * 60 + now.getMinutes();
  let count = 0;
  for (const it of sortedItemsOfDay) {
    if (toMinutes(it.start) + it.delayMinutes <= cur) count += 1;
    else break;
  }
  return count;
}
