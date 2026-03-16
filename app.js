// Импорты Firebase без изменений
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Конфигурация Firebase без изменений
const firebaseConfig = { /* ... */ };

// Инициализация Firebase без изменений
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

// DOM Элементы без изменений
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

// ИЗМЕНЕНИЕ: Дефолтная вкладка теперь 'shopping'
let currentTab = 'shopping';
let unsubscribe = null;
let currentUser = null;

// Блок авторизации и другие функции (кроме renderItem) остаются без изменений
onAuthStateChanged(auth, (user) => { /* ... */ });
loginBtn.addEventListener('click', async () => { /* ... */ });
registerBtn.addEventListener('click', async () => { /* ... */ });
logoutBtn.addEventListener('click', () => { signOut(auth); });
function getUserCollection() { return collection(db, 'users', currentUser.uid, currentTab); }
async function addItem() { /* ... */ }
addBtn.addEventListener('click', addItem);
itemInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });

function loadData() {
  if (unsubscribe) unsubscribe();
  const q = query(getUserCollection(), orderBy('createdAt', 'desc'));
  unsubscribe = onSnapshot(q, (snapshot) => {
    // Сохраняем прокрутку, чтобы список не прыгал при обновлении
    const scrollTop = itemsList.scrollTop;
    itemsList.innerHTML = '';
    if (snapshot.empty) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
      snapshot.forEach((docSnap) => {
        const item = docSnap.data();
        renderItem(docSnap.id, item);
      });
    }
    itemsList.scrollTop = scrollTop;
  });
}

// ==========================================
// НОВАЯ ФУНКЦИЯ RENDERITEM С ЖЕСТАМИ
// ==========================================
function renderItem(id, item) {
  const li = document.createElement('li');
  li.dataset.id = id;

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

  let startX = 0;
  let currentX = 0;
  let translateX = 0;
  let isSwiping = false;
  const threshold = 80; // Расстояние для срабатывания действия

  const handleSwipeStart = (e) => {
    startX = e.touches[0].clientX;
    isSwiping = true;
    li.classList.add('is-swiping');
  };

  const handleSwipeMove = (e) => {
    if (!isSwiping) return;
    currentX = e.touches[0].clientX;
    translateX = currentX - startX;
    
    // Ограничиваем свайп, чтобы не уезжал слишком далеко
    if (translateX > threshold * 1.5) translateX = threshold * 1.5;
    if (translateX < -threshold * 1.5) translateX = -threshold * 1.5;

    swipeContent.style.transform = `translateX(${translateX}px)`;
  };

  const handleSwipeEnd = async () => {
    if (!isSwiping) return;
    isSwiping = false;
    li.classList.remove('is-swiping');

    if (translateX > threshold) {
      // Свайп вправо: отметить как выполненное
      const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
      await updateDoc(docRef, { completed: !item.completed });
    } else if (translateX < -threshold) {
      // Свайп влево: удалить
      li.style.height = `${li.offsetHeight}px`; // Фиксируем высоту для анимации
      li.style.transition = 'height 0.3s ease, opacity 0.3s ease';
      li.style.height = '0px';
      li.style.opacity = '0';
      setTimeout(async () => {
        const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
        await deleteDoc(docRef);
      }, 300);
    } else {
      // Возвращаем на место, если свайп был недостаточно сильным
      swipeContent.style.transform = `translateX(0px)`;
    }
  };

  // Добавляем слушатели для тач-событий
  li.addEventListener('touchstart', handleSwipeStart, { passive: true });
  li.addEventListener('touchmove', handleSwipeMove, { passive: true });
  li.addEventListener('touchend', handleSwipeEnd);
  li.addEventListener('touchcancel', handleSwipeEnd);

  itemsList.appendChild(li);
}

// Переключение вкладок
navItems.forEach(nav => {
  nav.addEventListener('click', () => {
    navItems.forEach(n => n.classList.remove('active'));
    nav.classList.add('active');
    currentTab = nav.dataset.tab;
    
    if (currentTab === 'tasks') {
      pageTitle.textContent = 'Задачи';
      itemInput.placeholder = 'Новая задача...';
      listTitle.textContent = 'Все задачи';
    } else {
      pageTitle.textContent = 'Покупки';
      itemInput.placeholder = 'Что купить?..';
      listTitle.textContent = 'Список покупок';
    }
    if (currentUser) loadData();
  });
});
