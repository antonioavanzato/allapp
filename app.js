import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy,
  serverTimestamp, setDoc, where, getDoc, writeBatch
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const APP_VERSION = 'v9';
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
  appId: "1:492414694516:web:f4fa51805c05e5c545cd21"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const functions = getFunctions(app);

const VAPID_KEY = 'BC-iAqJhSKu2rylPzZnHypaJtx67mOu5_BHDUJMOUDSDlIfnWQo-1AZBKfnyk-EUSl51laRaJanX1sGEbnLob9Q';
let currentFCMToken = null;
let swRegistration = null; // Сохраняем объект регистрации глобально для использования в getToken

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
    // Регистрируем ОДИН объединенный Service Worker
    navigator.serviceWorker.register('firebase-messaging-sw.js').then((registration) => {
      swRegistration = registration; // Записываем регистрацию для получения токена

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
    }).catch((err) => {
      console.error('Ошибка регистрации Service Worker:', err);
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

async function initFCMToken() {
  try {
    if (!('Notification' in window)) return;
    
    // 1. Запрашиваем разрешение
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;

    // 2. Ждем, когда Service Worker гарантированно станет ACTIVE в системе.
    // Браузер вернет готовую регистрацию только тогда, когда статус воркера станет active.
    const activeRegistration = await navigator.serviceWorker.ready;

    if (!activeRegistration) {
      console.error('Service Worker не найден или не готов');
      return;
    }

    // 3. Запрашиваем токен, передавая строго активный воркер
    const token = await getToken(messaging, { 
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: activeRegistration // Используем гарантированно активный воркер
    });

    if (!token) return;
    currentFCMToken = token;
    
    const saveToken = httpsCallable(functions, 'saveUserToken');
    await saveToken({ token });
    updateNotifBtn();
  } catch (error) {
    console.error('Ошибка FCM:', error);
    alert(`Ошибка регистрации уведомлений: ${error.message || error}`);
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
  if (!currentFCMToken) return;
  try {
    const removeToken = httpsCallable(functions, 'removeUserToken');
    await removeToken({ token: currentFCMToken });
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
    } catch (error) {
      showToast('Ошибка при добавлении', 'error');
    }
  });
});

function renderItem(id, item) {
  if (!itemsList) return;
  const li = document.createElement('li');
  const displayName = item.createdByName || getUserDisplayName(item.createdBy);
  const isShopping = currentTab === 'shopping';
  const qty = item.qty && item.qty > 0 ? item.qty : 1;

  const qtyHtml = isShopping ? `
      <div class="item-qty">
        <button class="qty-btn qty-minus" aria-label="Меньше">−</button>
        <span class="qty-value">${qty}</span>
        <button class="qty-btn qty-plus" aria-label="Больше">+</button>
      </div>` : '';

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
      ${qtyHtml}
      <button class="item-edit" title="Редактировать" aria-label="Редактировать">✎</button>
    </div>
  `;

  const qtyEl = li.querySelector('.item-qty');
  if (qtyEl) {
    const stopQty = e => e.stopPropagation();
    ['mousedown', 'touchstart', 'click'].forEach(ev =>
      qtyEl.addEventListener(ev, stopQty, ev === 'touchstart' ? { passive: true } : false));
    const setQty = async (newQty) => {
      newQty = Math.max(1, newQty);
      if (newQty === qty) return;
      haptic(8);
      try {
        await updateDoc(doc(db, 'family', 'shared', currentTab, id), { qty: newQty });
      } catch (error) {
        console.error('Ошибка количества:', error);
        showToast('Ошибка', 'error');
      }
    };
    qtyEl.querySelector('.qty-plus').addEventListener('click', () => setQty(qty + 1));
    qtyEl.querySelector('.qty-minus').addEventListener('click', () => setQty(qty - 1));
  }

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

function resetCoffeeForm() {
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
    rating: coffeeRating || null,
    createdBy: currentUser.email,
    createdAt: serverTimestamp()
  };
  try {
    await addDoc(collection(db, 'family', 'shared', 'coffee'), recipe);
    haptic();
    showToast('Рецепт сохранён');
    resetCoffeeForm();
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

  card.innerHTML = `
    <div class="coffee-recipe-header">
      <div class="coffee-recipe-name">${escapeHtml(data.name)}</div>
      <button class="coffee-recipe-delete" data-id="${id}">✕</button>
    </div>
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
  `;

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
    if (!('Notification' in window)) {
      showToast('Уведомления не поддерживаются', 'error');
      return;
    }
    if (Notification.permission === 'denied') {
      showToast('Разрешите уведомления в настройках телефона', 'warning');
      return;
    }
    if (Notification.permission === 'granted' && currentFCMToken) {
      try {
        const testNotif = httpsCallable(functions, 'testNotification');
        const res = await testNotif();
        if (res.data?.success) {
          showToast(`Тест отправлен (${res.data.sent})`, 'success');
        } else {
          showToast(res.data?.message || 'Нет токенов', 'warning');
        }
      } catch (error) {
        console.error('Ошибка теста уведомлений:', error);
        showToast('Ошибка отправки теста', 'error');
      }
      return;
    }
    await initFCMToken();
  });
  updateNotifBtn();
}
