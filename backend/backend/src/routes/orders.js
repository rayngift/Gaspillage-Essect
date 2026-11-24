const router = require('express').Router();
const { body } = require('express-validator');
const QRCode = require('qrcode');
const { db, FieldValue } = require('../config/firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { serialize, byDateDesc } = require('../utils/helpers');
const { cancelOrder } = require('../services/orderService');
const notifyUser = require('../services/notify');

router.use(authenticate);

// POST /api/orders — réservation (stock décrémenté dans une transaction : pas de sur-réservation)
router.post(
  '/',
  requireRole('student'),
  [
    body('items').isArray({ min: 1 }).withMessage('Au moins un article'),
    body('items.*.offerId').isString().notEmpty(),
    body('items.*.quantity').isInt({ min: 1, max: 20 }).withMessage('Quantité entre 1 et 20'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const items = req.body.items;
    if (new Set(items.map((i) => i.offerId)).size !== items.length) {
      throw httpError(400, 'Offre en double dans la commande');
    }
    const orderRef = db.collection('orders').doc();

    await db.runTransaction(async (t) => {
      const offerRefs = items.map((i) => db.collection('offers').doc(i.offerId));
      const snaps = await t.getAll(...offerRefs); // toutes les lectures AVANT les écritures
      let shopId = null, merchantId = null, shopName = null, total = 0;
      const lines = [];
      snaps.forEach((s, idx) => {
        if (!s.exists) throw httpError(404, 'Offre introuvable');
        const o = s.data();
        const q = Number(items[idx].quantity);
        if (!o.active || new Date(o.pickupEnd) <= new Date()) throw httpError(400, `Offre indisponible : ${o.title}`);
        if (o.quantity < q) throw httpError(409, `Stock insuffisant pour : ${o.title}`);
        if (shopId && shopId !== o.shopId) throw httpError(400, 'Une commande ne peut contenir que des offres du même commerce');
        shopId = o.shopId; merchantId = o.merchantId; shopName = o.shopName;
        total += o.discountedPrice * q;
        lines.push({
          offerId: s.id, title: o.title, quantity: q,
          unitPrice: o.discountedPrice, originalPrice: o.originalPrice,
          pickupStart: o.pickupStart, pickupEnd: o.pickupEnd,
        });
      });
      snaps.forEach((s, idx) => {
        t.update(offerRefs[idx], { quantity: FieldValue.increment(-Number(items[idx].quantity)) });
      });
      t.set(orderRef, {
        studentId: req.user.uid, studentName: req.user.name,
        shopId, shopName, merchantId, items: lines,
        total: Math.round(total * 1000) / 1000,
        status: 'pending_payment', qrToken: null, paymentRef: null,
        createdAt: FieldValue.serverTimestamp(),
      });
    });
    const created = await orderRef.get();
    res.status(201).json(serialize(created));
  })
);

// GET /api/orders/mine — commandes de l'étudiant
router.get('/mine', requireRole('student'), asyncHandler(async (req, res) => {
  const snap = await db.collection('orders').where('studentId', '==', req.user.uid).get();
  res.json(snap.docs.map((d) => { const o = serialize(d); delete o.qrToken; return o; }).sort(byDateDesc()));
}));

// GET /api/orders/shop?status=paid — commandes reçues par le commerçant
router.get('/shop', requireRole('merchant'), asyncHandler(async (req, res) => {
  const snap = await db.collection('orders').where('merchantId', '==', req.user.uid).get();
  let orders = snap.docs.map((d) => { const o = serialize(d); delete o.qrToken; return o; });
  if (req.query.status) orders = orders.filter((o) => o.status === req.query.status);
  res.json(orders.sort(byDateDesc()));
}));

// POST /api/orders/verify-qr — le commerçant valide la récupération avec le token du QR code
router.post(
  '/verify-qr',
  requireRole('merchant'),
  [body('token').isString().notEmpty().withMessage('Token QR requis')],
  validate,
  asyncHandler(async (req, res) => {
    const snap = await db.collection('orders').where('qrToken', '==', req.body.token).limit(1).get();
    if (snap.empty) throw httpError(404, 'QR code invalide');
    const doc = snap.docs[0];
    const order = doc.data();
    if (order.merchantId !== req.user.uid) throw httpError(403, "Cette commande n'appartient pas à votre commerce");
    if (order.status === 'picked_up') throw httpError(409, 'Commande déjà récupérée');
    if (order.status !== 'paid') throw httpError(400, 'Commande non payée');

    await doc.ref.update({ status: 'picked_up', pickedUpAt: FieldValue.serverTimestamp() });
    notifyUser(order.studentId, 'Commande récupérée', 'Merci d\'avoir lutté contre le gaspillage !', { orderId: doc.id });
    res.json({ message: 'Commande validée', orderId: doc.id, items: order.items });
  })
);

// Helper : charge une commande et vérifie qu'on y a accès
const loadOrder = async (id, user) => {
  const snap = await db.collection('orders').doc(id).get();
  if (!snap.exists) throw httpError(404, 'Commande introuvable');
  const o = snap.data();
  const ok = o.studentId === user.uid || o.merchantId === user.uid || user.role === 'admin';
  if (!ok) throw httpError(403, 'Accès interdit');
  return { snap, order: o };
};

// GET /api/orders/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const { snap, order } = await loadOrder(req.params.id, req.user);
  const out = serialize(snap);
  if (order.studentId !== req.user.uid) delete out.qrToken; // seul l'étudiant voit son token
  res.json(out);
}));

// GET /api/orders/:id/qr — QR code (image PNG en data URL) disponible après paiement
router.get('/:id/qr', requireRole('student'), asyncHandler(async (req, res) => {
  const { order } = await loadOrder(req.params.id, req.user);
  if (order.studentId !== req.user.uid) throw httpError(403, 'Accès interdit');
  if (!order.qrToken) throw httpError(400, 'QR code disponible uniquement après paiement');
  const qrDataUrl = await QRCode.toDataURL(order.qrToken, { width: 300, margin: 2 });
  res.json({ token: order.qrToken, qrDataUrl, status: order.status });
}));

// POST /api/orders/:id/cancel — annulation (avant paiement) et remise en stock
router.post('/:id/cancel', requireRole('student'), asyncHandler(async (req, res) => {
  const { order } = await loadOrder(req.params.id, req.user);
  if (order.studentId !== req.user.uid) throw httpError(403, 'Accès interdit');
  if (order.status !== 'pending_payment') throw httpError(400, 'Seule une commande non payée peut être annulée');
  await cancelOrder(req.params.id);
  res.json({ message: 'Commande annulée' });
}));

module.exports = router;
