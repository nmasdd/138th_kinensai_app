import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3LoadingView, M3SearchBar, M3Touch, TopAppBar } from '../../components/m3';
import {
  AdminNotice,
  AdminSaveBar,
  adminErrorMessage,
  useAdminNotice,
} from '../../components/AdminSaveBar';
import { Chips, Field, ImageField, Section, useAdminStyles } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import {
  loadAuditoriumBase,
  loadDelayMap,
  loadNowOverride,
  loadTimetableOverrides,
  mergeTimetable,
  saveDelayMap,
  saveNowOverride,
  saveTimetableOverrides,
  type StageItem,
} from '../../data/timetable';
import { loadCongestion, saveCongestion, type CongestionLevel } from '../../data/congestion';
import {
  saveStageGroups,
  saveAuditoriumGroups,
  bundledGroups,
  bundledAuditoriumGroups,
  type StageGroup,
} from '../../data/stage';
import { deleteStoredImage } from '../../data/images';
import { loadJSON } from '../../data/kvStore';
import { m3 } from '../../theme';
import { useM3 } from '../../context/responsive';

/**
 * 管理者用・ステージ/講堂 (/admin/stage)。
 * 出演団体・講堂タイムテーブル・遅延・いま開催中・講堂混雑を扱う。
 * 検索窓は表示の絞り込みのみで、保存対象は全件のまま。
 * 下部固定の保存バーにタイムテーブル・遅延・いま開催中の保存を集約する。
 * 出演団体の追加・編集フォームと混雑チップは即時保存のため従来どおり個別操作とする。
 */

const CONGESTION_LABEL: Record<CongestionLevel, string> = {
  unknown: '確認中',
  empty: '空いています',
  normal: 'やや混雑',
  crowded: '混雑しています',
};

// 固定フッターにボタンが2つ並ぶため余白を多めに取る
const STAGE_FOOTER_SPACE = 220;

export default function AdminStageScreen() {
  return (
    <AdminGate>
      <AdminStageContent />
    </AdminGate>
  );
}

function AdminStageContent() {
  const { type } = useM3();
  const adminStyles = useAdminStyles();
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState<StageGroup[]>([]);
  const [audGroups, setAudGroups] = useState<StageGroup[]>([]);
  /** 出演団体フォームの編集対象 (ステージ/講堂) */
  const [groupKind, setGroupKind] = useState<'stage' | 'auditorium'>('stage');
  const [groupDraft, setGroupDraft] = useState({
    id: null as string | null,
    name: '',
    detail: '',
    intro: '',
    genre: '',
    imageUri: null as string | null,
    day: undefined as number | undefined,
    start: '',
    end: '',
    delay: '0',
  });
  const [ttBase, setTtBase] = useState<StageItem[]>([]);
  const [ttAdded, setTtAdded] = useState<StageItem[]>([]);
  const [ttEdited, setTtEdited] = useState<Record<string, Partial<StageItem>>>({});
  const [ttDeleted, setTtDeleted] = useState<string[]>([]);
  const [ttDraft, setTtDraft] = useState({ team: '', day: 0, start: '', end: '' });
  const [delays, setDelays] = useState<Record<string, string>>({});
  const [nowOverrideId, setNowOverrideId] = useState<string | null>(null);
  const [congestion, setCongestion] = useState<CongestionLevel>('unknown');
  const { notice, showOk, showErr } = useAdminNotice();

  const auditorium = useMemo(() => mergeTimetable(ttBase, { added: ttAdded, edited: ttEdited, deleted: ttDeleted }), [
    ttBase,
    ttAdded,
    ttEdited,
    ttDeleted,
  ]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const [base, ttOverrides, delayMap, nowOverride, level, stageGroups, audGroupsRaw] = await Promise.all([
          loadAuditoriumBase().catch(() => [] as StageItem[]),
          loadTimetableOverrides().catch(() => ({ added: [] as StageItem[], edited: {}, deleted: [] as string[] })),
          loadDelayMap().catch(() => ({}) as Record<string, number>),
          loadNowOverride().catch(() => ({ auditoriumId: null as string | null })),
          loadCongestion().catch(() => 'unknown' as CongestionLevel),
          loadJSON<unknown>('stage-groups.json', null).catch(() => null),
          loadJSON<unknown>('auditorium-groups.json', null).catch(() => null),
        ]);
        if (cancelled) return;
        setTtBase(base);
        setTtAdded(ttOverrides.added);
        setTtEdited(ttOverrides.edited);
        setTtDeleted(ttOverrides.deleted);
        const merged = mergeTimetable(base, ttOverrides);
        const d: Record<string, string> = {};
        for (const it of merged) d[it.id] = String(delayMap[it.id] ?? it.delayMinutes ?? 0);
        setDelays(d);
        setNowOverrideId(nowOverride.auditoriumId);
        setCongestion(level);
        setGroups(Array.isArray(stageGroups) ? (stageGroups as StageGroup[]) : bundledGroups);
        setAudGroups(Array.isArray(audGroupsRaw) ? (audGroupsRaw as StageGroup[]) : bundledAuditoriumGroups);
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

  const activeGroups = groupKind === 'auditorium' ? audGroups : groups;
  const visibleGroups = useMemo(() => {
    const q = query.trim();
    if (!q) return activeGroups;
    return activeGroups.filter((g) => `${g.name} ${g.detail} ${g.intro ?? ''} ${g.genre ?? ''}`.includes(q));
  }, [activeGroups, query]);

  const visibleAuditorium = useMemo(() => {
    const q = query.trim();
    if (!q) return auditorium;
    return auditorium.filter((it) =>
      `${it.team} ${it.start} ${it.end} ${it.day === 0 ? '土' : '日'}`.includes(q),
    );
  }, [auditorium, query]);

  const emptyGroupDraft = {
    id: null as string | null,
    name: '',
    detail: '',
    intro: '',
    genre: '',
    imageUri: null as string | null,
    day: undefined as number | undefined,
    start: '',
    end: '',
    delay: '0',
  };

  const saveGroupForm = async (): Promise<string> => {
    if (!groupDraft.name.trim()) throw new Error('団体名を入力してください');
    const start = groupDraft.start.trim();
    const end = groupDraft.end.trim();
    const hasTime = start.length > 0 || end.length > 0;
    // 講堂の演目はタイムテーブル (CSV) を正とするため、時刻はステージのみ扱う
    const isAuditorium = groupKind === 'auditorium';
    if (!isAuditorium && hasTime && (!/^\d{1,2}:\d{2}$/.test(start) || !/^\d{1,2}:\d{2}$/.test(end))) {
      throw new Error('時刻は HH:MM 形式で入力してください');
    }
    try {
      const id = groupDraft.id ?? `${isAuditorium ? 'aud' : 'group'}-${Date.now()}`;
      const delay = parseInt(groupDraft.delay, 10);
      const item: StageGroup = {
        id,
        name: groupDraft.name.trim(),
        detail: groupDraft.detail.trim(),
        intro: groupDraft.intro.trim() || undefined,
        genre: groupDraft.genre.trim() || undefined,
        imageUri: groupDraft.imageUri,
        day: !isAuditorium && (groupDraft.day === 0 || groupDraft.day === 1) ? groupDraft.day : undefined,
        start: !isAuditorium && hasTime ? start : undefined,
        end: !isAuditorium && hasTime ? end : undefined,
        delayMinutes: !isAuditorium && Number.isFinite(delay) && delay > 0 ? delay : 0,
      };
      const source = isAuditorium ? audGroups : groups;
      const next = groupDraft.id ? source.map((g) => (g.id === id ? item : g)) : [...source, item];
      if (isAuditorium) {
        await saveAuditoriumGroups(next);
        setAudGroups(next);
      } else {
        await saveStageGroups(next);
        setGroups(next);
      }
      setGroupDraft(emptyGroupDraft);
      return isAuditorium ? '講堂出演団体を保存しました' : 'ステージ出演団体を保存しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  const deleteGroup = async (id: string): Promise<string> => {
    try {
      const isAuditorium = groupKind === 'auditorium';
      const source = isAuditorium ? audGroups : groups;
      const target = source.find((g) => g.id === id);
      if (target?.imageUri) await deleteStoredImage(target.imageUri);
      const next = source.filter((g) => g.id !== id);
      if (isAuditorium) {
        await saveAuditoriumGroups(next);
        setAudGroups(next);
      } else {
        await saveStageGroups(next);
        setGroups(next);
      }
      return isAuditorium ? '講堂出演団体を削除しました' : 'ステージ出演団体を削除しました';
    } catch {
      throw new Error('削除に失敗しました');
    }
  };

  const switchGroupKind = (kind: 'stage' | 'auditorium') => {
    setGroupKind(kind);
    setGroupDraft(emptyGroupDraft);
  };

  const saveTimetableAndDelays = async (): Promise<string> => {
    const edited: Record<string, Partial<StageItem>> = {};
    for (const [id, patch] of Object.entries(ttEdited)) {
      if (ttDeleted.includes(id)) continue;
      const clean: Partial<StageItem> = {};
      if (typeof patch.team === 'string' && patch.team.trim()) clean.team = patch.team.trim();
      if (patch.day === 0 || patch.day === 1) clean.day = patch.day;
      if (typeof patch.start === 'string' && patch.start.trim()) clean.start = patch.start.trim();
      if (typeof patch.end === 'string' && patch.end.trim()) clean.end = patch.end.trim();
      if (Object.keys(clean).length > 0) edited[id] = clean;
    }
    const added = ttAdded
      .filter((it) => !ttDeleted.includes(it.id))
      .map((it) => ({ ...it, team: it.team.trim(), delayMinutes: 0 }));
    const map: Record<string, number> = {};
    for (const [k, v] of Object.entries(delays)) {
      const n = parseInt(v, 10);
      if (Number.isFinite(n) && n > 0) map[k] = n;
    }
    try {
      await saveTimetableOverrides({ added, edited, deleted: [...ttDeleted] });
      await saveDelayMap(map);
      setTtEdited(edited);
      setTtAdded(added);
      return 'タイムテーブル・遅延を保存しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  const addTimetableItem = (): Promise<string> => {
    if (!ttDraft.team.trim()) return Promise.reject(new Error('団体名を入力してください'));
    if (!/^\d{1,2}:\d{2}$/.test(ttDraft.start.trim()) || !/^\d{1,2}:\d{2}$/.test(ttDraft.end.trim())) {
      return Promise.reject(new Error('時刻は HH:MM 形式で入力してください'));
    }
    const item: StageItem = {
      id: `custom-${Date.now()}`,
      team: ttDraft.team.trim(),
      day: ttDraft.day,
      start: ttDraft.start.trim(),
      end: ttDraft.end.trim(),
      delayMinutes: 0,
    };
    setTtAdded((prev) => [...prev, item]);
    setDelays((prev) => ({ ...prev, [item.id]: '0' }));
    setTtDraft({ team: '', day: 0, start: '', end: '' });
    return Promise.resolve('演目を追加しました (保存ボタンで確定)');
  };

  const deleteTimetableItem = (id: string) => {
    if (ttAdded.some((it) => it.id === id)) {
      setTtAdded((prev) => prev.filter((it) => it.id !== id));
    } else {
      setTtDeleted((prev) => (prev.includes(id) ? prev : [...prev, id]));
      setTtEdited((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }
    setDelays((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    showOk('演目を削除しました (保存ボタンで確定)');
  };

  const saveNowOverrideSelection = async (): Promise<string> => {
    try {
      await saveNowOverride({ auditoriumId: nowOverrideId });
      return 'いま開催中を保存しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  const changeCongestion = (level: CongestionLevel) => {
    saveCongestion(level)
      .then(() => {
        setCongestion(level);
        showOk('混雑状況を保存しました');
      })
      .catch(() => showErr('保存に失敗しました'));
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
      <TopAppBar title="管理者用・ステージ/講堂" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: STAGE_FOOTER_SPACE }]}>
          <View style={adminStyles.searchWrap}>
            <M3SearchBar value={query} onChangeText={setQuery} placeholder="団体・演目を検索" />
          </View>

          <Section title="出演団体 (追加・編集・削除)">
            <Field label="会場">
              <View style={adminStyles.chips}>
                {(
                  [
                    { value: 'stage', label: 'ステージ' },
                    { value: 'auditorium', label: '講堂' },
                  ] as const
                ).map((o) => {
                  const active = groupKind === o.value;
                  return (
                    <M3Touch key={o.value} onPress={() => switchGroupKind(o.value)} label={o.label} round>
                      <View style={[adminStyles.chip, active && adminStyles.chipActive]}>
                        <Text
                          style={[type.labelLarge, { color: active ? m3.onPrimaryContainer : m3.onSurfaceVariant }]}
                        >
                          {o.label}
                        </Text>
                      </View>
                    </M3Touch>
                  );
                })}
              </View>
            </Field>
            {groupKind === 'auditorium' ? (
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                講堂の演目（団体名・時間割）は下の「講堂タイムテーブル」で編集します。ここでは紹介文・写真などの詳細を編集します。
              </Text>
            ) : null}
            {visibleGroups.map((g) => (
              <View key={g.id} style={adminStyles.row}>
                <View style={adminStyles.rowText}>
                  <Text style={[type.titleSmall, { color: m3.onSurface }]} numberOfLines={1}>
                    {g.name}
                  </Text>
                  <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={1}>
                    {g.detail}
                  </Text>
                </View>
                <M3Touch
                  label="編集"
                  round
                  onPress={() =>
                    setGroupDraft({
                      id: g.id,
                      name: g.name,
                      detail: g.detail,
                      intro: g.intro ?? '',
                      genre: g.genre ?? '',
                      imageUri: g.imageUri ?? null,
                      day: g.day,
                      start: g.start ?? '',
                      end: g.end ?? '',
                      delay: typeof g.delayMinutes === 'number' ? String(g.delayMinutes) : '0',
                    })
                  }
                >
                  <Text style={[type.labelLarge, adminStyles.link]}>編集</Text>
                </M3Touch>
                <M3Touch
                  label="削除"
                  round
                  onPress={() => {
                    deleteGroup(g.id).then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                  }}
                >
                  <Text style={[type.labelLarge, adminStyles.danger]}>削除</Text>
                </M3Touch>
              </View>
            ))}
            {visibleGroups.length === 0 ? (
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>一致する団体はありません</Text>
            ) : null}
            <View style={adminStyles.block}>
              <Field label="団体名">
                <TextInput
                  style={adminStyles.input}
                  value={groupDraft.name}
                  onChangeText={(t) => setGroupDraft((p) => ({ ...p, name: t }))}
                  placeholder="出演団体名"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="ジャンル (任意)">
                <TextInput
                  style={adminStyles.input}
                  value={groupDraft.genre}
                  onChangeText={(t) => setGroupDraft((p) => ({ ...p, genre: t }))}
                  placeholder="例: 吹奏楽、ダンス"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="短い紹介 (一覧用)">
                <TextInput
                  style={[adminStyles.input, adminStyles.multiline]}
                  value={groupDraft.detail}
                  multiline
                  onChangeText={(t) => setGroupDraft((p) => ({ ...p, detail: t }))}
                  placeholder="団体の短い紹介文"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="詳細な紹介文 (モーダル用)">
                <TextInput
                  style={[adminStyles.input, adminStyles.multiline]}
                  value={groupDraft.intro}
                  multiline
                  onChangeText={(t) => setGroupDraft((p) => ({ ...p, intro: t }))}
                  placeholder="タップしたときに表示する紹介文"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="画像">
                <ImageField
                  value={groupDraft.imageUri}
                  onChange={(uri) => setGroupDraft((p) => ({ ...p, imageUri: uri }))}
                />
              </Field>
              {groupKind === 'stage' ? (
                <>
                  <Field label="ステージ演目の曜日">
                    <View style={adminStyles.chips}>
                      {[
                        { value: undefined, label: '未定' },
                        { value: 0, label: '土' },
                        { value: 1, label: '日' },
                      ].map((o) => {
                        const active = groupDraft.day === o.value;
                        return (
                          <M3Touch
                            key={String(o.value)}
                            onPress={() => setGroupDraft((p) => ({ ...p, day: o.value }))}
                            label={o.label}
                            round
                          >
                            <View style={[adminStyles.chip, active && adminStyles.chipActive]}>
                              <Text
                                style={[
                                  type.labelLarge,
                                  { color: active ? m3.onPrimaryContainer : m3.onSurfaceVariant },
                                ]}
                              >
                                {o.label}
                              </Text>
                            </View>
                          </M3Touch>
                        );
                      })}
                    </View>
                  </Field>
                  <View style={adminStyles.timeRow}>
                    <View style={adminStyles.timeField}>
                      <Field label="開始 (HH:MM)">
                        <TextInput
                          style={adminStyles.input}
                          value={groupDraft.start}
                          onChangeText={(t) => setGroupDraft((p) => ({ ...p, start: t }))}
                          placeholder="例: 12:15"
                          placeholderTextColor={m3.onSurfaceVariant}
                        />
                      </Field>
                    </View>
                    <View style={adminStyles.timeField}>
                      <Field label="終了 (HH:MM)">
                        <TextInput
                          style={adminStyles.input}
                          value={groupDraft.end}
                          onChangeText={(t) => setGroupDraft((p) => ({ ...p, end: t }))}
                          placeholder="例: 12:45"
                          placeholderTextColor={m3.onSurfaceVariant}
                        />
                      </Field>
                    </View>
                  </View>
                  <Field label="遅延分数">
                    <View style={adminStyles.delayRow}>
                      <TextInput
                        style={adminStyles.delayInput}
                        value={groupDraft.delay}
                        keyboardType="number-pad"
                        onChangeText={(t) => setGroupDraft((p) => ({ ...p, delay: t.replace(/[^0-9]/g, '') }))}
                        accessibilityLabel="ステージ演目の遅延分数"
                      />
                      <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>分</Text>
                    </View>
                  </Field>
                </>
              ) : null}
              <View style={adminStyles.buttonRow}>
                <M3Button
                  label={groupKind === 'auditorium' ? '講堂団体を保存' : 'ステージ団体を保存'}
                  icon="save"
                  onPress={() => {
                    saveGroupForm().then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                  }}
                />
                {groupDraft.id ? (
                  <M3Button label="取消" variant="tonal" onPress={() => setGroupDraft(emptyGroupDraft)} />
                ) : null}
              </View>
            </View>
          </Section>

          <Section title="講堂タイムテーブル (遅延分数)">
            {visibleAuditorium.map((it) => {
              const patch = ttEdited[it.id];
              const isAdded = ttAdded.some((a) => a.id === it.id);
              const team = patch?.team ?? it.team;
              const day = patch?.day ?? it.day;
              const start = patch?.start ?? it.start;
              const end = patch?.end ?? it.end;
              const setPatch = (p: Partial<StageItem>) => {
                if (isAdded) {
                  setTtAdded((prev) => prev.map((a) => (a.id === it.id ? { ...a, ...p } : a)));
                } else {
                  setTtEdited((prev) => ({ ...prev, [it.id]: { ...prev[it.id], ...p } }));
                }
              };
              return (
                <View key={it.id} style={adminStyles.block}>
                  <View style={adminStyles.blockHeader}>
                    <Text style={[type.titleSmall, { color: m3.onSurface }]}>
                      {day === 0 ? '土' : '日'} {team}
                      {isAdded ? ' (追加分)' : ''}
                    </Text>
                    <M3Touch label={`${team}を削除`} round onPress={() => deleteTimetableItem(it.id)}>
                      <Text style={[type.labelLarge, adminStyles.danger]}>削除</Text>
                    </M3Touch>
                  </View>
                  <Field label="団体名">
                    <TextInput
                      style={adminStyles.input}
                      value={team}
                      onChangeText={(t) => setPatch({ team: t })}
                      placeholder="団体名"
                      placeholderTextColor={m3.onSurfaceVariant}
                    />
                  </Field>
                  <Field label="曜日">
                    <View style={adminStyles.chips}>
                      {[
                        { value: 0, label: '土' },
                        { value: 1, label: '日' },
                      ].map((o) => {
                        const active = day === o.value;
                        return (
                          <M3Touch key={o.value} onPress={() => setPatch({ day: o.value })} label={o.label} round>
                            <View style={[adminStyles.chip, active && adminStyles.chipActive]}>
                              <Text
                                style={[
                                  type.labelLarge,
                                  { color: active ? m3.onPrimaryContainer : m3.onSurfaceVariant },
                                ]}
                              >
                                {o.label}
                              </Text>
                            </View>
                          </M3Touch>
                        );
                      })}
                    </View>
                  </Field>
                  <View style={adminStyles.timeRow}>
                    <View style={adminStyles.timeField}>
                      <Field label="開始 (HH:MM)">
                        <TextInput
                          style={adminStyles.input}
                          value={start}
                          onChangeText={(t) => setPatch({ start: t })}
                          placeholder="例: 10:00"
                          placeholderTextColor={m3.onSurfaceVariant}
                        />
                      </Field>
                    </View>
                    <View style={adminStyles.timeField}>
                      <Field label="終了 (HH:MM)">
                        <TextInput
                          style={adminStyles.input}
                          value={end}
                          onChangeText={(t) => setPatch({ end: t })}
                          placeholder="例: 10:30"
                          placeholderTextColor={m3.onSurfaceVariant}
                        />
                      </Field>
                    </View>
                  </View>
                  <Field label="遅延分数">
                    <View style={adminStyles.delayRow}>
                      <TextInput
                        style={adminStyles.delayInput}
                        value={delays[it.id] ?? '0'}
                        keyboardType="number-pad"
                        onChangeText={(t) => setDelays((p) => ({ ...p, [it.id]: t.replace(/[^0-9]/g, '') }))}
                        accessibilityLabel={`${team}の遅延分数`}
                      />
                      <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>分</Text>
                    </View>
                  </Field>
                </View>
              );
            })}
            {visibleAuditorium.length === 0 ? (
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                {auditorium.length === 0 ? 'タイムテーブルが読み込めませんでした' : '一致する演目はありません'}
              </Text>
            ) : null}
            <View style={adminStyles.block}>
              <Text style={[type.titleSmall, { color: m3.onSurface }]}>演目の新規追加</Text>
              <Field label="団体名">
                <TextInput
                  style={adminStyles.input}
                  value={ttDraft.team}
                  onChangeText={(t) => setTtDraft((p) => ({ ...p, team: t }))}
                  placeholder="団体名"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="曜日">
                <View style={adminStyles.chips}>
                  {[
                    { value: 0, label: '土' },
                    { value: 1, label: '日' },
                  ].map((o) => {
                    const active = ttDraft.day === o.value;
                    return (
                      <M3Touch
                        key={o.value}
                        onPress={() => setTtDraft((p) => ({ ...p, day: o.value }))}
                        label={o.label}
                        round
                      >
                        <View style={[adminStyles.chip, active && adminStyles.chipActive]}>
                          <Text
                            style={[type.labelLarge, { color: active ? m3.onPrimaryContainer : m3.onSurfaceVariant }]}
                          >
                            {o.label}
                          </Text>
                        </View>
                      </M3Touch>
                    );
                  })}
                </View>
              </Field>
              <View style={adminStyles.timeRow}>
                <View style={adminStyles.timeField}>
                  <Field label="開始 (HH:MM)">
                    <TextInput
                      style={adminStyles.input}
                      value={ttDraft.start}
                      onChangeText={(t) => setTtDraft((p) => ({ ...p, start: t }))}
                      placeholder="例: 10:00"
                      placeholderTextColor={m3.onSurfaceVariant}
                    />
                  </Field>
                </View>
                <View style={adminStyles.timeField}>
                  <Field label="終了 (HH:MM)">
                    <TextInput
                      style={adminStyles.input}
                      value={ttDraft.end}
                      onChangeText={(t) => setTtDraft((p) => ({ ...p, end: t }))}
                      placeholder="例: 10:30"
                      placeholderTextColor={m3.onSurfaceVariant}
                    />
                  </Field>
                </View>
              </View>
              <View style={adminStyles.buttonRow}>
                <M3Button
                  label="演目を追加"
                  icon="add"
                  variant="tonal"
                  onPress={() => {
                    addTimetableItem().then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                  }}
                />
              </View>
            </View>
          </Section>

          <Section title="いま開催中 (手動選択)">
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              時刻による自動判定を手動で上書きします。「自動判定に戻す」を選ぶと解除されます。
            </Text>
            <M3Touch label="自動判定に戻す" round onPress={() => setNowOverrideId(null)}>
              <View style={[adminStyles.row, nowOverrideId === null && adminStyles.rowActive]}>
                <View style={adminStyles.rowText}>
                  <Text style={[type.titleSmall, { color: m3.onSurface }]}>自動判定に戻す</Text>
                  <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>選択解除で時刻からの自動判定に戻ります</Text>
                </View>
                <Text style={[type.labelLarge, { color: nowOverrideId === null ? m3.primary : m3.onSurfaceVariant }]}>
                  {nowOverrideId === null ? '選択中' : '選択'}
                </Text>
              </View>
            </M3Touch>
            {visibleAuditorium.map((it) => {
              const active = nowOverrideId === it.id;
              return (
                <M3Touch
                  key={`now-${it.id}`}
                  label={`${it.day === 0 ? '土' : '日'} ${it.team}を選択`}
                  round
                  onPress={() => setNowOverrideId(it.id)}
                >
                  <View style={[adminStyles.row, active && adminStyles.rowActive]}>
                    <View style={adminStyles.rowText}>
                      <Text style={[type.titleSmall, { color: m3.onSurface }]} numberOfLines={1}>
                        {it.day === 0 ? '土' : '日'} {it.team}
                      </Text>
                      <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]} numberOfLines={1}>
                        {it.start}–{it.end}
                      </Text>
                    </View>
                    <Text style={[type.labelLarge, { color: active ? m3.primary : m3.onSurfaceVariant }]}>
                      {active ? '選択中' : '選択'}
                    </Text>
                  </View>
                </M3Touch>
              );
            })}
          </Section>

          <Section title="講堂混雑状況">
            <Chips<CongestionLevel>
              options={[
                { value: 'unknown', label: CONGESTION_LABEL.unknown },
                { value: 'empty', label: CONGESTION_LABEL.empty },
                { value: 'normal', label: CONGESTION_LABEL.normal },
                { value: 'crowded', label: CONGESTION_LABEL.crowded },
              ]}
              value={congestion}
              onChange={changeCongestion}
            />
          </Section>

          <View style={adminStyles.backWrap}>
            <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin/index' as never)} />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[
            { label: 'タイムテーブル・遅延を保存', icon: 'save', run: saveTimetableAndDelays },
            { label: 'いま開催中を保存', icon: 'save', variant: 'tonal', run: saveNowOverrideSelection },
          ]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}
