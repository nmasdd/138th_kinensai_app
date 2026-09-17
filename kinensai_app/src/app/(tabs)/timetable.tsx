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
  loadStage,
  resolveNow,
  timetableDayOfDate,
  toMinutes,
  type NowOverride,
  type StageItem,
} from '../../data/timetable';
import {
  auditoriumGroupsForItems,
  usePerformerGroups,
  type StageGroup,
} from '../../data/stage';
import { loadCongestion, congestionLabel, type CongestionLevel } from '../../data/congestion';
import { festival } from '../../data/festival';
import PerformerDetailModal from '../../components/PerformerDetailModal';

// Google カレンダー風の時間グリッド設定。
// 演目と待ち時間で「時間→高さ」の比率を変え、長い演目や待ち時間を詰める。
// 演目：1分あたり ITEM_PX_PER_MIN。最小/最大高さで挟む。
const ITEM_PX_PER_MIN = 4;
// 待ち時間 (演目と演目の間)：1分あたり GAP_PX_PER_MIN で圧縮する。
const GAP_PX_PER_MIN = 1;
// この尺 (分) 以下の演目は名前の隣に時間を並べた1行表示にする。
const SHORT_EVENT_MAX_MINUTES = 10;
// 2行表示の演目の最小高さ。
const MIN_EVENT_H = 40;
// 1行表示 (10分以下) の演目の最小高さ。
const SHORT_EVENT_H = 26;
// 演目1件の最大高さ。長い演目を圧縮して全体を短くする。
const MAX_EVENT_H = 88;
// 待ち時間の最小/最大高さ (ブロックの間隔を保ちつつ長い休憩を詰める)。
const MIN_GAP_H = 6;
const MAX_GAP_H = 20;
const DEFAULT_START = 8 * 60;
const DEFAULT_END = 18 * 60;
const GUTTER = 56;
const DAY_LABELS = ['土曜日', '日曜日'];
const THEME_NAMES = ['音楽祭', '海神'];
const VENUE_LABELS = ['ステージ', '講堂'];

/** 演目の尺 (分)。不正なら負値。 */
function durationOf(item: StageItem): number {
  return toMinutes(item.end) - toMinutes(item.start);
}

/** 名前の隣に時間を出す1行表示にするか (短い演目) */
function isShortEvent(item: StageItem): boolean {
  const d = durationOf(item);
  return d > 0 && d <= SHORT_EVENT_MAX_MINUTES;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(Math.max(v, min), max);
}

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
 * 時間軸の区間。`from`〜`to` (分) を 1分あたり `pxPerMin` で `top` から描画する。
 * 演目区間と待ち時間区間で縮尺が異なる。
 */
interface ScaleSegment {
  from: number;
  to: number;
  top: number;
  pxPerMin: number;
}

/** 区間列で「分」を縦位置 (px) に変換する。区間外は端に丸める。 */
function yOf(segments: ScaleSegment[], minute: number, total: number): number {
  if (segments.length === 0) return 0;
  if (minute <= segments[0].from) return 0;
  for (const s of segments) {
    if (minute <= s.to) return s.top + (minute - s.from) * s.pxPerMin;
  }
  return total;
}

interface ScaleOptions {
  /** 演目の1分あたりの高さ */
  itemPxPerMin: number;
  /** 待ち時間の1分あたりの高さ (圧縮用) */
  gapPxPerMin: number;
  /** 2行表示の演目の最小高さ */
  minItemH: number;
  /** 1行表示の演目の最小高さ */
  shortItemH: number;
  /** 演目1件の最大高さ */
  maxItemH: number;
  /** 待ち時間の最小高さ */
  minGapH: number;
  /** 待ち時間の最大高さ */
  maxGapH: number;
}

interface TimeScale {
  events: PositionedEvent[];
  segments: ScaleSegment[];
  total: number;
}

interface ClusterItem {
  item: StageItem;
  start: number;
  end: number;
  col: number;
  cols: number;
}

/**
 * 演目と待ち時間で縮尺を変えた時間軸を組み立てる。
 * - 演目：1分あたり `itemPxPerMin`。ただし1行/2行表示の最小高さと
 *   `maxItemH` (長い演目の圧縮) で挟む。
 * - 待ち時間：1分あたり `gapPxPerMin` で圧縮し、`minGapH`/`maxGapH` で挟む。
 * 区間の並びは実時間の順序を保つため、縦位置は前後関係が正しいまま短くなる。
 * 重なる演目はクラスタごとに列分割して横並びにする。
 */
function layoutEvents(
  items: StageItem[],
  rangeStart: number,
  rangeEnd: number,
  opt: ScaleOptions,
): TimeScale {
  const sorted = items
    .map((item) => {
      const start = toMinutes(item.start) + item.delayMinutes;
      const end = Math.max(start + 1, toMinutes(item.end) + item.delayMinutes);
      return { item, start, end };
    })
    .sort((a, b) => a.start - b.start);

  const segments: ScaleSegment[] = [];
  const placements: ClusterItem[] = [];
  const gapHeight = (minutes: number) => clamp(minutes * opt.gapPxPerMin, opt.minGapH, opt.maxGapH);
  let cursor = rangeStart;
  let top = 0;

  const pushSegment = (from: number, to: number, height: number) => {
    if (to <= from || height <= 0) return;
    segments.push({ from, to, top, pxPerMin: height / (to - from) });
    top += height;
  };

  let i = 0;
  while (i < sorted.length) {
    // 時間が重なる演目をまとめて1クラスタにする (列分割表示の単位)
    const cluster = [sorted[i]];
    let end = sorted[i].end;
    let j = i + 1;
    while (j < sorted.length && sorted[j].start < end) {
      cluster.push(sorted[j]);
      end = Math.max(end, sorted[j].end);
      j += 1;
    }
    const start = Math.min(...cluster.map((c) => c.start));
    if (start > cursor) pushSegment(cursor, start, gapHeight(start - cursor));
    const minH = Math.max(...cluster.map((c) => (isShortEvent(c.item) ? opt.shortItemH : opt.minItemH)));
    pushSegment(start, end, clamp((end - start) * opt.itemPxPerMin, minH, opt.maxItemH));

    // 列の割り当て (重ならないクラスタでは常に1列)
    const colEnds: number[] = [];
    for (const c of cluster) {
      let col = colEnds.findIndex((colEnd) => colEnd <= c.start);
      if (col === -1) {
        col = colEnds.length;
        colEnds.push(c.end);
      } else {
        colEnds[col] = c.end;
      }
      placements.push({ ...c, col, cols: 0 });
    }
    for (let k = placements.length - cluster.length; k < placements.length; k += 1) {
      placements[k].cols = colEnds.length;
    }
    cursor = end;
    i = j;
  }
  if (cursor < rangeEnd) pushSegment(cursor, rangeEnd, gapHeight(rangeEnd - cursor));

  const at = (minute: number) => yOf(segments, minute, top);
  const events = placements.map((c) => ({
    item: c.item,
    top: at(c.start),
    height: Math.max(1, at(c.end) - at(c.start)),
    col: c.col,
    cols: c.cols,
  }));
  return { events, segments, total: top };
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
  canOpenItem,
  onOpenItem,
}: {
  items: StageItem[];
  day: number;
  base: { start: number; end: number };
  now: Date;
  nowId: string | null;
  /** 演目ブロックをタップして詳細を開けるか (出演団体情報がある演目のみ) */
  canOpenItem?: (item: StageItem) => boolean;
  /** 演目ブロックのタップ (出演団体の詳細モーダルを開く) */
  onOpenItem?: (item: StageItem) => void;
}) {
  const { type, scale } = useM3();
  const styles = useStyles();
  // 時間グリッドの内部ジオメトリも画面幅に追従させる
  const gutter = scaled(GUTTER, scale);
  const shortEventH = scaled(SHORT_EVENT_H, scale);
  const edge = scaled(12, scale);
  const hourLabelWidth = gutter - scaled(10, scale);
  const hourLabelOffset = scaled(8, scale);
  const nowDotSize = scaled(10, scale);
  const range = useMemo(() => rangeOf(items, base), [items, base]);
  // 演目 (ITEM_PX_PER_MIN) と待ち時間 (GAP_PX_PER_MIN) で比率を変えた時間軸。
  // 長い演目は MAX_EVENT_H で、待ち時間は MAX_GAP_H で詰めて全体を短くする。
  const timeScale = useMemo(
    () =>
      layoutEvents(items, range.start, range.end, {
        itemPxPerMin: ITEM_PX_PER_MIN * scale,
        gapPxPerMin: GAP_PX_PER_MIN * scale,
        minItemH: scaled(MIN_EVENT_H, scale),
        shortItemH: shortEventH,
        maxItemH: scaled(MAX_EVENT_H, scale),
        minGapH: scaled(MIN_GAP_H, scale),
        maxGapH: scaled(MAX_GAP_H, scale),
      }),
    [items, range.start, range.end, scale, shortEventH],
  );
  const positioned = timeScale.events;
  const totalHeight = timeScale.total;
  const yAt = useCallback(
    (minute: number) => yOf(timeScale.segments, minute, timeScale.total),
    [timeScale],
  );
  const hours = useMemo(() => {
    const arr: number[] = [];
    for (let m = range.start; m <= range.end; m += 60) arr.push(m);
    return arr;
  }, [range.start, range.end]);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const showNow =
    timetableDayOfDate(now) === day && nowMinutes >= range.start && nowMinutes <= range.end;
  const nowTop = yAt(nowMinutes);

  return (
    <View style={[styles.calBody, { height: totalHeight }]}>
      {hours.map((m) => {
        const top = yAt(m);
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
          // 短い演目は縦に2行入らないため、名前の隣に時間を並べた1行表示にする
          const short = isShortEvent(p.item);
          const label = `${p.item.team} ${p.item.start}から${p.item.end}${showDelay ? ` ${delayStatusText(p.item.delayMinutes)}` : ''}`;
          const boxStyle = [styles.calEvent, short && styles.calEventShort, isNow && styles.calEventNow];
          const content = short ? (
            <View style={styles.calEventLine}>
              <Text style={[type.titleSmall, styles.calEventTitle, styles.calEventNameInline]} numberOfLines={1}>
                {p.item.team}
              </Text>
              <Text
                style={[type.labelMedium, showDelay ? styles.calEventTimeDelay : styles.calEventTime]}
                numberOfLines={1}
              >
                {p.item.start}–{p.item.end}
                {showDelay ? `・${delayStatusText(p.item.delayMinutes)}` : ''}
              </Text>
            </View>
          ) : (
            <>
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
            </>
          );
          // 出演団体情報がある演目はタップで詳細を開ける (海神のブロック等は対象外)
          const openable = !!onOpenItem && !!canOpenItem?.(p.item);
          return (
            <View
              key={p.item.id}
              style={[
                styles.calEventWrap,
                { top: p.top, height: p.height, left: `${(p.col / p.cols) * 100}%`, width: `${100 / p.cols}%` },
              ]}
            >
              {openable ? (
                <M3Touch
                  onPress={() => onOpenItem?.(p.item)}
                  label={`${p.item.team}の詳細を表示`}
                  style={boxStyle}
                >
                  {content}
                </M3Touch>
              ) : (
                <View style={boxStyle} accessibilityLabel={label}>
                  {content}
                </View>
              )}
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

function GroupCard({
  group,
  onPress,
  showThumb = true,
}: {
  group: StageGroup;
  onPress: () => void;
  /** 写真の欄を表示するか */
  showThumb?: boolean;
}) {
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
        {showThumb ? (
          group.imageUri ? (
            <Image source={{ uri: group.imageUri }} style={styles.groupThumb} resizeMode="cover" />
          ) : (
            <View style={[styles.groupThumb, styles.groupThumbEmpty]}>
              <M3Icon name="groups" color={m3.onSecondaryContainer} />
            </View>
          )
        ) : null}
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

/** 出演団体のカード一覧。ステージ・講堂の両タブで共通表示する。 */
function PerformerList({
  groups,
  onSelect,
  title = '出演団体',
  showThumb = true,
}: {
  groups: StageGroup[];
  onSelect: (g: StageGroup) => void;
  title?: string;
  /** 写真の欄を表示するか (写真を持たない一覧では省ける) */
  showThumb?: boolean;
}) {
  const { type } = useM3();
  const styles = useStyles();
  return (
    <Rise delay={120}>
      <Text style={[type.headlineSmall, { color: m3.onSurface }]}>{title}</Text>
      <View style={styles.groupList}>
        {groups.length === 0 ? (
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            出演者情報は準備中です
          </Text>
        ) : (
          groups.map((g, i) => (
            <Stagger key={g.id} index={i % 10}>
              <GroupCard group={g} onPress={() => onSelect(g)} showThumb={showThumb} />
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
  const [stageItems, setStageItems] = useState<StageItem[]>([]);
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

  // 演目名 → 出演団体のメタ情報。タイムテーブルのブロックをタップしたときに使う。
  // 該当がない演目 (海神のブロック等) は詳細を開かない。
  const stageByName = useMemo(() => new Map(stageGroups.map((g) => [g.name, g])), [stageGroups]);
  const auditoriumByName = useMemo(
    () => new Map(auditoriumMeta.map((g) => [g.name, g])),
    [auditoriumMeta],
  );
  const performerForItem = useCallback(
    (item: StageItem): StageGroup | null =>
      (venue === 0 ? stageByName : auditoriumByName).get(item.team) ?? null,
    [venue, stageByName, auditoriumByName],
  );
  const canOpenItem = useCallback((item: StageItem) => performerForItem(item) !== null, [performerForItem]);
  const openItemDetail = useCallback(
    (item: StageItem) => {
      const group = performerForItem(item);
      if (group) openDetail(group);
    },
    [performerForItem, openDetail],
  );

  // 管理者ページの保存・公開コンテンツの更新を即反映する。
  // 赤線・強調を動かすため現在時刻も1分ごとに更新する。
  useContentEffect(() => {
    let cancelled = false;
    setNow(new Date());
    Promise.all([
      loadAuditorium().catch(() => []),
      loadStage().catch(() => []),
      loadCongestion().catch(() => 'unknown' as CongestionLevel),
      loadNowOverride().catch((): NowOverride => ({ auditoriumId: null })),
    ]).then(([auditorium, stage, level, nowOverride]) => {
      if (cancelled) return;
      setItems(auditorium);
      setStageItems(stage);
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

  // ステージの時間割は time/Stage.csv を正とする (1団体が1日に複数回出演し得る)
  const stageDayItems = useMemo(() => stageItems.filter((i) => i.day === day), [stageItems, day]);
  const stageNow = findNow(stageItems, now);

  // 講堂の出演団体は time/Auditorium.csv の演目名を正とし、
  // auditorium-groups.json のメタ情報 (紹介文・写真) を突き合わせる。
  // 出演団体は選択中の曜日で分ける (土=音楽祭 / 日=海神)。
  const auditoriumGroups = useMemo(
    () => auditoriumGroupsForItems(dayItems, auditoriumMeta),
    [dayItems, auditoriumMeta],
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
                  <StageCalendar
                    items={stageDayItems}
                    day={day}
                    base={baseRange}
                    now={now}
                    nowId={stageNow?.id ?? null}
                    canOpenItem={canOpenItem}
                    onOpenItem={openItemDetail}
                  />
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
                {day === 1 ? (
                  <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                    午前はクラブ有志企画、午後はゲーム実況解説大会「海神」です
                  </Text>
                ) : null}
              </View>
              <View style={styles.calCard}>
                {dayItems.length === 0 ? (
                  <CalendarEmpty label="講堂の演目は準備中です" />
                ) : (
                  <StageCalendar
                    items={dayItems}
                    day={day}
                    base={baseRange}
                    now={now}
                    nowId={nowItem?.id ?? null}
                    canOpenItem={canOpenItem}
                    onOpenItem={openItemDetail}
                  />
                )}
              </View>
            </Rise>
            {day === 1 ? (
              <>
                <PerformerList
                  groups={auditoriumMeta.filter((g) => g.genre === 'スマブラ')}
                  onSelect={openDetail}
                  title="出演者（スマブラ）"
                />
                <PerformerList
                  groups={auditoriumMeta.filter((g) => g.genre === 'スプラトゥーン')}
                  onSelect={openDetail}
                  title="出演者（スプラトゥーン）"
                />
                <PerformerList
                  groups={auditoriumMeta.filter((g) => g.genre === 'クラブ')}
                  onSelect={openDetail}
                  title="日曜企画（クラブ・有志）"
                  showThumb={false}
                />
              </>
            ) : (
              <PerformerList
                groups={auditoriumGroups}
                onSelect={openDetail}
                title={`出演団体（${THEME_NAMES[day]}）`}
              />
            )}
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
    calEventShort: { paddingVertical: scaled(3, s) },
    calEventLine: { flexDirection: 'row', alignItems: 'center', gap: scaled(8, s) },
    calEventNameInline: { flexShrink: 1 },
    calEventTitle: { color: m3.onPrimaryContainer },
    calEventTime: { color: m3.onPrimaryContainer },
    calEventTimeDelay: { color: m3.onErrorContainer },
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
