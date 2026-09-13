# AGENTS.md — 記念祭アプリ (Expo)

## 作業ディレクトリ
- 実アプリは `kinensai_app/` 配下。コマンドは必ずそこで実行。ルート直下の `package.json` は冗長・古いので使わない。
- スタック: Expo SDK 56 / React Native 0.85 / React 19 / TS strict / expo-router file-based routing。入口は `kinensai_app/src/app/_layout.tsx` (`expo-router/entry`)。バージョン別Docs: https://docs.expo.dev/versions/v56.0.0/
- コマンド (`kinensai_app/` で):
  ```
  npm run start / android / ios / web
  npm run lint   # expo lint
  ```
  test runner・typecheck scriptなし。検証は `node_modules\.bin\eslint src\ --quiet` と `node_modules\.bin\tsc --noEmit` で代用。

## 仕様の正本 (必読・優先順)
1. `仕様書.md` — タブ構成・各画面要件の正本。ここにない無関係機能は実装しない。既存なら削除する。
2. `デザインルール.md` — UI は **Google Material Design 3 (Material 3 Expressive)**、アニメーション／モーションは **Apple Human Interface Guidelines (HIG)** に準拠。白背景+オレンジ。
3. `その他事項.md` — 用語 (クラス企画/教室有志企画)・素材置き場・「詳細未定のためデータ投入で即動く状態に」の方針。
- 関連する未記載機能は `仕様書.md` に追記すれば許可不要で実装可。情報不足時はまず `HP/` のソースを見ること。`基本方針.txt` は Shift-JIS で文字化けして読める (138th テーマ `Passione`) ため直接読まず概要のみ参照。

## タブ構成 (仕様書が正・現コードは乖離あり)
- 正: カメラ → タイムテーブル → ホーム(index) → 検索 → マップ の5タブ。この順序で実装。
- 現コードは `reservation` タブ + `ReservationContext` + `reservation/` CSV群を持つが、仕様書で「予約一覧及び予約機能は全て削除」と明記。エージェントは予約関連 (タブ、Context、`reservation/`、`reservations.json` 永続化) を削除すること。新規に予約UIを作らないこと。
- 未実装: マップタブ、QR→マップ遷移、通知、ステージ投票、講堂混雑表示。作る場合は仕様書の該当節に従う。

## データ・素材
- 同梱の共有コンテンツ正本は `kinensai_app/src/data/bundled/*.json` に集約 (`volunteers.json`=有志45件、`stage-groups.json`=ステージ出演団体、`auditorium-groups.json`=講堂出演団体、`class-catalog.json`=クラス企画38件)。TSはimportするだけにし、リテラルを増やさない。TSリテラルだった `classContent.ts`/旧 `planning/*.txt`/旧 `classCatalog.json` は廃止済み。
- `kinensai_app/time/Auditorium.csv` — 講堂タイムテーブル。4列 `team,day,start,end` (`day: 0=土,1=日`)、5列 (ID付き) もパーサが許容。遅延表示・リアルタイム更新は未実装。
- `HP/` — ホーム画面の文言ソース。`校内マップ/` — PDF/JPGはパンフレット由来で余白が大きいためトリミング・見やすくして使うこと。
- `metro.config.js` で `.csv,.txt` を `assetExts` に追加済み。消さないこと。ファイルIOは `expo-file-system/legacy` (新APIではない)。
- 公開前データの構造検証は `src/data/validateContent.ts`。

## 開発と本番の分離
- 開発時 (`__DEV__`) は既定で本番KV (`app.kinensai.jp/api/content`) を読まない (`remoteConfig.ts isRemoteContentEnabled()`)。同梱値で動く。配信値を確認したいときだけ `EXPO_PUBLIC_ENABLE_REMOTE_CONTENT=1 npm run web`、配信先変更は `EXPO_PUBLIC_CONTENT_URL`。本番ビルドは常に有効。
- 管理者認証は既定で必須。ローカルで確認するときだけ `EXPO_PUBLIC_ADMIN_BYPASS=1` (`__DEV__` のみ有効、本番は無効)。
- `/admin/data` に「公開前チェック」(構造検証・エラーで公開不可) と「配信中の値を確認」(本番KV実値) がある。公開後は端末キャッシュを自動破棄。

## 規約・落とし穴
- `src/components/Header` に置く (`src/app/` 下はルート登録されるため。通知画面はタブ除外の `notifications` ルート)。`context/,utils/,data/` も `src/` 直下に置く。
- タブアイコンは `kinensai_app/icon/` (not `assets/`) を `require('../../icon/...')` で参照。展示IDは `土曜日_1A` 形式。
- `app.json` の `experiments.typedRoutes, reactCompiler` 有効。`@/*→src/*` エイリアス (`tsconfig.json`)。`expo-env.d.ts` は生成物。
- 画面雛形は `SafeAreaView `#ffffff` + `Header`。色は現状 `#208AEF` (青) が残っている箇所あり — 新規UIは青を使わずオレンジ系に寄せる。
- UI は **Material 3**、モーションは **Apple HIG** に準拠 (`デザインルール.md`・`仕様書.md` §14)。アニメーションは `src/components/anim.tsx` に集約し、React Native Reanimated + `useReducedMotion()` で Reduce Motion を必ず尊重する。

## Cloudflare 公開 (https://app.kinensai.jp/)
- Worker名 `kinensai-app` (zone `kinensai.jp`、カスタムドメイン `app.kinensai.jp`)。`138th-kinensai` (本体サイト) には触らない。
- 構成 (`kinensai_app/` 配下): `wrangler.toml` (assets `./dist` + `not_found_handling=single-page-application` + routes custom_domain) と `worker/src/index.ts` (main、ASSETSバインディング)。`worker/` も `tsc --noEmit` の検査対象 (DOM libで型検査)。
- デプロイ手順 (`kinensai_app/` で、要 `npx wrangler login`):
  ```
  npx expo export --platform web
  npx wrangler deploy
  ```
  `dist/` は gitignore だがデプロイ入力のため export で再生成すること。`--dry-run` で事前検証可。
- 管理者認証はサーバ側: `POST /api/admin/login` (検証→署名付きトークン発行・12時間有効) と `POST /api/admin/verify`。秘密はWorkerシークレット `ADMIN_PASSWORD` / `ADMIN_SESSION_SECRET` のみ (API `PUT /accounts/{id}/workers/scripts/kinensai-app/secrets` か `wrangler secret put` で設定)。パスワード・トークンをコード/バンドル/一時ファイル/チャット出力に残さない。`AdminGate` はトークンをメモリ (+WebはsessionStorage) に保持。
- 全世界配信: KV名前空間 `kinensai-content` (binding `CONTENT`) + `GET /api/content/<name>.json` (公開・`max-age=15, stale-while-revalidate=15`) + `GET /api/content/_meta.json` (版数) + `POST /api/content/publish` (管理者トークン必須・12キーのホワイトリスト検証)。クライアントは `app.json extra.contentUrl=https://app.kinensai.jp/api/content` から取得。読込優先度は端末プレビュー→全世界配信→同梱値 (`kvStore.ts`)。反映は30秒以内を目標 (`remoteConfig.ts` が `_meta.json` の版数を起動時/復帰時/15秒毎に確認し、`?v=<version>` 付きで再取得 + `useContentEffect` で画面再読込)。`/admin/data` の「全世界に公開」が現在有効値を一括公開し `_meta.json` の版数も更新、「プレビュー破棄」が端末編集の取消。公開バンドル書き出しはバックアップ・確認用。
- 画像配信 (R2なし・KV代替): `POST /api/images/upload` (管理者トークン必須・jpg/png/webp/gif・5MB以下・KV格納+ランダムキー発行) + `GET /api/images/<key>` (公開・edgeキャッシュ+1年immutable)。管理者の `imageUri` は端末ローカル (`file://`・`blob:`) やdataURLのため、公開時に `imageUpload.ts` の `rewriteImagesForPublish` が自動で上げてhttps URLに書換える (http(s)は維持・失敗分は元のまま+件数報告)。HEICは非対応 (JPG/PNG等で登録)。
- 落とし穴: ローカル `expo start --web` では `/api/admin/*` がないため管理者ログイン不可 (Webは同一オリジン相対、ネイティブは本番URL直指し)。自宅LANのDNSが古いと `app.kinensai.jp` が引けないことがある (Google DNS `https://dns.google/resolve?name=app.kinensai.jp&type=A` で切分け)。bash実行は `cmd /c` 経由 (`&&` 不可、`A && B` は `A; if ($?) { B }`)。
