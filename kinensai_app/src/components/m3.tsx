import React from 'react';
import {
  AccessibilityRole,
  ActivityIndicator,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  View,
  type StyleProp,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import Animated, {
  useAnimatedStyle,
  useReducedMotion,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import { m3, scaled, type M3Shape } from '../theme';
import { useM3 } from '../context/responsive';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

const PRESS_SCALE = 0.96;

/**
 * リップル付きのタップ面。押下時にわずかに沈み込み、
 * 指を離すと自然なスプリングで戻る (HIG: 操作フィードバック)。
 * Reduce Motion 時はスケールせずリップルのみ。
 */
export function M3Touch({
  children,
  onPress,
  style,
  round = false,
  label,
  role = 'button',
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  round?: boolean;
  label?: string;
  role?: AccessibilityRole;
}) {
  const styles = useStyles();
  const reduced = useReducedMotion();
  const scale = useSharedValue(1);

  const anim = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  const pressIn = () => {
    if (reduced) return;
    scale.set(withSpring(PRESS_SCALE, { damping: 20, stiffness: 400, mass: 0.5 }));
  };
  const pressOut = () => {
    if (reduced) return;
    scale.set(withSpring(1, { damping: 16, stiffness: 300, mass: 0.6 }));
  };

  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole={role}
      android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: false }}
      onPress={onPress}
      onPressIn={pressIn}
      onPressOut={pressOut}
      style={[round && styles.roundClip, style]}
    >
      <Animated.View style={anim}>{children}</Animated.View>
    </Pressable>
  );
}

export function M3Icon({ name, size = 24, color = m3.onSurface }: { name: IconName; size?: number; color?: string }) {
  const { scale } = useM3();
  return <MaterialIcons name={name} size={scaled(size, scale)} color={color} />;
}

/** 高さ 64 のスモールトップアプリバー。左 menu→メニュー、右 notifications→通知。 */
export function TopAppBar({ title }: { title: string }) {
  const styles = useStyles();
  const { type } = useM3();
  return (
    <View style={styles.appBar} accessibilityRole="header">
      <Pressable
        accessibilityLabel="メニューを開く"
        accessibilityRole="button"
        android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
        onPress={() => router.push('/menu')}
        style={styles.appBarIcon}
      >
        <M3Icon name="menu" />
      </Pressable>
      <Text style={[type.titleLarge, styles.appBarTitle]} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        accessibilityLabel="通知を開く"
        accessibilityRole="button"
        android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
        onPress={() => router.push('/notifications')}
        style={styles.appBarIcon}
      >
        <M3Icon name="notifications" />
      </Pressable>
    </View>
  );
}

type ButtonVariant = 'filled' | 'tonal' | 'outlined';

/** 高さ 56 のミディアムボタン。角はピル型。 */
export function M3Button({
  label,
  icon,
  variant = 'filled',
  onPress,
  style,
}: {
  label: string;
  icon?: IconName;
  variant?: ButtonVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { type } = useM3();
  const bg =
    variant === 'filled' ? m3.primary : variant === 'tonal' ? m3.secondaryContainer : 'transparent';
  const fg =
    variant === 'filled' ? m3.onPrimary : variant === 'tonal' ? m3.onSecondaryContainer : m3.primary;
  return (
    <M3Touch onPress={onPress} label={label} round>
      <View style={[styles.button, { backgroundColor: bg }, variant === 'outlined' && styles.buttonOutlined, style]}>
        {icon && <M3Icon name={icon} size={20} color={fg} />}
        <Text style={[type.labelLarge, { color: fg, flexShrink: 1 }]} numberOfLines={1}>
          {label}
        </Text>
      </View>
    </M3Touch>
  );
}

/** 高さ 56・ピル型の検索バー。先頭 search、末尾 mic/clear。 */
export function M3SearchBar({
  value,
  onChangeText,
  placeholder = '検索',
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder?: string;
}) {
  const styles = useStyles();
  return (
    <View style={styles.searchBar}>
      <M3Icon name="search" color={m3.onSurfaceVariant} />
      <TextInput
        accessibilityLabel={placeholder}
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={m3.onSurfaceVariant}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <M3Touch onPress={() => onChangeText('')} label="入力を消去" round style={styles.searchAction}>
          <M3Icon name="clear" color={m3.onSurfaceVariant} />
        </M3Touch>
      ) : (
        <M3Touch
          onPress={() => {
            // ToastAndroid は Android 専用のため Web/iOS では何もしない
            if (Platform.OS === 'android') {
              ToastAndroid.show('音声検索は準備中です', ToastAndroid.SHORT);
            }
          }}
          label="音声検索"
          round
          style={styles.searchAction}
        >
          <M3Icon name="mic" color={m3.onSurfaceVariant} />
        </M3Touch>
      )}
    </View>
  );
}

type CardVariant = 'filled' | 'elevated' | 'outlined';

/** 角丸 20 のカード。filled=Highest / elevated=Low+影 / outlined=枠線。 */
export function M3Card({
  children,
  variant = 'filled',
  onPress,
  style,
}: {
  children: React.ReactNode;
  variant?: CardVariant;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const inner = (
    <View
      style={[
        styles.card,
        variant === 'filled' && { backgroundColor: m3.surfaceContainerHighest },
        variant === 'elevated' && { backgroundColor: m3.surfaceContainerLow },
        variant === 'outlined' && { backgroundColor: m3.surface, borderWidth: 1, borderColor: m3.outlineVariant },
        variant === 'elevated' && styles.cardShadow,
        style,
      ]}
    >
      {children}
    </View>
  );
  if (!onPress) return inner;
  return (
    <M3Touch onPress={onPress} round>
      {inner}
    </M3Touch>
  );
}

/** 画像領域のプレースホルダー (image アイコン付き)。 */
export function M3ImagePlaceholder({ height = 140 }: { height?: number }) {
  const styles = useStyles();
  const { scale } = useM3();
  return (
    <View style={[styles.imagePh, { height: scaled(height, scale) }]}>
      <M3Icon name="image" size={40} color={m3.onSurfaceVariant} />
    </View>
  );
}

/** トーナル FAB。画面端から 16dp 離して影 Level 3。 */
export function M3FAB({
  icon,
  onPress,
  label,
  small = false,
  style,
}: {
  icon: IconName;
  onPress?: () => void;
  label?: string;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const styles = useStyles();
  const { scale, shape } = useM3();
  const size = scaled(small ? 48 : 56, scale);
  return (
    <M3Touch onPress={onPress} label={label} round>
      <View
        style={[
          styles.fab,
          { width: size, height: size, borderRadius: small ? shape.fabSmall : shape.fab, backgroundColor: m3.primaryContainer },
          style,
        ]}
      >
        <M3Icon name={icon} color={m3.onPrimaryContainer} />
      </View>
    </M3Touch>
  );
}

/** トーナルアイコンボタン (48dp 円形)。 */
export function M3IconButton({
  icon,
  onPress,
  label,
  selected = false,
}: {
  icon: IconName;
  onPress?: () => void;
  label?: string;
  selected?: boolean;
}) {
  const styles = useStyles();
  return (
    <M3Touch onPress={onPress} label={label} round>
      <View
        style={[
          styles.tonalIcon,
          { backgroundColor: selected ? m3.primaryContainer : m3.secondaryContainer },
        ]}
      >
        <M3Icon name={icon} color={selected ? m3.onPrimaryContainer : m3.onSecondaryContainer} />
      </View>
    </M3Touch>
  );
}

/** M3 プライマリタブ。高さ 56、選択中は primary 文字 + ラベル幅 3dp インジケータ。 */
export function M3PrimaryTabs({
  labels,
  value,
  onValueChange,
}: {
  labels: string[];
  value: number;
  onValueChange: (i: number) => void;
}) {
  const styles = useStyles();
  const { type } = useM3();
  return (
    <View style={styles.tabs}>
      {labels.map((label, i) => {
        const active = i === value;
        return (
          <M3Touch key={label} onPress={() => onValueChange(i)} label={label} role="tab" style={styles.tabItem}>
            <View style={styles.tab} accessibilityState={{ selected: active }}>
              <Text
                numberOfLines={1}
                style={[type.titleMedium, { color: active ? m3.primary : m3.onSurfaceVariant }]}
              >
                {label}
              </Text>
              <View style={[styles.tabIndicator, active && { backgroundColor: m3.primary }]} />
            </View>
          </M3Touch>
        );
      })}
    </View>
  );
}

export type ListPosition = 'single' | 'top' | 'middle' | 'bottom';

/** 高さ 72 のリスト項目。Expressive の連結形状 (外28/内8・隙間3) 用に position を指定。 */
export function M3ListItem({
  icon,
  title,
  sub,
  onPress,
  position = 'single',
}: {
  icon: IconName;
  title: string;
  sub?: string;
  onPress?: () => void;
  position?: ListPosition;
}) {
  const styles = useStyles();
  const { type, shape } = useM3();
  const radius: ViewStyle =
    position === 'single'
      ? { borderRadius: shape.dialog }
      : position === 'top'
        ? { borderTopLeftRadius: shape.dialog, borderTopRightRadius: shape.dialog, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }
        : position === 'bottom'
          ? { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: shape.dialog, borderBottomRightRadius: shape.dialog }
          : { borderRadius: 8 };
  return (
    <M3Touch onPress={onPress} label={title} round>
      <View style={[styles.listItem, radius]}>
        <View style={styles.listIcon}>
          <M3Icon name={icon} color={m3.onPrimaryContainer} />
        </View>
        <View style={styles.listText}>
          <Text style={[type.bodyLarge, { color: m3.onSurface }]} numberOfLines={1}>
            {title}
          </Text>
          {sub ? (
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={2}>
              {sub}
            </Text>
          ) : null}
        </View>
      </View>
    </M3Touch>
  );
}

const textBase: TextStyle = {};

/** 中央寄せのローディング表示。見出しや説明は呼び出し側の既存文言を使う。 */
export function M3LoadingView() {
  const styles = useStyles();
  return (
    <View style={styles.loadingView}>
      <ActivityIndicator size="large" color={m3.primary} />
    </View>
  );
}

/** 中央寄せの空状態表示。アイコン + 呼び出し側の既存文言を並べる。 */
export function M3EmptyState({ icon, children }: { icon: IconName; children: React.ReactNode }) {
  const styles = useStyles();
  return (
    <View style={styles.emptyState}>
      <View style={styles.emptyIcon}>
        <M3Icon name={icon} size={40} color={m3.onSurfaceVariant} />
      </View>
      {children}
    </View>
  );
}

export function M3Headline({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { type } = useM3();
  return <Text style={[type.headlineMedium, { color: m3.onSurface }, textBase, style]}>{children}</Text>;
}

/**
 * 安全な戻る遷移。履歴がない直接アクセス時は警告 (GO_BACK not handled)
 * を出さず指定フォールバックへ replace する。
 */
export function goBackOrHome(fallback: Parameters<typeof router.replace>[0] = '/' as never) {
  try {
    if (router.canGoBack()) {
      router.back();
      return;
    }
  } catch {
    // canGoBack が使えない環境ではフォールバックへ
  }
  router.replace(fallback);
}

/** M3 scrim (モーダル背景)。直書き rgba の代わりに使う。 */
export const m3scrim = 'rgba(0,0,0,0.4)' as const;

/** M3 区切り線。 */
export function M3Divider({ style }: { style?: StyleProp<ViewStyle> }) {
  return <View style={[{ height: 1, backgroundColor: m3.outlineVariant }, style]} />;
}

/** M3 バッジ (開催中・投票中などの状態表示)。 */
export function M3Badge({ label }: { label: string }) {
  const styles = useStyles();
  const { type } = useM3();
  return (
    <View style={styles.badge}>
      <Text style={[type.labelMedium, { color: m3.onPrimary }]}>{label}</Text>
    </View>
  );
}

/** M3 フィルターチップ。選択状態を accessibilityState でも通知する。 */
export function M3FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  const styles = useStyles();
  const { type } = useM3();
  return (
    <M3Touch onPress={onPress} label={label} role="button" round>
      <View
        style={[styles.chip, selected && styles.chipActive]}
        accessibilityState={{ selected }}
      >
        <Text style={[type.labelLarge, { color: selected ? m3.onSecondaryContainer : m3.onSurfaceVariant }]}>
          {label}
        </Text>
      </View>
    </M3Touch>
  );
}

/** 画面幅の倍率 s に応じたスタイルを生成する。 */
function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    roundClip: { borderRadius: shape.pill },
    appBar: {
      height: scaled(64, s),
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: m3.surface,
      paddingHorizontal: scaled(4, s),
      borderBottomWidth: 1,
      borderBottomColor: m3.outlineVariant,
    },
    appBarIcon: {
      width: scaled(48, s),
      height: scaled(48, s),
      justifyContent: 'center',
      alignItems: 'center',
      borderRadius: scaled(24, s),
    },
    appBarTitle: { flex: 1, textAlign: 'center', color: m3.onSurface },
    button: {
      minHeight: scaled(56, s),
      borderRadius: shape.pill,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scaled(8, s),
      paddingHorizontal: scaled(24, s),
      paddingVertical: scaled(8, s),
      minWidth: 0,
    },
    buttonOutlined: { borderWidth: 1, borderColor: m3.outline },
    searchBar: {
      height: scaled(56, s),
      borderRadius: shape.pill,
      backgroundColor: m3.surfaceContainerHigh,
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(4, s),
      paddingHorizontal: scaled(16, s),
    },
    searchInput: { flex: 1, fontSize: scaled(16, s), color: m3.onSurface, paddingVertical: scaled(8, s) },
    searchAction: {
      width: scaled(44, s),
      height: scaled(44, s),
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: { borderRadius: shape.card, padding: scaled(16, s), overflow: 'hidden' },
    cardShadow: {
      elevation: 1,
      boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
    },
    imagePh: {
      backgroundColor: m3.surfaceContainerHighest,
      borderRadius: shape.card,
      borderWidth: 1,
      borderColor: m3.outlineVariant,
      justifyContent: 'center',
      alignItems: 'center',
    },
    fab: { justifyContent: 'center', alignItems: 'center', elevation: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' },
    tonalIcon: {
      width: scaled(48, s),
      height: scaled(48, s),
      borderRadius: scaled(24, s),
      justifyContent: 'center',
      alignItems: 'center',
    },
    tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: m3.outlineVariant, backgroundColor: m3.surface },
    tabItem: { flex: 1 },
    tab: { height: scaled(40, s), justifyContent: 'center', alignItems: 'center', paddingHorizontal: scaled(8, s) },
    tabIndicator: {
      position: 'absolute',
      bottom: 0,
      height: 3,
      width: scaled(64, s),
      borderTopLeftRadius: 3,
      borderTopRightRadius: 3,
    },
    listItem: {
      minHeight: scaled(72, s),
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: m3.surfaceContainerLow,
      paddingHorizontal: scaled(16, s),
      paddingVertical: scaled(8, s),
      gap: scaled(16, s),
      marginBottom: scaled(3, s),
    },
    listIcon: {
      width: scaled(40, s),
      height: scaled(40, s),
      borderRadius: scaled(20, s),
      backgroundColor: m3.primaryContainer,
      justifyContent: 'center',
      alignItems: 'center',
    },
    listText: { flex: 1, gap: scaled(2, s) },
    badge: {
      backgroundColor: m3.primary,
      borderRadius: shape.pill,
      paddingHorizontal: scaled(10, s),
      paddingVertical: scaled(4, s),
    },
    chip: {
      minHeight: scaled(44, s),
      justifyContent: 'center',
      paddingHorizontal: scaled(16, s),
      paddingVertical: scaled(12, s),
      borderRadius: shape.pill,
      borderWidth: 1,
      borderColor: m3.outline,
    },
    chipActive: { backgroundColor: m3.secondaryContainer, borderColor: m3.secondaryContainer },
    loadingView: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: scaled(24, s) },
    emptyState: {
      paddingTop: scaled(60, s),
      paddingHorizontal: scaled(24, s),
      alignItems: 'center',
      gap: scaled(12, s),
    },
    emptyIcon: {
      width: scaled(80, s),
      height: scaled(80, s),
      borderRadius: scaled(40, s),
      backgroundColor: m3.surfaceContainerHigh,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
}

/** 現在の画面幅に応じた m3 コンポーネント用スタイル。 */
function useStyles() {
  const { scale, shape } = useM3();
  return React.useMemo(() => createStyles(scale, shape), [scale, shape]);
}
