// Импорт Firebase для Service Worker
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging-compat.js');

// Ваша конфигурация Firebase (та же, что и в app.js)
const firebaseConfig = {
  apiKey: "AIzaSyAICtDB0Rie_2W2DAoX0MOJm7kDSbTAEUA",
  authDomain: "allapp-16e47.firebaseapp.com",
  projectId: "allapp-16e47",
  storageBucket: "allapp-16e47.firebasestorage.app",
  messagingSenderId: "492414694516",
  appId: "1:492414694516:web:f4fa51805c05e6c545cd21"
};

// Инициализация Firebase в Service Worker
firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Обработка уведомлений, когда приложение в фоне/закрыто
messaging.onBackgroundMessage((payload) => {
  console.log('Получено фоновое уведомление:', payload);
  
  const notificationTitle = payload.notification?.title || 'AllApp';
  const notificationOptions = {
    body: payload.notification?.body || 'Новое обновление',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
    data: {
      url: payload.data?.url || '/',
      type: payload.data?.type || 'shopping'
    },
    actions: [
      {
        action: 'open',
        title: 'Открыть'
      },
      {
        action: 'close',
        title: 'Закрыть'
      }
    ]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});

// Обработка клика по уведомлению
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  if (event.action === 'close') return;
  
  // Открываем нужную вкладку приложения
  const urlToOpen = event.notification.data.url;
  
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        // Если уже есть открытая вкладка, фокусируемся на ней
        for (const client of clientList) {
          if (client.url.includes('/allapp/') && 'focus' in client) {
            return client.focus();
          }
        }
        // Иначе открываем новую
        if (clients.openWindow) {
          return clients.openWindow(urlToOpen);
        }
      })
  );
});
