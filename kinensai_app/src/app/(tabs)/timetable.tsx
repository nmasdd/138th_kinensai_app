import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { M3Button, M3Icon, M3LoadingView, M3PrimaryTabs, TopAppBar } from '../../components/m3';
import { Rise, Stagger } from '../../components/anim';
import { m3, m3shape, m3type } from '../../theme';
import {
  delayStatusText,
  findNow,
  loadAuditorium,
  loadNowOverride,
  resolveNow,
  timetableDayOfDate,
  toMinutes,
  type NowOverride,
  type StageItem,
} from '../../data/timetable';
import { groupStageItems, useStageGroups, type StageGroup } from '../../data/stage';
import { loadCongestion, congestionLabel, type CongestionLevel } from '../../data/congestion';
import { festival } from '../../data/festival';

// Google カレンダー風の時間グリッド設定 (1分あたりの高さ・既定の表示範囲)
const PX_PER_MIN = 1.2;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;
const GUTTER = 56;
const MIN_EVENT_H = 40;
const DAY_LABELS = ['土曜日', '日曜日'];
const THEME_NAMES = ['音楽祭', '海神'];

function formatHour(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, '0')}:00`;
}

/** "12:00–16:00" のような催し時間を分に換算する */
function parseRange(time: string): { start: number; end: number } {
  const [s, e] = time.split(/[–-]/).map((v) => toMinutes(v.trim()));
  if (Number.isFinite(s) && Number.isFinite(e) && e > s) return { start: s, end: e };
  return { start: DEFAULT_START, end: DEFAULT_END };
}

/** 催し時間を基準に、演目がはみ出す分だけ表示範囲 (時単位) を広げる */
function rangeOf(items: StageItem[], base: { start: number; end: number }): { start: number; end: number } {
  if (items.length === 0) return base;
  const starts = items.map((it) => toMinutes(it.start) + it.delayMinutes).filter(Number.isFinite);
  const ends = items.map((it) => toMinutes(it.end) + it.delayMinutes).filter(Number.isFinite);
  if (starts.length === 0 || ends.length === 0) return base;
  return {
    start: Math.min(base.start, Math.floor(Math.min(...starts) / 60) * 60),
    end: Math.max(base.end, Math.ceil(Math.max(...ends) / 60) * 60),
  };
}

interface PositionedEvent {
  item: StageItem;
  top: number;
  height: number;
  col: number;
  cols: number;
}

/**
 * 重なる演目を列に振り分ける (Google カレンダーと同じく横並び表示)。
 * 時間が重ならないまとまり (クラスタ) ごとに貪欲法で列番号を割り当てる。
 */
function layoutEvents(items: StageItem[], rangeStart: number): PositionedEvent[] {
  const sorted = [...items].sort(
    (a, b) => toMinutes(a.start) + a.delayMinutes - (toMinutes(b.start) + b.delayMinutes),
  );
  const out: PositionedEvent[] = [];
  let cluster: { item: StageItem; start: number; end: number }[] = [];
  let clusterEnd = -1;

  const flush = () => {
    const colEnds: number[] = [];
    const placed = cluster.map((c) => {
      let col = colEnds.findIndex((end) => end <= c.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(c.end);
      } else {
        colEnds[col] = c.end;
      }
      return { ...c, col };
    });
    for (const p of placed) {
      out.push({
        item: p.item,
        top: (p.start - rangeStart) * PX_PER_MIN,
        height: Math.max(MIN_EVENT_H, (p.end - p.start) * PX_PER_MIN),
        col: p.col,
        cols: colEnds.length,
      });
    }
    cluster = [];
    clusterEnd = -1;
  };

  for (const it of sorted) {
    const start = toMinutes(it.start) + it.delayMinutes;
    const end = Math.max(start + 18, toMinutes(it.end) + it.delayMinutes);
    if (cluster.length > 0 && start >= clusterEnd) flush();
    cluster.push({ item: it, start, end });
    clusterEnd = Math.max(clusterEnd, end);
  }
  if (cluster.length > 0) flush();
  return out;
}

/** 講堂の混雑レベルに応じた色 (M3ロール)。 */
function congestionTone(level: CongestionLevel): { bg: string; fg: string } {
  switch (level) {
    case 'empty':
      return { bg: m3.secondaryContainer, fg: m3.onSecondaryContainer };
    case 'normal':
      return { bg: m3.tertiaryContainer, fg: m3.onTertiaryContainer };
    case 'crowded':
      return { bg: m3.errorContainer, fg: m3.onErrorContainer };
    default:
      return { bg: m3.surfaceContainerHighest, fg: m3.onSurfaceVariant };
  }
}

/** 講堂混雑状況のチップ。見出しの隣に表示する。 */
function CongestionChip({ level }: { level: CongestionLevel }) {
  const tone = congestionTone(level);
  const text = congestionLabel(level).replace(/^混雑状況[:：]\s*/, '混雑: ');
  return (
    <View style={[styles.congestionChip, { backgroundColor: tone.bg }]} accessibilityLabel={congestionLabel(level)}>
      <M3Icon name="groups" size={20} color={tone.fg} />
      <Text style={[m3type.labelLarge, { color: tone.fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** 時間割が空のときの案内表示 */
function CalendarEmpty({ label }: { label: string }) {
  return (
    <View style={styles.calEmptyState}>
      <M3Icon name="event-busy" size={32} color={m3.onSurfaceVariant} />
      <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
        {label}
      </Text>
    </View>
  );
}

/** Google カレンダー風の1日タイムグリッド。演目を開始/終了時刻に応じて配置する */
function StageCalendar({
  items,
  day,
  base,
  now,
  nowId,
}: {
  items: StageItem[];
  day: number;
  base: { start: number; end: number };
  now: Date;
  nowId: string | null;
}) {
  const range = useMemo(() => rangeOf(items, base), [items, base]);
  const positioned = useMemo(() => layoutEvents(items, range.start), [items, range.start]);
  const totalHeight = (range.end - range.start) * PX_PER_MIN;
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let m = range.start; m <= range.end; m += 60) arr.push(m);
    return arr;
  }, [range.start, range.end]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow =
    timetableDayOfDate(now) === day && nowMinutes >= range.start && nowMinutes <= range.end;
  const nowTop = (nowMinutes - range.start) * PX_PER_MIN;

  return (
    <View style={[styles.calBody, { height: totalHeight }]}>
      {hours.map((m) => {
        const top = (m - range.start) * PX_PER_MIN;
        return (
          <React.Fragment key={`hour-${m}`}>
            <View style={[styles.calHourLine, { top }]} />
            <Text allowFontScaling={false} style={[m3type.labelMedium, styles.calHourLabel, { top: top - 8 }]}>
              {formatHour(m)}
            </Text>
          </React.Fragment>
        );
      })}
      <View style={styles.calEvents}>
        {positioned.map((p) => {
          const isNow = p.item.id === nowId;
          const showDelay = p.item.delayMinutes > 0;
          return (
            <View
              key={p.item.id}
              style={[
                styles.calEventWrap,
                { top: p.top, height: p.height, left: `${(p.col / p.cols) * 100}%`, width: `${100 / p.cols}%` },
              ]}
            >
              <View
                style={[styles.calEvent, isNow && styles.calEventNow]}
                accessibilityLabel={`${p.item.team} ${p.item.start}から${p.item.end}${showDelay ? ` ${delayStatusText(p.item.delayMinutes)}` : ''}`}
              >
                <Text style={[m3type.titleSmall, styles.calEventTitle]} numberOfLines={1}>
                  {p.item.team}
                </Text>
                <Text style={[m3type.labelMedium, styles.calEventTime]} numberOfLines={1}>
                  {p.item.start}–{p.item.end}
                </Text>
                {showDelay ? (
                  <View style={styles.calDelay}>
                    <Text style={[m3type.labelMedium, { color: m3.onErrorContainer }]} numberOfLines={1}>
                      {delayStatusText(p.item.delayMinutes)}
                    </Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        })}
      </View>
      {showNow ? (
        <View style={[styles.calNow, { top: nowTop }]} pointerEvents="none" accessibilityLabel="現在時刻">
          <View style={styles.calNowDot} />
          <View style={styles.calNowLine} />
        </View>
      ) : null}
    </View>
  );
}

function GroupCard({ group }: { group: StageGroup }) {
  return (
    <View style={styles.groupCard}>
      {group.imageUri ? (
        <Image source={{ uri: group.imageUri }} style={styles.groupThumb} resizeMode="cover" />
      ) : (
        <View style={[styles.groupThumb, styles.groupThumbEmpty]}>
          <M3Icon name="groups" color={m3.onSecondaryContainer} />
        </View>
      )}
      <View style={styles.groupInfo}>
        <Text style={[m3type.titleMedium, { color: m3.onSurface }]} numberOfLines={1}>
          {group.name}
        </Text>
        <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={2}>
          {group.detail}
        </Text>
      </View>
    </View>
  );
}

export default function TimetableScreen() {
  const [items, setItems] = useState<StageItem[]>([]);
  const [congestion, setCongestion] = useState<CongestionLevel>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [override, setOverride] = useState<NowOverride>({ auditoriumId: null });
  const [day, setDay] = useState(() => {
    const today = timetableDayOfDate(new Date());
    return today >= 0 ? today : 0;
  });
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
  const dayItems = useMemo(() => items.filter((i) => i.day === day), [items, day]);

  // ステージ出演団体のうち日時が確定しているものを講堂と同じ時間割で描画する
  const stageItems = useMemo(() => groupStageItems(groups), [groups]);
  const stageDayItems = useMemo(() => stageItems.filter((i) => i.day === day), [stageItems, day]);
  const stageNow = findNow(stageItems, now);

  const dateInfo = festival.dates[day === 1 ? 1 : 0];
  const baseRange = useMemo(() => parseRange(dateInfo.time), [dateInfo.time]);

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
          <M3PrimaryTabs labels={DAY_LABELS} value={day} onValueChange={setDay} />
        </Rise>

        <Rise delay={80}>
          <View style={styles.calHeader}>
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
              野外ステージ（雨天時は体育館）
            </Text>
          </View>
          <View style={styles.calCard}>
            {stageDayItems.length === 0 ? (
              <CalendarEmpty label="ステージの演目は準備中です" />
            ) : (
              <StageCalendar items={stageDayItems} day={day} base={baseRange} now={now} nowId={stageNow?.id ?? null} />
            )}
          </View>
        </Rise>

        <Rise delay={100}>
          <View style={styles.calHeader}>
            <View style={styles.calTitleRow}>
              <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>講堂 {THEME_NAMES[day]}</Text>
              <CongestionChip level={congestion} />
            </View>
          </View>
          <View style={styles.calCard}>
            {dayItems.length === 0 ? (
              <CalendarEmpty label="講堂の演目は準備中です" />
            ) : (
              <StageCalendar items={dayItems} day={day} base={baseRange} now={now} nowId={nowItem?.id ?? null} />
            )}
          </View>
        </Rise>

        <Rise delay={120}>
          <Text style={[m3type.headlineSmall, { color: m3.onSurface }]}>出演団体</Text>
          <View style={styles.groupList}>
            {groups.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                出演者情報は準備中です
              </Text>
            ) : (
              groups.map((g, i) => (
                <Stagger key={g.id} index={i % 10}>
                  <GroupCard group={g} />
                </Stagger>
              ))
            )}
          </View>
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

  calHeader: { gap: 2, marginBottom: 12 },
  calTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' },
  congestionChip: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: m3shape.pill,
    minHeight: 56,
    paddingHorizontal: 24,
    paddingVertical: 8,
    maxWidth: '100%',
  },
  calCard: {
    backgroundColor: m3.surfaceContainerLow,
    borderRadius: m3shape.dialog,
    borderWidth: 1,
    borderColor: m3.outlineVariant,
    paddingHorizontal: 12,
    paddingVertical: 16,
  },
  calBody: { position: 'relative' },
  calHourLine: {
    position: 'absolute',
    left: GUTTER,
    right: 12,
    height: 1,
    backgroundColor: m3.outlineVariant,
  },
  calHourLabel: {
    position: 'absolute',
    left: 0,
    width: GUTTER - 10,
    textAlign: 'right',
    color: m3.onSurfaceVariant,
  },
  calEvents: { position: 'absolute', left: GUTTER, right: 12, top: 0, bottom: 0 },
  calEventWrap: { position: 'absolute', paddingRight: 6 },
  calEvent: {
    flex: 1,
    backgroundColor: m3.primaryContainer,
    borderRadius: 10,
    borderLeftWidth: 4,
    borderLeftColor: m3.primary,
    paddingHorizontal: 8,
    paddingVertical: 6,
    justifyContent: 'center',
    overflow: 'hidden',
  },
  calEventNow: { backgroundColor: m3.tertiaryContainer, borderLeftColor: m3.primary },
  calEventTitle: { color: m3.onPrimaryContainer },
  calEventTime: { color: m3.onPrimaryContainer },
  calDelay: {
    alignSelf: 'flex-start',
    backgroundColor: m3.errorContainer,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
    marginTop: 2,
  },
  calNow: { position: 'absolute', left: GUTTER - 10, right: 12, flexDirection: 'row', alignItems: 'center' },
  calNowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: m3.error },
  calNowLine: { flex: 1, height: 2, backgroundColor: m3.error },
  calEmptyState: { alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 48 },

  groupList: { gap: 12, marginTop: 12 },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: m3.surfaceContainerLow,
    borderRadius: m3shape.card,
    padding: 12,
  },
  groupThumb: { width: 48, height: 48, borderRadius: 12, backgroundColor: m3.surfaceContainerHighest },
  groupThumbEmpty: { justifyContent: 'center', alignItems: 'center' },
  groupInfo: { flex: 1, minWidth: 0, gap: 2 },
});
