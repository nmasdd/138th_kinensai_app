/*
 * 138th 記念祭アプリの Service Worker。
 * 会場では電波が弱いことがあるため、閲覧済みの画面と静的アセットをキャッシュし、
 * オフラインでも起動・タブ移動できるようにする (PWA)。
 *
 * - 画面遷移 (navigate): ネットワーク優先。失敗時はキャッシュ → キャッシュ済み `/` の順に返す。
 * - それ以外の同一オリジン GET: キャッシュを即返しつつ裏で更新 (stale-while-revalidate)。
 * - `/api/` (公開コンテンツ・画像) は常にネットワークへ流し、キャッシュしない (鮮度優先)。
 * 静的アセットは内容ハッシュ付きのファイル名なので、キャッシュが古くなる心配はない。
 */
const CACHE = 'kinensai-v1';

/*
 * アプリシェル (初回インストール時に取得)。会場で切符を切らさないよう、
 * タブと主要画面の HTML も先に持っておく。1つでも取得に失敗するとインストール
 * 全体が失敗してしまうため、cache.add は個別に catch する。
 */
const APP_SHELL = [
  '/',
  '/camera',
  '/timetable',
  '/search',
  '/map',
  '/menu',
  '/vote',
  '/pamphlet',
  '/notifications',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/apple-touch-icon.png',
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => Promise.all(APP_SHELL.map((url) => cache.add(url).catch(() => undefined))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE).map((key) => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request));
    return;
  }
  event.respondWith(staleWhileRevalidate(request));
});

async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch (error) {
    const cached = await cache.match(request);
    if (cached) return cached;
    const shell = await cache.match('/');
    if (shell) return shell;
    throw error;
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request);
  const update = fetch(request)
    .then((response) => {
      if (response.ok) cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached ?? (await update) ?? Response.error();
}
