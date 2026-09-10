import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';

/**
 * 公開用画像の R2 代替 (KV) アップロード処理。
 * 管理者ページの imageUri は端末ローカル (file://・blob:・content://) や
 * dataURL のため、そのまま全世界配信できない。公開直前に
 * `POST /api/images/upload` へ送り、返った https URL に書き換える。
 * 既に http(s) のものはそのまま使う。
 */

/** 公開画像として許可する形式。 */
const ALLOWED_MIME = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);

/** そのまま配信できるURLか。 */
export function isPublicImageUri(uri: string): boolean {
  return uri.startsWith('https://') || uri.startsWith('http://');
}

function extToMime(uri: string): string {
  const m = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  const ext = (m?.[1] ?? '').toLowerCase();
  if (ext === 'png') return 'image/png';
  if (ext === 'webp') return 'image/webp';
  if (ext === 'gif') return 'image/gif';
  return 'image/jpeg';
}

/** 画像URI → { base64, mime }。読めない場合は null。 */
async function uriToBase64(uri: string): Promise<{ base64: string; mime: string } | null> {
  try {
    if (uri.startsWith('data:')) {
      const m = uri.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!m) return null;
      const mime = (m[1] || 'image/jpeg').toLowerCase();
      if (m[2]) return { base64: m[3], mime };
      // 非base64のdataURLはfetchに回す
    }
    if (Platform.OS === 'web' || uri.startsWith('http://') || uri.startsWith('https://')) {
      const res = await fetch(uri);
      if (!res.ok) return null;
      const blob = await res.blob();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('read failed'));
        reader.readAsDataURL(blob);
      });
      const conv = await uriToBase64(dataUrl);
      if (conv) return conv;
      return { base64: '', mime: blob.type || 'image/jpeg' };
    }
    const base64 = await FileSystem.readAsStringAsync(uri, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return { base64, mime: extToMime(uri) };
  } catch {
    return null;
  }
}

/**
 * 画像1枚をアップロードし、公開URLを返す。
 * 既に http(s) の場合はそのまま返す。失敗時は例外を投げる。
 */
export async function uploadImageUri(
  uri: string,
  token: string,
  apiBase: string,
): Promise<string> {
  if (!uri || isPublicImageUri(uri)) return uri;
  const conv = await uriToBase64(uri);
  if (!conv || !conv.base64) throw new Error(`画像を読み込めませんでした (${uri.slice(0, 32)}…)`);
  if (!ALLOWED_MIME.has(conv.mime)) {
    throw new Error('JPG/PNG/WebP/GIF 形式の画像で登録してください (HEIC等は非対応)');
  }
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 60000);
  try {
    const res = await fetch(`${apiBase}/api/images/upload`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ token, contentType: conv.mime, data: conv.base64 }),
      signal: ctrl.signal,
    });
    let parsed: { ok?: unknown; url?: unknown } | null = null;
    try {
      parsed = (await res.json()) as { ok?: unknown; url?: unknown };
    } catch {}
    if (!res.ok || parsed?.ok !== true || typeof parsed.url !== 'string' || !parsed.url) {
      if (res.status === 413) throw new Error('画像が大きすぎます (5MB以下にしてください)');
      if (res.status === 401) throw new Error('認証が切れています。再認証してください');
      throw new Error('画像のアップロードに失敗しました');
    }
    return parsed.url;
  } finally {
    clearTimeout(timer);
  }
}

export interface RewriteResult {
  uploaded: number;
  failed: number;
}

/**
 * 公開エントリ群を複製し、中の imageUri (http(s)以外) を公開URLに書き換える。
 * 変換に失敗した画像は除外 (null) する。残すと公開全体がサイズ上限で
 * 失敗するため。件数を返す (公開自体は継続する)。
 */
export async function rewriteImagesForPublish(
  entries: Array<[string, unknown]>,
  token: string,
  apiBase: string,
): Promise<{ entries: Array<[string, unknown]>; result: RewriteResult }> {
  const cloned = JSON.parse(JSON.stringify(entries)) as Array<[string, unknown]>;
  const targets: Array<{ holder: Record<string, unknown>; key: string }> = [];
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit);
      return;
    }
    if (node && typeof node === 'object') {
      const rec = node as Record<string, unknown>;
      for (const [k, v] of Object.entries(rec)) {
        if (k === 'imageUri' && typeof v === 'string' && v && !isPublicImageUri(v)) {
          targets.push({ holder: rec, key: k });
        } else {
          visit(v);
        }
      }
    }
  };
  cloned.forEach(([, value]) => visit(value));

  let uploaded = 0;
  let failed = 0;
  for (const t of targets) {
    try {
      t.holder[t.key] = await uploadImageUri(String(t.holder[t.key]), token, apiBase);
      uploaded += 1;
    } catch {
      // 読込不可・形式非対応・サイズ超過は除外 (端末の元データは消えない。後で直して再公開できる)
      t.holder[t.key] = null;
      failed += 1;
    }
  }
  return { entries: cloned, result: { uploaded, failed } };
}
