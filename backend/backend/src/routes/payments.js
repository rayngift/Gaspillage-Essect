const router = require('express').Router();
const { body } = require('express-validator');
const { db, FieldValue } = require('../config/firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { markOrderPaid } = require('../services/orderService');

const isMock = () => (process.env.PAYMENT_MODE || 'mock') === 'mock';

// POST /api/payments/init { orderId } — initialise le paiement
//  - mode "konnect" : appelle Konnect (preprod) et renvoie payUrl (à ouvrir dans le navigateur / WebView)
//  - mode "mock"    : simulation locale, confirmer ensuite avec /mock-confirm
router.post(
  '/init',
  authenticate,
  requireRole('student'),
  [body('orderId').isString().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    const ref = db.collection('orders').doc(req.body.orderId);
    const snap = await ref.get();
    if (!snap.exists) throw httpError(404, 'Commande introuvable');
    const order = snap.data();
    if (order.studentId !== req.user.uid) throw httpError(403, 'Accès interdit');
    if (order.status !== 'pending_payment') throw httpError(400, 'Commande non payable');

    if (isMock()) return res.json({ mode: 'mock', orderId: ref.id, amount: order.total });

    const { KONNECT_API_URL, KONNECT_API_KEY, KONNECT_WALLET_ID, BACKEND_PUBLIC_URL } = process.env;
    if (!KONNECT_API_KEY || !KONNECT_WALLET_ID) throw httpError(500, 'Konnect non configuré');

    const response = await fetch(`${KONNECT_API_URL}/payments/init-payment`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': KONNECT_API_KEY },
      body: JSON.stringify({
        receiverWalletId: KONNECT_WALLET_ID,
        amount: Math.round(order.total * 1000), // Konnect travaille en millimes
        token: 'TND',
        type: 'immediate',
        description: `CampusSave - commande ${ref.id}`,
        acceptedPaymentMethods: ['wallet', 'bank_card', 'e-DINAR'],
        lifespan: 15,
        checkoutForm: false,
        addPaymentFeesToAmount: false,
        orderId: ref.id,
        webhook: `${BACKEND_PUBLIC_URL}/api/payments/webhook`,
        successUrl: process.env.PAYMENT_SUCCESS_URL,
        failUrl: process.env.PAYMENT_FAIL_URL,
        theme: 'light',
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok || !data.payUrl) throw httpError(502, 'Échec de l\'initialisation du paiement Konnect');

    await ref.update({ paymentRef: data.paymentRef || data.payRef, paymentInitAt: FieldValue.serverTimestamp() });
    res.json({ mode: 'konnect', payUrl: data.payUrl, paymentRef: data.paymentRef || data.payRef });
  })
);

// GET /api/payments/webhook?payment_ref=xxx — appelé par Konnect après paiement.
// On NE fait jamais confiance au webhook : on revérifie le statut auprès de Konnect.
router.get('/webhook', asyncHandler(async (req, res) => {
  const paymentRef = req.query.payment_ref;
  if (!paymentRef) return res.status(400).json({ error: 'payment_ref manquant' });

  const snap = await db.collection('orders').where('paymentRef', '==', paymentRef).limit(1).get();
  if (snap.empty) return res.status(404).json({ error: 'Commande introuvable' });

  const response = await fetch(`${process.env.KONNECT_API_URL}/payments/${paymentRef}`, {
    headers: { 'x-api-key': process.env.KONNECT_API_KEY },
  });
  const data = await response.json().catch(() => ({}));
  const status = data.payment && data.payment.status;
  if (status === 'completed') await markOrderPaid(snap.docs[0].id, paymentRef);
  res.json({ received: true, status });
}));

// POST /api/payments/mock-confirm { orderId } — SIMULATION (désactivé hors mode mock)
router.post(
  '/mock-confirm',
  authenticate,
  requireRole('student'),
  [body('orderId').isString().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    if (!isMock()) throw httpError(404, 'Route introuvable');
    const snap = await db.collection('orders').doc(req.body.orderId).get();
    if (!snap.exists) throw httpError(404, 'Commande introuvable');
    if (snap.data().studentId !== req.user.uid) throw httpError(403, 'Accès interdit');
    await markOrderPaid(snap.id, `MOCK-${Date.now()}`);
    res.json({ message: 'Paiement simulé confirmé', orderId: snap.id });
  })
);

module.exports = router;
