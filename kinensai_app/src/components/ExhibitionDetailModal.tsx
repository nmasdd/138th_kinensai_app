import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Modal } from 'react-native';
import type { Exhibition } from '../data/exhibitions';
import { theme } from '../theme';

export function ticketLabel(ex: Exhibition): string {
  if (ex.ticketRequired === 'none') return '整理券: 不要';
  if (ex.ticketRequired === 'required') return `整理券: 必要${ex.ticketTime ? ` (${ex.ticketTime})` : ''}`;
  return '整理券: 確認中';
}

interface Props {
  exhibition: Exhibition | null;
  visible: boolean;
  isFavorite: (id: string) => boolean;
  onToggleFavorite: (id: string) => void;
  onClose: () => void;
}

export default function ExhibitionDetailModal({ exhibition, visible, isFavorite, onToggleFavorite, onClose }: Props) {
  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      {exhibition && (
        <View style={styles.overlay}>
          <View style={styles.content}>
            <View style={styles.header}>
              <Text style={styles.title}>企画詳細</Text>
              <TouchableOpacity onPress={onClose}>
                <Text style={styles.close}>✕</Text>
              </TouchableOpacity>
            </View>
            <Text style={styles.className}>{exhibition.className}</Text>
            <Text style={styles.projectName}>{exhibition.projectName || '(タイトル未定)'}</Text>
            <Text style={styles.description}>{exhibition.description || '(説明準備中)'}</Text>
            <View style={styles.divider} />
            <Text style={styles.ticket}>{ticketLabel(exhibition)}</Text>
            {exhibition.place && <Text style={styles.place}>場所: {exhibition.place}</Text>}
            <TouchableOpacity style={styles.favButton} onPress={() => onToggleFavorite(exhibition.id)}>
              <Text style={styles.favButtonText}>
                {isFavorite(exhibition.id) ? '★ お気に入り解除' : '☆ お気に入り登録'}
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  content: { backgroundColor: '#ffffff', borderRadius: 16, margin: 24, padding: 16, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontSize: 18, fontWeight: 'bold', color: theme.ink },
  close: { fontSize: 20, color: '#666666' },
  className: { fontSize: 20, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  projectName: { fontSize: 18, fontWeight: '600', color: theme.text, marginBottom: 8 },
  description: { fontSize: 15, color: '#666666', lineHeight: 22 },
  divider: { height: 1, backgroundColor: theme.border, marginVertical: 12 },
  ticket: { fontSize: 14, fontWeight: 'bold', color: theme.text, marginBottom: 4 },
  place: { fontSize: 14, color: theme.text, marginBottom: 12 },
  favButton: { backgroundColor: theme.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' },
  favButtonText: { fontSize: 15, fontWeight: 'bold', color: '#ffffff' },
});
