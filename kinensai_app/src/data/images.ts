import { Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import * as ImagePicker from 'expo-image-picker';

/**
 * 管理者ページ用の画像共通処理。
 * 画像選択→保存→URI取得をまとめ、呼び出し側は返ったURIを
 * 各モデル (クラス上書き/有志/通知/出演団体) の imageUri に入れて保存する。
 *
 * 保存方式: ネイティブは端末ファイルにコピーした file:// URI、
 * Web は kvStore にそのまま入る dataURL。
 */

const IMAGE_DIR_SUFFIX = 'images/';

async function ensureImageDir(): Promise<string | null> {
  const dir = FileSystem.documentDirectory;
  if (!dir) return null;
  const target = dir + IMAGE_DIR_SUFFIX;
  try {
    const info = await FileSystem.getInfoAsync(target);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(target, { intermediates: true });
    }
    return target;
  } catch {
    return null;
  }
}

function extOf(uri: string): string {
  const m = uri.split('?')[0].match(/\.([a-zA-Z0-9]+)$/);
  if (m && /^(jpe?g|png|webp|gif|heic)$/i.test(m[1])) return `.${m[1].toLowerCase()}`;
  return '.jpg';
}

async function toDataUrl(uri: string): Promise<string> {
  const res = await fetch(uri);
  const blob = await res.blob();
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.readAsDataURL(blob);
  });
}

/**
 * 端末の画像ライブラリから1枚選び、保存してURIを返す。
 * キャンセル時は null。Expo Go 対応の範囲のみ使う。
 */
export async function pickImageUri(): Promise<string | null> {
  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: ['images'],
    quality: 0.7,
  });
  if (result.canceled) return null;
  const asset = result.assets?.[0];
  if (!asset?.uri) return null;
  if (Platform.OS === 'web') {
    try {
      return await toDataUrl(asset.uri);
    } catch {
      return asset.uri;
    }
  }
  try {
    const dir = await ensureImageDir();
    if (!dir) return asset.uri;
    const dest = `${dir}img-${Date.now()}${extOf(asset.uri)}`;
    await FileSystem.copyAsync({ from: asset.uri, to: dest });
    return dest;
  } catch {
    return asset.uri;
  }
}

/**
 * 保存した画像ファイルを消す (端末ファイルの場合のみ)。
 * dataURL や端末外の URI は何もしない。
 */
export async function deleteStoredImage(uri: string | null | undefined): Promise<void> {
  if (!uri || Platform.OS === 'web') return;
  try {
    const dir = FileSystem.documentDirectory;
    if (!dir || !uri.startsWith(dir)) return;
    const info = await FileSystem.getInfoAsync(uri);
    if (info.exists) await FileSystem.deleteAsync(uri);
  } catch {
    // 削除失敗は無視する
  }
}
