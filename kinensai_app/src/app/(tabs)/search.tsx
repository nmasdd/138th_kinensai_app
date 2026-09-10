import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useLocalSearchParams } from 'expo-router';
import { M3Card, M3EmptyState, M3FAB, M3FilterChip, M3Icon, M3ImagePlaceholder, M3LoadingView, M3SearchBar, TopAppBar } from '../../components/m3';
import { Rise, ScreenFade, Stagger } from '../../components/anim';
import ExhibitionDetailModal from '../../components/ExhibitionDetailModal';
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
  const { filter, exhibit } = useLocalSearchParams<{ filter?: string; exhibit?: string | string[] }>();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kind, setKind] = useState<KindFilter>(filter === 'mogiten' ? 'mogiten' : 'all');
  const [filterOpen, setFilterOpen] = useState(filter === 'mogiten');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { isFavorite, toggle } = useFavorites();

  // 管理者ページの保存を即反映するため、表示のたびに再読込する
  // QuickNav/メニューからの再訪でも filter/exhibit を同期する
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      if (filter === 'mogiten') {
        setKind('mogiten');
        setFilterOpen(true);
      }
      loadAllExhibitions()
        .catch(() => [])
        .then((list) => {
          if (!cancelled) setExhibitions(list);
        })
        .finally(() => {
          if (!cancelled) setIsLoading(false);
        });
      return () => {
        cancelled = true;
      };
    }, [filter]),
  );

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

  // お気に入りを先頭に寄せる安定ソート (絞り込み・検索後の順序を保持)
  const sorted = useMemo(() => {
    if (kind === 'fav') return filtered;
    return filtered
      .map((ex, index) => ({ ex, index }))
      .sort((a, b) => {
        const favDiff = Number(isFavorite(b.ex.id)) - Number(isFavorite(a.ex.id));
        if (favDiff !== 0) return favDiff;
        return a.index - b.index;
      })
      .map(({ ex }) => ex);
  }, [filtered, kind, isFavorite]);

  // 他画面からの詳細直開き: /search?exhibit=<id> で一致があれば自動で開く
  // 再訪時も開けるよう、同一targetはモーダルが閉じていれば再オープンする
  const openedExhibitRef = useRef<string | null>(null);
  useEffect(() => {
    if (isLoading) return;
    const target = Array.isArray(exhibit) ? exhibit[0] : exhibit;
    if (!target) return;
    if (openedExhibitRef.current === target && modalVisible) return;
    if (!exhibitions.some((ex) => ex.id === target)) return;
    openedExhibitRef.current = target;
    // effect 本体での同期 setState を避けるため遅延実行する
    const timer = setTimeout(() => {
      setSelectedId(target);
      setModalVisible(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [exhibit, exhibitions, isLoading, modalVisible]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopAppBar title="検索" />
        <M3LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="検索" />
      <ScreenFade>
        <View style={styles.searchWrap}>
          <M3SearchBar value={query} onChangeText={setQuery} placeholder="検索" />
        </View>
      </ScreenFade>
      {filterOpen && (
        <Rise>
          <View style={styles.filterPanel} accessibilityRole="none" accessibilityLabel="絞り込み条件">
          {(Object.keys(KIND_LABEL) as KindFilter[]).map((k) => (
            <M3FilterChip key={k} label={KIND_LABEL[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </View>
        </Rise>
      )}
      <Rise delay={40}>
        <View style={styles.resultInfo}>
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} accessibilityLiveRegion="polite">
            {query.trim() ? `検索結果: ${sorted.length}件` : `全 ${sorted.length} 件の企画`}
          </Text>
        </View>
      </Rise>
      <View style={styles.listWrap}>
        <FlatList
          data={sorted}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.list}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          renderItem={({ item, index }) => (
            <Stagger index={index % 10}>
              <M3Card
              variant="filled"
              style={styles.card}
              onPress={() => {
                setSelectedId(item.id);
                setModalVisible(true);
              }}
            >
              {item.imageUri ? (
                <Image source={{ uri: item.imageUri }} style={styles.cardImage} resizeMode="cover" />
              ) : (
                <M3ImagePlaceholder height={140} />
              )}
              <View style={styles.cardBody}>
                <View style={styles.cardTitleRow}>
                  <Text style={[m3type.titleMedium, { color: m3.onSurface, flex: 1 }]} numberOfLines={1}>
                    {item.className} {item.projectName ? `(${item.projectName})` : '(タイトル)'}
                  </Text>
                  {isFavorite(item.id) ? <M3Icon name="star" size={20} color={m3.primary} /> : null}
                </View>
                <Text style={[m3type.labelLarge, styles.openHint]}>詳細を開く</Text>
              </View>
            </M3Card>
            </Stagger>
          )}
          ListEmptyComponent={
            <M3EmptyState icon="search">
              <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                {kind === 'mogiten' ? '模擬店の出店情報は準備中です' : '一致する企画が見つかりません'}
              </Text>
            </M3EmptyState>
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
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  filterPanel: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, paddingHorizontal: 16, paddingTop: 8 },
  resultInfo: { paddingHorizontal: 16, paddingVertical: 12 },
  listWrap: { flex: 1 },
  list: { paddingHorizontal: 16, paddingBottom: 96, gap: 16 },
  card: { padding: 0 },
  cardImage: { width: '100%', height: 140, borderRadius: 20, backgroundColor: m3.surfaceContainerHighest },
  cardBody: { padding: 16, gap: 4 },
  openHint: { color: m3.primary },
  cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  fab: { position: 'absolute', right: 16, bottom: 16 },
});
