/**
 * 校内QRコードの現在地表現。
 *
 * 廊下などに貼る QR には `/map?floor=<n>&x=<0-1>&y=<0-1>` を含む URL を
 * 符号化する。アプリのカメラで読み取ると該当階の座標に青い現在地ドットを
 * 表示する。汎用カメラアプリで読んだ場合も同じ URL を開けば Web アプリが
 * 現在地を表示できる。
 */

/** QR に書き込む URL の基点 (本番公開ドメイン)。 */
export const LOCATION_BASE_URL = 'https://app.kinensai.jp';

/** フロア index (0〜3) に対応する階トークン。4 は「4階 5階」。 */
export const FLOOR_TOKENS = ['1', '2', '3', '4'] as const;

/** "1"〜"5"/"1F" などの階指定をフロア index (0〜3) に変換する。無効時は -1。 */
export function floorTokenToIndex(v?: string | null): number {
  if (!v) return -1;
  const m = v.normalize('NFKC').match(/[1-5]/);
  if (!m) return -1;
  const n = parseInt(m[0], 10);
  return n <= 1 ? 0 : n === 2 ? 1 : n === 3 ? 2 : 3;
}

function round3(v: number): number {
  return Math.round(v * 1000) / 1000;
}

/** `/map?floor=..&x=..&y=..` の相対パスを組み立てる (x,y は 0〜1 の相対座標)。 */
export function buildLocationPath(floorIndex: number, x: number, y: number): string {
  const i = Math.max(0, Math.min(FLOOR_TOKENS.length - 1, Math.floor(floorIndex)));
  return `/map?floor=${FLOOR_TOKENS[i]}&x=${round3(x)}&y=${round3(y)}`;
}

/** QR に符号化する絶対 URL を組み立てる。 */
export function buildLocationUrl(floorIndex: number, x: number, y: number): string {
  return `${LOCATION_BASE_URL}${buildLocationPath(floorIndex, x, y)}`;
}

export interface ParsedLocation {
  /** 指定階 (0〜3)。未指定なら -1。x,y は 0〜1 の相対座標。 */
  floorIndex: number;
  x: number;
  y: number;
}

function queryParam(data: string, key: string): string | null {
  const m = new RegExp(`[?&]${key}=([^&]*)`).exec(data);
  return m ? decodeURIComponent(m[1]) : null;
}

/**
 * QR 文字列から現在地を解釈する。`/map` と `x`,`y` を含む場合のみ有効。
 * floor がなければ floorIndex=-1 (階は呼び出し側の現状を維持)。
 */
export function parseLocationQr(data: string): ParsedLocation | null {
  if (!data) return null;
  if (data.indexOf('?') < 0) return null;
  if (!/\/map(?:\b|\/|\?)/.test(data)) return null;
  const x = parseFloat(queryParam(data, 'x') ?? '');
  const y = parseFloat(queryParam(data, 'y') ?? '');
  if (!Number.isFinite(x) || !Number.isFinite(y) || x < 0 || y < 0) return null;
  return { floorIndex: floorTokenToIndex(queryParam(data, 'floor')), x, y };
}
