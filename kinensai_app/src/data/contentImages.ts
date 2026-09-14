import { Image } from 'react-native';
import { CONTENT_IMAGES } from './bundled/content-images';

/**
 * 同梱の企画・出演団体写真 (bundled/content-images.ts) を表示用URIに解決する。
 * 管理者が登録した imageUri が無い場合のフォールバックとして使う。
 */
export function resolveContentImageUri(id: string): string | null {
  const mod = CONTENT_IMAGES[id] as unknown;
  if (mod == null) return null;
  if (typeof mod === 'string') return mod;
  const anyMod = mod as { uri?: string; default?: { uri?: string } };
  if (typeof anyMod.uri === 'string') return anyMod.uri;
  if (typeof anyMod.default?.uri === 'string') return anyMod.default.uri;
  try {
    const resolved = Image.resolveAssetSource(mod as number);
    return resolved?.uri ?? null;
  } catch {
    return null;
  }
}

export function withContentImage<T extends { id: string; imageUri?: string | null }>(item: T): T {
  if (item.imageUri) return item;
  const uri = resolveContentImageUri(item.id);
  return uri ? { ...item, imageUri: uri } : item;
}
