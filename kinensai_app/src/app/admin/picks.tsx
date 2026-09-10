import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3LoadingView, M3SearchBar, M3Touch, TopAppBar } from '../../components/m3';
import {
  ADMIN_FOOTER_SPACE,
  AdminNotice,
  AdminSaveBar,
  useAdminNotice,
} from '../../components/AdminSaveBar';
import { Section, adminStyles } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import { loadAllExhibitions, type Exhibition } from '../../data/exhibitions';
import { loadPickIds, savePickIds } from '../../data/picks';
import { m3, m3type } from '../../theme';

/**
 * 管理者用・おすすめ企画 (/admin/picks)。
 * ホームの「おすすめ企画」に表示する企画を選び、並び替える。
 * 検索窓はカタログ表示の絞り込みのみで、保存対象は pickIds 全件のまま。
 */

export default function AdminPicksScreen() {
  return (
    <AdminGate>
      <AdminPicksContent />
    </AdminGate>
  );
}

function AdminPicksContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [catalog, setCatalog] = useState<Exhibition[]>([]);
  const [pickIds, setPickIds] = useState<string[]>([]);
  const { notice, showOk, showErr } = useAdminNotice();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [exhibitions, savedPicks] = await Promise.all([loadAllExhibitions(), loadPickIds().catch(() => [] as string[])]);
        if (cancelled) return;
        setCatalog(exhibitions);
        const validIds = new Set(exhibitions.map((e) => e.id));
        setPickIds(savedPicks.filter((id) => validIds.has(id)));
      } catch {
        if (!cancelled) showErr('読み込みに失敗しました');
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/set-state-in-effect
  }, [showErr]);

  const visibleCatalog = useMemo(() => {
    const q = query.trim();
    if (!q) return catalog;
    return catalog.filter((ex) =>
      `${ex.className} ${ex.projectName} ${ex.kind === 'class' ? 'クラス企画' : '教室有志企画'}`.includes(q),
    );
  }, [catalog, query]);

  const togglePick = (id: string) => {
    setPickIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const movePick = (id: string, dir: -1 | 1) => {
    setPickIds((prev) => {
      const i = prev.indexOf(id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= prev.length) return prev;
      const next = [...prev];
      next[i] = prev[j];
      next[j] = prev[i];
      return next;
    });
  };

  const savePicks = async (): Promise<string> => {
    try {
      const validIds = new Set(catalog.map((e) => e.id));
      const valid = pickIds.filter((id) => validIds.has(id));
      await savePickIds(valid);
      setPickIds(valid);
      return 'おすすめ企画を保存しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={adminStyles.center} edges={['top']}>
        <M3LoadingView />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用・おすすめ企画" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: ADMIN_FOOTER_SPACE }]}>
          <View style={adminStyles.searchWrap}>
            <M3SearchBar value={query} onChangeText={setQuery} placeholder="企画を検索" />
          </View>
          <Section title="おすすめ企画 (ホーム表示・複数選択)">
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              ホームの「おすすめ企画」に表示する企画を選びます。タップした順に表示されます。未設定のときはカタログ先頭2件を表示します。
            </Text>
            {pickIds.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
                未選択です (フォールバック: カタログ先頭2件を表示中)
              </Text>
            ) : (
              pickIds.map((id, i) => {
                const ex = catalog.find((e) => e.id === id);
                if (!ex) return null;
                return (
                  <View key={`pick-${id}`} style={adminStyles.row}>
                    <View style={adminStyles.rowText}>
                      <Text style={[m3type.titleSmall, { color: m3.onSurface }]} numberOfLines={1}>
                        {i + 1}. {ex.className} {ex.projectName || '(タイトル未定)'}
                      </Text>
                      <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={1}>
                        {ex.kind === 'class' ? 'クラス企画' : '教室有志企画'}
                      </Text>
                    </View>
                    <M3Touch label={`${ex.className}を1つ上へ`} round onPress={() => movePick(id, -1)}>
                      <Text style={[m3type.labelLarge, adminStyles.link]}>上へ</Text>
                    </M3Touch>
                    <M3Touch label={`${ex.className}を1つ下へ`} round onPress={() => movePick(id, 1)}>
                      <Text style={[m3type.labelLarge, adminStyles.link]}>下へ</Text>
                    </M3Touch>
                    <M3Touch label={`${ex.className}を選択から外す`} round onPress={() => togglePick(id)}>
                      <Text style={[m3type.labelLarge, adminStyles.danger]}>外す</Text>
                    </M3Touch>
                  </View>
                );
              })
            )}
            {visibleCatalog.map((ex) => {
              const selected = pickIds.includes(ex.id);
              const order = pickIds.indexOf(ex.id);
              return (
                <M3Touch
                  key={`catalog-${ex.id}`}
                  label={`${ex.className} ${ex.projectName || '(タイトル未定)'}${selected ? 'を選択から外す' : 'を選択する'}`}
                  round
                  onPress={() => togglePick(ex.id)}
                >
                  <View style={[adminStyles.row, selected && adminStyles.rowActive]}>
                    <View style={adminStyles.rowText}>
                      <Text style={[m3type.titleSmall, { color: m3.onSurface }]} numberOfLines={1}>
                        {ex.className} {ex.projectName || '(タイトル未定)'}
                      </Text>
                      <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={1}>
                        {ex.kind === 'class' ? 'クラス企画' : '教室有志企画'}
                      </Text>
                    </View>
                    <Text style={[m3type.labelLarge, { color: selected ? m3.primary : m3.onSurfaceVariant }]}>
                      {selected ? `${order + 1}番目に選択中` : '選択'}
                    </Text>
                  </View>
                </M3Touch>
              );
            })}
            {visibleCatalog.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>一致する企画はありません</Text>
            ) : null}
            <View style={adminStyles.buttonRow}>
              <M3Button label="選択をクリア" variant="tonal" onPress={() => setPickIds([])} />
            </View>
          </Section>
          <View style={adminStyles.backWrap}>
            <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin/index' as never)} />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[{ label: 'おすすめ企画を保存', icon: 'save', run: savePicks }]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}
