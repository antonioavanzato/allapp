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

// Инициализируем Firebase App и Messaging (Критически важно для работы getToken)
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging(); 

// ────────────────────────────────────────────────────────────────────────
// 1. КЭШИРОВАНИЕ РЕСУРСОВ
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
// 2. ОФИЦИАЛЬНЫЙ ОБРАБОТЧИК УВЕДОМЛЕНИЙ FIREBASE
// ────────────────────────────────────────────────────────────────────────
messaging.onBackgroundMessage((payload) => {
  console.log('🔥 Получено фоновое сообщение:', payload);

  const title = payload.notification?.title || 'AllApp';
  const options = {
    body: payload.notification?.body || 'Новое обновление',
    icon: '/allapp/icons/icon-192.png', // Абсолютный путь для GitHub Pages
    badge: '/allapp/icons/icon-192.png',
    data: {
      url: payload.data?.url || '/allapp/',
      type: payload.data?.type || 'shopping'
    }
  };

  return self.registration.showNotification(title, options);
});
