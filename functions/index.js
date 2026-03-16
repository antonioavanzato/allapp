const functions = require('firebase-functions');
const admin = require('firebase-admin');
admin.initializeApp();

const db = admin.firestore();

// Сохраняем токены пользователей
async function saveUserToken(userId, token) {
  const userRef = db.collection('users').doc(userId);
  await userRef.set({
    fcmTokens: admin.firestore.FieldValue.arrayUnion(token)
  }, { merge: true });
}

// Удаляем неработающие токены
async function removeInvalidToken(userId, token) {
  const userRef = db.collection('users').doc(userId);
  await userRef.update({
    fcmTokens: admin.firestore.FieldValue.arrayRemove(token)
  });
}

// Функция для отправки уведомлений при добавлении покупки
exports.sendShoppingNotification = functions.firestore
  .document('users/{userId}/shopping/{itemId}')
  .onCreate(async (snap, context) => {
    const item = snap.data();
    const userId = context.params.userId;
    
    try {
      // Получаем токены пользователя
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData || !userData.fcmTokens || userData.fcmTokens.length === 0) {
        console.log('Нет токенов для пользователя:', userId);
        return null;
      }

      const tokens = userData.fcmTokens;
      
      // Создаем сообщение
      const message = {
        notification: {
          title: '🛒 Новая покупка!',
          body: `${item.text}`,
          image: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png'
        },
        data: {
          type: 'shopping',
          itemId: context.params.itemId,
          click_action: 'FLUTTER_NOTIFICATION_CLICK'
        },
        webpush: {
          headers: {
            Urgency: 'high'
          },
          notification: {
            icon: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png',
            badge: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png',
            actions: [
              {
                action: 'open',
                title: 'Открыть список'
              }
            ]
          },
          fcm_options: {
            link: 'https://antonioavanzato.github.io/allapp/'
          }
        },
        tokens: tokens
      };

      // Отправляем уведомление
      const response = await admin.messaging().sendEachForMulticast(message);
      
      // Обрабатываем результаты
      if (response.failureCount > 0) {
        const failedTokens = [];
        response.responses.forEach((resp, idx) => {
          if (!resp.success) {
            failedTokens.push(tokens[idx]);
            console.log('Ошибка отправки:', resp.error);
          }
        });
        
        // Удаляем неработающие токены
        for (const token of failedTokens) {
          await removeInvalidToken(userId, token);
        }
      }
      
      console.log('Успешно отправлено:', response.successCount);
      return response;
      
    } catch (error) {
      console.error('Ошибка при отправке уведомления:', error);
      return null;
    }
  });

// Функция для отправки уведомлений при добавлении задачи
exports.sendTaskNotification = functions.firestore
  .document('users/{userId}/tasks/{taskId}')
  .onCreate(async (snap, context) => {
    const task = snap.data();
    const userId = context.params.userId;
    
    try {
      const userDoc = await db.collection('users').doc(userId).get();
      const userData = userDoc.data();
      
      if (!userData || !userData.fcmTokens) return;

      const message = {
        notification: {
          title: '✓ Новая задача!',
          body: `${task.text}`,
          image: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png'
        },
        data: {
          type: 'tasks',
          taskId: context.params.taskId
        },
        tokens: userData.fcmTokens
      };

      return admin.messaging().sendEachForMulticast(message);
    } catch (error) {
      console.error('Ошибка:', error);
      return null;
    }
  });

// Функция для сохранения токена от клиента
exports.saveUserToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const { token } = data;
  const userId = context.auth.uid;
  
  try {
    await saveUserToken(userId, token);
    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Ошибка сохранения токена');
  }
});

// Функция для удаления токена при выходе
exports.removeUserToken = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const { token } = data;
  const userId = context.auth.uid;
  
  try {
    await removeInvalidToken(userId, token);
    return { success: true };
  } catch (error) {
    throw new functions.https.HttpsError('internal', 'Ошибка удаления токена');
  }
});

// Функция для тестовой отправки
exports.testNotification = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError('unauthenticated', 'Требуется авторизация');
  }
  
  const userId = context.auth.uid;
  
  try {
    const userDoc = await db.collection('users').doc(userId).get();
    const userData = userDoc.data();
    
    if (!userData || !userData.fcmTokens) {
      return { success: false, message: 'Нет токенов для уведомлений' };
    }
    
    const message = {
      notification: {
        title: '✅ Тестовое уведомление',
        body: 'Если вы это видите, всё работает!',
        image: 'https://antonioavanzato.github.io/allapp/icons/icon-192.png'
      },
      tokens: userData.fcmTokens
    };
    
    const response = await admin.messaging().sendEachForMulticast(message);
    return { 
      success: true, 
      sent: response.successCount,
      failed: response.failureCount 
    };
    
  } catch (error) {
    console.error('Ошибка:', error);
    throw new functions.https.HttpsError('internal', error.message);
  }
});
