const WEREWOLF_CACHE = 'werewolf-game-manager-v8';
const LOCAL_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/icon.svg',
  './assets/css/base.css',
  './assets/css/layout.css',
  './assets/css/components.css',
  './assets/css/overlays.css',
  './assets/css/player.css',
  './assets/css/polish.css',
  './assets/css/theme.css',
  './assets/js/core/boot-mode.js',
  './assets/js/core/state.js',
  './assets/js/moderator/setup.js',
  './assets/js/moderator/game.js',
  './assets/js/moderator/ui.js',
  './assets/js/player/player.js',
  './assets/js/polish/icons.js',
  './assets/js/polish/gameplay-pack.js',
  './assets/js/polish/interface.js'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(WEREWOLF_CACHE)
      .then(cache => cache.addAll(LOCAL_ASSETS))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key !== WEREWOLF_CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;

  const url = new URL(event.request.url);
  if (url.origin !== location.origin) return;

  event.respondWith(
    fetch(event.request)
      .then(response => {
        const copy = response.clone();
        if (response.ok) {
          caches.open(WEREWOLF_CACHE).then(cache => cache.put(event.request, copy));
        }
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
