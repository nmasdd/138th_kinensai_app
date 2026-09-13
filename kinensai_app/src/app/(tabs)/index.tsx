import React, { useCallback, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { M3Button, M3Card, M3Divider, M3LoadingView, M3Touch, TopAppBar } from '../../components/m3';
import { QuickNav } from '../../components/QuickNav';
import { Rise, Stagger } from '../../components/anim';
import { m3, m3type } from '../../theme';
import { festival } from '../../data/festival';
import { loadAllExhibitions, type Exhibition } from '../../data/exhibitions';
import { loadPickIds } from '../../data/picks';
import { loadAuditorium, findNow, type StageItem } from '../../data/timetable';

const PICK_COUNT = 2;

/** 配列から重複なく count 件をランダムに選ぶ (Fisher–Yates)。 */
function sampleRandom<T>(items: T[], count: number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, count);
}

export default function HomeScreen() {
  const [picks, setPicks] = useState<Exhibition[]>([]);
  const [nowItem, setNowItem] = useState<StageItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // 管理者ページの保存を即反映するため、表示のたびに再読込する
  useFocusEffect(
    useCallback(() => {
      let cancelled = false;
      Promise.all([
        loadAllExhibitions().catch(() => []),
        loadAuditorium().catch(() => []),
        loadPickIds().catch(() => [] as string[]),
      ]).then(([exhibitions, auditorium, pickIds]) => {
        if (cancelled) return;
        // 管理者おすすめがあればそれを対象に、未設定なら全企画から
        // 表示のたびにランダムで PICK_COUNT 件を選ぶ。
        const byId = new Map(exhibitions.map((e) => [e.id, e]));
        const ordered = pickIds.map((id) => byId.get(id)).filter((e): e is Exhibition => !!e);
        const pool = ordered.length > 0 ? ordered : exhibitions;
        setPicks(sampleRandom(pool, PICK_COUNT));
        setNowItem(findNow(auditorium, new Date()));
        setIsLoading(false);
      });
      return () => {
        cancelled = true;
      };
    }, []),
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="ホーム" />
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Rise delay={40}>
          <View style={styles.quickRow}>
          <M3Button
            label="オーディエンス投票"
            icon="how-to-vote"
            variant="tonal"
            style={styles.quickButton}
            onPress={() => router.push('/vote')}
          />
          <M3Button
            label="パンフレット"
            icon="menu-book"
            variant="tonal"
            style={styles.quickButton}
            onPress={() => router.push('/pamphlet')}
          />
          </View>
        </Rise>

        <Rise delay={60}>
          <M3Card variant="outlined">
            <View style={styles.quickNavWrap}>
              <QuickNav />
            </View>
          </M3Card>
        </Rise>

        <Rise delay={80}>
          <M3Card variant="elevated">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]} accessibilityRole="header">いま開催中</Text>
          {isLoading ? (
            <M3LoadingView />
          ) : nowItem ? (
            <Text style={[m3type.bodyMedium, { color: m3.onSurface, marginTop: 8 }]} accessibilityLiveRegion="polite">
              講堂: {nowItem.team} ({nowItem.start}–{nowItem.end})
            </Text>
          ) : (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 8 }]} accessibilityLiveRegion="polite">
              講堂・ステージの現在演目は確認中です
            </Text>
          )}
        </M3Card>
        </Rise>

        <Rise delay={120}>
          <M3Card variant="filled">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>おすすめ企画（ランダム{PICK_COUNT}件）</Text>
          {picks.length === 0 && !isLoading ? (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 8 }]}>
              おすすめ企画は準備中です
            </Text>
          ) : null}
          {picks.map((p, i) => (
            <Stagger key={p.id} index={i}>
              {i > 0 ? <M3Divider style={styles.pickDivider} /> : null}
              <M3Touch
              label={`${p.className} ${p.projectName || '(タイトル未定)'}の詳細を開く`}
              onPress={() => router.push({ pathname: '/search', params: { exhibit: p.id } } as never)}
            >
              <View style={styles.pick}>
                <Text style={[m3type.labelLarge, styles.pickBadge]}>{p.className}</Text>
                <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>
                  {p.projectName || '(タイトル未定)'}
                </Text>
                <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={2}>
                  {p.description || '(説明準備中)'}
                </Text>
              </View>
            </M3Touch>
            </Stagger>
          ))}
        </M3Card>
        </Rise>

        <Rise delay={200}>
          <M3Card variant="outlined">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>来場のお願い</Text>
          {festival.notes.map((n) => (
            <View key={n.title} style={styles.note}>
              <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>{n.title}</Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>{n.body}</Text>
            </View>
          ))}
        </M3Card>
        </Rise>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { padding: 16, gap: 16, paddingBottom: 32 },
  quickRow: { flexDirection: 'row', gap: 12 },
  quickButton: { flex: 1, minWidth: 0 },
  quickNavWrap: { marginTop: 0 },
  pick: { marginTop: 4, gap: 6, paddingTop: 12 },
  pickDivider: { marginTop: 12 },
  pickBadge: {
    alignSelf: 'flex-start',
    color: m3.onSecondaryContainer,
    backgroundColor: m3.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  note: { marginTop: 12, gap: 4 },
});
