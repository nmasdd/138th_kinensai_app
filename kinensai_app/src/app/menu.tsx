import React from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3FAB, M3ListItem, TopAppBar, goBackOrHome, type IconName } from '../components/m3';
import { Stagger } from '../components/anim';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';
import { openInstallFromMenu, useIsStandalone } from '../utils/installPrompt';
import type { ListPosition } from '../components/m3';

interface Entry {
  title: string;
  sub: string;
  icon: IconName;
  href?: string | { pathname: string; params?: Record<string, string> };
  onPress?: () => void;
  /** Web のみ表示する (PWA インストール等)。 */
  webOnly?: boolean;
  /** インストール済み (standalone 起動) のときは隠す。 */
  hideWhenInstalled?: boolean;
}

const ENTRIES: Entry[] = [
  { title: 'ホーム', sub: 'アプリホームへ戻る', icon: 'home', href: '/' },
  { title: 'タイムテーブル', sub: '講堂 ステージ', icon: 'calendar-month', href: '/timetable' },
  { title: 'カメラ', sub: 'QRコード読み取り', icon: 'qr-code-2', href: '/camera' },
  { title: '検索', sub: 'クラス企画 有志企画', icon: 'search', href: '/search' },
  { title: '校内マップ', sub: '教室 校舎', icon: 'map', href: '/map' },
  { title: '模擬店', sub: '一覧', icon: 'store', href: { pathname: '/search', params: { filter: 'mogiten' } } },
  { title: 'オーディエンス投票', sub: 'ステージ人気投票', icon: 'how-to-vote', href: '/vote' },
  { title: 'パンフレット', sub: 'デジタルパンフレットを閲覧', icon: 'menu-book', href: '/pamphlet' },
  { title: '通知', sub: '記念祭実行委員からのお知らせ', icon: 'notifications', href: '/notifications' },
  {
    title: 'アプリをインストール',
    sub: 'ホーム画面に追加してすぐ起動',
    icon: 'install-mobile',
    webOnly: true,
    hideWhenInstalled: true,
    onPress: () => void openInstallFromMenu(),
  },
];

export default function MenuScreen() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  // standalone (インストール済み) 起動ではインストール項目を隠す
  const installed = useIsStandalone();

  const entries = ENTRIES.filter(
    (e) => (!e.webOnly || Platform.OS === 'web') && !(e.hideWhenInstalled && installed),
  );

  const go = (href: Entry['href']) => {
    router.replace(href as never);
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="メニュー" />
      <View style={styles.body}>
        {entries.map((e, i) => {
          const position: ListPosition =
            entries.length === 1 ? 'single' : i === 0 ? 'top' : i === entries.length - 1 ? 'bottom' : 'middle';
          return (
            <Stagger key={e.title} index={i}>
              <M3ListItem
                icon={e.icon}
                title={e.title}
                sub={e.sub}
                position={position}
                onPress={e.onPress ?? (() => go(e.href))}
              />
            </Stagger>
          );
        })}
      </View>
      <View style={[styles.closeWrap, { bottom: Math.max(insets.bottom, 16) }]}>
        <M3FAB icon="close" label="メニューを閉じる" onPress={() => goBackOrHome()} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    container: {
      flex: 1,
      minHeight: 0,
      backgroundColor: m3.surface,
      overflow: 'hidden',
      ...(Platform.OS === 'web'
        ? { flexGrow: 0, flexShrink: 0, flexBasis: '100dvh' as unknown as number }
        : null),
    },
    body: {
      flex: 1,
      minHeight: 0,
      justifyContent: 'center',
      padding: scaled(12, s),
      overflow: 'hidden',
    },
    closeWrap: {
      position: 'absolute',
      right: scaled(16, s),
      zIndex: 1,
      alignItems: 'flex-end',
    },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
