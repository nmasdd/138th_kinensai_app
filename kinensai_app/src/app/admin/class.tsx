import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3LoadingView, M3SearchBar, M3Touch, TopAppBar } from '../../components/m3';
import {
  ADMIN_FOOTER_SPACE,
  AdminNotice,
  AdminSaveBar,
  adminErrorMessage,
  useAdminNotice,
} from '../../components/AdminSaveBar';
import { Chips, Field, ImageField, Section, adminStyles, type TicketState } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import {
  loadAllExhibitions,
  loadClassOverrides,
  loadCustomClasses,
  saveClassOverrides,
  saveCustomClasses,
  suggestClassId,
  type ClassOverride,
  type Exhibition,
} from '../../data/exhibitions';
import { loadTicketMap, saveTicketMap, type TicketInfo } from '../../data/tickets';
import { deleteStoredImage } from '../../data/images';
import { m3, m3type } from '../../theme';

/**
 * 管理者用・クラス企画 (/admin/class)。
 * カタログ由来の企画は削除不可。追加したカスタム企画のみ削除可。
 * 検索窓は表示の絞り込みのみで、保存対象は全件のまま。
 */

interface ClassDraft {
  id: string;
  title: string;
  detail: string;
  place: string;
  ticket: TicketState;
  ticketTime: string;
  imageUri: string | null;
  isCustom: boolean;
}

export default function AdminClassScreen() {
  return (
    <AdminGate>
      <AdminClassContent />
    </AdminGate>
  );
}

function AdminClassContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [classes, setClasses] = useState<ClassDraft[]>([]);
  const [newClass, setNewClass] = useState({ className: '', title: '', detail: '', place: '' });
  const { notice, showOk, showErr } = useAdminNotice();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [exhibitions, customClasses, ticketMap] = await Promise.all([
          loadAllExhibitions(),
          loadCustomClasses().catch(() => [] as Exhibition[]),
          loadTicketMap().catch(() => ({} as Record<string, TicketInfo>)),
        ]);
        const customIds = new Set(customClasses.map((c) => c.id));
        const ticketOf = (id: string): { ticket: TicketState; ticketTime: string } => {
          const t = ticketMap[id];
          if (!t) {
            const ex = exhibitions.find((e) => e.id === id);
            return {
              ticket: ex?.ticketRequired === 'required' || ex?.ticketRequired === 'none' ? ex.ticketRequired : 'unknown',
              ticketTime: ex?.ticketTime ?? '',
            };
          }
          return { ticket: t.required, ticketTime: t.time ?? '' };
        };
        if (cancelled) return;
        setClasses(
          exhibitions
            .filter((e) => e.kind === 'class')
            .map((e) => ({
              id: e.id,
              title: e.projectName,
              detail: e.description,
              place: e.place ?? '',
              imageUri: e.imageUri ?? null,
              isCustom: customIds.has(e.id),
              ...ticketOf(e.id),
            })),
        );
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

  const visibleClasses = useMemo(() => {
    const q = query.trim();
    if (!q) return classes;
    return classes.filter((c) => `${c.id} ${c.title} ${c.detail} ${c.place}`.includes(q));
  }, [classes, query]);

  const saveClasses = async (): Promise<string> => {
    const overrides: Record<string, ClassOverride> = {};
    // 他ページで更新された整理券を上書きしないよう最新を取得して合成する
    const latest = await loadTicketMap().catch(() => ({} as Record<string, TicketInfo>));
    const next = { ...latest };
    for (const c of classes) {
      overrides[c.id] = { title: c.title, detail: c.detail, place: c.place || null, imageUri: c.imageUri };
      if (c.ticket === 'unknown') delete next[c.id];
      else next[c.id] = { required: c.ticket, time: c.ticketTime || null };
    }
    try {
      await saveClassOverrides(overrides);
      await saveTicketMap(next);
      return 'クラス企画を保存しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  const addCustomClass = async (): Promise<string> => {
    if (!newClass.className.trim()) throw new Error('クラス名を入力してください');
    try {
      const existing = await loadCustomClasses().catch(() => [] as Exhibition[]);
      const allIds = [...classes.map((c) => c.id), ...existing.map((e) => e.id)];
      const id = suggestClassId(newClass.className, allIds);
      const item: Exhibition = {
        id,
        className: newClass.className.trim(),
        projectName: newClass.title.trim(),
        description: newClass.detail.trim(),
        ticketRequired: 'unknown',
        ticketTime: null,
        kind: 'class',
        place: newClass.place.trim() || null,
        imageUri: null,
      };
      await saveCustomClasses([...existing, item]);
      setClasses((prev) => [
        ...prev,
        { id, title: item.projectName, detail: item.description, place: '', ticket: 'unknown', ticketTime: '', imageUri: null, isCustom: true },
      ]);
      setNewClass({ className: '', title: '', detail: '', place: '' });
      return `クラス企画を追加しました (id: ${id})`;
    } catch {
      throw new Error('追加に失敗しました');
    }
  };

  const deleteCustomClass = async (id: string): Promise<string> => {
    try {
      const existing = await loadCustomClasses().catch(() => [] as Exhibition[]);
      const target = [...existing, ...classes].find((e) => e.id === id);
      const imageUri = target && 'imageUri' in target ? (target.imageUri as string | null) : null;
      if (imageUri) await deleteStoredImage(imageUri);
      await saveCustomClasses(existing.filter((e) => e.id !== id));
      const overrides = await loadClassOverrides().catch(() => ({}) as Record<string, ClassOverride>);
      const ovImage = overrides[id]?.imageUri;
      if (ovImage && ovImage !== imageUri) await deleteStoredImage(ovImage);
      delete overrides[id];
      await saveClassOverrides(overrides);
      const latest = await loadTicketMap().catch(() => ({} as Record<string, TicketInfo>));
      delete latest[id];
      await saveTicketMap(latest);
      setClasses((prev) => prev.filter((c) => c.id !== id));
      return 'カスタム企画を削除しました';
    } catch {
      throw new Error('削除に失敗しました');
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
      <TopAppBar title="管理者用・クラス企画" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: ADMIN_FOOTER_SPACE }]}>
          <View style={adminStyles.searchWrap}>
            <M3SearchBar value={query} onChangeText={setQuery} placeholder="クラス企画を検索" />
          </View>
          <Section title="クラス企画 (タイトル・説明・場所・整理券)">
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              カタログ由来の企画は削除できません。追加したカスタム企画のみ削除できます。
            </Text>
            {visibleClasses.map((c) => (
              <View key={c.id} style={adminStyles.block}>
                <View style={adminStyles.blockHeader}>
                  <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>
                    {c.id}
                    {c.isCustom ? ' (カスタム)' : ''}
                  </Text>
                  {c.isCustom ? (
                    <M3Touch
                      label={`${c.id}を削除`}
                      round
                      onPress={() => {
                        deleteCustomClass(c.id).then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                      }}
                    >
                      <Text style={[m3type.labelLarge, adminStyles.danger]}>削除</Text>
                    </M3Touch>
                  ) : null}
                </View>
                <Field label="タイトル">
                  <TextInput
                    style={adminStyles.input}
                    value={c.title}
                    onChangeText={(t) => setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, title: t } : x)))}
                    placeholder="企画タイトル"
                    placeholderTextColor={m3.onSurfaceVariant}
                  />
                </Field>
                <Field label="説明">
                  <TextInput
                    style={[adminStyles.input, adminStyles.multiline]}
                    value={c.detail}
                    multiline
                    onChangeText={(t) => setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, detail: t } : x)))}
                    placeholder="企画の説明"
                    placeholderTextColor={m3.onSurfaceVariant}
                  />
                </Field>
                <Field label="場所">
                  <TextInput
                    style={adminStyles.input}
                    value={c.place}
                    onChangeText={(t) => setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, place: t } : x)))}
                    placeholder="例: 高校棟1階 1A教室"
                    placeholderTextColor={m3.onSurfaceVariant}
                  />
                </Field>
                <Field label="整理券">
                  <Chips<TicketState>
                    options={[
                      { value: 'unknown', label: '確認中' },
                      { value: 'none', label: '不要' },
                      { value: 'required', label: '必要' },
                    ]}
                    value={c.ticket}
                    onChange={(v) => setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, ticket: v } : x)))}
                  />
                </Field>
                {c.ticket === 'required' ? (
                  <Field label="配布時間">
                    <TextInput
                      style={adminStyles.input}
                      value={c.ticketTime}
                      onChangeText={(t) =>
                        setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, ticketTime: t } : x)))
                      }
                      placeholder="例: 10:00〜"
                      placeholderTextColor={m3.onSurfaceVariant}
                    />
                  </Field>
                ) : null}
                <Field label="画像">
                  <ImageField
                    value={c.imageUri}
                    onChange={(uri) => setClasses((prev) => prev.map((x) => (x.id === c.id ? { ...x, imageUri: uri } : x)))}
                  />
                </Field>
              </View>
            ))}
            {visibleClasses.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>一致する企画はありません</Text>
            ) : null}
            <View style={adminStyles.block}>
              <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>新規追加 (idはクラス名から自動採番)</Text>
              <Field label="クラス名">
                <TextInput
                  style={adminStyles.input}
                  value={newClass.className}
                  onChangeText={(t) => setNewClass((p) => ({ ...p, className: t }))}
                  placeholder="例: 3A"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="タイトル">
                <TextInput
                  style={adminStyles.input}
                  value={newClass.title}
                  onChangeText={(t) => setNewClass((p) => ({ ...p, title: t }))}
                  placeholder="企画タイトル"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="説明">
                <TextInput
                  style={[adminStyles.input, adminStyles.multiline]}
                  value={newClass.detail}
                  multiline
                  onChangeText={(t) => setNewClass((p) => ({ ...p, detail: t }))}
                  placeholder="企画の説明"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="場所">
                <TextInput
                  style={adminStyles.input}
                  value={newClass.place}
                  onChangeText={(t) => setNewClass((p) => ({ ...p, place: t }))}
                  placeholder="例: 高校棟1階 3A教室"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <M3Button
                label="クラス企画を追加"
                icon="add"
                onPress={() => {
                  addCustomClass().then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                }}
              />
            </View>
          </Section>
          <View style={adminStyles.backWrap}>
            <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin/index' as never)} />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[{ label: 'クラス企画を保存', icon: 'save', run: saveClasses }]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}
