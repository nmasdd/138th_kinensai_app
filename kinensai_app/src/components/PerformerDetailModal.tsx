import React from 'react';
import { Image, Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import type { StageGroup } from '../data/stage';
import { M3Divider, M3Icon, M3Touch, m3scrim } from './m3';
import { FadeOverlay, Pop } from './anim';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';

interface Props {
  group: StageGroup | null;
  visible: boolean;
  onClose: () => void;
  /** モーダル見出し。「ステージ出演団体」「講堂出演団体」など。 */
  title?: string;
}

/** 出演団体の詳細モーダル。写真 (なければプレースホルダ) と紹介文を表示する。 */
export default function PerformerDetailModal({ group, visible, onClose, title = '出演団体' }: Props) {
  const { type } = useM3();
  const styles = useStyles();
  return (
    <Modal visible={visible} animationType="none" transparent onRequestClose={onClose}>
      {group && (
        <FadeOverlay style={styles.overlay}>
          <Pop style={styles.content}>
            <View style={styles.header}>
              <Text style={[type.titleLarge, { color: m3.onSurface }]} accessibilityRole="header">
                {title}
              </Text>
              <M3Touch onPress={onClose} label="詳細を閉じる" round style={styles.closeTouch}>
                <M3Icon name="close" size={24} color={m3.onSurfaceVariant} />
              </M3Touch>
            </View>
            <ScrollView showsVerticalScrollIndicator={false}>
              {group.imageUri ? (
                <Image source={{ uri: group.imageUri }} style={styles.photo} resizeMode="cover" />
              ) : (
                <View style={styles.photoEmpty}>
                  <M3Icon name="groups" size={40} color={m3.onSurfaceVariant} />
                </View>
              )}
              <View style={styles.titleRow}>
                <Text style={[type.headlineSmall, styles.name]}>{group.name}</Text>
                {group.genre ? (
                  <View style={styles.genreChip}>
                    <Text style={[type.labelMedium, { color: m3.onSecondaryContainer }]}>{group.genre}</Text>
                  </View>
                ) : null}
              </View>
              {group.detail ? (
                <Text style={[type.bodyLarge, { color: m3.onSurfaceVariant }]}>{group.detail}</Text>
              ) : null}
              <M3Divider style={styles.divider} />
              <Text style={[type.bodyMedium, { color: m3.onSurface }]}>
                {group.intro || group.detail || '紹介文は準備中です。'}
              </Text>
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
    photo: {
      width: '100%',
      height: scaled(180, s),
      borderRadius: scaled(16, s),
      backgroundColor: m3.surfaceContainerHighest,
    },
    photoEmpty: {
      width: '100%',
      height: scaled(180, s),
      borderRadius: scaled(16, s),
      backgroundColor: m3.surfaceContainerHighest,
      borderWidth: 1,
      borderColor: m3.outlineVariant,
      justifyContent: 'center',
      alignItems: 'center',
    },
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(8, s),
      marginTop: scaled(12, s),
    },
    name: { color: m3.onSurface, flexShrink: 1 },
    genreChip: {
      backgroundColor: m3.secondaryContainer,
      borderRadius: 999,
      paddingHorizontal: scaled(10, s),
      paddingVertical: scaled(4, s),
    },
    divider: { marginVertical: scaled(12, s) },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
