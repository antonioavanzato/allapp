// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyAICtDB0Rie_2W2DAoX0MOJm7kDSbTAEUA",
  authDomain: "allapp-16e47.firebaseapp.com",
  projectId: "allapp-16e47",
  storageBucket: "allapp-16e47.firebasestorage.app",
  messagingSenderId: "492414694516",
  appId: "1:492414694516:web:f4fa51805c05e6c545cd21"
};

firebase.initializeApp(firebaseConfig);

// ────────────────────────────────────────────────────────────────────────
// 1. КЭШИРОВАНИЕ (из старого sw.js)
// ────────────────────────────────────────────────────────────────────────
const CACHE_NAME = 'allapp-cache-v9';
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

const networkFirstFiles = ['index.html', 'style.css', 'app.js'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(urlsToCache))
  );
});

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
    event.respondWith(
      caches.match(event.request)
        .then((response) => response || fetch(event.request))
    );
  }
});

// ────────────────────────────────────────────────────────────────────────
// 2. БЕЗОПАСНАЯ ОБРАБОТКА PUSH (С учетом путей GitHub Pages и структуры FCM)
// ────────────────────────────────────────────────────────────────────────
self.addEventListener('push', function(event) {
  console.log('🔥 Push получен:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      try {
        data = { title: 'AllApp', body: event.data.text() };
      } catch (err) {
        data = { title: 'AllApp', body: 'Новое сообщение' };
      }
    }
  }

  // Безопасный разбор вложенных полей FCM
  const title = data.notification?.title || data.title || 'AllApp';
  const body = data.notification?.body || data.body || 'Новое обновление';
  const payloadData = data.data || {};

  const options = {
    body: body,
    icon: '/allapp/icons/icon-192.png', // Точный путь для GitHub Pages
    badge: '/allapp/icons/icon-192.png',
    data: {
      url: payloadData.url || '/allapp/',
      type: payloadData.type || 'shopping'
    }
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
      .catch(err => console.error('Ошибка показа уведомления:', err))
  );
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
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
