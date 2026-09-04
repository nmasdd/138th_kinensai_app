import { loadAllClassContent } from './classContent';
import { loadTicketMap } from './tickets';
import { loadVolunteers } from './volunteers';

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
}

const CLASS_NAMES = ['1A', '1B', '1C'] as const;

/**
 * planning/{組}/title.txt, detail.txt から企画一覧を作る。
 * 組を増やすときは CLASS_NAMES と classContent.ts の asset map に追加する。
 * 整理券情報は tickets.json があれば結合される。
 */
export async function loadExhibitions(): Promise<Exhibition[]> {
  const [content, ticketMap] = await Promise.all([loadAllClassContent(), loadTicketMap()]);
  return CLASS_NAMES.map((className) => {
    const ticket = ticketMap[className];
    return {
      id: className,
      className,
      projectName: content[className]?.title ?? '',
      description: content[className]?.detail ?? '',
      ticketRequired: ticket?.required ?? 'unknown',
      ticketTime: ticket?.time ?? null,
      kind: 'class' as const,
      place: null,
    };
  });
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
