import { useCallback, useEffect, useRef, useState } from 'react';
import { useFocusEffect } from 'expo-router';
import { subscribeContentUpdate } from '../data/remoteConfig';

/**
 * 共有コンテンツの版数が更新されるたびに増える値を返す。
 * `useContentEffect` と併用して、公開の反映 (30秒以内) で画面を再読込させる。
 */
export function useContentRefreshKey(): number {
  const [key, setKey] = useState(0);
  useEffect(() => subscribeContentUpdate(() => setKey((k) => k + 1)), []);
  return key;
}

/**
 * 「画面フォーカス時」と「共有コンテンツ更新時」の両方で `effect` を実行する。
 *
 * React Navigation の `useFocusEffect` は、画面が表示されたまま依存が変わっても
 * 再実行されないことがあるため、更新通知を確実に拾うために `contentKey` の
 * 変化を監視する `useEffect` を併用する (初回は useFocusEffect に任せる)。
 *
 * `effect` は最新の値を参照しつつ、依存は `deps` と `contentKey` のみで管理する。
 *
 * @param effect 実行したい処理。クリーンアップ関数を返してよい。
 * @param deps effect の依存 (contentKey は内部で自動追加される)。
 */
export function useContentEffect(
  effect: () => void | (() => void),
  deps: React.DependencyList = [],
): void {
  const contentKey = useContentRefreshKey();
  const effectRef = useRef(effect);

  // 最新の effect を保持する (レンダー中ではなく effect 内で更新する)
  useEffect(() => {
    effectRef.current = effect;
  });

  // フォーカス時 (画面に戻ったときに再読込)
  useFocusEffect(
    useCallback(() => effectRef.current(), []),
  );

  // 表示中のコンテンツ更新時 (初回は useFocusEffect が扱うためスキップ)
  const firstContentRef = useRef(true);
  useEffect(() => {
    if (firstContentRef.current) {
      firstContentRef.current = false;
      return;
    }
    return effectRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [contentKey]);

  // deps の変化 (URL パラメータ・フィルタ等) でも再実行する
  const firstDepsRef = useRef(true);
  useEffect(() => {
    if (firstDepsRef.current) {
      firstDepsRef.current = false;
      return;
    }
    return effectRef.current();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}
