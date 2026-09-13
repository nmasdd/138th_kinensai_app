import React, { useEffect, useState } from 'react';
import { Animated, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3LoadingView, M3PrimaryTabs, M3Touch, TopAppBar } from '../../components/m3';
import { AdminNotice, AdminSaveBar, useAdminNotice } from '../../components/AdminSaveBar';
import { Chips, Field, Section, adminStyles } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import { VectorMapView } from '../../components/VectorMapView';
import { VECTOR_FLOORS, VECTOR_ROOMS, type VectorRoom } from '../../data/vectorMap';
import { loadMapLayout, saveMapLayout, type MapLayoutOverrides } from '../../data/mapLayout';
import { m3, m3type } from '../../theme';

/**
 * 管理者用・マップ配置 (/admin/map)。
 * フロア地図で部屋を選び、ドラッグではなくタップ位置への移動・数値調整・
 * nudge で配置を編集して `map-layout.json` に保存する。
 */
const WORLD_W = 1000;
const WORLD_H = 700;
const NUDGE = 10;
const MAP_FOOTER_SPACE = 140;

const KIND_OPTIONS: { value: VectorRoom['kind']; label: string }[] = [
  { value: 'class', label: '教室' },
  { value: 'club', label: '特別教室' },
  { value: 'corridor', label: '廊下' },
  { value: 'stairs', label: '階段' },
  { value: 'elevator', label: 'EV' },
  { value: 'vending', label: '自販機' },
  { value: 'toilet', label: 'トイレ' },
  { value: 'outdoor', label: '屋外' },
  { value: 'hall', label: 'その他' },
];

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function NumField({
  label,
  value,
  min,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  onChange: (n: number) => void;
}) {
  return (
    <View style={styles.numField}>
      <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant }]}>{label}</Text>
      <TextInput
        style={adminStyles.input}
        value={String(value)}
        keyboardType="number-pad"
        onChangeText={(t) => {
          const n = parseInt(t.replace(/[^0-9-]/g, ''), 10);
          if (Number.isFinite(n)) onChange(Math.max(min, n));
        }}
        accessibilityLabel={label}
      />
    </View>
  );
}

export default function AdminMapScreen() {
  return (
    <AdminGate>
      <AdminMapContent />
    </AdminGate>
  );
}

function AdminMapContent() {
  const [tab, setTab] = useState(0);
  const [working, setWorking] = useState<Record<string, VectorRoom[]>>(() => {
    const init: Record<string, VectorRoom[]> = {};
    for (const f of VECTOR_FLOORS) init[f] = VECTOR_ROOMS[f] ?? [];
    return init;
  });
  const [overridden, setOverridden] = useState<Set<string>>(() => new Set());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [blinkAnim] = useState(() => new Animated.Value(1));
  const { notice, showOk, showErr } = useAdminNotice();

  const floor = VECTOR_FLOORS[tab];
  const rooms = working[floor] ?? [];
  const selected = rooms.find((r) => r.id === selectedId) ?? null;

  useEffect(() => {
    let cancelled = false;
    loadMapLayout()
      .then((ov) => {
        if (cancelled) return;
        const next: Record<string, VectorRoom[]> = {};
        for (const f of VECTOR_FLOORS) next[f] = ov[f] ?? VECTOR_ROOMS[f] ?? [];
        setWorking(next);
        setOverridden(new Set(Object.keys(ov)));
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const updateFloor = (fn: (list: VectorRoom[]) => VectorRoom[]) => {
    setWorking((prev) => ({ ...prev, [floor]: fn(prev[floor] ?? []) }));
    setOverridden((prev) => new Set(prev).add(floor));
  };

  const patchSelected = (patch: Partial<VectorRoom>) => {
    if (!selected) return;
    updateFloor((list) => list.map((r) => (r.id === selected.id ? { ...r, ...patch } : r)));
  };

  const nudge = (dx: number, dy: number) => {
    if (!selected) return;
    patchSelected({
      x: Math.round(clamp(selected.x + dx, 0, WORLD_W - selected.w)),
      y: Math.round(clamp(selected.y + dy, 0, WORLD_H - selected.h)),
    });
  };

  const moveSelectedTo = (p: { x: number; y: number }) => {
    if (!selected) return;
    patchSelected({
      x: Math.round(clamp(p.x * WORLD_W - selected.w / 2, 0, WORLD_W - selected.w)),
      y: Math.round(clamp(p.y * WORLD_H - selected.h / 2, 0, WORLD_H - selected.h)),
    });
  };

  const addRoom = () => {
    const id = `custom-${Date.now()}`;
    updateFloor((list) => [
      ...list,
      { id, label: '新', name: '新しい部屋', x: 420, y: 320, w: 110, h: 70, kind: 'class' },
    ]);
    setSelectedId(id);
  };

  const deleteSelected = () => {
    if (!selected) return;
    const id = selected.id;
    updateFloor((list) => list.filter((r) => r.id !== id));
    setSelectedId(null);
  };

  const resetFloor = () => {
    setWorking((prev) => ({ ...prev, [floor]: VECTOR_ROOMS[floor] ?? [] }));
    setOverridden((prev) => {
      const n = new Set(prev);
      n.delete(floor);
      return n;
    });
    setSelectedId(null);
  };

  // 開発サーバー (Metro) の書き換えエンドポイント。本番では存在しないため false。
  const writeSourceFile = async (rooms: MapLayoutOverrides): Promise<boolean> => {
    if (Platform.OS !== 'web') return false;
    try {
      const res = await fetch('/__admin/write-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ rooms }),
      });
      if (!res.ok) return false;
      const parsed = (await res.json().catch(() => null)) as { ok?: unknown } | null;
      return parsed?.ok === true;
    } catch {
      return false;
    }
  };

  const save = async (): Promise<string> => {
    // 全階の現在値をまとめて src/data/vectorMap.ts に書き換える
    const full: MapLayoutOverrides = {};
    for (const f of VECTOR_FLOORS) full[f] = working[f] ?? VECTOR_ROOMS[f] ?? [];
    if (await writeSourceFile(full)) {
      // ソースが正本になったので端末上書きは解除する
      await saveMapLayout({});
      return 'vectorMap.ts を書き換えました (自動反映・プレビュー上書きは解除)';
    }
    // 開発サーバーが無い場合は端末プレビューとして保存 (公開で全端末に反映)
    const out: MapLayoutOverrides = {};
    for (const f of VECTOR_FLOORS) {
      if (overridden.has(f)) out[f] = working[f];
    }
    await saveMapLayout(out);
    return 'マップ配置を保存しました (開発サーバー接続時は vectorMap.ts を書き換えます)';
  };

  if (isLoading) {
    return (
      <SafeAreaView style={adminStyles.center} edges={['top']}>
        <M3LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用・マップ配置" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: MAP_FOOTER_SPACE }]}>
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            フロア地図で部屋をタップして選び、下の一覧または地図タップで位置を調整します。
            地図の何もない場所をタップすると、選択中の部屋がその位置へ移動します。
          </Text>

          <M3PrimaryTabs labels={[...VECTOR_FLOORS]} value={tab} onValueChange={setTab} />

          <VectorMapView
            floor={floor}
            selectedId={selectedId}
            blinkId={null}
            blinkAnim={blinkAnim}
            locId={null}
            selfPos={null}
            roomsOverride={rooms}
            roomsTappable
            onPick={moveSelectedTo}
            onSelect={(id) => setSelectedId(id)}
          />

          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomChips}>
            {rooms.map((r) => {
              const active = r.id === selectedId;
              return (
                <M3Touch key={r.id} onPress={() => setSelectedId(r.id)} label={`${r.name}を選択`} round>
                  <View style={[styles.roomChip, active && styles.roomChipActive]}>
                    <Text
                      style={[m3type.labelMedium, { color: active ? m3.onPrimaryContainer : m3.onSurface }]}
                      numberOfLines={1}
                    >
                      {r.label || r.name}
                    </Text>
                  </View>
                </M3Touch>
              );
            })}
          </ScrollView>

          {selected ? (
            <Section title={`選択中: ${selected.name}`}>
              <Field label="ラベル (マーカー内の短縮表示)">
                <TextInput
                  style={adminStyles.input}
                  value={selected.label}
                  onChangeText={(t) => patchSelected({ label: t })}
                  placeholder="例: 1E"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="名前">
                <TextInput
                  style={adminStyles.input}
                  value={selected.name}
                  onChangeText={(t) => patchSelected({ name: t })}
                  placeholder="例: 高校1E"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="種類">
                <Chips
                  options={KIND_OPTIONS}
                  value={selected.kind}
                  onChange={(k) => patchSelected({ kind: k })}
                />
              </Field>
              <Field label="座標・サイズ (1000×700 のマス目)">
                <View style={styles.numGrid}>
                  <NumField label="X" value={selected.x} min={-200} onChange={(n) => patchSelected({ x: n })} />
                  <NumField label="Y" value={selected.y} min={-200} onChange={(n) => patchSelected({ y: n })} />
                  <NumField label="幅" value={selected.w} min={8} onChange={(n) => patchSelected({ w: n })} />
                  <NumField label="高さ" value={selected.h} min={8} onChange={(n) => patchSelected({ h: n })} />
                </View>
              </Field>
              <Field label="位置の微調整 (10ずつ)">
                <View style={styles.nudgeRow}>
                  <M3Button label="←" variant="tonal" onPress={() => nudge(-NUDGE, 0)} style={styles.nudgeBtn} />
                  <M3Button label="→" variant="tonal" onPress={() => nudge(NUDGE, 0)} style={styles.nudgeBtn} />
                  <M3Button label="↑" variant="tonal" onPress={() => nudge(0, -NUDGE)} style={styles.nudgeBtn} />
                  <M3Button label="↓" variant="tonal" onPress={() => nudge(0, NUDGE)} style={styles.nudgeBtn} />
                </View>
              </Field>
              <View style={adminStyles.buttonRow}>
                <M3Button label="この部屋を削除" icon="delete" variant="outlined" onPress={deleteSelected} />
              </View>
            </Section>
          ) : (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
              部屋を選択すると編集できます。
            </Text>
          )}

          <View style={adminStyles.buttonRow}>
            <M3Button label="部屋を追加" icon="add" variant="tonal" onPress={addRoom} />
            <M3Button label="この階を既定に戻す" icon="restart-alt" variant="outlined" onPress={resetFloor} />
          </View>

          <View style={adminStyles.backWrap}>
            <M3Button
              label="目次に戻る"
              icon="undo"
              variant="tonal"
              onPress={() => router.push('/admin/index' as never)}
            />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[{ label: '配置を保存', icon: 'save', run: save }]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  roomChips: { gap: 8, paddingVertical: 4 },
  roomChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    backgroundColor: m3.surfaceContainerHigh,
    maxWidth: 120,
  },
  roomChipActive: { backgroundColor: m3.primaryContainer },
  numGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  numField: { flexGrow: 1, flexBasis: 120, gap: 2 },
  nudgeRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  nudgeBtn: { flex: 1, minWidth: 0 },
});
