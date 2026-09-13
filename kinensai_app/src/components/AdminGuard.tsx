import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { Platform, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { M3Button, M3Icon, TopAppBar } from './m3';
import { useAdminStyles } from './adminUi';
import { getContentUrl, isRemoteContentConfigured, isRemoteContentEnabled } from '../data/remoteConfig';
import { m3, scaled } from '../theme';
import { useM3 } from '../context/responsive';

// NOTE: getContentUrl は remoteConfig 側にあるためここでは再exportしない。
// このファイルは管理者ページ用の公開フロー案内バナー専用である。

/**
 * 管理者ページ用の公開フロー案内バナー (ブロックしない)。
 * 「保存はこの端末のプレビュー。全世界への反映はデータ管理の全世界に公開」
 * を明示する。
 */
export function AdminPublishNote() {
  const { type, scale } = useM3();
  const configured = isRemoteContentConfigured();
  const enabled = isRemoteContentEnabled();
  return (
    <View
      style={{
        backgroundColor: m3.primaryContainer,
        borderRadius: scaled(20, scale),
        padding: scaled(12, scale),
        flexDirection: 'row',
        gap: scaled(8, scale),
        alignItems: 'flex-start',
      }}
      accessibilityRole="none"
      accessibilityLabel="公開フロー案内"
    >
      <M3Icon name={enabled ? 'public' : 'science'} size={20} color={m3.onPrimaryContainer} />
      <View style={{ flex: 1, gap: scaled(4, scale) }}>
        <Text style={[type.titleSmall, { color: m3.onPrimaryContainer }]}>
          {enabled ? (configured ? '全世界配信: 設定済み' : '全世界配信: 未設定') : '開発モード: 配信オフ'}
        </Text>
        <Text style={[type.bodyMedium, { color: m3.onPrimaryContainer }]}>
          {!enabled
            ? `開発中は本番の配信値を読み込みません (同梱値のみ)。各画面の保存はこの端末のプレビューです。配信値を確認するには EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1 で起動してください。`
            : configured
              ? `各画面の保存はこの端末のプレビューです。「データ管理」の「全世界に公開」で全端末に反映されます (開いている端末は30秒以内、復帰時に即時)。`
              : `各画面の保存はこの端末のプレビューです。全端末へ反映するには、配信URL (extra.contentUrl) の設定が必要です。`}
        </Text>
      </View>
    </View>
  );
}

export { getContentUrl };

/**
 * 管理者ページ用のパスワードゲート (サーバ認証)。
 * パスワードはクライアントに保持せず、Worker の POST /api/admin/login で検証する。
 * 成功時に返る署名付きトークン (12時間有効) をメモリ (+Web は sessionStorage) に保持し、
 * 起動時は POST /api/admin/verify で有効性を確認する。
 */
const TOKEN_STORAGE_KEY = 'kinensai:adminToken';
/** ネイティブ (Expo Go/開発ビルド) には同一オリジンがないため本番URLへ向ける。 */
const ADMIN_API_BASE = Platform.OS === 'web' ? '' : 'https://app.kinensai.jp';

/** 管理者APIの起点 (/admin/data の公開処理から使う)。 */
export function getAdminApiBase(): string {
  return ADMIN_API_BASE;
}

/** 認証済みの管理者トークン (未認証なら null)。公開処理の署名に使う。 */
export function getAdminToken(): string | null {
  return adminToken;
}

let adminToken: string | null = null;
const adminAuthListeners = new Set<() => void>();

function subscribeAdminAuth(cb: () => void): () => void {
  adminAuthListeners.add(cb);
  return () => {
    adminAuthListeners.delete(cb);
  };
}

function getAdminAuthSnapshot(): boolean {
  return adminToken !== null;
}

function getAdminAuthServerSnapshot(): boolean {
  return false;
}

function notifyAdminAuth(): void {
  adminAuthListeners.forEach((cb) => cb());
}

function readStoredToken(): string | null {
  if (Platform.OS !== 'web') return null;
  try {
    if (typeof window === 'undefined' || !window.sessionStorage) return null;
    return window.sessionStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function persistToken(token: string | null): void {
  adminToken = token;
  if (Platform.OS === 'web') {
    try {
      if (typeof window !== 'undefined' && window.sessionStorage) {
        if (token) window.sessionStorage.setItem(TOKEN_STORAGE_KEY, token);
        else window.sessionStorage.removeItem(TOKEN_STORAGE_KEY);
      }
    } catch {}
  }
  notifyAdminAuth();
}

async function postAdminApi(path: string, payload: unknown): Promise<unknown | null> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 10000);
  try {
    const res = await fetch(`${ADMIN_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(payload),
      signal: ctrl.signal,
    });
    try {
      return (await res.json()) as unknown;
    } catch {
      return null;
    }
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * 【開発補助】管理者ページのパスワード認証をスキップする。
 * - 本番ビルド (`__DEV__ === false`) では常に認証必須。
 * - 開発時も既定では認証必須。ローカルで認証APIを用意せず確認したい場合だけ
 *   `EXPO_PUBLIC_ADMIN_BYPASS=1` を付けて起動する
 *   (例: `EXPO_PUBLIC_ADMIN_BYPASS=1 npm run web`)。
 * - 誤って本番で無効化されることがないよう、フラグは環境変数のみで判定する。
 */
const ADMIN_BYPASS_PASSWORD =
  (() => {
    if (!__DEV__) return false;
    try {
      const v = (process.env?.EXPO_PUBLIC_ADMIN_BYPASS ?? '').trim();
      return v === '1' || v === 'true';
    } catch {
      return false;
    }
  })();

/** 全 /admin/* ページをラップし、未認証ならパスワード入力を先に表示する。 */
export function AdminGate({ children }: { children: React.ReactNode }) {
  if (ADMIN_BYPASS_PASSWORD) return <>{children}</>;
  return <AdminGateLocked>{children}</AdminGateLocked>;
}

function AdminGateLocked({ children }: { children: React.ReactNode }) {
  const { type } = useM3();
  const styles = useAdminStyles();
  const unlocked = useSyncExternalStore(
    subscribeAdminAuth,
    getAdminAuthSnapshot,
    getAdminAuthServerSnapshot,
  );
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  const [checking, setChecking] = useState(() => !getAdminAuthSnapshot() && readStoredToken() !== null);

  useEffect(() => {
    if (getAdminAuthSnapshot()) return;
    const stored = readStoredToken();
    if (!stored) return;
    let cancelled = false;
    (async () => {
      const res = (await postAdminApi('/api/admin/verify', { token: stored })) as {
        ok?: unknown;
      } | null;
      if (cancelled) return;
      if (res?.ok === true) {
        adminToken = stored;
        notifyAdminAuth();
      } else {
        persistToken(null);
      }
      setChecking(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (unlocked) return <>{children}</>;

  if (checking) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <TopAppBar title="管理者用" />
        <View style={styles.body}>
          <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>認証を確認しています…</Text>
        </View>
      </SafeAreaView>
    );
  }

  const submit = async () => {
    if (busy) return;
    if (!password) {
      setError('パスワードを入力してください');
      return;
    }
    setBusy(true);
    setError('');
    const res = (await postAdminApi('/api/admin/login', { password })) as {
      ok?: unknown;
      token?: unknown;
    } | null;
    setBusy(false);
    if (res?.ok === true && typeof res.token === 'string' && res.token) {
      setPassword('');
      persistToken(res.token);
    } else if (res === null) {
      setError('サーバに接続できませんでした。時間をおいて試してください');
    } else {
      setError('パスワードが正しくありません');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <TopAppBar title="管理者用" />
      <View style={styles.body}>
        <Text style={[type.bodyMedium, { color: m3.onSurfaceVariant }]}>
          管理者用ページです。続けるにはパスワードを入力してください。
        </Text>
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={(v) => {
            setPassword(v);
            if (error) setError('');
          }}
          placeholder="パスワード"
          placeholderTextColor={m3.onSurfaceVariant}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          onSubmitEditing={submit}
          accessibilityLabel="管理者パスワード"
        />
        {error ? <Text style={[type.bodyMedium, { color: m3.error }]}>{error}</Text> : null}
        <M3Button label={busy ? '認証中…' : '認証'} icon="lock" onPress={submit} />
      </View>
    </SafeAreaView>
  );
}
