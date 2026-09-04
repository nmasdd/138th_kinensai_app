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
2. `デザインルール.md` — 白背景+オレンジ、インク (スプラトゥーン的) アクセント。
3. `その他事項.md` — 用語 (クラス企画/教室有志企画)・素材置き場・「詳細未定のためデータ投入で即動く状態に」の方針。
- 関連する未記載機能は `仕様書.md` に追記すれば許可不要で実装可。情報不足時はまず `HP/` のソースを見ること。`基本方針.txt` は Shift-JIS で文字化けして読める (138th テーマ `Passione`) ため直接読まず概要のみ参照。

## タブ構成 (仕様書が正・現コードは乖離あり)
- 正: カメラ → タイムテーブル → ホーム(index) → 検索 → マップ の5タブ。この順序で実装。
- 現コードは `reservation` タブ + `ReservationContext` + `reservation/` CSV群を持つが、仕様書で「予約一覧及び予約機能は全て削除」と明記。エージェントは予約関連 (タブ、Context、`reservation/`、`reservations.json` 永続化) を削除すること。新規に予約UIを作らないこと。
- 未実装: マップタブ、QR→マップ遷移、通知、ステージ投票、講堂混雑表示。作る場合は仕様書の該当節に従う。

## データ・素材
- `kinensai_app/planning/{組}/title.txt, detail.txt` — 企画名・説明。`src/data/classContent.ts` が `Asset.fromModule()+expo-file-system/legacy` で読む。現状1A/1B/1Cのみだが仕様は中学A〜I・高校A〜Jのためハードコードを増やさず拡張可能に。
- `kinensai_app/time/Auditorium.csv` — 講堂タイムテーブル。4列 `team,day,start,end` (`day: 0=土,1=日`)、5列 (ID付き) もパーサが許容。遅延表示・リアルタイム更新は未実装。
- `HP/` — ホーム画面の文言ソース。`校内マップ/` — PDF/JPGはパンフレット由来で余白が大きいためトリミング・見やすくして使うこと。
- `metro.config.js` で `.csv,.txt` を `assetExts` に追加済み。消さないこと。ファイルIOは `expo-file-system/legacy` (新APIではない)。

## 規約・落とし穴
- `src/components/Header` に置く (`src/app/` 下はルート登録されるため。通知画面はタブ除外の `notifications` ルート)。`context/,utils/,data/` も `src/` 直下に置く。
- タブアイコンは `kinensai_app/icon/` (not `assets/`) を `require('../../icon/...')` で参照。展示IDは `土曜日_1A` 形式。
- `app.json` の `experiments.typedRoutes, reactCompiler` 有効。`@/*→src/*` エイリアス (`tsconfig.json`)。`expo-env.d.ts` は生成物。
- 画面雛形は `SafeAreaView `#ffffff` + `Header`。色は現状 `#208AEF` (青) が残っている箇所あり — 新規UIは青を使わずオレンジ系に寄せる。
