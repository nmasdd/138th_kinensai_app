import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { loadJSON, saveJSON } from './kvStore';

/**
 * お気に入り (企画ID) の端末個人データ。
 * 複数画面 (検索・校内マップ) で同じ状態を共有するため、
 * モジュールレベルのストア + useSyncExternalStore で同期する。
 * 永続化は kvStore 経由 (Web は localStorage、ネイティブは documentDirectory)。
 */

const FAVORITES_KEY = 'favorites.json';

interface FavoritesState {
  favorites: string[];
  loaded: boolean;
}

let state: FavoritesState = { favorites: [], loaded: false };
const listeners = new Set<() => void>();
let loading = false;

function emit(): void {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): FavoritesState {
  return state;
}

async function loadFavoritesOnce(): Promise<void> {
  if (loading || state.loaded) return;
  loading = true;
  try {
    const parsed = await loadJSON<unknown>(FAVORITES_KEY, null);
    const list = Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
    state = { favorites: list, loaded: true };
  } catch {
    state = { favorites: [], loaded: true };
  } finally {
    loading = false;
    emit();
  }
}

/** お気に入りの共有フック。全画面で同一の状態を参照し、更新は即時反映される。 */
export function useFavorites() {
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    loadFavoritesOnce();
  }, []);

  const toggle = useCallback((id: string) => {
    const prev = state.favorites;
    const next = prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id];
    state = { favorites: next, loaded: state.loaded };
    emit();
    saveJSON(FAVORITES_KEY, next).catch(() => {});
  }, []);

  const isFavorite = useCallback((id: string) => snap.favorites.includes(id), [snap.favorites]);

  return { favorites: snap.favorites, isFavorite, toggle, isLoading: !snap.loaded };
}
