import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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

let currentTab = 'shopping';
let unsubscribe = null;
let currentUser = null;

// Функция для показа уведомления
function showNotification(title, body) {
  if (!('Notification' in window)) {
    console.log('Браузер не поддерживает уведомления');
    return;
  }

  if (Notification.permission === 'granted') {
    new Notification(title, {
      body: body,
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      vibrate: [200, 100, 200]
    });
  } 
  else if (Notification.permission !== 'denied') {
    Notification.requestPermission().then(permission => {
      if (permission === 'granted') {
        new Notification(title, {
          body: body,
          icon: '/icons/icon-192.png'
        });
      }
    });
  }
}

// Настройка уведомлений через Firebase
const setupFirebaseNotifications = async () => {
  if (!('Notification' in window)) return;
  
  try {
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      const token = await getToken(messaging, {
        vapidKey: 'BGz2GcA-qvKY2ZcGX-lMFKhzQl9FmEv8zux_BFcHyBc4YqCMs0FhYkhCSDgSmTdD-TBz-ovp4E1JXeH7cPeGGvM'
      });
      
      if (currentUser && token) {
        const userRef = doc(db, 'users', currentUser.uid);
        await updateDoc(userRef, {
          fcmTokens: arrayUnion(token)
        }).catch(async () => {
          await setDoc(userRef, { fcmTokens: [token] }, { merge: true });
        });
      }
    }
  } catch (error) {
    console.log('Ошибка уведомлений:', error);
  }
};

// Слушаем входящие уведомления от Firebase
onMessage(messaging, (payload) => {
  console.log('Получено уведомление от Firebase:', payload);
  showNotification(
    payload.notification?.title || 'AllApp',
    payload.notification?.body || ''
  );
});

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadData();
    setupFirebaseNotifications();
  } else {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = '';
  }
});

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

function getCollection() {
  // Используем общую семейную папку вместо личной
  return collection(db, 'family', currentTab);
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
  
  const itemType = currentTab === 'shopping' ? 'покупку' : 'задачу';
  showNotification(
    '✅ Добавлено',
    `${itemType}: ${text}`
  );
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
    if (translateX > 120) translateX = 120;
    if (translateX < -120) translateX = -120;
    swipeContent.style.transform = `translateX(${translateX}px)`;
  };

  const end = async () => {
    if (!isSwiping) return;
    isSwiping = false;
    li.classList.remove('is-swiping');

    if (translateX > threshold) {
      // СВАЙП ВПРАВО - ОТМЕТИТЬ КАК ВЫПОЛНЕНО
      const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
      const newCompletedState = !item.completed;
      await updateDoc(docRef, { completed: newCompletedState });
      
      // ПОКАЗЫВАЕМ УВЕДОМЛЕНИЕ
      const action = newCompletedState ? '✅ Выполнено' : '↩️ Возвращено';
      const itemType = currentTab === 'shopping' ? 'покупка' : 'задача';
      showNotification(action, `${itemType}: ${item.text}`);
      
    } else if (translateX < -threshold) {
      // СВАЙП ВЛЕВО - УДАЛИТЬ
      li.style.transition = 'all 0.3s ease';
      li.style.transform = 'translateX(-100%)';
      li.style.opacity = '0';
      
      // ПОКАЗЫВАЕМ УВЕДОМЛЕНИЕ ОБ УДАЛЕНИИ
      const itemType = currentTab === 'shopping' ? 'покупка' : 'задача';
      showNotification('🗑️ Удалено', `${itemType}: ${item.text}`);
      
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
