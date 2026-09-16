import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3LoadingView, TopAppBar } from '../../components/m3';
import { AdminNotice, adminErrorMessage, useAdminNotice } from '../../components/AdminSaveBar';
import { Section, useAdminStyles } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import { fetchVoteResults, type VoteResults } from '../../data/votes';
import { bundledGroups, type StageGroup } from '../../data/stage';
import { loadJSON } from '../../data/kvStore';
import { m3, scaled } from '../../theme';
import { useM3 } from '../../context/responsive';

/**
 * 管理者用・投票集計 (/admin/votes)。
 * オーディエンス投票の集計結果 (団体別の得票数・合計) を Worker から取得して表示する。
 * 票は端末から `POST /api/votes` で送信され、Worker のKVに団体別カウンタとして保存される。
 * 集計の取得は管理者トークン必須 (`POST /api/votes/results`)。
 */

function formatTime(ms: number): string {
  try {
    return new Date(ms).toLocaleString('ja-JP');
  } catch {
    return '-';
  }
}

export default function AdminVotesScreen() {
  return (
    <AdminGate>
      <AdminVotesContent />
    </AdminGate>
  );
}

function AdminVotesContent() {
  const { type } = useM3();
  const styles = useStyles();
  const adminStyles = useAdminStyles();
  const [results, setResults] = useState<VoteResults | null>(null);
  const [groups, setGroups] = useState<StageGroup[]>(bundledGroups);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const { notice, showOk, showErr } = useAdminNotice();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const parsed = await loadJSON<unknown>('stage-groups.json', null).catch(() => null);
      if (!cancelled && Array.isArray(parsed)) setGroups(parsed as StageGroup[]);
      try {
        const r = await fetchVoteResults();
        if (!cancelled) {
          setResults(r);
          setError('');
        }
      } catch (e) {
        if (!cancelled) setError(adminErrorMessage(e));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, []);

  const refresh = useCallback(async () => {
    try {
      const r = await fetchVoteResults();
      setResults(r);
      setError('');
      showOk(`最新の集計を取得しました (合計${r.total}票)`);
    } catch (e) {
      setError(adminErrorMessage(e));
      showErr(adminErrorMessage(e));
    }
  }, [showOk, showErr]);

  const rows = useMemo(() => {
    const counts = results?.counts ?? {};
    const nameOf = new Map(groups.map((g) => [g.id, g.name]));
    return Object.entries(counts)
      .map(([id, count]) => ({ id, count, name: nameOf.get(id) ?? id }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'ja'));
  }, [results, groups]);
  const max = rows.length > 0 ? rows[0].count : 0;

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用・投票集計" />
      <View style={adminStyles.contentWrap}>
        {isLoading ? (
          <M3LoadingView />
        ) : (
          <ScrollView style={adminStyles.scroll} contentContainerStyle={adminStyles.body}>
            <Section title="集計結果">
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
                オーディエンス投票の集計です。各端末が POST /api/votes で送った票を、Worker
                が団体別に集計します (1台1票・変更可)。集計は結果整合のため、直後の投票が
                反映されるまで少し時間がかかることがあります。
              </Text>
              {error ? (
                <Text style={[type.bodyMedium, { color: m3.error, marginBottom: 8 }]}>{error}</Text>
              ) : null}
              {results ? (
                <View style={styles.summary}>
                  <Text style={[type.headlineSmall, { color: m3.onSurface }]}>
                    合計 {results.total} 票
                  </Text>
                  <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                    集計時刻: {formatTime(results.updatedAt)}
                  </Text>
                </View>
              ) : (
                <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                  集計を取得できませんでした。「最新の集計を取得」で再試行してください。
                </Text>
              )}
              <View style={styles.refreshWrap}>
                <M3Button label="最新の集計を取得" icon="refresh" variant="tonal" onPress={refresh} />
              </View>
            </Section>

            <Section title="団体別の得票">
              {rows.length === 0 ? (
                <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                  まだ票がありません。
                </Text>
              ) : (
                rows.map((r, i) => (
                  <View key={r.id} style={styles.row}>
                    <Text style={[type.titleSmall, styles.rank]}>{i + 1}</Text>
                    <View style={styles.rowBody}>
                      <View style={styles.rowHead}>
                        <Text style={[type.titleSmall, { color: m3.onSurface, flex: 1 }]} numberOfLines={1}>
                          {r.name}
                        </Text>
                        <Text style={[type.labelLarge, { color: m3.primary }]}>{r.count}票</Text>
                      </View>
                      <View style={styles.barTrack}>
                        <View style={[styles.barFill, { width: `${max > 0 ? Math.round((r.count / max) * 100) : 0}%` }]} />
                      </View>
                    </View>
                  </View>
                ))
              )}
            </Section>

            <View style={adminStyles.backWrap}>
              <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin' as never)} />
            </View>
          </ScrollView>
        )}
        <AdminNotice notice={notice} />
      </View>
    </SafeAreaView>
  );
}

function createStyles(s: number) {
  return StyleSheet.create({
    summary: { gap: scaled(4, s) },
    refreshWrap: { marginTop: scaled(12, s), alignItems: 'flex-start' },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: scaled(10, s),
      paddingVertical: scaled(8, s),
    },
    rank: { color: m3.onSurfaceVariant, width: scaled(24, s), textAlign: 'center' },
    rowBody: { flex: 1, gap: scaled(6, s) },
    rowHead: { flexDirection: 'row', alignItems: 'center', gap: scaled(8, s) },
    barTrack: {
      height: scaled(8, s),
      borderRadius: 999,
      backgroundColor: m3.surfaceContainerHigh,
      overflow: 'hidden',
    },
    barFill: { height: '100%', borderRadius: 999, backgroundColor: m3.primary },
  });
}

function useStyles() {
  const { scale } = useM3();
  return React.useMemo(() => createStyles(scale), [scale]);
}
