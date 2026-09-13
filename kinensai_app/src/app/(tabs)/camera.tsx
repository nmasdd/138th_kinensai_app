import React, { useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from 'expo-camera';
import { M3Button, M3Card, M3EmptyState, M3Icon, M3LoadingView, TopAppBar } from '../../components/m3';
import { ConfirmPop, ScanBeam, ScreenFade, SuccessCheck } from '../../components/anim';
import { FLOOR_TOKENS, parseLocationQr } from '../../data/locationQr';
import { useM3 } from '../../context/responsive';
import { m3, scaled } from '../../theme';

export default function CameraScreen() {
  const { type } = useM3();
  const styles = useStyles();
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const [active, setActive] = useState(true);
  // 同一読取で複数回イベントが来ても遷移を1回に抑える
  const handledRef = useRef(false);

  const location = scanned ? parseLocationQr(scanned) : null;

  const locationParams = (parsed: NonNullable<ReturnType<typeof parseLocationQr>>): Record<string, string> => {
    const params: Record<string, string> = { x: String(parsed.x), y: String(parsed.y) };
    if (parsed.floorIndex >= 0) params.floor = FLOOR_TOKENS[parsed.floorIndex];
    return params;
  };

  const onScanned = (result: BarcodeScanningResult) => {
    if (handledRef.current || scanned) return;
    const parsed = parseLocationQr(result.data);
    handledRef.current = true;
    setScanned(result.data);
    setActive(false);
    if (parsed) {
      // アプリのマップの現在地QRなら確認を挟まず即座にマップへ遷移する
      router.push({ pathname: '/map', params: locationParams(parsed) } as never);
    }
  };

  const openInMap = () => {
    if (location) {
      router.push({ pathname: '/map', params: locationParams(location) } as never);
      return;
    }
    router.push({ pathname: '/map', params: { loc: scanned ?? '' } } as never);
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
              <Text style={[type.titleMedium, { color: m3.onSurface, textAlign: 'center' }]}>
                廊下のQRコードを読み取ってください
              </Text>
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
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
              <Text style={[type.titleMedium, { color: m3.onSurface }]} accessibilityLiveRegion="polite">
                {location ? '現在地のQRコードを読み取りました' : 'QRを読み取りました'}
              </Text>
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 8 }]} numberOfLines={3}>
                {location ? 'マップで現在地を確認できます。' : scanned}
              </Text>
            </M3Card>
            <View style={styles.resultActions}>
              <ConfirmPop key={scanned}>
                <M3Button
                  label={location ? 'マップで現在地を見る' : 'マップで関連企画を見る'}
                  icon="map"
                  onPress={openInMap}
                />
              </ConfirmPop>
              <M3Button
                label="もう一度読み取る"
                icon="qr-code-2"
                variant="tonal"
                onPress={() => {
                  handledRef.current = false;
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
            <Text style={[type.titleMedium, { color: m3.onSurface, textAlign: 'center' }]}>
              カメラをQRコードに向けてください
            </Text>
          </View>
        </ScreenFade>
      )}
    </SafeAreaView>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    body: {
      flex: 1,
      alignItems: 'center',
      padding: scaled(16, s),
      gap: scaled(16, s),
      justifyContent: 'center',
    },
    actionRow: { width: '100%' },
    preview: {
      width: scaled(380, s),
      maxWidth: '100%',
      height: scaled(507, s),
      maxHeight: '70%',
      borderRadius: scaled(20, s),
      overflow: 'hidden',
      backgroundColor: m3.inverseSurface,
    },
    frame: {
      position: 'absolute',
      top: '30%',
      left: '15%',
      right: '15%',
      height: scaled(220, s),
      borderWidth: 3,
      borderColor: m3.inversePrimary,
      borderRadius: scaled(20, s),
      overflow: 'hidden',
    },
    resultCard: { width: '100%' },
    resultActions: { width: '100%', gap: scaled(12, s) },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
