import React, { useCallback, useMemo, useRef, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import { M3EmptyState, M3Icon, M3LoadingView, M3PrimaryTabs, M3SearchBar, M3Touch, TopAppBar } from '../../components/m3';
import { Rise, ScreenFade, Stagger } from '../../components/anim';
import { useContentEffect } from '../../context/useContentRefreshKey';
import { VectorMapView } from '../../components/VectorMapView';
import ExhibitionDetailModal from '../../components/ExhibitionDetailModal';
import { loadAllExhibitions, type Exhibition } from '../../data/exhibitions';
import { useFavorites } from '../../data/favorites';
import { hotspotForExhibitionId } from '../../data/mapHotspots';
import { VECTOR_FLOORS, type VectorFloor } from '../../data/vectorMap';
import { loadMapLayout, type MapLayoutOverrides } from '../../data/mapLayout';
import { useM3 } from '../../context/responsive';
import { m3, scaled, type M3Shape } from '../../theme';

const FLOOR_LABELS = VECTOR_FLOORS;

function firstParam(v?: string | string[]): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}

/** "1"〜"5"/"1F" などの階指定を FLOOR_LABELS の index に変換する (4・5 は 4階5階) */
function floorParamToIndex(v?: string): number {
  if (!v) return -1;
  const m = v.normalize('NFKC').match(/[1-5]/);
  if (!m) return -1;
  const n = parseInt(m[0], 10);
  return n <= 1 ? 0 : n === 2 ? 1 : n === 3 ? 2 : 3;
}

/**
 * クラス名トークンからフロア番号を求める。
 * 高校: 1A〜1D→2階 / 1E〜1J→1階 / 2A〜2J→3階
 * 中学 (J prefix, カタログID形式): 3A〜3E→2階 / 3F〜3I→1階 / 2A〜2I→3階 / 1A〜1I→4階5階
 */
function classTokenToFloorIndex(token: string): number {
  const base = token.normalize('NFKC').trim().toUpperCase().replace(/\s+/g, '').split('-')[0];
  const hs = /^([12])([A-J])$/.exec(base);
  if (hs) {
    if (hs[1] === '1') return hs[2] <= 'D' ? 1 : 0;
    return 2;
  }
  const js = /^J?([123])([A-I])$/.exec(base);
  if (js) {
    if (js[1] === '3') return js[2] <= 'E' ? 1 : 0;
    if (js[1] === '2') return 2;
    return 3;
  }
  return -1;
}

function floorIndexForExhibition(ex: Exhibition): number {
  const hit = hotspotForExhibitionId(ex.id);
  if (hit) return FLOOR_LABELS.indexOf(hit.floor as VectorFloor);
  const fromClass = classTokenToFloorIndex(ex.className);
  if (fromClass >= 0) return fromClass;
  const place = `${ex.place ?? ''}`.normalize('NFKC');
  // 中庭・ステージ・食堂・事務室前などは1階構内、講堂・明照殿・視聴覚室は図上対象外のため場所文言で推定
  if (/4階|高校音楽|高校美術/.test(place)) return 3;
  if (/3階|301|工作|美術/.test(place)) return 2;
  if (/2階|職員室|スタディ|多目的|面談|技術|会議|英語|20[1-5]|補助教室|大回廊/.test(place)) return 1;
  if (/1階|事務|放送|家庭科|食堂|ステージ|生徒会|中庭|模擬店|屋台|ピロティ|フード|軽食|喫茶|カフェ/.test(place)) return 0;
  return classTokenToFloorIndex(ex.id);
}

export default function MapScreen() {
  const { type } = useM3();
  const styles = useStyles();
  const { loc, focus, floor: floorParam, x: xParam, y: yParam } = useLocalSearchParams<{
    loc?: string;
    focus?: string;
    floor?: string;
    x?: string;
    y?: string;
  }>();
  const [tab, setTab] = useState(0);
  const [query, setQuery] = useState('');
  const [exhibitions, setExhibitions] = useState<Exhibition[]>([]);
  const [mapLayout, setMapLayout] = useState<MapLayoutOverrides>({});
  const [isLoading, setIsLoading] = useState(true);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const { isFavorite, toggle } = useFavorites();
  const scrollRef = useRef<ScrollView>(null);
  const appliedFloorRef = useRef<string | null>(null);

  const floorParamRaw = firstParam(floorParam);
  const floorIndexFromParam = floorParamToIndex(floorParamRaw);

  // 現在地 (URL の x,y)。0〜1 は相対座標、1より大きい値は 1000x700 の
  // ワールド座標として扱い、VectorMapView へは相対座標で渡す。
  const selfRel = useMemo(() => {
    const x = parseFloat(firstParam(xParam) ?? '');
    const y = parseFloat(firstParam(yParam) ?? '');
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    const rx = x >= 0 && x <= 1 ? x : x / 1000;
    const ry = y >= 0 && y <= 1 ? y : y / 700;
    if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return null;
    return { x: rx, y: ry };
  }, [xParam, yParam]);

  useContentEffect(() => {
    let cancelled = false;
    // URL で階が指定されていれば、その階へ切り替える (手動切替は尊重)
    if (floorIndexFromParam >= 0 && appliedFloorRef.current !== floorParamRaw) {
      appliedFloorRef.current = floorParamRaw ?? null;
      setTab(floorIndexFromParam);
    }
    loadMapLayout()
      .then((layout) => {
        if (!cancelled) setMapLayout(layout);
      })
      .catch(() => {});
    loadAllExhibitions()
      .catch(() => [])
      .then((list) => {
        if (cancelled) return;
        setExhibitions(list);
        // 検索の詳細「マップを開く」: 指定企画を選択し、その階へ切り替える
        const focusId = typeof focus === 'string' && focus.length > 0 ? focus : null;
        if (focusId) {
          const hit = list.find((e) => e.id === focusId);
          if (hit) {
            setSelectedId(hit.id);
            const idx = floorIndexForExhibition(hit);
            if (idx >= 0) setTab(idx);
          }
        } else if (typeof loc === 'string' && loc.length > 0) {
          const hit = list.find((e) => loc.includes(e.id) || loc.includes(e.className));
          if (hit) setSelectedId(hit.id);
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [loc, focus, floorIndexFromParam, floorParamRaw]);

  const selected = exhibitions.find((e) => e.id === selectedId) ?? null;

  const coLocated = useMemo(() => {
    if (!selected) return [] as Exhibition[];
    const hotspot = hotspotForExhibitionId(selected.id);
    if (!hotspot) return [];
    const ids = [hotspot.id, ...(hotspot.sharedIds ?? [])].filter((id) => id !== selected.id);
    return ids.flatMap((id) => {
      const found = exhibitions.find((e) => e.id === id);
      return found ? [found] : [];
    });
  }, [exhibitions, selected]);

  const places = useMemo(() => {
    const q = query.trim().toLowerCase();
    return exhibitions.filter((ex) => {
      if (!q) return true;
      return (
        ex.className.toLowerCase().includes(q) ||
        ex.projectName.toLowerCase().includes(q) ||
        (ex.place ?? '').toLowerCase().includes(q)
      );
    });
  }, [exhibitions, query, tab]);

  // お気に入り企画 (検索クエリで絞り込み済みの places から)
  const favoritePlaces = useMemo(() => places.filter((ex) => isFavorite(ex.id)), [places, isFavorite]);

  const floor = FLOOR_LABELS[tab];

  const selectPlace = useCallback(
    (ex: Exhibition) => {
      setSelectedId(ex.id);
      scrollRef.current?.scrollTo({ y: 0, animated: true });
      const idx = floorIndexForExhibition(ex);
      if (idx >= 0) setTab(idx);
    },
    [],
  );

  const renderPlace = (ex: Exhibition, index: number) => (
    <Stagger key={ex.id} index={index % 10}>
      <M3Touch onPress={() => selectPlace(ex)} label={`${ex.className}の詳細を地図に表示`} round>
        <View style={[styles.place, selectedId === ex.id && styles.placeActive]}>
          <Text style={[type.labelLarge, styles.placeBadge]}>{ex.className}</Text>
          <Text style={[type.bodyLarge, { color: m3.onSurface, flex: 1 }]} numberOfLines={1}>
            {ex.projectName || '(タイトル未定)'}
          </Text>
          {isFavorite(ex.id) ? <M3Icon name="star" size={18} color={m3.primary} /> : null}
          <M3Icon name="chevron-right" size={20} color={m3.onSurfaceVariant} />
        </View>
      </M3Touch>
    </Stagger>
  );

  const selectHotspot = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const locText = typeof loc === 'string' && loc.length > 0 ? loc : null;
  const locExhibition = locText ? exhibitions.find((e) => locText.includes(e.id) || locText.includes(e.className)) ?? null : null;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="マップ" />
      <M3PrimaryTabs labels={[...FLOOR_LABELS]} value={tab} onValueChange={setTab} />
      <ScrollView ref={scrollRef} contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ScreenFade key={floor}>
          <VectorMapView
            floor={floor}
            selectedId={selectedId}
            locId={locExhibition?.id ?? locText}
            selfPos={selfRel && (floorIndexFromParam < 0 || floorIndexFromParam === tab) ? selfRel : null}
            roomsOverride={mapLayout[floor]}
            onSelect={selectHotspot}
          />
        </ScreenFade>
        <Text style={[type.bodyMedium, styles.hint]} accessibilityLiveRegion="polite">
          ドラッグで移動・ピンチ/ホイール/＋−で拡大縮小・部屋タップで詳細表示
        </Text>
        {locText && (
          <Rise>
            <View style={styles.locBanner} accessibilityLiveRegion="polite">
              <Text style={[type.bodyMedium, { color: m3.onPrimaryContainer, textAlign: 'center' }]}>
                QR読取位置: {selected ? `${selected.className}付近` : locText}
              </Text>
            </View>
          </Rise>
        )}
        {selfRel && (
          <Rise>
            <View style={[styles.locBanner, styles.selfBanner]} accessibilityLiveRegion="polite">
              <M3Icon name="my-location" size={16} color={m3.onPrimaryContainer} />
              <Text style={[type.bodyMedium, { color: m3.onPrimaryContainer }]}>
                現在地: {FLOOR_LABELS[floorIndexFromParam >= 0 ? floorIndexFromParam : tab]} 付近
              </Text>
            </View>
          </Rise>
        )}
        <Rise delay={40}>
          <View style={styles.detailBox}>
          {selected ? (
            <>
              <Text style={[type.titleMedium, { color: m3.onSurface }]}>
                {selected.className} {selected.projectName}
              </Text>
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]} numberOfLines={3}>
                {selected.description || '補足テキストがここに入ります。'}
              </Text>
              {coLocated.map((ex) => (
                <M3Touch key={ex.id} onPress={() => setSelectedId(ex.id)} label={`同じ教室の企画 ${ex.className} を表示`} round>
                  <Text style={[type.labelLarge, styles.coLocatedLink]} numberOfLines={1}>
                    同じ教室の企画: {ex.className} {ex.projectName || '(タイトル未定)'}
                  </Text>
                </M3Touch>
              ))}
              <M3Touch onPress={() => setModalVisible(true)} label="詳細を開く" round>
                <Text style={[type.labelLarge, styles.detailLink]}>詳細を見る</Text>
              </M3Touch>
            </>
          ) : (
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>一覧から場所を選ぶとここに詳細を表示します。</Text>
          )}
          </View>
        </Rise>
        <Rise delay={60}>
          <Text style={[type.titleSmall, { color: m3.onSurface }]} accessibilityRole="header">
            お気に入り企画
          </Text>
        </Rise>
        {isLoading ? null : favoritePlaces.length === 0 ? (
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            お気に入りに登録した企画がここに表示されます
          </Text>
        ) : (
          favoritePlaces.map((ex, index) => renderPlace(ex, index))
        )}

        <Rise delay={60}>
          <Text style={[type.titleSmall, { color: m3.onSurface }]} accessibilityRole="header">
            企画一覧
          </Text>
        </Rise>
        {isLoading ? <M3LoadingView /> : places.map((ex, index) => renderPlace(ex, index))}
        {places.length === 0 && !isLoading && (
          <M3EmptyState icon="map">
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
              一致する企画がありません
            </Text>
          </M3EmptyState>
        )}
      </ScrollView>
      <View style={styles.searchWrap}>
        <M3SearchBar value={query} onChangeText={setQuery} placeholder="場所・企画名で検索" />
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

function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    body: { padding: scaled(16, s), gap: scaled(12, s), paddingBottom: scaled(16, s) },
    hint: { color: m3.onSurfaceVariant, textAlign: 'center' },
    coLocatedLink: { color: m3.primary, marginTop: scaled(8, s) },
    locBanner: { backgroundColor: m3.primaryContainer, borderRadius: shape.card, padding: scaled(12, s) },
    selfBanner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: scaled(6, s) },
    detailBox: {
      backgroundColor: m3.surfaceContainerHigh,
      borderRadius: shape.dialog,
      padding: scaled(20, s),
      minHeight: scaled(200, s),
    },
    detailLink: { color: m3.primary, marginTop: scaled(8, s) },
    place: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(12, s),
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: shape.card,
      padding: scaled(12, s),
      minHeight: scaled(44, s),
    },
    placeActive: { borderWidth: 2, borderColor: m3.primary },
    placeBadge: {
      color: m3.onSecondaryContainer,
      backgroundColor: m3.secondaryContainer,
      paddingHorizontal: scaled(12, s),
      paddingVertical: scaled(4, s),
      borderRadius: shape.pill,
      overflow: 'hidden',
    },
    searchWrap: {
      paddingHorizontal: scaled(16, s),
      paddingBottom: scaled(16, s),
      paddingTop: scaled(4, s),
    },
  });
}

function useStyles() {
  const { scale, shape } = useM3();
  return React.useMemo(() => createStyles(scale, shape), [scale, shape]);
}
