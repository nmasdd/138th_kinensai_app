import { CLASS_CATALOG, loadAllClassContent } from './classContent';
import { loadTicketMap } from './tickets';
import { loadVolunteers } from './volunteers';
import { loadJSON, saveJSON } from './kvStore';

export interface Exhibition {
  id: string;
  className: string;
  projectName: string;
  description: string;
  /** 整理券が必要か。不明な企画は 'unknown' のまま「確認中」と表示する */
  ticketRequired: 'unknown' | 'none' | 'required';
  /** 整理券が必要な場合の配布時間 (未定なら null) */
  ticketTime: string | null;
  /** クラス企画 / 教室有志企画の種別 */
  kind: 'class' | 'volunteer';
  place: string | null;
  /** 大分類ジャンル (クラス企画: 演劇 / テーマツアー / パフォーマンス)。なければ null */
  genre?: string | null;
  /** 細分ジャンル (クラス企画: 謎解き・脱出、パロディ 等) */
  subGenres?: string[];
  /** 有志企画のジャンル区分 (展示 / 実演発表 / 体験企画 / 販売・配布 / 研究発表 / クラブ) */
  genres?: string[];
  /** 模擬店として検索の「模擬店」絞り込みに出すか (未指定は従来の正規表現判定) */
  mogiten?: boolean;
  /** 管理者ページで登録した画像 (file:// URI または dataURL)。なければ null */
  imageUri?: string | null;
}

/**
 * 企画のジャンル表示文字列を組み立てる。
 * クラス企画は「大分類／細分、細分」、有志企画は「区分、区分」の形式。
 * どちらも無ければ null。
 */
export function genreLabel(ex: Exhibition): string | null {
  const classParts: string[] = [];
  if (ex.genre) classParts.push(ex.genre);
  if (ex.subGenres && ex.subGenres.length > 0) classParts.push(ex.subGenres.join('、'));
  const classLabel = classParts.join('／');
  const volunteerLabel = ex.genres && ex.genres.length > 0 ? ex.genres.join('、') : '';
  return classLabel || volunteerLabel || null;
}

/**
 * ジャンル絞り込みの対象値か (大分類・細分・有志区分のいずれかに一致)。
 * `genre` が 'all' のときは常に true。
 */
export function matchesGenre(ex: Exhibition, genre: string): boolean {
  if (genre === 'all') return true;
  if (ex.genre === genre) return true;
  if (ex.subGenres?.includes(genre)) return true;
  if (ex.genres?.includes(genre)) return true;
  return false;
}

/**
 * 講堂・ステージ (野外ステージ) を会場とする企画か。
 * これらはタイムテーブル (`time/Auditorium.csv` / `time/Stage.csv`) 側で扱うため
 * 検索一覧から除外する。中庭など他会場を併記する企画は除外しない
 * (例: オーケストラ部「講堂、ステージ、中庭」)。
 */
export function isStageOrAuditoriumProgram(ex: Exhibition): boolean {
  const place = ex.place ?? '';
  if (!/講堂|ステージ/.test(place)) return false;
  return !/中庭/.test(place);
}

const CATALOG = CLASS_CATALOG;

/**
 * 表示用のクラス名。高校教室 (1A〜3J) は「高校」を付ける。
 * 中学は同梱カタログの className が「中学3A」のためそのまま表示する。
 */
export function displayClassName(className: string): string {
  const name = className.trim();
  // 全角 (２D 等) も高校教室として扱うため NFKC 正規化して判定する
  const half = name.normalize('NFKC');
  return /^[123][A-J]$/.test(half) ? `高校${name}` : className;
}

/** クラス企画の管理者上書き (タイトル・説明・場所・画像)。同梱カタログより優先される */
export interface ClassOverride {
  title?: string;
  detail?: string;
  place?: string | null;
  imageUri?: string | null;
}

const CLASS_OVERRIDE_KEY = 'class-overrides.json';
const CUSTOM_CLASSES_KEY = 'custom-classes.json';

export async function loadClassOverrides(): Promise<Record<string, ClassOverride>> {
  const parsed = await loadJSON<unknown>(CLASS_OVERRIDE_KEY, {});
  if (parsed && typeof parsed === 'object') return parsed as Record<string, ClassOverride>;
  return {};
}

export async function saveClassOverrides(map: Record<string, ClassOverride>): Promise<void> {
  await saveJSON(CLASS_OVERRIDE_KEY, map);
}

/**
 * 管理者ページで追加したカスタムのクラス企画 (同梱カタログにない分)。
 * kind は必ず 'class' として保存する。
 */
export async function loadCustomClasses(): Promise<Exhibition[]> {
  const parsed = await loadJSON<unknown>(CUSTOM_CLASSES_KEY, []);
  if (Array.isArray(parsed)) {
    return (parsed as Exhibition[]).filter((e) => e && typeof e.id === 'string');
  }
  return [];
}

export async function saveCustomClasses(list: Exhibition[]): Promise<void> {
  await saveJSON(CUSTOM_CLASSES_KEY, list);
}

/** 全角英数字を半角化し、クラス企画IDに使えるASCIIだけを残す */
function normalizeClassIdBase(className: string): string {
  const half = className.normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '');
  const ascii = half.replace(/[^0-9A-Z-]/g, '');
  return ascii;
}

/**
 * className から新規クラス企画の id を自動採番する。
 * 衝突時は `-2`, `-3` … を付けて回避する。
 */
export function suggestClassId(className: string, existingIds: string[]): string {
  const base = normalizeClassIdBase(className) || `CLASS-${Date.now()}`;
  if (!existingIds.includes(base)) return base;
  let n = 2;
  while (existingIds.includes(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/**
 * クラス企画の同梱正本 (`bundled/class-catalog.json`) を基に企画一覧を作る。
 * 管理者の上書き・カスタム追加・整理券情報は結合される。
 */
export async function loadExhibitions(): Promise<Exhibition[]> {
  const [ticketMap, overrides, custom] = await Promise.all([
    loadTicketMap(),
    loadClassOverrides(),
    loadCustomClasses(),
  ]);
  const content = loadAllClassContent();
  const classes: Exhibition[] = CATALOG.filter((c) => c.kind === 'class').map((c) => {
    const ticket = ticketMap[c.id];
    const ov = overrides[c.id];
    const fallback = content[c.id] ?? content[c.className];
    return {
      id: c.id,
      className: c.className,
      projectName: ov?.title ?? (c.title || fallback?.title || ''),
      description: ov?.detail ?? (c.detail || fallback?.detail || ''),
      ticketRequired: ticket?.required ?? 'unknown',
      ticketTime: ticket?.time ?? null,
      kind: 'class' as const,
      place: ov?.place ?? c.place ?? null,
      genre: c.genre ?? null,
      subGenres: c.subGenres ?? [],
      imageUri: ov?.imageUri ?? null,
      mogiten: c.mogiten === true,
    };
  });
  const customs: Exhibition[] = custom.map((e) => {
    const ticket = ticketMap[e.id];
    const ov = overrides[e.id];
    return {
      ...e,
      kind: 'class' as const,
      projectName: ov?.title ?? e.projectName,
      description: ov?.detail ?? e.description,
      place: ov?.place ?? e.place ?? null,
      genre: e.genre ?? null,
      subGenres: e.subGenres ?? [],
      ticketRequired: ticket?.required ?? e.ticketRequired ?? 'unknown',
      ticketTime: ticket?.time ?? e.ticketTime ?? null,
      imageUri: ov?.imageUri ?? e.imageUri ?? null,
    };
  });
  return [...classes, ...customs];
}

/** クラス企画 + 教室有志企画の全件。検索・マップ・ホームの共通ソース */
export async function loadAllExhibitions(): Promise<Exhibition[]> {
  const [classes, volunteers, ticketMap] = await Promise.all([
    loadExhibitions(),
    loadVolunteers(),
    loadTicketMap(),
  ]);
  const withTickets = volunteers.map((v) => {
    const ticket = ticketMap[v.id];
    if (!ticket) return v;
    return { ...v, ticketRequired: ticket.required, ticketTime: ticket.time };
  });
  return [...classes, ...withTickets];
}
