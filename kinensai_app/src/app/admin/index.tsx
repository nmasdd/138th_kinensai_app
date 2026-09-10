import React, { useMemo, useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { M3Button, M3ListItem, M3SearchBar, TopAppBar, goBackOrHome, type IconName } from '../../components/m3';
import { AdminPublishNote, AdminGate } from '../../components/AdminGuard';
import { adminStyles } from '../../components/adminUi';
import { m3, m3type } from '../../theme';

/**
 * 管理者用目次 (/admin)。直接アクセス専用でタブ・メニューに入口は置かない。
 * 各サブページへのリンク集。検索窓でリンク先を絞り込める。
 */

interface AdminLink {
  href: '/admin/class' | '/admin/volunteer' | '/admin/notifications' | '/admin/stage' | '/admin/picks' | '/admin/data';
  icon: IconName;
  title: string;
  sub: string;
}

const LINKS: AdminLink[] = [
  { href: '/admin/class', icon: 'school', title: 'クラス企画', sub: 'タイトル・説明・場所・整理券・画像の編集とカスタム追加' },
  { href: '/admin/volunteer', icon: 'groups', title: '有志企画', sub: '教室有志企画の追加・編集・削除' },
  { href: '/admin/notifications', icon: 'notifications', title: '通知', sub: '通知の追加・削除' },
  { href: '/admin/stage', icon: 'mic', title: 'ステージ・講堂', sub: '出演団体・タイムテーブル・遅延・いま開催中・混雑' },
  { href: '/admin/picks', icon: 'star', title: 'おすすめ企画', sub: 'ホームに表示する企画の選択・並び替え' },
  { href: '/admin/data', icon: 'storage', title: 'データ管理', sub: '全データの書き出し・取り込み (バックアップ・移行用)' },
];

export default function AdminIndexScreen() {
  return (
    <AdminGate>
      <AdminIndexContent />
    </AdminGate>
  );
}

function AdminIndexContent() {
  const [query, setQuery] = useState('');

  const visible = useMemo(() => {
    const q = query.trim();
    if (!q) return LINKS;
    return LINKS.filter((l) => `${l.title} ${l.sub}`.includes(q));
  }, [query]);

  return (
    <SafeAreaView style={adminStyles.container} edges={['top']}>
      <TopAppBar title="管理者用" />
      <ScrollView contentContainerStyle={adminStyles.body}>
        <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>
          /admin の直接アクセス専用ページです。各画面の保存はこの端末のプレビューとして即反映されます。全世界へ反映するには「データ管理」の公開手順を使ってください。
        </Text>
        <AdminPublishNote />
        <View style={adminStyles.searchWrap}>
          <M3SearchBar value={query} onChangeText={setQuery} placeholder="管理メニューを検索" />
        </View>
        {visible.map((l, i) => (
          <M3ListItem
            key={l.href}
            icon={l.icon}
            title={l.title}
            sub={l.sub}
            onPress={() => router.push(l.href)}
            position={visible.length === 1 ? 'single' : i === 0 ? 'top' : i === visible.length - 1 ? 'bottom' : 'middle'}
          />
        ))}
        {visible.length === 0 ? (
          <Text style={[m3type.bodyMedium, { color: m3.onSurfaceVariant }]}>一致するメニューはありません</Text>
        ) : null}
        <View style={adminStyles.backWrap}>
          <M3Button label="戻る" icon="undo" onPress={() => goBackOrHome()} />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
