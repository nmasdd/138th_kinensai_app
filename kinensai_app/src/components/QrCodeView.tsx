import React, { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { toQR } from 'toqr';

/**
 * QRコードを View グリッドで描画する (追加の画像/ネイティブ依存を使わない)。
 * 管理者ページでの作成・確認用途。印刷時は黒モジュールのコントラストが
 * 出るよう白背景に黒で描く。
 */
export function QrCodeView({
  value,
  size = 220,
  quiet = 4,
}: {
  value: string;
  size?: number;
  quiet?: number;
}) {
  const matrix = useMemo(() => {
    const bytes = toQR(value);
    const n = Math.max(1, Math.round(Math.sqrt(bytes.length)));
    return { bytes, n };
  }, [value]);

  const { bytes, n } = matrix;
  const cell = size / (n + quiet * 2);

  return (
    <View
      accessibilityRole="image"
      accessibilityLabel="QRコード"
      style={[styles.wrap, { width: size, height: size, padding: cell * quiet }]}
    >
      <View style={styles.grid}>
        {Array.from({ length: n }).map((_, r) => (
          <View key={r} style={styles.row}>
            {Array.from({ length: n }).map((_, c) => (
              <View
                key={c}
                style={[styles.cell, bytes[r * n + c] ? styles.dark : styles.light]}
              />
            ))}
          </View>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { backgroundColor: '#FFFFFF', borderRadius: 8, alignSelf: 'center' },
  grid: { flex: 1 },
  row: { flex: 1, flexDirection: 'row' },
  cell: { flex: 1 },
  dark: { backgroundColor: '#000000' },
  light: { backgroundColor: '#FFFFFF' },
});
