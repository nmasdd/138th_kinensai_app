import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { M3Button, M3EmptyState, TopAppBar } from '../components/m3';
import { ScreenFade } from '../components/anim';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';

const PDF_PATH = '/pamphlet.pdf';
const PDF_URL = `https://app.kinensai.jp${PDF_PATH}`;

export default function PamphletScreen() {
  const { type } = useM3();
  const styles = useStyles();
  const insets = useSafeAreaInsets();
  const isWeb = Platform.OS === 'web';

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="パンフレット" />
      <View style={styles.body}>
        {isWeb ? (
          React.createElement('iframe' as never, {
            src: PDF_PATH,
            title: '138th記念祭パンフレット',
            style: { width: '100%', height: '100%', border: 'none', backgroundColor: m3.surface },
          })
        ) : (
          <ScreenFade>
            <M3EmptyState icon="menu-book">
              <Text style={[type.headlineSmall, { color: m3.onSurface, textAlign: 'center' }]} accessibilityRole="header">
                138th記念祭パンフレット
              </Text>
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                PDFをブラウザで開いてご覧ください。
              </Text>
              <View style={styles.openWrap}>
                <M3Button label="パンフレットを開く" icon="open-in-new" onPress={() => WebBrowser.openBrowserAsync(PDF_URL)} />
              </View>
            </M3EmptyState>
          </ScreenFade>
        )}
      </View>
      <View style={[styles.homeWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <M3Button label="ホームに戻る" icon="home" onPress={() => router.replace('/(tabs)' as never)} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    body: { flex: 1, padding: scaled(12, s) },
    openWrap: { alignItems: 'center', marginTop: scaled(16, s) },
    homeWrap: { alignItems: 'flex-end', paddingHorizontal: scaled(16, s), paddingBottom: scaled(16, s) },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
