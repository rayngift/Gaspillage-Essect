const crypto = require('crypto');
const { db, FieldValue } = require('../config/firebase');
const notifyUser = require('./notify');

// Passe une commande en "payée" et génère le token du QR code (idempotent)
exports.markOrderPaid = async (orderId, paymentRef) => {
  const ref = db.collection('orders').doc(orderId);
  const result = await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    if (!snap.exists) return null;
    const order = snap.data();
    if (order.status !== 'pending_payment') return { changed: false, order };
    const qrToken = crypto.randomBytes(16).toString('hex');
    t.update(ref, {
      status: 'paid',
      qrToken,
      paymentRef: paymentRef || order.paymentRef || null,
      paidAt: FieldValue.serverTimestamp(),
    });
    return { changed: true, order };
  });
  if (result && result.changed) {
    notifyUser(result.order.studentId, 'Paiement confirmé', 'Votre QR code est prêt pour la récupération.', { orderId });
    notifyUser(result.order.merchantId, 'Nouvelle commande payée', "Une commande attend d'être récupérée.", { orderId });
  }
  return result;
};

// Remet en stock les articles d'une commande annulée
exports.cancelOrder = async (orderId) => {
  const ref = db.collection('orders').doc(orderId);
  await db.runTransaction(async (t) => {
    const snap = await t.get(ref);
    const order = snap.data();
    if (order.status !== 'pending_payment') return;
    const offerRefs = order.items.map((i) => db.collection('offers').doc(i.offerId));
    const offerSnaps = await t.getAll(...offerRefs);
    offerSnaps.forEach((s, idx) => {
      if (s.exists) t.update(offerRefs[idx], { quantity: FieldValue.increment(order.items[idx].quantity) });
    });
    t.update(ref, { status: 'cancelled', cancelledAt: FieldValue.serverTimestamp() });
  });
};
