import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { loadJSON, saveJSON } from '../data/kvStore';

/**
 * PWA (ホーム画面への追加) インストールの検知と状態管理。
 *
 * 挙動はブラウザで大きく異なる:
 * - Chrome 系 (Android / デスクトップ): `beforeinstallprompt` を保持できれば
 *   独自バナーのタップでブラウザ純正のインストール確認を出せる (prompt())。
 * - iOS Safari: `beforeinstallprompt` が無いため自動プロンプトは出せず、
 *   「共有 → ホーム画面に追加」の手順案内のみ (mode: 'ios')。
 * - その他 (Firefox 等): 同様に手順案内のみ (mode: 'manual')。
 *
 * `beforeinstallprompt` は React マウント前に発火しうるので、
 * `src/app/+html.tsx` の head スクリプトが window に保持した値と
 * カスタムイベント (`kinensai:installprompt` / `kinensai:installed`) を購読する。
 *
 * 一度「あとで」したら端末に記憶して自動表示しない (メニューからは手動で開ける)。
 * 端末保存は既存の kvStore (Web は localStorage) を使う。
 */

export type InstallMode = 'chromium' | 'ios' | 'manual';

export interface InstallState {
  /** バナーを表示するか。 */
  visible: boolean;
  /** 表示方法 (ブラウザ種別)。 */
  mode: InstallMode;
}

/** Chrome 系が発火するインストール可否イベント (DOM lib に無いため最小宣言)。 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

declare global {
  interface Window {
    __installPromptEvent?: BeforeInstallPromptEvent | null;
    __appInstalled?: boolean;
  }
}

const STORE_KEY = 'install-prompt.json';
const PROMPT_EVENT = 'kinensai:installprompt';
const INSTALLED_EVENT = 'kinensai:installed';
/** 起動直後の唐突な表示を避けるため、ホーム表示から少し待って出す。 */
export const AUTO_SHOW_DELAY_MS = 3000;

let state: InstallState = { visible: false, mode: 'manual' };
let dismissed = false;
let installed = false;
let ready = false;
let initPromise: Promise<void> | null = null;

const listeners = new Set<() => void>();

function setState(next: InstallState): void {
  if (next.visible === state.visible && next.mode === state.mode) return;
  state = next;
  listeners.forEach((listener) => listener());
}

export function subscribeInstall(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function getInstallState(): InstallState {
  return state;
}

export function isWeb(): boolean {
  return Platform.OS === 'web';
}

function userAgent(): string {
  if (typeof navigator === 'undefined') return '';
  return navigator.userAgent ?? '';
}

/** すでにインストール済み (standalone 起動) か。 */
export function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true;
  } catch {
    // matchMedia が無い環境 (ネイティブ等) は navigator 判定に進む
  }
  return (navigator as Navigator & { standalone?: boolean }).standalone === true;
}

/** iOS (Safari 系) か。iOS には beforeinstallprompt が無い。 */
export function isIos(): boolean {
  const ua = userAgent();
  if (/iphone|ipad|ipod/i.test(ua)) return true;
  // iPadOS 13+ は Mac を名乗るため、タッチ点数で判別する
  return /macintosh/i.test(ua) && typeof navigator !== 'undefined' && navigator.maxTouchPoints > 1;
}

/** LINE・Instagram 等のアプリ内ブラウザか (インストール不可)。 */
export function isInAppBrowser(): boolean {
  return /(line\/|fban|fbav|fb_iab|instagram|micromessenger|; wv\))/i.test(userAgent());
}

function deferredEvent(): BeforeInstallPromptEvent | null {
  if (typeof window === 'undefined') return null;
  return window.__installPromptEvent ?? null;
}

/** ブラウザが用意したインストール可否 (beforeinstallprompt) を保持しているか。 */
export function canPromptInstall(): boolean {
  return deferredEvent() !== null;
}

/** 自動バナーを出してよいか (standalone でなく、却下もされていない)。 */
export function isInstallAvailable(): boolean {
  return !isStandalone() && !installed && !dismissed;
}

function detectMode(): InstallMode {
  if (canPromptInstall()) return 'chromium';
  if (isIos()) return 'ios';
  return 'manual';
}

async function loadDismissed(): Promise<void> {
  if (ready) return;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      const stored = await loadJSON<{ dismissed?: boolean }>(STORE_KEY, {});
      dismissed = stored?.dismissed === true;
    } catch {
      dismissed = false;
    }
    if (typeof window !== 'undefined' && window.__appInstalled) installed = true;
    ready = true;
    if (dismissed || installed) setState({ visible: false, mode: state.mode });
  })();
  return initPromise;
}

async function persistDismissed(): Promise<void> {
  dismissed = true;
  try {
    await saveJSON(STORE_KEY, { dismissed: true });
  } catch {
    // 保存に失敗しても表示上の記憶 (dismissed) は有効
  }
}

/** バナーを表示する。dismissed/standalone のときは force 指定時のみ。 */
function showBanner(force = false): void {
  if (!force && (dismissed || installed || isStandalone())) return;
  setState({ visible: true, mode: detectMode() });
}

/** バナーを閉じる。「あとで」なので以後は自動表示しない。 */
export function dismissInstall(): void {
  setState({ visible: false, mode: state.mode });
  void persistDismissed();
}

/**
 * 実際にインストールを実行する。
 * - beforeinstallprompt があればブラウザ純正の確認を出す (Chrome 系)。
 * - 無ければ手順バナーを出す (iOS・その他)。
 */
export async function installNow(): Promise<void> {
  const event = deferredEvent();
  if (!event) {
    setState({ visible: true, mode: isIos() ? 'ios' : 'manual' });
    return;
  }
  let accepted = false;
  try {
    await event.prompt();
    const choice = await event.userChoice;
    accepted = choice.outcome === 'accepted';
  } catch {
    // プロンプトを出せなかった場合は手順案内へ切り替える
    setState({ visible: true, mode: isIos() ? 'ios' : 'manual' });
    return;
  }
  if (typeof window !== 'undefined') window.__installPromptEvent = null;
  if (accepted) installed = true;
  setState({ visible: false, mode: 'manual' });
  await persistDismissed();
}

/** メニューの「アプリをインストール」から呼ぶ。 */
export async function openInstallFromMenu(): Promise<void> {
  await loadDismissed();
  if (isStandalone()) return;
  if (canPromptInstall()) {
    await installNow();
    return;
  }
  // 却下済みでもユーザーが明示的に選んだので手順を表示する
  showBanner(true);
}

/**
 * 起動数秒後に自動表示する。Chrome は beforeinstallprompt の到着を待つ
 * (初回訪問では数秒遅れて届くことがある)。iOS はタイマー後に手順を出す。
 * 戻り値を effect のクリーンアップで呼ぶ。
 */
export function autoShowInstall(): () => void {
  if (typeof window === 'undefined' || !isInstallAvailable()) return () => {};
  const start = Date.now();
  let shown = false;
  const attempt = () => {
    if (shown || !isInstallAvailable()) return;
    if (canPromptInstall() || isIos()) {
      shown = true;
      showBanner();
      cleanup();
    }
  };
  const onReady = () => {
    if (Date.now() - start >= AUTO_SHOW_DELAY_MS) attempt();
  };
  const timer = setTimeout(attempt, AUTO_SHOW_DELAY_MS);
  const cleanup = () => {
    clearTimeout(timer);
    window.removeEventListener(PROMPT_EVENT, onReady);
  };
  window.addEventListener(PROMPT_EVENT, onReady);
  return () => {
    cleanup();
  };
}

/** appinstalled を監視し、バナーを閉じて以後表示しないようにする。 */
export function watchInstalled(): () => void {
  if (typeof window === 'undefined') return () => {};
  const onInstalled = () => {
    installed = true;
    setState({ visible: false, mode: state.mode });
    void persistDismissed();
  };
  window.addEventListener(INSTALLED_EVENT, onInstalled);
  return () => {
    window.removeEventListener(INSTALLED_EVENT, onInstalled);
  };
}

/** 端末に記憶した却下状態を読み込む (冪等)。 */
export async function initInstall(): Promise<void> {
  await loadDismissed();
}

/** React 用: インストール UI の状態を購読する。 */
export function useInstallState(): InstallState {
  return useSyncExternalStore(subscribeInstall, getInstallState, getInstallState);
}

/**
 * React 用: standalone (インストール済み) 起動かを購読する。
 * 初期描画 (SSR/ハイドレーション) は false を返し、クライアントで確定する。
 */
export function useIsStandalone(): boolean {
  return useSyncExternalStore(subscribeInstall, isStandalone, () => false);
}
