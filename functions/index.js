const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Токены всей семьи хранятся в одном документе
const TOKENS_DOC = db.collection('family').doc('tokens');

// Добавить токен в семейный список
async function saveFamilyToken(token) {
  await TOKENS_DOC.set({
    fcmTokens: admin.firestore.FieldValue.arrayUnion(token)
  }, { merge: true });
}

// Удалить нерабочий токен
async function removeInvalidToken(token) {
  await TOKENS_DOC.update({
    fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
  });
}

// Получить все токены семьи
async function getFamilyTokens() {
  const doc = await TOKENS_DOC.get();
  if (!doc.exists) return [];
  return doc.data().fcmTokens || [];
}

// Отправить уведомление всем членам семьи
async function sendToFamily(title, body, data = {}) {
  const tokens = await getFamilyTokens();
  if (tokens.length === 0) {
    console.log('Нет FCM-токенов');
    return null;
  }

  const message = {
    notification: { title, body },
    data,
    webpush: {
      headers: { Urgency: 'high' },
      notification: {
        icon: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png',
        badge: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png',
      },
      fcm_options: {
        link: 'https://antonioavanzato.github.io/allapp/'
      }
    },
    tokens
  };

  const response = await admin.messaging().sendEachForMulticast(message);
  console.log(`Отправлено: ${response.successCount}, ошибок: ${response.failureCount}`);

  // Чистим нерабочие токены
  if (response.failureCount > 0) {
    for (let i = 0; i < response.responses.length; i++) {
      if (!response.responses[i].success) {
        console.log('Удаляем нерабочий токен:', tokens[i]);
        await removeInvalidToken(tokens[i]);
      }
    }
  }

  return response;
}

// ── Триггер: новая покупка ──
exports.sendShoppingNotification = functions.firestore
  .document('family/shared/shopping/{itemId}')
  .onCreate(async (snap, context) => {
    const item = snap.data();
    const addedBy = item.createdByName || 'Кто-то';
    try {
      return await sendToFamily(
        '🛒 Новая покупка',
        `${addedBy} добавил(а): ${item.text}`,
        { type: 'shopping', itemId: context.params.itemId }
      );
    } catch (error) {
      console.error('Ошибка уведомления о покупке:', error);
      return null;
    }
  });

// ── Триггер: новая задача ──
exports.sendTaskNotification = functions.firestore
  .document('family/shared/tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const task = snap.data();
    const addedBy = task.createdByName || 'Кто-то';
    try {
      return await sendToFamily(
        '✓ Новая задача',
        `${addedBy} добавил(а): ${task.text}`,
        { type: 'tasks', taskId: context.params.taskId }
      );
    } catch (error) {
      console.error('Ошибка уведомления о задаче:', error);
      return null;
    }
  });

// ── HTTPS: сохранить токен ──
exports.saveUserToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  const { token } = data;
  if (!token) {
    throw new functions.https.HttpsError('invalid-argument', 'Токен не передан');
  }
  try {
    await saveFamilyToken(token);
    return { success: true };
  } catch (error) {
    console.error('Ошибка сохранения токена:', error);
    throw new functions.https.HttpsError('internal', 'Ошибка сохранения токена');
  }
});

// ── HTTPS: удалить токен (при выходе) ──
exports.removeUserToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  const { token } = data;
  if (!token) return { success: true };
  try {
    await removeInvalidToken(token);
    return { success: true };
  } catch (error) {
    console.error('Ошибка удаления токена:', error);
    throw new functions.https.HttpsError('internal', 'Ошибка удаления токена');
  }
});

// ── HTTPS: тестовое уведомление ──
exports.testNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  try {
    const response = await sendToFamily(
      '✅ Тест',
      'Уведомления работают!',
      { type: 'test' }
    );
    if (!response) return { success: false, message: 'Нет токенов' };
    return { success: true, sent: response.successCount, failed: response.failureCount };
  } catch (error) {
    console.error('Ошибка тестового уведомления:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
