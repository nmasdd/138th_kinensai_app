import React, { useMemo } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Header from './components/Header';
import { useReservation } from '../context/ReservationContext';
import type { ReservationRecord } from '../context/ReservationContext';
import type { Exhibition } from '../utils/types';

export default function ReservationScreen() {
  const {
    exhibitions,
    reservations,
    cancel,
  } = useReservation();

  const reservationDetails = useMemo(() => {
    return reservations.map((record: ReservationRecord) => {
      const exhibition = exhibitions.find((ex: Exhibition) => ex.id === record.exhibitionId);
      const slot = exhibition?.timeSlots[record.slotIndex];
      return {
        ...record,
        slot: slot || null,
        description: exhibition?.description || '',
      };
    });
  }, [reservations, exhibitions]);

  const handleCancel = (record: ReservationRecord & { slot: { start: string; end: string } | null }) => {
    const timeLabel = record.slot ? `${record.slot.start}〜${record.slot.end}` : '';
    Alert.alert(
      '予約をキャンセルしますか？',
      `${record.day} - ${record.className}「${record.projectName}」${timeLabel ? `\n${timeLabel}` : ''}\n${record.peopleCount}人`,
      [
        { text: '戻る', style: 'cancel' },
        {
          text: 'キャンセルする',
          style: 'destructive',
          onPress: () => cancel(record.exhibitionId, record.slotIndex),
        },
      ]
    );
  };

  const formatDateTime = (iso: string) => {
    const d = new Date(iso);
    const month = d.getMonth() + 1;
    const day = d.getDate();
    const hour = String(d.getHours()).padStart(2, '0');
    const minute = String(d.getMinutes()).padStart(2, '0');
    return `${month}/${day} ${hour}:${minute}`;
  };

  const renderItem = ({ item }: { item: ReservationRecord & { slot: { start: string; end: string } | null; description: string } }) => (
    <View style={styles.card}>
      <View style={styles.cardHeader}>
        <Text style={styles.dayBadge}>{item.day}</Text>
        <Text style={styles.className}>{item.className}</Text>
      </View>

      <Text style={styles.projectName}>{item.projectName}</Text>

      {item.description ? (
        <Text style={styles.description} numberOfLines={2}>{item.description}</Text>
      ) : null}

      {item.slot && (
        <Text style={styles.timeText}>
          🕐 {item.slot.start} 〜 {item.slot.end}
        </Text>
      )}

      <Text style={styles.peopleCountText}>👤 {item.peopleCount}人</Text>

      <Text style={styles.reservedAt}>予約日時: {formatDateTime(item.reservedAt)}</Text>

      <TouchableOpacity
        style={styles.cancelButton}
        onPress={() => handleCancel(item)}
      >
        <Text style={styles.cancelButtonText}>予約をキャンセル</Text>
      </TouchableOpacity>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      <Header title="予約一覧" />

      <View style={styles.listHeader}>
        <Text style={styles.listHeaderText}>
          予約中の企画: {reservations.length}件
        </Text>
      </View>

      <FlatList
        data={reservationDetails}
        keyExtractor={(item) => `${item.exhibitionId}_${item.slotIndex}`}
        renderItem={renderItem}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <Text style={styles.emptyText}>まだ予約がありません</Text>
            <Text style={styles.emptySubtext}>
              検索画面から企画を予約できます
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  listHeader: {
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  listHeaderText: {
    fontSize: 14,
    color: '#666666',
    fontWeight: '500',
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
    borderLeftWidth: 4,
    borderLeftColor: '#208AEF',
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  dayBadge: {
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: '#208AEF',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 4,
    overflow: 'hidden',
    marginRight: 8,
  },
  className: {
    fontSize: 17,
    fontWeight: 'bold',
    color: '#333333',
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
    marginBottom: 6,
  },
  timeText: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 4,
  },
  peopleCountText: {
    fontSize: 13,
    color: '#555555',
    marginBottom: 6,
  },
  reservedAt: {
    fontSize: 12,
    color: '#999999',
    marginBottom: 12,
  },
  cancelButton: {
    backgroundColor: '#f8f8f8',
    borderRadius: 8,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#e74c3c',
  },
  cancelButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#e74c3c',
  },
  emptyContainer: {
    paddingTop: 80,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 48,
    marginBottom: 12,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#666666',
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: '#999999',
  },
});
