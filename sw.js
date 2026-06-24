const CACHE_NAME = 'allapp-cache-v5';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './firebase-messaging-sw.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// Файлы которые всегда берём из сети (не из кэша)
const networkFirstFiles = ['index.html', 'style.css', 'app.js'];

self.addEventListener('install', (event) => {
  // Не активируемся сразу — ждём команды от страницы (кнопка «Обновить»)
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

// Активируем новую версию по команде из приложения
self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const url = event.request.url;
  const isNetworkFirst = networkFirstFiles.some(file => url.includes(file));

  if (isNetworkFirst) {
    // Сначала сеть, при ошибке — кэш
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
  } else {
    // Иконки, шрифты и прочее — из кэша
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  }
});

self.addEventListener('push', (event) => {
  if (!event.data) return;
  try {
    const data = event.data.json();
    const options = {
      body: data.body || 'Новое обновление в AllApp',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      data: data.data || {},
      actions: [
        { action: 'open', title: 'Открыть' }
      ]
    };
    event.waitUntil(
      self.registration.showNotification(data.title || 'AllApp', options)
    );
  } catch (error) {
    console.error('Ошибка:', error);
  }
});
