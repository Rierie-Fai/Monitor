const CACHE_NAME = 'setoran-app-v1.2';
const urlsToCache = [
  '/Monitor/',
  '/Monitor/index.html',
  '/Monitor/style.css',
  '/Monitor/script.js',
  '/Monitor/manifest.json', 
  '/Monitor/icon-192.png', 
  '/Monitor/icon-512.png'
];

// Install Service Worker dan simpan file ke cache
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(cache => {
        return cache.addAll(urlsToCache);
      })
  );
});

// Ambil file dari cache jika offline
self.addEventListener('fetch', event => {
  event.respondWith(
    caches.match(event.request)
      .then(response => {
        // Jika ada di cache, kembalikan response tersebut
        if (response) {
          return response;
        }
        // Jika tidak ada di cache, ambil dari internet
        return fetch(event.request);
      })
  );
});

// Update Service Worker (hapus cache lama)
self.addEventListener('activate', event => {
  const cacheWhitelist = [CACHE_NAME];
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cacheName => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});
