import React, { useEffect, useState } from 'react';
import { Animated, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3Card, M3PrimaryTabs, TopAppBar } from '../../components/m3';
import { VectorMapView } from '../../components/VectorMapView';
import { QrCodeView } from '../../components/QrCodeView';
import { AdminGate } from '../../components/AdminGuard';
import { adminStyles } from '../../components/adminUi';
import { VECTOR_FLOORS } from '../../data/vectorMap';
import { loadMapLayout, type MapLayoutOverrides } from '../../data/mapLayout';
import { buildLocationUrl } from '../../data/locationQr';
import { m3, m3type } from '../../theme';

/**
 * 管理者用・現在地QRコード作成 (/admin/qr)。
 * フロア地図をタップして地点を選び、`/map?floor=..&x=..&y=..` を符号化した
 * QRコードを表示する。印刷して廊下などに貼る想定。
 */
interface Picked {
  floorIndex: number;
  x: number;
  y: number;
}

export default function AdminQrScreen() {
  return (
    <AdminGate>
      <AdminQrContent />
    </AdminGate>
  );
}

function AdminQrContent() {
  const [tab, setTab] = useState(0);
  const [picked, setPicked] = useState<Picked | null>(null);
  const [blinkAnim] = useState(() => new Animated.Value(1));
  const [mapLayout, setMapLayout] = useState<MapLayoutOverrides>({});

  useEffect(() => {
    let cancelled = false;
    loadMapLayout()
      .then((layout) => {
        if (!cancelled) setMapLayout(layout);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  const onThisFloor = picked && picked.floorIndex === tab ? { x: picked.x, y: picked.y } : null;
  const url = picked ? buildLocationUrl(picked.floorIndex, picked.x, picked.y) : null;

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用・QRコード作成" />
      <ScrollView contentContainerStyle={adminStyles.body}>
        <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
          廊下などに貼る現在地QRコードを作成します。地図をタップして場所を指定してください。
          読み取ると、その階の指定座標に現在地（青いドット）が表示されます。
        </Text>

        <M3PrimaryTabs labels={[...VECTOR_FLOORS]} value={tab} onValueChange={setTab} />

        <VectorMapView
          floor={VECTOR_FLOORS[tab]}
          selectedId={null}
          blinkId={null}
          blinkAnim={blinkAnim}
          locId={null}
          selfPos={onThisFloor}
          roomsOverride={mapLayout[VECTOR_FLOORS[tab]]}
          onPick={(p) => setPicked({ floorIndex: tab, x: p.x, y: p.y })}
          onSelect={() => {}}
        />
        <Text style={[m3type.labelMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
          地図をタップして地点を指定（ドラッグで移動・＋−で拡大縮小）
        </Text>

        {picked && url ? (
          <M3Card variant="elevated" style={styles.result}>
            <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>
              {VECTOR_FLOORS[picked.floorIndex]} / x={picked.x.toFixed(3)} y={picked.y.toFixed(3)}
            </Text>
            <View style={styles.qrWrap}>
              <QrCodeView value={url} size={240} />
            </View>
            <Text selectable style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
              {url}
            </Text>
            <View style={adminStyles.buttonRow}>
              <M3Button label="選び直す" icon="restart-alt" variant="tonal" onPress={() => setPicked(null)} />
            </View>
          </M3Card>
        ) : (
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            まだ地点が指定されていません。
          </Text>
        )}

        <View style={adminStyles.backWrap}>
          <M3Button
            label="目次に戻る"
            icon="undo"
            variant="tonal"
            onPress={() => router.push('/admin/index' as never)}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  result: { alignItems: 'stretch', gap: 12 },
  qrWrap: { alignItems: 'center', paddingVertical: 8, backgroundColor: '#FFFFFF', borderRadius: 8 },
});
