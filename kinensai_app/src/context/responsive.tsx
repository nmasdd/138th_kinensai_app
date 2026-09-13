import React, { createContext, useContext, useMemo } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  BASE_WIDTH,
  m3layout,
  m3shape,
  m3type,
  scaleM3Layout,
  scaleM3Shape,
  scaleM3Type,
  type M3Layout,
  type M3Shape,
  type M3Type,
} from '../theme';

/**
 * 画面幅に応じたレスポンシブ・スケール。
 * 基準幅 BASE_WIDTH に対する倍率を求め、文字 (type)・余白 (layout)・
 * 形状 (shape) を一律に拡縮して全画面へ配布する。
 * 拡大は行わず（倍率の上限は 1）、狭い画面のみ縮小する。
 */
export interface M3Responsive {
  scale: number;
  type: M3Type;
  layout: M3Layout;
  shape: M3Shape;
}

const ResponsiveContext = createContext<M3Responsive>({
  scale: 1,
  type: m3type,
  layout: m3layout,
  shape: m3shape,
});

export function ResponsiveProvider({ children }: { children: React.ReactNode }) {
  const { width } = useWindowDimensions();
  const value = useMemo<M3Responsive>(() => {
    // 拡大はしない (上限 1)。基準幅より狭いときだけ縮小する。
    const scale = width > 0 ? Math.min(1, width / BASE_WIDTH) : 1;
    return {
      scale,
      type: scaleM3Type(scale),
      layout: scaleM3Layout(scale),
      shape: scaleM3Shape(scale),
    };
  }, [width]);
  return <ResponsiveContext.Provider value={value}>{children}</ResponsiveContext.Provider>;
}

/** 現在の画面幅に応じたスケール済みテーマを取得する。 */
export function useM3(): M3Responsive {
  return useContext(ResponsiveContext);
}
