const router = require('express').Router();
const { body } = require('express-validator');
const { db, FieldValue } = require('../config/firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { serialize, byDateDesc } = require('../utils/helpers');
const notifyUser = require('../services/notify');

router.use(authenticate);

const shopRules = [
  body('name').trim().isLength({ min: 2 }).withMessage('Nom du commerce requis'),
  body('type').isIn(['restaurant', 'cafeteria']).withMessage('Type : restaurant ou cafeteria'),
  body('address').trim().isLength({ min: 5 }).withMessage('Adresse requise'),
  body('phone').optional().trim().matches(/^[0-9+ ]{8,15}$/).withMessage('Téléphone invalide'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('latitude').optional().isFloat({ min: -90, max: 90 }),
  body('longitude').optional().isFloat({ min: -180, max: 180 }),
  body('logoUrl').optional().isURL(),
];

const pick = (b) => ({
  name: b.name, type: b.type, address: b.address,
  phone: b.phone || null, description: b.description || '',
  latitude: b.latitude !== undefined ? Number(b.latitude) : null,
  longitude: b.longitude !== undefined ? Number(b.longitude) : null,
  logoUrl: b.logoUrl || null,
});

// POST /api/shops — un commerçant inscrit son établissement (statut "pending")
router.post('/', requireRole('merchant'), shopRules, validate, asyncHandler(async (req, res) => {
  const existing = await db.collection('shops').where('ownerId', '==', req.user.uid).limit(1).get();
  if (!existing.empty) throw httpError(409, 'Vous avez déjà un commerce enregistré');
  const ref = await db.collection('shops').add({
    ...pick(req.body), ownerId: req.user.uid, status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id, status: 'pending' });
}));

// GET /api/shops/mine — commerce du commerçant connecté
router.get('/mine', requireRole('merchant'), asyncHandler(async (req, res) => {
  const snap = await db.collection('shops').where('ownerId', '==', req.user.uid).limit(1).get();
  if (snap.empty) throw httpError(404, 'Aucun commerce enregistré');
  res.json(serialize(snap.docs[0]));
}));

// GET /api/shops?status=pending (admin) — par défaut : commerces approuvés
router.get('/', asyncHandler(async (req, res) => {
  let status = 'approved';
  if (req.user.role === 'admin' && req.query.status) status = req.query.status;
  const snap = await db.collection('shops').where('status', '==', status).get();
  res.json(snap.docs.map(serialize).sort(byDateDesc()));
}));

// GET /api/shops/:id
router.get('/:id', asyncHandler(async (req, res) => {
  const snap = await db.collection('shops').doc(req.params.id).get();
  if (!snap.exists) throw httpError(404, 'Commerce introuvable');
  const shop = snap.data();
  const allowed = shop.status === 'approved' || req.user.role === 'admin' || shop.ownerId === req.user.uid;
  if (!allowed) throw httpError(403, 'Commerce non disponible');
  res.json(serialize(snap));
}));

// PUT /api/shops/:id — modifier son commerce
router.put('/:id', requireRole('merchant'), shopRules, validate, asyncHandler(async (req, res) => {
  const ref = db.collection('shops').doc(req.params.id);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(404, 'Commerce introuvable');
  if (snap.data().ownerId !== req.user.uid) throw httpError(403, 'Ce commerce ne vous appartient pas');
  await ref.update({ ...pick(req.body), updatedAt: FieldValue.serverTimestamp() });
  res.json({ message: 'Commerce mis à jour' });
}));

// PATCH /api/shops/:id/status — l'admin valide ou rejette un commerce
router.patch(
  '/:id/status',
  requireRole('admin'),
  [body('status').isIn(['approved', 'rejected']).withMessage('Statut : approved ou rejected')],
  validate,
  asyncHandler(async (req, res) => {
    const ref = db.collection('shops').doc(req.params.id);
    const snap = await ref.get();
    if (!snap.exists) throw httpError(404, 'Commerce introuvable');
    await ref.update({ status: req.body.status, reviewedAt: FieldValue.serverTimestamp() });
    notifyUser(
      snap.data().ownerId,
      req.body.status === 'approved' ? 'Commerce validé' : 'Commerce refusé',
      `Votre commerce "${snap.data().name}" a été ${req.body.status === 'approved' ? 'validé' : 'refusé'}.`
    );
    res.json({ message: `Commerce ${req.body.status}` });
  })
);

module.exports = router;
