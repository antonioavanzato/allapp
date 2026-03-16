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

// ⚠️ ВАЖНО: Не вызываем messaging() и не используем onBackgroundMessage
// Вместо этого — чистый push-обработчик

self.addEventListener('push', function(event) {
  console.log('🔥 Чистый push получен:', event);
  
  let data = {};
  if (event.data) {
    try {
      data = event.data.json();
    } catch (e) {
      data = { title: 'AllApp', body: event.data.text() };
    }
  }

  const title = data.notification?.title || data.title || 'AllApp';
  const options = {
    body: data.notification?.body || data.body || 'Новое обновление',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      url: data.data?.url || '/',
      type: data.data?.type || 'shopping'
    },
    actions: [
      { action: 'open', title: 'Открыть' },
      { action: 'close', title: 'Закрыть' }
    ]
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

// Обработка клика по уведомлению (оставляем как есть)
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
