import { Asset } from 'expo-asset';
import * as FileSystem from 'expo-file-system/legacy';

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
  if (!asset.localUri) return '';
  return await FileSystem.readAsStringAsync(asset.localUri);
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
