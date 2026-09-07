import React, { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { M3Icon, M3PrimaryTabs, M3SearchBar, M3Touch, TopAppBar } from '../../components/m3';
import ExhibitionDetailModal from '../../components/ExhibitionDetailModal';
import { loadAllExhibitions, type Exhibition } from '../../data/exhibitions';
import { useFavorites } from '../../data/favorites';
import { m3, m3type } from '../../theme';

const FLOOR_LABELS = ['1階', '2階', '3階', '4階 5階', '模擬店'] as const;

const floorImage: Partial<Record<(typeof FLOOR_LABELS)[number], number>> = {
  '1階': require('../../../assets/maps/f1.jpg'),
  '2階': require('../../../assets/maps/f2.jpg'),
  '3階': require('../../../assets/maps/f3.jpg'),
  '4階 5階': require('../../../assets/maps/f45.jpg'),
};

function isMogiten(ex: Exhibition): boolean {
  return /模擬店|屋台|フード|軽食|喫茶|カフェ/.test(`${ex.className}${ex.projectName}${ex.description}`);
}

export default function MapScreen() {
  const { loc } = useLocalSearchParams<{ loc?: string }>();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { isFavorite, toggle } = useFavorites();

  useEffect(() => {
    loadAllExhibitions()
      .catch(() => [])
      .then((list) => {
        setExhibitions(list);
        if (typeof loc === 'string' && loc.length > 0) {
          const hit = list.find((e) => loc.includes(e.id) || loc.includes(e.className));
          if (hit) setSelectedId(hit.id);
        }
      })
      .finally(() => setIsLoading(false));
  }, [loc]);

  const selected = exhibitions.find((e) => e.id === selectedId) ?? null;

  const places = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exhibitions.filter((ex) => {
      if (FLOOR_LABELS[tab] === '模擬店' && !isMogiten(ex)) return false;
      if (!q) return true;
      return (
        ex.className.toLowerCase().includes(q) ||
        ex.projectName.toLowerCase().includes(q) ||
        (ex.place ?? '').toLowerCase().includes(q)
      );
    });
  }, [exhibitions, query, tab]);

  const floor = FLOOR_LABELS[tab];

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="マップ" />
      <M3PrimaryTabs labels={[...FLOOR_LABELS]} value={tab} onValueChange={setTab} />
      <ScrollView contentContainerStyle={styles.body}>
        {floorImage[floor] ? (
          <Image source={floorImage[floor]} style={styles.mapImage} resizeMode="cover" />
        ) : (
          <View style={styles.mapPlaceholder}>
            <M3Icon name="image" size={48} color={m3.onSurfaceVariant} />
            <Text style={[m3type.titleMedium, { color: m3.onSurface, marginTop: 8 }]}>模擬店エリア</Text>
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 4 }]}>
              出店情報が確定したらマップと一覧を表示します。
            </Text>
          </View>
        )}
        {typeof loc === 'string' && loc.length > 0 && (
          <View style={styles.locBanner}>
            <Text style={[m3type.bodyMedium, { color: m3.onPrimaryContainer, textAlign: 'center' }]}>
              QR読取位置: {selected ? `${selected.className}付近` : loc}
            </Text>
          </View>
        )}
        <View style={styles.detailBox}>
          {selected ? (
            <>
              <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>
                {selected.className} {selected.projectName}
              </Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]} numberOfLines={3}>
                {selected.description || '補足テキストがここに入ります。'}
              </Text>
              <M3Touch
                onPress={() => setModalVisible(true)}
                label="詳細を開く"
                round
              >
                <Text style={[m3type.labelLarge, styles.detailLink]}>詳細を見る</Text>
              </M3Touch>
            </>
          ) : (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
              一覧から場所を選ぶとここに詳細を表示します。
            </Text>
          )}
        </View>
        <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>企画が行われている場所</Text>
        {isLoading ? (
          <ActivityIndicator color={m3.primary} />
        ) : (
          places.map((ex) => (
            <M3Touch key={ex.id} onPress={() => setSelectedId(ex.id)} label={ex.className} round>
              <View style={[styles.place, selectedId === ex.id && styles.placeActive]}>
                <Text style={[m3type.labelLarge, styles.placeBadge]}>{ex.className}</Text>
                <Text style={[m3type.bodyLarge, { color: m3.onSurface, flex: 1 }]} numberOfLines={1}>
                  {ex.projectName || '(タイトル未定)'}
                </Text>
              </View>
            </M3Touch>
          ))
        )}
        {places.length === 0 && !isLoading && (
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            {floor === '模擬店' ? '模擬店の出店情報は準備中です' : '一致する場所がありません'}
          </Text>
        )}
      </ScrollView>
      <View style={styles.searchWrap}>
        <M3SearchBar value={query} onChangeText={setQuery} placeholder="検索" />
      </View>
      <ExhibitionDetailModal
        exhibition={selected}
        visible={modalVisible}
        isFavorite={isFavorite}
        onToggleFavorite={toggle}
        onClose={() => setModalVisible(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { padding: 16, gap: 12, paddingBottom: 16 },
  mapImage: { width: 380, maxWidth: '100%', height: 380, alignSelf: 'center', borderRadius: 20, backgroundColor: m3.surfaceContainerHighest },
  mapPlaceholder: {
    width: 380,
    maxWidth: '100%',
    height: 380,
    alignSelf: 'center',
    borderRadius: 20,
    backgroundColor: m3.surfaceContainerHighest,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  locBanner: { backgroundColor: m3.primaryContainer, borderRadius: 20, padding: 12 },
  detailBox: { backgroundColor: m3.surfaceContainerHigh, borderRadius: 28, padding: 20, minHeight: 200 },
  detailLink: { color: m3.primary, marginTop: 8 },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: m3.surfaceContainerLow,
    borderRadius: 20,
    padding: 12,
  },
  placeActive: { borderWidth: 2, borderColor: m3.primary },
  placeBadge: {
    color: m3.onSecondaryContainer,
    backgroundColor: m3.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  searchWrap: { paddingHorizontal: 16, paddingBottom: 16, paddingTop: 4 },
});
