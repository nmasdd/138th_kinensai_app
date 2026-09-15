/**
 * PWA (ホーム画面に追加・オフライン起動) 用の Service Worker 登録。
 * 開発サーバーでは古いバンドルがキャッシュされて不具合の元になるため、
 * 本番ビルド (`!__DEV__`) の Web でのみ呼び出す。
 */
export function registerServiceWorker(): void {
  if (typeof navigator === 'undefined' || !('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('/sw.js').catch(() => {
    // 登録に失敗してもオンライン前提の動作には影響しない
  });
}
