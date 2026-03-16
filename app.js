import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, arrayUnion, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
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

let currentTab = 'shopping';
let unsubscribe = null;
let currentUser = null;

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

function showToast(message, type = 'success') {
  const toast = document.getElementById('toast-message');
  if (!toast) return;
  
  const icons = { success: '✅', error: '❌', warning: '⚠️' };
  toast.textContent = `${icons[type] || '✅'} ${message}`;
  toast.classList.remove('hidden');
  
  setTimeout(() => {
    toast.classList.add('hidden');
  }, 2000);
}

function scrollToNewItem() {
  setTimeout(() => {
    const lastItem = itemsList.lastElementChild;
    if (lastItem) {
      lastItem.style.transition = 'background-color 0.5s ease';
      lastItem.style.backgroundColor = 'rgba(0, 122, 255, 0.15)';
      lastItem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      setTimeout(() => {
        lastItem.style.backgroundColor = '';
      }, 1000);
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
  signOut(auth).catch(error => {
    console.error('Ошибка выхода:', error);
  });
});

// Состояние авторизации
onAuthStateChanged(auth, (user) => {
  console.log('Auth state changed:', user ? 'пользователь есть' : 'пользователя нет');
  
  if (user) {
    currentUser = user;
    if (authScreen) authScreen.classList.add('hidden');
    if (mainApp) mainApp.classList.remove('hidden');
    loadData();
    
    // Запрос уведомлений
    if (Notification.permission === 'default') {
      Notification.requestPermission();
    }
  } else {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    if (mainApp) mainApp.classList.add('hidden');
    if (authScreen) authScreen.classList.remove('hidden');
    if (itemsList) itemsList.innerHTML = '';
  }
});

function getFamilyCollection() {
  return collection(db, 'family', 'shared', currentTab);
}

// Добавление элемента
async function addItem() {
  const text = itemInput?.value.trim();
  if (!text || !currentUser) return;
  if (itemInput) itemInput.value = '';
  
  try {
    await addDoc(getFamilyCollection(), {
      text: text,
      completed: false,
      createdAt: serverTimestamp(),
      createdBy: currentUser.email,
      createdByName: getUserDisplayName(currentUser.email)
    });
    
    showToast(`Добавлено: ${text}`);
    scrollToNewItem();
  } catch (error) {
    console.error('Ошибка:', error);
    showToast('Ошибка при добавлении', 'error');
  }
}

if (addBtn) addBtn.addEventListener('click', addItem);
if (itemInput) {
  itemInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') addItem();
  });
}

// Быстрые кнопки
document.querySelectorAll('.quick-btn').forEach(btn => {
  btn.addEventListener('click', async () => {
    const product = btn.dataset.product;
    if (!product || !currentUser) return;
    
    try {
      await addDoc(getFamilyCollection(), {
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

function loadData() {
  if (unsubscribe) unsubscribe();
  if (!currentUser) return;
  
  try {
    const q = query(getFamilyCollection(), orderBy('createdAt', 'desc'));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
      if (itemsList) itemsList.innerHTML = '';
      
      if (snapshot.empty) {
        if (emptyState) emptyState.classList.remove('hidden');
      } else {
        if (emptyState) emptyState.classList.add('hidden');
        snapshot.forEach((docSnap) => {
          renderItem(docSnap.id, docSnap.data());
        });
      }
    }, (error) => {
      console.error('Ошибка загрузки:', error);
    });
  } catch (error) {
    console.error('Ошибка:', error);
  }
}

function renderItem(id, item) {
  if (!itemsList) return;
  
  const li = document.createElement('li');
  
  let displayName = '';
  if (item.createdByName) {
    displayName = item.createdByName;
  } else if (item.createdBy) {
    displayName = getUserDisplayName(item.createdBy);
  }
  
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

  const getX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

  const start = (e) => {
    startX = getX(e);
    isSwiping = true;
    li.classList.add('is-swiping');
    // Убираем классы направления при старте
    li.classList.remove('swiping-right', 'swiping-left');
  };

  const move = (e) => {
    if (!isSwiping) return;
    currentX = getX(e);
    translateX = currentX - startX;
    
    // Ограничение свайпа
    if (translateX > 120) translateX = 120;
    if (translateX < -120) translateX = -120;
    
    // Двигаем контент
    if (swipeContent) {
      swipeContent.style.transform = `translateX(${translateX}px)`;
    }
    
    // Добавляем цвет в зависимости от направления
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
    
    // Убираем цвет
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

// Навигация
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    nav.classList.add('active');
    currentTab = nav.dataset.tab;
    
    if (pageTitle) {
      pageTitle.textContent = currentTab === 'shopping' ? 'Покупки' : 'Задачи';
    }
    if (listTitle) {
      listTitle.textContent = currentTab === 'shopping' ? 'Список покупок' : 'Список задач';
    }
    if (itemInput) {
      itemInput.placeholder = currentTab === 'shopping' ? 'Что купить?..' : 'Новая задача...';
    }
    
    if (quickContainer) {
      quickContainer.style.display = currentTab === 'shopping' ? 'block' : 'none';
    }
    
    if (currentUser) loadData();
  });
});

// Сворачивание блока быстрых продуктов
const quickToggle = document.getElementById('quick-toggle');
const quickGrid = document.getElementById('quick-grid');
const quickArrow = document.getElementById('quick-arrow');

if (quickToggle && quickGrid && quickArrow) {
  let isQuickExpanded = true; // по умолчанию развернут

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
