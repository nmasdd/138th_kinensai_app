import * as FileSystem from 'expo-file-system/legacy';

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  date: string;
}

const bundled: AppNotification[] = [
  {
    id: 'welcome',
    title: '138th記念祭アプリへようこそ',
    body: '実行委員会からのお知らせはここに届きます。詳細データの配信開始までお待ちください。',
    date: '2026-09-04',
  },
];

const FILE = `${FileSystem.documentDirectory}notifications.json`;

/**
 * 実行委員会からの通知。配信手段が決まるまでは同梱の既定文を表示し、
 * notifications.json を端末に置けば差し替えられる。
 */
export async function loadNotifications(): Promise<AppNotification[]> {
  if (!FileSystem.documentDirectory) return bundled;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (info.exists) {
      const raw = await FileSystem.readAsStringAsync(FILE);
      const parsed: unknown = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed as AppNotification[];
    }
  } catch {}
  return bundled;
}
