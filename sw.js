self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('fetch', (event) => {
  // Простейший fetch, пока без оффлайн кэширования
  event.respondWith(fetch(event.request));
});
