import React, { useState } from 'react';
import {
  Animated,
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
import { m3, m3shape, m3type } from '../theme';

export type IconName = React.ComponentProps<typeof MaterialIcons>['name'];

/** リップル + 軽い縮小フィードバック付きのタップ面 */
export function M3Touch({
  children,
  onPress,
  style,
  round = false,
  label,
}: {
  children: React.ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  round?: boolean;
  label?: string;
}) {
  const [scale] = useState(() => new Animated.Value(1));
  return (
    <Pressable
      accessibilityLabel={label}
      android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: false }}
      onPress={onPress}
      onPressIn={() => Animated.timing(scale, { toValue: 0.97, duration: 90, useNativeDriver: true }).start()}
      onPressOut={() => Animated.timing(scale, { toValue: 1, duration: 120, useNativeDriver: true }).start()}
      style={[round && styles.roundClip, style]}
    >
      <Animated.View style={[{ transform: [{ scale }] }]}>{children}</Animated.View>
    </Pressable>
  );
}

export function M3Icon({ name, size = 24, color = m3.onSurface }: { name: IconName; size?: number; color?: string }) {
  return <MaterialIcons name={name} size={size} color={color} />;
}

/** 高さ 64 のスモールトップアプリバー。左 menu→メニュー、右 notifications→通知。 */
export function TopAppBar({ title }: { title: string }) {
  return (
    <View style={styles.appBar}>
      <Pressable
        accessibilityLabel="メニューを開く"
        android_ripple={{ color: 'rgba(0,0,0,0.12)', borderless: true }}
        onPress={() => router.push('/menu')}
        style={styles.appBarIcon}
      >
        <M3Icon name="menu" />
      </Pressable>
      <Text style={[m3type.titleLarge, styles.appBarTitle]} numberOfLines={1}>
        {title}
      </Text>
      <Pressable
        accessibilityLabel="通知を開く"
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
  const bg =
    variant === 'filled' ? m3.primary : variant === 'tonal' ? m3.secondaryContainer : 'transparent';
  const fg =
    variant === 'filled' ? m3.onPrimary : variant === 'tonal' ? m3.onSecondaryContainer : m3.primary;
  return (
    <M3Touch onPress={onPress} label={label} round>
      <View style={[styles.button, { backgroundColor: bg }, variant === 'outlined' && styles.buttonOutlined, style]}>
        {icon && <M3Icon name={icon} size={20} color={fg} />}
        <Text style={[m3type.labelLarge, { color: fg, fontSize: 15, flexShrink: 1 }]} numberOfLines={1}>
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
  return (
    <View style={styles.searchBar}>
      <M3Icon name="search" color={m3.onSurfaceVariant} />
      <TextInput
        style={styles.searchInput}
        placeholder={placeholder}
        placeholderTextColor={m3.onSurfaceVariant}
        value={value}
        onChangeText={onChangeText}
        autoCapitalize="none"
        returnKeyType="search"
      />
      {value.length > 0 ? (
        <M3Touch onPress={() => onChangeText('')} label="入力を消去" round>
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
  return (
    <View style={[styles.imagePh, { height }]}>
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
  const size = small ? 40 : 56;
  return (
    <M3Touch onPress={onPress} label={label} round>
      <View
        style={[
          styles.fab,
          { width: size, height: size, borderRadius: small ? m3shape.fabSmall : m3shape.fab, backgroundColor: m3.primaryContainer },
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

/** M3 プライマリタブ。高さ 48、選択中は primary 文字 + ラベル幅 3dp インジケータ。 */
export function M3PrimaryTabs({
  labels,
  value,
  onValueChange,
}: {
  labels: string[];
  value: number;
  onValueChange: (i: number) => void;
}) {
  return (
    <View style={styles.tabs}>
      {labels.map((label, i) => {
        const active = i === value;
        return (
          <M3Touch key={label} onPress={() => onValueChange(i)} label={label}>
            <View style={styles.tab}>
              <Text style={[m3type.titleSmall, { color: active ? m3.primary : m3.onSurfaceVariant }]}>
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
  const radius: ViewStyle =
    position === 'single'
      ? { borderRadius: m3shape.dialog }
      : position === 'top'
        ? { borderTopLeftRadius: m3shape.dialog, borderTopRightRadius: m3shape.dialog, borderBottomLeftRadius: 8, borderBottomRightRadius: 8 }
        : position === 'bottom'
          ? { borderTopLeftRadius: 8, borderTopRightRadius: 8, borderBottomLeftRadius: m3shape.dialog, borderBottomRightRadius: m3shape.dialog }
          : { borderRadius: 8 };
  return (
    <M3Touch onPress={onPress} label={title} round>
      <View style={[styles.listItem, radius]}>
        <View style={styles.listIcon}>
          <M3Icon name={icon} color={m3.onPrimaryContainer} />
        </View>
        <View style={styles.listText}>
          <Text style={[m3type.bodyLarge, { color: m3.onSurface }]}>{title}</Text>
          {sub ? <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>{sub}</Text> : null}
        </View>
      </View>
    </M3Touch>
  );
}

const textBase: TextStyle = {};

export function M3Headline({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  return <Text style={[m3type.headlineMedium, { color: m3.onSurface }, textBase, style]}>{children}</Text>;
}

const styles = StyleSheet.create({
  roundClip: { borderRadius: m3shape.pill },
  appBar: {
    height: 64,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: m3.surface,
    paddingHorizontal: 4,
  },
  appBarIcon: { width: 48, height: 48, justifyContent: 'center', alignItems: 'center', borderRadius: 24 },
  appBarTitle: { flex: 1, textAlign: 'center', color: m3.onSurface },
  button: {
    height: 56,
    borderRadius: m3shape.pill,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingHorizontal: 16,
    minWidth: 0,
  },
  buttonOutlined: { borderWidth: 1, borderColor: m3.outline },
  searchBar: {
    height: 56,
    borderRadius: m3shape.pill,
    backgroundColor: m3.surfaceContainerHigh,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 16,
  },
  searchInput: { flex: 1, fontSize: 16, color: m3.onSurface, paddingVertical: 8 },
  card: { borderRadius: m3shape.card, padding: 16, overflow: 'hidden' },
  cardShadow: {
    elevation: 1,
    boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
  },
  imagePh: {
    backgroundColor: m3.surfaceContainerHighest,
    borderRadius: m3shape.card,
    justifyContent: 'center',
    alignItems: 'center',
  },
  fab: { justifyContent: 'center', alignItems: 'center', elevation: 3, boxShadow: '0 2px 6px rgba(0,0,0,0.3)' },
  tonalIcon: { width: 48, height: 48, borderRadius: 24, justifyContent: 'center', alignItems: 'center' },
  tabs: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: m3.outlineVariant, backgroundColor: m3.surface },
  tab: { flex: 1, height: 48, justifyContent: 'flex-end', alignItems: 'center' },
  tabIndicator: { height: 3, width: 48, borderTopLeftRadius: 3, borderTopRightRadius: 3, marginTop: 6 },
  listItem: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: m3.surfaceContainerLow,
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 16,
    marginBottom: 3,
  },
  listIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: m3.primaryContainer,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listText: { flex: 1, gap: 2 },
});
