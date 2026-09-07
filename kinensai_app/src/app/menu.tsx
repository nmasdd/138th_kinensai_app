import React from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Icon, M3ListItem, M3Touch, type IconName } from '../components/m3';
import { m3 } from '../theme';
import type { ListPosition } from '../components/m3';

interface Entry {
  title: string;
  sub: string;
  icon: IconName;
  href: string | { pathname: string; params?: Record<string, string> };
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
];

export default function MenuScreen() {
  const go = (href: Entry['href']) => {
    router.replace(href as never);
  };
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.body}>
        {ENTRIES.map((e, i) => {
          const position: ListPosition =
            ENTRIES.length === 1 ? 'single' : i === 0 ? 'top' : i === ENTRIES.length - 1 ? 'bottom' : 'middle';
          return <M3ListItem key={e.title} icon={e.icon} title={e.title} sub={e.sub} position={position} onPress={() => go(e.href)} />;
        })}
      </ScrollView>
      <View style={styles.closeWrap}>
        <M3Touch onPress={() => router.back()} label="メニューを閉じる" round>
          <View style={styles.closeButton}>
            <M3Icon name="close" color={m3.onPrimary} />
          </View>
        </M3Touch>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { flexGrow: 1, justifyContent: 'center', padding: 16, paddingBottom: 8 },
  closeWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
  closeButton: {
    width: 56,
    height: 56,
    borderRadius: 999,
    backgroundColor: m3.primary,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
});
