const CACHE = 'habit-tracker-v4';
const ASSETS = ['/', '/index.html', '/manifest.json'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(CACHE).then((c) => c.addAll(ASSETS)));
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then((m) => m || fetch(event.request))
  );
});
