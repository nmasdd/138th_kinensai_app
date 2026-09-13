import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
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
  /** 現在地 (0〜1 の相対座標)。Googleマップ風の青いドットで表示する */
  selfPos?: { x: number; y: number } | null;
  /** 管理者が編集した部屋配置。未指定なら同梱の VECTOR_ROOMS を使う */
  roomsOverride?: VectorRoom[] | null;
  /** 指定すると地図タップで絶対位置 (0〜1 の相対座標) を返す作成モードになる */
  onPick?: (p: { x: number; y: number }) => void;
  /** onPick があっても部屋タップで onSelect を発火させる (配置編集モード用) */
  roomsTappable?: boolean;
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
export function VectorMapView({ floor, selectedId, blinkId, blinkAnim, locId, selfPos, roomsOverride, onPick, roomsTappable, onSelect }: Props) {
  const [fit, setFit] = useState(FIT_FALLBACK);
  const [scale, setScale] = useState(FIT_FALLBACK);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const state = useRef({ scale: FIT_FALLBACK, tx: 0, ty: 0, lastDist: 0, lastX: 0, lastY: 0, lastTap: 0, startX: 0, startY: 0, moved: false });
  const viewW = useRef(0);
  const viewH = useRef(0);
  const fitRef = useRef(FIT_FALLBACK);
  const didFitRef = useRef(false);
  const wrapRef = useRef<View>(null);
  const [selfPulse] = useState(() => new Animated.Value(0));
  const centeredSelfRef = useRef<string | null>(null);
  // PanResponder は初回生成のクロージャを保持するため、最新の onPick を ref 経由で読む
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);

  const rooms = useMemo(() => roomsOverride ?? VECTOR_ROOMS[floor] ?? [], [roomsOverride, floor]);

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

  // マップ枠の画面上の位置を測る (作成モードのタップ→ワールド座標換算に使う)
  const measureWrap = (cb: (left: number, top: number, width: number, height: number) => void) => {
    const node = wrapRef.current as unknown as {
      getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
      measureInWindow?: (fn: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    if (!node) {
      cb(0, 0, viewW.current, viewH.current);
      return;
    }
    if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
      const r = node.getBoundingClientRect();
      cb(r.left, r.top, r.width, r.height);
      return;
    }
    if (typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, w, h) => cb(x, y, w, h));
      return;
    }
    cb(0, 0, viewW.current, viewH.current);
  };

  // フロア切替時は全体表示にリセット
  useEffect(() => {
    apply(fitRef.current, 0, 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [floor]);

  // 現在地ドット (Googleマップ風)。ワールド座標へ換算し、画面上の大きさは
  // 1/scale で打ち消して一定に保つ。
  const selfWorld = useMemo(
    () => (selfPos ? { x: selfPos.x * WORLD_W, y: selfPos.y * WORLD_H } : null),
    [selfPos],
  );
  const selfDotR = useMemo(() => clamp(10 / scale, 4, 24), [scale]);
  const selfAccR = useMemo(() => clamp(26 / scale, 10, 80), [scale]);
  const selfPulseScale = useMemo(
    () => selfPulse.interpolate({ inputRange: [0, 1], outputRange: [1, 2.4] }),
    [selfPulse],
  );
  const selfPulseOpacity = useMemo(
    () => selfPulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 0] }),
    [selfPulse],
  );

  useEffect(() => {
    const anim = Animated.loop(Animated.timing(selfPulse, { toValue: 1, duration: 1400, useNativeDriver: true }));
    anim.start();
    return () => anim.stop();
  }, [selfPulse]);

  // 現在地が指定されたら初回だけ画面中央へ寄せる (以後のパン操作は尊重)
  const centerOnSelf = () => {
    if (!selfWorld || viewW.current <= 0) return;
    const key = `${floor}:${selfWorld.x.toFixed(1)}:${selfWorld.y.toFixed(1)}`;
    if (centeredSelfRef.current === key) return;
    centeredSelfRef.current = key;
    const s = Math.min(MAX_SCALE, Math.max(fitRef.current * 2.4, 1.0));
    apply(s, (WORLD_W / 2 - selfWorld.x) * s, (WORLD_H / 2 - selfWorld.y) * s);
  };
  const goToSelf = () => {
    if (!selfWorld) return;
    const s = Math.min(MAX_SCALE, Math.max(fitRef.current * 2.4, 1.0));
    apply(s, (WORLD_W / 2 - selfWorld.x) * s, (WORLD_H / 2 - selfWorld.y) * s);
  };

  useEffect(() => {
    if (!selfWorld) {
      centeredSelfRef.current = null;
      return;
    }
    centerOnSelf();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selfWorld, floor]);

  // Web: マップ上でのホイール/ピンチでページがスクロール・拡大しないよう、
  // 非パッシブなネイティブリスナで既定動作を止める。
  // ホイールはページスクロールの代わりに地図のズームへ割り当てる。
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const node = wrapRef.current as unknown as HTMLElement | null;
    if (!node || typeof node.addEventListener !== 'function') return;
    node.style.touchAction = 'none';
    node.style.userSelect = 'none';
    node.style.overscrollBehavior = 'contain';
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const next = state.current.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      apply(next, state.current.tx, state.current.ty);
    };
    const stopDefault = (e: Event) => e.preventDefault();
    node.addEventListener('wheel', onWheel, { passive: false });
    node.addEventListener('touchmove', stopDefault, { passive: false });
    return () => {
      node.removeEventListener('wheel', onWheel);
      node.removeEventListener('touchmove', stopDefault);
    };
    // apply は refs と setState のみ参照するため初回クロージャで問題ない
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
            state.current.startX = e.nativeEvent.pageX;
            state.current.startY = e.nativeEvent.pageY;
            state.current.moved = false;
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
          if (
            Math.abs(e.nativeEvent.pageX - state.current.startX) > 6 ||
            Math.abs(e.nativeEvent.pageY - state.current.startY) > 6
          ) {
            state.current.moved = true;
          }
          const dx = e.nativeEvent.pageX - state.current.lastX;
          const dy = e.nativeEvent.pageY - state.current.lastY;
          state.current.lastX = e.nativeEvent.pageX;
          state.current.lastY = e.nativeEvent.pageY;
          apply(state.current.scale, state.current.tx + dx, state.current.ty + dy);
        },
        onPanResponderRelease: (e) => {
          const cb = onPickRef.current;
          const wasMoved = state.current.moved;
          state.current.moved = false;
          if (!cb || wasMoved) return;
          const { pageX, pageY } = e.nativeEvent;
          measureWrap((left, top, width, height) => {
            const dx = pageX - left - width / 2;
            const dy = pageY - top - height / 2;
            const wx = WORLD_W / 2 + (dx - state.current.tx) / state.current.scale;
            const wy = WORLD_H / 2 + (dy - state.current.ty) / state.current.scale;
            cb({ x: clamp(wx / WORLD_W, 0, 1), y: clamp(wy / WORLD_H, 0, 1) });
          });
        },
        onPanResponderTerminate: () => {
          state.current.moved = false;
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
  // グリッド線は 1/scale で太さを打ち消し、拡大しても画面上で細い線を保つ
  const gridLine = useMemo(() => clamp(1 / scale, 0.001, 6), [scale]);

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
    <View style={styles.root}>
      <View
        ref={wrapRef}
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
          centerOnSelf();
        }}
      >
      <View
        {...pan.panHandlers}
        style={[styles.world, { width: WORLD_W, height: WORLD_H, transform: [{ translateX: tx }, { translateY: ty }, { scale }] }]}
      >
        <View style={styles.grid} pointerEvents="none">
          {Array.from({ length: 11 }).map((_, i) => (
            <View key={`v${i}`} style={[styles.gridV, { left: `${(i + 1) * 8.33}%`, width: gridLine }]} />
          ))}
          {Array.from({ length: 7 }).map((_, i) => (
            <View key={`h${i}`} style={[styles.gridH, { top: `${(i + 1) * 12.5}%`, height: gridLine }]} />
          ))}
        </View>
        {rooms.map((r) => {
          const active = isActiveRoom(r);
          const flashing = blinkId != null && (r.id === blinkId || hotspotForExhibitionId(blinkId)?.id === r.id);
          const isLoc = isLocRoom(r);
          const tappable =
            (roomsTappable ?? onPick == null) && (r.kind === 'class' || r.kind === 'club' || r.kind === 'outdoor');
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
                  borderWidth: active ? 6 : isLoc ? 3 : 1.5,
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
        {selfWorld ? (
          <View pointerEvents="none" style={StyleSheet.absoluteFill}>
            <View
              style={[
                styles.selfAccuracy,
                {
                  left: selfWorld.x - selfAccR,
                  top: selfWorld.y - selfAccR,
                  width: selfAccR * 2,
                  height: selfAccR * 2,
                  borderRadius: selfAccR,
                },
              ]}
            />
            <Animated.View
              style={[
                styles.selfPulse,
                {
                  left: selfWorld.x - selfAccR,
                  top: selfWorld.y - selfAccR,
                  width: selfAccR * 2,
                  height: selfAccR * 2,
                  borderRadius: selfAccR,
                  transform: [{ scale: selfPulseScale }],
                  opacity: selfPulseOpacity,
                },
              ]}
            />
            <View
              accessibilityLabel="現在地"
              style={[
                styles.selfDot,
                {
                  left: selfWorld.x - selfDotR,
                  top: selfWorld.y - selfDotR,
                  width: selfDotR * 2,
                  height: selfDotR * 2,
                  borderRadius: selfDotR,
                  borderWidth: clamp(2 / scale, 1, 5),
                },
              ]}
            />
          </View>
        ) : null}
      </View>
      </View>

      {/* 操作UI・凡例は地図と重ならないよう外側に配置する */}
      <View style={styles.controlsRow}>
        <Text style={[m3type.labelMedium, styles.metaText]}>
          北 ↑ ・ {floor} ・ x{fit > 0 ? (scale / fit).toFixed(1) : scale.toFixed(1)}
        </Text>
        <View style={styles.controlsButtons}>
          <Pressable onPress={zoomIn} accessibilityRole="button" accessibilityLabel="拡大する" style={styles.zoomBtn} hitSlop={8}>
            <M3Icon name="add" size={22} color={m3.onSurface} />
          </Pressable>
          <Pressable onPress={zoomOut} accessibilityRole="button" accessibilityLabel="縮小する" style={styles.zoomBtn} hitSlop={8}>
            <M3Icon name="remove" size={22} color={m3.onSurface} />
          </Pressable>
          <Pressable onPress={reset} accessibilityRole="button" accessibilityLabel="地図の位置と倍率をリセット" style={styles.zoomBtn} hitSlop={8}>
            <M3Icon name="fullscreen" size={22} color={m3.onSurface} />
          </Pressable>
          {selfWorld ? (
            <Pressable
              onPress={goToSelf}
              accessibilityRole="button"
              accessibilityLabel="現在地へ移動"
              style={[styles.zoomBtn, styles.locBtn]}
              hitSlop={8}
            >
              <M3Icon name="my-location" size={22} color={m3.primary} />
            </Pressable>
          ) : locId ? (
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
      </View>
      <View style={styles.legend}>
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
  root: { width: 380, maxWidth: '100%', alignSelf: 'center', gap: 8 },
  mapWrap: {
    width: '100%',
    height: 380,
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
  selfAccuracy: { position: 'absolute', backgroundColor: 'rgba(26,115,232,0.16)' },
  selfPulse: { position: 'absolute', backgroundColor: 'rgba(26,115,232,0.28)' },
  selfDot: {
    position: 'absolute',
    backgroundColor: '#1A73E8',
    borderColor: '#FFFFFF',
    elevation: 4,
    boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
  },
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
  controlsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' },
  controlsButtons: { flexDirection: 'row', gap: 8, marginLeft: 'auto' },
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
  metaText: { color: m3.onSurfaceVariant },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap', paddingHorizontal: 4 },
  legendSwatch: { width: 14, height: 14, borderRadius: 4, borderWidth: 1, borderColor: m3.outlineVariant },
});
