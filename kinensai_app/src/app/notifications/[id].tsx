import React, { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { M3Button, M3LoadingView, TopAppBar, goBackOrHome } from '../../components/m3';
import { ScreenFade } from '../../components/anim';
import { loadNotifications, type AppNotification } from '../../data/notifications';
import { m3, m3type } from '../../theme';

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<AppNotification | null | undefined>(undefined);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    let alive = true;
    loadNotifications()
      .catch(() => [])
      .then((list) => {
        if (alive) setItem(list.find((n) => n.id === id) ?? null);
      });
    return () => {
      alive = false;
    };
  }, [id]);

  if (item === undefined) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <TopAppBar title="通知" />
        <M3LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title={item?.title ?? '通知'} />
      <ScreenFade>
        <View style={styles.body}>
          {item ? (
            <>
              <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant, marginBottom: 12 }]}>{item.date}</Text>
              <Text style={[m3type.bodyLarge, { color: m3.onSurface, textAlign: 'center' }]}>{item.body}</Text>
            </>
          ) : (
            <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
              この通知は見つかりませんでした。
            </Text>
          )}
        </View>
      </ScreenFade>
      <View style={[styles.backWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <M3Button label="通知一覧に戻る" icon="undo" onPress={() => goBackOrHome('/notifications' as never)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  center: { flex: 1, backgroundColor: m3.surface },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  backWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
