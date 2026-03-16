import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, arrayUnion, setDoc, getDocs, where } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-messaging.js";

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

// DOM элементы
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

// Элементы календаря
const calendarDays = document.getElementById('calendar-days');
const currentMonthSpan = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');

let currentTab = 'shopping'; // shopping, tasks, albus
let unsubscribe = null; // для списков покупок/задач
let unsubscribeCalendar = null; // для календаря
let currentUser = null;

// Текущий месяц для календаря
let currentCalendarDate = new Date();

// Словарь имен
const userNames = {
  'antonioavanzato@gmail.com': 'Антон',
  'style_of_live@gmail.com': 'Даша',
  'antonioavanzato': 'Антон',
  'style_of_live': 'Даша'
};

function getUserDisplayName(email) {
  if (!email) return '';
  if (userNames[email]) return userNames[email];
  const emailWithoutDomain = email.split('@')[0];
  if (userNames[emailWithoutDomain]) return userNames[emailWithoutDomain];
  return emailWithoutDomain;
}

// Уведомления
function showNotification(title, body) {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200]
    });
  }
}

// Тосты
function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  toast.textContent = `${icons[type] || '✅'} ${message}`;
  toast.classList.remove('hidden');
  setTimeout(() => toast.classList.add('hidden'), 2000);
}

// Прокрутка к новому элементу
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

// Вход
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
    console.log('Вход выполнен');
  } catch (error) {
    console.error('Ошибка входа:', error);
    if (authError) authError.textContent = 'Неверный email или пароль';
  }
});

// Выход
logoutBtn.addEventListener('click', () => {
  signOut(auth).catch(error => console.error('Ошибка выхода:', error));
});

// Состояние авторизации
onAuthStateChanged(auth, (user) => {
  console.log('Auth state changed:', user ? 'пользователь есть' : 'пользователя нет');
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    // По умолчанию показываем покупки
    switchTab('shopping');
    // Запрос уведомлений
    if (Notification.permission === 'default') Notification.requestPermission();
  } else {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    if (unsubscribeCalendar) unsubscribeCalendar();
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = '';
  }
});

// Функция переключения вкладок
function switchTab(tab) {
  currentTab = tab;
  
  // Обновление активного класса на кнопках
  navItems.forEach(nav => {
    nav.classList.remove('active');
    if (nav.dataset.tab === tab) nav.classList.add('active');
  });
  
  // Обновление заголовка
  if (pageTitle) {
    if (tab === 'shopping') pageTitle.textContent = 'Покупки';
    else if (tab === 'tasks') pageTitle.textContent = 'Задачи';
    else if (tab === 'albus') pageTitle.textContent = 'Альбус';
  }
  
  // Скрыть/показать соответствующие блоки
  if (tab === 'shopping' || tab === 'tasks') {
    // Показываем блоки для списков
    if (quickContainer) quickContainer.style.display = tab === 'shopping' ? 'block' : 'none';
    if (inputGroup) inputGroup.style.display = 'flex';
    if (listSection) listSection.style.display = 'block';
    if (calendarContainer) calendarContainer.classList.add('hidden');
    
    // Обновляем placeholder и заголовок списка
    if (listTitle) listTitle.textContent = tab === 'shopping' ? 'Список покупок' : 'Список задач';
    if (itemInput) itemInput.placeholder = tab === 'shopping' ? 'Что купить?..' : 'Новая задача...';
    
    // Загружаем данные соответствующей коллекции
    loadListData();
  } else if (tab === 'albus') {
    // Прячем всё, что относится к спискам
    if (quickContainer) quickContainer.style.display = 'none';
    if (inputGroup) inputGroup.style.display = 'none';
    if (listSection) listSection.style.display = 'none';
    if (calendarContainer) calendarContainer.classList.remove('hidden');
    
    // Загружаем календарь
    loadCalendar();
  }
}

// Загрузка данных списка (shopping / tasks)
function loadListData() {
  if (unsubscribe) unsubscribe();
  if (!currentUser) return;
  
  const collectionRef = collection(db, 'family', 'shared', currentTab);
  const q = query(collectionRef, orderBy('createdAt', 'desc'));
  
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

// Добавление элемента (для shopping / tasks)
async function addItem() {
  const text = itemInput?.value.trim();
  if (!text || !currentUser) return;
  itemInput.value = '';
  
  try {
    await addDoc(collection(db, 'family', 'shared', currentTab), {
      text: text,
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

// Быстрые кнопки
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
      console.error('Ошибка:', error);
      showToast('Ошибка при добавлении', 'error');
    }
  });
});

// Отрисовка элемента списка (shopping / tasks)
function renderItem(id, item) {
  if (!itemsList) return;
  const li = document.createElement('li');
  let displayName = item.createdByName || getUserDisplayName(item.createdBy);
  
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
  let startX = 0, currentX = 0, translateX = 0, isSwiping = false;
  const threshold = 80;
  const getX = e => e.touches ? e.touches[0].clientX : e.clientX;

  const start = e => {
    startX = getX(e);
    isSwiping = true;
    li.classList.add('is-swiping');
    li.classList.remove('swiping-right', 'swiping-left');
  };

  const move = e => {
    if (!isSwiping) return;
    currentX = getX(e);
    translateX = currentX - startX;
    if (translateX > 120) translateX = 120;
    if (translateX < -120) translateX = -120;
    if (swipeContent) swipeContent.style.transform = `translateX(${translateX}px)`;
    
    if (translateX > 20) {
      li.classList.add('swiping-right');
      li.classList.remove('swiping-left');
    } else if (translateX < -20) {
      li.classList.add('swiping-left');
      li.classList.remove('swiping-right');
    } else {
      li.classList.remove('swiping-right', 'swiping-left');
    }
  };

  const end = async () => {
    if (!isSwiping) return;
    isSwiping = false;
    li.classList.remove('is-swiping');
    li.classList.remove('swiping-right', 'swiping-left');
    
    try {
      if (translateX > threshold) {
        const docRef = doc(db, 'family', 'shared', currentTab, id);
        await updateDoc(docRef, { completed: !item.completed });
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
  li.addEventListener('mousedown', start);
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', end);

  itemsList.appendChild(li);
}

// Навигация по вкладкам
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    switchTab(nav.dataset.tab);
  });
});

// Сворачивание блока быстрых продуктов (по умолчанию свернут)
const quickToggle = document.getElementById('quick-toggle');
const quickGrid = document.getElementById('quick-grid');
const quickArrow = document.getElementById('quick-arrow');
if (quickToggle && quickGrid && quickArrow) {
  let isQuickExpanded = false;
  quickGrid.classList.add('collapsed');
  quickArrow.classList.add('collapsed');
  quickToggle.addEventListener('click', () => {
    if (isQuickExpanded) {
      quickGrid.classList.add('collapsed');
      quickArrow.classList.add('collapsed');
    } else {
      quickGrid.classList.remove('collapsed');
      quickArrow.classList.remove('collapsed');
    }
    isQuickExpanded = !isQuickExpanded;
  });
}

// ---------- Календарь для Альбуса ----------
function loadCalendar() {
  if (unsubscribeCalendar) unsubscribeCalendar();
  renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
}

function renderCalendar(year, month) {
  // Отображаем месяц и год
  const monthNames = ['Январь', 'Февраль', 'Март', 'Апрель', 'Май', 'Июнь', 'Июль', 'Август', 'Сентябрь', 'Октябрь', 'Ноябрь', 'Декабрь'];
  currentMonthSpan.textContent = `${monthNames[month]} ${year}`;

  // Получаем первый день месяца (0 - понедельник? нам нужен понедельник первым)
  const firstDay = new Date(year, month, 1);
  let startDayOfWeek = firstDay.getDay(); // 0 = воскресенье, 1 = понедельник, ...
  // Сдвигаем, чтобы понедельник был 0
  let startOffset = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1; // если воскресенье (0) -> смещение 6, иначе -1

  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Генерируем массив дней с пустыми ячейками в начале
  const daysArray = [];
  for (let i = 0; i < startOffset; i++) {
    daysArray.push(null); // пустая ячейка
  }
  for (let d = 1; d <= daysInMonth; d++) {
    daysArray.push(d);
  }

  // Запрашиваем отметки за этот месяц
  const startDateStr = `${year}-${String(month+1).padStart(2,'0')}-01`;
  const endDateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(daysInMonth).padStart(2,'0')}`;
  
  const q = query(
    collection(db, 'family', 'shared', 'albus'),
    where('date', '>=', startDateStr),
    where('date', '<=', endDateStr)
  );

  if (unsubscribeCalendar) unsubscribeCalendar();
  unsubscribeCalendar = onSnapshot(q, (snapshot) => {
    // Собираем отметки в объект { date: taken }
    const takenMap = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      takenMap[data.date] = data.taken;
    });

    // Отрисовываем дни
    calendarDays.innerHTML = '';
    daysArray.forEach(day => {
      const dayDiv = document.createElement('div');
      dayDiv.className = 'calendar-day';
      if (day === null) {
        dayDiv.classList.add('empty');
      } else {
        const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(day).padStart(2,'0')}`;
        dayDiv.textContent = day;
        if (takenMap[dateStr] === true) {
          dayDiv.classList.add('taken');
        }
        dayDiv.dataset.date = dateStr;
        dayDiv.addEventListener('click', () => handleDayClick(dateStr, dayDiv));
      }
      calendarDays.appendChild(dayDiv);
    });
  });
}

// Обработка клика на день календаря
async function handleDayClick(dateStr, dayElement) {
  if (!currentUser) return;
  
  const docRef = doc(db, 'family', 'shared', 'albus', dateStr); // используем дату как ID документа
  try {
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const current = docSnap.data().taken;
      await updateDoc(docRef, { taken: !current });
      showToast(!current ? 'Отмечено' : 'Отмена', 'success');
    } else {
      await setDoc(docRef, {
        date: dateStr,
        taken: true,
        createdBy: currentUser.email,
        createdAt: serverTimestamp()
      });
      showToast('✅ Отмечено', 'success');
    }
  } catch (error) {
    console.error('Ошибка при отметке:', error);
    showToast('Ошибка', 'error');
  }
}

// Переключение месяцев
if (prevMonthBtn && nextMonthBtn) {
  prevMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() - 1);
    renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
  });
  nextMonthBtn.addEventListener('click', () => {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + 1);
    renderCalendar(currentCalendarDate.getFullYear(), currentCalendarDate.getMonth());
  });
}

// ---------- Инициализация ----------
// При загрузке страницы активная вкладка уже установлена через onAuthStateChanged
