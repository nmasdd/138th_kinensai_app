/**
 * マップ上の特定の部屋に表示する案内文 (部屋ID→説明)。
 *
 * 配置の管理者上書き (`mapLayout.json`) とは独立した同梱データとして持つ。
 * 上書き側に説明文を保存しなくても、ID が一致すれば常に案内を表示できる。
 *
 * 対象は「整理券配布」を行っている教室 (家庭科室 / 202補助教室 / 301補助教室)。
 * 配布教室は、整理券を使うクラスのうち各階にあるものを示す。
 * 出典: HP/contact.html「整理券の配布はありますか？」(1階分=家庭科室、2階分=202教室、3階分=301教室)。
 */
import { bundledTickets } from './tickets';
import { MAP_HOTSPOTS, type MapFloor } from './mapHotspots';

/** その階にあり、かつ整理券を使うクラスのID一覧 (mapHotspots の表示順)。 */
function ticketClassesOnFloor(floor: MapFloor): string[] {
  return MAP_HOTSPOTS.filter(
    (h) => h.floor === floor && bundledTickets[h.id]?.required === 'required',
  ).map((h) => h.id);
}

function noteForTicketRoom(floor: MapFloor): string {
  const classes = ticketClassesOnFloor(floor);
  return `${floor}教室の整理券配布を行っています。配布教室: ${classes.join('・')}。配布タイミングはクラスにより異なります。`;
}

export const MAP_ROOM_NOTES: Record<string, string> = {
  'sys-h1kt': noteForTicketRoom('1階'), // 家庭科室 (1階分)
  'sys-h2202': noteForTicketRoom('2階'), // 202補助教室 (2階分)
  'sys-h3301': noteForTicketRoom('3階'), // 301補助教室 (3階分)
};

/** 整理券を配布する部屋 (階 → 部屋名)。出典: HP/contact.html。 */
const TICKET_ROOM_BY_FLOOR: Partial<Record<MapFloor, string>> = {
  '1階': '家庭科室',
  '2階': '202補助教室',
  '3階': '301補助教室',
};

/**
 * 企画IDから整理券の配布教室名を求める。
 * 企画の在籍階 (mapHotspots) に対応する配布教室を返す。該当なしは null。
 */
export function ticketDistributionRoom(exhibitionId: string): string | null {
  const floor = MAP_HOTSPOTS.find((h) => h.id === exhibitionId)?.floor;
  return floor ? TICKET_ROOM_BY_FLOOR[floor] ?? null : null;
}

/** 部屋IDに対応する案内文。なければ null。 */
export function roomNoteForId(id: string | null | undefined): string | null {
  return id ? MAP_ROOM_NOTES[id] ?? null : null;
}
