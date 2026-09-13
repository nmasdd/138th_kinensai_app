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
import { Field, ImageField, Section, useAdminStyles, today } from '../../components/adminUi';
import { AdminGate } from '../../components/AdminGuard';
import { loadNotifications, saveNotifications, type AppNotification } from '../../data/notifications';
import { deleteStoredImage } from '../../data/images';
import { m3 } from '../../theme';
import { useM3 } from '../../context/responsive';

/**
 * 管理者用・通知 (/admin/notifications)。
 * 検索窓は表示の絞り込みのみ。
 * 下部固定の保存バーは新規通知の追加を行う。削除は一覧から即時反映される。
 */

export default function AdminNotificationsScreen() {
  return (
    <AdminGate>
      <AdminNotificationsContent />
    </AdminGate>
  );
}

function AdminNotificationsContent() {
  const { type } = useM3();
  const adminStyles = useAdminStyles();
  const [isLoading, setIsLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [notifDraft, setNotifDraft] = useState({ title: '', body: '', date: today(), imageUri: null as string | null });
  const { notice, showOk, showErr } = useAdminNotice();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const notifs = await loadNotifications();
        if (!cancelled) setNotifications(notifs);
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

  const visibleNotifications = useMemo(() => {
    const q = query.trim();
    if (!q) return notifications;
    return notifications.filter((n) => `${n.title} ${n.body} ${n.date}`.includes(q));
  }, [notifications, query]);

  const addNotification = async (): Promise<string> => {
    if (!notifDraft.title.trim()) throw new Error('タイトルを入力してください');
    try {
      const item: AppNotification = {
        id: `n-${Date.now()}`,
        title: notifDraft.title.trim(),
        body: notifDraft.body.trim(),
        date: notifDraft.date.trim() || today(),
        imageUri: notifDraft.imageUri,
      };
      const next = [item, ...notifications];
      await saveNotifications(next);
      setNotifications(next);
      setNotifDraft({ title: '', body: '', date: today(), imageUri: null });
      return '通知を追加しました';
    } catch {
      throw new Error('保存に失敗しました');
    }
  };

  const deleteNotification = async (id: string): Promise<string> => {
    try {
      const target = notifications.find((n) => n.id === id);
      if (target?.imageUri) await deleteStoredImage(target.imageUri);
      const next = notifications.filter((n) => n.id !== id);
      await saveNotifications(next);
      setNotifications(next);
      return '通知を削除しました';
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
      <TopAppBar title="管理者用・通知" />
      <View style={adminStyles.contentWrap}>
        <ScrollView contentContainerStyle={[adminStyles.body, { paddingBottom: ADMIN_FOOTER_SPACE }]}>
          <View style={adminStyles.searchWrap}>
            <M3SearchBar value={query} onChangeText={setQuery} placeholder="通知を検索" />
          </View>
          <Section title="通知 (追加・削除)">
            {visibleNotifications.map((n) => (
              <View key={n.id} style={adminStyles.row}>
                <View style={adminStyles.rowText}>
                  <Text style={[type.labelMedium, { color: m3.onSurfaceVariant }]}>{n.date}</Text>
                  <Text style={[type.titleSmall, { color: m3.onSurface }]} numberOfLines={1}>
                    {n.title}
                  </Text>
                </View>
                <M3Touch
                  label="削除"
                  round
                  onPress={() => {
                    deleteNotification(n.id).then(showOk).catch((e) => showErr(adminErrorMessage(e)));
                  }}
                >
                  <Text style={[type.labelLarge, adminStyles.danger]}>削除</Text>
                </M3Touch>
              </View>
            ))}
            {visibleNotifications.length === 0 ? (
              <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>一致する通知はありません</Text>
            ) : null}
            <View style={adminStyles.block}>
              <Field label="タイトル">
                <TextInput
                  style={adminStyles.input}
                  value={notifDraft.title}
                  onChangeText={(t) => setNotifDraft((p) => ({ ...p, title: t }))}
                  placeholder="通知タイトル"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="本文">
                <TextInput
                  style={[adminStyles.input, adminStyles.multiline]}
                  value={notifDraft.body}
                  multiline
                  onChangeText={(t) => setNotifDraft((p) => ({ ...p, body: t }))}
                  placeholder="通知の本文"
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="日付 (YYYY-MM-DD)">
                <TextInput
                  style={adminStyles.input}
                  value={notifDraft.date}
                  onChangeText={(t) => setNotifDraft((p) => ({ ...p, date: t }))}
                  placeholder={today()}
                  placeholderTextColor={m3.onSurfaceVariant}
                />
              </Field>
              <Field label="画像">
                <ImageField
                  value={notifDraft.imageUri}
                  onChange={(uri) => setNotifDraft((p) => ({ ...p, imageUri: uri }))}
                />
              </Field>
            </View>
          </Section>
          <View style={adminStyles.backWrap}>
            <M3Button label="目次に戻る" icon="undo" variant="tonal" onPress={() => router.push('/admin/index' as never)} />
          </View>
        </ScrollView>
        <AdminNotice notice={notice} />
        <AdminSaveBar
          actions={[{ label: '通知を追加', icon: 'add', run: addNotification }]}
          showOk={showOk}
          showErr={showErr}
        />
      </View>
    </SafeAreaView>
  );
}
