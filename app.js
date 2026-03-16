import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp, arrayUnion, setDoc, getDocs } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";
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
const nameInput = document.getElementById('name-input');
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

// Словарь для преобразования email в имена
const userNames = {
  'antonioavanzato@gmail.com': 'Антон',
  'style_of_live@gmail.com': 'Даша'
};

// Показываем/скрываем поле имени
loginBtn.addEventListener('click', () => {
  nameInput.style.display = 'none';
});

registerBtn.addEventListener('click', () => {
  nameInput.style.display = 'block';
});

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

onMessage(messaging, (payload) => {
  console.log('Уведомление:', payload);
  showNotification(
    payload.notification?.title || 'AllApp',
    payload.notification?.body || ''
  );
});

registerBtn.addEventListener('click', async () => {
  const email = emailInput.value;
  const password = passwordInput.value;
  const name = nameInput.value.trim() || email.split('@')[0];
  
  if (!email || !password) {
    authError.textContent = 'Заполните email и пароль';
    return;
  }
  
  try {
    authError.textContent = '';
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    const user = userCredential.user;
    
    await updateProfile(user, { displayName: name });
    
    await setDoc(doc(db, 'users', user.uid), {
      name: name,
      email: email,
      createdAt: serverTimestamp()
    });
    
    console.log('Пользователь создан с именем:', name);
    
  } catch (error) {
    console.error('Ошибка регистрации:', error);
    authError.textContent = 'Ошибка регистрации: ' + error.message;
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

logoutBtn.addEventListener('click', () => signOut(auth));

onAuthStateChanged(auth, (user) => {
  if (user) {
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadData();
    setTimeout(() => setupFirebaseNotifications(), 1000);
  } else {
    currentUser = null;
    if (unsubscribe) unsubscribe();
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = '';
    nameInput.style.display = 'block';
    nameInput.value = '';
  }
});

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ПОЛУЧЕНИЯ ИМЕНИ
function getUserDisplayName(email) {
  if (!email) return '';
  
  // Сначала проверяем по словарю
  if (userNames[email]) {
    return userNames[email];
  }
  
  // Если нет в словаре, берем часть email
  return email.split('@')[0];
}

function getFamilyCollection() {
  return collection(db, 'family', 'shared', currentTab);
}

async function addItem() {
  const text = itemInput.value.trim();
  if (!text || !currentUser) return;
  itemInput.value = '';
  
  try {
    await addDoc(getFamilyCollection(), {
      text: text,
      completed: false,
      createdAt: serverTimestamp(),
      createdBy: currentUser.email,
      createdByName: getUserDisplayName(currentUser.email)
    });
    
    showNotification('✅ Добавлено', `${text}`);
  } catch (error) {
    console.error('Ошибка при добавлении:', error);
  }
}

addBtn.addEventListener('click', addItem);
itemInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') addItem(); });

function loadData() {
  if (unsubscribe) unsubscribe();
  
  try {
    const q = query(getFamilyCollection(), orderBy('createdAt', 'desc'));
    
    unsubscribe = onSnapshot(q, (snapshot) => {
      itemsList.innerHTML = '';
      
      if (snapshot.empty) {
        emptyState.classList.remove('hidden');
      } else {
        emptyState.classList.add('hidden');
        snapshot.forEach((docSnap) => {
          renderItem(docSnap.id, docSnap.data());
        });
      }
    });
  } catch (error) {
    console.error('Ошибка загрузки:', error);
  }
}

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ОТОБРАЖЕНИЯ
function renderItem(id, item) {
  const li = document.createElement('li');
  
  // ПОЛУЧАЕМ ИМЯ - сначала проверяем createdByName, потом createdBy
  let displayName = '';
  if (item.createdByName) {
    // Если есть сохраненное имя, используем его
    displayName = item.createdByName;
  } else if (item.createdBy) {
    // Если нет имени, но есть email, получаем имя из словаря
    displayName = getUserDisplayName(item.createdBy);
  }
  
  li.innerHTML = `
    <div class="swipe-actions">
      <div class="action-complete">Готово</div>
      <div class="action-delete">Удалить</div>
    </div>
    <div class="swipe-content">
      <span class="item-text ${item.completed ? 'completed' : ''}">
        ${item.text}
        ${displayName ? `<span class="user-name">(${displayName})</span>` : ''}
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

    try {
      if (translateX > threshold) {
        const docRef = doc(db, 'family', 'shared', currentTab, id);
        await updateDoc(docRef, { completed: !item.completed });
        
        showNotification(
          !item.completed ? '✅ Выполнено' : '↩️ Возвращено',
          item.text
        );
        
      } else if (translateX < -threshold) {
        li.style.transition = 'all 0.3s ease';
        li.style.transform = 'translateX(-100%)';
        li.style.opacity = '0';
        
        showNotification('🗑️ Удалено', item.text);
        
        setTimeout(async () => {
          await deleteDoc(doc(db, 'family', 'shared', currentTab, id));
        }, 300);
      } else {
        swipeContent.style.transform = 'translateX(0px)';
      }
    } catch (error) {
      console.error('Ошибка:', error);
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

// ИСПРАВЛЕННАЯ ФУНКЦИЯ ДЛЯ ОБНОВЛЕНИЯ СТАРЫХ ЗАПИСЕЙ
window.updateOldItems = async function() {
  const user = auth.currentUser;
  if (!user) {
    console.log('Сначала войдите');
    return;
  }
  
  try {
    console.log('Начинаем обновление старых записей...');
    
    // Обновляем покупки
    const shoppingSnap = await getDocs(collection(db, 'family', 'shared', 'shopping'));
    let shoppingCount = 0;
    
    for (const docItem of shoppingSnap.docs) {
      const data = docItem.data();
      const properName = getUserDisplayName(data.createdBy);
      
      // Обновляем, если имя не совпадает или отсутствует
      if (data.createdByName !== properName) {
        await updateDoc(doc(db, 'family', 'shared', 'shopping', docItem.id), {
          createdByName: properName
        });
        shoppingCount++;
      }
    }
    
    // Обновляем задачи
    const tasksSnap = await getDocs(collection(db, 'family', 'shared', 'tasks'));
    let tasksCount = 0;
    
    for (const docItem of tasksSnap.docs) {
      const data = docItem.data();
      const properName = getUserDisplayName(data.createdBy);
      
      if (data.createdByName !== properName) {
        await updateDoc(doc(db, 'family', 'shared', 'tasks', docItem.id), {
          createdByName: properName
        });
        tasksCount++;
      }
    }
    
    console.log(`✅ Обновлено покупок: ${shoppingCount}, задач: ${tasksCount}`);
    console.log('Теперь обновите страницу (F5)');
    
  } catch (error) {
    console.error('Ошибка:', error);
  }
};
