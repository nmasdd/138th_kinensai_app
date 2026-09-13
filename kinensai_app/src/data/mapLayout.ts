import { loadJSON, saveJSON } from './kvStore';
import { VECTOR_FLOORS, VECTOR_ROOMS, type VectorFloor, type VectorRoom } from './vectorMap';

/**
 * 校内マップの部屋配置の管理者上書き。
 * 同梱の `vectorMap.ts` は上書き不可のため、フロアごとの部屋配列を
 * `map-layout.json` に保存し、読込時にその階だけ差し替える。
 * 保存されていない階は同梱値を使う。
 */

const KEY = 'map-layout.json';

export type MapLayoutOverrides = Partial<Record<VectorFloor, VectorRoom[]>>;

const KINDS: VectorRoom['kind'][] = [
  'class',
  'club',
  'corridor',
  'stairs',
  'elevator',
  'vending',
  'toilet',
  'outdoor',
  'hall',
];

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
    w: Math.max(8, num(r.w, 60)),
    h: Math.max(8, num(r.h, 60)),
    kind,
  };
}

/** 保存済みの配置上書きを読む。未設定・破損時は空。 */
export async function loadMapLayout(): Promise<MapLayoutOverrides> {
  const parsed = await loadJSON<unknown>(KEY, null);
  if (!parsed || typeof parsed !== 'object') return {};
  const out: MapLayoutOverrides = {};
  for (const floor of VECTOR_FLOORS) {
    const arr = (parsed as Record<string, unknown>)[floor];
    if (Array.isArray(arr)) {
      out[floor] = arr.map(sanitizeRoom).filter((r): r is VectorRoom => r !== null);
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
  return overrides[floor] ?? VECTOR_ROOMS[floor] ?? [];
}
