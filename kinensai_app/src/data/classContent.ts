import catalog from './bundled/class-catalog.json';

/**
 * クラス企画の同梱正本。`bundled/class-catalog.json` を唯一の正本とし、
 * 以前の `planning/{組}/title.txt, detail.txt` の読込は廃止した
 * (テスト文言が混在し、正本が二重化していたため)。
 * 組の追加はこの JSON にエントリを足すだけでよい。
 */
export interface ClassContent {
  title: string;
  detail: string;
}

interface CatalogEntry {
  id: string;
  className: string;
  title: string;
  detail: string;
  place: string | null;
  kind: string;
  /** 大分類ジャンル (演劇 / テーマツアー / パフォーマンス)。模擬店は未設定 */
  genre?: string;
  /** 細分ジャンル (謎解き・脱出、パロディ 等) */
  subGenres?: string[];
  /** 模擬店として検索の「模擬店」絞り込みに出すか (未指定は従来の正規表現判定) */
  mogiten?: boolean;
}

export const CLASS_CATALOG = catalog as CatalogEntry[];

export function loadAllClassContent(): Record<string, ClassContent> {
  const result: Record<string, ClassContent> = {};
  for (const c of CLASS_CATALOG) {
    result[c.id] = { title: (c.title ?? '').trim(), detail: (c.detail ?? '').trim() };
  }
  return result;
}
