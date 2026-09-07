import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

export interface ClassContent {
  title: string;
  detail: string;
}

const titleAssets: Record<string, any> = {
  '1A': require('../../planning/1A/title.txt'),
  '1B': require('../../planning/1B/title.txt'),
  '1C': require('../../planning/1C/title.txt'),
};

const detailAssets: Record<string, any> = {
  '1A': require('../../planning/1A/detail.txt'),
  '1B': require('../../planning/1B/detail.txt'),
  '1C': require('../../planning/1C/detail.txt'),
};

async function loadTextFile(assetModule: any): Promise<string> {
  const asset = Asset.fromModule(assetModule);
  await asset.downloadAsync();
  const uri = asset.localUri ?? (asset as { uri?: string }).uri;
  if (!uri) return '';
  try {
    // Web: asset URI は相対パス (/assets/?unstable_path=...) のため fetch で読む。
    // fetch は相対 URL を同一オリジンとして解決できる。
    // ネイティブ: 従来どおり FileSystem で読む。
    if (Platform.OS === 'web') {
      const res = await fetch(uri);
      if (!res.ok) return '';
      return await res.text();
    }
    if (uri.startsWith('http://') || uri.startsWith('https://')) {
      const res = await fetch(uri);
      if (!res.ok) return '';
      return await res.text();
    }
    return await FileSystem.readAsStringAsync(uri);
  } catch {
    return '';
  }
}

export async function loadAllClassContent(): Promise<Record<string, ClassContent>> {
  const result: Record<string, ClassContent> = {};
  for (const className of ['1A', '1B', '1C']) {
    const [title, detail] = await Promise.all([
      loadTextFile(titleAssets[className]),
      loadTextFile(detailAssets[className]),
    ]);
    result[className] = { title: title.trim(), detail: detail.trim() };
  }
  return result;
}
