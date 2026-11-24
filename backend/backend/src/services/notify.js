const { db, messaging } = require('../config/firebase');

// Envoie une notification FCM (Firebase Cloud Messaging) à un utilisateur
// Ne bloque jamais le flux principal en cas d'erreur
module.exports = async function notifyUser(uid, title, body, data = {}) {
  try {
    const snap = await db.collection('users').doc(uid).get();
    const tokens = (snap.exists && snap.data().fcmTokens) || [];
    if (!tokens.length) return;
    await messaging.sendEachForMulticast({
      tokens,
      notification: { title, body },
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    });
  } catch (e) {
    console.warn('Notification FCM non envoyée :', e.message);
  }
};
