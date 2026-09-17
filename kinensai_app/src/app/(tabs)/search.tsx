import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { FlatList, Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { M3Card, M3EmptyState, M3FAB, M3FilterChip, M3Icon, M3ImagePlaceholder, M3LoadingView, M3SearchBar, M3Touch, TopAppBar, m3scrim } from '../../components/m3';
import { FadeOverlay, Pop, Rise, ScreenFade, Stagger } from '../../components/anim';
import ExhibitionDetailModal from '../../components/ExhibitionDetailModal';
import { genreLabel, isStageOrAuditoriumProgram, loadAllExhibitions, matchesGenre, displayClassName, type Exhibition } from '../../data/exhibitions';
import { useFavorites } from '../../data/favorites';
import { useM3 } from '../../context/responsive';
import { useContentEffect } from '../../context/useContentRefreshKey';
import { m3, scaled } from '../../theme';

type KindFilter = 'class' | 'volunteer' | 'mogiten' | 'fav';

const KIND_LABEL: Record<KindFilter, string> = {
  class: 'クラス企画',
  volunteer: '有志企画',
  mogiten: '模擬店',
  fav: 'お気に入り',
};

/** 1段目: 企画の種別。同一段内は OR で絞り込む */
const KIND_FILTERS: KindFilter[] = ['class', 'volunteer', 'mogiten', 'fav'];

/** 2段目: パンフレットの主要ジャンル。同一段内は OR で絞り込む */
const MAJOR_GENRE_FILTERS = ['演劇', 'テーマツアー', 'パフォーマンス', '展示'];

/** 3段目: 残りのジャンル (有志区分とクラス企画の細分)。同一段内は OR で絞り込む */
const OTHER_GENRE_FILTERS = [
  '実演発表',
  '体験企画',
  '販売・配布',
  '研究発表',
  'クラブ',
  'パロディ',
  'アクション',
  '謎解き・脱出',
  'ヒューマンドラマ',
  '映像作品',
  'アドベンチャー',
  '占い',
];

function isMogiten(ex: Exhibition): boolean {
  if (typeof ex.mogiten === 'boolean') return ex.mogiten;
  return /模擬店|屋台|フード|軽食|喫茶|カフェ/.test(`${ex.className}${ex.projectName}${ex.description}`);
}

function toggleValue<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function SearchScreen() {
  const { type } = useM3();
  const styles = useStyles();
  const { filter, exhibit } = useLocalSearchParams<{ filter?: string; exhibit?: string | string[] }>();
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [kinds, setKinds] = useState<KindFilter[]>(filter === 'mogiten' ? ['mogiten'] : []);
  const [majorGenres, setMajorGenres] = useState<string[]>([]);
  const [otherGenres, setOtherGenres] = useState<string[]>([]);
  const [filterOpen, setFilterOpen] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { isFavorite, toggle } = useFavorites();

  // 詳細直開きの自動オープンは「未オープンの target」に一度だけ行う。
  // 画面に再フォーカスしたらリセットし、再訪時は同じ target でも開き直せるようにする。
  const openedExhibitRef = useRef<string | null>(null);
  const listRef = useRef<FlatList<Exhibition>>(null);

  // 検索ページを開くたびに絞り込み・キーワードを初期状態へ戻し、先頭から表示する。
  // 模擬店リンク (filter=mogiten) のときだけ模擬店で絞り込む。
  const resetToInitialState = useCallback(() => {
    setQuery('');
    setMajorGenres([]);
    setOtherGenres([]);
    setKinds(filter === 'mogiten' ? ['mogiten'] : []);
    setFilterOpen(false);
    setTimeout(() => listRef.current?.scrollToOffset({ offset: 0, animated: false }), 0);
  }, [filter]);

  useFocusEffect(resetToInitialState);

  // 管理者ページの保存・公開コンテンツの更新を即反映する
  useContentEffect(() => {
    let cancelled = false;
    openedExhibitRef.current = null;
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
  }, [filter]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exhibitions.filter((ex) => {
      // 講堂・ステージの企画はタイムテーブル側で扱うため検索に出さない
      if (isStageOrAuditoriumProgram(ex)) return false;
      if (kinds.length > 0) {
        const kindMatch = kinds.some((k) => {
          if (k === 'class') return ex.kind === 'class' && !isMogiten(ex);
          if (k === 'volunteer') return ex.kind === 'volunteer';
          if (k === 'mogiten') return isMogiten(ex);
          return isFavorite(ex.id);
        });
        if (!kindMatch) return false;
      }
      if (majorGenres.length > 0 && !majorGenres.some((g) => matchesGenre(ex, g))) return false;
      if (otherGenres.length > 0 && !otherGenres.some((g) => matchesGenre(ex, g))) return false;
      if (!q) return true;
      return (
        ex.className.toLowerCase().includes(q) ||
        ex.projectName.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q) ||
        (genreLabel(ex) ?? '').toLowerCase().includes(q)
      );
    });
  }, [exhibitions, query, kinds, majorGenres, otherGenres, isFavorite]);

  const selected = useMemo(
    () => (selectedId ? exhibitions.find((ex) => ex.id === selectedId) ?? null : null),
    [exhibitions, selectedId],
  );

  // お気に入りを先頭に寄せる安定ソート (絞り込み・検索後の順序を保持)
  const sorted = useMemo(() => {
    if (kinds.length === 1 && kinds[0] === 'fav') return filtered;
    return filtered
      .map((ex, index) => ({ ex, index }))
      .sort((a, b) => {
        const favDiff = Number(isFavorite(b.ex.id)) - Number(isFavorite(a.ex.id));
        if (favDiff !== 0) return favDiff;
        return a.index - b.index;
      })
      .map(({ ex }) => ex);
  }, [filtered, kinds, isFavorite]);

  // 他画面からの詳細直開き: /search?exhibit=<id> で一致があれば自動で開く
  // modalVisible を依存に含めないことで、閉じた直後の再オープンを防ぐ
  useEffect(() => {
    if (isLoading) return;
    const target = Array.isArray(exhibit) ? exhibit[0] : exhibit;
    if (!target) return;
    if (openedExhibitRef.current === target) return;
    if (!exhibitions.some((ex) => ex.id === target)) return;
    openedExhibitRef.current = target;
    // effect 本体での同期 setState を避けるため遅延実行する
    const timer = setTimeout(() => {
      setSelectedId(target);
      setModalVisible(true);
    }, 0);
    return () => clearTimeout(timer);
  }, [exhibit, exhibitions, isLoading]);

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
      <Modal visible={filterOpen} animationType="none" transparent onRequestClose={() => setFilterOpen(false)}>
        <FadeOverlay style={styles.filterOverlay}>
          <Pop style={styles.filterPop}>
            <View style={styles.filterHeader}>
              <Text style={[type.titleLarge, { color: m3.onSurface }]} accessibilityRole="header">
                絞り込み
              </Text>
              <M3Touch onPress={() => setFilterOpen(false)} label="絞り込みを閉じる" round style={styles.filterClose}>
                <M3Icon name="close" size={24} color={m3.onSurfaceVariant} />
              </M3Touch>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.chipGroup}>
              <View style={styles.chipSection}>
                <Text style={[type.titleSmall, styles.sectionLabel]}>企画</Text>
                <View style={styles.chipRow}>
                  <M3FilterChip label="すべて" selected={kinds.length === 0} onPress={() => setKinds([])} />
                  {KIND_FILTERS.map((k) => (
                    <M3FilterChip
                      key={k}
                      label={KIND_LABEL[k]}
                      selected={kinds.includes(k)}
                      onPress={() => setKinds((prev) => toggleValue(prev, k))}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.chipSection}>
                <Text style={[type.titleSmall, styles.sectionLabel]}>種類</Text>
                <View style={styles.chipRow}>
                  <M3FilterChip
                    label="すべて"
                    selected={majorGenres.length === 0}
                    onPress={() => setMajorGenres([])}
                  />
                  {MAJOR_GENRE_FILTERS.map((g) => (
                    <M3FilterChip
                      key={g}
                      label={g}
                      selected={majorGenres.includes(g)}
                      onPress={() => setMajorGenres((prev) => toggleValue(prev, g))}
                    />
                  ))}
                </View>
              </View>
              <View style={styles.chipSection}>
                <Text style={[type.titleSmall, styles.sectionLabel]}>タグ</Text>
                <View style={styles.chipRow}>
                  <M3FilterChip
                    label="すべて"
                    selected={otherGenres.length === 0}
                    onPress={() => setOtherGenres([])}
                  />
                  {OTHER_GENRE_FILTERS.map((g) => (
                    <M3FilterChip
                      key={g}
                      label={g}
                      selected={otherGenres.includes(g)}
                      onPress={() => setOtherGenres((prev) => toggleValue(prev, g))}
                    />
                  ))}
                </View>
              </View>
            </ScrollView>
          </Pop>
        </FadeOverlay>
      </Modal>
      <Rise delay={40}>
        <View style={styles.resultInfo}>
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]} accessibilityLiveRegion="polite">
            {query.trim() ? `検索結果: ${sorted.length}件` : `全 ${sorted.length} 件の企画`}
          </Text>
        </View>
      </Rise>
      <View style={styles.listWrap}>
        <FlatList
          ref={listRef}
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
                  <Text style={[type.titleMedium, { color: m3.onSurface, flex: 1 }]} numberOfLines={1}>
                    {displayClassName(item.className)} {item.projectName ? `(${item.projectName})` : '(タイトル)'}
                  </Text>
                  {isFavorite(item.id) ? <M3Icon name="star" size={20} color={m3.primary} /> : null}
                </View>
                <Text style={[type.labelLarge, styles.openHint]}>詳細を開く</Text>
              </View>
            </M3Card>
            </Stagger>
          )}
          ListEmptyComponent={
            <M3EmptyState icon="search">
              <Text style={[type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                {kinds.length === 1 && kinds[0] === 'mogiten'
                  ? '模擬店の出店情報は準備中です'
                  : '一致する企画が見つかりません'}
              </Text>
            </M3EmptyState>
          }
        />
        <M3FAB
          icon="filter-alt"
          label="絞り込み"
          onPress={() => setFilterOpen(true)}
          style={styles.fab}
        />
      </View>
      <ExhibitionDetailModal
        exhibition={selected}
        visible={modalVisible}
        isFavorite={isFavorite}
        onToggleFavorite={toggle}
        showMapButton
        onClose={() => {
          setModalVisible(false);
          setSelectedId(null);
          // 直開き用パラメータを除去し /search に戻す
          if (exhibit) router.setParams({ exhibit: undefined });
        }}
      />
    </SafeAreaView>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    searchWrap: { paddingHorizontal: scaled(16, s), paddingTop: scaled(8, s) },
    filterOverlay: { flex: 1, justifyContent: 'center', backgroundColor: m3scrim },
    filterPop: {
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: scaled(28, s),
      margin: scaled(24, s),
      padding: scaled(20, s),
      maxHeight: '80%',
    },
    filterHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: scaled(12, s),
    },
    filterClose: {
      width: scaled(44, s),
      height: scaled(44, s),
      justifyContent: 'center',
      alignItems: 'center',
    },
    chipGroup: {
      gap: scaled(16, s),
      paddingBottom: scaled(4, s),
    },
    chipSection: { gap: scaled(8, s) },
    sectionLabel: { color: m3.onSurfaceVariant },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scaled(8, s),
    },
    resultInfo: { paddingHorizontal: scaled(16, s), paddingVertical: scaled(12, s) },
    listWrap: { flex: 1 },
    list: { paddingHorizontal: scaled(16, s), paddingBottom: scaled(96, s), gap: scaled(16, s) },
    card: { padding: 0 },
    cardImage: {
      width: '100%',
      height: scaled(140, s),
      borderRadius: scaled(20, s),
      backgroundColor: m3.surfaceContainerHighest,
    },
    cardBody: { padding: scaled(16, s), gap: scaled(4, s) },
    openHint: { color: m3.primary },
    cardTitleRow: { flexDirection: 'row', alignItems: 'center', gap: scaled(8, s) },
    fab: { position: 'absolute', right: scaled(16, s), bottom: scaled(16, s) },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
