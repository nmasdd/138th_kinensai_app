import React, { useEffect } from 'react';
import { StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { m3 } from '../theme';

/**
 * Apple HIG に沿った控えめなモーション。
 * - モーションは装飾ではなく「状態変化の伝達・操作フィードバック」のために使う。
 * - 動きは短く (200〜300ms)、自然なスプリングで終える。
 * - OS の「視差効果を減らす」(Reduce Motion) が有効なら移動を止め、
 *   フェードのみ（または即時表示）に切り替える。
 * - 画面遷移など大きな動きは各画面側 (Stack/Tabs) が担当し、ここは要素単位。
 */

/** 標準のスプリング。行き過ぎを抑えた自然な減速。 */
const springIn = { damping: 18, stiffness: 220, mass: 0.7 } as const;
/** ポップ用。少しだけ跳ねて「決まった」ことを伝える。 */
const springPop = { damping: 12, stiffness: 320, mass: 0.6 } as const;

const ENTER_MS = 260;
const RISE_DISTANCE = 14;

type EnterOptions = {
  delay?: number;
  /** 開始時の縦オフセット (dp)。0 ならフェードのみ。 */
  translateY?: number;
  /** 開始時の縮小率。1 ならスケール変化なし。 */
  scaleFrom?: number;
  /** スプリングで入るか (既定はイージング)。 */
  spring?: boolean;
  /** スプリングを跳ねさせるか。 */
  pop?: boolean;
};

/**
 * 出現時に「フェード + わずかな移動/拡大」を行う共通アニメーション。
 * Reduce Motion 時は移動せず即時表示する。
 */
function useEnter({ delay = 0, translateY = 0, scaleFrom = 1, spring = false, pop = false }: EnterOptions) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    const target = spring || pop
      ? withSpring(1, pop ? springPop : springIn)
      : withTiming(1, { duration: ENTER_MS, easing: Easing.out(Easing.cubic) });
    progress.value = delay > 0 ? withDelay(delay, target) : target;
  }, [delay, pop, progress, reduced, spring]);

  return useAnimatedStyle(() => {
    const p = progress.value;
    return {
      opacity: p,
      transform: [{ translateY: (1 - p) * translateY }, { scale: scaleFrom + (1 - scaleFrom) * p }],
    };
  });
}

/** リスト項目の連続表示ディレイ。長くなりすぎないよう上限を設ける。 */
function staggerDelay(index: number) {
  const i = Number.isFinite(index) ? Math.max(0, index) : 0;
  return Math.min(i * 45, 280);
}

type WrapProps = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
};

/** 画面全体のラッパー。フェード + ごく僅かな拡大で現れる。 */
export function ScreenFade({ children, style }: WrapProps) {
  const anim = useEnter({ scaleFrom: 0.985 });
  return (
    <Animated.View style={[style, anim]}>{children}</Animated.View>
  );
}

type RiseProps = WrapProps & {
  /** 出現ディレイ (ms)。 */
  delay?: number;
};

/** 下からわずかにせり上がって現れるラッパー。 */
export function Rise({ children, style, delay = 0 }: RiseProps) {
  const anim = useEnter({ delay, translateY: RISE_DISTANCE });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

type StaggerProps = WrapProps & {
  /** 一覧内の位置。index に応じて遅延を付ける。 */
  index: number;
};

/** リスト項目ラッパー。順に少しずつ遅れて現れる。 */
export function Stagger({ children, style, index }: StaggerProps) {
  const anim = useEnter({ delay: staggerDelay(index), translateY: 8 });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** モーダル内容ラッパー。中心からポップして現れる。 */
export function Pop({ children, style }: WrapProps) {
  const anim = useEnter({ scaleFrom: 0.92, translateY: 10, spring: true });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** モーダル暗幕ラッパー。フェードインのみ。 */
export function FadeOverlay({ children, style }: WrapProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(reduced ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withTiming(1, { duration: 200, easing: Easing.out(Easing.quad) });
  }, [progress, reduced]);

  const anim = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

type PulseProps = WrapProps & {
  /** 最小不透明度 (既定 0.55)。 */
  minOpacity?: number;
  /** 1 周期の時間 (ms、既定 1400)。 */
  duration?: number;
};

/** 注意を引くためのゆっくりした明滅。Reduce Motion 時は静止。 */
export function Pulse({ children, style, minOpacity = 0.55, duration = 1400 }: PulseProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(minOpacity, { duration, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [duration, minOpacity, progress, reduced]);

  const anim = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** スケルトンの箱。読み込み中を示す控えめな明滅。 */
export function SkeletonBox({
  height = 140,
  style,
}: {
  height?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(1);

  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(0.5, { duration: 700, easing: Easing.inOut(Easing.quad) }),
        withTiming(1, { duration: 700, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      true,
    );
  }, [progress, reduced]);

  const anim = useAnimatedStyle(() => ({ opacity: progress.value }));
  return <Animated.View style={[styles.skeleton, { height }, style, anim]} />;
}

/** 一覧ローディング用のスケルトン3行。 */
export function SkeletonRows({ count = 3, height = 84 }: { count?: number; height?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <SkeletonBox key={i} height={height} />
      ))}
    </>
  );
}

type ScanBeamProps = {
  /** 走査範囲の高さ (dp)。この範囲を上下する。 */
  height?: number;
};

/** QRファインダー内の走査ライン。上下に往復する。 */
export function ScanBeam({ height = 220 }: ScanBeamProps) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(0);

  useEffect(() => {
    if (reduced) {
      progress.value = 0.5;
      return;
    }
    progress.value = withRepeat(
      withSequence(
        withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
        withTiming(0, { duration: 1100, easing: Easing.inOut(Easing.quad) }),
      ),
      -1,
      false,
    );
  }, [progress, reduced]);

  const anim = useAnimatedStyle(() => ({
    transform: [{ translateY: (progress.value - 0.5) * height }],
  }));
  return <Animated.View style={[styles.scanBeam, { top: height / 2 }, anim]} />;
}

/** 成功時の円形バッジ。ポップして現れる。 */
export function SuccessCheck({ size = 64, children }: { size?: number; children?: React.ReactNode }) {
  const anim = useEnter({ scaleFrom: 0.4, spring: true, pop: true });
  return (
    <Animated.View
      style={[styles.successCircle, { width: size, height: size, borderRadius: size / 2 }, anim]}
      accessibilityRole="none"
    >
      {children}
    </Animated.View>
  );
}

/** 確定バッジ用ラッパー。小さく跳ねて現れる。 */
export function ConfirmPop({ children, style }: WrapProps) {
  const anim = useEnter({ scaleFrom: 0.4, spring: true, pop: true });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** ポップ用ラッパー。 */
export function TabPop({ children, style }: WrapProps) {
  const anim = useEnter({ scaleFrom: 0.8, spring: true });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** ヒーロー用のフェード + わずかな拡大。 */
export function HeroGlow({ children, style }: WrapProps) {
  const anim = useEnter({ scaleFrom: 0.97, delay: 20 });
  return <Animated.View style={[style, anim]}>{children}</Animated.View>;
}

/** 押下で沈み込むカード用ラッパー (静的な見た目が必要な場合に使用)。 */
export function PressScale({ children, style }: WrapProps) {
  return <View style={style}>{children}</View>;
}

/** タブ選択のオレンジピル。選択状態をフェード + 拡大で切り替える。 */
export function TabHighlight({ active }: { active: boolean }) {
  const reduced = useReducedMotion();
  const progress = useSharedValue(active ? 1 : 0);

  useEffect(() => {
    if (reduced) {
      progress.value = active ? 1 : 0;
      return;
    }
    progress.value = withTiming(active ? 1 : 0, { duration: 200, easing: Easing.out(Easing.cubic) });
  }, [active, progress, reduced]);

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ scale: 0.7 + 0.3 * progress.value }],
  }));
  return <Animated.View pointerEvents="none" style={[styles.tabHighlight, anim]} />;
}

const styles = StyleSheet.create({
  tabHighlight: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    borderRadius: 999,
    backgroundColor: m3.secondaryContainer,
  },
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
