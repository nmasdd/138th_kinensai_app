import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, FlatList, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import { loadNotifications, type AppNotification } from '../data/notifications';
import { theme } from '../theme';

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
      <SafeAreaView style={styles.center}>
        <ActivityIndicator color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="通知" />
      <FlatList
        data={items}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <View style={styles.card}>
            <Text style={styles.date}>{item.date}</Text>
            <Text style={styles.title}>{item.title}</Text>
            <Text style={styles.body}>{item.body}</Text>
          </View>
        )}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyText}>通知はありません</Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  list: { padding: 16 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 5,
    borderLeftColor: theme.primary,
    padding: 14,
    marginBottom: 10,
  },
  date: { fontSize: 12, color: theme.muted, marginBottom: 2 },
  title: { fontSize: 15, fontWeight: 'bold', color: theme.ink, marginBottom: 4 },
  body: { fontSize: 14, color: theme.text, lineHeight: 20 },
  empty: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 15, color: theme.muted },
});
