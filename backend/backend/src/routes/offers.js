const router = require('express').Router();
const { body } = require('express-validator');
const { db, FieldValue } = require('../config/firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { serialize, byDateDesc } = require('../utils/helpers');

const norm = (s) => String(s || '').toLowerCase();

const offerRules = [
  body('title').trim().isLength({ min: 2, max: 100 }).withMessage('Titre requis'),
  body('description').optional().trim().isLength({ max: 500 }),
  body('category').trim().notEmpty().withMessage('Catégorie requise'),
  body('originalPrice').isFloat({ gt: 0 }).withMessage('Prix initial > 0'),
  body('discountedPrice').isFloat({ gt: 0 }).withMessage('Prix réduit > 0')
    .custom((v, { req }) => Number(v) < Number(req.body.originalPrice))
    .withMessage('Le prix réduit doit être inférieur au prix initial'),
  body('quantity').isInt({ min: 1 }).withMessage('Quantité >= 1'),
  // La photo est envoyée vers Firebase Storage par le client ; on stocke son URL
  body('photoUrl').optional().isURL().withMessage('URL de photo invalide'),
  body('pickupStart').isISO8601().withMessage('Début de récupération invalide (ISO 8601)'),
  body('pickupEnd').isISO8601().withMessage('Fin de récupération invalide (ISO 8601)')
    .custom((v, { req }) => new Date(v) > new Date(req.body.pickupStart))
    .withMessage('La fin doit être après le début'),
];

const pick = (b) => ({
  title: b.title, description: b.description || '', category: b.category,
  originalPrice: Number(b.originalPrice), discountedPrice: Number(b.discountedPrice),
  quantity: Number(b.quantity), photoUrl: b.photoUrl || null,
  pickupStart: new Date(b.pickupStart).toISOString(), pickupEnd: new Date(b.pickupEnd).toISOString(),
});

// GET /api/offers?search=&category=&shopId=&minPrice=&maxPrice= (PUBLIC)
router.get('/', asyncHandler(async (req, res) => {
  const { search, category, shopId, minPrice, maxPrice } = req.query;
  let q = db.collection('offers').where('active', '==', true);
  if (shopId) q = q.where('shopId', '==', shopId);
  const snap = await q.get();
  const now = new Date();
  let offers = snap.docs.map(serialize)
    .filter((o) => o.quantity > 0 && new Date(o.pickupEnd) > now);
  if (category) offers = offers.filter((o) => norm(o.category) === norm(category));
  if (minPrice) offers = offers.filter((o) => o.discountedPrice >= Number(minPrice));
  if (maxPrice) offers = offers.filter((o) => o.discountedPrice <= Number(maxPrice));
  if (search) {
    const s = norm(search);
    offers = offers.filter((o) => norm(o.title).includes(s) || norm(o.shopName).includes(s) || norm(o.description).includes(s));
  }
  res.json(offers.sort(byDateDesc()));
}));

// GET /api/offers/mine — offres du commerçant connecté (PROTÉGÉ)
router.get('/mine', authenticate, requireRole('merchant'), asyncHandler(async (req, res) => {
  const snap = await db.collection('offers').where('merchantId', '==', req.user.uid).get();
  res.json(snap.docs.map(serialize).sort(byDateDesc()));
}));

// GET /api/offers/:id — détail d'une offre (PUBLIC)
router.get('/:id', asyncHandler(async (req, res) => {
  const snap = await db.collection('offers').doc(req.params.id).get();
  if (!snap.exists) throw httpError(404, 'Offre introuvable');
  res.json(serialize(snap));
}));

// POST /api/offers — publier une offre (PROTÉGÉ)
router.post('/', authenticate, requireRole('merchant'), offerRules, validate, asyncHandler(async (req, res) => {
  const shopSnap = await db.collection('shops').where('ownerId', '==', req.user.uid).limit(1).get();
  if (shopSnap.empty) throw httpError(400, "Enregistrez d'abord votre commerce");
  const shop = shopSnap.docs[0];
  if (shop.data().status !== 'approved') throw httpError(403, "Votre commerce n'est pas encore validé par l'administrateur");
  const ref = await db.collection('offers').add({
    ...pick(req.body),
    shopId: shop.id, shopName: shop.data().name, merchantId: req.user.uid,
    active: true, createdAt: FieldValue.serverTimestamp(),
  });
  res.status(201).json({ id: ref.id });
}));

const getOwnOffer = async (id, uid) => {
  const ref = db.collection('offers').doc(id);
  const snap = await ref.get();
  if (!snap.exists) throw httpError(404, 'Offre introuvable');
  if (snap.data().merchantId !== uid) throw httpError(403, "Cette offre ne vous appartient pas");
  return ref;
};

// PUT /api/offers/:id — modifier (PROTÉGÉ)
router.put('/:id', authenticate, requireRole('merchant'), offerRules, validate, asyncHandler(async (req, res) => {
  const ref = await getOwnOffer(req.params.id, req.user.uid);
  const updates = { ...pick(req.body), updatedAt: FieldValue.serverTimestamp() };
  if (req.body.active !== undefined) updates.active = Boolean(req.body.active);
  await ref.update(updates);
  res.json({ message: 'Offre mise à jour' });
}));

// DELETE /api/offers/:id — supprimer (PROTÉGÉ)
router.delete('/:id', authenticate, requireRole('merchant'), asyncHandler(async (req, res) => {
  const ref = await getOwnOffer(req.params.id, req.user.uid);
  await ref.delete();
  res.json({ message: 'Offre supprimée' });
}));

module.exports = router;