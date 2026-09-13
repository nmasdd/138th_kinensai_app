import React, { useMemo, useState } from 'react';
import { Image, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { M3Badge, M3Button, M3Card, M3EmptyState, M3IconButton, M3ImagePlaceholder, M3LoadingView, M3SearchBar, TopAppBar, goBackOrHome } from '../components/m3';
import { ConfirmPop, Stagger } from '../components/anim';
import { useStageGroups } from '../data/stage';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';

export default function VoteScreen() {
  const { type } = useM3();
  const styles = useStyles();
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
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
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
                      <Text style={[type.titleMedium, { color: m3.onSurface, flex: 1 }]}>{g.name}</Text>
                      {voted ? (
                        <ConfirmPop key={`voted-${g.id}`}>
                          <M3Badge label="投票中" />
                        </ConfirmPop>
                      ) : null}
                    </View>
                  <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
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
              <Text style={[type.bodyLarge, { color: m3.onSurfaceVariant, textAlign: 'center' }]}>
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

function createStyles(s: number) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: m3.surface },
    searchWrap: { paddingHorizontal: scaled(16, s), paddingTop: scaled(8, s) },
    body: { padding: scaled(16, s), gap: scaled(16, s), paddingBottom: scaled(32, s) },
    card: { padding: 0 },
    image: { width: '100%', height: scaled(140, s) },
    cardBody: { padding: scaled(16, s), gap: scaled(8, s) },
    nameRow: { flexDirection: 'row', alignItems: 'center', gap: scaled(8, s) },
    voteRow: { flexDirection: 'row', justifyContent: 'flex-end', marginTop: scaled(4, s) },
    backWrap: { alignItems: 'flex-end', paddingHorizontal: scaled(16, s), paddingBottom: scaled(16, s) },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
