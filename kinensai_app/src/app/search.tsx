import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from '../components/Header';
import ExhibitionDetailModal, { ticketLabel } from '../components/ExhibitionDetailModal';
import { loadAllExhibitions } from '../data/exhibitions';
import { useFavorites } from '../data/favorites';
import { theme } from '../theme';

type KindFilter = 'all' | 'class' | 'volunteer';

const KIND_LABEL: Record<KindFilter, string> = {
  all: 'すべて',
  class: 'クラス企画',
  volunteer: '有志企画',
};

export default function SearchScreen() {
  const [exhibitions, setExhibitions] = useState<Awaited<ReturnType<typeof loadAllExhibitions>>>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>('all');
  const [favOnly, setFavOnly] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    loadAllExhibitions()
      .catch(() => [])
      .then((list) => setExhibitions([...list].sort(() => Math.random() - 0.5)))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exhibitions.filter((ex) => {
      if (kind !== 'all' && ex.kind !== kind) return false;
      if (favOnly && !isFavorite(ex.id)) return false;
      if (!q) return true;
      return (
        ex.className.toLowerCase().includes(q) ||
        ex.projectName.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q)
      );
    });
  }, [exhibitions, query, kind, favOnly, isFavorite]);

  const selected = useMemo(
    () => (selectedId ? exhibitions.find((ex) => ex.id === selectedId) ?? null : null),
    [exhibitions, selectedId],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="検索" />
        <View style={styles.centering}>
          <ActivityIndicator size="large" color={theme.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="検索" />
      <View style={styles.searchBar}>
        <TextInput
          style={styles.searchInput}
          placeholder="クラス名・企画名・内容で検索"
          placeholderTextColor="#999999"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="none"
        />
        {query.length > 0 && (
          <TouchableOpacity onPress={() => setQuery('')}>
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>
      <View style={styles.filters}>
        {(Object.keys(KIND_LABEL) as KindFilter[]).map((k) => (
          <TouchableOpacity
            key={k}
            style={[styles.chip, kind === k && styles.chipActive]}
            onPress={() => setKind(k)}
          >
            <Text style={[styles.chipText, kind === k && styles.chipTextActive]}>{KIND_LABEL[k]}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity
          style={[styles.chip, favOnly && styles.chipActive]}
          onPress={() => setFavOnly((v) => !v)}
        >
          <Text style={[styles.chipText, favOnly && styles.chipTextActive]}>★ お気に入り</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.resultInfo}>
        <Text style={styles.resultCount}>
          {query.trim() ? `検索結果: ${filtered.length}件` : `全 ${filtered.length} 件の企画`}
        </Text>
      </View>
      <FlatList
        data={filtered}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.list}
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.card}
            activeOpacity={0.7}
            onPress={() => {
              setSelectedId(item.id);
              setModalVisible(true);
            }}
          >
            <View style={styles.cardHeader}>
              <Text style={styles.badge}>{item.className}</Text>
              <Text style={styles.kind}>{item.kind === 'class' ? 'クラス企画' : '有志企画'}</Text>
              {isFavorite(item.id) && <Text style={styles.favBadge}>★</Text>}
            </View>
            <Text style={styles.projectName}>{item.projectName || '(タイトル未定)'}</Text>
            <Text style={styles.description} numberOfLines={2}>
              {item.description || '(説明準備中)'}
            </Text>
            <Text style={styles.ticket}>{ticketLabel(item)}</Text>
          </TouchableOpacity>
        )}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>一致する企画が見つかりません</Text>
          </View>
        }
      />
      <ExhibitionDetailModal
        exhibition={selected}
        visible={modalVisible}
        isFavorite={isFavorite}
        onToggleFavorite={toggle}
        onClose={() => {
          setModalVisible(false);
          setSelectedId(null);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  centering: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    marginBottom: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: { flex: 1, fontSize: 15, color: theme.text },
  clearButtonText: { fontSize: 16, color: '#999999', paddingLeft: 8 },
  filters: { flexDirection: 'row', paddingHorizontal: 12, paddingBottom: 8, gap: 8 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    backgroundColor: '#ffffff',
  },
  chipActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  chipText: { fontSize: 13, fontWeight: '600', color: theme.text },
  chipTextActive: { color: '#ffffff' },
  resultInfo: { paddingHorizontal: 16, paddingBottom: 8 },
  resultCount: { fontSize: 13, color: theme.muted },
  list: { paddingHorizontal: 12, paddingBottom: 20 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 6, gap: 8 },
  badge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: theme.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden',
  },
  kind: { fontSize: 12, color: theme.muted },
  favBadge: { fontSize: 14, fontWeight: 'bold', color: theme.primaryDark, marginLeft: 'auto' },
  projectName: { fontSize: 15, fontWeight: '600', color: theme.text, marginBottom: 4 },
  description: { fontSize: 13, color: '#666666', marginBottom: 8 },
  ticket: { fontSize: 12, color: theme.muted },
  emptyContainer: { paddingTop: 60, alignItems: 'center' },
  emptyText: { fontSize: 16, color: '#999999' },
});
