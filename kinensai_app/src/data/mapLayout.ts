import { loadJSON, saveJSON } from './kvStore';
import {
  VECTOR_ANNOTATIONS,
  VECTOR_FLOORS,
  VECTOR_ROOMS,
  type VectorAnnotation,
  type VectorFloor,
  type VectorRoom,
} from './vectorMap';

/**
 * 校内マップの表示の管理者上書き。
 * 同梱の `vectorMap.ts` は上書き不可のため、フロアごとの部屋配列
 * (`rooms`) と注記配列 (`annotations`) を `map-layout.json` に保存し、
 * 読込時にその階だけ差し替える。保存されていない階・項目は同梱値を使う。
 *
 * 旧形式 (フロア直下が部屋配列) も読込時に `{ rooms }` へ移行する。
 */

const KEY = 'map-layout.json';

/** 1フロア分の上書き。未指定の項目は同梱値を用いる。 */
export interface VectorFloorLayout {
  rooms?: VectorRoom[];
  annotations?: VectorAnnotation[];
}

export type MapLayoutOverrides = Partial<Record<VectorFloor, VectorFloorLayout>>;

const KINDS: VectorRoom['kind'][] = [
  'class',
  'jclass',
  'club',
  'corridor',
  'stairs',
  'elevator',
  'vending',
  'toilet',
  'outdoor',
  'hall',
];

const ANN_KINDS: VectorAnnotation['kind'][] = ['badge', 'label', 'note'];

function num(v: unknown, fallback: number): number {
  return typeof v === 'number' && Number.isFinite(v) ? v : fallback;
}

function sanitizeRoom(v: unknown): VectorRoom | null {
  if (!v || typeof v !== 'object') return null;
  const r = v as Record<string, unknown>;
  if (typeof r.id !== 'string' || !r.id) return null;
  const kind = typeof r.kind === 'string' && (KINDS as string[]).includes(r.kind)
    ? (r.kind as VectorRoom['kind'])
    : 'hall';
  return {
    id: r.id,
    label: typeof r.label === 'string' ? r.label : '',
    name: typeof r.name === 'string' && r.name ? r.name : r.id,
    x: num(r.x, 0),
    y: num(r.y, 0),
    w: num(r.w, 60),
    h: num(r.h, 60),
    kind,
  };
}

function sanitizeAnnotation(v: unknown): VectorAnnotation | null {
  if (!v || typeof v !== 'object') return null;
  const a = v as Record<string, unknown>;
  if (typeof a.text !== 'string' || !a.text) return null;
  const kind = typeof a.kind === 'string' && (ANN_KINDS as string[]).includes(a.kind)
    ? (a.kind as VectorAnnotation['kind'])
    : 'label';
  const tone = a.tone === 'danger' ? ('danger' as const) : undefined;
  return { kind, text: a.text, x: num(a.x, 0), y: num(a.y, 0), ...(tone ? { tone } : {}) };
}

function sanitizeList<T>(v: unknown, fn: (item: unknown) => T | null): T[] | undefined {
  if (!Array.isArray(v)) return undefined;
  return v.map(fn).filter((item): item is T => item !== null);
}

/** 保存済みの配置上書きを読む。未設定・破損時は空。 */
export async function loadMapLayout(): Promise<MapLayoutOverrides> {
  const parsed = await loadJSON<unknown>(KEY, null);
  if (!parsed || typeof parsed !== 'object') return {};
  const out: MapLayoutOverrides = {};
  for (const floor of VECTOR_FLOORS) {
    const entry = (parsed as Record<string, unknown>)[floor];
    if (Array.isArray(entry)) {
      // 旧形式: フロア直下が部屋配列
      const rooms = sanitizeList(entry, sanitizeRoom);
      if (rooms) out[floor] = { rooms };
    } else if (entry && typeof entry === 'object') {
      const e = entry as Record<string, unknown>;
      const layout: VectorFloorLayout = {};
      const rooms = sanitizeList(e.rooms, sanitizeRoom);
      const annotations = sanitizeList(e.annotations, sanitizeAnnotation);
      if (rooms) layout.rooms = rooms;
      if (annotations) layout.annotations = annotations;
      out[floor] = layout;
    }
  }
  return out;
}

/** 配置上書きを保存する。空オブジェクトで全階を同梱値に戻す。 */
export async function saveMapLayout(layout: MapLayoutOverrides): Promise<void> {
  await saveJSON(KEY, layout);
}

/** 指定階の有効な部屋配列 (上書き優先、なければ同梱値) を返す。 */
export function roomsForFloor(
  floor: VectorFloor,
  overrides: MapLayoutOverrides,
): VectorRoom[] {
  return overrides[floor]?.rooms ?? VECTOR_ROOMS[floor] ?? [];
}

/** 指定階の有効な注記配列 (上書き優先、なければ同梱値) を返す。 */
export function annotationsForFloor(
  floor: VectorFloor,
  overrides: MapLayoutOverrides,
): VectorAnnotation[] {
  return overrides[floor]?.annotations ?? VECTOR_ANNOTATIONS[floor] ?? [];
}
