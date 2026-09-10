import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { M3Button, M3Card, M3EmptyState, M3Icon, M3LoadingView, TopAppBar } from '../../components/m3';
import { ConfirmPop, ScanBeam, ScreenFade, SuccessCheck } from '../../components/anim';
import { m3, m3type } from '../../theme';

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  const onScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(result.data);
    setActive(false);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="カメラ" />
      {!permission ? (
        <M3LoadingView />
      ) : !permission.granted ? (
        <ScreenFade>
          <View style={styles.body}>
            <M3EmptyState icon="photo-camera">
              <Text style={[m3type.titleMedium, { color: m3.onSurface, textAlign: 'center' }]}>
                廊下のQRコードを読み取ってください
              </Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                QR読取にはカメラの使用許可が必要です。
              </Text>
            </M3EmptyState>
            <View style={styles.actionRow}>
              <M3Button label="カメラを許可する" icon="photo-camera" onPress={requestPermission} />
            </View>
          </View>
        </ScreenFade>
      ) : scanned ? (
        <ScreenFade>
          <View style={styles.body}>
            <SuccessCheck size={72}>
              <M3Icon name="check" size={36} color={m3.onPrimaryContainer} />
            </SuccessCheck>
            <M3Card variant="elevated" style={styles.resultCard}>
              <Text style={[m3type.titleMedium, { color: m3.onSurface }]} accessibilityLiveRegion="polite">
                QRを読み取りました
              </Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 8 }]} numberOfLines={3}>
                {scanned}
              </Text>
            </M3Card>
            <View style={styles.resultActions}>
              <ConfirmPop key={scanned}>
                <M3Button
                  label="マップで現在地を見る"
                  icon="map"
                  onPress={() => router.push({ pathname: '/map', params: { loc: scanned } } as never)}
                />
              </ConfirmPop>
              <M3Button
                label="もう一度読み取る"
                icon="qr-code-2"
                variant="tonal"
                onPress={() => {
                  setScanned(null);
                  setActive(true);
                }}
              />
            </View>
          </View>
        </ScreenFade>
      ) : (
        <ScreenFade>
          <View style={styles.body}>
            <View style={styles.preview} accessibilityLabel="QRコード読み取りプレビュー" accessibilityRole="none">
              {active && (
                <CameraView
                  style={StyleSheet.absoluteFill}
                  facing="back"
                  barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
                  onBarcodeScanned={onScanned}
                />
              )}
              <View style={[styles.frame, { pointerEvents: 'none' }]} accessible={false}>
                <ScanBeam height={214} />
              </View>
            </View>
            <Text style={[m3type.titleMedium, { color: m3.onSurface, textAlign: 'center' }]}>
              カメラをQRコードに向けてください
            </Text>
          </View>
        </ScreenFade>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { flex: 1, alignItems: 'center', padding: 16, gap: 16, justifyContent: 'center' },
  actionRow: { width: '100%' },
  preview: {
    width: 380,
    maxWidth: '100%',
    height: 507,
    maxHeight: '70%',
    borderRadius: 20,
    overflow: 'hidden',
    backgroundColor: m3.inverseSurface,
  },
  frame: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    height: 220,
    borderWidth: 3,
    borderColor: m3.inversePrimary,
    borderRadius: 20,
    overflow: 'hidden',
  },
  resultCard: { width: '100%' },
  resultActions: { width: '100%', gap: 12 },
});
