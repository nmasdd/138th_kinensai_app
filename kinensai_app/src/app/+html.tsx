import { ScrollViewStyleReset } from 'expo-router/html';
import type { PropsWithChildren } from 'react';
import { APP_NAME } from '../data/pageTitles';
import { festival } from '../data/festival';

/** 検索結果やホーム画面追加時に使うアプリの説明 (manifest と同じ文言)。 */
const DESCRIPTION = `${festival.school} ${festival.name}の公式アプリ。タイムテーブル・企画検索・校内マップ・QR読み取りなどを確認できます。`;

/**
 * Web のルート HTML。静的描画時に Node.js でのみ実行される。
 * 言語・PWA (マニフェスト / テーマカラー / ホーム画面追加) の head をここで宣言する。
 * ページごとの <title> は各画面の TopAppBar が expo-router/head で設定する。
 */
export default function Root({ children }: PropsWithChildren) {
  return (
    <html lang="ja">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta name="viewport" content="width=device-width, initial-scale=1, shrink-to-fit=no" />
        <meta name="description" content={DESCRIPTION} />
        <meta name="theme-color" content="#ffffff" />
        <link rel="manifest" href="/manifest.webmanifest" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content={APP_NAME} />
        <ScrollViewStyleReset />
        {/*
          モバイル Web での高さ暴走を防ぐ。
          js-stack (@react-navigation/stack) は「モバイル Chrome のアドレスバー対策」として
          `:root { --vh: window.innerHeight*0.01 }` と `body { height: calc(var(--vh)*100) }` を
          実行時に head へ注入する。しかし画面遷移時の一時的な横方向のはみ出しで
          モバイル Chrome が縮小表示 (レイアウトビューポートが2倍) になると innerHeight が
          2倍で記録され、body 高さが2倍のまま固定されて下のタブバーが画面外へ押し出される。
          本アプリは body を常にビューポート高に固定し、はみ出しを横方向にクリップして
          縮小表示自体を起こさないようにする (`!important` で上記注入スタイルに優先)。
        */}
        <style>{'body{height:100% !important;max-width:100% !important;overflow-x:hidden !important;}'}</style>
      </head>
      <body>{children}</body>
    </html>
  );
}
