import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams } from 'expo-router';
import Header from '../components/Header';
import ExhibitionDetailModal from '../components/ExhibitionDetailModal';
import { loadAllExhibitions, type Exhibition } from '../data/exhibitions';
import { useFavorites } from '../data/favorites';
import { theme } from '../theme';

const FLOORS = ['1階', '2階', '3階', '4.5階', '全図'] as const;

type Floor = (typeof FLOORS)[number];

const floorImage: Partial<Record<Floor, number>> = {
  '1階': require('../../assets/maps/f1.jpg'),
  '2階': require('../../assets/maps/f2.jpg'),
  '3階': require('../../assets/maps/f3.jpg'),
  '4.5階': require('../../assets/maps/f45.jpg'),
};
export default function MapScreen() {
  const { loc } = useLocalSearchParams<{ loc?: string }>();
  const [floor, setFloor] = useState<(typeof FLOORS)[number]>('1階');
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

  const openDetail = (id: string) => {
    setSelectedId(id);
    setModalVisible(true);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="マップ" />
      <View style={styles.tabs}>
        {FLOORS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.tab, floor === f && styles.tabActive]}
            onPress={() => setFloor(f)}
          >
            <Text style={[styles.tabText, floor === f && styles.tabTextActive]}>{f}</Text>
          </TouchableOpacity>
        ))}
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {floorImage[floor] ? (
          <Image source={floorImage[floor]} style={styles.mapImage} resizeMode="contain" />
        ) : (
          <View style={styles.mapPlaceholder}>
            <Text style={styles.mapTitle}>全図のマップ</Text>
            <Text style={styles.mapNote}>全図の画像は準備中です (PDFのみ)。JPGが用意できたら追加します。</Text>
          </View>
        )}
        <Text style={styles.mapCaption}>{floor}のマップ (パンフレット由来のため余白あり)</Text>
        {typeof loc === 'string' && loc.length > 0 && (
          <View style={styles.locBanner}>
            <Text style={styles.locText}>
              📍 QR読取位置: {selected ? `${selected.className}付近` : loc}
            </Text>
          </View>
        )}
        <Text style={styles.sectionTitle}>企画が行われている場所</Text>
        {isLoading ? (
          <ActivityIndicator color={theme.primary} />
        ) : (
          exhibitions.map((ex) => (
            <TouchableOpacity
              key={ex.id}
              style={[styles.place, selectedId === ex.id && styles.placeActive]}
              onPress={() => openDetail(ex.id)}
            >
              <Text style={styles.placeClass}>{ex.className}</Text>
              <Text style={styles.placeName}>{ex.projectName || '(タイトル未定)'}</Text>
            </TouchableOpacity>
          ))
        )}
        <ExhibitionDetailModal
          exhibition={selected}
          visible={modalVisible}
          isFavorite={isFavorite}
          onToggleFavorite={toggle}
          onClose={() => setModalVisible(false)}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  tabs: { flexDirection: 'row', padding: 12, gap: 8 },
  tab: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: theme.border,
    alignItems: 'center',
  },
  tabActive: { backgroundColor: theme.primary, borderColor: theme.primary },
  tabText: { fontSize: 13, fontWeight: '600', color: theme.text },
  tabTextActive: { color: '#ffffff' },
  body: { padding: 16, paddingTop: 0 },
  mapPlaceholder: {
    backgroundColor: theme.surfaceAlt,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 24,
    alignItems: 'center',
    marginBottom: 16,
  },
  mapTitle: { fontSize: 18, fontWeight: 'bold', color: theme.ink, marginBottom: 6 },
  mapNote: { fontSize: 13, color: theme.muted, textAlign: 'center', lineHeight: 18 },
  mapImage: { width: '100%', height: 320, borderRadius: 14, backgroundColor: theme.surfaceAlt },
  mapCaption: { fontSize: 12, color: theme.muted, textAlign: 'center', marginTop: 6, marginBottom: 12 },
  locBanner: {
    backgroundColor: theme.primary,
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
  },
  locText: { fontSize: 14, fontWeight: 'bold', color: '#ffffff', textAlign: 'center' },
  sectionTitle: { fontSize: 15, fontWeight: 'bold', color: theme.ink, marginBottom: 8 },
  place: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    marginBottom: 8,
  },
  placeActive: { borderColor: theme.primary, borderWidth: 2 },
  placeClass: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: theme.primary,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 20,
    overflow: 'hidden',
  },
  placeName: { fontSize: 14, color: theme.text, flex: 1 },
  detail: {
    marginTop: 8,
    backgroundColor: '#ffffff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: theme.border,
    borderLeftWidth: 5,
    borderLeftColor: theme.primary,
    padding: 14,
  },
  detailTitle: { fontSize: 15, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  detailBody: { fontSize: 13, color: '#666666' },
  detailNote: { fontSize: 12, color: theme.muted, marginTop: 6 },
});
