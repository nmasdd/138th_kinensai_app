import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, ActivityIndicator } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Header from "../components/Header";
import { festival } from "../data/festival";
import { loadAllExhibitions, type Exhibition } from "../data/exhibitions";
import { loadAuditorium, findNow, type StageItem } from "../data/timetable";
import { theme } from "../theme";

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
    <SafeAreaView style={styles.container}>
      <Header title="ホーム" />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.hero}>
          <Text style={styles.school}>{festival.school}</Text>
          <Text style={styles.name}>{festival.name}</Text>
          <Text style={styles.theme}>{festival.theme}</Text>
          {festival.dates.map((d) => (
            <Text key={d.label} style={styles.date}>
              {d.label} {d.time}
            </Text>
          ))}
          <Text style={styles.entry}>{festival.entry}</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>いま開催中</Text>
          {isLoading ? (
            <ActivityIndicator color={theme.primary} />
          ) : nowItem ? (
            <Text style={styles.cardBody}>
              講堂: {nowItem.team} ({nowItem.start}–{nowItem.end})
            </Text>
          ) : (
            <Text style={styles.cardBody}>講堂・ステージの現在演目は確認中です</Text>
          )}
          <Text style={styles.cardNote}>講堂混雑表示・ステージ投票は準備中です</Text>
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>おすすめ企画 (ランダム2件)</Text>
          {picks.map((p) => (
            <View key={p.id} style={styles.pick}>
              <Text style={styles.pickClass}>{p.className}</Text>
              <Text style={styles.pickName}>{p.projectName || '(タイトル未定)'}</Text>
              <Text style={styles.pickDesc} numberOfLines={2}>
                {p.description || '(説明準備中)'}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>アクセス</Text>
          <Text style={styles.cardBody}>{festival.address}</Text>
          {festival.access.map((a) => (
            <Text key={a} style={styles.cardBody}>
              ・{a}
            </Text>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>来場のお願い</Text>
          {festival.notes.map((n) => (
            <View key={n.title} style={styles.note}>
              <Text style={styles.noteTitle}>{n.title}</Text>
              <Text style={styles.cardBody}>{n.body}</Text>
            </View>
          ))}
        </View>

        <View style={styles.card}>
          <Text style={styles.cardTitle}>記念祭について</Text>
          <Text style={styles.cardBody}>{festival.about}</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.background },
  body: { padding: 16, gap: 12 },
  hero: {
    backgroundColor: theme.primary,
    borderRadius: 16,
    padding: 18,
  },
  school: { fontSize: 13, color: '#ffffff', marginBottom: 2 },
  name: { fontSize: 24, fontWeight: 'bold', color: '#ffffff' },
  theme: { fontSize: 14, fontWeight: '600', color: '#ffffff', marginTop: 4, marginBottom: 8 },
  date: { fontSize: 14, color: '#ffffff' },
  entry: { fontSize: 13, fontWeight: 'bold', color: '#ffffff', marginTop: 6 },
  card: {
    backgroundColor: '#ffffff',
    borderRadius: 14,
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
  },
  cardTitle: { fontSize: 16, fontWeight: 'bold', color: theme.ink, marginBottom: 8 },
  cardBody: { fontSize: 14, color: theme.text, lineHeight: 20 },
  cardNote: { fontSize: 12, color: theme.muted, marginTop: 6 },
  pick: { paddingVertical: 6, borderTopWidth: 1, borderTopColor: theme.border },
  pickClass: {
    alignSelf: 'flex-start',
    fontSize: 12,
    fontWeight: 'bold',
    color: '#ffffff',
    backgroundColor: theme.primary,
    paddingHorizontal: 10,
    paddingVertical: 2,
    borderRadius: 20,
    overflow: 'hidden',
    marginBottom: 4,
  },
  pickName: { fontSize: 15, fontWeight: '600', color: theme.text },
  pickDesc: { fontSize: 13, color: '#666666', marginTop: 2 },
  note: { marginBottom: 8 },
  noteTitle: { fontSize: 14, fontWeight: 'bold', color: theme.text },
});
