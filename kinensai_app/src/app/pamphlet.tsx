import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3EmptyState, TopAppBar } from '../components/m3';
import { Rise, ScreenFade } from '../components/anim';
import { m3, m3type } from '../theme';

export default function PamphletScreen() {
  const insets = useSafeAreaInsets();
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="パンフレット" />
      <View style={styles.body}>
        <ScreenFade>
          <Rise>
            <M3EmptyState icon="menu-book">
              <Text style={[m3type.headlineSmall, { color: m3.onSurface, textAlign: 'center' }]} accessibilityRole="header">
                パンフレットは準備中です
              </Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                デジタルパンフレットのデータが届き次第ここに表示します。
              </Text>
            </M3EmptyState>
          </Rise>
        </ScreenFade>
      </View>
      <View style={[styles.homeWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <M3Button label="ホームに戻る" icon="home" onPress={() => router.replace('/(tabs)' as never)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { flex: 1, padding: 24 },
  homeWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
