import React, { useCallback, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { M3Button, M3Card, M3EmptyState, M3ImagePlaceholder, M3LoadingView, TopAppBar, goBackOrHome } from '../components/m3';
import { Stagger } from '../components/anim';
import { loadNotifications, type AppNotification } from '../data/notifications';
import { m3, m3type } from '../theme';

export default function NotificationsScreen() {
  const insets = useSafeAreaInsets();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // 管理者ページの保存を即反映するため、表示のたびに再読込する
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      loadNotifications()
        .catch(() => [])
        .then((list) => {
          if (!cancelled) setItems(list);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopAppBar title="通知" />
        <M3LoadingView />
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
        renderItem={({ item, index }) => (
          <Stagger key={item.id} index={index % 10}>
          <M3Card variant="elevated" style={styles.card} onPress={() => router.push(`/notifications/${item.id}` as never)}>
            {item.imageUri ? (
              <Image source={{ uri: item.imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <M3ImagePlaceholder height={140} />
            )}
            <View style={styles.cardBody}>
              <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant }]}>{item.date}</Text>
              <Text style={[m3type.titleMedium, { color: m3.onSurface, marginTop: 2 }]}>{item.title}</Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]} numberOfLines={2}>
                {item.body}
              </Text>
              <Text style={[m3type.labelLarge, styles.detailHint]}>詳細を開く</Text>
            </View>
          </M3Card>
          </Stagger>
        )}
        ListEmptyComponent={
          <M3EmptyState icon="notifications">
            <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant }]}>通知はありません</Text>
          </M3EmptyState>
        }
      />
      <View style={[styles.backWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <M3Button label="前の画面に戻る" icon="undo" onPress={() => goBackOrHome()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  list: { padding: 16, gap: 16, paddingBottom: 24 },
  card: { padding: 0 },
  image: { width: '100%', height: 140 },
  cardBody: { padding: 16, gap: 4 },
  detailHint: { color: m3.primary, marginTop: 8 },
  backWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
