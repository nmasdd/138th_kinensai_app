import React from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import type { Exhibition } from '../data/exhibitions';
import { M3Button, M3Divider, M3Icon, M3ImagePlaceholder, M3Touch, m3scrim } from './m3';
import { FadeOverlay, Pop } from './anim';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';

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
  /** 検索などから「マップを開く」ボタンを表示するか */
  showMapButton?: boolean;
}

export default function ExhibitionDetailModal({
  exhibition,
  visible,
  isFavorite,
  onToggleFavorite,
  onClose,
  showMapButton = false,
}: Props) {
  const { type } = useM3();
  const styles = useStyles();
  const fav = exhibition ? isFavorite(exhibition.id) : false;
  const openInMap = () => {
    if (!exhibition) return;
    onClose();
    router.push({ pathname: '/map', params: { focus: exhibition.id } } as never);
  };
  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      {exhibition && (
        <FadeOverlay style={styles.overlay}>
          <Pop style={styles.content}>
            <View style={styles.header}>
              <Text style={[type.titleLarge, { color: m3.onSurface }]} accessibilityRole="header">
                企画詳細
              </Text>
              <M3Touch onPress={onClose} label="詳細を閉じる" round style={styles.closeTouch}>
                <M3Icon name="close" size={24} color={m3.onSurfaceVariant} />
              </M3Touch>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              <M3ImagePlaceholder height={140} />
              <Text style={[type.headlineSmall, { color: m3.onSurface, marginTop: 12 }]}>{exhibition.className}</Text>
              <Text style={[type.titleMedium, { color: m3.onSurface }]}>{exhibition.projectName || '(タイトル未定)'}</Text>
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 4 }]}>
                {exhibition.description || '(説明準備中)'}
              </Text>
              <M3Divider style={styles.divider} />
              <Text style={[type.bodyMedium, { color: m3.onSurface }]}>{ticketLabel(exhibition)}</Text>
              {exhibition.place && (
                <Text style={[type.bodyMedium, { color: m3.onSurface }]}>場所: {exhibition.place}</Text>
              )}
              <View style={styles.favWrap}>
                {showMapButton ? (
                  <M3Button label="マップを開く" icon="map" variant="outlined" onPress={openInMap} />
                ) : null}
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

function createStyles(s: number) {
  return StyleSheet.create({
    overlay: { flex: 1, justifyContent: 'center', backgroundColor: m3scrim },
    content: {
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: scaled(28, s),
      margin: scaled(24, s),
      padding: scaled(20, s),
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      marginBottom: scaled(12, s),
    },
    closeTouch: {
      width: scaled(44, s),
      height: scaled(44, s),
      justifyContent: 'center',
      alignItems: 'center',
    },
    divider: { marginVertical: scaled(12, s) },
    favWrap: { marginTop: scaled(12, s), gap: scaled(8, s) },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
