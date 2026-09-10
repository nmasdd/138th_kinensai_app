import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { Exhibition } from '../data/exhibitions';
import { M3Button, M3Divider, M3Icon, M3ImagePlaceholder, M3Touch, m3scrim } from './m3';
import { FadeOverlay, Pop } from './anim';
import { m3, m3layout, m3shape, m3type } from '../theme';

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
  const fav = exhibition ? isFavorite(exhibition.id) : false;
  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      {exhibition && (
        <FadeOverlay style={styles.overlay}>
          <Pop style={styles.content}>
            <View style={styles.header}>
              <Text style={[m3type.titleLarge, { color: m3.onSurface }]} accessibilityRole="header">
                企画詳細
              </Text>
              <M3Touch onPress={onClose} label="詳細を閉じる" round style={styles.closeTouch}>
                <M3Icon name="close" size={24} color={m3.onSurfaceVariant} />
              </M3Touch>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <M3ImagePlaceholder height={140} />
              <Text style={[m3type.headlineSmall, { color: m3.onSurface, marginTop: 12 }]}>{exhibition.className}</Text>
              <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>{exhibition.projectName || '(タイトル未定)'}</Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]}>
                {exhibition.description || '(説明準備中)'}
              </Text>
              <M3Divider style={styles.divider} />
              <Text style={[m3type.bodyMedium, { color: m3.onSurface }]}>{ticketLabel(exhibition)}</Text>
              {exhibition.place && (
                <Text style={[m3type.bodyMedium, { color: m3.onSurface }]}>場所: {exhibition.place}</Text>
              )}
              <View style={styles.favWrap}>
                <M3Button
                  label={fav ? 'お気に入り解除' : 'お気に入り登録'}
                  icon={fav ? 'star' : 'star-border'}
                  variant={fav ? 'tonal' : 'filled'}
                  onPress={() => onToggleFavorite(exhibition.id)}
                />
              </View>
            </ScrollView>
          </Pop>
        </FadeOverlay>
      )}
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, justifyContent: 'center', backgroundColor: m3scrim },
  content: {
    backgroundColor: m3.surfaceContainerLow,
    borderRadius: m3shape.dialog,
    margin: 24,
    padding: 20,
    maxHeight: '85%',
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  closeTouch: {
    width: m3layout.touchMin,
    height: m3layout.touchMin,
    justifyContent: 'center',
    alignItems: 'center',
  },
  divider: { marginVertical: 12 },
  favWrap: { marginTop: 12 },
});
