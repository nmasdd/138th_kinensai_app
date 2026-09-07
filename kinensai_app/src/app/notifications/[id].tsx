import React, { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { M3Button, TopAppBar } from '../../components/m3';
import { loadNotifications, type AppNotification } from '../../data/notifications';
import { m3 } from '../../theme';

export default function NotificationDetailScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const [item, setItem] = useState<AppNotification | null | undefined>(undefined);

  useEffect(() => {
    loadNotifications()
      .catch(() => [])
      .then((list) => setItem(list.find((n) => n.id === id) ?? null));
  }, [id]);

  if (item === undefined) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={m3.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title={item?.title ?? '通知'} />
      <View style={styles.body}>
        {item ? (
          <>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.detail}>{item.body}</Text>
          </>
        ) : (
          <Text style={styles.detail}>この通知は見つかりませんでした。</Text>
        )}
      </View>
      <View style={styles.backWrap}>
        <M3Button label="戻る" icon="undo" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  center: { flex: 1, backgroundColor: m3.surface, justifyContent: 'center', alignItems: 'center' },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24 },
  date: { fontSize: 14, color: m3.onSurfaceVariant, marginBottom: 12 },
  detail: { fontSize: 28, lineHeight: 38, color: m3.onSurface, textAlign: 'center' },
  backWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
