import React, { useState, useEffect } from "react";
import { View, Text, FlatList, StyleSheet, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import * as FileSystem from 'expo-file-system/legacy'; // ここを legacy に変更しました
import { Asset } from 'expo-asset';
import Header from "./components/Header";

interface ScheduleItem {
  id: string;
  team: string;
  day: number; // 0: 土曜日, 1: 日曜日
  startTime: string;
  endTime: string;
}

// CSV文字列をパースしてオブジェクトの配列に変換する関数
const parseCsv = (csv: string): ScheduleItem[] => {
  return csv.trim().split('\n').map((line, index) => {
    // 「 , 」で分割し、前後の空白を削除
    const parts = line.split(',').map(part => part.trim());
    
    // データが5列の場合（例: ID, チーム名, 曜日, 開始, 終了）
    if (parts.length === 5) {
      return {
        id: parts[0],
        team: parts[1],
        day: parseInt(parts[2], 10),
        startTime: parts[3],
        endTime: parts[4],
      };
    } 
    // データが4列の場合
    else if (parts.length === 4) {
      return {
        id: String(index),
        team: parts[0],
        day: parseInt(parts[1], 10),
        startTime: parts[2],
        endTime: parts[3],
      };
    }
    return null;
  }).filter((item): item is ScheduleItem => item !== null);
};

export default function TimetableScreen() {
  const [scheduleData, setScheduleData] = useState<ScheduleItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // CSVファイルをアセットとして読み込む
    const loadCsv = async () => {
      try {
        const asset = Asset.fromModule(require('../../time/Auditorium.csv'));
        await asset.downloadAsync();
        
        if (asset.localUri) {
          const fileContent = await FileSystem.readAsStringAsync(asset.localUri);
          setScheduleData(parseCsv(fileContent));
        }
      } catch (error) {
        console.error("CSVの読み込みに失敗しました:", error);
      } finally {
        setIsLoading(false);
      }
    };

    loadCsv();
  }, []);

  // 曜日ごとにデータを分類
  const saturdayData = scheduleData.filter(item => item.day === 0);
  const sundayData = scheduleData.filter(item => item.day === 1);

  // 各スケジュールアイテムの表示用コンポーネント
  const renderItem = ({ item }: { item: ScheduleItem }) => (
    <View style={styles.row}>
      <Text style={styles.teamText}>{item.team}</Text>
      <Text style={styles.timeText}>{item.startTime} - {item.endTime}</Text>
    </View>
  );

  if (isLoading) {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#333333" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#ffffff' }}>
      <Header title="タイムテーブル" />
      
      <FlatList
        style={styles.container}
        ListHeaderComponent={
          <>
            <Text style={styles.dayHeader}>土曜日</Text>
            {saturdayData.map((item) => (
              <View key={`sat-${item.id}`} style={styles.row}>
                <Text style={styles.teamText}>{item.team}</Text>
                <Text style={styles.timeText}>{item.startTime} - {item.endTime}</Text>
              </View>
            ))}
            
            <View style={{ height: 20 }} />
            
            <Text style={styles.dayHeader}>日曜日</Text>
          </>
        }
        data={sundayData}
        keyExtractor={(item) => `sun-${item.id}`}
        renderItem={renderItem}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  dayHeader: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 8,
    color: '#333333',
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  teamText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333333',
  },
  timeText: {
    fontSize: 16,
    color: '#666666',
  },
});