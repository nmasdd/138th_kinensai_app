import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { M3Icon, M3Touch, type IconName } from './m3';
import { m3, m3shape, m3type } from '../theme';

interface NavItem {
  title: string;
  icon: IconName;
  href: string | { pathname: string; params?: Record<string, string> };
}

/**
 * 全ページへ最大2タップで到達するためのクイックナビ (ホーム用)。
 * タブ5件 + 投票/パンフ/通知をグリッド化。管理者ページは含めない。
 */
const ITEMS: NavItem[] = [
  { title: 'マップ', icon: 'map', href: '/map' },
  { title: '検索', icon: 'search', href: '/search' },
  { title: 'タイムテーブル', icon: 'calendar-month', href: '/timetable' },
  { title: 'カメラ', icon: 'qr-code-2', href: '/camera' },
  { title: '投票', icon: 'how-to-vote', href: '/vote' },
  { title: 'パンフ', icon: 'menu-book', href: '/pamphlet' },
  { title: '通知', icon: 'notifications', href: '/notifications' },
  { title: '模擬店', icon: 'store', href: { pathname: '/search', params: { filter: 'mogiten' } } },
];

export function QuickNav() {
  return (
    <View style={styles.grid} accessibilityRole="none" accessibilityLabel="すべてのページへの近道">
      {ITEMS.map((item) => (
        <M3Touch
          key={item.title}
          label={`${item.title}へ移動`}
          round
          style={styles.cell}
          onPress={() => router.push(item.href as never)}
        >
          <View style={styles.inner}>
            <View style={styles.iconWrap}>
              <M3Icon name={item.icon} size={24} color={m3.onPrimaryContainer} />
            </View>
            <Text style={[m3type.labelMedium, styles.label]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </M3Touch>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  cell: { width: '23%', minWidth: 0, flexGrow: 1 },
  inner: {
    backgroundColor: m3.surfaceContainerLow,
    borderRadius: m3shape.card,
    paddingVertical: 12,
    paddingHorizontal: 4,
    alignItems: 'center',
    gap: 6,
    minHeight: 44,
  },
  iconWrap: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: m3.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  label: { color: m3.onSurface },
});
