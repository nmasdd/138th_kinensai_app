import { loadAllClassContent } from './classContent';
import { loadTicketMap } from './tickets';
import { loadVolunteers } from './volunteers';
import { loadJSON, saveJSON } from './kvStore';
import catalog from './classCatalog.json';

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
  /** 管理者ページで登録した画像 (file:// URI または dataURL)。なければ null */
  imageUri?: string | null;
}

interface CatalogEntry {
  id: string;
  className: string;
  title: string;
  detail: string;
  place: string | null;
  kind: string;
}

const CATALOG = catalog as CatalogEntry[];

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
 * classCatalog.json を正本として企画一覧を作る。
 * planning txt はフォールバック (カタログの title/detail が空のときのみ使う)。
 * 管理者の上書き・カスタム追加・整理券情報は結合される。
 */
export async function loadExhibitions(): Promise<Exhibition[]> {
  const [content, ticketMap, overrides, custom] = await Promise.all([
    loadAllClassContent().catch(() => ({}) as Record<string, { title: string; detail: string }>),
    loadTicketMap(),
    loadClassOverrides(),
    loadCustomClasses(),
  ]);
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
      imageUri: ov?.imageUri ?? null,
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
