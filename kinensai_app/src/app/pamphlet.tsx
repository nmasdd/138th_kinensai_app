import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, TopAppBar } from '../components/m3';
import { m3 } from '../theme';

export default function PamphletScreen() {
  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="パンフレット" />
      <View style={styles.body}>
        <Text style={styles.temp}>仮</Text>
        <Text style={styles.empty}>まだデータがない</Text>
        <Text style={styles.note}>デジタルパンフレットのデータが届き次第ここに表示します。</Text>
      </View>
      <View style={styles.homeWrap}>
        <M3Button label="ホーム" icon="home" onPress={() => router.replace('/')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { flex: 1, padding: 24, gap: 16 },
  temp: { fontSize: 28, lineHeight: 36, color: m3.onSurface, textAlign: 'left' },
  empty: { fontSize: 28, lineHeight: 38, color: m3.onSurface, textAlign: 'center', marginTop: 32 },
  note: { fontSize: 14, lineHeight: 20, color: m3.onSurfaceVariant, textAlign: 'center' },
  homeWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
