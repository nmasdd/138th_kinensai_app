/**
 * Material 3 Expressive カスタムライトカラースキーム (固定ライトモード)。
 * UI の色は必ずこのロール経由で参照し、ハードコードした色は使わない。
 * Android のシステム書体は Roboto のため fontFamily は指定しない。
 */

export const m3 = {
  primary: '#D14E00',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFDBCA',
  onPrimaryContainer: '#331100',
  secondaryContainer: '#FED8B7',
  onSecondaryContainer: '#2F1D00',
  tertiaryContainer: '#FFE3C2',
  onTertiaryContainer: '#2A1700',
  surface: '#FEF8F4',
  surfaceContainerLow: '#F8F3EE',
  surfaceContainer: '#F2EDE8',
  surfaceContainerHigh: '#ECE7E3',
  surfaceContainerHighest: '#E7E2DD',
  onSurface: '#1E1B18',
  onSurfaceVariant: '#4E453C',
  outline: '#7F756C',
  outlineVariant: '#D0C5BA',
  inverseSurface: '#33302C',
  inverseOnSurface: '#F5F0EB',
  inversePrimary: '#FFB68F',
  error: '#B3261E',
  onError: '#FFFFFF',
  errorContainer: '#F9DEDC',
  onErrorContainer: '#410E0B',
} as const;

export type M3Color = keyof typeof m3;

/** M3 タイプスケール (size / weight / lineHeight)。行間はサイズの約1.4倍。 */
export const m3type = {
  displaySmall: { fontSize: 36, fontWeight: '400', lineHeight: 44 },
  headlineMedium: { fontSize: 28, fontWeight: '400', lineHeight: 36 },
  headlineSmall: { fontSize: 24, fontWeight: '400', lineHeight: 32 },
  titleLarge: { fontSize: 22, fontWeight: '400', lineHeight: 28 },
  titleMedium: { fontSize: 16, fontWeight: '500', lineHeight: 24 },
  titleSmall: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  bodyLarge: { fontSize: 16, fontWeight: '400', lineHeight: 24 },
  bodyMedium: { fontSize: 14, fontWeight: '400', lineHeight: 20 },
  labelLarge: { fontSize: 14, fontWeight: '500', lineHeight: 20 },
  labelMedium: { fontSize: 12, fontWeight: '500', lineHeight: 16 },
} as const;

/** M3 Expressive の形状。ボタンはピル、カードは 20、ダイアログは 28。 */
export const m3shape = {
  pill: 999,
  card: 20,
  dialog: 28,
  fab: 16,
  fabLarge: 28,
  fabSmall: 12,
} as const;

/**
 * 旧 theme 互換のエイリアス。新規コードは m3 ロールを直接使うこと。
 */
export const theme = {
  background: m3.surface,
  surface: m3.surface,
  surfaceAlt: m3.surfaceContainer,
  primary: m3.primary,
  primaryDark: m3.primary,
  ink: m3.onSurface,
  text: m3.onSurface,
  muted: m3.onSurfaceVariant,
  border: m3.outlineVariant,
  danger: m3.error,
} as const;
