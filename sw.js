const CACHE_NAME = 'onemind-v4';
const APP_SHELL = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './data/thoughts.json',
  './icon.svg'
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(cacheNames => Promise.all(
        cacheNames
          .filter(cacheName => cacheName !== CACHE_NAME)
          .map(cacheName => caches.delete(cacheName))
      ))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  if (event.request.method !== 'GET') return;
  const requestUrl = new URL(event.request.url);
  const isAppFile = requestUrl.pathname.endsWith('/app.js') ||
    requestUrl.pathname.endsWith('/index.html');

  event.respondWith(
    (isAppFile
      ? fetch(event.request).then(response => {
          const responseCopy = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, responseCopy));
          return response;
        })
      : caches.match(event.request).then(cached => cached || fetch(event.request)))
  );
});
