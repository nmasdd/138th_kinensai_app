import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { router } from "expo-router";
import { CameraView, useCameraPermissions, type BarcodeScanningResult } from "expo-camera";
import Header from "../components/Header";
import { theme } from "../theme";

export default function CameraScreen() {
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState<string | null>(null);
  const [active, setActive] = useState(true);

  if (!permission) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="カメラ" />
        <View style={styles.body}>
          <Text style={styles.desc}>カメラの権限を確認しています…</Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!permission.granted) {
    return (
      <SafeAreaView style={styles.container}>
        <Header title="カメラ" />
        <View style={styles.body}>
          <Text style={styles.title}>廊下のQRコードを読み取ってください</Text>
          <Text style={styles.desc}>QR読取にはカメラの使用許可が必要です。</Text>
          <TouchableOpacity style={styles.primary} onPress={requestPermission}>
            <Text style={styles.primaryText}>カメラを許可する</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const onScanned = (result: BarcodeScanningResult) => {
    if (scanned) return;
    setScanned(result.data);
    setActive(false);
  };

  return (
    <SafeAreaView style={styles.container}>
      <Header title="カメラ" />
      {scanned ? (
        <View style={styles.body}>
          <Text style={styles.title}>QRを読み取りました</Text>
          <Text style={styles.code} numberOfLines={3}>
            {scanned}
          </Text>
          <TouchableOpacity
            style={styles.primary}
            onPress={() => router.push({ pathname: '/map', params: { loc: scanned } } as never)}
          >
            <Text style={styles.primaryText}>マップで現在地を見る</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.secondary}
            onPress={() => {
              setScanned(null);
              setActive(true);
            }}
          >
            <Text style={styles.secondaryText}>もう一度読み取る</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.previewWrap}>
          {active && (
            <CameraView
              style={styles.preview}
              facing="back"
              barcodeScannerSettings={{ barcodeTypes: ['qr'] }}
              onBarcodeScanned={onScanned}
            />
          )}
          <View style={styles.frame} pointerEvents="none" />
          <Text style={styles.hint}>枠の中にQRコードを入れてください</Text>
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  body: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: 24, gap: 12 },
  title: { fontSize: 17, fontWeight: 'bold', color: theme.ink, textAlign: 'center' },
  desc: { fontSize: 14, color: theme.muted, textAlign: 'center', lineHeight: 20 },
  code: { fontSize: 13, color: theme.text, textAlign: 'center', marginVertical: 4 },
  primary: { backgroundColor: theme.primary, borderRadius: 12, paddingHorizontal: 24, paddingVertical: 12 },
  primaryText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
  secondary: {
    borderRadius: 12,
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderWidth: 1,
    borderColor: theme.border,
  },
  secondaryText: { color: theme.text, fontSize: 15, fontWeight: '600' },
  previewWrap: { flex: 1, position: 'relative', backgroundColor: '#000' },
  preview: { flex: 1 },
  frame: {
    position: 'absolute',
    top: '30%',
    left: '15%',
    right: '15%',
    height: 220,
    borderWidth: 3,
    borderColor: theme.primary,
    borderRadius: 16,
  },
  hint: {
    position: 'absolute',
    bottom: 32,
    left: 0,
    right: 0,
    textAlign: 'center',
    color: '#ffffff',
    fontSize: 14,
    fontWeight: '600',
  },
});
