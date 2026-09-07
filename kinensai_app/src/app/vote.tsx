import React, { useMemo, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3Card, M3IconButton, M3ImagePlaceholder, M3SearchBar, TopAppBar } from '../components/m3';
import { useStageGroups } from '../data/stage';
import { m3, m3type } from '../theme';

export default function VoteScreen() {
  const [query, setQuery] = useState('');
  const { groups, votedId, vote, isLoading } = useStageGroups();

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return groups;
    return groups.filter(
      (g) => g.name.toLowerCase().includes(q) || g.detail.toLowerCase().includes(q),
    );
  }, [groups, query]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="オーディエンス投票" />
      <View style={styles.searchWrap}>
        <M3SearchBar value={query} onChangeText={setQuery} placeholder="検索" />
      </View>
      {isLoading ? (
        <View style={styles.centering}>
          <ActivityIndicator size="large" color={m3.primary} />
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            応援したい出演者を1組選んで投票してください (変更可・端末に保存)。
          </Text>
          {filtered.map((g) => {
            const voted = votedId === g.id;
            return (
              <M3Card key={g.id} variant="filled" style={styles.card} onPress={() => vote(g.id)}>
                <M3ImagePlaceholder height={140} />
                <View style={styles.cardBody}>
                  <Text style={[m3type.titleMedium, { color: m3.onSurface }]}>
                    {g.name}
                    {voted ? ' ・ 投票中' : ''}
                  </Text>
                  <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                    {g.detail || '補足テキストがここに入ります。'}
                  </Text>
                  <View style={styles.voteRow}>
                    <M3IconButton
                      icon={voted ? 'favorite' : 'favorite-border'}
                      label={voted ? '投票を取り消す' : `${g.name}に投票する`}
                      selected={voted}
                      onPress={() => vote(g.id)}
                    />
                  </View>
                </View>
              </M3Card>
            );
          })}
          {filtered.length === 0 && (
            <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center', marginTop: 24 }]}>
              一致する出演者がいません
            </Text>
          )}
        </ScrollView>
      )}
      <View style={styles.backWrap}>
        <M3Button label="戻る" icon="undo" onPress={() => router.back()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  centering: { flex: 1, justifyContent: 'center', alignItems: 'center' },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  body: { padding: 16, gap: 12, paddingBottom: 24 },
  card: { padding: 0 },
  cardBody: { padding: 16, gap: 4 },
  voteRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  backWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
