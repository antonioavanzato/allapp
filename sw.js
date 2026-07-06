const CACHE_NAME = 'allapp-cache-v26';
const urlsToCache = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './icons/icon-192.png'
];

// Файлы которые всегда берём из сети (не из кэша)
const networkFirstFiles = ['index.html', 'style.css', 'app.js'];

self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) =>
      // Устойчиво: 404 одного файла НЕ ломает установку SW (иначе SW не активируется)
      Promise.allSettled(urlsToCache.map((url) => cache.add(url)))
    )
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
  let data = {};
  try {
    data = event.data.json();
  } catch (e) {
    data = { title: 'AllApp', body: event.data.text() };
  }

  const title = data.notification?.title || data.title || 'AllApp';
  const body  = data.notification?.body  || data.body  || 'Новое обновление';
  const options = {
    body,
    icon: './icons/icon-192.png',
    badge: './icons/icon-192.png',
    data: {
      url: data.data?.url || 'https://antonioavanzato.github.io/allapp/',
      type: data.data?.type || 'shopping'
    },
    actions: [
      { action: 'open', title: 'Открыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  if (event.action === 'close') return;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if (client.url.includes('/allapp/') && 'focus' in client) {
            return client.focus();
          }
        }
        if (clients.openWindow) {
          return clients.openWindow('https://antonioavanzato.github.io/allapp/');
        }
      })
  );
});
