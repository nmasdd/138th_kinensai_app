import React, { useEffect, useRef, useState } from 'react';
import { Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3LoadingView, M3PrimaryTabs, M3Touch, TopAppBar } from '../../components/m3';
import { AdminNotice, AdminSaveBar, useAdminNotice } from '../../components/AdminSaveBar';
import { Chips, Field, Section, useAdminStyles } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import { VectorMapView } from '../../components/VectorMapView';
import {
  VECTOR_ANNOTATIONS,
  VECTOR_FLOORS,
  VECTOR_ROOMS,
  inferToiletGender,
  type ToiletGender,
  type VectorAnnotation,
  type VectorFloor,
  type VectorRoom,
} from '../../data/vectorMap';
import {
  annotationsForFloor,
  loadMapLayout,
  roomsForFloor,
  saveMapLayout,
  type MapLayoutOverrides,
} from '../../data/mapLayout';
import { m3, scaled } from '../../theme';
import { useM3 } from '../../context/responsive';

/**
 * 管理者用・マップ配置 (/admin/map)。
 * フロア地図で部屋または注記 (4F/5Fバッジ・この階まで・立入禁止など) を
 * 選び、タップ位置への移動・数値調整・nudge で編集して `map-layout.json`
 * (開発サーバー接続時は `vectorMap.ts`) に保存する。
 */
const WORLD_W = 1000;
const WORLD_H = 700;
const NUDGE = 10;
const MAP_FOOTER_SPACE = 200;

const KIND_OPTIONS: { value: VectorRoom['kind']; label: string }[] = [
  { value: 'class', label: '高校教室' },
  { value: 'jclass', label: '中学教室' },
  { value: 'club', label: '特別教室' },
  { value: 'corridor', label: '廊下' },
  { value: 'stairs', label: '階段' },
  { value: 'elevator', label: 'EV' },
  { value: 'vending', label: '自販機' },
  { value: 'toilet', label: 'トイレ' },
  { value: 'outdoor', label: '屋外' },
  { value: 'hall', label: 'その他' },
];

const GENDER_OPTIONS: { value: ToiletGender; label: string }[] = [
  { value: 'male', label: '男子 (青)' },
  { value: 'female', label: '女子 (赤)' },
  { value: 'both', label: '男女 (2色)' },
];

const ANN_KIND_OPTIONS: { value: VectorAnnotation['kind']; label: string }[] = [
  { value: 'badge', label: '階バッジ' },
  { value: 'label', label: 'ラベル' },
  { value: 'note', label: '注記' },
];

const TONE_OPTIONS: { value: 'normal' | 'danger'; label: string }[] = [
  { value: 'normal', label: '標準' },
  { value: 'danger', label: '警告 (赤)' },
];

function NumField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number;
  onChange: (n: number) => void;
}) {
  const { type } = useM3();
  const adminStyles = useAdminStyles();
  const styles = useStyles();
  const [text, setText] = useState(() => String(value));
  const focused = useRef(false);

  // 外部 (nudge/地図タップ) で値が変わったとき、未編集なら表示を追従させる
  useEffect(() => {
    if (!focused.current) setText(String(value));
  }, [value]);

  const commit = () => {
    focused.current = false;
    const n = parseInt(text.replace(/[^0-9-]/g, ''), 10);
    if (Number.isFinite(n)) {
      onChange(n);
      setText(String(n));
    } else {
      setText(String(value));
    }
  };

  return (
    <View style={styles.numField}>
      <Text style={[type.labelMedium, { color: m3.onSurfaceVariant }]}>{label}</Text>
      <TextInput
        style={adminStyles.input}
        value={text}
        keyboardType="numeric"
        onFocus={() => {
          focused.current = true;
        }}
        onChangeText={(t) => setText(t.replace(/[^0-9-]/g, ''))}
        onBlur={commit}
        onSubmitEditing={commit}
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
  const { type } = useM3();
  const adminStyles = useAdminStyles();
  const styles = useStyles();
  const [tab, setTab] = useState(0);
  const [roomsByFloor, setRoomsByFloor] = useState<Record<string, VectorRoom[]>>(() => {
    const init: Record<string, VectorRoom[]> = {};
    for (const f of VECTOR_FLOORS) init[f] = VECTOR_ROOMS[f] ?? [];
    return init;
  });
  const [annByFloor, setAnnByFloor] = useState<Record<string, VectorAnnotation[]>>(() => {
    const init: Record<string, VectorAnnotation[]> = {};
    for (const f of VECTOR_FLOORS) init[f] = VECTOR_ANNOTATIONS[f] ?? [];
    return init;
  });
  const [overridden, setOverridden] = useState<Set<string>>(() => new Set());
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [selectedAnn, setSelectedAnn] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const { notice, showOk, showErr } = useAdminNotice();

  const floor = VECTOR_FLOORS[tab];
  const rooms = roomsByFloor[floor] ?? [];
  const annotations = annByFloor[floor] ?? [];
  const selectedRoom = rooms.find((r) => r.id === selectedRoomId) ?? null;
  const selectedAnnotation = selectedAnn != null ? annotations[selectedAnn] ?? null : null;

  useEffect(() => {
    let cancelled = false;
    loadMapLayout()
      .then((ov) => {
        if (cancelled) return;
        const roomsNext: Record<string, VectorRoom[]> = {};
        const annNext: Record<string, VectorAnnotation[]> = {};
        for (const f of VECTOR_FLOORS) {
          roomsNext[f] = roomsForFloor(f, ov);
          annNext[f] = annotationsForFloor(f, ov);
        }
        setRoomsByFloor(roomsNext);
        setAnnByFloor(annNext);
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

  const markOverridden = () => setOverridden((prev) => new Set(prev).add(floor));

  const updateRooms = (fn: (list: VectorRoom[]) => VectorRoom[]) => {
    setRoomsByFloor((prev) => ({ ...prev, [floor]: fn(prev[floor] ?? []) }));
    markOverridden();
  };

  const updateAnnotations = (fn: (list: VectorAnnotation[]) => VectorAnnotation[]) => {
    setAnnByFloor((prev) => ({ ...prev, [floor]: fn(prev[floor] ?? []) }));
    markOverridden();
  };

  const patchRoom = (patch: Partial<VectorRoom>) => {
    if (!selectedRoom) return;
    updateRooms((list) => list.map((r) => (r.id === selectedRoom.id ? { ...r, ...patch } : r)));
  };

  const patchAnnotation = (patch: Partial<VectorAnnotation>) => {
    if (selectedAnn == null || !selectedAnnotation) return;
    updateAnnotations((list) => list.map((a, i) => (i === selectedAnn ? { ...a, ...patch } : a)));
  };

  const nudgeRoom = (dx: number, dy: number) => {
    if (!selectedRoom) return;
    patchRoom({ x: Math.round(selectedRoom.x + dx), y: Math.round(selectedRoom.y + dy) });
  };

  const nudgeAnnotation = (dx: number, dy: number) => {
    if (!selectedAnnotation) return;
    patchAnnotation({ x: Math.round(selectedAnnotation.x + dx), y: Math.round(selectedAnnotation.y + dy) });
  };

  // 地図タップ: 選択中の部屋 (左上基準) または注記 (中心) をその位置へ移す
  const moveSelectedTo = (p: { x: number; y: number }) => {
    if (selectedRoom) {
      patchRoom({
        x: Math.round(p.x * WORLD_W - selectedRoom.w / 2),
        y: Math.round(p.y * WORLD_H - selectedRoom.h / 2),
      });
    } else if (selectedAnnotation) {
      patchAnnotation({ x: Math.round(p.x * WORLD_W), y: Math.round(p.y * WORLD_H) });
    }
  };

  const addRoom = () => {
    const id = `custom-${Date.now()}`;
    updateRooms((list) => [
      ...list,
      { id, label: '新', name: '新しい部屋', x: 420, y: 320, w: 110, h: 70, kind: 'class' },
    ]);
    setSelectedRoomId(id);
    setSelectedAnn(null);
  };

  const deleteSelectedRoom = () => {
    if (!selectedRoom) return;
    const id = selectedRoom.id;
    updateRooms((list) => list.filter((r) => r.id !== id));
    setSelectedRoomId(null);
  };

  const addAnnotation = () => {
    const index = annotations.length;
    updateAnnotations((list) => [...list, { kind: 'label', text: '新しい注記', x: 500, y: 350 }]);
    setSelectedAnn(index);
    setSelectedRoomId(null);
  };

  const deleteSelectedAnnotation = () => {
    if (selectedAnn == null) return;
    const index = selectedAnn;
    updateAnnotations((list) => list.filter((_, i) => i !== index));
    setSelectedAnn(null);
  };

  const resetFloor = () => {
    setRoomsByFloor((prev) => ({ ...prev, [floor]: VECTOR_ROOMS[floor] ?? [] }));
    setAnnByFloor((prev) => ({ ...prev, [floor]: VECTOR_ANNOTATIONS[floor] ?? [] }));
    setOverridden((prev) => {
      const n = new Set(prev);
      n.delete(floor);
      return n;
    });
    setSelectedRoomId(null);
    setSelectedAnn(null);
  };

  // 開発サーバー (Metro) の書き換えエンドポイント。本番では存在しないため false。
  const writeSourceFile = async (layout: MapLayoutOverrides): Promise<boolean> => {
    if (Platform.OS !== 'web') return false;
    try {
      const res = await fetch('/__admin/write-map', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ layout }),
      });
      if (!res.ok) return false;
      const parsed = (await res.json().catch(() => null)) as { ok?: unknown } | null;
      return parsed?.ok === true;
    } catch {
      return false;
    }
  };

  const save = async (): Promise<string> => {
    // 全階の現在値 (部屋 + 注記) をまとめて src/data/vectorMap.ts に書き換える
    const full: MapLayoutOverrides = {};
    for (const f of VECTOR_FLOORS) {
      full[f] = { rooms: roomsByFloor[f] ?? [], annotations: annByFloor[f] ?? [] };
    }
    if (await writeSourceFile(full)) {
      // ソースが正本になったので端末上書きは解除する
      await saveMapLayout({});
      return 'vectorMap.ts を書き換えました (自動反映・プレビュー上書きは解除)';
    }
    // 開発サーバーが無い場合は端末プレビューとして保存 (公開で全端末に反映)
    const out: MapLayoutOverrides = {};
    for (const f of VECTOR_FLOORS) {
      if (overridden.has(f)) out[f] = { rooms: roomsByFloor[f], annotations: annByFloor[f] };
    }
    await saveMapLayout(out);
    return 'マップ配置・注記を保存しました (開発サーバー接続時は vectorMap.ts を書き換えます)';
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
        <ScrollView style={adminStyles.scroll} contentContainerStyle={[adminStyles.body, { paddingBottom: MAP_FOOTER_SPACE }]}>
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            フロア地図で部屋または注記をタップして選び、下の一覧または地図タップで位置を調整します。
            地図の何もない場所をタップすると、選択中の項目がその位置へ移動します。
          </Text>

          <M3PrimaryTabs labels={[...VECTOR_FLOORS]} value={tab} onValueChange={setTab} />

          <VectorMapView
            floor={floor}
            selectedId={selectedRoomId}
            locId={null}
            selfPos={null}
            roomsOverride={rooms}
            annotationsOverride={annotations}
            selectedAnnotation={selectedAnn}
            roomsTappable
            pickUnclamped
            onPick={moveSelectedTo}
            onSelect={(id) => {
              setSelectedRoomId(id);
              setSelectedAnn(null);
            }}
            onSelectAnnotation={(i) => {
              setSelectedAnn(i);
              setSelectedRoomId(null);
            }}
          />

          <Section title="部屋">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomChips}>
              {rooms.map((r) => {
                const active = r.id === selectedRoomId;
                return (
                  <M3Touch key={r.id} onPress={() => { setSelectedRoomId(r.id); setSelectedAnn(null); }} label={`${r.name}を選択`} round>
                    <View style={[styles.chip, active && styles.chipActive]}>
                      <Text
                        style={[type.labelMedium, { color: active ? m3.onPrimaryContainer : m3.onSurface }]}
                        numberOfLines={1}
                      >
                        {r.label || r.name}
                      </Text>
                    </View>
                  </M3Touch>
                );
              })}
            </ScrollView>
          </Section>

          {selectedRoom ? (
            <Section title={`選択中の部屋: ${selectedRoom.name}`}>
              <Field label="ラベル (マーカー内の短縮表示)">
                <TextInput
                  style={adminStyles.input}
                  value={selectedRoom.label}
                  onChangeText={(t) => patchRoom({ label: t })}
                  placeholder="例: 1E"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="名前">
                <TextInput
                  style={adminStyles.input}
                  value={selectedRoom.name}
                  onChangeText={(t) => patchRoom({ name: t })}
                  placeholder="例: 高校1E"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="種類">
                <Chips
                  options={KIND_OPTIONS}
                  value={selectedRoom.kind}
                  onChange={(k) => patchRoom({ kind: k })}
                />
              </Field>
              {selectedRoom.kind === 'toilet' ? (
                <Field label="トイレ区分 (校内マップの色分け)">
                  <Chips
                    options={GENDER_OPTIONS}
                    value={selectedRoom.gender ?? inferToiletGender(selectedRoom.name) ?? 'male'}
                    onChange={(g) => patchRoom({ gender: g })}
                  />
                </Field>
              ) : null}
              <Field label="座標・サイズ (1000×700 のマス目)">
                <View style={styles.numGrid}>
                  <NumField label="X" value={selectedRoom.x} onChange={(n) => patchRoom({ x: n })} />
                  <NumField label="Y" value={selectedRoom.y} onChange={(n) => patchRoom({ y: n })} />
                  <NumField label="幅" value={selectedRoom.w} onChange={(n) => patchRoom({ w: n })} />
                  <NumField label="高さ" value={selectedRoom.h} onChange={(n) => patchRoom({ h: n })} />
                </View>
              </Field>
              <Field label="位置の微調整 (10ずつ)">
                <View style={styles.nudgeRow}>
                  <M3Button label="←" variant="tonal" onPress={() => nudgeRoom(-NUDGE, 0)} style={styles.nudgeBtn} />
                  <M3Button label="→" variant="tonal" onPress={() => nudgeRoom(NUDGE, 0)} style={styles.nudgeBtn} />
                  <M3Button label="↑" variant="tonal" onPress={() => nudgeRoom(0, -NUDGE)} style={styles.nudgeBtn} />
                  <M3Button label="↓" variant="tonal" onPress={() => nudgeRoom(0, NUDGE)} style={styles.nudgeBtn} />
                </View>
              </Field>
              <View style={adminStyles.buttonRow}>
                <M3Button label="この部屋を削除" icon="delete" variant="outlined" onPress={deleteSelectedRoom} />
              </View>
            </Section>
          ) : null}

          <View style={adminStyles.buttonRow}>
            <M3Button label="部屋を追加" icon="add" variant="tonal" onPress={addRoom} />
          </View>

          <Section title="注記 (案内)">
            <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.roomChips}>
              {annotations.length === 0 ? (
                <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>注記はありません</Text>
              ) : (
                annotations.map((a, i) => {
                  const active = i === selectedAnn;
                  return (
                    <M3Touch key={`ann-${i}`} onPress={() => { setSelectedAnn(i); setSelectedRoomId(null); }} label={`注記「${a.text}」を選択`} round>
                      <View style={[styles.chip, active && styles.chipActive]}>
                        <Text
                          style={[type.labelMedium, { color: active ? m3.onPrimaryContainer : m3.onSurface }]}
                          numberOfLines={1}
                        >
                          {a.text}
                        </Text>
                      </View>
                    </M3Touch>
                  );
                })
              )}
            </ScrollView>
          </Section>

          {selectedAnnotation ? (
            <Section title="選択中の注記">
              <Field label="種類">
                <Chips
                  options={ANN_KIND_OPTIONS}
                  value={selectedAnnotation.kind}
                  onChange={(k) => patchAnnotation({ kind: k })}
                />
              </Field>
              <Field label="テキスト">
                <TextInput
                  style={adminStyles.input}
                  value={selectedAnnotation.text}
                  onChangeText={(t) => patchAnnotation({ text: t })}
                  placeholder="例: この階まで"
                  placeholderTextColor={m3.onSurfaceVariant}
                  multiline
                />
              </Field>
              <Field label="強調">
                <Chips
                  options={TONE_OPTIONS}
                  value={selectedAnnotation.tone === 'danger' ? 'danger' : 'normal'}
                  onChange={(t) => patchAnnotation({ tone: t === 'danger' ? 'danger' : undefined })}
                />
              </Field>
              <Field label="座標 (1000×700 のマス目・中心位置)">
                <View style={styles.numGrid}>
                  <NumField label="X" value={selectedAnnotation.x} onChange={(n) => patchAnnotation({ x: n })} />
                  <NumField label="Y" value={selectedAnnotation.y} onChange={(n) => patchAnnotation({ y: n })} />
                </View>
              </Field>
              <Field label="位置の微調整 (10ずつ)">
                <View style={styles.nudgeRow}>
                  <M3Button label="←" variant="tonal" onPress={() => nudgeAnnotation(-NUDGE, 0)} style={styles.nudgeBtn} />
                  <M3Button label="→" variant="tonal" onPress={() => nudgeAnnotation(NUDGE, 0)} style={styles.nudgeBtn} />
                  <M3Button label="↑" variant="tonal" onPress={() => nudgeAnnotation(0, -NUDGE)} style={styles.nudgeBtn} />
                  <M3Button label="↓" variant="tonal" onPress={() => nudgeAnnotation(0, NUDGE)} style={styles.nudgeBtn} />
                </View>
              </Field>
              <View style={adminStyles.buttonRow}>
                <M3Button label="この注記を削除" icon="delete" variant="outlined" onPress={deleteSelectedAnnotation} />
              </View>
            </Section>
          ) : (
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
              注記を選択すると編集できます (地図上または上の一覧)。
            </Text>
          )}

          <View style={adminStyles.buttonRow}>
            <M3Button label="注記を追加" icon="add" variant="tonal" onPress={addAnnotation} />
            <M3Button label="この階を既定に戻す" icon="restart-alt" variant="outlined" onPress={resetFloor} />
          </View>

          <View style={adminStyles.backWrap}>
            <M3Button
              label="目次に戻る"
              icon="undo"
              variant="tonal"
              onPress={() => router.push('/admin' as never)}
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

function createStyles(s: number) {
  return StyleSheet.create({
    roomChips: { gap: scaled(8, s), paddingVertical: scaled(4, s) },
    chip: {
      paddingHorizontal: scaled(12, s),
      paddingVertical: scaled(6, s),
      borderRadius: 999,
      backgroundColor: m3.surfaceContainerHigh,
      maxWidth: scaled(160, s),
    },
    chipActive: { backgroundColor: m3.primaryContainer },
    numGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: scaled(8, s) },
    numField: { flexGrow: 1, flexBasis: scaled(120, s), gap: scaled(2, s) },
    nudgeRow: { flexDirection: 'row', gap: scaled(8, s), flexWrap: 'wrap' },
    nudgeBtn: { flex: 1, minWidth: 0 },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
