import React from 'react';
import { Image, StyleSheet, Text, TextInput, View } from 'react-native';
import { M3Button, M3Card, M3Touch } from './m3';
import { deleteStoredImage, pickImageUri } from '../data/images';
import { m3, m3type } from '../theme';

/** 整理券の状態。data層の TicketInfo.required に対応 (unknown は未設定)。 */
export type TicketState = 'unknown' | 'none' | 'required';

export function today(): string {
  const d = new Date();
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${mm}-${dd}`;
}

export function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <M3Card variant="elevated" style={adminStyles.section}>
      <Text style={[m3type.titleMedium, { color: m3.onSurface, marginBottom: 12 }]}>{title}</Text>
      {children}
    </M3Card>
  );
}

export function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={adminStyles.field}>
      <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant, marginBottom: 4 }]}>{label}</Text>
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
  return (
    <View style={adminStyles.chips}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <M3Touch key={o.value} onPress={() => onChange(o.value)} label={o.label} round>
            <View style={[adminStyles.chip, active && adminStyles.chipActive]}>
              <Text style={[m3type.labelLarge, { color: active ? m3.onPrimaryContainer : m3.onSurfaceVariant }]}>
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
      {value ? <Image source={{ uri: value }} style={adminStyles.imagePreview} resizeMode="cover" /> : null}
      <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
        Webでは画像が端末内に保存されるため、サイズが大きいと保存できない場合があります。小さめの画像を選んでください。
      </Text>
      <View style={adminStyles.buttonRow}>
        <M3Button label={value ? '画像を変更' : '画像を選ぶ'} icon="image" variant="tonal" onPress={pick} />
        {value ? <M3Button label="画像を削除" variant="outlined" onPress={remove} /> : null}
      </View>
    </View>
  );
}

export const adminStyles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  center: { flex: 1, backgroundColor: m3.surface, justifyContent: 'center', alignItems: 'center' },
  contentWrap: { flex: 1 },
  body: { padding: 16, gap: 12 },
  searchWrap: { marginBottom: 4 },
  section: { gap: 0 },
  block: { gap: 4, marginTop: 12, paddingTop: 12, borderTopWidth: 1, borderTopColor: m3.outlineVariant },
  blockHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  field: { marginBottom: 8 },
  input: {
    backgroundColor: m3.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    color: m3.onSurface,
  },
  multiline: { minHeight: 72, textAlignVertical: 'top' },
  ioBox: { minHeight: 120, textAlignVertical: 'top', fontSize: 12 },
  chips: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 999,
    backgroundColor: m3.surfaceContainerHigh,
  },
  chipActive: { backgroundColor: m3.primaryContainer },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: m3.surfaceContainerLow,
    borderRadius: 16,
    padding: 12,
    marginBottom: 8,
  },
  rowText: { flex: 1, gap: 2 },
  rowActive: { borderWidth: 1, borderColor: m3.primary },
  link: { color: m3.primary, paddingHorizontal: 8, paddingVertical: 4 },
  danger: { color: m3.error, paddingHorizontal: 8, paddingVertical: 4 },
  delayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  delayInput: {
    backgroundColor: m3.surfaceContainerHigh,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 8,
    fontSize: 15,
    color: m3.onSurface,
    width: 72,
    textAlign: 'center',
  },
  timeRow: { flexDirection: 'row', gap: 8 },
  timeField: { flex: 1 },
  imagePreview: { width: '100%', height: 160, borderRadius: 12, marginBottom: 8 },
  buttonRow: { flexDirection: 'row', gap: 8, marginTop: 8, flexWrap: 'wrap' },
  backWrap: { alignItems: 'flex-end' },
});
