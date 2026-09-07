import React, { useEffect, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3Card, M3ImagePlaceholder, TopAppBar } from '../components/m3';
import { loadNotifications, type AppNotification } from '../data/notifications';
import { m3, m3type } from '../theme';

export default function NotificationsScreen() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadNotifications()
      .catch(() => [])
      .then(setItems)
      .finally(() => setIsLoading(false));
  }, []);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center} edges={['top']}>
        <ActivityIndicator size="large" color={m3.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="通知" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <M3Card variant="elevated" style={styles.card} onPress={() => router.push(`/notifications/${item.id}`)}>
            <M3ImagePlaceholder height={120} />
            <View style={styles.cardBody}>
              <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant }]}>{item.date}</Text>
              <Text style={[m3type.titleMedium, { color: m3.onSurface, marginTop: 2 }]}>{item.title}</Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]} numberOfLines={2}>
                {item.body}
              </Text>
            </View>
          </M3Card>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant }]}>通知はありません</Text>
          </View>
        }
      />
      <View style={styles.backWrap}>
        <M3Button label="戻る" icon="undo" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  center: { flex: 1, backgroundColor: m3.surface, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16, gap: 12 },
  card: { padding: 0 },
  cardBody: { padding: 16 },
  empty: { paddingTop: 60, alignItems: 'center' },
  backWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
