import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { isLocalOverrideAllowed, isPerUserKey } from './publish';
import { fetchSharedJSON } from './remoteConfig';

/**
 * 共有コンテンツと端末個人データの小規模KVS。
 * Webでは localStorage、ネイティブでは documentDirectory 配下のJSONを使う。
 * 既存の *.json 上書きファイル (volunteers.json 等) とキー名を揃えてあるため、
 * ネイティブ側の既存データとも互換する。
 *
 * 共有コンテンツの読込優先度 (全世界配信に対応):
 *   1. リモート配信 (`remoteConfig.ts` の contentUrl。運営が公開配置した値)
 *   2. 開発ビルドの端末上書き (管理者ページのプレビュー保存)
 *   3. 同梱の正本 (fallback)
 * 公開ビルドでは 2 を使わず、1 → 3 の順で読む。
 * お気に入り・投票などの端末個人データは従来通り端末保存する。
 */
const PREFIX = 'kinensai:';

function webStorage(): Storage | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window !== 'undefined' && window.localStorage) return window.localStorage;
  } catch {}
  return null;
}

export async function loadJSON<T>(name: string, fallback: T): Promise<T> {
  // 共有コンテンツ: 運営が公開配置したリモート値を最優先で使う (全世界に反映)
  if (!isPerUserKey(name)) {
    const remote = await fetchSharedJSON(name);
    if (remote !== null) return remote as T;
  }
  // 公開ビルド: 共有コンテンツの端末上書きは無視し、同梱の正本 (fallback) を使う
  if (!isLocalOverrideAllowed(name)) return fallback;
  const ws = webStorage();
  if (ws) {
    try {
      const raw = ws.getItem(PREFIX + name);
      if (raw == null) return fallback;
      return JSON.parse(raw) as T;
    } catch {
      return fallback;
    }
  }
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir) return fallback;
    const info = await FileSystem.getInfoAsync(dir + name);
    if (!info.exists) return fallback;
    const raw = await FileSystem.readAsStringAsync(dir + name);
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export async function saveJSON(name: string, value: unknown): Promise<void> {
  // 公開ビルド: 共有コンテンツの端末保存は無効 (全世界に波及させない)
  if (!isLocalOverrideAllowed(name)) return;
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
