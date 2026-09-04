import React, { useEffect, useState } from "react";
import { View, Text, ScrollView, StyleSheet, ActivityIndicator, TouchableOpacity } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import { loadAuditorium, findNow, type StageItem } from "../data/timetable";
import { loadCongestion, congestionLabel, type CongestionLevel } from "../data/congestion";
import { useStageGroups } from "../data/stage";
import { theme } from "../theme";

export default function TimetableScreen() {
  const [items, setItems] = useState<StageItem[]>([]);
  const [congestion, setCongestion] = useState<CongestionLevel>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [now] = useState(() => new Date());
  const { groups, votedId, vote } = useStageGroups();

  useEffect(() => {
    Promise.all([loadAuditorium().catch(() => []), loadCongestion().catch(() => 'unknown' as CongestionLevel)]).then(
      ([auditorium, level]) => {
        setItems(auditorium);
        setCongestion(level);
        setIsLoading(false);
      },
    );
  }, []);

  const nowItem = findNow(items, now);
  const saturday = items.filter((i) => i.day === 0);
  const sunday = items.filter((i) => i.day === 1);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={theme.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <Header title="タイムテーブル" />
      <ScrollView style={styles.list} contentContainerStyle={styles.content}>
        <View style={styles.nowBox}>
          <Text style={styles.nowLabel}>いま講堂で開催中</Text>
          {nowItem ? (
            <>
              <Text style={styles.nowTeam}>{nowItem.team}</Text>
              <Text style={styles.nowTime}>
                {nowItem.start}–{nowItem.end}
                {nowItem.delayMinutes > 0 ? ` (${nowItem.delayMinutes}分遅れ)` : ''}
              </Text>
            </>
          ) : (
            <Text style={styles.nowEmpty}>現在開催中の演目は確認中です</Text>
          )}
          <Text style={styles.congestion}>{congestionLabel(congestion)}</Text>
        </View>

        <View style={styles.voteBox}>
          <Text style={styles.sectionTitle}>ステージ オーディエンス投票</Text>
          <Text style={styles.voteNote}>ステージの番組表は準備中です。投票は1団体まで (端末内に保存・変更可)。</Text>
          {groups.map((g) => {
            const voted = votedId === g.id;
            return (
              <View key={g.id} style={[styles.group, voted && styles.groupVoted]}>
                <View style={styles.groupInfo}>
                  <Text style={styles.groupName}>{g.name}</Text>
                  <Text style={styles.groupDetail}>{g.detail}</Text>
                  <Text style={styles.photoNote}>写真準備中</Text>
                </View>
                <TouchableOpacity
                  style={[styles.voteButton, voted && styles.voteButtonActive]}
                  onPress={() => vote(g.id)}
                >
                  <Text style={[styles.voteButtonText, voted && styles.voteButtonTextActive]}>
                    {voted ? '投票中' : '投票'}
                  </Text>
                </TouchableOpacity>
              </View>
            );
          })}
        </View>

        <Text style={styles.dayHeader}>講堂 土曜日</Text>
        {saturday.length === 0 && <Text style={styles.emptyRow}>登録がありません</Text>}
        {saturday.map((item) => (
          <View key={`sat-${item.id}`} style={styles.row}>
            <Text style={styles.teamText}>{item.team}</Text>
            <Text style={styles.timeText}>
              {item.start}–{item.end}
              {item.delayMinutes > 0 ? ` (${item.delayMinutes}分遅れ)` : ''}
            </Text>
          </View>
        ))}
        <View style={{ height: 20 }} />
        <Text style={styles.dayHeader}>講堂 日曜日</Text>
        {sunday.length === 0 && <Text style={styles.emptyRow}>登録がありません</Text>}
        {sunday.map((item) => (
          <View key={`sun-${item.id}`} style={styles.row}>
            <Text style={styles.teamText}>{item.team}</Text>
            <Text style={styles.timeText}>
              {item.start}–{item.end}
              {item.delayMinutes > 0 ? ` (${item.delayMinutes}分遅れ)` : ''}
            </Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  center: { flex: 1, backgroundColor: theme.background, justifyContent: 'center', alignItems: 'center' },
  list: { flex: 1 },
  content: { padding: 16, paddingBottom: 32 },
  nowBox: {
    backgroundColor: theme.surfaceAlt,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 16,
    borderLeftWidth: 5,
    borderLeftColor: theme.primary,
  },
  nowLabel: { fontSize: 13, fontWeight: 'bold', color: theme.primaryDark, marginBottom: 4 },
  nowTeam: { fontSize: 18, fontWeight: 'bold', color: theme.ink },
  nowTime: { fontSize: 14, color: theme.text, marginTop: 2 },
  nowEmpty: { fontSize: 15, color: theme.muted },
  congestion: { fontSize: 13, fontWeight: '600', color: theme.text, marginTop: 8 },
  voteBox: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 14,
    marginBottom: 16,
  },
  sectionTitle: { fontSize: 16, fontWeight: 'bold', color: theme.ink, marginBottom: 4 },
  voteNote: { fontSize: 12, color: theme.muted, marginBottom: 10 },
  group: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: theme.surfaceAlt,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 12,
    marginBottom: 8,
  },
  groupVoted: { borderColor: theme.primary, borderWidth: 2 },
  groupInfo: { flex: 1 },
  groupName: { fontSize: 15, fontWeight: 'bold', color: theme.text },
  groupDetail: { fontSize: 13, color: '#666666', marginTop: 2 },
  photoNote: { fontSize: 12, color: theme.muted, marginTop: 2 },
  voteButton: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: theme.primary,
    paddingHorizontal: 16,
    paddingVertical: 10,
    marginLeft: 12,
  },
  voteButtonActive: { backgroundColor: theme.primary },
  voteButtonText: { fontSize: 14, fontWeight: 'bold', color: theme.primary },
  voteButtonTextActive: { color: '#ffffff' },
  dayHeader: { fontSize: 20, fontWeight: 'bold', marginBottom: 8, color: theme.ink },
  emptyRow: { fontSize: 14, color: theme.muted, paddingVertical: 8 },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: theme.border,
  },
  teamText: { fontSize: 16, fontWeight: '500', color: theme.text },
  timeText: { fontSize: 14, color: theme.muted },
});
