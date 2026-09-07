import React, { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3Card, TopAppBar } from '../../components/m3';
import { m3, m3type } from '../../theme';
import { festival } from '../../data/festival';
import { loadAllExhibitions, type Exhibition } from '../../data/exhibitions';
import { loadAuditorium, findNow, type StageItem } from '../../data/timetable';

export default function HomeScreen() {
  const [picks, setPicks] = useState<Exhibition[]>([]);
  const [nowItem, setNowItem] = useState<StageItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    Promise.all([loadAllExhibitions().catch(() => []), loadAuditorium().catch(() => [])]).then(
      ([exhibitions, auditorium]) => {
        const shuffled = [...exhibitions].sort(() => Math.random() - 0.5);
        setPicks(shuffled.slice(0, 2));
        setNowItem(findNow(auditorium, new Date()));
        setIsLoading(false);
      },
    );
  }, []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="ホーム" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <Text style={[m3type.bodyLarge, { color: m3.onPrimary }]}>{festival.school}</Text>
          <Text style={[m3type.displaySmall, { color: m3.onPrimary }]}>{festival.name}</Text>
          <Text style={[m3type.titleMedium, { color: m3.onPrimary, marginTop: 4 }]}>{festival.theme}</Text>
          {festival.dates.map((d) => (
            <Text key={d.label} style={[m3type.bodyMedium, { color: m3.onPrimary }]}>
              {d.label} {d.time}
            </Text>
          ))}
          <Text style={[m3type.titleSmall, { color: m3.onPrimary, marginTop: 8 }]}>{festival.entry}</Text>
        </View>

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

        <M3Card variant="elevated">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>いま開催中</Text>
          {isLoading ? (
            <ActivityIndicator color={m3.primary} style={styles.loader} />
          ) : nowItem ? (
            <Text style={[m3type.bodyMedium, { color: m3.onSurface, marginTop: 8 }]}>
              講堂: {nowItem.team} ({nowItem.start}–{nowItem.end})
            </Text>
          ) : (
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 8 }]}>
              講堂・ステージの現在演目は確認中です
            </Text>
          )}
        </M3Card>

        <M3Card variant="filled">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>おすすめ企画 (ランダム2件)</Text>
          {picks.map((p) => (
            <View key={p.id} style={styles.pick}>
              <Text style={[m3type.labelLarge, styles.pickBadge]}>{p.className}</Text>
              <Text style={[m3type.titleSmall, { color: m3.onSurface, fontSize: 15 }]}>
                {p.projectName || '(タイトル未定)'}
              </Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={2}>
                {p.description || '(説明準備中)'}
              </Text>
            </View>
          ))}
        </M3Card>

        <M3Card variant="outlined">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>アクセス</Text>
          <Text style={[m3type.bodyMedium, { color: m3.onSurface, marginTop: 8 }]}>{festival.address}</Text>
          {festival.access.map((a) => (
            <Text key={a} style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
              ・{a}
            </Text>
          ))}
        </M3Card>

        <M3Card variant="outlined">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>来場のお願い</Text>
          {festival.notes.map((n) => (
            <View key={n.title} style={styles.note}>
              <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>{n.title}</Text>
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>{n.body}</Text>
            </View>
          ))}
        </M3Card>

        <M3Card variant="outlined">
          <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>記念祭について</Text>
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginTop: 8 }]}>
            {festival.about}
          </Text>
        </M3Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  hero: { backgroundColor: m3.primary, borderRadius: 20, padding: 20, gap: 2 },
  quickRow: { flexDirection: 'row', gap: 8 },
  quickButton: { flex: 1, minWidth: 0 },
  loader: { marginTop: 12 },
  pick: { marginTop: 12, gap: 4, borderTopWidth: 1, borderTopColor: m3.outlineVariant, paddingTop: 12 },
  pickBadge: {
    alignSelf: 'flex-start',
    color: m3.onSecondaryContainer,
    backgroundColor: m3.secondaryContainer,
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 999,
    overflow: 'hidden',
  },
  note: { marginTop: 8, gap: 2 },
});
