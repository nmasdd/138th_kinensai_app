import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { M3Badge, M3Button, M3Card, M3EmptyState, M3IconButton, M3ImagePlaceholder, M3LoadingView, M3SearchBar, TopAppBar, goBackOrHome } from '../components/m3';
import { ConfirmPop, Stagger } from '../components/anim';
import { useStageGroups } from '../data/stage';
import { m3, m3type } from '../theme';

export default function VoteScreen() {
  const insets = useSafeAreaInsets();
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
        <M3LoadingView />
      ) : (
        <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
            応援したい出演者を1組選んで投票してください (変更可・端末に保存)。
          </Text>
          {filtered.map((g, i) => {
            const voted = votedId === g.id;
            return (
              <Stagger key={g.id} index={i % 10}>
              <M3Card variant="filled" style={styles.card}>
                {g.imageUri ? (
                  <Image source={{ uri: g.imageUri }} style={styles.image} resizeMode="cover" />
                ) : (
                  <M3ImagePlaceholder height={140} />
                )}
                  <View style={styles.cardBody} accessibilityState={{ selected: voted }}>
                    <View style={styles.nameRow}>
                      <Text style={[m3type.titleMedium, { color: m3.onSurface, flex: 1 }]}>{g.name}</Text>
                      {voted ? (
                        <ConfirmPop key={`voted-${g.id}`}>
                          <M3Badge label="投票中" />
                        </ConfirmPop>
                      ) : null}
                    </View>
                  <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                    {g.detail || '補足テキストがここに入ります。'}
                  </Text>
                  <View style={styles.voteRow}>
                    <M3IconButton
                      icon={voted ? 'favorite' : 'favorite-border'}
                      label={voted ? `${g.name}への投票を取り消す` : `${g.name}に投票する`}
                      selected={voted}
                      onPress={() => vote(g.id)}
                    />
                  </View>
                </View>
              </M3Card>
              </Stagger>
            );
          })}
          {filtered.length === 0 && (
            <M3EmptyState icon="how-to-vote">
              <Text style={[m3type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
                一致する出演者がいません
              </Text>
            </M3EmptyState>
          )}
        </ScrollView>
      )}
      <View style={[styles.backWrap, { paddingBottom: Math.max(insets.bottom, 16) }]}>
        <M3Button label="前の画面に戻る" icon="undo" onPress={() => goBackOrHome()} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: m3.surface },
  searchWrap: { paddingHorizontal: 16, paddingTop: 8 },
  body: { padding: 16, gap: 16, paddingBottom: 32 },
  card: { padding: 0 },
  image: { width: '100%', height: 140 },
  cardBody: { padding: 16, gap: 8 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  voteRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: 4 },
  backWrap: { alignItems: 'flex-end', paddingHorizontal: 16, paddingBottom: 16 },
});
