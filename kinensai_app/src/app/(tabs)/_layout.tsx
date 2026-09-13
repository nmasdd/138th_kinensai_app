import React from 'react';
import { Tabs } from 'expo-router';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from 'react-native-reanimated';
import { TabHighlight } from '../../components/anim';
import { useM3 } from '../../context/responsive';
import { m3, scaled } from '../../theme';

interface NavBarState {
  index: number;
  routes: { name: string }[];
}

interface NavBarProps {
  state: NavBarState;
  navigation: { navigate: (name: string) => void };
}

const TABS = [
  { name: 'camera', label: 'カメラ', icon: 'qr-code-2' },
  { name: 'timetable', label: 'タイムテーブル', icon: 'calendar-month' },
  { name: 'index', label: 'ホーム', icon: 'home' },
  { name: 'search', label: '検索', icon: 'search' },
  { name: 'map', label: '校内マップ', icon: 'map' },
] as const;

/**
 * M3 Expressive ナビゲーションバー。
 * 高さ 80・背景 surfaceContainer、選択中は secondaryContainer の
 * ピル型インジケータ (64×32) + ラベル labelMedium。
 */
function M3NavBar({ state, navigation }: NavBarProps) {
  const insets = useSafeAreaInsets();
  const { type, scale } = useM3();
  const styles = useStyles();
  const visible = TABS.some((t) => state.routes[state.index]?.name === t.name);
  if (!visible) return null;
  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, scaled(8, scale)) }]}>
      {TABS.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === tab.name;
        const isHome = tab.name === 'index';
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
            onPress={() => navigation.navigate(tab.name)}
            style={styles.item}
          >
            <View style={styles.indicatorArea}>
              <View style={[styles.indicator, isHome && styles.indicatorCircle]}>
                <TabHighlight active={focused} />
                {isHome ? (
                  <Image
                    source={require('../../../icon/logo.png')}
                    style={{
                      width: scaled(46, scale),
                      height: scaled(46, scale),
                      opacity: focused ? 1 : 0.55,
                    }}
                    resizeMode="contain"
                  />
                ) : (
                  <MaterialIcons
                    name={tab.icon as never}
                    size={scaled(24, scale)}
                    color={focused ? m3.onSecondaryContainer : m3.onSurfaceVariant}
                  />
                )}
              </View>
            </View>
            <Text
              numberOfLines={1}
              style={[
                type.labelMedium,
                { color: focused ? m3.onSurface : m3.onSurfaceVariant, fontSize: type.labelMedium.fontSize },
                focused && { fontWeight: '700' },
              ]}
            >
              {tab.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

export default function TabsLayout() {
  const reduced = useReducedMotion();
  return (
    <Tabs
      tabBar={(props) => <M3NavBar {...(props as unknown as NavBarProps)} />}
      screenOptions={{ headerShown: false, animation: reduced ? 'none' : 'fade' }}
      initialRouteName="index"
    >
      <Tabs.Screen name="camera" />
      <Tabs.Screen name="timetable" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="map" />
    </Tabs>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    bar: {
      flexDirection: 'row',
      backgroundColor: m3.surfaceContainer,
      minHeight: scaled(80, s),
      paddingTop: scaled(12, s),
      paddingBottom: scaled(8, s),
      borderTopWidth: 1,
      borderTopColor: m3.outlineVariant,
    },
    item: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: scaled(4, s),
      minHeight: scaled(56, s),
    },
    indicatorArea: {
      height: scaled(54, s),
      justifyContent: 'center',
      alignItems: 'center',
    },
    indicator: {
      width: scaled(64, s),
      height: scaled(32, s),
      borderRadius: 999,
      justifyContent: 'center',
      alignItems: 'center',
    },
    // ホームはロゴに合わせて丸型ハイライト
    indicatorCircle: {
      width: scaled(54, s),
      height: scaled(54, s),
      borderRadius: scaled(27, s),
    },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
