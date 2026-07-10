import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy,
  serverTimestamp, setDoc, where, getDoc, writeBatch, getDocs
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const APP_VERSION = 'v26';
document.addEventListener('DOMContentLoaded', () => {
  const el = document.getElementById('app-version');
  if (el) el.textContent = `НАШ ДОМ · ${APP_VERSION}`;
});

const firebaseConfig = {
  apiKey: "AIzaSyAICtDB0Rie_2W2DAoX0MOJm7kDSbTAEUA",
  authDomain: "allapp-16e47.firebaseapp.com",
  projectId: "allapp-16e47",
  storageBucket: "allapp-16e47.firebasestorage.app",
  messagingSenderId: "492414694516",
  appId: "1:492414694516:web:f4fa51805c05e6c545cd21"
};

const app = initializeApp(firebaseConfig);
// Локальный кэш (IndexedDB): списки показываются мгновенно из памяти,
// свежие данные подтягиваются в фоне. Синхронизация — без изменений.
let db;
try {
  db = initializeFirestore(app, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.error('Не удалось включить локальный кэш, работаем без него:', e);
  db = getFirestore(app);
}
const auth = getAuth(app);
const messaging = getMessaging(app);
const functions = getFunctions(app);

const VAPID_KEY = 'BEZcSno0f4ds-XO22p3cpn0aI_xOwkSkYH9PNoPVqy7WciJl4KpQbruWPw_7AsHyosDmkFp7EcyCQZLfFlj4UQ4';
let currentFCMToken = null;

let waitingWorker = null;
let isReloading = false;
let updateInitiated = false;

function showUpdateBanner(worker) {
  waitingWorker = worker;
  const banner = document.getElementById('update-banner');
  if (!banner) return;
  banner.classList.add('visible');
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    // Один service worker на весь scope: и кэш, и push (без конфликта регистраций)
    navigator.serviceWorker.register('sw.js').then((registration) => {
      // Уже ждёт новый воркер
      if (registration.waiting && navigator.serviceWorker.controller) {
        showUpdateBanner(registration.waiting);
      }
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        if (!newWorker) return;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateBanner(newWorker);
          }
        });
      });
    });

    // Когда новый воркер взял управление по нашей команде — перезагружаем один раз
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (isReloading || !updateInitiated) return;
      isReloading = true;
      window.location.reload();
    });
  });
}

function applyUpdate() {
  const banner = document.getElementById('update-banner');
  if (banner) banner.classList.remove('visible');
  updateInitiated = true;
  if (waitingWorker) {
    waitingWorker.postMessage({ type: 'SKIP_WAITING' });
  } else {
    window.location.reload();
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const updateBtn = document.getElementById('update-banner-btn');
  if (updateBtn) updateBtn.addEventListener('click', applyUpdate);
});

async function initFCMToken(interactive = false) {
  try {
    if (!('Notification' in window)) {
      if (interactive) showToast('Push доступен только в установленной PWA', 'error');
      return;
    }
    let permission = Notification.permission;
    if (permission !== 'granted') {
      permission = await Notification.requestPermission();
    }
    if (permission !== 'granted') {
      if (interactive) showToast('Разрешите уведомления', 'warning');
      updateNotifBtn();
      return;
    }
    if (interactive) showToast('Получаю токен…', 'success');
    // Этап 1: ждём активный SW (с таймаутом — на iOS .ready может зависнуть)
    const swReg = await Promise.race([
      navigator.serviceWorker.ready,
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('SW не активировался (таймаут 8с)')), 8000))
    ]);
    if (interactive) showToast('SW готов, запрос токена…', 'success');
    // Этап 2: getToken — на iOS иногда зависает без ошибки
    const token = await Promise.race([
      getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg }),
      new Promise((_, reject) =>
        setTimeout(() => reject(new Error('getToken таймаут 15с')), 15000))
    ]);
    if (!token) {
      if (interactive) showToast('Токен пустой', 'error');
      return;
    }
    currentFCMToken = token;
    // Пишем токен напрямую в Firestore (бесплатно и без Cloud Functions)
if (currentUser) {
  await setDoc(doc(db, 'family', 'shared', 'tokens', currentUser.uid), {
    token: token,
    email: currentUser.email,
    updatedAt: serverTimestamp()
  }, { merge: true });
}
    updateNotifBtn();
    if (interactive) showToast('Уведомления включены ✓', 'success');
  } catch (error) {
    console.error('Ошибка FCM:', error);
    if (interactive) {
      const code = error?.code || error?.message || 'неизвестно';
      showToast('FCM: ' + code, 'error');
    }
  }
}

function updateNotifBtn() {
  const btn = document.getElementById('notif-btn');
  if (!btn) return;
  btn.classList.remove('notif-active', 'notif-denied');
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted' && currentFCMToken) {
    btn.classList.add('notif-active');
    btn.title = 'Уведомления включены';
  } else if (Notification.permission === 'denied') {
    btn.classList.add('notif-denied');
    btn.title = 'Уведомления отключены в настройках';
  } else {
    btn.title = 'Включить уведомления';
  }
}

async function removeFCMToken() {
  if (!currentUser) return;
  try {
    // Удаляем токен напрямую из Firestore (как и сохраняем — без Cloud Functions)
    await deleteDoc(doc(db, 'family', 'shared', 'tokens', currentUser.uid));
    currentFCMToken = null;
  } catch (error) {
    console.error('Ошибка удаления FCM токена:', error);
  }
}

onMessage(messaging, (payload) => {
  const title = payload.notification?.title || '';
  const body = payload.notification?.body || '';
  showToast(`${title}: ${body}`);
});

const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');
const itemsList = document.getElementById('items-list');
const itemInput = document.getElementById('item-input');
const addBtn = document.getElementById('add-btn');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');
const listTitle = document.getElementById('list-title');
const emptyState = document.getElementById('empty-state');
const quickContainer = document.getElementById('quick-products-container');
const inputGroup = document.getElementById('input-group');
const listSection = document.getElementById('list-section');
const coffeeSection = document.getElementById('coffee-section');
const clearCompletedBtn = document.getElementById('clear-completed-btn');

const coffeeName = document.getElementById('coffee-name');
const coffeeProcessing = document.getElementById('coffee-processing');
const coffeeRoastDate = document.getElementById('coffee-roast-date');
const coffeeAgeSpan = document.getElementById('coffee-age');
const coffeeDose = document.getElementById('coffee-dose');
const coffeeGrind = document.getElementById('coffee-grind');
const coffeeTemp = document.getElementById('coffee-temp');
const coffeeWater = document.getElementById('coffee-water');
const coffeeNotes = document.getElementById('coffee-notes');
const coffeeRatingEl = document.getElementById('coffee-rating');
const coffeeSaveBtn = document.getElementById('coffee-save');
const coffeeRecipesList = document.getElementById('coffee-recipes-list');

let coffeeRating = 0;
function setCoffeeRating(value) {
  coffeeRating = value;
  if (!coffeeRatingEl) return;
  coffeeRatingEl.querySelectorAll('.star').forEach(star => {
    const v = parseInt(star.dataset.value);
    star.textContent = v <= value ? '★' : '☆';
    star.classList.toggle('filled', v <= value);
  });
}
if (coffeeRatingEl) {
  coffeeRatingEl.querySelectorAll('.star').forEach(star => {
    star.addEventListener('click', () => {
      const v = parseInt(star.dataset.value);
      setCoffeeRating(v === coffeeRating ? 0 : v);
    });
  });
}

let currentTab = 'shopping';
let completedDocIds = [];
let unsubscribe = null;
let unsubscribeCoffee = null;
let currentUser = null;
const expandedRecipes = new Set(); // раскрытые рецепты переживают ресинк списка

const userNames = {
  'antonioavanzato@gmail.com': 'Антон',
  'style_of_live@gmail.com': 'Даша',
  'antonioavanzato': 'Антон',
  'style_of_live': 'Даша'
};

function getUserDisplayName(email) {
  if (!email) return '';
  if (userNames[email]) return userNames[email];
  const local = email.split('@')[0];
  return userNames[local] || local;
}

function escapeHtml(str) {
  if (str == null) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Лёгкая вибро-отдача
function haptic(pattern = 12) {
  try {
    if (navigator.vibrate) navigator.vibrate(pattern);
  } catch (_) {}
}

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  toast.textContent = `${icons[type] || '✅'} ${message}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

const offlineBar = document.createElement('div');
offlineBar.className = 'offline-bar';
offlineBar.textContent = '⚡ Нет соединения — изменения сохранятся при подключении';
document.body.prepend(offlineBar);

const syncDot = document.getElementById('sync-dot');
let syncIdleTimer = null;
function setSyncState(state) {
  if (!syncDot) return;
  if (!navigator.onLine) state = 'offline';
  syncDot.classList.remove('synced', 'syncing', 'offline');
  syncDot.classList.add(state);
  if (state === 'syncing') {
    syncDot.title = 'Синхронизация…';
    clearTimeout(syncIdleTimer);
    syncIdleTimer = setTimeout(() => {
      if (navigator.onLine) setSyncState('synced');
    }, 1200);
  } else if (state === 'offline') {
    syncDot.title = 'Нет соединения';
  } else {
    syncDot.title = 'Синхронизировано';
  }
}

function setOfflineState(isOffline) {
  setSyncState(isOffline ? 'offline' : 'synced');
  if (isOffline) {
    document.body.classList.add('is-offline');
    offlineBar.classList.add('visible');
  } else {
    document.body.classList.remove('is-offline');
    offlineBar.classList.remove('visible');
  }
}

async function checkOnline() {
  if (!navigator.onLine) {
    setOfflineState(true);
  } else if (document.body.classList.contains('is-offline')) {
    setOfflineState(false);
    setTimeout(() => showToast('Соединение восстановлено', 'success'), 100);
  }
}

checkOnline();
setInterval(checkOnline, 5000);
window.addEventListener('online', () => checkOnline());
window.addEventListener('offline', () => setOfflineState(true));

function scrollToNewItem() {
  setTimeout(() => {
    const lastItem = itemsList.lastElementChild;
    if (lastItem) {
      lastItem.style.transition = 'background-color 0.5s ease';
      lastItem.style.backgroundColor = 'rgba(0, 122, 255, 0.15)';
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => lastItem.style.backgroundColor = '', 1000);
    }
  }, 100);
}

loginBtn.addEventListener('click', async () => {
  const email = emailInput?.value;
  const password = passwordInput?.value;
  if (!email || !password) {
    if (authError) authError.textContent = 'Введите email и пароль';
    return;
  }
  try {
    if (authError) authError.textContent = '';
    await signInWithEmailAndPassword(auth, email, password);
  } catch (error) {
    console.error('Ошибка входа:', error);
    if (authError) authError.textContent = 'Неверный email или пароль';
  }
});

logoutBtn.addEventListener('click', async () => {
  await removeFCMToken();
  signOut(auth).catch(error => console.error('Ошибка выхода:', error));
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    switchTab('shopping');
    initFCMToken();
  } else {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    if (unsubscribeCoffee) unsubscribeCoffee();
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = '';
    coffeeRecipesList.innerHTML = '';
  }
});

function switchTab(tab) {
  currentTab = tab;

  navItems.forEach(nav => {
    nav.classList.remove('active');
    if (nav.dataset.tab === tab) nav.classList.add('active');
  });
  document.querySelector('.content').dataset.tab = tab;

  if (pageTitle) {
    const titles = { shopping: 'Покупки', tasks: 'Задачи', coffee: 'Кофе' };
    pageTitle.textContent = titles[tab] || '';
  }

  const shopButtons = document.getElementById('header-shop-buttons');
  if (shopButtons) shopButtons.style.display = tab === 'shopping' ? 'flex' : 'none';

  if (tab === 'shopping' || tab === 'tasks') {
    if (quickContainer) quickContainer.style.display = tab === 'shopping' ? 'block' : 'none';
    if (inputGroup) inputGroup.style.display = 'flex';
    if (listSection) listSection.style.display = 'block';
    if (coffeeSection) coffeeSection.classList.add('hidden');
    if (listTitle) listTitle.textContent = tab === 'shopping' ? 'Список покупок' : 'Список задач';
    if (itemInput) itemInput.placeholder = tab === 'shopping' ? 'Что купить?..' : 'Новая задача...';
    loadListData();
  } else if (tab === 'coffee') {
    if (quickContainer) quickContainer.style.display = 'none';
    if (inputGroup) inputGroup.style.display = 'none';
    if (listSection) listSection.style.display = 'none';
    if (coffeeSection) coffeeSection.classList.remove('hidden');
    resetCoffeeForm();
    loadCoffeeRecipes();
  }
}

function loadListData() {
  if (unsubscribe) unsubscribe();
  if (!currentUser) return;
  const q = query(collection(db, 'family', 'shared', currentTab), orderBy('createdAt', 'desc'));
  unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) {
      setSyncState('syncing');
    } else {
      setSyncState('synced');
    }
    itemsList.innerHTML = '';
    completedDocIds = [];
    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      const active = [], done = [];
      snapshot.forEach(docSnap => {
        (docSnap.data().completed ? done : active).push(docSnap);
      });
      completedDocIds = done.map(d => d.id);
      active.forEach(docSnap => renderItem(docSnap.id, docSnap.data()));
      done.forEach(docSnap => renderItem(docSnap.id, docSnap.data()));
    }
    updateClearCompletedBtn();
  }, error => console.error('Ошибка загрузки:', error));
}

function updateClearCompletedBtn() {
  if (!clearCompletedBtn) return;
  clearCompletedBtn.classList.toggle('hidden', completedDocIds.length === 0);
}

async function clearCompleted() {
  if (!currentUser || completedDocIds.length === 0) return;
  const ids = [...completedDocIds];
  try {
    const batch = writeBatch(db);
    ids.forEach(id => batch.delete(doc(db, 'family', 'shared', currentTab, id)));
    await batch.commit();
    haptic([10, 30, 10]);
    showToast(`Удалено: ${ids.length}`);
  } catch (error) {
    console.error('Ошибка очистки:', error);
    showToast('Ошибка при очистке', 'error');
  }
}

if (clearCompletedBtn) clearCompletedBtn.addEventListener('click', clearCompleted);

// Функция, которая находит токены других членов семьи и отправляет им пуш
async function notifyFamily(title, body) {
  if (!currentUser) return;
  try {
    const tokensSnap = await getDocs(collection(db, 'family', 'shared', 'tokens'));
    const gasUrl = "https://script.google.com/macros/s/AKfycbzfrr6OKSyPsNZCwtMSQOzRl45N00ftq8PpQb7mbH4-stWmz2prfgglJGy6WocPwQlq7A/exec";

    tokensSnap.forEach(async (docSnap) => {
      const data = docSnap.data();
      // Отправляем пуш всем, кроме самого себя
      if (docSnap.id !== currentUser.uid && data.token) {
        await fetch(gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            token: data.token,
            title: title,
            body: body
          })
        });
      }
    });
  } catch (error) {
    console.error("Ошибка отправки пушей семье:", error);
  }
}

// Обновленная функция добавления товара/задачи
async function addItem() {
  const text = itemInput?.value.trim();
  if (!text || !currentUser) return;
  itemInput.value = '';
  try {
    await addDoc(collection(db, 'family', 'shared', currentTab), {
      text,
      completed: false,
      createdAt: serverTimestamp(),
      createdBy: currentUser.email,
      createdByName: getUserDisplayName(currentUser.email)
    });
    haptic();
    showToast(`Добавлено: ${text}`);
    scrollToNewItem();

    // === ОТПРАВЛЯЕМ ПУШ СЕМЬЕ ===
    const senderName = getUserDisplayName(currentUser.email);
const actionText = currentTab === 'shopping' ? 'добавил в покупки:' : 'добавил в задачи:';
notifyFamily(`${senderName} ${actionText}`, `"${text}"`);
    
  } catch (error) {
    console.error('Ошибка при добавлении:', error);
    showToast('Ошибка при добавлении', 'error');
  }
}
if (addBtn) addBtn.addEventListener('click', addItem);
if (itemInput) itemInput.addEventListener('keypress', e => { if (e.key === 'Enter') addItem(); });

document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const product = btn.dataset.product;
    if (!product || !currentUser) return;
    try {
      await addDoc(collection(db, 'family', 'shared', 'shopping'), {
        text: product,
        completed: false,
        createdAt: serverTimestamp(),
        createdBy: currentUser.email,
        createdByName: getUserDisplayName(currentUser.email)
      });
      haptic();
      showToast(`Добавлено: ${product}`);
      scrollToNewItem();

      // === ОТПРАВЛЯЕМ ПУШ СЕМЬЕ ===
      const senderName = getUserDisplayName(currentUser.email);
      notifyFamily(`${senderName} добавил в покупки:`, `"${product}"`);
    } catch (error) {
      showToast('Ошибка при добавлении', 'error');
    }
  });
});

function renderItem(id, item) {
  if (!itemsList) return;
  const li = document.createElement('li');
  const displayName = item.createdByName || getUserDisplayName(item.createdBy);

  li.innerHTML = `
    <div class="swipe-actions">
      <div class="action-complete">✓ Готово</div>
      <div class="action-delete">🗑️ Удалить</div>
    </div>
    <div class="swipe-content">
      <span class="item-text ${item.completed ? 'completed' : ''}">
        ${escapeHtml(item.text)}
        ${displayName ? `<span class="user-name">${escapeHtml(displayName)}</span>` : ''}
      </span>
      <button class="item-edit" title="Редактировать" aria-label="Редактировать">✎</button>
    </div>
  `;

  const editBtn = li.querySelector('.item-edit');
  const stop = e => e.stopPropagation();
  ['mousedown', 'touchstart', 'click'].forEach(ev => editBtn.addEventListener(ev, stop, ev === 'touchstart' ? { passive: true } : false));

  editBtn.addEventListener('click', () => {
    const content = li.querySelector('.swipe-content');
    if (!content || content.querySelector('.item-edit-input')) return;
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'item-edit-input';
    input.value = item.text;
    content.innerHTML = '';
    content.appendChild(input);
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
    ['mousedown', 'touchstart'].forEach(ev => input.addEventListener(ev, stop, { passive: true }));

    let finished = false;
    const save = async () => {
      if (finished) return;
      finished = true;
      const newText = input.value.trim();
      if (newText && newText !== item.text) {
        try {
          await updateDoc(doc(db, 'family', 'shared', currentTab, id), { text: newText });
          haptic();
          showToast('Изменено');
        } catch (error) {
          console.error('Ошибка редактирования:', error);
          showToast('Ошибка при изменении', 'error');
        }
      }
      if (!newText || newText === item.text) loadListData();
    };
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter') { e.preventDefault(); input.blur(); }
      else if (e.key === 'Escape') { finished = true; loadListData(); }
    });
    input.addEventListener('blur', save);
  });

  const swipeContent = li.querySelector('.swipe-content');
  let startX = 0, startY = 0, translateX = 0, isSwiping = false;
  const threshold = 80;
  const getX = e => e.touches ? e.touches[0].clientX : e.clientX;
  const getY = e => e.touches ? e.touches[0].clientY : e.clientY;

  const start = e => {
    startX = getX(e);
    startY = getY(e);
    isSwiping = true;
    li.classList.remove('swiping-right', 'swiping-left');
  };

  const move = e => {
    if (!isSwiping) return;
    translateX = getX(e) - startX;
    const translateY = getY(e) - startY;
    if (Math.abs(translateX) > Math.abs(translateY) && Math.abs(translateX) > 10) {
      e.preventDefault();
    } else if (Math.abs(translateY) > Math.abs(translateX)) {
      return;
    }
    if (translateX > 120) translateX = 120;
    if (translateX < -120) translateX = -120;
    if (swipeContent) swipeContent.style.transform = `translateX(${translateX}px)`;
    if (translateX > 20) {
      li.classList.add('swiping-right'); li.classList.remove('swiping-left');
    } else if (translateX < -20) {
      li.classList.add('swiping-left'); li.classList.remove('swiping-right');
    } else {
      li.classList.remove('swiping-right', 'swiping-left');
    }
  };

  const end = async () => {
    if (!isSwiping) return;
    isSwiping = false;
    li.classList.remove('swiping-right', 'swiping-left');
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', end);
    try {
      if (translateX > threshold) {
        haptic();
        await updateDoc(doc(db, 'family', 'shared', currentTab, id), { completed: !item.completed });
        showToast(!item.completed ? 'Выполнено' : 'Возвращено');
      } else if (translateX < -threshold) {
        haptic([10, 30, 10]);
        li.style.transition = 'all 0.3s ease';
        li.style.transform = 'translateX(-100%)';
        li.style.opacity = '0';
        showToast('Удалено');
        setTimeout(async () => {
          await deleteDoc(doc(db, 'family', 'shared', currentTab, id));
        }, 300);
      } else if (swipeContent) {
        swipeContent.style.transform = 'translateX(0px)';
      }
    } catch (error) {
      console.error('Ошибка:', error);
      if (swipeContent) swipeContent.style.transform = 'translateX(0px)';
    }
    translateX = 0;
  };

  li.addEventListener('touchstart', start, { passive: true });
  li.addEventListener('touchmove', move, { passive: false });
  li.addEventListener('touchend', end);
  li.addEventListener('mousedown', e => {
    start(e);
    document.addEventListener('mousemove', move);
    document.addEventListener('mouseup', end);
  });

  itemsList.appendChild(li);
}

navItems.forEach(nav => nav.addEventListener('click', () => switchTab(nav.dataset.tab)));

const quickToggle = document.getElementById('quick-toggle');
const quickGrid = document.getElementById('quick-grid');
const quickArrow = document.getElementById('quick-arrow');
if (quickToggle && quickGrid && quickArrow) {
  let isQuickExpanded = false;
  quickGrid.classList.add('collapsed');
  quickArrow.classList.add('collapsed');
  quickToggle.addEventListener('click', () => {
    isQuickExpanded = !isQuickExpanded;
    quickGrid.classList.toggle('collapsed', !isQuickExpanded);
    quickArrow.classList.toggle('collapsed', !isQuickExpanded);
  });
}

function updateCoffeeAge() {
  const dateStr = coffeeRoastDate.value;
  if (!dateStr) { coffeeAgeSpan.textContent = '— дней'; return; }
  const roastDate = new Date(dateStr);
  const today = new Date();
  roastDate.setHours(0,0,0,0); today.setHours(0,0,0,0);
  const diffDays = Math.floor((today - roastDate) / 86400000);
  coffeeAgeSpan.textContent = diffDays >= 0 ? `${diffDays} дн.` : '— дней';
}

let editingCoffeeId = null;

function setCoffeeFormMode(editing) {
  const summary = document.querySelector('#coffee-form-details .coffee-summary span');
  if (summary) summary.textContent = editing ? 'Редактирование рецепта' : 'Новый рецепт';
  if (coffeeSaveBtn) coffeeSaveBtn.textContent = editing ? 'Сохранить изменения' : 'Сохранить рецепт';
}

function startEditCoffeeRecipe(id, data) {
  editingCoffeeId = id;
  coffeeName.value = data.name || '';
  coffeeProcessing.value = data.processing || '';
  coffeeRoastDate.value = data.roastDate || '';
  updateCoffeeAge();
  coffeeDose.value = data.dose ?? '';
  coffeeGrind.value = data.grind ?? '';
  coffeeTemp.value = data.temp ?? '';
  coffeeWater.value = data.totalWater ?? '';
  if (coffeeNotes) coffeeNotes.value = data.notes || '';
  setCoffeeRating(data.rating || 0);
  setCoffeeFormMode(true);
  const details = document.getElementById('coffee-form-details');
  if (details) {
    details.setAttribute('open', '');
    details.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function resetCoffeeForm() {
  editingCoffeeId = null;
  setCoffeeFormMode(false);
  const details = document.getElementById('coffee-form-details');
  if (details) details.removeAttribute('open');
  coffeeName.value = '';
  coffeeProcessing.value = '';
  coffeeRoastDate.value = '';
  coffeeAgeSpan.textContent = '— дней';
  coffeeDose.value = '';
  coffeeGrind.value = '';
  coffeeTemp.value = '';
  coffeeWater.value = '';
  if (coffeeNotes) coffeeNotes.value = '';
  setCoffeeRating(0);
}

if (coffeeSaveBtn) coffeeSaveBtn.addEventListener('click', async () => {
  if (!currentUser) return;
  const name = coffeeName.value.trim();
  if (!name) { showToast('Введите название', 'error'); return; }
  const recipe = {
    name,
    processing: coffeeProcessing.value.trim() || null,
    roastDate: coffeeRoastDate.value || null,
    dose: coffeeDose.value ? parseFloat(coffeeDose.value) : null,
    grind: coffeeGrind.value ? parseInt(coffeeGrind.value) : null,
    temp: coffeeTemp.value ? parseFloat(coffeeTemp.value) : null,
    totalWater: coffeeWater.value ? parseInt(coffeeWater.value) : null,
    notes: coffeeNotes && coffeeNotes.value.trim() ? coffeeNotes.value.trim() : null,
    rating: coffeeRating || null
  };
  try {
    if (editingCoffeeId) {
      await updateDoc(doc(db, 'family', 'shared', 'coffee', editingCoffeeId), recipe);
      haptic();
      showToast('Рецепт обновлён');
      resetCoffeeForm();
    } else {
      recipe.createdBy = currentUser.email;
      recipe.createdAt = serverTimestamp();
      await addDoc(collection(db, 'family', 'shared', 'coffee'), recipe);
      haptic();
      showToast('Рецепт сохранён');
      resetCoffeeForm();

      // === ОТПРАВЛЯЕМ ПУШ СЕМЬЕ ===
      const senderName = getUserDisplayName(currentUser.email);
      notifyFamily(`${senderName} добавил рецепт кофе:`, `"${name}"`);
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('Ошибка', 'error');
  }
});

function loadCoffeeRecipes() {
  if (unsubscribeCoffee) unsubscribeCoffee();
  const q = query(collection(db, 'family', 'shared', 'coffee'), orderBy('createdAt', 'desc'));
  unsubscribeCoffee = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
    if (snapshot.metadata.hasPendingWrites || snapshot.metadata.fromCache) {
      setSyncState('syncing');
    } else {
      setSyncState('synced');
    }
    coffeeRecipesList.innerHTML = '';
    snapshot.forEach(docSnap => renderCoffeeRecipe(docSnap.id, docSnap.data()));
  }, error => console.error('Ошибка загрузки рецептов:', error));
}

function renderCoffeeRecipe(id, data) {
  const card = document.createElement('div');
  card.className = 'coffee-recipe-card';
  let roastDateStr = null;
  if (data.roastDate) {
    const d = new Date(data.roastDate);
    roastDateStr = d.toLocaleDateString('ru-RU');
    const roast = new Date(data.roastDate); roast.setHours(0, 0, 0, 0);
    const today = new Date(); today.setHours(0, 0, 0, 0);
    const diffDays = Math.floor((today - roast) / 86400000);
    if (diffDays >= 0) roastDateStr += ` (${diffDays} дн.)`;
  }
  const meta = [data.processing, roastDateStr].filter(Boolean).map(escapeHtml).join(' · ');

  const params = [
    data.dose       ? { label: 'Доза',  value: `${data.dose} г`       } : null,
    data.grind      ? { label: 'Помол', value: `${data.grind} кл`     } : null,
    data.temp       ? { label: 'Темп.', value: `${data.temp} °C`      } : null,
    data.totalWater ? { label: 'Вода',  value: `${data.totalWater} мл`} : null,
  ].filter(Boolean);

  const ratingStr = data.rating ? '★'.repeat(data.rating) + '☆'.repeat(5 - data.rating) : '';

  if (!expandedRecipes.has(id)) card.classList.add('collapsed');

  card.innerHTML = `
    <div class="coffee-recipe-header">
      <div class="coffee-recipe-name">${escapeHtml(data.name)}</div>
      <button class="coffee-recipe-edit" data-id="${id}">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M11.3 2.1l2.6 2.6L5.5 13.1l-3.2.6.6-3.2 8.4-8.4z" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <button class="coffee-recipe-delete" data-id="${id}">✕</button>
      <span class="coffee-recipe-chevron">
        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
          <path d="M4 6l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </span>
    </div>
    <div class="coffee-recipe-body">
      <div class="coffee-recipe-body-inner">
        ${ratingStr ? `<div class="coffee-recipe-rating">${ratingStr}</div>` : ''}
        ${meta ? `<div class="coffee-recipe-meta">${meta}</div>` : ''}
        ${params.length ? `
          <div class="coffee-recipe-params">
            ${params.map(p => `
              <div class="coffee-param">
                <span class="param-label">${p.label}</span>
                <span class="param-value">${p.value}</span>
              </div>
            `).join('')}
          </div>
        ` : ''}
        ${data.notes ? `<div class="coffee-recipe-notes">${escapeHtml(data.notes)}</div>` : ''}
      </div>
    </div>
  `;

  card.querySelector('.coffee-recipe-header').addEventListener('click', () => {
    const collapsed = card.classList.toggle('collapsed');
    if (collapsed) expandedRecipes.delete(id);
    else expandedRecipes.add(id);
  });

  card.querySelector('.coffee-recipe-edit').addEventListener('click', (e) => {
    e.stopPropagation();
    startEditCoffeeRecipe(id, data);
  });

  card.querySelector('.coffee-recipe-delete').addEventListener('click', async (e) => {
    e.stopPropagation();
    if (confirm('Удалить рецепт?')) {
      try {
        await deleteDoc(doc(db, 'family', 'shared', 'coffee', id));
        showToast('Рецепт удалён');
      } catch (error) {
        showToast('Ошибка', 'error');
      }
    }
  });

  coffeeRecipesList.appendChild(card);
}

if (coffeeRoastDate) {
  coffeeRoastDate.addEventListener('change', updateCoffeeAge);
  coffeeRoastDate.addEventListener('blur', updateCoffeeAge);
}

window.updateCoffeeAge = updateCoffeeAge;

function showQRModal(imageSrc, storeName) {
  if (document.querySelector('.qr-modal')) return;
  const modal = document.createElement('div');
  modal.className = 'qr-modal';
  const content = document.createElement('div');
  content.className = 'qr-modal-content';
  const img = document.createElement('img');
  img.src = imageSrc;
  img.alt = `QR-код ${storeName}`;
  const closeBtn = document.createElement('button');
  closeBtn.className = 'qr-modal-close';
  closeBtn.innerHTML = '✕';
  closeBtn.addEventListener('click', () => modal.remove());
  content.appendChild(img);
  content.appendChild(closeBtn);
  modal.appendChild(content);
  modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  document.body.appendChild(modal);
}

const qrMagnitBtn = document.getElementById('qr-magnit-btn');
const qrPyaterochkaBtn = document.getElementById('qr-pyaterochka-btn');
if (qrMagnitBtn) qrMagnitBtn.addEventListener('click', () => showQRModal('icons/qr-magnit.png', 'Магнит'));
if (qrPyaterochkaBtn) qrPyaterochkaBtn.addEventListener('click', () => showQRModal('icons/qr-pyaterochka.png', 'Пятёрочка'));

const notifBtn = document.getElementById('notif-btn');
if (notifBtn) {
  notifBtn.addEventListener('click', async () => {
    showToast('🔔 нажато…', 'success');
    if (!('Notification' in window)) {
      showToast('Push доступен только в установленной PWA', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('Разрешите уведомления в настройках телефона', 'warning');
      return;
    }
    
    if (Notification.permission === 'granted' && currentFCMToken) {
      try {
        showToast('Отправка в Apps Script...', 'success');
        
        // Ссылка на твой Google Apps Script
        const gasUrl = "https://script.google.com/macros/s/AKfycbzfrr6OKSyPsNZCwtMSQOzRl45N00ftq8PpQb7mbH4-stWmz2prfgglJGy6WocPwQlq7A/exec";
        
        const response = await fetch(gasUrl, {
          method: 'POST',
          body: JSON.stringify({
            token: currentFCMToken,
            title: "НАШ ДОМ 🚀",
            body: "Проверка связи с рабочим столом!"
          })
        });

        const resData = await response.json();
        if (resData.status === 'success') {
          showToast('Успешно отправлено!', 'success');
        } else {
          showToast('Ошибка: ' + resData.message, 'error');
        }
      } catch (error) {
        console.error('Ошибка:', error);
        showToast('Ошибка сети Apps Script', 'error');
      }
      return;
    }
    
    await initFCMToken(true);
  });
  updateNotifBtn();
}

// ── Скрытие нижней навигации при скролле вниз, появление при скролле вверх ──
(() => {
  const nav = document.querySelector('.bottom-nav');
  const content = document.querySelector('.content');
  if (!nav || !content) return;

  let lastY = 0;
  const THRESHOLD = 8; // игнорируем микродвижения

  content.addEventListener('scroll', () => {
    const y = content.scrollTop;
    const maxY = content.scrollHeight - content.clientHeight;

    // У края (верх/низ, включая резиновый оверскролл iOS) — всегда показываем
    if (y <= 0 || y >= maxY) {
      nav.classList.remove('nav-hidden');
      lastY = Math.max(0, Math.min(y, maxY));
      return;
    }

    const delta = y - lastY;
    if (Math.abs(delta) < THRESHOLD) return;

    nav.classList.toggle('nav-hidden', delta > 0);
    lastY = y;
  }, { passive: true });
})();
