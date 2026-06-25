import React, { useState, useMemo } from 'react';
import {
  View,
  Text,
  TextInput,
  SectionList,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Modal,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from './components/Header';
import { useReservation } from '../context/ReservationContext';
import type { Exhibition } from '../utils/types';

const dayLabel: Record<string, string> = {
  saturday: '土曜日',
  sunday: '日曜日',
};

const PEOPLE_OPTIONS = [1, 2, 3, 4, 5] as const;

export default function SearchScreen() {
  const { exhibitions, isLoading, reservations, reserve, cancel, isReserved, effectiveReserved } = useReservation();
  const [query, setQuery] = useState('');
  const [selectedExhibitionId, setSelectedExhibitionId] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>({});

  const selectedExhibition = useMemo(
    () => (selectedExhibitionId ? exhibitions.find((ex) => ex.id === selectedExhibitionId) ?? null : null),
    [exhibitions, selectedExhibitionId],
  );

  const countKey = (exId: string, slotIndex: number) => `${exId}_${slotIndex}`;

  const getCount = (exId: string, slotIndex: number) =>
    selectedCounts[countKey(exId, slotIndex)] ?? 1;

  const setCount = (exId: string, slotIndex: number, count: number) =>
    setSelectedCounts((prev) => ({ ...prev, [countKey(exId, slotIndex)]: count }));

  const filteredExhibitions = useMemo(() => {
    if (!query.trim()) return exhibitions;
    const q = query.toLowerCase();
    return exhibitions.filter(
      (ex) =>
        ex.className.toLowerCase().includes(q) ||
        ex.projectName.toLowerCase().includes(q) ||
        ex.description.toLowerCase().includes(q)
    );
  }, [exhibitions, query]);

  const sections = useMemo(() => {
    const saturday = filteredExhibitions.filter((ex) => ex.day === 'saturday');
    const sunday = filteredExhibitions.filter((ex) => ex.day === 'sunday');
    return [
      { title: '土曜日', data: saturday },
      { title: '日曜日', data: sunday },
    ];
  }, [filteredExhibitions]);

  const handleReserveSlot = (exhibition: Exhibition, slotIndex: number) => {
    const count = getCount(exhibition.id, slotIndex);
    reserve(exhibition, slotIndex, count);
  };

  const handleCancelSlot = (exhibition: Exhibition, slotIndex: number) => {
    const slot = exhibition.timeSlots[slotIndex];
    Alert.alert('予約をキャンセルしますか？', `${exhibition.className} ${slot.start}〜${slot.end}`, [
      { text: '戻る', style: 'cancel' },
      {
        text: 'キャンセルする',
        style: 'destructive',
        onPress: () => cancel(exhibition.id, slotIndex),
      },
    ]);
  };

  const handleCardPress = (exhibition: Exhibition) => {
    setSelectedExhibitionId(exhibition.id);
    setModalVisible(true);
  };

  const hasAnyReservation = (exhibitionId: string) =>
    exhibitionId && reservations.some((r) => r.exhibitionId === exhibitionId);

  const renderItem = ({ item }: { item: Exhibition }) => {
    const hasReserved = hasAnyReservation(item.id);
    return (
      <TouchableOpacity
        style={[styles.card, hasReserved && styles.cardReserved]}
        onPress={() => handleCardPress(item)}
        activeOpacity={0.7}
      >
        <View style={styles.cardHeader}>
          <View style={styles.badgeContainer}>
            <Text style={styles.badge}>{dayLabel[item.day]}</Text>
          </View>
          <Text style={styles.className}>{item.className}</Text>
          {hasReserved && <Text style={styles.reservedBadge}>✓ 予約済</Text>}
        </View>
        <Text style={styles.projectName}>{item.projectName}</Text>
        <Text style={styles.description} numberOfLines={2}>
          {item.description}
        </Text>
        <View style={styles.cardFooter}>
          <Text style={styles.timeText}>
            {item.timeSlots.length} 枠
          </Text>
          <Text style={styles.capacityText}>
            {item.timeSlots.filter((s, i) => effectiveReserved(item, i) < s.capacity).length} 枠空き
          </Text>
        </View>
      </TouchableOpacity>
    );
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="検索" />
        <View style={styles.centering}>
          <ActivityIndicator size="large" color="#333333" />
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
          <TouchableOpacity
            style={styles.clearButton}
            onPress={() => setQuery('')}
          >
            <Text style={styles.clearButtonText}>✕</Text>
          </TouchableOpacity>
        )}
      </View>

      <View style={styles.resultInfo}>
        <Text style={styles.resultCount}>
          {query.trim() ? `検索結果: ${filteredExhibitions.length}件` : `全 ${filteredExhibitions.length} 件の企画`}
        </Text>
      </View>

      <SectionList
        sections={sections}
        keyExtractor={(item) => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) => (
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionHeaderText}>{section.title}</Text>
          </View>
        )}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>
              {query.trim() ? '一致する企画が見つかりません' : '企画データがありません'}
            </Text>
          </View>
        }
      />

      <Modal
        visible={modalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => { setModalVisible(false); setSelectedExhibitionId(null); }}
      >
        {selectedExhibition && (
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>企画詳細</Text>
                <TouchableOpacity onPress={() => { setModalVisible(false); setSelectedExhibitionId(null); }}>
                  <Text style={styles.modalClose}>✕</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.modalBody}>
                <View style={styles.modalBadgeRow}>
                  <View style={styles.badgeContainer}>
                    <Text style={styles.badge}>{dayLabel[selectedExhibition.day]}</Text>
                  </View>
                  <Text style={styles.modalClassName}>{selectedExhibition.className}</Text>
                </View>

                <Text style={styles.modalProjectName}>
                  {selectedExhibition.projectName}
                </Text>

                <Text style={styles.modalDescription}>
                  {selectedExhibition.description}
                </Text>

                <View style={styles.modalDivider} />

                <Text style={styles.modalSectionLabel}>時間枠を選んで予約</Text>
                {selectedExhibition.timeSlots.map((slot, i) => {
                  const exId = selectedExhibition.id;
                  const reserved = isReserved(exId, i);
                  const effective = effectiveReserved(selectedExhibition, i);
                  const remaining = slot.capacity - effective;
                  const full = remaining <= 0;

                  if (reserved) {
                    const record = reservations.find(
                      (r) => r.exhibitionId === exId && r.slotIndex === i
                    );
                    return (
                      <View key={i} style={[styles.slotRow, styles.slotRowReserved]}>
                        <View style={styles.slotInfo}>
                          <Text style={styles.slotTime}>
                            🕐 {slot.start} 〜 {slot.end}
                          </Text>
                          <Text style={[styles.slotAvailability, styles.slotReservedText]}>
                            ✅ 予約済 ({record?.peopleCount ?? 1}人)
                          </Text>
                        </View>
                        <TouchableOpacity onPress={() => handleCancelSlot(selectedExhibition, i)}>
                          <Text style={styles.slotCancelButton}>取消</Text>
                        </TouchableOpacity>
                      </View>
                    );
                  }

                  if (full) {
                    return (
                      <View key={i} style={styles.slotRow}>
                        <View style={styles.slotInfo}>
                          <Text style={styles.slotTime}>
                            🕐 {slot.start} 〜 {slot.end}
                          </Text>
                          <Text style={[styles.slotAvailability, styles.slotFull]}>満員</Text>
                        </View>
                      </View>
                    );
                  }

                  const currentCount = getCount(exId, i);

                  return (
                    <View key={i} style={styles.slotRow}>
                      <View style={styles.slotInfo}>
                        <Text style={styles.slotTime}>
                          🕐 {slot.start} 〜 {slot.end}
                        </Text>
                        <Text style={styles.slotAvailability}>
                          残り {remaining}/{slot.capacity}
                        </Text>
                        <View style={styles.peopleRow}>
                          <Text style={styles.peopleLabel}>人数: </Text>
                          {PEOPLE_OPTIONS.map((n) => (
                            <TouchableOpacity
                              key={n}
                              style={[
                                styles.peopleButton,
                                currentCount === n && styles.peopleButtonActive,
                              ]}
                              onPress={() => setCount(exId, i, n)}
                            >
                              <Text
                                style={[
                                  styles.peopleButtonText,
                                  currentCount === n && styles.peopleButtonTextActive,
                                ]}
                              >
                                {n}
                              </Text>
                            </TouchableOpacity>
                          ))}
                        </View>
                      </View>
                      <TouchableOpacity
                        style={styles.slotReserveButton}
                        onPress={() => handleReserveSlot(selectedExhibition, i)}
                      >
                        <Text style={styles.slotReserveButtonText}>予約</Text>
                      </TouchableOpacity>
                    </View>
                  );
                })}
              </View>
            </View>
          </View>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  centering: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    margin: 12,
    backgroundColor: '#ffffff',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
    paddingHorizontal: 12,
    height: 44,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#333333',
    padding: 0,
  },
  clearButton: {
    paddingLeft: 8,
  },
  clearButtonText: {
    fontSize: 16,
    color: '#999999',
  },
  resultInfo: {
    paddingHorizontal: 16,
    paddingBottom: 8,
  },
  resultCount: {
    fontSize: 13,
    color: '#888888',
  },
  list: {
    paddingHorizontal: 12,
    paddingBottom: 20,
  },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  cardReserved: {
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  badgeContainer: {
    marginRight: 8,
  },
  badge: {
    fontSize: 11,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#208AEF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
  },
  className: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#333333',
    flex: 1,
  },
  reservedBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#208AEF',
  },
  projectName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 8,
  },
  cardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  timeText: {
    fontSize: 12,
    color: '#888888',
  },
  capacityText: {
    fontSize: 12,
    color: '#888888',
  },
  emptyContainer: {
    paddingTop: 60,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: 16,
    color: '#999999',
  },
  sectionHeader: {
    paddingVertical: 8,
    paddingHorizontal: 4,
    marginTop: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#208AEF',
  },
  sectionHeaderText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#208AEF',
  },
  modalOverlay: {
    flex: 1,
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  modalContent: {
    backgroundColor: '#ffffff',
    borderRadius: 16,
    margin: 24,
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  modalTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalClose: {
    fontSize: 20,
    color: '#666666',
  },
  modalBody: {
    padding: 16,
  },
  modalBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  modalClassName: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#333333',
  },
  modalProjectName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 8,
  },
  modalDescription: {
    fontSize: 15,
    color: '#666666',
    lineHeight: 22,
  },
  modalDivider: {
    height: 1,
    backgroundColor: '#e0e0e0',
    marginVertical: 12,
  },
  modalSectionLabel: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#333333',
    marginBottom: 10,
  },
  slotRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#f8f8f8',
    borderRadius: 10,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  slotRowReserved: {
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
    backgroundColor: '#f0f6ff',
  },
  slotInfo: {
    flex: 1,
  },
  slotTime: {
    fontSize: 15,
    fontWeight: '600',
    color: '#333333',
    marginBottom: 2,
  },
  slotAvailability: {
    fontSize: 13,
    color: '#666666',
    marginBottom: 6,
  },
  slotReservedText: {
    color: '#208AEF',
    fontWeight: '600',
  },
  slotFull: {
    color: '#e74c3c',
    fontWeight: '600',
  },
  peopleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  peopleLabel: {
    fontSize: 13,
    color: '#666666',
    marginRight: 4,
  },
  peopleButton: {
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ccc',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 6,
    backgroundColor: '#ffffff',
  },
  peopleButtonActive: {
    backgroundColor: '#208AEF',
    borderColor: '#208AEF',
  },
  peopleButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333333',
  },
  peopleButtonTextActive: {
    color: '#ffffff',
  },
  slotReserveButton: {
    backgroundColor: '#208AEF',
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 12,
  },
  slotReserveButtonText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#ffffff',
  },
  slotCancelButton: {
    fontSize: 14,
    fontWeight: 'bold',
    color: '#e74c3c',
    paddingVertical: 10,
    paddingHorizontal: 8,
  },
});
