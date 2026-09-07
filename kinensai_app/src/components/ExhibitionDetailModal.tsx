import React from 'react';
import { Modal, StyleSheet, Text, View } from 'react-native';
import type { Exhibition } from '../data/exhibitions';
import { M3Button, M3ImagePlaceholder, M3Touch } from './m3';
import { m3, m3type } from '../theme';

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
              <Text style={[m3type.titleLarge, { color: m3.onSurface }]}>企画詳細</Text>
              <M3Touch onPress={onClose} label="閉じる" round>
                <Text style={styles.close}>✕</Text>
              </M3Touch>
            </View>
            <M3ImagePlaceholder height={120} />
            <Text style={[m3type.headlineSmall, { color: m3.onSurface, marginTop: 12 }]}>
              {exhibition.className}
            </Text>
            <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>
              {exhibition.projectName || '(タイトル未定)'}
            </Text>
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]}>
              {exhibition.description || '(説明準備中)'}
            </Text>
            <View style={styles.divider} />
            <Text style={[m3type.bodyMedium, { color: m3.onSurface }]}>{ticketLabel(exhibition)}</Text>
            {exhibition.place && (
              <Text style={[m3type.bodyMedium, { color: m3.onSurface }]}>場所: {exhibition.place}</Text>
            )}
            <View style={styles.favWrap}>
              <M3Button
                label={isFavorite(exhibition.id) ? 'お気に入り解除' : 'お気に入り登録'}
                icon={isFavorite(exhibition.id) ? 'star' : 'star-border'}
                variant={isFavorite(exhibition.id) ? 'tonal' : 'filled'}
                onPress={() => onToggleFavorite(exhibition.id)}
              />
            </View>
          </View>
        </View>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.4)' },
  content: { backgroundColor: m3.surfaceContainerLow, borderRadius: 28, margin: 24, padding: 20, maxHeight: '85%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  close: { fontSize: 20, color: m3.onSurfaceVariant, padding: 8 },
  divider: { height: 1, backgroundColor: m3.outlineVariant, marginVertical: 12 },
  favWrap: { marginTop: 12 },
});
