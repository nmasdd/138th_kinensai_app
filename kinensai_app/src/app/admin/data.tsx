import React, { useState } from 'react';
import { Platform, ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, TopAppBar } from '../../components/m3';
import {
  AdminNotice,
  AdminSaveBar,
  useAdminNotice,
} from '../../components/AdminSaveBar';
import { Section, useAdminStyles } from '../../components/adminUi';
import { AdminGate, getAdminApiBase, getAdminToken } from '../../components/AdminGuard';
import {
  loadClassOverrides,
  saveClassOverrides,
  loadCustomClasses,
  saveCustomClasses,
  type ClassOverride,
  type Exhibition,
} from '../../data/exhibitions';
import { loadVolunteers, saveVolunteers } from '../../data/volunteers';
import { loadTicketMap, saveTicketMap, type TicketInfo } from '../../data/tickets';
import { loadNotifications, saveNotifications, type AppNotification } from '../../data/notifications';
import {
  loadDelayMap,
  saveDelayMap,
  loadTimetableOverrides,
  saveTimetableOverrides,
  loadNowOverride,
  type NowOverride,
  type StageItem,
} from '../../data/timetable';
import { loadCongestion, saveCongestion, type CongestionLevel } from '../../data/congestion';
import { saveStageGroups, saveAuditoriumGroups, bundledGroups, bundledAuditoriumGroups, type StageGroup } from '../../data/stage';
import { loadPickIds, type PicksData } from '../../data/picks';
import { loadMapLayout, saveMapLayout, type MapLayoutOverrides } from '../../data/mapLayout';
import { SHARED_CONTENT_KEYS, clearLocalKey, loadJSON } from '../../data/kvStore';
import { clearRemoteCache, fetchPublishedJSON, getContentUrl, isRemoteContentConfigured, isRemoteContentEnabled, refreshContentVersion } from '../../data/remoteConfig';
import { validatePublishEntries, type ValidationIssue } from '../../data/validateContent';
import { rewriteImagesForPublish } from '../../data/imageUpload';
import { m3 } from '../../theme';
import { useM3 } from '../../context/responsive';

/**
 * 管理者用・データ管理 (/admin/data)。
 * 端末間の移行・バックアップ用の書き出し・取り込み。
 * 絞り込み対象の一覧がないため検索窓は付けていない。
 * 書き出し・取り込みボタンは下部固定の保存バーに配置する。
 */

// 固定フッターにボタンが2つ並ぶため余白を多めに取る
const DATA_FOOTER_SPACE = 220;

export default function AdminDataScreen() {
  return (
    <AdminGate>
      <AdminDataContent />
    </AdminGate>
  );
}

function AdminDataContent() {
  const { type } = useM3();
  const adminStyles = useAdminStyles();
  const [ioText, setIoText] = useState('');
  const [issues, setIssues] = useState<ValidationIssue[]>([]);
  const [remoteText, setRemoteText] = useState('');
  const { notice, showOk, showErr } = useAdminNotice();

  const exportAll = async (): Promise<string> => {
    try {
      const [overrides, customClasses, vols, ticketMap, notifs, delayMap, ttOverrides, level, stageGroups, audGroups, mapLayout] =
        await Promise.all([
          loadClassOverrides(),
          loadCustomClasses(),
          loadVolunteers(),
          loadTicketMap(),
          loadNotifications(),
          loadDelayMap(),
          loadTimetableOverrides(),
          loadCongestion(),
          loadJSON<unknown>('stage-groups.json', null),
          loadJSON<unknown>('auditorium-groups.json', null),
          loadMapLayout(),
        ]);
      setIoText(
        JSON.stringify(
          {
            classOverrides: overrides,
            customClasses,
            volunteers: vols,
            tickets: ticketMap,
            notifications: notifs,
            stageGroups,
            auditoriumGroups: audGroups,
            congestion: level,
            delays: delayMap,
            timetableOverrides: ttOverrides,
            mapLayout,
          },
          null,
          2,
        ),
      );
      return 'データをJSONに書き出しました';
    } catch {
      throw new Error('書き出しに失敗しました');
    }
  };

  const importAll = async (): Promise<string> => {    try {
      const parsed = JSON.parse(ioText) as {
        classOverrides?: Record<string, ClassOverride>;
        customClasses?: Exhibition[];
        volunteers?: Exhibition[];
        tickets?: Record<string, TicketInfo>;
        notifications?: AppNotification[];
        stageGroups?: StageGroup[];
        auditoriumGroups?: StageGroup[];
        congestion?: CongestionLevel;
        delays?: Record<string, number>;
        timetableOverrides?: { added?: StageItem[]; edited?: Record<string, Partial<StageItem>>; deleted?: string[] };
        mapLayout?: MapLayoutOverrides;
      };
      if (parsed.classOverrides) await saveClassOverrides(parsed.classOverrides);
      if (Array.isArray(parsed.customClasses)) await saveCustomClasses(parsed.customClasses);
      if (Array.isArray(parsed.volunteers)) await saveVolunteers(parsed.volunteers);
      if (parsed.tickets) await saveTicketMap(parsed.tickets);
      if (Array.isArray(parsed.notifications)) await saveNotifications(parsed.notifications);
      if (Array.isArray(parsed.stageGroups)) await saveStageGroups(parsed.stageGroups);
      if (Array.isArray(parsed.auditoriumGroups)) await saveAuditoriumGroups(parsed.auditoriumGroups);
      if (parsed.congestion) await saveCongestion(parsed.congestion);
      if (parsed.delays) await saveDelayMap(parsed.delays);
      if (parsed.timetableOverrides) {
        await saveTimetableOverrides({
          added: Array.isArray(parsed.timetableOverrides.added) ? parsed.timetableOverrides.added : [],
          edited:
            parsed.timetableOverrides.edited && typeof parsed.timetableOverrides.edited === 'object'
              ? parsed.timetableOverrides.edited
              : {},
          deleted: Array.isArray(parsed.timetableOverrides.deleted) ? parsed.timetableOverrides.deleted : [],
        });
      }
      if (parsed.mapLayout) await saveMapLayout(parsed.mapLayout);
      return 'データを取り込みました';
    } catch {
      throw new Error('取り込みに失敗しました (JSONを確認してください)');
    }
  };

  /**
   * 全世界公開用の分割バンドル (各共有キーの現在有効値)。
   * 読込優先度 (端末プレビュー→全世界配信→同梱値) の解決済み値なので、
   * そのまま公開しても表示が変わることはない (安全な初回公開が可能)。
   * 未設定のキーも必ず配列/オブジェクトで返す (null を配信しない)。
   */
  const collectPublishEntries = async (): Promise<Array<[string, unknown]>> => {
    const [overrides, customClasses, vols, ticketMap, notifs, stageGroups, audGroups, congestion, delayMap, ttOverrides, pickIds, nowOverride, mapLayout] =
      await Promise.all([
        loadClassOverrides(),
        loadCustomClasses(),
        loadVolunteers(),
        loadTicketMap(),
        loadNotifications(),
        loadStageGroupsWithFallback(),
        loadAuditoriumGroupsWithFallback(),
        loadCongestion(),
        loadDelayMap(),
        loadTimetableOverrides(),
        loadPickIds(),
        loadNowOverride(),
        loadMapLayout(),
      ]);
    const picks: PicksData = { ids: pickIds };
    const now: NowOverride = { auditoriumId: nowOverride.auditoriumId };
    return [
      ['class-overrides.json', overrides],
      ['custom-classes.json', customClasses],
      ['volunteers.json', vols],
      ['tickets.json', ticketMap],
      ['notifications.json', notifs],
      ['stage-groups.json', stageGroups],
      ['auditorium-groups.json', audGroups],
      ['congestion.json', { level: congestion }],
      ['delays.json', delayMap],
      ['timetable-overrides.json', ttOverrides],
      ['picks.json', picks],
      ['now-override.json', now],
      ['map-layout.json', mapLayout],
    ];
  };

  const loadStageGroupsWithFallback = async (): Promise<StageGroup[]> => {
    const parsed = await loadJSON<unknown>('stage-groups.json', null).catch(() => null);
    return Array.isArray(parsed) ? (parsed as StageGroup[]) : bundledGroups;
  };

  const loadAuditoriumGroupsWithFallback = async (): Promise<StageGroup[]> => {
    const parsed = await loadJSON<unknown>('auditorium-groups.json', null).catch(() => null);
    return Array.isArray(parsed) ? (parsed as StageGroup[]) : bundledAuditoriumGroups;
  };

  /**
   * 全世界公開用の分割バンドル書き出し (バックアップ・目視確認用)。
   * サーバへの公開は「全世界に公開」ボタンで行う。
   */
  const exportPublishBundle = async (): Promise<string> => {
    try {
      const entries = await collectPublishEntries();
      setIoText(
        entries.map(([key, value]) => `===== FILE: ${key} =====\n${JSON.stringify(value, null, 2)}`).join('\n\n'),
      );
      return '公開バンドルを書き出しました (バックアップ・確認用。公開は「全世界に公開」で行います)';
    } catch {
      throw new Error('公開バンドルの書き出しに失敗しました');
    }
  };

  /**
   * 全世界に公開: 現在有効値をサーバ (KV) へ書き込み、全端末に配信する。
   * 管理者トークン必須。失敗時は例外メッセージを投げる。
   */
  const publishWorldwide = async (): Promise<string> => {
    const token = getAdminToken();
    if (!token) throw new Error('認証が切れています。ページを開き直して再認証してください');
    if (Platform.OS === 'web' && typeof window !== 'undefined' && !window.navigator.onLine) {
      throw new Error('オフラインです。接続を確認してください');
    }
    const entries = await collectPublishEntries();
    // 公開前に構造を検査する (壊れたデータを全端末へ配信しない)
    const validation = validatePublishEntries(entries);
    if (validation.errorCount > 0) {
      const first = validation.issues.find((i) => i.severity === 'error');
      setIssues(validation.issues);
      throw new Error(
        `公開前チェックでエラーが${validation.errorCount}件あります (${first?.path}: ${first?.message})。下の「公開前チェック」を確認してください`,
      );
    }
    // 端末ローカル・dataURLの画像は先にサーバへ上げ、公開URLに書き換える
    const { entries: publishEntries, result: imgResult } = await rewriteImagesForPublish(
      entries,
      token,
      getAdminApiBase(),
    );
    const payload = JSON.stringify({ token, files: Object.fromEntries(publishEntries) });
    if (payload.length > 1800000) {
      throw new Error('データが大きすぎます。画像の点数・サイズを減らして再試行してください');
    }
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 120000);
    try {
      const res = await fetch(`${getAdminApiBase()}/api/content/publish`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: payload,
        signal: ctrl.signal,
      });
      let parsed: { ok?: unknown; published?: unknown } | null = null;
      try {
        parsed = (await res.json()) as { ok?: unknown; published?: unknown };
      } catch {}
      if (!res.ok || parsed?.ok !== true) {
        if (res.status === 401) throw new Error('認証が切れています。再認証してください');
        if (res.status === 429) throw new Error('試行回数が多すぎます。時間をおいてください');
        if (res.status === 413) throw new Error('データが大きすぎます。画像の点数・サイズを減らしてください');
        throw new Error('公開に失敗しました (サーバ応答を確認してください)');
      }
      const count = Array.isArray(parsed.published) ? parsed.published.length : entries.length;
      // サーバの版数を取り直し、この端末のキャッシュを破棄して全画面に再読込を通知する
      await refreshContentVersion({ force: true }).catch(() => {});
      clearRemoteCache();
      const imgNote =
        imgResult.uploaded > 0 || imgResult.failed > 0
          ? ` (画像${imgResult.uploaded}件を配信化${imgResult.failed > 0 ? `・${imgResult.failed}件は除外` : ''})`
          : '';
      const warnNote = validation.warningCount > 0 ? ` ・確認推奨${validation.warningCount}件` : '';
      return `全世界に公開しました (${count}件。全端末に30秒以内で反映)${imgNote}${warnNote}`;
    } catch (e) {
      if (e instanceof Error) throw e;
      throw new Error('公開に失敗しました (接続を確認してください)');
    } finally {
      clearTimeout(timer);
    }
  };

  /**
   * 端末プレビューの破棄: この端末の管理者編集を取り消し、全世界配信の値に戻す。
   * 全世界の配信内容は変わらない。
   */
  const discardPreview = async (): Promise<string> => {
    await Promise.all(SHARED_CONTENT_KEYS.map((key) => clearLocalKey(key)));
    clearRemoteCache();
    await refreshContentVersion({ force: true }).catch(() => {});
    return 'この端末のプレビューを破棄しました (全世界の配信は変わりません)';
  };

  /** 公開前チェック: 現在有効値の構造を検査して結果を表示する (公開はしない)。 */
  const runValidation = async (): Promise<string> => {
    const entries = await collectPublishEntries();
    const validation = validatePublishEntries(entries);
    setIssues(validation.issues);
    if (validation.errorCount > 0) {
      return `公開前チェック: エラー${validation.errorCount}件・確認推奨${validation.warningCount}件。修正してから公開してください`;
    }
    return `公開前チェック: 問題ありません (確認推奨${validation.warningCount}件)`;
  };

  /**
   * 配信中の値 (本番KV) をキャッシュを無視して取得し、表示する。
   * この端末のプレビューではなく「他端末が見ている値」を確認できる。
   */
  const fetchLiveRemote = async (): Promise<string> => {
    if (!isRemoteContentEnabled()) {
      throw new Error('開発モードでは配信を無効にしています。EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1 で起動してください');
    }
    if (!remoteReady) throw new Error('配信URLが未設定です');
    const bust = Date.now();
    const entries = await Promise.all(
      SHARED_CONTENT_KEYS.map(
        async (key) => [key, await fetchPublishedJSON(key, bust)] as [string, unknown],
      ),
    );
    const found = entries.filter(([, v]) => v !== null);
    if (found.length === 0) {
      setRemoteText('(配信中の値はありません。まだ公開していないか取得に失敗しました)');
      return '配信中の値を取得できませんでした';
    }
    setRemoteText(
      found
        .map(([key, value]) => `===== FILE: ${key} =====\n${JSON.stringify(value, null, 2)}`)
        .join('\n\n'),
    );
    return `配信中の値を取得しました (${found.length}件)`;
  };

  const contentUrl = getContentUrl();
  const remoteReady = isRemoteContentConfigured();
  const errorIssues = issues.filter((i) => i.severity === 'error');
  const warnIssues = issues.filter((i) => i.severity === 'warning');

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用・データ管理" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: DATA_FOOTER_SPACE }]}>
          <Section title="データの書き出し・取り込み">
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              端末間の移行・バックアップ用です。「書き出し」でJSONを表示し、「取り込み」で貼り付けたJSONを保存します。
            </Text>
            <TextInput
              style={[adminStyles.input, adminStyles.ioBox]}
              value={ioText}
              multiline
              onChangeText={setIoText}
              placeholder="ここにJSONを貼り付け"
              placeholderTextColor={m3.onSurfaceVariant}
            />
          </Section>
          <Section title="全世界への公開 (配信)">
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              {!isRemoteContentEnabled()
                ? '開発モードでは配信を無効にしています (同梱値のみ・本番KVへ接続しません)。公開・配信値を確認するには EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1 で起動してください。各画面の保存はこの端末のプレビューです。'
                : remoteReady
                  ? `配信先: ${contentUrl}\n「全世界に公開」でこの端末の現在値 (編集中のプレビュー含む) を全端末へ配信します (開いている端末は30秒以内、復帰時に即時)。「プレビュー破棄」でこの端末の編集を取り消せます。`
                  : '配信URL (app.json の extra.contentUrl) が未設定です。設定後に「全世界に公開」で配信できます。未設定の間は管理者編集はこの端末のプレビューに留まります。'}
            </Text>
            <M3Button label="公開前チェック" icon="fact-check" variant="outlined" onPress={() => { runValidation().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : 'チェックに失敗しました')); }} />
            <M3Button label="全世界に公開" icon="public" onPress={() => { publishWorldwide().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '公開に失敗しました')); }} />
            <M3Button label="プレビュー破棄" icon="undo" variant="tonal" onPress={() => { discardPreview().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '破棄に失敗しました')); }} />
            <M3Button label="公開バンドル書き出し" icon="download" variant="outlined" onPress={() => { exportPublishBundle().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '書き出しに失敗しました')); }} />
          </Section>

          <Section title="公開前チェック結果">
            {issues.length === 0 ? (
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
                「公開前チェック」または「全世界に公開」で結果がここに表示されます。エラーがあると公開できません。
              </Text>
            ) : (
              <>
                {errorIssues.length === 0 ? (
                  <Text style={[type.bodyMedium, { color: m3.onSurface }]}>
                    エラーはありません (確認推奨 {warnIssues.length}件)
                  </Text>
                ) : (
                  <Text style={[type.bodyMedium, { color: m3.error }]}>
                    エラー {errorIssues.length}件 (公開不可)
                  </Text>
                )}
                {[...errorIssues, ...warnIssues].slice(0, 50).map((issue, i) => (
                  <Text
                    key={`${issue.path}-${i}`}
                    style={[
                      type.bodyMedium,
                      { color: issue.severity === 'error' ? m3.error : m3.onSurfaceVariant },
                    ]}
                  >
                    {issue.severity === 'error' ? '✕' : '!'} {issue.path}: {issue.message}
                  </Text>
                ))}
              </>
            )}
          </Section>

          <Section title="配信中の値を確認 (本番KV)">
            <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              {isRemoteContentEnabled()
                ? 'いま全端末に配信されている値 (この端末のプレビューではない) を取得して表示します。'
                : '開発モードでは配信を無効にしています (EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1 で起動すると取得できます)。'}
            </Text>
            <M3Button label="配信中の値を取得" icon="cloud-download" variant="outlined" onPress={() => { fetchLiveRemote().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '取得に失敗しました')); }} />
            <TextInput
              style={[adminStyles.input, adminStyles.ioBox]}
              value={remoteText}
              multiline
              editable={false}
              placeholder="「配信中の値を取得」で表示"
              placeholderTextColor={m3.onSurfaceVariant}
            />
          </Section>
          <View style={adminStyles.backWrap}>
            <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin/index' as never)} />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[
            { label: '書き出し', icon: 'upload', variant: 'tonal', run: exportAll },
            { label: '取り込み', icon: 'download', run: importAll },
          ]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}
