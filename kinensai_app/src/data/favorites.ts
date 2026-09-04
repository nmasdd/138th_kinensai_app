import { useCallback, useEffect, useState } from 'react';
import * as FileSystem from 'expo-file-system/legacy';

const FAVORITES_FILE = `${FileSystem.documentDirectory}favorites.json`;

async function readFavorites(): Promise<string[]> {
  if (!FileSystem.documentDirectory) return [];
  try {
    const info = await FileSystem.getInfoAsync(FAVORITES_FILE);
    if (!info.exists) return [];
    const raw = await FileSystem.readAsStringAsync(FAVORITES_FILE);
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

export function useFavorites() {
  const [favorites, setFavorites] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    readFavorites()
      .then(setFavorites)
      .finally(() => setIsLoading(false));
  }, []);

  useEffect(() => {
    if (isLoading || !FileSystem.documentDirectory) return;
    FileSystem.writeAsStringAsync(FAVORITES_FILE, JSON.stringify(favorites), {
      encoding: FileSystem.EncodingType.UTF8,
    }).catch(() => {});
  }, [favorites, isLoading]);

  const toggle = useCallback((id: string) => {
    setFavorites((prev) => (prev.includes(id) ? prev.filter((f) => f !== id) : [...prev, id]));
  }, []);

  const isFavorite = useCallback((id: string) => favorites.includes(id), [favorites]);

  return { favorites, isFavorite, toggle, isLoading };
}
