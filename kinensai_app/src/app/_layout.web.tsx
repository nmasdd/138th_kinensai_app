import { Stack } from 'expo-router/js-stack';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useReducedMotion } from 'react-native-reanimated';
import { ResponsiveProvider } from '../context/responsive';
import { useContentAutoRefresh } from '../context/useContentAutoRefresh';
import { InstallPrompt } from '../components/InstallPrompt';
import { registerServiceWorker } from '../utils/serviceWorker';

/**
 * Web 用ルートレイアウト。
 * ネイティブスタックは Web で遷移アニメーションを持たないため、
 * Web では JS スタック (`expo-router/js-stack`) を使い、右からのスライドで
 * 空間的な連続性を示す (HIG)。「視差効果を減らす」設定時はアニメーションしない。
 * useContentAutoRefresh で公開コンテンツの版数を監視し (起動時・復帰時・15秒毎)、
 * 更新があれば各画面へ通知して30秒以内に反映する。
 * 本番ビルドでは PWA 用の Service Worker を登録する (ホーム画面追加・オフライン起動)。
 * InstallPrompt がインストール可能なら下部バナーを表示する (Web のみ)。
 */
export default function RootLayout() {
  const reduced = useReducedMotion();
  useContentAutoRefresh();
  useEffect(() => {
    if (!__DEV__) registerServiceWorker();
  }, []);
  return (
    <ResponsiveProvider>
      <View style={styles.root}>
        <Stack
          screenOptions={{
            headerShown: false,
            animation: reduced ? 'none' : 'slide_from_right',
            gestureEnabled: false,
          }}
        >
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="notifications" />
          <Stack.Screen name="notifications/[id]" />
          <Stack.Screen name="menu" options={{ animation: reduced ? 'none' : 'slide_from_left' }} />
          <Stack.Screen name="vote" />
          <Stack.Screen name="pamphlet" />
          {/* 管理者用 (/admin 直接アクセス専用。タブ・メニューに入口なし) */}
          <Stack.Screen name="admin/index" />
          <Stack.Screen name="admin/class" />
          <Stack.Screen name="admin/volunteer" />
          <Stack.Screen name="admin/notifications" />
          <Stack.Screen name="admin/stage" />
          <Stack.Screen name="admin/picks" />
          <Stack.Screen name="admin/votes" />
          <Stack.Screen name="admin/data" />
        </Stack>
        {/* PWA インストールを促す下部バナー (全画面の上に重ねる) */}
        <InstallPrompt />
      </View>
    </ResponsiveProvider>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
