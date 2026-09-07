import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, TopAppBar } from '../../components/m3';
import { m3, m3type } from '../../theme';
import { loadAuditorium, findNow, type StageItem } from '../../data/timetable';
import { loadCongestion, congestionLabel, type CongestionLevel } from '../../data/congestion';
import { useStageGroups } from '../../data/stage';

function TimeRow({ team, time }: { team: string; time: string }) {
  return (
    <View style={styles.timeRow}>
      <Text style={[m3type.bodyLarge, { color: m3.onSurface, flex: 1 }]} numberOfLines={1}>
        {team}
      </Text>
      <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>{time}</Text>
    </View>
  );
}

function TimeBox({ children }: { children: React.ReactNode }) {
  return <View style={styles.timeBox}>{children}</View>;
}

export default function TimetableScreen() {
  const [items, setItems] = useState<StageItem[]>([]);
  const [congestion, setCongestion] = useState<CongestionLevel>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [now] = useState(() => new Date());
  const { groups } = useStageGroups();

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
  const delay = (i: StageItem) => `${i.start}–${i.end}${i.delayMinutes > 0 ? ` (${i.delayMinutes}分遅れ)` : ''}`;

  if (isLoading) {
    return (
      <SafeAreaView style={styles.center}>
        <ActivityIndicator size="large" color={m3.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="タイムテーブル" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.stageRow}>
          <Text style={[m3type.headlineMedium, styles.stageTitle]} numberOfLines={1}>
            ステージ
          </Text>
          <M3Button
            label="オーディエンス投票"
            icon="add"
            variant="tonal"
            style={styles.voteButton}
            onPress={() => router.push('/vote')}
          />
        </View>
        <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
          {nowItem ? `いま講堂で開催中: ${nowItem.team} (${delay(nowItem)})` : '現在開催中の演目は確認中です'}
          {'  ・  '}
          {congestionLabel(congestion)}
        </Text>

        <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>土曜日</Text>
        <TimeBox>
          {groups.map((g) => (
            <TimeRow key={`sat-${g.id}`} team={g.name} time={g.detail} />
          ))}
        </TimeBox>

        <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>日曜日</Text>
        <TimeBox>
          {groups.map((g) => (
            <TimeRow key={`sun-${g.id}`} team={g.name} time={g.detail} />
          ))}
        </TimeBox>

        <Text style={[m3type.headlineMedium, styles.auditoriumTitle]}>講堂</Text>

        <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>土曜日 音楽祭</Text>
        <TimeBox>
          {saturday.length === 0 && (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>登録がありません</Text>
          )}
          {saturday.map((item) => (
            <TimeRow key={`a-sat-${item.id}`} team={item.team} time={delay(item)} />
          ))}
        </TimeBox>

        <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>日曜日 海神</Text>
        <TimeBox>
          {sunday.length === 0 && (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>登録がありません</Text>
          )}
          {sunday.map((item) => (
            <TimeRow key={`a-sun-${item.id}`} team={item.team} time={delay(item)} />
          ))}
        </TimeBox>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  center: { flex: 1, backgroundColor: m3.surface, justifyContent: 'center', alignItems: 'center' },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageTitle: { color: m3.onSurface, flexShrink: 1 },
  voteButton: { flex: 1, minWidth: 0 },
  auditoriumTitle: { color: m3.onSurface },
  timeBox: {
    backgroundColor: m3.surfaceContainerHigh,
    borderRadius: 28,
    padding: 16,
    minHeight: 76,
    gap: 4,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: m3.outlineVariant,
  },
});
