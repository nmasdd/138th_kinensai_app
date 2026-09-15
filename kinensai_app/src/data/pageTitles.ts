import { festival } from './festival';

/**
 * Web のブラウザタブ (document.title) に表示するタイトル。
 * 画面名は TopAppBar と同じ日本語表記を使い、アプリ名を「｜」で連結する。
 */
export const APP_NAME = festival.name;

export function pageTitle(label?: string): string {
  return label ? `${label}｜${APP_NAME}` : APP_NAME;
}
