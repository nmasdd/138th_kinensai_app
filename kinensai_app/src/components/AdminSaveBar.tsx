import React, { useCallback, useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { M3Button, type IconName } from './m3';
import { useM3 } from '../context/responsive';
import { m3, scaled, type M3Shape } from '../theme';

/**
 * 管理者サブページ共通の保存バー・ポップアップ。
 * - AdminSaveBar: 画面下部に固定表示する保存バー。保存対象ごとにボタンを並べる。
 * - AdminNotice + useAdminNotice: 成功時「保存されました」/失敗時「保存に失敗しました」を
 *   区別表示するポップアップ。追加・削除など即時保存の操作からも同じ表示を使う。
 */

export interface AdminNoticeData {
  ok: boolean;
  message: string;
}

type ButtonVariant = 'filled' | 'tonal' | 'outlined';

export interface AdminSaveAction {
  label: string;
  icon?: IconName;
  variant?: ButtonVariant;
  /** 成功時は表示メッセージ、失敗時は Error(メッセージ) を throw する */
  run: () => Promise<string | void>;
}

/** 固定フッターと重ならないよう ScrollView 側に開ける余白 */
export const ADMIN_FOOTER_SPACE = 132;

export function adminErrorMessage(e: unknown): string {
  return e instanceof Error && e.message ? e.message : '保存に失敗しました';
}

export function useAdminNotice(timeoutMs = 3000) {
  const [notice, setNotice] = useState<AdminNoticeData | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  const show = useCallback(
    (ok: boolean, message: string) => {
      if (timer.current) clearTimeout(timer.current);
      setNotice({ ok, message });
      timer.current = setTimeout(() => setNotice(null), timeoutMs);
    },
    [timeoutMs],
  );
  const showOk = useCallback((message: string) => show(true, message), [show]);
  const showErr = useCallback((message: string) => show(false, message), [show]);
  return { notice, showOk, showErr };
}

/** 画面上部に重ねて表示する保存結果ポップアップ。3秒で自動的に消える。 */
export function AdminNotice({ notice }: { notice: AdminNoticeData | null }) {
  const { type } = useM3();
  const styles = useStyles();
  if (!notice) return null;
  return (
    <View style={styles.noticeWrap} pointerEvents="none">
      <View style={[styles.notice, notice.ok ? styles.noticeOk : styles.noticeErr]}>
        <Text style={[type.bodyMedium, { color: notice.ok ? m3.onPrimaryContainer : m3.onErrorContainer }]}>
          {notice.message}
        </Text>
      </View>
    </View>
  );
}

/** 画面下部に固定表示する保存バー。保存対象ごとにボタンを1本のバーに集約する。 */
export function AdminSaveBar({
  actions,
  showOk,
  showErr,
}: {
  actions: AdminSaveAction[];
  showOk: (message: string) => void;
  showErr: (message: string) => void;
}) {
  const styles = useStyles();
  const [busy, setBusy] = useState<number | null>(null);

  const press = async (index: number) => {
    if (busy !== null) return;
    setBusy(index);
    try {
      const message = await actions[index].run();
      showOk(typeof message === 'string' && message ? message : '保存されました');
    } catch (e) {
      showErr(adminErrorMessage(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.bar}>
      {actions.map((a, i) => (
        <View key={a.label} style={styles.actionWrap}>
          <M3Button
            label={busy === i ? '保存中…' : a.label}
            icon={a.icon ?? 'save'}
            variant={a.variant ?? 'filled'}
            onPress={() => press(i)}
          />
        </View>
      ))}
    </View>
  );
}

function createStyles(s: number, shape: M3Shape) {
  return StyleSheet.create({
    noticeWrap: {
      position: 'absolute',
      top: scaled(8, s),
      left: scaled(16, s),
      right: scaled(16, s),
    },
    notice: {
      borderRadius: shape.card,
      padding: scaled(12, s),
    },
    noticeOk: {
      backgroundColor: m3.primaryContainer,
    },
    noticeErr: {
      backgroundColor: m3.errorContainer,
    },
    bar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: 0,
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: scaled(8, s),
      padding: scaled(12, s),
      backgroundColor: m3.surface,
      borderTopWidth: 1,
      borderTopColor: m3.outlineVariant,
    },
    actionWrap: {
      flex: 1,
      minWidth: scaled(200, s),
    },
  });
}

function useStyles() {
  const { scale, shape } = useM3();
  return React.useMemo(() => createStyles(scale, shape), [scale, shape]);
}
