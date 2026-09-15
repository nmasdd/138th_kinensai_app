import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PanResponder, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { M3Icon } from './m3';
import { m3, scaled, type M3Shape } from '../theme';
import { useM3 } from '../context/responsive';
import { ROOM_FILL, VECTOR_ANNOTATIONS, VECTOR_ROOMS, type VectorAnnotation, type VectorFloor, type VectorRoom } from '../data/vectorMap';
import { hotspotForExhibitionId } from '../data/mapHotspots';

const WORLD_W = 1000;
const WORLD_H = 700;
const MAX_SCALE = 4;
const FIT_FALLBACK = Math.min(380 / WORLD_W, 380 / WORLD_H);

interface Props {
  floor: VectorFloor;
  selectedId: string | null;
  locId?: string | null;
  /** 現在地 (0〜1 の相対座標)。Googleマップ風の青いドットで表示する */
  selfPos?: { x: number; y: number } | null;
  /** 管理者が編集した部屋配置。未指定なら同梱の VECTOR_ROOMS を使う */
  roomsOverride?: VectorRoom[] | null;
  /** 管理者が編集した注記。未指定なら同梱の VECTOR_ANNOTATIONS を使う */
  annotationsOverride?: VectorAnnotation[] | null;
  /** 選択中の注記 index (管理者の配置編集でハイライトする) */
  selectedAnnotation?: number | null;
  /** 指定すると注記タップで index を返す (管理者の配置編集用) */
  onSelectAnnotation?: (index: number) => void;
  /** 指定すると地図タップで絶対位置 (0〜1 の相対座標) を返す作成モードになる */
  onPick?: (p: { x: number; y: number }) => void;
  /** onPick の座標を 0〜1 にクランプしない (管理者の枠外配置編集用) */
  pickUnclamped?: boolean;
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
export function VectorMapView({ floor, selectedId, locId, selfPos, roomsOverride, annotationsOverride, selectedAnnotation, onSelectAnnotation, onPick, pickUnclamped, roomsTappable, onSelect }: Props) {
  const { type, scale: uiScale } = useM3();
  const styles = useStyles();
  const [fit, setFit] = useState(FIT_FALLBACK);
  const [scale, setScale] = useState(FIT_FALLBACK);
  const [tx, setTx] = useState(0);
  const [ty, setTy] = useState(0);
  const state = useRef({ scale: FIT_FALLBACK, tx: 0, ty: 0, lastDist: 0, lastX: 0, lastY: 0, lastTap: 0, startX: 0, startY: 0, moved: false, pinch: false });
  const viewW = useRef(0);
  const viewH = useRef(0);
  const fitRef = useRef(FIT_FALLBACK);
  const didFitRef = useRef(false);
  const wrapRef = useRef<View>(null);
  const centeredSelfRef = useRef<string | null>(null);
  // mapWrap の画面上の位置 (ジェスチャー位置→ローカル座標の換算に使う)
  const wrapRectRef = useRef({ left: 0, top: 0, width: 0, height: 0 });
  // PanResponder は初回生成のクロージャを保持するため、最新の onPick を ref 経由で読む
  const onPickRef = useRef(onPick);
  useEffect(() => {
    onPickRef.current = onPick;
  }, [onPick]);
  const pickUnclampedRef = useRef(pickUnclamped);
  useEffect(() => {
    pickUnclampedRef.current = pickUnclamped;
  }, [pickUnclamped]);

  const rooms = useMemo(() => roomsOverride ?? VECTOR_ROOMS[floor] ?? [], [roomsOverride, floor]);

  // 部屋とは独立した注記 (階バッジ・「この階まで」・立入禁止など)
  const annotations = useMemo(
    () => annotationsOverride ?? VECTOR_ANNOTATIONS[floor] ?? [],
    [annotationsOverride, floor],
  );

  // 部屋の外接矩形 (世界 0..WORLD_W / 0..WORLD_H を必ず含む)。
  // 枠外に置かれた部屋にも fit とパン範囲を追従させる。
  const contentBounds = useMemo(() => {
    let minX = 0;
    let minY = 0;
    let maxX = WORLD_W;
    let maxY = WORLD_H;
    for (const r of rooms) {
      minX = Math.min(minX, r.x);
      minY = Math.min(minY, r.y);
      maxX = Math.max(maxX, r.x + r.w);
      maxY = Math.max(maxY, r.y + r.h);
    }
    return { minX, minY, maxX, maxY };
  }, [rooms]);
  const boundsRef = useRef(contentBounds);

  const calcFit = (vw: number, vh: number): number => {
    if (vw <= 0 || vh <= 0) return fitRef.current;
    // 内容全体が余白付きで収まる倍率 (初期表示=全体表示)
    const b = boundsRef.current;
    const w = Math.max(1, b.maxX - b.minX);
    const h = Math.max(1, b.maxY - b.minY);
    return Math.min(vw / w, vh / h) * 0.98;
  };

  const apply = (s: number, x: number, y: number) => {
    const minS = fitRef.current;
    const cs = clamp(s, minS, MAX_SCALE);
    const vw = viewW.current;
    const vh = viewH.current;
    const b = boundsRef.current;
    const contentW = Math.max(1, b.maxX - b.minX);
    const contentH = Math.max(1, b.maxY - b.minY);
    const ocx = (b.minX + b.maxX) / 2 - WORLD_W / 2;
    const ocy = (b.minY + b.maxY) / 2 - WORLD_H / 2;
    // スケール後の内容とはみ出し量からパン範囲を算出
    const overX = vw > 0 ? Math.max(0, (contentW * cs - vw) / 2) : 400;
    const overY = vh > 0 ? Math.max(0, (contentH * cs - vh) / 2) : 400;
    const margin = 60;
    const centerTx = -ocx * cs;
    const centerTy = -ocy * cs;
    const cx = clamp(x, centerTx - overX - margin, centerTx + overX + margin);
    const cy = clamp(y, centerTy - overY - margin, centerTy + overY + margin);
    state.current.scale = cs;
    state.current.tx = cx;
    state.current.ty = cy;
    setScale(cs);
    setTx(cx);
    setTy(cy);
  };

  // 内容中心を画面中央へ合わせて全体表示する
  const applyContentFit = (s: number) => {
    const b = boundsRef.current;
    const ocx = (b.minX + b.maxX) / 2 - WORLD_W / 2;
    const ocy = (b.minY + b.maxY) / 2 - WORLD_H / 2;
    apply(s, -ocx * s, -ocy * s);
  };

  // 外接矩形が変わったら fit を更新し、全体表示中なら追従させる
  useEffect(() => {
    boundsRef.current = contentBounds;
    const vw = viewW.current;
    const vh = viewH.current;
    if (vw <= 0 || vh <= 0) return;
    const prevFit = fitRef.current;
    const nextFit = calcFit(vw, vh);
    fitRef.current = nextFit;
    setFit(nextFit);
    if (didFitRef.current && Math.abs(state.current.scale - prevFit) < 0.01) {
      applyContentFit(nextFit);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentBounds]);

  // マップ枠の画面上の位置を測る (ジェスチャー位置のローカル座標換算に使う)
  const measureWrap = (cb: (left: number, top: number, width: number, height: number) => void) => {
    const node = wrapRef.current as unknown as {
      getBoundingClientRect?: () => { left: number; top: number; width: number; height: number };
      measureInWindow?: (fn: (x: number, y: number, w: number, h: number) => void) => void;
    } | null;
    const done = (left: number, top: number, width: number, height: number) => {
      wrapRectRef.current = { left, top, width, height };
      cb(left, top, width, height);
    };
    if (!node) {
      done(0, 0, viewW.current, viewH.current);
      return;
    }
    if (Platform.OS === 'web' && typeof node.getBoundingClientRect === 'function') {
      const r = node.getBoundingClientRect();
      done(r.left, r.top, r.width, r.height);
      return;
    }
    if (typeof node.measureInWindow === 'function') {
      node.measureInWindow((x, y, w, h) => done(x, y, w, h));
      return;
    }
    done(0, 0, viewW.current, viewH.current);
  };

  /**
   * ジェスチャー位置 (mapWrap ローカル座標) の下にあるワールド点を固定したまま
   * 拡大縮小する。screen = center + (world - worldCenter)*scale + t の関係から、
   * 基準点 P を固定する t を逆算する。
   */
  const zoomAt = (nextScale: number, localX: number, localY: number) => {
    const s0 = state.current.scale;
    const s1 = clamp(nextScale, fitRef.current, MAX_SCALE);
    if (s1 === s0) return;
    const ratio = s1 / s0;
    const cx = viewW.current / 2;
    const cy = viewH.current / 2;
    const tx1 = localX - cx - (localX - cx - state.current.tx) * ratio;
    const ty1 = localY - cy - (localY - cy - state.current.ty) * ratio;
    apply(s1, tx1, ty1);
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
      const r = node.getBoundingClientRect?.();
      const px = r ? e.clientX - r.left : viewW.current / 2;
      const py = r ? e.clientY - r.top : viewH.current / 2;
      const next = state.current.scale * (e.deltaY < 0 ? 1.15 : 1 / 1.15);
      zoomAt(next, px, py);
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
          // ジェスチャー位置→ローカル座標換算用に枠位置を更新 (web は同期)
          measureWrap(() => {});
          const touches = (e.nativeEvent as unknown as { touches?: { pageX: number; pageY: number }[] }).touches;
          if (touches && touches.length === 2) {
            const dx = touches[0].pageX - touches[1].pageX;
            const dy = touches[0].pageY - touches[1].pageY;
            state.current.pinch = true;
            state.current.lastDist = Math.sqrt(dx * dx + dy * dy);
          } else {
            state.current.pinch = false;
            state.current.lastDist = 0;
            state.current.lastX = e.nativeEvent.pageX;
            state.current.lastY = e.nativeEvent.pageY;
            state.current.startX = e.nativeEvent.pageX;
            state.current.startY = e.nativeEvent.pageY;
            state.current.moved = false;
            // ダブルタップでジェスチャー位置を基準にズーム (Googleマップ風)
            // eslint-disable-next-line react-hooks/purity
            const now = Date.now();
            if (now - state.current.lastTap < 300) {
              const next = state.current.scale >= MAX_SCALE ? fitRef.current : state.current.scale * 1.8;
              const localX = e.nativeEvent.pageX - wrapRectRef.current.left;
              const localY = e.nativeEvent.pageY - wrapRectRef.current.top;
              zoomAt(next, localX, localY);
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
            if (!state.current.pinch || state.current.lastDist <= 0) {
              // 2本目が触れた開始フレーム: 基準距離を取るだけで拡大縮小はしない
              // (古い lastDist と比較して誤った倍率ジャンプになるのを防ぐ)
              state.current.pinch = true;
              state.current.lastDist = dist;
              return;
            }
            // ピンチ中点を固定して拡大縮小する
            const midX = (touches[0].pageX + touches[1].pageX) / 2 - wrapRectRef.current.left;
            const midY = (touches[0].pageY + touches[1].pageY) / 2 - wrapRectRef.current.top;
            const next = state.current.scale * (dist / state.current.lastDist);
            state.current.lastDist = dist;
            zoomAt(next, midX, midY);
            return;
          }
          if (state.current.pinch) {
            // ピンチから指を1本離した直後: パン基準を取り直す (ジャンプ防止)
            state.current.pinch = false;
            state.current.lastDist = 0;
            state.current.lastX = e.nativeEvent.pageX;
            state.current.lastY = e.nativeEvent.pageY;
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
            const nx = wx / WORLD_W;
            const ny = wy / WORLD_H;
            cb(
              pickUnclampedRef.current
                ? { x: nx, y: ny }
                : { x: clamp(nx, 0, 1), y: clamp(ny, 0, 1) },
            );
          });
        },
        onPanResponderTerminate: () => {
          state.current.moved = false;
        },
      }),
    [],
  );

  // ボタン操作は画面中央を基準にする
  const zoomIn = () => zoomAt(state.current.scale * 1.4, viewW.current / 2, viewH.current / 2);
  const zoomOut = () => zoomAt(state.current.scale / 1.4, viewW.current / 2, viewH.current / 2);
  const reset = () => applyContentFit(fitRef.current);
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
  // 注記の文字・バッジも 1/scale で画面サイズを一定に保つ
  const annFontSize = useMemo(() => clamp(13 / scale, 5, 40), [scale]);
  const annBadgeSize = useMemo(() => clamp(50 / scale, 20, 130), [scale]);
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
            applyContentFit(nextFit);
          } else if (Math.abs(state.current.scale - prevFit) < 0.01) {
            // 全体表示のままサイズが変わったら追従
            applyContentFit(nextFit);
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
          // サイズ 0 以下は描画不能 (RN は負の width/height を扱えない) ため非表示
          if (r.w <= 0 || r.h <= 0) return null;
          const active = isActiveRoom(r);
          const isLoc = isLocRoom(r);
          const tappable =
            (roomsTappable ?? onPick == null) && (r.kind === 'class' || r.kind === 'jclass' || r.kind === 'club' || r.kind === 'outdoor');
          const body = (
            <View
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
              ]}
            >
              {r.label ? (
                <Text
                  style={[
                    type.labelMedium,
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
            </View>
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
        {annotations.map((a, i) => {
          const isBadge = a.kind === 'badge';
          const danger = a.tone === 'danger';
          const active = selectedAnnotation === i;
          const boxStyle = isBadge
            ? {
                left: a.x - annBadgeSize / 2,
                top: a.y - annBadgeSize / 2,
                width: annBadgeSize,
                height: annBadgeSize,
                borderRadius: annBadgeSize / 2,
              }
            : {
                left: a.x - (a.kind === 'note' ? 450 : 160),
                top: a.y,
                width: a.kind === 'note' ? 900 : 320,
              };
          const content = isBadge ? (
            <Text
              style={{ color: m3.inverseOnSurface, fontSize: annFontSize * 1.35, fontWeight: '700' }}
              allowFontScaling={false}
            >
              {a.text}
            </Text>
          ) : (
            <Text
              style={{
                color: danger ? m3.error : m3.onSurfaceVariant,
                fontSize: a.kind === 'note' ? annFontSize * 0.92 : annFontSize,
                fontWeight: danger ? '700' : '600',
                lineHeight: annFontSize * 1.25,
                textAlign: 'center',
              }}
              allowFontScaling={false}
            >
              {a.text}
            </Text>
          );
          const style = [
            isBadge ? styles.annBadge : styles.annTextWrap,
            boxStyle,
            active ? styles.annActive : null,
          ];
          if (!onSelectAnnotation) {
            return (
              <View key={`ann-${i}`} pointerEvents="none" accessible={false} style={style}>
                {content}
              </View>
            );
          }
          return (
            <Pressable
              key={`ann-${i}`}
              onPress={() => onSelectAnnotation(i)}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={`注記「${a.text}」を選択`}
              accessibilityState={{ selected: active }}
              style={style}
            >
              {content}
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
        <Text style={[type.labelMedium, styles.metaText]}>
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
        <Text style={[type.labelMedium, styles.metaText]}>高校教室</Text>
        <View style={[styles.legendSwatch, { backgroundColor: ROOM_FILL.jclass }]} />
        <Text style={[type.labelMedium, styles.metaText]}>中学教室</Text>
        <View style={[styles.legendSwatch, { backgroundColor: ROOM_FILL.club }]} />
        <Text style={[type.labelMedium, styles.metaText]}>特別教室</Text>
        <View style={[styles.legendSwatch, { backgroundColor: ROOM_FILL.outdoor }]} />
        <Text style={[type.labelMedium, styles.metaText]}>屋外</Text>
      </View>
    </View>
  );
}

function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    root: { width: scaled(380, s), maxWidth: '100%', alignSelf: 'center', gap: scaled(8, s) },
    mapWrap: {
      width: '100%',
      height: scaled(380, s),
      borderRadius: shape.card,
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
      borderRadius: scaled(10, s),
      justifyContent: 'center',
      alignItems: 'center',
      gap: scaled(2, s),
      padding: scaled(4, s),
    },
    locDot: { position: 'absolute', top: scaled(2, s), right: scaled(2, s) },
    selfAccuracy: { position: 'absolute', backgroundColor: 'rgba(26,115,232,0.16)' },
    selfDot: {
      position: 'absolute',
      backgroundColor: '#1A73E8',
      borderColor: '#FFFFFF',
      elevation: 4,
      boxShadow: '0 1px 4px rgba(0,0,0,0.4)',
    },
    activePin: {
      position: 'absolute',
      top: scaled(-8, s),
      width: scaled(16, s),
      height: scaled(16, s),
      borderRadius: scaled(8, s),
      backgroundColor: m3.primary,
      borderWidth: 2,
      borderColor: m3.onPrimary,
    },
    controlsRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: scaled(8, s),
      flexWrap: 'wrap',
    },
    controlsButtons: { flexDirection: 'row', gap: scaled(8, s), marginLeft: 'auto' },
    zoomBtn: {
      width: scaled(44, s),
      height: scaled(44, s),
      borderRadius: scaled(22, s),
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
    legend: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(6, s),
      flexWrap: 'wrap',
      paddingHorizontal: scaled(4, s),
    },
    legendSwatch: {
      width: scaled(14, s),
      height: scaled(14, s),
      borderRadius: scaled(4, s),
      borderWidth: 1,
      borderColor: m3.outlineVariant,
    },
    annBadge: {
      position: 'absolute',
      backgroundColor: m3.inverseSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    annTextWrap: { position: 'absolute', alignItems: 'center' },
    annActive: { borderWidth: 3, borderColor: m3.primary, borderStyle: 'dashed' },
  });
}

function useStyles() {
  const { scale, shape } = useM3();
  return React.useMemo(() => createStyles(scale, shape), [scale, shape]);
}
