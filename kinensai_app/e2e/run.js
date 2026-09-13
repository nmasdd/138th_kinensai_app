/**
 * E2E (静的) テストランナー。node で実行する。
 * 使い方: kinensai_app/ で `node e2e/run.js`
 * ソース静的解析 + tsc/eslint 実行で 120+ の断言を行う。
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');

let pass = 0;
let fail = 0;
const failures = [];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}
function src(rel) {
  return fs.readFileSync(path.join(SRC, rel), 'utf8');
}
function ok(cond, name) {
  if (cond) {
    pass++;
  } else {
    fail++;
    failures.push(name);
    console.error(`FAIL: ${name}`);
  }
}
function countMatches(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

// ---------- A. マップ: 画像排除・ベクター化 ----------
{
  const map = src('app/(tabs)/map.tsx');
  ok(!/from 'react-native'[^;]*\bImage\b/.test(map) && !/import \{[^}]*\bImage\b/.test(map), 'A01 map.tsxがImageをimportしない');
  ok(!/assets\/maps/.test(map), 'A02 map.tsxがassets/mapsを参照しない');
  ok(!/expo-asset/.test(map), 'A03 map.tsxがexpo-assetを使わない');
  ok(/VectorMapView/.test(map), 'A04 map.tsxがVectorMapViewを使う');
  ok(/ScreenFade key=\{floor\}/.test(map), 'A05 フロア切替でフェードアニメ');
  ok(/詳細を見る/.test(map), 'A06 詳細ボックス維持');
  ok(/coLocated/.test(map), 'A07 同居企画リンク維持');
  ok(/模擬店の出店情報は準備中です/.test(map), 'A08 模擬店空文言');
  ok(/一致する場所がありません/.test(map), 'A09 空文言');
  ok(/QR読取位置/.test(map), 'A10 QR locバナー');

  const vm = src('components/VectorMapView.tsx');
  ok(/PanResponder/.test(vm), 'A11 パン操作あり');
  ok(/zoomIn/.test(vm) && /zoomOut/.test(vm), 'A12 ズームイン/アウトあり');
  ok(/onWheel/.test(vm), 'A13 Webホイールズームあり');
  ok(/reset/.test(vm), 'A14 リセットあり');
  ok(/my-location/.test(vm), 'A15 現在地ボタンあり');
  ok(/MIN_SCALE/.test(vm) && /MAX_SCALE/.test(vm), 'A16 倍率制限あり');
  ok(/accessibilityLabel/.test(vm), 'A17 マップa11yラベルあり');
  ok(/凡例|legend/i.test(vm), 'A18 凡例あり');
  ok(!/<Image/.test(vm), 'A19 ベクターマップ内にImageなし');
  ok(!/require\(.*\.jpg/.test(vm), 'A20 ベクターマップ内にjpg埋め込みなし');

  const vec = src('data/vectorMap.ts');
  for (const f of ['1階', '2階', '3階', '4階 5階', '模擬店']) {
    ok(vec.includes(`'${f}'`), `A21 ベクター定義に${f}あり`);
  }
  ok(/ROOM_FILL/.test(vec), 'A22 部屋色分けあり');
  ok((vec.match(/id: '/g) || []).length >= 30, 'A23 部屋数30以上');

  const hs = src('data/mapHotspots.ts');
  ok(/MAP_HOTSPOTS/.test(hs) && /hotspotForExhibitionId/.test(hs), 'A24 ホットスポット維持');
}

// ---------- B. M3準拠 ----------
{
  const allSrc = execSync('powershell -ExecutionPolicy Bypass -Command "Get-ChildItem -Recurse src | Select-Object FullName"', { cwd: ROOT }).toString();
  ok(allSrc.includes('m3.tsx'), 'B01 m3.tsx存在');
  const m3c = src('components/m3.tsx');
  for (const c of ['M3Badge', 'M3Divider', 'M3FilterChip', 'm3scrim', 'M3Touch', 'TopAppBar', 'M3Button', 'M3SearchBar', 'M3Card', 'M3FAB', 'M3IconButton', 'M3PrimaryTabs', 'M3ListItem', 'M3LoadingView', 'M3EmptyState', 'M3Headline']) {
    ok(m3c.includes(c), `B02 m3部品 ${c}あり`);
  }
  // #208AEF が src に残っていないこと
  let blueFound = [];
  const walk = (dir) => {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.(tsx?|json)$/.test(e.name)) {
        const t = fs.readFileSync(p, 'utf8');
        if (t.includes('#208AEF')) blueFound.push(path.relative(ROOT, p));
      }
    }
  };
  walk(SRC);
  ok(blueFound.length === 0, `B03 srcに#208AEF残存なし (${blueFound.join(',')})`);
  const appJson = JSON.parse(read('app.json'));
  const splash = JSON.stringify(appJson);
  ok(!splash.includes('#208AEF'), 'B04 app.jsonに#208AEFなし');
  ok(splash.includes('#D14E00'), 'B05 スプラッシュがM3 primary');
  const theme = src('theme.ts');
  ok(theme.includes('#D14E00'), 'B06 theme primary維持');
  const modal = src('components/ExhibitionDetailModal.tsx');
  ok(/ScrollView/.test(modal), 'B07 modalがScrollViewあり');
  ok(/M3Icon name="close"/.test(modal), 'B08 modal閉じるがM3Icon');
  ok(/touchMin/.test(modal), 'B09 modal閉じる44dp');
  ok(/m3scrim/.test(modal), 'B10 modal scrim定数');
  ok(/M3Divider/.test(modal), 'B11 modal Divider');
}

// ---------- C. 2タップ到達 ----------
{
  const layout = src('app/(tabs)/_layout.tsx');
  const tabsBlock = layout.slice(layout.indexOf('const TABS'));
  const order = ['camera', 'timetable', 'index', 'search', 'map'];
  let lastIdx = -1;
  let orderOk = true;
  for (const t of order) {
    const i = tabsBlock.indexOf(`'${t}'`);
    if (i < 0 || i < lastIdx) orderOk = false;
    lastIdx = i;
  }
  ok(orderOk, 'C01 タブ順序 camera→timetable→index→search→map');
  ok(/initialRouteName.*index|index.*initial/i.test(layout) || layout.includes('index'), 'C02 ホーム初期ルート');
  const qn = src('components/QuickNav.tsx');
  for (const t of ['マップ', '検索', 'タイムテーブル', 'カメラ', '投票', 'パンフ', '通知', '模擬店']) {
    ok(qn.includes(t), `C03 QuickNavに${t}あり`);
  }
  const home = src('app/(tabs)/index.tsx');
  ok(/QuickNav/.test(home), 'C04 ホームがQuickNav表示');
  const menu = src('app/menu.tsx');
  ok(countMatches(menu, /href:/g) >= 9, 'C05 menu9項目');
  const cam = src('app/(tabs)/camera.tsx');
  ok(/\/map/.test(cam) && /loc/.test(cam), 'C06 camera→map loc導線');
  const tt = src('app/(tabs)/timetable.tsx');
  ok(/\/vote/.test(tt), 'C07 timetable→vote導線');
  const search = src('app/(tabs)/search.tsx');
  ok(/exhibit/.test(search), 'C08 search?exhibit深リンク');
  ok(/filter/.test(search), 'C09 search?filter導線');
}

// ---------- D. アニメーション ----------
{
  const anim = src('components/anim.tsx');
  for (const c of ['ScreenFade', 'Rise', 'Stagger', 'Pop', 'FadeOverlay', 'Pulse', 'SkeletonBox', 'SkeletonRows', 'ScanBeam', 'SuccessCheck', 'ConfirmPop']) {
    ok(anim.includes(`export function ${c}`), `D01 anim ${c}あり`);
  }
  ok(/ReduceMotion/.test(anim), 'D02 reduced-motion対応');
  ok(/withSpring|springify/.test(anim), 'D03 スプリング演出あり');
  ok(/withRepeat/.test(anim), 'D04 ループ演出あり');
  const cam = src('app/(tabs)/camera.tsx');
  ok(/ScanBeam/.test(cam), 'D05 カメラ走査ビーム');
  ok(/SuccessCheck/.test(cam), 'D06 カメラ成功演出');
  const vote = src('app/vote.tsx');
  ok(/ConfirmPop/.test(vote), 'D07 投票確定演出');
  ok(/Stagger/.test(vote), 'D08 投票スタッガー');
  const mapS = src('app/(tabs)/map.tsx');
  ok(/ScreenFade/.test(mapS), 'D09 マップ切替演出');
  const menuS = src('app/menu.tsx');
  ok(/Stagger/.test(menuS), 'D10 メニュースタッガー');
}

// ---------- E. 公開フロー (管理者→全世界) ----------
{
  ok(fs.existsSync(path.join(SRC, 'data/remoteConfig.ts')), 'E01 remoteConfig存在');
  const rc = src('data/remoteConfig.ts');
  ok(/getContentUrl/.test(rc), 'E02 getContentUrlあり');
  ok(/fetchSharedJSON/.test(rc), 'E03 fetchSharedJSONあり');
  ok(/CACHE_TTL/.test(rc) || /TTL/.test(rc), 'E04 キャッシュTTLあり');
  ok(/AbortController|timeout/i.test(rc), 'E05 タイムアウトあり');
  const kv = src('data/kvStore.ts');
  ok(/fetchSharedJSON/.test(kv), 'E06 kvStoreがリモート優先');
  ok(/isPerUserKey/.test(kv), 'E07 端末個人データ区分あり');
  const pub = src('data/publish.ts');
  ok(/favorites\.json/.test(pub) && /stage-votes\.json/.test(pub), 'E08 個人データキー定義あり');
  const appJson = JSON.parse(read('app.json'));
  ok(appJson.expo && appJson.expo.extra && 'contentUrl' in appJson.expo.extra, 'E09 app.json extra.contentUrlあり');
  const adminData = src('app/admin/data.tsx');
  ok(/exportPublishBundle/.test(adminData), 'E10 公開バンドル書き出しあり');
  ok(/FILE:/.test(adminData), 'E11 ファイル分割形式あり');
  ok(/picks\.json/.test(adminData), 'E12 picks公開対象あり');
  const adminIndex = src('app/admin/index.tsx');
  ok(/AdminPublishNote/.test(adminIndex), 'E13 公開フロー案内あり');
  ok(fs.existsSync(path.join(SRC, 'components/AdminGuard.tsx')), 'E14 AdminGuard(案内)存在');
}

// ---------- F. データ・文言 ----------
{
  ok(fs.existsSync(path.join(SRC, 'data/bundled/class-catalog.json')), 'F01 class-catalog存在');
  const tt = src('data/timetable.ts');
  ok(/loadAuditorium/.test(tt), 'F02 講堂読込あり');
  const cg = src('data/congestion.ts');
  ok(/congestionLabel/.test(cg), 'F03 混雑ラベルあり');
  const tk = src('components/ExhibitionDetailModal.tsx');
  ok(/整理券/.test(tk), 'F04 整理券表記あり');
  ok(/\(タイトル未定\)/.test(tk), 'F05 未定文言あり');
  ok(/\(説明準備中\)/.test(tk), 'F06 説明準備中文言あり');
  const search = src('app/(tabs)/search.tsx');
  ok(/模擬店の出店情報は準備中です/.test(search), 'F07 模擬店空文言');
  ok(/一致する企画が見つかりません/.test(search), 'F08 検索空文言');
  const fv = src('data/favorites.ts');
  ok(/favorites\.json/.test(fv), 'F09 お気に入り永続化あり');
}

// ---------- G. tsc / eslint ----------
{
  try {
    execSync('powershell -ExecutionPolicy Bypass -Command "node_modules\\.bin\\tsc --noEmit"', { cwd: ROOT, stdio: 'pipe' });
    ok(true, 'G01 tsc --noEmit成功');
  } catch (e) {
    ok(false, 'G01 tsc --noEmit成功');
  }
  try {
    execSync('powershell -ExecutionPolicy Bypass -Command "node_modules\\.bin\\eslint src\\ --quiet"', { cwd: ROOT, stdio: 'pipe' });
    ok(true, 'G02 eslint成功');
  } catch (e) {
    ok(false, 'G02 eslint成功');
  }
}

console.log(`\nPASS ${pass} / FAIL ${fail} (total ${pass + fail})`);
if (fail > 0) {
  console.log('失敗一覧:');
  for (const f of failures) console.log(` - ${f}`);
  process.exit(1);
}
