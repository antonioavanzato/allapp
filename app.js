// Версия приложения для кэширования
const APP_VERSION = '1.1.0';

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

// ВАШ КОНФИГ
const firebaseConfig = {
  apiKey: "AIzaSyAICtDB0Rie_2W2DAoX0MOJm7kDSbTAEUA",
  authDomain: "allapp-16e47.firebaseapp.com",
  projectId: "allapp-16e47",
  storageBucket: "allapp-16e47.firebasestorage.app",
  messagingSenderId: "492414694516",
  appId: "1:492414694516:web:f4fa51805c05e6c545cd21"
};

// Инициализация
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);

// DOM Элементы (добавляем новые)
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');
const itemsList = document.getElementById('items-list');
const itemInput = document.getElementById('item-input');
const addBtn = document.getElementById('add-btn');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');
const listTitle = document.getElementById('list-title');
const emptyState = document.getElementById('empty-state');
// Новые элементы для уведомлений
const notificationBell = document.createElement('div');
notificationBell.className = 'notification-bell hidden';
notificationBell.innerHTML = '🔔';
document.querySelector('.header').appendChild(notificationBell);

let currentTab = 'shopping';
let unsubscribe = null;
let currentUser = null;
let notificationPermission = false;

// Запрос разрешения на уведомления при входе
async function setupNotifications() {
  if (!('Notification' in window)) {
    console.log('Браузер не поддерживает уведомления');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notificationPermission = true;
      
      // Получаем токен устройства
      const token = await getToken(messaging, {
        vapidKey: 'BC-iAqJhSKu2rylPzZnHypaJtx67mOu5_BHDUJMOUDSDlIfnWQo-1AZBKfnyk-EUSl51laRaJanX1sGEbnLob9Q' // Пока оставьте так, потом добавим
      });
      
      console.log('Токен для уведомлений:', token);
      
      // Сохраняем токен в Firestore (если нужно)
      if (currentUser && token) {
        // Здесь можно сохранить токен в базу
        console.log('Токен сохранен для пользователя:', currentUser.uid);
      }
    }
  } catch (error) {
    console.log('Ошибка при запросе уведомлений:', error);
  }
}

// Сохранение токена в Firestore через Cloud Function
async function saveTokenToServer(token) {
  if (!currentUser) return;
  
  try {
    // Получаем функцию из Firebase
    const functions = getFunctions(app);
    const saveTokenFunction = httpsCallable(functions, 'saveUserToken');
    
    const result = await saveTokenFunction({ token });
    console.log('Токен сохранен на сервере:', result.data);
  } catch (error) {
    console.log('Ошибка сохранения токена:', error);
    
    // Альтернатива: сохраняем напрямую в Firestore
    try {
      const userRef = doc(db, 'users', currentUser.uid);
      await updateDoc(userRef, {
        fcmTokens: arrayUnion(token)
      });
    } catch (e) {
      console.log('Не удалось сохранить токен:', e);
    }
  }
}

// Обновите setupNotifications
async function setupNotifications() {
  if (!('Notification' in window)) {
    console.log('Браузер не поддерживает уведомления');
    return;
  }

  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      notificationPermission = true;
      
      // Получаем токен устройства
      const token = await getToken(messaging, {
        vapidKey: 'BGz2...' // Ваш VAPID ключ из консоли Firebase
      });
      
      console.log('Токен для уведомлений:', token);
      
      // Сохраняем токен
      if (currentUser && token) {
        await saveTokenToServer(token);
      }
    }
  } catch (error) {
    console.log('Ошибка при запросе уведомлений:', error);
  }
}

// Слушаем уведомления, когда приложение открыто
onMessage(messaging, (payload) => {
  console.log('Получено уведомление:', payload);
  // Показываем уведомление через наш интерфейс
  showInAppNotification(payload.notification);
});

// Функция для показа уведомления внутри приложения
function showInAppNotification(notification) {
  notificationBell.classList.remove('hidden');
  notificationBell.textContent = `🔔 ${notification?.title || 'Новое'}`;
  
  setTimeout(() => {
    notificationBell.classList.add('hidden');
  }, 5000);
}

// Модифицируем функцию addItem для отправки уведомлений
async function addItem() {
  const text = itemInput.value.trim();
  if (!text || !currentUser) return;
  itemInput.value = '';
  
  // Добавляем элемент в Firestore
  const docRef = await addDoc(getUserCollection(), {
    text: text,
    completed: false,
    createdAt: serverTimestamp()
  });
  
  // Отправляем уведомление (если есть подписка)
  if (notificationPermission) {
    // Здесь мы позже добавим вызов сервера для уведомлений
    console.log('Новый элемент добавлен:', text);
  }
}

// Следим за авторизацией
onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadData();
    setupNotifications(); // Запрашиваем разрешение при входе
  } else {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = '';
  }
});

// ДАЛЬШЕ ВЕСЬ ОСТАЛЬНОЙ ВАШ КОД БЕЗ ИЗМЕНЕНИЙ
// ... (loginBtn, registerBtn, logoutBtn, loadData, renderItem, навигация)

// Логика входа
loginBtn.addEventListener('click', async () => {
  try {
    authError.textContent = '';
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (error) {
    authError.textContent = 'Ошибка входа: проверьте данные.';
  }
});

registerBtn.addEventListener('click', async () => {
  try {
    authError.textContent = '';
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
  } catch (error) {
    authError.textContent = 'Ошибка регистрации.';
  }
});

logoutBtn.addEventListener('click', () => signOut(auth));

// Работа с данными
function getUserCollection() {
  return collection(db, 'users', currentUser.uid, currentTab);
}

async function addItem() {
  const text = itemInput.value.trim();
  if (!text || !currentUser) return;
  itemInput.value = '';
  await addDoc(getUserCollection(), {
    text: text,
    completed: false,
    createdAt: serverTimestamp()
  });
}

addBtn.addEventListener('click', addItem);
itemInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addItem(); });

function loadData() {
  if (unsubscribe) unsubscribe();
  const q = query(getUserCollection(), orderBy('createdAt', 'desc'));
  unsubscribe = onSnapshot(q, (snapshot) => {
    itemsList.innerHTML = '';
    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      snapshot.forEach((docSnap) => renderItem(docSnap.id, docSnap.data()));
    }
  });
}

// Отрисовка с жестами
function renderItem(id, item) {
  const li = document.createElement('li');
  li.innerHTML = `
    <div class="swipe-actions">
      <div class="action-complete">Готово</div>
      <div class="action-delete">Удалить</div>
    </div>
    <div class="swipe-content">
      <span class="item-text ${item.completed ? 'completed' : ''}">${item.text}</span>
    </div>
  `;

  const swipeContent = li.querySelector('.swipe-content');
  let startX = 0, currentX = 0, translateX = 0, isSwiping = false;
  const threshold = 80;

  const getX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

  const start = (e) => {
    startX = getX(e);
    isSwiping = true;
    li.classList.add('is-swiping');
  };

  const move = (e) => {
    if (!isSwiping) return;
    currentX = getX(e);
    translateX = currentX - startX;
    // Ограничение свайпа
    if (translateX > 120) translateX = 120;
    if (translateX < -120) translateX = -120;
    swipeContent.style.transform = `translateX(${translateX}px)`;
  };

  const end = async () => {
    if (!isSwiping) return;
    isSwiping = false;
    li.classList.remove('is-swiping');

    if (translateX > threshold) {
      // Вправо - Готово
      const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
      await updateDoc(docRef, { completed: !item.completed });
    } else if (translateX < -threshold) {
      // Влево - Удалить
      li.style.transition = 'all 0.3s ease';
      li.style.transform = 'translateX(-100%)';
      li.style.opacity = '0';
      setTimeout(() => deleteDoc(doc(db, 'users', currentUser.uid, currentTab, id)), 300);
    } else {
      swipeContent.style.transform = 'translateX(0px)';
    }
    translateX = 0;
  };

  li.addEventListener('touchstart', start, {passive: true});
  li.addEventListener('touchmove', move, {passive: false});
  li.addEventListener('touchend', end);
  li.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  itemsList.appendChild(li);
}

// Навигация
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    nav.classList.add('active');
    currentTab = nav.dataset.tab;
    pageTitle.textContent = currentTab === 'shopping' ? 'Покупки' : 'Задачи';
    listTitle.textContent = currentTab === 'shopping' ? 'Список покупок' : 'Все задачи';
    itemInput.placeholder = currentTab === 'shopping' ? 'Что купить?..' : 'Новая задача...';
    if (currentUser) loadData();
  });
});
