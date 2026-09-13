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
}

export const CLASS_CATALOG = catalog as CatalogEntry[];

export function loadAllClassContent(): Record<string, ClassContent> {
  const result: Record<string, ClassContent> = {};
  for (const c of CLASS_CATALOG) {
    result[c.id] = { title: (c.title ?? '').trim(), detail: (c.detail ?? '').trim() };
  }
  return result;
}
