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
      </head>
      <body>{children}</body>
    </html>
  );
}
