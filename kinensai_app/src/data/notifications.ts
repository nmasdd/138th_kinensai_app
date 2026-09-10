import { loadJSON, saveJSON } from './kvStore';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  date: string;
  /** 管理者ページで登録した画像 (file:// URI または dataURL)。なければ null */
  imageUri?: string | null;
}

const bundled: AppNotification[] = [
  {
    id: 'welcome',
    title: '138th記念祭アプリへようこそ',
    body: '実行委員会からのお知らせはここに届きます。詳細データの配信開始までお待ちください。',
    date: '2026-09-04',
  },
];

const KEY = 'notifications.json';

/**
 * 実行委員会からの通知。管理者ページから保存・差し替えできる。
 */
export async function loadNotifications(): Promise<AppNotification[]> {
  const parsed = await loadJSON<unknown>(KEY, null);
  if (Array.isArray(parsed)) return parsed as AppNotification[];
  return bundled;
}

export async function saveNotifications(list: AppNotification[]): Promise<void> {
  await saveJSON(KEY, list);
}
