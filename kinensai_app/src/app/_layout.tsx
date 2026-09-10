import { Stack } from 'expo-router';

/**
 * ルートは Stack。タブは (tabs) グループ、通知・詳細・メニュー・投票・
 * パンフレットはスライド遷移のスタック画面 (メニューは左から)。
 */
export default function RootLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="notifications/[id]" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen
        name="menu"
        options={{ animation: 'slide_from_left' }}
      />
      <Stack.Screen name="vote" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="pamphlet" options={{ animation: 'slide_from_right' }} />
      {/* 管理者用 (/admin 直接アクセス専用。タブ・メニューに入口なし) */}
      <Stack.Screen name="admin/index" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/class" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/volunteer" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/notifications" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/stage" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/picks" options={{ animation: 'slide_from_right' }} />
      <Stack.Screen name="admin/data" options={{ animation: 'slide_from_right' }} />
    </Stack>
  );
}
