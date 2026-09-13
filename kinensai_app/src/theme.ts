import type { TextStyle } from 'react-native';

/**
 * Material 3 Expressive カスタムライトカラースキーム (固定ライトモード)。
 * UI の色は必ずこのロール経由で参照し、ハードコードした色は使わない。
 * Android のシステム書体は Roboto のため fontFamily は指定しない。
 *
 * 背景は白 #ffffff、アクセントはオレンジ系。ブランドカラー #FF6B00 は
 * 白背景上でのコントラストが不足するため、テキストや塗りには可読性を
 * 確保した濃色バリアント primary #D14E00 を使うこと。
 * 固定ライト配色のため userInterfaceStyle automatic のダークモードでも破綻しない。
 */

/** ブランドオレンジ (装飾用の参照値。テキスト/塗りには m3.primary を使う)。 */
export const brandOrange = '#FF6B00' as const;

export const m3 = {
  primary: '#D14E00',
  onPrimary: '#FFFFFF',
  primaryContainer: '#FFDBCA',
  onPrimaryContainer: '#331100',
  secondaryContainer: '#FED8B7',
  onSecondaryContainer: '#2F1D00',
  tertiaryContainer: '#FFE3C2',
  onTertiaryContainer: '#2A1700',
  surface: '#FFFFFF',
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
 * レイアウトの基準値。余白・タップ領域の統一に使う。
 * touchMin はタップ領域の最小サイズ (44dp 前後)。
 */
export const m3layout = {
  touchMin: 44,
  screenPadding: 16,
  sectionGap: 16,
  cardGap: 12,
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

// ─────────────────────────────────────────────────────────────────────────
// レスポンシブ・スケーリング
// 設計上の想定画面幅 BASE_WIDTH を基準に、実際の画面幅から倍率を求め、
// 文字サイズ (m3type)・余白 (m3layout)・形状 (m3shape) を一律に拡縮する。
// 縮小・拡大とも上限なし。
// ─────────────────────────────────────────────────────────────────────────

/** レスポンシブの基準幅 (設計上の想定画面幅)。 */
export const BASE_WIDTH = 390;

export type M3Type = {
  [K in keyof typeof m3type]: {
    fontSize: number;
    fontWeight: TextStyle['fontWeight'];
    lineHeight: number;
  };
};
export type M3Layout = {
  touchMin: number;
  screenPadding: number;
  sectionGap: number;
  cardGap: number;
};
export type M3Shape = {
  pill: number;
  card: number;
  dialog: number;
  fab: number;
  fabLarge: number;
  fabSmall: number;
};

/** 任意の数値を倍率適用 (丸め)。 */
export function scaled(value: number, scale: number): number {
  return Math.round(value * scale);
}

/** m3type を倍率適用したコピーを返す。 */
export function scaleM3Type(scale: number): M3Type {
  const out = {} as Record<keyof M3Type, { fontSize: number; fontWeight: TextStyle['fontWeight']; lineHeight: number }>;
  (Object.keys(m3type) as (keyof M3Type)[]).forEach((key) => {
    const v = m3type[key];
    out[key] = {
      fontSize: Math.max(1, Math.round(v.fontSize * scale)),
      lineHeight: Math.max(1, Math.round(v.lineHeight * scale)),
      fontWeight: v.fontWeight,
    };
  });
  return out as M3Type;
}

/** m3layout を倍率適用したコピーを返す。 */
export function scaleM3Layout(scale: number): M3Layout {
  return {
    touchMin: Math.max(1, Math.round(m3layout.touchMin * scale)),
    screenPadding: Math.max(1, Math.round(m3layout.screenPadding * scale)),
    sectionGap: Math.max(1, Math.round(m3layout.sectionGap * scale)),
    cardGap: Math.max(1, Math.round(m3layout.cardGap * scale)),
  };
}

/** m3shape を倍率適用したコピーを返す (ピルは据え置き)。 */
export function scaleM3Shape(scale: number): M3Shape {
  return {
    pill: m3shape.pill,
    card: Math.max(1, Math.round(m3shape.card * scale)),
    dialog: Math.max(1, Math.round(m3shape.dialog * scale)),
    fab: Math.max(1, Math.round(m3shape.fab * scale)),
    fabLarge: Math.max(1, Math.round(m3shape.fabLarge * scale)),
    fabSmall: Math.max(1, Math.round(m3shape.fabSmall * scale)),
  };
}
