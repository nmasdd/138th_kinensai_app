import { Tabs } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { m3, m3type } from '../../theme';

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
  const visible = TABS.some((t) => state.routes[state.index]?.name === t.name);
  if (!visible) return null;
  return (
    <View style={[styles.bar, { paddingBottom: insets.bottom }]}>
      {TABS.map((tab) => {
        const route = state.routes.find((r) => r.name === tab.name);
        if (!route) return null;
        const focused = state.routes[state.index]?.name === tab.name;
        return (
          <Pressable
            key={tab.name}
            accessibilityRole="button"
            accessibilityState={{ selected: focused }}
            android_ripple={{ color: 'rgba(0,0,0,0.08)', borderless: false }}
            onPress={() => navigation.navigate(tab.name)}
            style={styles.item}
          >
            <View style={[styles.indicator, focused && styles.indicatorActive]}>
              <MaterialIcons
                name={tab.icon as never}
                size={24}
                color={focused ? m3.onSecondaryContainer : m3.onSurfaceVariant}
              />
            </View>
            <Text
              numberOfLines={1}
              style={[
                m3type.labelMedium,
                { color: focused ? m3.onSurface : m3.onSurfaceVariant, fontSize: 11 },
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
  return (
    <Tabs tabBar={(props) => <M3NavBar {...(props as unknown as NavBarProps)} />} screenOptions={{ headerShown: false }} initialRouteName="index">
      <Tabs.Screen name="camera" />
      <Tabs.Screen name="timetable" />
      <Tabs.Screen name="index" />
      <Tabs.Screen name="search" />
      <Tabs.Screen name="map" />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: m3.surfaceContainer,
    minHeight: 80,
    paddingTop: 8,
  },
  item: { flex: 1, alignItems: 'center', gap: 4, paddingVertical: 4 },
  indicator: {
    width: 64,
    height: 32,
    borderRadius: 999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  indicatorActive: { backgroundColor: m3.secondaryContainer },
});
