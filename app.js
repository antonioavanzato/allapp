// Импорт всех необходимых функций из Firebase SDK
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { 
  getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, 
  signOut, onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Ваша конфигурация Firebase (оставлена для полноты)
const firebaseConfig = {
  apiKey: "AIzaSyAICtDB0Rie_2W2DAoX0MOJm7kDSbTAEUA",
  authDomain: "allapp-16e47.firebaseapp.com",
  projectId: "allapp-16e47",
  storageBucket: "allapp-16e47.firebasestorage.app",
  messagingSenderId: "492414694516",
  appId: "1:492414694516:web:f4fa51805c05e6c545cd21"
};

// Инициализация Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Элементы
// Экраны
const authScreen = document.getElementById('auth-screen');
const mainApp = document.getElementById('main-app');

// Авторизация
const emailInput = document.getElementById('email-input');
const passwordInput = document.getElementById('password-input');
const loginBtn = document.getElementById('login-btn');
const registerBtn = document.getElementById('register-btn');
const logoutBtn = document.getElementById('logout-btn');
const authError = document.getElementById('auth-error');

// Основное приложение
const itemsList = document.getElementById('items-list');
const itemInput = document.getElementById('item-input');
const addBtn = document.getElementById('add-btn');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');
const listTitle = document.getElementById('list-title');
const emptyState = document.getElementById('empty-state');

// Глобальные переменные состояния
let currentTab = 'tasks';
let unsubscribe = null; // Хранит функцию для отписки от слушателя Firestore
let currentUser = null;

// ==========================================
// АВТОРИЗАЦИЯ (AUTHENTICATION)
// ==========================================

// Главный слушатель, который следит за состоянием входа пользователя
onAuthStateChanged(auth, (user) => {
  if (user) {
    // Пользователь вошел в систему
    currentUser = user;
    authScreen.classList.add('hidden');
    mainApp.classList.remove('hidden');
    loadData(); // Загружаем данные для этого пользователя
  } else {
    // Пользователь вышел
    currentUser = null;
    if (unsubscribe) unsubscribe(); // Отключаем прослушку данных из БД
    mainApp.classList.add('hidden');
    authScreen.classList.remove('hidden');
    itemsList.innerHTML = ''; // Очищаем список на всякий случай
  }
});

// Обработчик входа
loginBtn.addEventListener('click', async () => {
  try {
    authError.textContent = '';
    await signInWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    emailInput.value = ''; 
    passwordInput.value = '';
  } catch (error) {
    authError.textContent = 'Ошибка входа: неверный email или пароль.';
  }
});

// Обработчик регистрации
registerBtn.addEventListener('click', async () => {
  try {
    authError.textContent = '';
    await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    emailInput.value = ''; 
    passwordInput.value = '';
  } catch (error) {
    authError.textContent = 'Ошибка: пароль слишком простой или email занят.';
  }
});

// Обработчик выхода
logoutBtn.addEventListener('click', () => {
  signOut(auth);
});

// ==========================================
// БАЗА ДАННЫХ И ИНТЕРФЕЙС (DATABASE & UI)
// ==========================================

// Вспомогательная функция для получения пути к коллекции текущего пользователя
function getUserCollection() {
  // Путь: users -> {ID_пользователя} -> {tasks/shopping}
  return collection(db, 'users', currentUser.uid, currentTab);
}

// Загрузка данных из Firestore в реальном времени
function loadData() {
  if (unsubscribe) unsubscribe(); // Очищаем предыдущий слушатель, чтобы избежать дублирования

  const q = query(getUserCollection(), orderBy('createdAt', 'desc'));
  
  unsubscribe = onSnapshot(q, (snapshot) => {
    itemsList.innerHTML = '';

    // Проверяем, есть ли записи
    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      snapshot.forEach((docSnap) => {
        const item = docSnap.data();
        renderItem(docSnap.id, item);
      });
    }
  });
}

// Отрисовка одного элемента (карточки) в списке
function renderItem(id, item) {
  const li = document.createElement('li');
  
  li.innerHTML = `
    <div class="checkbox ${item.completed ? 'checked' : ''}"></div>
    <span class="item-text ${item.completed ? 'completed' : ''}">${item.text}</span>
    <button class="delete-btn">×</button>
  `;

  // Обработчик клика по чекбоксу для смены статуса
  li.querySelector('.checkbox').addEventListener('click', async () => {
    const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
    await updateDoc(docRef, { completed: !item.completed });
  });

  // Обработчик клика по кнопке удаления
  li.querySelector('.delete-btn').addEventListener('click', async () => {
    const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
    await deleteDoc(docRef);
  });

  itemsList.appendChild(li);
}

// Добавление новой записи в базу данных
async function addItem() {
  const text = itemInput.value.trim();
  if (!text || !currentUser) return;

  itemInput.value = ''; // Сразу очищаем поле
  
  try {
    await addDoc(getUserCollection(), {
      text: text,
      completed: false,
      createdAt: serverTimestamp() // Используем серверное время для корректной сортировки
    });
  } catch(error) {
    console.error("Ошибка при добавлении документа: ", error);
  }
}

// Навешиваем событие на кнопку добавления
addBtn.addEventListener('click', addItem);
// И на нажатие Enter в поле ввода
itemInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') {
    e.preventDefault(); // Предотвращаем стандартное поведение (отправку формы)
    addItem();
  }
});

// Логика переключения между вкладками "Задачи" и "Покупки"
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    // Снимаем активность со всех кнопок
    navItems.forEach(n => n.classList.remove('active'));
    // Добавляем активность нажатой кнопке
    nav.classList.add('active');
    
    // Обновляем текущую вкладку
    currentTab = nav.dataset.tab;
    
    // Меняем тексты в интерфейсе
    if (currentTab === 'tasks') {
      pageTitle.textContent = 'Задачи';
      itemInput.placeholder = 'Новая задача...';
      listTitle.textContent = 'Все задачи';
    } else {
      pageTitle.textContent = 'Покупки';
      itemInput.placeholder = 'Что купить?..';
      listTitle.textContent = 'Список покупок';
    }

    // Перезагружаем данные для новой вкладки, если пользователь вошел
    if (currentUser) {
      loadData(); 
    }
  });
});
