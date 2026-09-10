import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, type StyleProp, type ViewStyle } from 'react-native';
import { useFocusEffect } from 'expo-router';
import Animated, {
  FadeIn,
  FadeInDown,
  FadeOut,
  ReduceMotion,
  ZoomIn,
  ZoomOut,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { m3 } from '../theme';

/**
 * reanimated ベースの共通アニメーションプリミティブ。
 * entering アニメーション (UI スレッド駆動) 中心で、JS 側の worklet は
 * Pulse の無限ループのみに限定する。表示時間は 150〜300ms に抑える。
 */

/** 基準時間 (ms)。enter 系は 150〜300ms に収める。 */
export const ANIM_MS = {
  screen: 180,
  rise: 220,
  modal: 220,
  modalOut: 150,
  staggerStep: 40,
  staggerCap: 280,
} as const;

/** リスト何番目かを遅延(ms)に変換する。上限で頭打ちして長リストでも待たせない。 */
export function staggerDelay(index: number, step = ANIM_MS.staggerStep, cap = ANIM_MS.staggerCap): number {
  return Math.min(Math.max(index, 0) * step, cap);
}

type WrapProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/**
 * タブはマウント維持のため entering が初回しか発火しない。
 * フォーカス復帰時に inner View を再マウントして entering を再再生する。
 * 初回マウント直後のフォーカス発火は二重再生になるためスキップする。
 */
function useFocusReplayKey(): number {
  const [key, setKey] = useState(0);
  const first = useRef(true);
  useFocusEffect(
    useCallback(() => {
      if (first.current) {
        first.current = false;
        return;
      }
      setKey((v) => v + 1);
    }, []),
  );
  return key;
}

/** 画面全体の初回表示用。短いフェードのみ。フォーカス復帰で再再生する。 */
export function ScreenFade({ children, style }: WrapProps) {
  const replayKey = useFocusReplayKey();
  return (
    <Animated.View
      key={replayKey}
      entering={FadeIn.duration(ANIM_MS.screen).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

type RiseProps = WrapProps & {
  /** マウント時の遅延 (ms)。スタッガーは Stagger を使うこと。 */
  delay?: number;
};

/** マウント時＋フォーカス復帰時にフェードしながら少し下から上がってくる既定の出現演出。 */
export function Rise({ children, style, delay = 0 }: RiseProps) {
  const replayKey = useFocusReplayKey();
  return (
    <Animated.View
      key={replayKey}
      entering={FadeInDown.duration(ANIM_MS.rise).delay(delay).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

type StaggerProps = WrapProps & {
  /** リスト内の位置 (0 始まり)。遅延は staggerDelay で上限付きに変換する。 */
  index: number;
};

/** リスト項目のスタッガー表示用。index から遅延を決める Rise の薄いラッパー。フォーカス復帰で再再生する。 */
export function Stagger({ children, style, index }: StaggerProps) {
  const replayKey = useFocusReplayKey();
  return (
    <Animated.View
      key={replayKey}
      entering={FadeInDown.duration(ANIM_MS.rise).delay(staggerDelay(index)).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

type PopProps = WrapProps & {
  /** 閉じるときの縮小演出 (Modal の exiting など)。不要なら false。 */
  exiting?: boolean;
};

/** モーダル内容のスケールイン用。開閉ロジックには触れず見た目だけ担う。 */
export function Pop({ children, style, exiting = true }: PopProps) {
  return (
    <Animated.View
      entering={ZoomIn.duration(ANIM_MS.modal).reduceMotion(ReduceMotion.System)}
      exiting={exiting ? ZoomOut.duration(ANIM_MS.modalOut).reduceMotion(ReduceMotion.System) : undefined}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** モーダルの暗幕フェード用。開閉ロジックには触れない。 */
export function FadeOverlay({ children, style }: WrapProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(ANIM_MS.screen).reduceMotion(ReduceMotion.System)}
      exiting={FadeOut.duration(ANIM_MS.modalOut).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

type PulseProps = WrapProps & {
  /** 薄くなるときの不透明度 (0〜1)。 */
  minOpacity?: number;
  /** 片道の時間 (ms)。連続点滅のため enter 系より長めに取っている。 */
  duration?: number;
};

/** スケルトン/ローディングの脈動用。不透明度だけを UI スレッドで往復させる。 */
export function Pulse({ children, style, minOpacity = 0.35, duration = 800 }: PulseProps) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(minOpacity, { duration }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity, minOpacity, duration]);
  const animatedStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, animatedStyle]}>{children}</Animated.View>;
}

/** スケルトンの箱。Pulse と m3 配色だけの見た目で文言は持たない。 */
export function SkeletonBox({
  height = 140,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  return (
    <Pulse style={style}>
      <Animated.View style={[styles.skeleton, { height }]} />
    </Pulse>
  );
}

/** 一覧ローディング用のスケルトン3行。文言なし・Pulseのみ。 */
export function SkeletonRows({ count = 3, height = 84 }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <Stagger key={i} index={i}>
          <SkeletonBox height={height} />
        </Stagger>
      ))}
    </>
  );
}

type ScanBeamProps = {
  /** 走査範囲の高さ (dp)。ビームがこの範囲を往復する。 */
  height?: number;
};

/**
 * QRファインダー内の走査ビーム。UIスレッドで上下に往復する細い帯。
 * 読み取り中であることの視覚キュー (音・振動の代替)。
 */
export function ScanBeam({ height = 220 }: ScanBeamProps) {
  const y = useSharedValue(0);
  useEffect(() => {
    y.value = withRepeat(withSequence(withTiming(height, { duration: 1400 }), withTiming(0, { duration: 1400 })), -1, false);
    return () => cancelAnimation(y);
  }, [y, height]);
  const beamStyle = useAnimatedStyle(() => ({ transform: [{ translateY: y.value }] }));
  return (
    <Animated.View style={[styles.scanBeam, beamStyle]} />
  );
}

/**
 * 成功時のチェック演出。スプリングで弾む円形バッジ。
 * QR読取成功・投票確定などの肯定フィードバック用。中身は呼び出し側で重ねる。
 */
export function SuccessCheck({ size = 64, children }: { size?: number; children?: React.ReactNode }) {
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(9).stiffness(180).reduceMotion(ReduceMotion.System)}
      style={[styles.successCircle, { width: size, height: size, borderRadius: size / 2 }]}
      accessibilityRole="none"
    >
      {children}
    </Animated.View>
  );
}

/**
 * 投票ハート等の確定バッジ用。小さく弾んで注目を集める。
 * key を変えて再マウントさせると再再生する。
 */
export function ConfirmPop({ children, style }: WrapProps) {
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(10).stiffness(220).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** タブ切替・カード出現時のポップ。スプリングで軽く弾む。 */
export function TabPop({ children, style }: WrapProps) {
  return (
    <Animated.View
      entering={ZoomIn.springify().damping(12).stiffness(260).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

/** ヒーローカードの注意引き用グロー。透明度だけを往復させる。 */
export function HeroGlow({ children, style }: WrapProps) {
  const opacity = useSharedValue(1);
  useEffect(() => {
    opacity.value = withRepeat(withTiming(0.92, { duration: 1600 }), -1, true);
    return () => cancelAnimation(opacity);
  }, [opacity]);
  const glowStyle = useAnimatedStyle(() => ({ opacity: opacity.value }));
  return <Animated.View style={[style, glowStyle]}>{children}</Animated.View>;
}

/** 一覧カードのプレス時スケール用ラッパー。M3Touchと併用する。 */
export function PressScale({ children, style }: WrapProps) {
  return (
    <Animated.View
      entering={FadeIn.duration(ANIM_MS.screen).reduceMotion(ReduceMotion.System)}
      style={style}
    >
      {children}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    width: '100%',
    borderRadius: 20,
    backgroundColor: m3.surfaceContainerHighest,
    borderWidth: 1,
    borderColor: m3.outlineVariant,
  },
  scanBeam: {
    position: 'absolute',
    left: 8,
    right: 8,
    top: 0,
    height: 3,
    borderRadius: 2,
    backgroundColor: m3.inversePrimary,
  },
  successCircle: {
    backgroundColor: m3.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
