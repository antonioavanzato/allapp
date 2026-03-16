// Импорт нужных функций Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Ваша конфигурация
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

// DOM Элементы
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

// Глобальные переменные состояния
let currentTab = 'tasks';
let unsubscribe = null;
let currentUser = null;

// ==========================================
// АВТОРИЗАЦИЯ
// ==========================================

// Отслеживание состояния пользователя (Вошел / Вышел)
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Пользователь авторизован
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadData(); // Загружаем данные пользователя
  } else {
    // Пользователь не авторизован
    currentUser = null;
    if (unsubscribe) unsubscribe(); // Отключаем прослушку БД
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = ''; // Очищаем список
  }
});

// Вход
loginBtn.addEventListener('click', async () => {
  try {
    authError.textContent = '';
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    emailInput.value = ''; passwordInput.value = '';
  } catch (error) {
    authError.textContent = 'Ошибка входа: неверный email или пароль.';
  }
});

// Регистрация
registerBtn.addEventListener('click', async () => {
  try {
    authError.textContent = '';
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    emailInput.value = ''; passwordInput.value = '';
  } catch (error) {
    authError.textContent = 'Ошибка: пароль слишком простой или email занят.';
  }
});

// Выход
logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// ==========================================
// БАЗА ДАННЫХ И ИНТЕРФЕЙС
// ==========================================

// Формируем путь к личным данным пользователя: users/ID_ПОЛЬЗОВАТЕЛЯ/tasks
function getUserCollection() {
  return collection(db, 'users', currentUser.uid, currentTab);
}

// Загрузка данных из Firestore
function loadData() {
  if (unsubscribe) unsubscribe(); 

  const q = query(getUserCollection(), orderBy('createdAt', 'desc'));
  
  unsubscribe = onSnapshot(q, (snapshot) => {
    itemsList.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      renderItem(docSnap.id, item);
    });
  });
}

// Отрисовка элемента
function renderItem(id, item) {
  const li = document.createElement('li');
  
  li.innerHTML = `
    <div class="checkbox ${item.completed ? 'checked' : ''}"></div>
    <span class="item-text ${item.completed ? 'completed' : ''}">${item.text}</span>
    <button class="delete-btn">×</button>
  `;

  // Клик по чекбоксу
  li.querySelector('.checkbox').addEventListener('click', async () => {
    const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
    await updateDoc(docRef, { completed: !item.completed });
  });

  // Клик по удалению
  li.querySelector('.delete-btn').addEventListener('click', async () => {
    const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
    await deleteDoc(docRef);
  });

  itemsList.appendChild(li);
}

// Добавление новой записи
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
itemInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addItem();
});

// Переключение вкладок (Задачи / Покупки)
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    nav.classList.add('active');
    
    currentTab = nav.dataset.tab;
    
    if (currentTab === 'tasks') {
      pageTitle.textContent = 'Задачи';
      itemInput.placeholder = 'Добавить задачу...';
    } else {
      pageTitle.textContent = 'Покупки';
      itemInput.placeholder = 'Добавить покупку...';
    }

    if (currentUser) loadData(); 
  });
});
