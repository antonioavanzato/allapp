// Импорты Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getFirestore, collection, addDoc, onSnapshot, doc, updateDoc, deleteDoc, query, orderBy, serverTimestamp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-auth.js";

// Конфигурация Firebase
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

onAuthStateChanged(auth, (user) => {
    if (user) {
        currentUser = user;
        authScreen.classList.add('hidden');
        mainApp.classList.remove('hidden');
        loadData();
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
        authError.textContent = 'Ошибка входа: неверный email или пароль.';
    }
});

registerBtn.addEventListener('click', async () => {
    try {
        authError.textContent = '';
        await createUserWithEmailAndPassword(auth, emailInput.value, passwordInput.value);
    } catch (error) {
        authError.textContent = 'Ошибка: пароль слишком простой или email занят.';
    }
});

logoutBtn.addEventListener('click', () => signOut(auth));

function getUserCollection() { return collection(db, 'users', currentUser.uid, currentTab); }

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
itemInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') { e.preventDefault(); addItem(); } });

function loadData() {
    if (unsubscribe) unsubscribe();
    const q = query(getUserCollection(), orderBy('createdAt', 'desc'));
    unsubscribe = onSnapshot(q, (snapshot) => {
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
    let startX = 0, currentX = 0, translateX = 0, isSwiping = false;
    const threshold = 80;

    const getClientX = (e) => e.touches ? e.touches[0].clientX : e.clientX;

    const onSwipeStart = (e) => {
        startX = getClientX(e);
        isSwiping = true;
        li.classList.add('is-swiping');
        swipeContent.style.cursor = 'grabbing';
    };

    const onSwipeMove = (e) => {
        if (!isSwiping) return;
        currentX = getClientX(e);
        translateX = currentX - startX;
        if (Math.abs(translateX) > 5) { // Отключаем вертикальный скролл только при реальном горизонтальном сдвиге
            e.preventDefault();
        }
        swipeContent.style.transform = `translateX(${translateX}px)`;
    };

    const onSwipeEnd = async () => {
        if (!isSwiping) return;
        isSwiping = false;
        li.classList.remove('is-swiping');
        swipeContent.style.cursor = 'grab';

        if (translateX > threshold) {
            const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
            await updateDoc(docRef, { completed: !item.completed });
        } else if (translateX < -threshold) {
            li.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
            li.style.transform = 'scale(0.8)';
            li.style.opacity = '0';
            setTimeout(async () => {
                const docRef = doc(db, 'users', currentUser.uid, currentTab, id);
                await deleteDoc(docRef);
            }, 300);
        } else {
            swipeContent.style.transform = `translateX(0px)`;
        }
        translateX = 0; // Сбрасываем для следующего свайпа
    };
    
    // Универсальные слушатели для мыши и касаний
    li.addEventListener('touchstart', onSwipeStart, { passive: true });
    li.addEventListener('touchmove', onSwipeMove);
    li.addEventListener('touchend', onSwipeEnd);
    li.addEventListener('touchcancel', onSwipeEnd);
    li.addEventListener('mousedown', onSwipeStart);
    li.addEventListener('mousemove', onSwipeMove);
    document.addEventListener('mouseup', () => { if(isSwiping) onSwipeEnd(); }); // Слушаем mouseup на всем документе
    li.addEventListener('mouseleave', () => { if(isSwiping) onSwipeEnd(); });

    itemsList.appendChild(li);
}

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
