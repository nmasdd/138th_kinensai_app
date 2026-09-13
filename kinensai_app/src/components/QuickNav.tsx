import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { M3Icon, M3Touch, type IconName } from './m3';
import { useM3 } from '../context/responsive';
import { m3, scaled, type M3Shape } from '../theme';

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
  const { type } = useM3();
  const styles = useStyles();
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
            <Text style={[type.labelMedium, styles.label]} numberOfLines={1}>
              {item.title}
            </Text>
          </View>
        </M3Touch>
      ))}
    </View>
  );
}

function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    grid: { flexDirection: 'row', flexWrap: 'wrap', gap: scaled(8, s) },
    cell: { width: '23%', minWidth: 0, flexGrow: 1 },
    inner: {
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: shape.card,
      paddingVertical: scaled(12, s),
      paddingHorizontal: scaled(4, s),
      alignItems: 'center',
      gap: scaled(6, s),
      minHeight: scaled(44, s),
    },
    iconWrap: {
      width: scaled(40, s),
      height: scaled(40, s),
      borderRadius: scaled(20, s),
      backgroundColor: m3.primaryContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    label: { color: m3.onSurface },
  });
}

function useStyles() {
  const { scale, shape } = useM3();
  return React.useMemo(() => createStyles(scale, shape), [scale, shape]);
}
