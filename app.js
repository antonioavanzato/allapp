// Импорт нужных функций Firebase из CDN
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { 
  getFirestore, collection, addDoc, onSnapshot, 
  doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

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

// DOM Элементы
const itemsList = document.getElementById('items-list');
const itemInput = document.getElementById('item-input');
const addBtn = document.getElementById('add-btn');
const pageTitle = document.getElementById('page-title');
const navItems = document.querySelectorAll('.nav-item');

// Текущая категория (tasks или shopping)
let currentTab = 'tasks';
let unsubscribe = null; // Для отписки от слушателя БД при смене вкладки

// Функция загрузки данных из Firestore в реальном времени
function loadData() {
  if (unsubscribe) unsubscribe(); // Очищаем предыдущий слушатель

  const q = query(collection(db, currentTab), orderBy('createdAt', 'desc'));
  
  unsubscribe = onSnapshot(q, (snapshot) => {
    itemsList.innerHTML = '';
    snapshot.forEach((docSnap) => {
      const item = docSnap.data();
      renderItem(docSnap.id, item);
    });
  });
}

// Отрисовка элемента в HTML
function renderItem(id, item) {
  const li = document.createElement('li');
  
  li.innerHTML = `
    <div class="checkbox ${item.completed ? 'checked' : ''}" data-id="${id}"></div>
    <span class="item-text ${item.completed ? 'completed' : ''}">${item.text}</span>
    <button class="delete-btn" data-id="${id}">×</button>
  `;

  // Обработчик выполнения
  li.querySelector('.checkbox').addEventListener('click', async (e) => {
    const docRef = doc(db, currentTab, id);
    await updateDoc(docRef, { completed: !item.completed });
  });

  // Обработчик удаления
  li.querySelector('.delete-btn').addEventListener('click', async (e) => {
    const docRef = doc(db, currentTab, id);
    await deleteDoc(docRef);
  });

  itemsList.appendChild(li);
}

// Добавление новой записи
async function addItem() {
  const text = itemInput.value.trim();
  if (!text) return;

  itemInput.value = ''; // очищаем поле
  
  await addDoc(collection(db, currentTab), {
    text: text,
    completed: false,
    createdAt: serverTimestamp()
  });
}

addBtn.addEventListener('click', addItem);
itemInput.addEventListener('keypress', (e) => {
  if (e.key === 'Enter') addItem();
});

// Переключение вкладок
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    nav.classList.add('active');
    
    currentTab = nav.dataset.tab;
    
    // Меняем заголовок и плейсхолдер
    if (currentTab === 'tasks') {
      pageTitle.textContent = 'Задачи';
      itemInput.placeholder = 'Добавить задачу...';
    } else {
      pageTitle.textContent = 'Покупки';
      itemInput.placeholder = 'Добавить покупку...';
    }

    loadData(); // Загружаем данные новой вкладки
  });
});

// Первоначальная загрузка
loadData();
