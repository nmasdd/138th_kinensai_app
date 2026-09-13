import React, { useCallback, useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3Icon, M3LoadingView, M3PrimaryTabs, M3Touch, TopAppBar } from '../../components/m3';
import { Rise, Stagger } from '../../components/anim';
import { useM3 } from '../../context/responsive';
import { useContentEffect } from '../../context/useContentRefreshKey';
import { m3, scaled, type M3Shape } from '../../theme';
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
import {
  auditoriumGroupsForItems,
  groupStageItems,
  usePerformerGroups,
  type StageGroup,
} from '../../data/stage';
import { loadCongestion, congestionLabel, type CongestionLevel } from '../../data/congestion';
import { festival } from '../../data/festival';
import PerformerDetailModal from '../../components/PerformerDetailModal';

// Google カレンダー風の時間グリッド設定 (1分あたりの高さ・既定の表示範囲)
const PX_PER_MIN = 1.2;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;
const GUTTER = 56;
const MIN_EVENT_H = 40;
const DAY_LABELS = ['土曜日', '日曜日'];
const THEME_NAMES = ['音楽祭', '海神'];
const VENUE_LABELS = ['ステージ', '講堂'];

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
function layoutEvents(
  items: StageItem[],
  rangeStart: number,
  pxPerMin: number,
  minEventH: number,
): PositionedEvent[] {
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
        top: (p.start - rangeStart) * pxPerMin,
        height: Math.max(minEventH, (p.end - p.start) * pxPerMin),
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
  const { type } = useM3();
  const styles = useStyles();
  const tone = congestionTone(level);
  const text = congestionLabel(level).replace(/^混雑状況[:：]\s*/, '混雑: ');
  return (
    <View style={[styles.congestionChip, { backgroundColor: tone.bg }]} accessibilityLabel={congestionLabel(level)}>
      <M3Icon name="groups" size={20} color={tone.fg} />
      <Text style={[type.labelLarge, { color: tone.fg }]} numberOfLines={1}>
        {text}
      </Text>
    </View>
  );
}

/** 時間割が空のときの案内表示 */
function CalendarEmpty({ label }: { label: string }) {
  const { type } = useM3();
  const styles = useStyles();
  return (
    <View style={styles.calEmptyState}>
      <M3Icon name="event-busy" size={32} color={m3.onSurfaceVariant} />
      <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
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
  const { type, scale } = useM3();
  const styles = useStyles();
  // 時間グリッドの内部ジオメトリも画面幅に追従させる
  const pxPerMin = PX_PER_MIN * scale;
  const gutter = scaled(GUTTER, scale);
  const minEventH = scaled(MIN_EVENT_H, scale);
  const edge = scaled(12, scale);
  const hourLabelWidth = gutter - scaled(10, scale);
  const hourLabelOffset = scaled(8, scale);
  const nowDotSize = scaled(10, scale);
  const range = useMemo(() => rangeOf(items, base), [items, base]);
  const positioned = useMemo(
    () => layoutEvents(items, range.start, pxPerMin, minEventH),
    [items, range.start, pxPerMin, minEventH],
  );
  const totalHeight = (range.end - range.start) * pxPerMin;
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let m = range.start; m <= range.end; m += 60) arr.push(m);
    return arr;
  }, [range.start, range.end]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow =
    timetableDayOfDate(now) === day && nowMinutes >= range.start && nowMinutes <= range.end;
  const nowTop = (nowMinutes - range.start) * pxPerMin;

  return (
    <View style={[styles.calBody, { height: totalHeight }]}>
      {hours.map((m) => {
        const top = (m - range.start) * pxPerMin;
        return (
          <React.Fragment key={`hour-${m}`}>
            <View style={[styles.calHourLine, { top, left: gutter, right: edge }]} />
            <Text
              allowFontScaling={false}
              style={[type.labelMedium, styles.calHourLabel, { top: top - hourLabelOffset, width: hourLabelWidth }]}
            >
              {formatHour(m)}
            </Text>
          </React.Fragment>
        );
      })}
      <View style={[styles.calEvents, { left: gutter, right: edge }]}>
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
                <Text style={[type.titleSmall, styles.calEventTitle]} numberOfLines={1}>
                  {p.item.team}
                </Text>
                <Text style={[type.labelMedium, styles.calEventTime]} numberOfLines={1}>
                  {p.item.start}–{p.item.end}
                </Text>
                {showDelay ? (
                  <View style={styles.calDelay}>
                    <Text style={[type.labelMedium, { color: m3.onErrorContainer }]} numberOfLines={1}>
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
        <View
          style={[styles.calNow, { top: nowTop, left: gutter - scaled(10, scale), right: edge }]}
          pointerEvents="none"
          accessibilityLabel="現在時刻"
        >
          <View style={[styles.calNowDot, { width: nowDotSize, height: nowDotSize, borderRadius: nowDotSize / 2 }]} />
          <View style={styles.calNowLine} />
        </View>
      ) : null}
    </View>
  );
}

function GroupCard({ group, onPress }: { group: StageGroup; onPress: () => void }) {
  const { type } = useM3();
  const styles = useStyles();
  return (
    <M3Touch
      onPress={onPress}
      label={`${group.name}の詳細を表示`}
      round
      style={styles.groupCardTouch}
    >
      <View style={styles.groupCard}>
        {group.imageUri ? (
          <Image source={{ uri: group.imageUri }} style={styles.groupThumb} resizeMode="cover" />
        ) : (
          <View style={[styles.groupThumb, styles.groupThumbEmpty]}>
            <M3Icon name="groups" color={m3.onSecondaryContainer} />
          </View>
        )}
        <View style={styles.groupInfo}>
          <Text style={[type.titleMedium, { color: m3.onSurface }]} numberOfLines={1}>
            {group.name}
          </Text>
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={2}>
            {group.detail || '補足テキストがここに入ります。'}
          </Text>
        </View>
        <M3Icon name="chevron-right" color={m3.onSurfaceVariant} />
      </View>
    </M3Touch>
  );
}

/** 出演団体のカード一覧。ステージ・講堂の両タブで共通表示する (土日共通)。 */
function PerformerList({
  groups,
  onSelect,
}: {
  groups: StageGroup[];
  onSelect: (g: StageGroup) => void;
}) {
  const { type } = useM3();
  const styles = useStyles();
  return (
    <Rise delay={120}>
      <Text style={[type.headlineSmall, { color: m3.onSurface }]}>出演団体</Text>
      <View style={styles.groupList}>
        {groups.length === 0 ? (
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            出演者情報は準備中です
          </Text>
        ) : (
          groups.map((g, i) => (
            <Stagger key={g.id} index={i % 10}>
              <GroupCard group={g} onPress={() => onSelect(g)} />
            </Stagger>
          ))
        )}
      </View>
    </Rise>
  );
}

export default function TimetableScreen() {
  const { type } = useM3();
  const styles = useStyles();
  const [items, setItems] = useState<StageItem[]>([]);
  const [congestion, setCongestion] = useState<CongestionLevel>('unknown');
  const [isLoading, setIsLoading] = useState(true);
  const [now, setNow] = useState(() => new Date());
  const [override, setOverride] = useState<NowOverride>({ auditoriumId: null });
  const [day, setDay] = useState(() => {
    const today = timetableDayOfDate(new Date());
    return today >= 0 ? today : 0;
  });
  // 上位タブ: 0=ステージ, 1=講堂
  const [venue, setVenue] = useState(0);
  const { groups: stageGroups } = usePerformerGroups('stage');
  const { groups: auditoriumMeta } = usePerformerGroups('auditorium');
  const [selected, setSelected] = useState<StageGroup | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const openDetail = useCallback((g: StageGroup) => {
    setSelected(g);
    setDetailVisible(true);
  }, []);

  // 管理者ページの保存・公開コンテンツの更新を即反映する。
  // 赤線・強調を動かすため現在時刻も1分ごとに更新する。
  useContentEffect(() => {
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
  });

  const nowItem = resolveNow(items, now, override);
  const dayItems = useMemo(() => items.filter((i) => i.day === day), [items, day]);

  // ステージ出演団体のうち日時が確定しているものを講堂と同じ時間割で描画する
  const stageItems = useMemo(() => groupStageItems(stageGroups), [stageGroups]);
  const stageDayItems = useMemo(() => stageItems.filter((i) => i.day === day), [stageItems, day]);
  const stageNow = findNow(stageItems, now);

  // 講堂の出演団体は time/Auditorium.csv の演目名を正とし、
  // auditorium-groups.json のメタ情報 (紹介文・写真) を突き合わせる。
  const auditoriumGroups = useMemo(
    () => auditoriumGroupsForItems(items, auditoriumMeta),
    [items, auditoriumMeta],
  );

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
          <View style={styles.tabGroup}>
            <M3PrimaryTabs labels={VENUE_LABELS} value={venue} onValueChange={setVenue} />
            <M3PrimaryTabs labels={DAY_LABELS} value={day} onValueChange={setDay} />
          </View>
        </Rise>

        {venue === 0 ? (
          <>
            <Rise delay={80}>
              <View style={styles.calHeader}>
                <View style={styles.stageRow}>
                  <Text style={[type.headlineMedium, styles.stageTitle]} numberOfLines={1}>
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
                <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
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

            <PerformerList groups={stageGroups} onSelect={openDetail} />
          </>
        ) : (
          <>
            <Rise delay={80}>
              <View style={styles.calHeader}>
                <View style={styles.calTitleRow}>
                  <Text style={[type.headlineSmall, { color: m3.onSurface }]}>講堂 {THEME_NAMES[day]}</Text>
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
            <PerformerList groups={auditoriumGroups} onSelect={openDetail} />
          </>
        )}
      </ScrollView>
      <PerformerDetailModal
        group={selected}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        title={venue === 1 ? '講堂出演団体' : 'ステージ出演団体'}
      />
    </SafeAreaView>
  );
}

function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    body: { padding: scaled(16, s), paddingTop: 0, gap: scaled(16, s), paddingBottom: scaled(32, s) },
    tabGroup: { gap: scaled(4, s) },
    stageRow: { flexDirection: 'row', alignItems: 'center', gap: scaled(12, s) },
    stageTitle: { color: m3.onSurface, flexShrink: 1 },
    voteButton: { flex: 1, minWidth: 0 },

    calHeader: { gap: scaled(2, s), marginBottom: scaled(12, s) },
    calTitleRow: { flexDirection: 'row', alignItems: 'center', gap: scaled(12, s), flexWrap: 'wrap' },
    congestionChip: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: scaled(8, s),
      borderRadius: shape.pill,
      minHeight: scaled(56, s),
      paddingHorizontal: scaled(24, s),
      paddingVertical: scaled(8, s),
      maxWidth: '100%',
    },
    calCard: {
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: shape.dialog,
      borderWidth: 1,
      borderColor: m3.outlineVariant,
      paddingHorizontal: scaled(12, s),
      paddingVertical: scaled(16, s),
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
    calEventWrap: { position: 'absolute', paddingRight: scaled(6, s) },
    calEvent: {
      flex: 1,
      backgroundColor: m3.primaryContainer,
      borderRadius: scaled(10, s),
      borderLeftWidth: 4,
      borderLeftColor: m3.primary,
      paddingHorizontal: scaled(8, s),
      paddingVertical: scaled(6, s),
      justifyContent: 'center',
      overflow: 'hidden',
    },
    calEventNow: { backgroundColor: m3.tertiaryContainer, borderLeftColor: m3.primary },
    calEventTitle: { color: m3.onPrimaryContainer },
    calEventTime: { color: m3.onPrimaryContainer },
    calDelay: {
      alignSelf: 'flex-start',
      backgroundColor: m3.errorContainer,
      borderRadius: scaled(6, s),
      paddingHorizontal: scaled(6, s),
      paddingVertical: scaled(1, s),
      marginTop: scaled(2, s),
    },
    calNow: { position: 'absolute', left: GUTTER - 10, right: 12, flexDirection: 'row', alignItems: 'center' },
    calNowDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: m3.error },
    calNowLine: { flex: 1, height: 2, backgroundColor: m3.error },
    calEmptyState: {
      alignItems: 'center',
      justifyContent: 'center',
      gap: scaled(8, s),
      paddingVertical: scaled(48, s),
    },

    groupList: { gap: scaled(12, s), marginTop: scaled(12, s) },
    groupCardTouch: { borderRadius: shape.card },
    groupCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(12, s),
      backgroundColor: m3.surfaceContainerLow,
      borderRadius: shape.card,
      padding: scaled(12, s),
    },
    groupThumb: {
      width: scaled(48, s),
      height: scaled(48, s),
      borderRadius: scaled(12, s),
      backgroundColor: m3.surfaceContainerHighest,
    },
    groupThumbEmpty: { justifyContent: 'center', alignItems: 'center' },
    groupInfo: { flex: 1, minWidth: 0, gap: scaled(2, s) },
  });
}

function useStyles() {
  const { scale, shape } = useM3();
  return React.useMemo(() => createStyles(scale, shape), [scale, shape]);
}
