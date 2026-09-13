/**
 * 共有コンテンツの軽量バリデータ。
 * 同梱正本 (`src/data/bundled/*.json`) と公開前データの構造を検査し、
 * 壊れた値を全世界へ配信して端末側で無言フォールバックされる事故を防ぐ。
 *
 * 返り値の `errors` は「公開すると問題になる箇所」、`warnings` は
 * 「表示はできるが確認推奨」の箇所。`/admin/data` の公開前に表示する。
 */

export type Severity = 'error' | 'warning';

export interface ValidationIssue {
  key: string;
  severity: Severity;
  /** 例: "volunteers.json[3].id" */
  path: string;
  message: string;
}

export interface ValidationResult {
  errors: ValidationIssue[];
  warnings: ValidationIssue[];
}

const TIME_RE = /^\d{1,2}:\d{2}$/;

function isObject(v: unknown): v is Record<string, unknown> {
  return !!v && typeof v === 'object' && !Array.isArray(v);
}

function checkIdList(
  key: string,
  list: unknown,
  issues: { errors: ValidationIssue[]; warnings: ValidationIssue[] },
  nameKeys: string[] = ['name', 'className', 'projectName'],
) {
  if (!Array.isArray(list)) {
    issues.errors.push({ key, severity: 'error', path: key, message: '配列ではありません' });
    return;
  }
  const seen = new Set<string>();
  list.forEach((item, i) => {
    const at = `${key}[${i}]`;
    if (!isObject(item)) {
      issues.errors.push({ key, severity: 'error', path: at, message: 'オブジェクトではありません' });
      return;
    }
    const id = item.id;
    if (typeof id !== 'string' || !id.trim()) {
      issues.errors.push({ key, severity: 'error', path: `${at}.id`, message: 'id がありません' });
    } else if (seen.has(id)) {
      issues.errors.push({ key, severity: 'error', path: `${at}.id`, message: `id が重複しています (${id})` });
    } else {
      seen.add(id);
    }
    const name = nameKeys.map((k) => item[k]).find((v) => typeof v === 'string' && v.trim());
    if (name === undefined) {
      issues.warnings.push({ key, severity: 'warning', path: `${at}.name`, message: '名称が空です' });
    }
  });
}

function checkImageUris(
  key: string,
  list: unknown,
  issues: { errors: ValidationIssue[]; warnings: ValidationIssue[] },
) {
  if (!Array.isArray(list)) return;
  list.forEach((item, i) => {
    if (!isObject(item)) return;
    const uri = item.imageUri;
    if (uri == null) return;
    if (typeof uri !== 'string' || !uri.trim()) {
      issues.warnings.push({ key, severity: 'warning', path: `${key}[${i}].imageUri`, message: '画像URIが空です' });
      return;
    }
    const okScheme =
      uri.startsWith('http://') ||
      uri.startsWith('https://') ||
      uri.startsWith('data:') ||
      uri.startsWith('file:') ||
      uri.startsWith('blob:') ||
      uri.startsWith('content:');
    if (!okScheme) {
      issues.warnings.push({
        key,
        severity: 'warning',
        path: `${key}[${i}].imageUri`,
        message: '未知の画像URI形式です (公開時に除外されます)',
      });
    }
  });
}

/** volunteers.json / stage-groups.json / auditorium-groups.json の共通検査 */
function checkGroups(key: string, value: unknown): ValidationResult {
  const issues = { errors: [] as ValidationIssue[], warnings: [] as ValidationIssue[] };
  checkIdList(key, value, issues);
  checkImageUris(key, value, issues);
  return issues;
}

/** 講堂タイムテーブル上書き (timetable-overrides.json) の検査 */
function checkTimetableOverrides(key: string, value: unknown): ValidationResult {
  const issues = { errors: [] as ValidationIssue[], warnings: [] as ValidationIssue[] };
  if (!isObject(value)) {
    issues.errors.push({ key, severity: 'error', path: key, message: 'オブジェクトではありません' });
    return issues;
  }
  const added = value.added;
  if (!Array.isArray(added)) {
    issues.errors.push({ key, severity: 'error', path: `${key}.added`, message: 'added が配列ではありません' });
  } else {
    added.forEach((item, i) => {
      if (!isObject(item)) return;
      const at = `${key}.added[${i}]`;
      if (item.day !== 0 && item.day !== 1) {
        issues.errors.push({ key, severity: 'error', path: `${at}.day`, message: 'day は 0(土)/1(日) のみ' });
      }
      for (const f of ['start', 'end'] as const) {
        if (typeof item[f] !== 'string' || !TIME_RE.test(item[f] as string)) {
          issues.errors.push({ key, severity: 'error', path: `${at}.${f}`, message: 'HH:MM 形式ではありません' });
        }
      }
    });
  }
  return issues;
}

/** 端末キーごとの検査。未知キーは検査せず素通り (警告なし)。 */
export function validateContent(key: string, value: unknown): ValidationResult {
  switch (key) {
    case 'volunteers.json':
    case 'stage-groups.json':
    case 'auditorium-groups.json':
    case 'custom-classes.json':
      return checkGroups(key, value);
    case 'timetable-overrides.json':
      return checkTimetableOverrides(key, value);
    case 'notifications.json': {
      const issues = { errors: [] as ValidationIssue[], warnings: [] as ValidationIssue[] };
      checkIdList(key, value, issues, ['title']);
      return issues;
    }
    default:
      // 構造を検査しないキー (tickets/picks/now-override/delays/map-layout 等) は
      // 空でも正常 (未設定=既定動作) のため警告を出さない。
      return { errors: [], warnings: [] };
  }
}

/** 公開エントリ群をまとめて検査し、エラー/警告件数を返す。 */
export function validatePublishEntries(entries: Array<[string, unknown]>): {
  issues: ValidationIssue[];
  errorCount: number;
  warningCount: number;
} {
  const issues: ValidationIssue[] = [];
  for (const [key, value] of entries) {
    const r = validateContent(key, value);
    issues.push(...r.errors, ...r.warnings);
  }
  return {
    issues,
    errorCount: issues.filter((i) => i.severity === 'error').length,
    warningCount: issues.filter((i) => i.severity === 'warning').length,
  };
}
