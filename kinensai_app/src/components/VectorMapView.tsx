import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Pressable, StyleSheet, Text, View } from 'react-native';
import { M3Icon } from './m3';
import { m3, m3shape, m3type } from '../theme';
import { ROOM_FILL, VECTOR_ROOMS, type VectorFloor, type VectorRoom } from '../data/vectorMap';
import { hotspotForExhibitionId } from '../data/mapHotspots';

const WORLD_W = 1000;
const WORLD_H = 700;
const MAX_SCALE = 4;
const FIT_FALLBACK = Math.min(380 / WORLD_W, 380 / WORLD_H);

interface Props {
  floor: VectorFloor;
  selectedId: string | null;
  blinkId: string | null;
  blinkAnim: Animated.Value;
  locId?: string | null;
  onSelect: (id: string) => void;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * 自販機アイコン (ベクター描画)。
 * 同梱のアイコンフォントに自販機グリフがないため、ガラス面のドリンク棚・
 * 取出口・操作ボタンを備えたミニ自販機を View で描く。
 */
function VendingMachineIcon({ size, color }: { size: number; color: string }) {
  const s = size;
  const line = Math.max(1.5, s * 0.07);
  return (
    <View
      style={{
        width: s * 0.68,
        height: s,
        borderWidth: line,
        borderColor: color,
        borderRadius: s * 0.12,
        backgroundColor: m3.surface,
        flexDirection: 'row',
        padding: s * 0.08,
        gap: s * 0.06,
      }}
    >
      {/* ガラス面: ドリンク棚2段 + 取出口 */}
      <View style={{ flex: 1.7, justifyContent: 'space-evenly' }}>
        {[0, 1].map((row) => (
          <View key={row} style={{ flexDirection: 'row', justifyContent: 'space-evenly' }}>
            {[0, 1, 2].map((c) => (
              <View
                key={c}
                style={{
                  width: s * 0.1,
                  height: s * 0.15,
                  borderRadius: s * 0.02,
                  backgroundColor: (row + c) % 2 === 0 ? m3.primary : color,
                }}
              />
            ))}
          </View>
        ))}
        <View
          style={{
            height: s * 0.13,
            borderWidth: Math.max(1, s * 0.04),
            borderColor: color,
            borderRadius: s * 0.03,
          }}
        />
      </View>
      {/* 操作パネル: ボタン列 */}
      <View style={{ flex: 1, justifyContent: 'space-evenly', alignItems: 'center' }}>
        {[0, 1, 2].map((i) => (
          <View
            key={i}
            style={{ width: s * 0.09, height: s * 0.09, borderRadius: s * 0.045, backgroundColor: color }}
          />
        ))}
      </View>
    </View>
  );
}

/**
 * Googleマップ風ベクターマップ。
 * 画像埋め込みなし。ドラッグでパン、ピンチ/ホイール/ダブルタップ/ボタンでズーム。
 * 部屋は vectorMap.ts の模式図、展示マーカーは mapHotspots.ts と展示IDで対応。
 */
export function VectorMapView({ floor, selectedId, blinkId, blinkAnim, locId, onSelect }: Props) {
  const [fit, setFit] = useState(FIT_FALLBACK);
  const [scale, setScale] = useState(FIT_FALLBACK);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const state = useRef({ scale: FIT_FALLBACK, tx: 0, ty: 0, lastDist: 0, lastX: 0, lastY: 0, lastTap: 0 });
  const viewW = useRef(0);
  const viewH = useRef(0);
  const fitRef = useRef(FIT_FALLBACK);
  const didFitRef = useRef(false);

  const rooms = useMemo(() => VECTOR_ROOMS[floor] ?? [], [floor]);

  const calcFit = (vw: number, vh: number): number => {
    if (vw <= 0 || vh <= 0) return fitRef.current;
    // 全体が余白付きで収まる倍率 (初期表示=全体表示)
    return Math.min(vw / WORLD_W, vh / WORLD_H) * 0.98;
  };

  const apply = (s: number, x: number, y: number) => {
    const minS = fitRef.current;
    const cs = clamp(s, minS, MAX_SCALE);
    // スケール後のワールドとはみ出し量からパン範囲を算出 (fit時はほぼ動かさない)
    const vw = viewW.current;
    const vh = viewH.current;
    const overX = vw > 0 ? Math.max(0, (WORLD_W * cs - vw) / 2) : 400;
    const overY = vh > 0 ? Math.max(0, (WORLD_H * cs - vh) / 2) : 400;
    const margin = 60;
    const maxX = overX + margin;
    const maxY = overY + margin;
    const cx = clamp(x, -maxX, maxX);
    const cy = clamp(y, -maxY, maxY);
    state.current.scale = cs;
    state.current.tx = cx;
    state.current.ty = cy;
    setScale(cs);
    setTx(cx);
    setTy(cy);
  };

  // フロア切替時は全体表示にリセット
  useEffect(() => {
    apply(fitRef.current, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor]);

  const pan = useMemo(
    () =>
      // PanResponder のコールバックはタッチイベント時にのみ実行され、
      // render 中に .current を読むことはない。
      // eslint-disable-next-line react-hooks/refs
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (e) => {
          const touches = (e.nativeEvent as unknown as { touches?: { pageX: number; pageY: number }[] }).touches;
          if (touches && touches.length === 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            state.current.lastDist = Math.sqrt(dx * dx + dy * dy);
          } else {
            state.current.lastX = e.nativeEvent.pageX;
            state.current.lastY = e.nativeEvent.pageY;
            // ダブルタップでズームイン (Googleマップ風)
            // eslint-disable-next-line react-hooks/purity
            const now = Date.now();
            if (now - state.current.lastTap < 300) {
              const next = state.current.scale >= MAX_SCALE ? fitRef.current : state.current.scale * 1.8;
              apply(state.current.scale, state.current.tx, state.current.ty);
              // apply後にnextへ
              requestAnimationFrame(() => apply(next, state.current.tx, state.current.ty));
              state.current.lastTap = 0;
            } else {
              state.current.lastTap = now;
            }
          }
        },
        onPanResponderMove: (e) => {
          const touches = (e.nativeEvent as unknown as { touches?: { pageX: number; pageY: number }[] }).touches;
          if (touches && touches.length === 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (state.current.lastDist > 0) {
              const next = state.current.scale * (dist / state.current.lastDist);
              apply(next, state.current.tx, state.current.ty);
            }
            state.current.lastDist = dist;
            return;
          }
          const dx = e.nativeEvent.pageX - state.current.lastX;
          const dy = e.nativeEvent.pageY - state.current.lastY;
          state.current.lastX = e.nativeEvent.pageX;
          state.current.lastY = e.nativeEvent.pageY;
          apply(state.current.scale, state.current.tx + dx, state.current.ty + dy);
        },
      }),
    [],
  );

  const zoomIn = () => apply(state.current.scale * 1.4, state.current.tx, state.current.ty);
  const zoomOut = () => apply(state.current.scale / 1.4, state.current.tx, state.current.ty);
  const reset = () => apply(fitRef.current, 0, 0);
  // QR読取位置の部屋へセンタリング (リセットとは別動作)
  const centerOnLoc = () => {
    const target = rooms.find((r) => locId != null && (r.id === locId || r.name.includes(locId)));
    if (!target) {
      reset();
      return;
    }
    const s = Math.min(MAX_SCALE, Math.max(fitRef.current * 3, 1.2));
    const cx = target.x + target.w / 2;
    const cy = target.y + target.h / 2;
    apply(s, (WORLD_W / 2 - cx) * s, (WORLD_H / 2 - cy) * s);
  };

  // ワールド全体に transform scale が掛かるため、文字だけは 1/scale で打ち消して
  // 画面上の見かけサイズを一定に保つ (fit表示でも読めるように)
  const labelFontSize = useMemo(() => clamp(15 / scale, 5, 44), [scale]);
  const sysIconSize = useMemo(() => clamp(20 / scale, 8, 52), [scale]);
  const locIconSize = useMemo(() => clamp(18 / scale, 8, 44), [scale]);

  const isActiveRoom = (r: VectorRoom): boolean => {
    if (selectedId == null) return false;
    if (r.id === selectedId) return true;
    const hit = hotspotForExhibitionId(selectedId);
    if (hit && (hit.id === r.id || hit.sharedIds?.includes(r.id))) return true;
    // 代表なしの部屋IDは一覧側で処理するため前方一致で判定しない
    return false;
  };

  const isLocRoom = (r: VectorRoom): boolean => locId != null && (r.id === locId || r.name.includes(locId));

  return (
    <View
      style={styles.mapWrap}
      accessibilityRole="none"
      accessibilityLabel={`${floor}のベクター校内マップ。ドラッグで移動、ボタンで拡大縮小できます`}
      onLayout={(e) => {
        const w = e.nativeEvent.layout.width;
        const h = e.nativeEvent.layout.height;
        viewW.current = w;
        viewH.current = h;
        const nextFit = calcFit(w, h);
        const prevFit = fitRef.current;
        fitRef.current = nextFit;
        setFit(nextFit);
        if (!didFitRef.current) {
          didFitRef.current = true;
          apply(nextFit, 0, 0);
        } else if (Math.abs(state.current.scale - prevFit) < 0.01) {
          // 全体表示のままサイズが変わったら追従
          apply(nextFit, 0, 0);
        }
      }}
      // Web のホイールズーム (native では無視される)
      // @ts-expect-error web-only prop
      onWheel={(e: { deltaY: number; preventDefault?: () => void }) => {
        e.preventDefault?.();
        const next = state.current.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
        apply(next, state.current.tx, state.current.ty);
      }}
    >
      <View style={styles.grid} pointerEvents="none">
        {Array.from({ length: 11 }).map((_, i) => (
          <View key={`v${i}`} style={[styles.gridV, { left: `${(i + 1) * 8.33}%` }]} />
        ))}
        {Array.from({ length: 7 }).map((_, i) => (
          <View key={`h${i}`} style={[styles.gridH, { top: `${(i + 1) * 12.5}%` }]} />
        ))}
      </View>
      <View
        {...pan.panHandlers}
        style={[styles.world, { width: WORLD_W, height: WORLD_H, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
      >
        {rooms.map((r) => {
          const active = isActiveRoom(r);
          const flashing = blinkId != null && (r.id === blinkId || hotspotForExhibitionId(blinkId)?.id === r.id);
          const isLoc = isLocRoom(r);
          const tappable = r.kind === 'class' || r.kind === 'club' || r.kind === 'outdoor';
          const body = (
            <Animated.View
              style={[
                styles.room,
                {
                  left: r.x,
                  top: r.y,
                  width: r.w,
                  height: r.h,
                  backgroundColor: active ? m3.primaryContainer : ROOM_FILL[r.kind],
                  borderColor: active ? m3.primary : isLoc ? m3.primary : m3.outlineVariant,
                  borderWidth: active || isLoc ? 3 : 1.5,
                },
                flashing && { opacity: blinkAnim },
              ]}
            >
              {r.label ? (
                <Text
                  style={[
                    m3type.labelMedium,
                    {
                      color: active ? m3.onPrimaryContainer : m3.onSurface,
                      fontSize: labelFontSize,
                      lineHeight: labelFontSize * 1.2,
                      fontWeight: '600',
                      textAlign: 'center',
                    },
                  ]}
                  numberOfLines={1}
                  allowFontScaling={false}
                >
                  {r.label}
                </Text>
              ) : null}
              {r.kind === 'stairs' || r.kind === 'elevator' || r.kind === 'toilet' ? (
                <M3Icon
                  name={r.kind === 'stairs' ? 'stairs' : r.kind === 'elevator' ? 'elevator' : 'wc'}
                  size={sysIconSize}
                  color={m3.onSurfaceVariant}
                />
              ) : null}
              {r.kind === 'vending' ? <VendingMachineIcon size={sysIconSize} color={m3.onSurfaceVariant} /> : null}
              {isLoc ? (
                <View style={styles.locDot}>
                  <M3Icon name="my-location" size={locIconSize} color={m3.primary} />
                </View>
              ) : null}
              {active ? <View style={styles.activePin} /> : null}
            </Animated.View>
          );
          if (!tappable) return <View key={r.id}>{body}</View>;
          return (
            <Pressable
              key={r.id}
              onPress={() => onSelect(r.id)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`${r.name}の企画詳細を開く`}
              accessibilityState={{ selected: active }}
            >
              {body}
            </Pressable>
          );
        })}
      </View>
      {/* Googleマップ風操作UI */}
      <View style={styles.zoomBar} pointerEvents="box-none">
        <Pressable onPress={zoomIn} accessibilityRole="button" accessibilityLabel="拡大する" style={styles.zoomBtn} hitSlop={8}>
          <M3Icon name="add" size={22} color={m3.onSurface} />
        </Pressable>
        <Pressable onPress={zoomOut} accessibilityRole="button" accessibilityLabel="縮小する" style={styles.zoomBtn} hitSlop={8}>
          <M3Icon name="remove" size={22} color={m3.onSurface} />
        </Pressable>
        <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel="地図の位置と倍率をリセット" style={styles.zoomBtn} hitSlop={8}>
          <M3Icon name="fullscreen" size={22} color={m3.onSurface} />
        </Pressable>
        {locId ? (
          <Pressable
            onPress={centerOnLoc}
            accessibilityRole="button"
            accessibilityLabel="QR読取位置へ移動"
            style={[styles.zoomBtn, styles.locBtn]}
            hitSlop={8}
          >
            <M3Icon name="my-location" size={22} color={m3.primary} />
          </Pressable>
        ) : null}
      </View>
      <View style={styles.metaBar} pointerEvents="none">
        <Text style={[m3type.labelMedium, styles.metaText]}>
          北 ↑ ・ {floor} ・ x{fit > 0 ? (scale / fit).toFixed(1) : scale.toFixed(1)}
        </Text>
      </View>
      <View style={styles.legend} pointerEvents="none">
        <View style={[styles.legendSwatch, { backgroundColor: ROOM_FILL.class }]} />
        <Text style={[m3type.labelMedium, styles.metaText]}>教室</Text>
        <View style={[styles.legendSwatch, { backgroundColor: ROOM_FILL.club }]} />
        <Text style={[m3type.labelMedium, styles.metaText]}>特別教室</Text>
        <View style={[styles.legendSwatch, { backgroundColor: ROOM_FILL.outdoor }]} />
        <Text style={[m3type.labelMedium, styles.metaText]}>屋外</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  mapWrap: {
    width: 380,
    maxWidth: '100%',
    height: 380,
    alignSelf: 'center',
    borderRadius: m3shape.card,
    backgroundColor: m3.surfaceContainerHighest,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: m3.outlineVariant,
  },
  grid: { position: 'absolute', left: 0, right: 0, top: 0, bottom: 0 },
  gridV: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: m3.outlineVariant, opacity: 0.5 },
  gridH: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: m3.outlineVariant, opacity: 0.5 },
  world: { position: 'absolute', left: '50%', top: '50%', marginLeft: -WORLD_W / 2, marginTop: -WORLD_H / 2 },
  room: {
    position: 'absolute',
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
    gap: 2,
    padding: 4,
  },
  locDot: { position: 'absolute', top: 2, right: 2 },
  activePin: {
    position: 'absolute',
    top: -8,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: m3.primary,
    borderWidth: 2,
    borderColor: m3.onPrimary,
  },
  zoomBar: { position: 'absolute', right: 12, bottom: 52, gap: 8 },
  zoomBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: m3.surface,
    borderWidth: 1,
    borderColor: m3.outlineVariant,
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 3,
    boxShadow: '0 2px 6px rgba(0,0,0,0.3)',
  },
  locBtn: { borderColor: m3.primary, borderWidth: 2 },
  metaBar: {
    position: 'absolute',
    left: 12,
    top: 12,
    backgroundColor: m3.surface,
    borderRadius: m3shape.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: m3.outlineVariant,
  },
  metaText: { color: m3.onSurfaceVariant },
  legend: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: m3.surface,
    borderRadius: m3shape.pill,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: m3.outlineVariant,
  },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: m3.outlineVariant },
});
