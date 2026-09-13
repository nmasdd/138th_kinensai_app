import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { M3Button, M3Card, M3Touch } from './m3';
import { deleteStoredImage, pickImageUri } from '../data/images';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';

/** 整理券の状態。data層の TicketInfo.required に対応 (unknown は未設定)。 */
export type TicketState = 'unknown' | 'none' | 'required';

export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const { type } = useM3();
  const styles = useAdminStyles();
  return (
    <M3Card variant="elevated" style={styles.section}>
      <Text style={[type.titleMedium, styles.sectionTitle]}>{title}</Text>
      {children}
    </M3Card>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  const { type } = useM3();
  const styles = useAdminStyles();
  return (
    <View style={styles.field}>
      <Text style={[type.labelMedium, styles.fieldLabel]}>{label}</Text>
      {children}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { type } = useM3();
  const styles = useAdminStyles();
  return (
    <View style={styles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <M3Touch key={o.value} onPress={() => onChange(o.value)} label={o.label} round>
            <View style={[styles.chip, active && styles.chipActive]}>
              <Text style={[type.labelLarge, { color: active ? m3.onPrimaryContainer : m3.onSurfaceVariant }]}>
                {o.label}
              </Text>
            </View>
          </M3Touch>
        );
      })}
    </View>
  );
}

/** 画像の選択・削除UI。保存サイズの注意書き付き。 */
export function ImageField({
  value,
  onChange,
}: {
  value: string | null | undefined;
  onChange: (uri: string | null) => void;
}) {
  const { type } = useM3();
  const styles = useAdminStyles();
  const pick = async () => {
    try {
      const uri = await pickImageUri();
      if (!uri) return;
      if (value) await deleteStoredImage(value);
      onChange(uri);
    } catch {
      // 選択失敗は何もしない
    }
  };
  const remove = async () => {
    if (value) await deleteStoredImage(value);
    onChange(null);
  };
  return (
    <View>
      {value ? <Image source={{ uri: value }} style={styles.imagePreview} resizeMode="cover" /> : null}
      <Text style={[type.bodyMedium, styles.imageNote]}>
        Webでは画像が端末内に保存されるため、サイズが大きいと保存できない場合があります。小さめの画像を選んでください。
      </Text>
      <View style={styles.buttonRow}>
        <M3Button label={value ? '画像を変更' : '画像を選ぶ'} icon="image" variant="tonal" onPress={pick} />
        {value ? <M3Button label="画像を削除" variant="outlined" onPress={remove} /> : null}
      </View>
    </View>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    center: { flex: 1, backgroundColor: m3.surface, justifyContent: 'center', alignItems: 'center' },
    contentWrap: { flex: 1 },
    body: { padding: scaled(16, s), gap: scaled(12, s) },
    searchWrap: { marginBottom: scaled(4, s) },
    section: { gap: 0 },
    sectionTitle: { color: m3.onSurface, marginBottom: scaled(12, s) },
    block: {
      gap: scaled(4, s),
      marginTop: scaled(12, s),
      paddingTop: scaled(12, s),
      borderTopWidth: 1,
      borderTopColor: m3.outlineVariant,
    },
    blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
    field: { marginBottom: scaled(8, s) },
    fieldLabel: { color: m3.onSurfaceVariant, marginBottom: scaled(4, s) },
    input: {
      backgroundColor: m3.surfaceContainerHigh,
      borderRadius: scaled(12, s),
      paddingHorizontal: scaled(12, s),
      paddingVertical: scaled(10, s),
      fontSize: scaled(15, s),
      color: m3.onSurface,
    },
    multiline: { minHeight: scaled(72, s), textAlignVertical: 'top' },
    ioBox: { minHeight: scaled(120, s), textAlignVertical: 'top', fontSize: scaled(12, s) },
    chips: { flexDirection: 'row', gap: scaled(8, s), flexWrap: 'wrap' },
    chip: {
      paddingHorizontal: scaled(16, s),
      paddingVertical: scaled(8, s),
      borderRadius: 999,
      backgroundColor: m3.surfaceContainerHigh,
    },
    chipActive: { backgroundColor: m3.primaryContainer },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(12, s),
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: scaled(16, s),
      padding: scaled(12, s),
      marginBottom: scaled(8, s),
    },
    rowText: { flex: 1, gap: scaled(2, s) },
    rowActive: { borderWidth: 1, borderColor: m3.primary },
    link: { color: m3.primary, paddingHorizontal: scaled(8, s), paddingVertical: scaled(4, s) },
    danger: { color: m3.error, paddingHorizontal: scaled(8, s), paddingVertical: scaled(4, s) },
    delayRow: { flexDirection: 'row', alignItems: 'center', gap: scaled(8, s) },
    delayInput: {
      backgroundColor: m3.surfaceContainerHigh,
      borderRadius: scaled(12, s),
      paddingHorizontal: scaled(12, s),
      paddingVertical: scaled(8, s),
      fontSize: scaled(15, s),
      color: m3.onSurface,
      width: scaled(72, s),
      textAlign: 'center',
    },
    timeRow: { flexDirection: 'row', gap: scaled(8, s) },
    timeField: { flex: 1 },
    imagePreview: {
      width: '100%',
      height: scaled(160, s),
      borderRadius: scaled(12, s),
      marginBottom: scaled(8, s),
    },
    imageNote: { color: m3.onSurfaceVariant, marginBottom: scaled(8, s) },
    buttonRow: { flexDirection: 'row', gap: scaled(8, s), marginTop: scaled(8, s), flexWrap: 'wrap' },
    backWrap: { alignItems: 'flex-end' },
  });
}

/** 基準幅 (390px) の静的スタイル。admin 画面の既存 import との互換用。 */
export const adminStyles = createStyles(1);

/** 画面幅に応じてスケールした admin スタイル。 */
export function useAdminStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
