import { useEffect } from 'react';
import { AppState, type AppStateStatus } from 'react-native';
import {
  isRemoteContentEnabled,
  refreshContentVersion,
  startContentPolling,
} from '../data/remoteConfig';

/**
 * 共有コンテンツの自動更新を有効にするルート用フック。
 * - 起動時: `_meta.json` の版数を確認し、在席中の定期ポーリングを開始する
 *   (15秒間隔 → 公開から30秒以内に反映)。
 * - フォアグラウンド復帰時: 即座に版数を強制確認する (バックグラウンド中に
 *   更新されていた分を開いた瞬間に取り込む)。
 * リモート無効時 (開発時の既定) は何もしない。
 */
export function useContentAutoRefresh(): void {
  useEffect(() => {
    if (!isRemoteContentEnabled()) return;
    const stopPolling = startContentPolling();
    const onChange = (state: AppStateStatus) => {
      if (state === 'active') void refreshContentVersion({ force: true });
    };
    const sub = AppState.addEventListener('change', onChange);
    return () => {
      sub.remove();
      stopPolling();
    };
  }, []);
}
