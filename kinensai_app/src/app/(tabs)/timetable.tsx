import React, { useCallback, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { M3Badge, M3Button, M3LoadingView, TopAppBar } from '../../components/m3';
import { Rise, Stagger } from '../../components/anim';
import { m3, m3shape, m3type } from '../../theme';
import {
  formatStageTime,
  isNowLineVisible,
  loadNowOverride,
  nowLineIndex,
  resolveNow,
  toMinutes,
  type NowOverride,
  type StageItem,
} from '../../data/timetable';
import { loadAuditorium } from '../../data/timetable';
import { loadCongestion, congestionLabel, type CongestionLevel } from '../../data/congestion';
import { useStageGroups } from '../../data/stage';

function TimeRow({ team, time, highlighted }: { team: string; time: string; highlighted?: boolean }) {
  return (
    <View style={[styles.timeRow, highlighted && styles.timeRowNow]} accessibilityState={{ selected: !!highlighted }}>
      <Text
        style={[m3type.bodyLarge, { color: highlighted ? m3.onPrimaryContainer : m3.onSurface, flex: 1 }]}
        numberOfLines={1}
      >
        {team}
      </Text>
      {highlighted ? <M3Badge label="開催中" /> : null}
      <Text
        style={[
          m3type.bodyMedium,
          { color: highlighted ? m3.onPrimaryContainer : m3.onSurfaceVariant },
          highlighted && styles.timeNow,
        ]}
      >
        {time}
      </Text>
    </View>
  );
}

/** 現在時刻を示す赤線。開催時間外は呼び出し側で描画しない */
function NowLine() {
  return (
    <View style={styles.nowLineWrap} accessibilityRole="none" accessibilityLabel="現在時刻">
      <Text style={[m3type.labelMedium, styles.nowLineLabel]}>いま</Text>
      <View style={styles.nowLine} />
    </View>
  );
}

function byStart(a: StageItem, b: StageItem): number {
  return toMinutes(a.start) - toMinutes(b.start);
}

function DayTimeline({
  day,
  items,
  now,
  nowId,
}: {
  day: number;
  items: StageItem[];
  now: Date;
  nowId: string | null;
}) {
  const sorted = useMemo(() => [...items].sort(byStart), [items]);
  const showLine = isNowLineVisible(day, now, sorted);
  const lineAt = showLine ? nowLineIndex(sorted, now) : -1;
  if (sorted.length === 0) {
    return (
      <View>
        <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>登録がありません</Text>
      </View>
    );
  }
  return (
    <View>
      {sorted.map((item, index) => (
        <React.Fragment key={`a-${day}-${item.id}`}>
          {showLine && lineAt === index ? <NowLine /> : null}
          <Stagger index={index % 10}>
            <TimeRow team={item.team} time={formatStageTime(item)} highlighted={item.id === nowId} />
          </Stagger>
        </React.Fragment>
      ))}
      {showLine && lineAt >= sorted.length ? <NowLine /> : null}
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
  const [now, setNow] = useState(() => new Date());
  const [override, setOverride] = useState<NowOverride>({ auditoriumId: null });
  const { groups } = useStageGroups();

  // 管理者ページの保存を即反映するため、表示のたびに再読込する。
  // 赤線・強調を動かすため現在時刻も1分ごとに更新する。
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      setNow(new Date());
      Promise.all([
        loadAuditorium().catch(() => []),
        loadCongestion().catch(() => 'unknown' as CongestionLevel),
        loadNowOverride().catch((): NowOverride => ({ auditoriumId: null })),
      ]).then(([auditorium, level, nowOverride]) => {
        if (cancelled) return;
        setItems(auditorium);
        setCongestion(level);
        setOverride(nowOverride);
        setIsLoading(false);
      });
      const timer = setInterval(() => setNow(new Date()), 60 * 1000);
      return () => {
        cancelled = true;
        clearInterval(timer);
      };
    }, []),
  );

  const nowItem = resolveNow(items, now, override);
  const saturday = useMemo(() => items.filter((i) => i.day === 0), [items]);
  const sunday = useMemo(() => items.filter((i) => i.day === 1), [items]);

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopAppBar title="タイムテーブル" />
        <M3LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="タイムテーブル" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Rise delay={40}>
          <View style={styles.stageRow}>
            <Text style={[m3type.headlineMedium, styles.stageTitle]} numberOfLines={1}>
              ステージ
            </Text>
            <M3Button
              label="オーディエンス投票"
              icon="how-to-vote"
              variant="tonal"
              style={styles.voteButton}
              onPress={() => router.push('/vote')}
            />
          </View>
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            {nowItem ? `いま講堂で開催中: ${nowItem.team} (${formatStageTime(nowItem)})` : '現在開催中の演目は確認中です'}
            {'  ・  '}
            {congestionLabel(congestion)}
          </Text>
        </Rise>

        <Rise delay={60}>
          <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>土曜日</Text>
          <TimeBox>
            {groups.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>出演者情報は準備中です</Text>
            ) : (
              groups.map((g, i) => (
                <Stagger key={`sat-${g.id}`} index={i % 10}>
                  <TimeRow team={g.name} time={g.detail} />
                </Stagger>
              ))
            )}
          </TimeBox>
        </Rise>

        <Rise delay={80}>
          <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>日曜日</Text>
          <TimeBox>
            {groups.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>出演者情報は準備中です</Text>
            ) : (
              groups.map((g, i) => (
                <Stagger key={`sun-${g.id}`} index={i % 10}>
                  <TimeRow team={g.name} time={g.detail} />
                </Stagger>
              ))
            )}
          </TimeBox>
        </Rise>

        <Rise delay={100}>
          <Text style={[m3type.headlineMedium, styles.auditoriumTitle]}>講堂</Text>
        </Rise>

        <Rise delay={120}>
          <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>土曜日 音楽祭</Text>
          <TimeBox>
            <DayTimeline day={0} items={saturday} now={now} nowId={nowItem?.id ?? null} />
          </TimeBox>
        </Rise>

        <Rise delay={140}>
          <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>日曜日 海神</Text>
          <TimeBox>
            <DayTimeline day={1} items={sunday} now={now} nowId={nowItem?.id ?? null} />
          </TimeBox>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { padding: 16, gap: 16, paddingBottom: 32 },
  stageRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  stageTitle: { color: m3.onSurface, flexShrink: 1 },
  voteButton: { flex: 1, minWidth: 0 },
  auditoriumTitle: { color: m3.onSurface },
  timeBox: {
    backgroundColor: m3.surfaceContainerHigh,
    borderRadius: m3shape.dialog,
    padding: 16,
    minHeight: 76,
    gap: 8,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: m3.outlineVariant,
  },
  timeRowNow: {
    backgroundColor: m3.primaryContainer,
    borderRadius: 12,
    paddingHorizontal: 12,
    borderBottomWidth: 0,
    borderLeftWidth: 4,
    borderLeftColor: m3.primary,
  },
  timeNow: {
    fontWeight: '500',
  },
  nowLineWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 4,
  },
  nowLineLabel: {
    color: m3.error,
  },
  nowLine: {
    flex: 1,
    height: 3,
    borderRadius: 2,
    backgroundColor: m3.error,
  },
});
