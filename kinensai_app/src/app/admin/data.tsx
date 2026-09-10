import React, { useState } from 'react';
import { ScrollView, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, TopAppBar } from '../../components/m3';
import {
  AdminNotice,
  AdminSaveBar,
  useAdminNotice,
} from '../../components/AdminSaveBar';
import { Section, adminStyles } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
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
import { loadJSON } from '../../data/kvStore';
import { getContentUrl, isRemoteContentConfigured } from '../../data/remoteConfig';
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
   * 全世界公開用の分割バンドル書き出し。
   * 各共有キーを `{key}.json` 形式で `===== FILE: {key} =====` 区切りで連結する。
   * 運営は各ブロックを同名ファイルとして配信URL (`contentUrl`) 配下に配置する。
   * 全端末は次回表示時に取得し、同梱値より優先して表示する。
   */
  const exportPublishBundle = async (): Promise<string> => {
    try {
      const entries: Array<[string, unknown]> = await Promise.all([
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
      setIoText(
        entries.map(([key, value]) => `===== FILE: ${key} =====\n${JSON.stringify(value, null, 2)}`).join('\n\n'),
      );
      return '公開バンドルを書き出しました。各ファイルを配信先に配置してください';
    } catch {
      throw new Error('公開バンドルの書き出しに失敗しました');
    }
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
                ? `配信先: ${contentUrl}\n「公開バンドル書き出し」で下の欄に出力し、各ファイルを同名で配信先に配置すると、全端末の次回表示時に反映されます (最大5分遅延)。`
                : '配信URL (app.json の extra.contentUrl) が未設定です。設定後に「公開バンドル書き出し」の各ファイルを同名で配信先に配置すると、全端末に反映されます。未設定の間は管理者編集はこの端末のプレビューに留まります。'}
            </Text>
            <M3Button label="公開バンドル書き出し" icon="public" variant="tonal" onPress={() => { exportPublishBundle().then(showOk).catch((e: unknown) => showErr(e instanceof Error ? e.message : '書き出しに失敗しました')); }} />
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
