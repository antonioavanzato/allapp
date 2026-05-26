import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import {
  getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy,
  serverTimestamp, setDoc, where, getDoc
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";
import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-functions.js";

const firebaseConfig = {
  apiKey: "AIzaSyAICtDB0Rie_2W2DAoX0MOJm7kDSbTAEUA",
  authDomain: "allapp-16e47.firebaseapp.com",
  projectId: "allapp-16e47",
  storageBucket: "allapp-16e47.firebasestorage.app",
  messagingSenderId: "492414694516",
  appId: "1:492414694516:web:f4fa51805c05e6c545cd21"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);
const messaging = getMessaging(app);
const functions = getFunctions(app);

const VAPID_KEY = 'BC-iAqJhSKu2rylPzZnHypaJtx67mOu5_BHDUJMOUDSDlIfnWQo-1AZBKfnyk-EUSl51laRaJanX1sGEbnLob9Q';
let currentFCMToken = null;

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('firebase-messaging-sw.js');
    navigator.serviceWorker.register('sw.js').then((registration) => {
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing;
        newWorker.addEventListener('statechange', () => {
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            showToast('Доступно обновление — перезагрузите страницу', 'warning');
          }
        });
      });
    });
  });
}

async function initFCMToken() {
  try {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return;
    const token = await getToken(messaging, { vapidKey: VAPID_KEY });
    if (!token) return;
    currentFCMToken = token;
    const saveToken = httpsCallable(functions, 'saveUserToken');
    await saveToken({ token });
  } catch (error) {
    console.error('Ошибка FCM:', error);
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

const coffeeName = document.getElementById('coffee-name');
const coffeeProcessing = document.getElementById('coffee-processing');
const coffeeRoastDate = document.getElementById('coffee-roast-date');
const coffeeAgeSpan = document.getElementById('coffee-age');
const coffeeDose = document.getElementById('coffee-dose');
const coffeeGrind = document.getElementById('coffee-grind');
const coffeeTemp = document.getElementById('coffee-temp');
const coffeeWater = document.getElementById('coffee-water');
const coffeeSaveBtn = document.getElementById('coffee-save');
const coffeeRecipesList = document.getElementById('coffee-recipes-list');

let currentTab = 'shopping';
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

function setOfflineState(isOffline) {
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
  unsubscribe = onSnapshot(q, (snapshot) => {
    itemsList.innerHTML = '';
    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      snapshot.forEach(docSnap => renderItem(docSnap.id, docSnap.data()));
    }
  }, error => console.error('Ошибка загрузки:', error));
}

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

  li.innerHTML = `
    <div class="swipe-actions">
      <div class="action-complete">✓ Готово</div>
      <div class="action-delete">🗑️ Удалить</div>
    </div>
    <div class="swipe-content">
      <span class="item-text ${item.completed ? 'completed' : ''}">
        ${item.text}
        ${displayName ? `<span class="user-name">${displayName}</span>` : ''}
      </span>
    </div>
  `;

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
        await updateDoc(doc(db, 'family', 'shared', currentTab, id), { completed: !item.completed });
        showToast(!item.completed ? 'Выполнено' : 'Возвращено');
      } else if (translateX < -threshold) {
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
}

coffeeSaveBtn.addEventListener('click', async () => {
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
    createdBy: currentUser.email,
    createdAt: serverTimestamp()
  };
  try {
    await addDoc(collection(db, 'family', 'shared', 'coffee'), recipe);
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
  unsubscribeCoffee = onSnapshot(q, (snapshot) => {
    coffeeRecipesList.innerHTML = '';
    snapshot.forEach(docSnap => renderCoffeeRecipe(docSnap.id, docSnap.data()));
  }, error => console.error('Ошибка загрузки рецептов:', error));
}

function renderCoffeeRecipe(id, data) {
  const card = document.createElement('div');
  card.className = 'coffee-recipe-card';
  const roastDateStr = data.roastDate ? new Date(data.roastDate).toLocaleDateString('ru-RU') : null;

  card.innerHTML = `
    <div class="coffee-recipe-name">${data.name}</div>
    <div class="coffee-recipe-detail">
      ${data.processing ? `<span><span class="material-symbols-outlined">eco</span> ${data.processing}</span>` : ''}
      ${roastDateStr ? `<span><span class="material-symbols-outlined">calendar_today</span> ${roastDateStr}</span>` : ''}
      ${data.dose ? `<span><span class="material-symbols-outlined">scale</span> ${data.dose} г</span>` : ''}
    </div>
    <div class="coffee-recipe-detail">
      ${data.grind ? `<span><span class="material-symbols-outlined">tune</span> Помол: ${data.grind}</span>` : ''}
      ${data.temp ? `<span><span class="material-symbols-outlined">thermostat</span> ${data.temp} °C</span>` : ''}
      ${data.totalWater ? `<span><span class="material-symbols-outlined">water_drop</span> ${data.totalWater} мл</span>` : ''}
    </div>
    <div class="coffee-recipe-actions">
      <button class="coffee-recipe-delete" data-id="${id}">
        <span class="material-symbols-outlined">delete</span>
      </button>
    </div>
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
