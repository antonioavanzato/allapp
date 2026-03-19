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

// ── FCM ──
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
    console.log('FCM токен сохранён');
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

// Показываем уведомление через toast когда приложение открыто
onMessage(messaging, (payload) => {
  const title = payload.notification?.title || '';
  const body = payload.notification?.body || '';
  showToast(`${title}: ${body}`);
});

// ── DOM ──
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
const calendarContainer = document.getElementById('albus-calendar');
const coffeeSection = document.getElementById('coffee-section');

const calendarDays = document.getElementById('calendar-days');
const currentMonthSpan = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

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
const coffeeChartCanvas = document.getElementById('coffee-chart');
const coffeePointsList = document.getElementById('coffee-points-list');
const pointTimeInput = document.getElementById('point-time');
const pointWaterInput = document.getElementById('point-water');
const addPointBtn = document.getElementById('add-point-btn');

let currentTab = 'shopping';
let unsubscribe = null;
let unsubscribeCalendar = null;
let unsubscribeCoffee = null;
let currentUser = null;
let currentCalendarDate = new Date();
let currentPoints = [];

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

// ── Toast ──
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  toast.textContent = `${icons[type] || '✅'} ${message}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

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

// ── Auth ──
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
    if (unsubscribeCalendar) unsubscribeCalendar();
    if (unsubscribeCoffee) unsubscribeCoffee();
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = '';
    coffeeRecipesList.innerHTML = '';
  }
});

// ── Tabs ──
function switchTab(tab) {
  currentTab = tab;

  navItems.forEach(nav => {
    nav.classList.remove('active');
    if (nav.dataset.tab === tab) nav.classList.add('active');
  });

  if (pageTitle) {
    const titles = { shopping: 'Покупки', tasks: 'Задачи', albus: 'Альбус', coffee: 'Кофе' };
    pageTitle.textContent = titles[tab] || '';
  }

  const shopButtons = document.getElementById('header-shop-buttons');
  if (shopButtons) shopButtons.style.display = tab === 'shopping' ? 'flex' : 'none';

  if (tab === 'shopping' || tab === 'tasks') {
    if (quickContainer) quickContainer.style.display = tab === 'shopping' ? 'block' : 'none';
    if (inputGroup) inputGroup.style.display = 'flex';
    if (listSection) listSection.style.display = 'block';
    if (calendarContainer) calendarContainer.classList.add('hidden');
    if (coffeeSection) coffeeSection.classList.add('hidden');
    if (listTitle) listTitle.textContent = tab === 'shopping' ? 'Список покупок' : 'Список задач';
    if (itemInput) itemInput.placeholder = tab === 'shopping' ? 'Что купить?..' : 'Новая задача...';
    loadListData();
  } else if (tab === 'albus') {
    if (quickContainer) quickContainer.style.display = 'none';
    if (inputGroup) inputGroup.style.display = 'none';
    if (listSection) listSection.style.display = 'none';
    if (calendarContainer) calendarContainer.classList.remove('hidden');
    if (coffeeSection) coffeeSection.classList.add('hidden');
    loadCalendar();
  } else if (tab === 'coffee') {
    if (quickContainer) quickContainer.style.display = 'none';
    if (inputGroup) inputGroup.style.display = 'none';
    if (listSection) listSection.style.display = 'none';
    if (calendarContainer) calendarContainer.classList.add('hidden');
    if (coffeeSection) coffeeSection.classList.remove('hidden');
    resetCoffeeForm();
    loadCoffeeRecipes();
  }
}

// ── List ──
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

// ИСПРАВЛЕНО: mousemove только во время свайпа
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
  let startX = 0, translateX = 0, isSwiping = false;
  const threshold = 80;
  const getX = e => e.touches ? e.touches[0].clientX : e.clientX;

  const start = e => {
    startX = getX(e);
    isSwiping = true;
    li.classList.remove('swiping-right', 'swiping-left');
  };

  const move = e => {
    if (!isSwiping) return;
    translateX = getX(e) - startX;
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

// Быстрые продукты
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

// ── Календарь ──
function loadCalendar() {
  if (unsubscribeCalendar) unsubscribeCalendar();
  renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
}

function renderCalendar(year, month) {
  const monthNames = ['Январь','Февраль','Март','Апрель','Май','Июнь','Июль','Август','Сентябрь','Октябрь','Ноябрь','Декабрь'];
  currentMonthSpan.textContent = `${monthNames[month]} ${year}`;

  const firstDay = new Date(year, month, 1);
  const startOffset = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const pad = n => String(n).padStart(2, '0');

  const daysArray = [];
  for (let i = 0; i < startOffset; i++) daysArray.push(null);
  for (let d = 1; d <= daysInMonth; d++) daysArray.push(d);

  const q = query(
    collection(db, 'family', 'shared', 'albus'),
    where('date', '>=', `${year}-${pad(month+1)}-01`),
    where('date', '<=', `${year}-${pad(month+1)}-${pad(daysInMonth)}`)
  );

  if (unsubscribeCalendar) unsubscribeCalendar();
  unsubscribeCalendar = onSnapshot(q, (snapshot) => {
    const takenMap = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      takenMap[data.date] = data.taken;
    });

    calendarDays.innerHTML = '';
    daysArray.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      if (day === null) {
        dayDiv.classList.add('empty');
      } else {
        const dateStr = `${year}-${pad(month+1)}-${pad(day)}`;
        dayDiv.textContent = day;
        if (takenMap[dateStr] === true) dayDiv.classList.add('taken');
        dayDiv.dataset.date = dateStr;
        dayDiv.addEventListener('click', () => handleDayClick(dateStr));
      }
      calendarDays.appendChild(dayDiv);
    });
  });
}

async function handleDayClick(dateStr) {
  if (!currentUser) return;
  const docRef = doc(db, 'family', 'shared', 'albus', dateStr);
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const current = docSnap.data().taken;
      await updateDoc(docRef, { taken: !current });
      showToast(!current ? 'Отмечено' : 'Отмена');
    } else {
      await setDoc(docRef, {
        date: dateStr,
        taken: true,
        createdBy: currentUser.email,
        createdAt: serverTimestamp()
      });
      showToast('Отмечено');
    }
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('Ошибка', 'error');
  }
}

if (prevMonthBtn) prevMonthBtn.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
  renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
});
if (nextMonthBtn) nextMonthBtn.addEventListener('click', () => {
  currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
  renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
});

// ── Кофе: график ──
function parseTimeString(str) {
  if (!str) return 0;
  const parts = str.split(':');
  if (parts.length === 2) return (parseInt(parts[0], 10) || 0) * 60 + (parseInt(parts[1], 10) || 0);
  return parseInt(str, 10) || 0;
}

function formatTime(seconds) {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
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

function buildChartPoints(points, totalWater) {
  const sorted = [...points].sort((a, b) => a.time - b.time);
  const all = [{ time: 0, water: 0 }, ...sorted];
  if (totalWater > 0 && sorted.length > 0) {
    const last = sorted[sorted.length - 1];
    if (totalWater >= last.water) all.push({ time: last.time + 10, water: totalWater });
  } else if (totalWater > 0) {
    all.push({ time: 30, water: totalWater });
  }
  return all;
}

function drawStepChart(canvas, allPoints) {
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  const { width, height } = canvas;
  ctx.clearRect(0, 0, width, height);

  if (allPoints.length < 2) {
    ctx.font = '12px -apple-system';
    ctx.fillStyle = '#8e8e93';
    ctx.textAlign = 'center';
    ctx.fillText('Добавьте точки вливания', width / 2, height / 2);
    return;
  }

  const margin = { left: 45, top: 20, right: 20, bottom: 35 };
  const graphW = width - margin.left - margin.right;
  const graphH = height - margin.top - margin.bottom;
  const maxTime = Math.max(...allPoints.map(p => p.time));
  const maxWater = Math.max(...allPoints.map(p => p.water));
  if (!maxTime || !maxWater) return;

  const toX = t => margin.left + (t / maxTime) * graphW;
  const toY = w => (height - margin.bottom) - (w / maxWater) * graphH;

  // Сетка
  ctx.strokeStyle = 'rgba(142,142,147,0.25)';
  ctx.lineWidth = 0.5;
  for (let i = 0; i <= 4; i++) {
    const y = toY((maxWater * i) / 4);
    ctx.beginPath(); ctx.moveTo(margin.left, y); ctx.lineTo(width - margin.right, y); ctx.stroke();
    const x = toX((maxTime * i) / 4);
    ctx.beginPath(); ctx.moveTo(x, margin.top); ctx.lineTo(x, height - margin.bottom); ctx.stroke();
  }

  // Оси
  ctx.strokeStyle = '#8e8e93';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(margin.left, margin.top);
  ctx.lineTo(margin.left, height - margin.bottom);
  ctx.lineTo(width - margin.right, height - margin.bottom);
  ctx.stroke();

  // Заливка
  ctx.fillStyle = 'rgba(255,159,10,0.08)';
  ctx.beginPath();
  ctx.moveTo(toX(allPoints[0].time), toY(allPoints[0].water));
  for (let i = 1; i < allPoints.length; i++) {
    ctx.lineTo(toX(allPoints[i-1].time), toY(allPoints[i].water));
    ctx.lineTo(toX(allPoints[i].time), toY(allPoints[i].water));
  }
  ctx.lineTo(toX(allPoints[allPoints.length-1].time), toY(0));
  ctx.lineTo(toX(0), toY(0));
  ctx.closePath();
  ctx.fill();

  // Линия
  ctx.strokeStyle = '#ff9f0a';
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.beginPath();
  ctx.moveTo(toX(allPoints[0].time), toY(allPoints[0].water));
  for (let i = 1; i < allPoints.length; i++) {
    ctx.lineTo(toX(allPoints[i-1].time), toY(allPoints[i].water));
    ctx.lineTo(toX(allPoints[i].time), toY(allPoints[i].water));
  }
  ctx.stroke();

  // Точки
  allPoints.slice(1).forEach(p => {
    const x = toX(p.time), y = toY(p.water);
    ctx.beginPath(); ctx.arc(x, y, 5, 0, 2*Math.PI);
    ctx.fillStyle = '#ffffff'; ctx.fill();
    ctx.beginPath(); ctx.arc(x, y, 3.5, 0, 2*Math.PI);
    ctx.fillStyle = '#ff9f0a'; ctx.fill();
  });

  // Подписи
  ctx.font = '10px -apple-system';
  ctx.fillStyle = '#8e8e93';
  ctx.textAlign = 'center';
  ctx.fillText('Время (сек)', width / 2, height - 2);
  ctx.save();
  ctx.translate(12, height / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.fillText('Вода (мл)', 0, 0);
  ctx.restore();
  ctx.font = '9px -apple-system';
  ctx.textAlign = 'right';
  for (let i = 0; i <= 4; i++) ctx.fillText(Math.round((maxWater*i)/4), margin.left - 5, toY((maxWater*i)/4) + 3);
  ctx.textAlign = 'center';
  for (let i = 1; i <= 4; i++) ctx.fillText(Math.round((maxTime*i)/4), toX((maxTime*i)/4), height - margin.bottom + 12);
}

function drawChart(canvas, points) {
  const totalWater = parseFloat(coffeeWater?.value) || 0;
  drawStepChart(canvas, buildChartPoints(points, totalWater));
}

function drawChartWithPoints(canvas, points) {
  drawStepChart(canvas, buildChartPoints(points, 0));
}

function renderPointsList() {
  if (!coffeePointsList) return;
  coffeePointsList.innerHTML = '';
  currentPoints.forEach((point, index) => {
    const tag = document.createElement('span');
    tag.className = 'coffee-point-tag';
    tag.innerHTML = `${formatTime(point.time)} / ${point.water}мл <button class="remove-point" data-index="${index}">✕</button>`;
    tag.querySelector('.remove-point').addEventListener('click', (e) => {
      e.stopPropagation();
      currentPoints.splice(index, 1);
      renderPointsList();
    });
    coffeePointsList.appendChild(tag);
  });
  drawChart(coffeeChartCanvas, currentPoints);
}

addPointBtn.addEventListener('click', () => {
  const timeStr = pointTimeInput.value.trim();
  const water = parseFloat(pointWaterInput.value);
  if (!timeStr || isNaN(water) || water < 0) { showToast('Введите корректные значения', 'error'); return; }
  const timeSeconds = parseTimeString(timeStr);
  if (isNaN(timeSeconds) || timeSeconds < 0) { showToast('Некорректный формат времени', 'error'); return; }
  currentPoints.push({ time: timeSeconds, water });
  currentPoints.sort((a, b) => a.time - b.time);
  pointTimeInput.value = '';
  pointWaterInput.value = '';
  renderPointsList();
});

function resetCoffeeForm() {
  coffeeName.value = '';
  coffeeProcessing.value = '';
  coffeeRoastDate.value = '';
  coffeeAgeSpan.textContent = '— дней';
  coffeeDose.value = '';
  coffeeGrind.value = '';
  coffeeTemp.value = '';
  coffeeWater.value = '';
  currentPoints = [];
  renderPointsList();
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
    points: currentPoints,
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
  const pointsStr = data.points?.length > 0 ? data.points.map(p => `${formatTime(p.time)} / ${p.water}мл`).join(', ') : '';
  const canvasId = `chart-${id}`;

  card.innerHTML = `
    <div class="coffee-recipe-name">${data.name}</div>
    <div class="coffee-recipe-detail">
      ${data.processing ? `<span>🌱 ${data.processing}</span>` : ''}
      ${roastDateStr ? `<span>🔥 Обжарка: ${roastDateStr}</span>` : ''}
      ${data.dose ? `<span>⚖️ ${data.dose}г</span>` : ''}
    </div>
    <div class="coffee-recipe-detail">
      ${data.grind ? `<span>⚙️ Помол: ${data.grind}</span>` : ''}
      ${data.temp ? `<span>🌡️ ${data.temp}°C</span>` : ''}
      ${data.totalWater ? `<span>💧 ${data.totalWater}мл</span>` : ''}
    </div>
    ${pointsStr ? `<div class="coffee-recipe-detail"><span>📊 ${pointsStr}</span></div>` : ''}
    <div style="margin: 8px 0;">
      <canvas id="${canvasId}" class="coffee-chart" width="300" height="150"></canvas>
    </div>
    <div class="coffee-recipe-actions">
      <button class="coffee-recipe-delete" data-id="${id}">🗑️</button>
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

  requestAnimationFrame(() => {
    const chartCanvas = document.getElementById(canvasId);
    if (!chartCanvas) return;
    if (data.points?.length > 0) {
      drawChartWithPoints(chartCanvas, data.points);
    } else {
      const ctx = chartCanvas.getContext('2d');
      ctx.clearRect(0, 0, chartCanvas.width, chartCanvas.height);
      ctx.font = '12px -apple-system';
      ctx.fillStyle = '#8e8e93';
      ctx.textAlign = 'center';
      ctx.fillText('Нет данных', chartCanvas.width / 2, chartCanvas.height / 2);
    }
  });
}

if (coffeeRoastDate) {
  coffeeRoastDate.addEventListener('change', updateCoffeeAge);
  coffeeRoastDate.addEventListener('blur', updateCoffeeAge);
}
if (coffeeWater) coffeeWater.addEventListener('input', () => drawChart(coffeeChartCanvas, currentPoints));

window.updateCoffeeAge = updateCoffeeAge;

// ── QR-коды ──
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
