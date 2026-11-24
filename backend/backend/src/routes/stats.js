const router = require('express').Router();
const { db } = require('../config/firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(authenticate);
const PAID = ['paid', 'picked_up'];
const r3 = (n) => Math.round(n * 1000) / 1000;

// GET /api/stats/student — tableau de bord étudiant
router.get('/student', requireRole('student'), asyncHandler(async (req, res) => {
  const snap = await db.collection('orders').where('studentId', '==', req.user.uid).get();
  const orders = snap.docs.map((d) => d.data());
  const paid = orders.filter((o) => PAID.includes(o.status));
  const picked = orders.filter((o) => o.status === 'picked_up');
  const savings = paid.reduce((s, o) => s + o.items.reduce((x, i) => x + (i.originalPrice - i.unitPrice) * i.quantity, 0), 0);
  res.json({
    totalOrders: orders.length,
    paidOrders: paid.length,
    pickedUpOrders: picked.length,
    totalSpent: r3(paid.reduce((s, o) => s + o.total, 0)),
    totalSaved: r3(savings),
  });
}));

// GET /api/stats/merchant
router.get('/merchant', requireRole('merchant'), asyncHandler(async (req, res) => {
  const [ordersSnap, offersSnap] = await Promise.all([
    db.collection('orders').where('merchantId', '==', req.user.uid).get(),
    db.collection('offers').where('merchantId', '==', req.user.uid).get(),
  ]);
  const orders = ordersSnap.docs.map((d) => d.data());
  const paid = orders.filter((o) => PAID.includes(o.status));
  const byProduct = {};
  paid.forEach((o) => o.items.forEach((i) => { byProduct[i.title] = (byProduct[i.title] || 0) + i.quantity; }));
  res.json({
    totalOrders: orders.length,
    pendingPickup: orders.filter((o) => o.status === 'paid').length,
    pickedUp: orders.filter((o) => o.status === 'picked_up').length,
    revenue: r3(paid.reduce((s, o) => s + o.total, 0)),
    activeOffers: offersSnap.docs.filter((d) => d.data().active && d.data().quantity > 0).length,
    itemsRescued: paid.reduce((s, o) => s + o.items.reduce((x, i) => x + i.quantity, 0), 0),
    topProducts: Object.entries(byProduct).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([title, quantity]) => ({ title, quantity })),
  });
}));

// GET /api/stats/admin
router.get('/admin', requireRole('admin'), asyncHandler(async (req, res) => {
  const [users, shops, orders] = await Promise.all([
    db.collection('users').get(), db.collection('shops').get(), db.collection('orders').get(),
  ]);
  const u = users.docs.map((d) => d.data());
  const s = shops.docs.map((d) => d.data());
  const o = orders.docs.map((d) => d.data());
  const paid = o.filter((x) => PAID.includes(x.status));
  res.json({
    users: { total: u.length, students: u.filter((x) => x.role === 'student').length, merchants: u.filter((x) => x.role === 'merchant').length, admins: u.filter((x) => x.role === 'admin').length },
    shops: { total: s.length, pending: s.filter((x) => x.status === 'pending').length, approved: s.filter((x) => x.status === 'approved').length, rejected: s.filter((x) => x.status === 'rejected').length },
    orders: { total: o.length, paid: paid.length, pickedUp: o.filter((x) => x.status === 'picked_up').length, cancelled: o.filter((x) => x.status === 'cancelled').length },
    revenue: r3(paid.reduce((t, x) => t + x.total, 0)),
    itemsRescued: paid.reduce((t, x) => t + x.items.reduce((a, i) => a + i.quantity, 0), 0),
  });
}));

module.exports = router;
