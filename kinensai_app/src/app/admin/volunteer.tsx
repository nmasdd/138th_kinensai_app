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
import { loadVolunteers, saveVolunteers } from '../../data/volunteers';
import { loadTicketMap, saveTicketMap, type TicketInfo } from '../../data/tickets';
import { deleteStoredImage } from '../../data/images';
import type { Exhibition } from '../../data/exhibitions';
import { m3, m3type } from '../../theme';

/**
 * 管理者用・有志企画 (/admin/volunteer)。
 * 検索窓は表示の絞り込みのみで、保存対象は全件のまま。
 * 下部固定の保存バーは編集中フォームの保存を行う。
 */

interface VolDraft {
  id: string | null;
  className: string;
  projectName: string;
  description: string;
  place: string;
  ticket: TicketState;
  ticketTime: string;
  imageUri: string | null;
}

const EMPTY_VOL: VolDraft = {
  id: null,
  className: '',
  projectName: '',
  description: '',
  place: '',
  ticket: 'unknown',
  ticketTime: '',
  imageUri: null,
};

export default function AdminVolunteerScreen() {
  return (
    <AdminGate>
      <AdminVolunteerContent />
    </AdminGate>
  );
}

function AdminVolunteerContent() {
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [volunteers, setVolunteers] = useState<Exhibition[]>([]);
  const [volDraft, setVolDraft] = useState<VolDraft>(EMPTY_VOL);
  const { notice, showOk, showErr } = useAdminNotice();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const vols = await loadVolunteers();
        if (!cancelled) setVolunteers(vols);
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

  const visibleVolunteers = useMemo(() => {
    const q = query.trim();
    if (!q) return volunteers;
    return volunteers.filter((v) => `${v.className} ${v.projectName} ${v.description} ${v.place ?? ''}`.includes(q));
  }, [volunteers, query]);

  const saveVolunteerForm = async (): Promise<string> => {
    if (!volDraft.className.trim()) throw new Error('団体名を入力してください');
    try {
      const id = volDraft.id ?? `vol-${Date.now()}`;
      const item: Exhibition = {
        id,
        className: volDraft.className.trim(),
        projectName: volDraft.projectName.trim(),
        description: volDraft.description.trim(),
        ticketRequired: volDraft.ticket === 'unknown' ? 'unknown' : volDraft.ticket,
        ticketTime: volDraft.ticketTime || null,
        kind: 'volunteer',
        place: volDraft.place.trim() || null,
        imageUri: volDraft.imageUri,
      };
      const next = volDraft.id ? volunteers.map((v) => (v.id === id ? item : v)) : [...volunteers, item];
      // 他ページで更新された整理券を上書きしないよう最新を取得して合成する
      const latest = await loadTicketMap().catch(() => ({} as Record<string, TicketInfo>));
      const nextTickets = { ...latest };
      if (volDraft.ticket === 'unknown') delete nextTickets[id];
      else nextTickets[id] = { required: volDraft.ticket, time: volDraft.ticketTime || null };
      await saveVolunteers(next);
      await saveTicketMap(nextTickets);
      setVolunteers(next);
      setVolDraft(EMPTY_VOL);
      return '有志企画を保存しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  const deleteVolunteer = async (id: string): Promise<string> => {
    try {
      const target = volunteers.find((v) => v.id === id);
      if (target?.imageUri) await deleteStoredImage(target.imageUri);
      const next = volunteers.filter((v) => v.id !== id);
      const latest = await loadTicketMap().catch(() => ({} as Record<string, TicketInfo>));
      delete latest[id];
      await saveVolunteers(next);
      await saveTicketMap(latest);
      setVolunteers(next);
      if (volDraft.id === id) setVolDraft(EMPTY_VOL);
      return '有志企画を削除しました';
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
      <TopAppBar title="管理者用・有志企画" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: ADMIN_FOOTER_SPACE }]}>
          <View style={adminStyles.searchWrap}>
            <M3SearchBar value={query} onChangeText={setQuery} placeholder="有志企画を検索" />
          </View>
          <Section title="有志企画 (追加・編集・削除)">
            {visibleVolunteers.map((v) => (
              <View key={v.id} style={adminStyles.row}>
                <View style={adminStyles.rowText}>
                  <Text style={[m3type.titleSmall, { color: m3.onSurface }]} numberOfLines={1}>
                    {v.className} {v.projectName}
                  </Text>
                  <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={1}>
                    {v.description}
                  </Text>
                </View>
                <M3Touch
                  label="編集"
                  round
                  onPress={() =>
                    setVolDraft({
                      id: v.id,
                      className: v.className,
                      projectName: v.projectName === '(タイトル未定)' ? '' : v.projectName,
                      description: v.description === '(説明準備中)' ? '' : v.description,
                      place: v.place ?? '',
                      ticket: v.ticketRequired === 'required' || v.ticketRequired === 'none' ? v.ticketRequired : 'unknown',
                      ticketTime: v.ticketTime ?? '',
                      imageUri: v.imageUri ?? null,
                    })
                  }
                >
                  <Text style={[m3type.labelLarge, adminStyles.link]}>編集</Text>
                </M3Touch>
                <M3Touch
                  label="削除"
                  round
                  onPress={() => {
                    deleteVolunteer(v.id).then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                  }}
                >
                  <Text style={[m3type.labelLarge, adminStyles.danger]}>削除</Text>
                </M3Touch>
              </View>
            ))}
            {visibleVolunteers.length === 0 ? (
              <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>一致する企画はありません</Text>
            ) : null}
            <View style={adminStyles.block}>
              <Text style={[m3type.titleSmall, { color: m3.onSurface }]}>
                {volDraft.id ? '編集中' : '新規追加'}
              </Text>
              <Field label="団体名">
                <TextInput
                  style={adminStyles.input}
                  value={volDraft.className}
                  onChangeText={(t) => setVolDraft((p) => ({ ...p, className: t }))}
                  placeholder="例: 吹奏楽部"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="タイトル">
                <TextInput
                  style={adminStyles.input}
                  value={volDraft.projectName}
                  onChangeText={(t) => setVolDraft((p) => ({ ...p, projectName: t }))}
                  placeholder="企画タイトル"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="説明">
                <TextInput
                  style={[adminStyles.input, adminStyles.multiline]}
                  value={volDraft.description}
                  multiline
                  onChangeText={(t) => setVolDraft((p) => ({ ...p, description: t }))}
                  placeholder="企画の説明"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="場所">
                <TextInput
                  style={adminStyles.input}
                  value={volDraft.place}
                  onChangeText={(t) => setVolDraft((p) => ({ ...p, place: t }))}
                  placeholder="例: 中庭ステージ"
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
                  value={volDraft.ticket}
                  onChange={(v) => setVolDraft((p) => ({ ...p, ticket: v }))}
                />
              </Field>
              {volDraft.ticket === 'required' ? (
                <Field label="配布時間">
                  <TextInput
                    style={adminStyles.input}
                    value={volDraft.ticketTime}
                    onChangeText={(t) => setVolDraft((p) => ({ ...p, ticketTime: t }))}
                    placeholder="例: 10:00〜"
                    placeholderTextColor={m3.onSurfaceVariant}
                  />
                </Field>
              ) : null}
              <Field label="画像">
                <ImageField value={volDraft.imageUri} onChange={(uri) => setVolDraft((p) => ({ ...p, imageUri: uri }))} />
              </Field>
              {volDraft.id ? (
                <View style={adminStyles.buttonRow}>
                  <M3Button label="取消" variant="tonal" onPress={() => setVolDraft(EMPTY_VOL)} />
                </View>
              ) : null}
            </View>
          </Section>
          <View style={adminStyles.backWrap}>
            <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin/index' as never)} />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[{ label: '有志企画を保存', icon: 'save', run: saveVolunteerForm }]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}
