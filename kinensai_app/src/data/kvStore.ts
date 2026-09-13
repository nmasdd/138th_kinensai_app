import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { isPerUserKey } from './publish';
import { fetchSharedJSON } from './remoteConfig';

/**
 * 共有コンテンツと端末個人データの小規模KVS。
 * Webでは localStorage、ネイティブでは documentDirectory 配下のJSONを使う。
 * 既存の *.json 上書きファイル (volunteers.json 等) とキー名を揃えてあるため、
 * ネイティブ側の既存データとも互換する。
 *
 * 共有コンテンツの読込優先度:
 *   1. 端末プレビュー (管理者ページの保存。公開ビルドでも端末内のみ有効で、
 *      他端末・全世界には波及しない)
 *   2. 全世界配信 (`remoteConfig.ts` の contentUrl。運営が公開した値)
 *   3. 同梱の正本 (fallback)
 * お気に入り・投票などの端末個人データは従来通り端末保存する (配信対象外)。
 */
const PREFIX = 'kinensai:';

/** 全世界配信の対象キー (/admin/data の公開バンドル・Workerの許可リストと一致させる)。 */
export const SHARED_CONTENT_KEYS = [
  'class-overrides.json',
  'custom-classes.json',
  'volunteers.json',
  'tickets.json',
  'notifications.json',
  'stage-groups.json',
  'congestion.json',
  'delays.json',
  'timetable-overrides.json',
  'picks.json',
  'now-override.json',
  'map-layout.json',
];

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
}

async function readLocal(name: string): Promise<unknown | undefined> {
  const ws = webStorage();
  if (ws) {
    try {
      const raw = ws.getItem(PREFIX + name);
      if (raw == null) return undefined;
      return JSON.parse(raw) as unknown;
    } catch {
      return undefined;
    }
  }
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return undefined;
    const info = await FileSystem.getInfoAsync(dir + name);
    if (!info.exists) return undefined;
    const raw = await FileSystem.readAsStringAsync(dir + name);
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

async function writeLocal(name: string, value: unknown): Promise<void> {
  const raw = JSON.stringify(value);
  const ws = webStorage();
  if (ws) {
    ws.setItem(PREFIX + name, raw);
    return;
  }
  const dir = FileSystem.documentDirectory;
  if (!dir) return;
  await FileSystem.writeAsStringAsync(dir + name, raw, {
    encoding: FileSystem.EncodingType.UTF8,
  });
}

export async function loadJSON<T>(name: string, fallback: T): Promise<T> {
  // 端末個人データは配信対象外 (端末保存のみ)
  if (isPerUserKey(name)) {
    const local = await readLocal(name);
    return (local ?? fallback) as T;
  }
  // 1. 端末プレビュー (管理者編集)
  const local = await readLocal(name);
  if (local !== undefined) return local as T;
  // 2. 全世界配信
  const remote = await fetchSharedJSON(name);
  if (remote !== null) return remote as T;
  // 3. 同梱の正本
  return fallback;
}

export async function saveJSON(name: string, value: unknown): Promise<void> {
  // 端末への保存 (管理者ページのプレビュー・端末個人データ用)。
  // 全世界への反映は /admin/data の「全世界に公開」 (サーバ経由) で行う。
  await writeLocal(name, value);
}

/** 端末プレビュー (指定キーの端末保存) を破棄する。全世界の配信は変わらない。 */
export async function clearLocalKey(name: string): Promise<void> {
  const ws = webStorage();
  if (ws) {
    try {
      ws.removeItem(PREFIX + name);
    } catch {}
    return;
  }
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return;
    await FileSystem.deleteAsync(dir + name, { idempotent: true });
  } catch {}
}
