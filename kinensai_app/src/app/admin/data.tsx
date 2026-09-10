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
import { Section, adminStyles } from '../../components/adminUi';
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
  type StageItem,
} from '../../data/timetable';
import { loadCongestion, saveCongestion, type CongestionLevel } from '../../data/congestion';
import { saveStageGroups, type StageGroup } from '../../data/stage';
import { SHARED_CONTENT_KEYS, clearLocalKey, loadJSON } from '../../data/kvStore';
import { clearRemoteCache, getContentUrl, isRemoteContentConfigured } from '../../data/remoteConfig';
import { rewriteImagesForPublish } from '../../data/imageUpload';
import { m3, m3type } from '../../theme';

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
  const [ioText, setIoText] = useState('');
  const { notice, showOk, showErr } = useAdminNotice();

  const exportAll = async (): Promise<string> => {
    try {
      const [overrides, customClasses, vols, ticketMap, notifs, delayMap, ttOverrides, level, stageGroups] =
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
            congestion: level,
            delays: delayMap,
            timetableOverrides: ttOverrides,
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
        congestion?: CongestionLevel;
        delays?: Record<string, number>;
        timetableOverrides?: { added?: StageItem[]; edited?: Record<string, Partial<StageItem>>; deleted?: string[] };
      };
      if (parsed.classOverrides) await saveClassOverrides(parsed.classOverrides);
      if (Array.isArray(parsed.customClasses)) await saveCustomClasses(parsed.customClasses);
      if (Array.isArray(parsed.volunteers)) await saveVolunteers(parsed.volunteers);
      if (parsed.tickets) await saveTicketMap(parsed.tickets);
      if (Array.isArray(parsed.notifications)) await saveNotifications(parsed.notifications);
      if (Array.isArray(parsed.stageGroups)) await saveStageGroups(parsed.stageGroups);
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
      return 'データを取り込みました';
    } catch {
      throw new Error('取り込みに失敗しました (JSONを確認してください)');
    }
  };

  /**
   * 全世界公開用の分割バンドル (各共有キーの現在有効値)。
   * 読込優先度 (端末プレビュー→全世界配信→同梱値) の解決済み値なので、
   * そのまま公開しても表示が変わることはない (安全な初回公開が可能)。
   */
  const collectPublishEntries = async (): Promise<Array<[string, unknown]>> =>
    Promise.all([
      loadClassOverrides().then((v) => ['class-overrides.json', v] as [string, unknown]),
      loadCustomClasses().then((v) => ['custom-classes.json', v] as [string, unknown]),
      loadVolunteers().then((v) => ['volunteers.json', v] as [string, unknown]),
      loadTicketMap().then((v) => ['tickets.json', v] as [string, unknown]),
      loadNotifications().then((v) => ['notifications.json', v] as [string, unknown]),
      loadJSON<unknown>('stage-groups.json', null).then((v) => ['stage-groups.json', v] as [string, unknown]),
      loadCongestion().then((v) => ['congestion.json', { level: v }] as [string, unknown]),
      loadDelayMap().then((v) => ['delays.json', v] as [string, unknown]),
      loadTimetableOverrides().then((v) => ['timetable-overrides.json', v] as [string, unknown]),
      loadJSON<unknown>('picks.json', null).then((v) => ['picks.json', v] as [string, unknown]),
      loadJSON<unknown>('now-override.json', null).then((v) => ['now-override.json', v] as [string, unknown]),
    ]);

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
      const imgNote =
        imgResult.uploaded > 0 || imgResult.failed > 0
          ? ` (画像${imgResult.uploaded}件を配信化${imgResult.failed > 0 ? `・${imgResult.failed}件は除外` : ''})`
          : '';
      return `全世界に公開しました (${count}件。全端末に最大5分で反映)${imgNote}`;
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
    return 'この端末のプレビューを破棄しました (全世界の配信は変わりません)';
  };

  const contentUrl = getContentUrl();
  const remoteReady = isRemoteContentConfigured();

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用・データ管理" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: DATA_FOOTER_SPACE }]}>
          <Section title="データの書き出し・取り込み">
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
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
            <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant, marginBottom: 8 }]}>
              {remoteReady
                ? `配信先: ${contentUrl}\n「全世界に公開」でこの端末の現在値 (編集中のプレビュー含む) を全端末へ配信します (最大5分遅延)。「プレビュー破棄」でこの端末の編集を取り消せます。`
                : '配信URL (app.json の extra.contentUrl) が未設定です。設定後に「全世界に公開」で配信できます。未設定の間は管理者編集はこの端末のプレビューに留まります。'}
            </Text>
            <M3Button label="全世界に公開" icon="public" onPress={() => { publishWorldwide().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '公開に失敗しました')); }} />
            <M3Button label="プレビュー破棄" icon="undo" variant="tonal" onPress={() => { discardPreview().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '破棄に失敗しました')); }} />
            <M3Button label="公開バンドル書き出し" icon="download" variant="outlined" onPress={() => { exportPublishBundle().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '書き出しに失敗しました')); }} />
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
