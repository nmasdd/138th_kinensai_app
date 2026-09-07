import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { M3Card, M3FAB, M3ImagePlaceholder, M3SearchBar, M3Touch, TopAppBar } from '../../components/m3';
import ExhibitionDetailModal, { ticketLabel } from '../../components/ExhibitionDetailModal';
import { loadAllExhibitions, type Exhibition } from '../../data/exhibitions';
import { useFavorites } from '../../data/favorites';
import { m3, m3type } from '../../theme';

type KindFilter = 'all' | 'class' | 'volunteer' | 'mogiten' | 'fav';

const KIND_LABEL: Record<KindFilter, string> = {
  all: 'すべて',
  class: 'クラス企画',
  volunteer: '有志企画',
  mogiten: '模擬店',
  fav: 'お気に入り',
};

function isMogiten(ex: Exhibition): boolean {
  return /模擬店|屋台|フード|軽食|喫茶|カフェ/.test(`${ex.className}${ex.projectName}${ex.description}`);
}

export default function SearchScreen() {
  const { filter } = useLocalSearchParams<{ filter?: string }>();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>(filter === 'mogiten' ? 'mogiten' : 'all');
  const [filterOpen, setFilterOpen] = useState(filter === 'mogiten');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    loadAllExhibitions()
      .catch(() => [])
      .then((list) => setExhibitions(list))
      .finally(() => setIsLoading(false));
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exhibitions.filter((ex) => {
      if (kind === 'class' || kind === 'volunteer') {
        if (ex.kind !== kind) return false;
      } else if (kind === 'mogiten') {
        if (!isMogiten(ex)) return false;
      } else if (kind === 'fav') {
        if (!isFavorite(ex.id)) return false;
      }
      if (!q) return true;
      return (
        ex.className.toLowerCase().includes(q) ||
        ex.projectName.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q)
      );
    });
  }, [exhibitions, query, kind, isFavorite]);

  const selected = useMemo(
    () => (selectedId ? exhibitions.find((ex) => ex.id === selectedId) ?? null : null),
    [exhibitions, selectedId],
  );

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopAppBar title="検索" />
        <View style={styles.centering}>
          <ActivityIndicator size="large" color={m3.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="検索" />
      <View style={styles.searchWrap}>
        <M3SearchBar value={query} onChangeText={setQuery} placeholder="検索" />
      </View>
      {filterOpen && (
        <View style={styles.filterPanel}>
          {(Object.keys(KIND_LABEL) as KindFilter[]).map((k) => (
            <M3Touch key={k} onPress={() => setKind(k)} label={KIND_LABEL[k]} round>
              <View style={[styles.chip, kind === k && styles.chipActive]}>
                <Text style={[m3type.labelLarge, { color: kind === k ? m3.onSecondaryContainer : m3.onSurfaceVariant }]}>
                  {KIND_LABEL[k]}
                </Text>
              </View>
            </M3Touch>
          ))}
        </View>
      )}
      <View style={styles.resultInfo}>
        <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
          {query.trim() ? `検索結果: ${filtered.length}件` : `全 ${filtered.length} 件の企画`}
        </Text>
      </View>
      <View style={styles.listWrap}>
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          renderItem={({ item }) => (
            <M3Card
              variant="filled"
              style={styles.card}
              onPress={() => {
                setSelectedId(item.id);
                setModalVisible(true);
              }}
            >
              <M3ImagePlaceholder height={140} />
              <View style={styles.cardBody}>
                <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>
                  {item.className} {item.projectName ? `(${item.projectName})` : '(タイトル)'}
                </Text>
                <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={3}>
                  {item.description || '補足テキストがここに入ります。'}
                </Text>
                <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]}>
                  {item.kind === 'class' ? 'クラス企画' : '有志企画'} ・ {ticketLabel(item)}
                  {isFavorite(item.id) ? ' ・ ★お気に入り' : ''}
                </Text>
              </View>
            </M3Card>
          )}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                {kind === 'mogiten' ? '模擬店の出店情報は準備中です' : '一致する企画が見つかりません'}
              </Text>
            </View>
          }
        />
        <M3FAB
          icon="filter-alt"
          label="絞り込み"
          onPress={() => setFilterOpen((v) => !v)}
          style={styles.fab}
        />
      </View>
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
  container: { flex: 1, backgroundColor: m3.surface },
  centering: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  filterPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: m3.outline,
  },
  chipActive: { backgroundColor: m3.secondaryContainer, borderColor: m3.secondaryContainer },
  resultInfo: { paddingHorizontal: 16, paddingVertical: 8 },
  listWrap: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 96, gap: 12 },
  card: { padding: 0 },
  cardBody: { padding: 16, gap: 4 },
  emptyContainer: { paddingTop: 60, alignItems: 'center' },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
