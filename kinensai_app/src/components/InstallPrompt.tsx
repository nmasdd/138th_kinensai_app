import React, { useEffect } from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { M3Icon, M3Touch } from './m3';
import { m3, scaled, type M3Shape } from '../theme';
import { useM3 } from '../context/responsive';
import {
  autoShowInstall,
  dismissInstall,
  initInstall,
  installNow,
  useInstallState,
  watchInstalled,
  type InstallMode,
} from '../utils/installPrompt';

/**
 * PWA のインストールを促す画面下部バナー (Web 専用)。
 * Chrome 系はタップでブラウザ純正のインストール確認を出し、
 * iOS 等は「ホーム画面に追加」の手順を案内する。
 * React Native 版では何も描画しない (ネイティブはストア配布のため)。
 */
export function InstallPrompt() {
  const insets = useSafeAreaInsets();
  const styles = useStyles();
  const { type, scale: s } = useM3();
  const reduced = useReducedMotion();
  const { visible, mode } = useInstallState();
  const progress = useSharedValue(reduced ? 1 : 0);

  // 起動時の自動表示と、インストール完了の監視
  useEffect(() => {
    let stop: (() => void) | null = null;
    let cancelled = false;
    void initInstall().then(() => {
      if (cancelled) return;
      stop = autoShowInstall();
    });
    const unwatch = watchInstalled();
    return () => {
      cancelled = true;
      stop?.();
      unwatch();
    };
  }, []);

  // 出現アニメーション (HIG: 短く自然なスプリング・Reduce Motion 尊重)
  useEffect(() => {
    if (reduced) {
      progress.value = 1;
      return;
    }
    progress.value = withSpring(1, { damping: 20, stiffness: 260, mass: 0.7 });
  }, [progress, reduced]);

  const anim = useAnimatedStyle(() => ({
    opacity: progress.value,
    transform: [{ translateY: (1 - progress.value) * 24 }],
  }));

  if (Platform.OS !== 'web' || !visible) return null;

  const copy = bannerCopy(mode);

  return (
    <View style={[styles.overlay, { paddingBottom: Math.max(insets.bottom, scaled(12, s)) }]}>
      <Animated.View style={[styles.banner, anim]}>
        <View style={styles.row}>
          <View style={styles.iconWrap}>
            <M3Icon name={mode === 'ios' ? 'ios-share' : 'download-for-offline'} color={m3.onPrimaryContainer} />
          </View>
          <View style={styles.textWrap}>
            <Text style={[type.titleMedium, { color: m3.onSurface }]}>{copy.title}</Text>
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>{copy.body}</Text>
          </View>
          <M3Touch onPress={dismissInstall} label="閉じる" round style={styles.close}>
            <M3Icon name="close" size={20} color={m3.onSurfaceVariant} />
          </M3Touch>
        </View>
        <View style={styles.actions}>
          {copy.secondary ? (
            <BannerButton label={copy.secondary} onPress={dismissInstall} variant="text" />
          ) : null}
          <BannerButton
            label={copy.primary}
            onPress={mode === 'chromium' ? () => void installNow() : dismissInstall}
            variant="filled"
          />
        </View>
      </Animated.View>
    </View>
  );
}

function bannerCopy(mode: InstallMode): { title: string; body: string; primary: string; secondary?: string } {
  if (mode === 'chromium') {
    return {
      title: 'アプリをインストール',
      body: 'ホーム画面に追加すると、すぐに起動できてオフラインでも使えます。',
      primary: 'インストール',
      secondary: 'あとで',
    };
  }
  if (mode === 'ios') {
    return {
      title: 'アプリをインストール',
      body: 'Safari の共有ボタン (□に上矢印) をタップし、「ホーム画面に追加」を選んでください。',
      primary: '閉じる',
    };
  }
  return {
    title: 'アプリをインストール',
    body: 'ブラウザのメニューから「アプリをインストール」または「ホーム画面に追加」を選んでください。',
    primary: '閉じる',
  };
}

/** バナー内のコンパクトなアクション (filled=塗り / text=文字のみ)。 */
function BannerButton({
  label,
  onPress,
  variant,
}: {
  label: string;
  onPress: () => void;
  variant: 'filled' | 'text';
}) {
  const styles = useStyles();
  const { type } = useM3();
  const filled = variant === 'filled';
  return (
    <M3Touch onPress={onPress} label={label} round>
      <View style={[styles.action, filled ? styles.actionFilled : styles.actionText]}>
        <Text style={[type.labelLarge, { color: filled ? m3.onPrimary : m3.primary }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </M3Touch>
  );
}

function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    overlay: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      justifyContent: 'flex-end',
      paddingHorizontal: scaled(12, s),
      // バナー以外のタップは下の画面へ通す
      pointerEvents: 'box-none',
    },
    banner: {
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: shape.card,
      borderWidth: 1,
      borderColor: m3.outlineVariant,
      padding: scaled(16, s),
      gap: scaled(12, s),
      elevation: 3,
      boxShadow: '0 4px 12px rgba(0,0,0,0.18)',
      maxWidth: scaled(560, s),
      width: '100%',
      alignSelf: 'center',
    },
    row: { flexDirection: 'row', alignItems: 'flex-start', gap: scaled(12, s) },
    iconWrap: {
      width: scaled(40, s),
      height: scaled(40, s),
      borderRadius: scaled(20, s),
      backgroundColor: m3.primaryContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    textWrap: { flex: 1, gap: scaled(2, s) },
    close: {
      width: scaled(36, s),
      height: scaled(36, s),
      justifyContent: 'center',
      alignItems: 'center',
    },
    actions: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
      alignItems: 'center',
      gap: scaled(8, s),
    },
    action: {
      minHeight: scaled(40, s),
      justifyContent: 'center',
      alignItems: 'center',
      paddingHorizontal: scaled(16, s),
      borderRadius: shape.pill,
    },
    actionFilled: { backgroundColor: m3.primary },
    actionText: { backgroundColor: 'transparent' },
  });
}

function useStyles() {
  const { scale: s, shape } = useM3();
  return React.useMemo(() => createStyles(s, shape), [s, shape]);
}
