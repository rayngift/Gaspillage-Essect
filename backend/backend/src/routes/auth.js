const router = require('express').Router();
const { body } = require('express-validator');
const { auth, db, FieldValue } = require('../config/firebase');
const { authenticate } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');

// POST /api/auth/register  — inscription (étudiant ou commerçant uniquement)
// La CONNEXION / DÉCONNEXION se font côté client avec Firebase Auth ;
// le client envoie ensuite l'ID token dans l'en-tête Authorization: Bearer <token>
router.post(
  '/register',
  [
    body('email').trim().isEmail().withMessage('Email invalide').toLowerCase(),
    body('password').isLength({ min: 6 }).withMessage('Mot de passe : 6 caractères minimum'),
    body('name').trim().isLength({ min: 2 }).withMessage('Nom requis'),
    body('phone').optional().trim().matches(/^[0-9+ ]{8,15}$/).withMessage('Téléphone invalide'),
    body('role').isIn(['student', 'merchant']).withMessage('Rôle : student ou merchant'),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const { email, password, name, phone, role } = req.body;
    let userRecord;
    try {
      userRecord = await auth.createUser({ email, password, displayName: name });
    } catch (e) {
      if (e.code === 'auth/email-already-exists') throw httpError(409, 'Email déjà utilisé');
      throw httpError(400, e.message);
    }
    try {
      await db.collection('users').doc(userRecord.uid).set({
        email, name, phone: phone || null, role,
        disabled: false, fcmTokens: [],
        createdAt: FieldValue.serverTimestamp(),
      });
    } catch (e) {
      await auth.deleteUser(userRecord.uid); // annulation si l'écriture Firestore échoue
      throw e;
    }
    res.status(201).json({ uid: userRecord.uid, email, name, role });
  })
);

// GET /api/auth/me — profil de l'utilisateur connecté
router.get('/me', authenticate, (req, res) => {
  const { fcmTokens, createdAt, ...profile } = req.user;
  res.json({ ...profile, createdAt: createdAt && createdAt.toDate ? createdAt.toDate().toISOString() : null });
});

// PUT /api/auth/me — modifier son profil
router.put(
  '/me',
  authenticate,
  [
    body('name').optional().trim().isLength({ min: 2 }),
    body('phone').optional().trim().matches(/^[0-9+ ]{8,15}$/),
  ],
  validate,
  asyncHandler(async (req, res) => {
    const updates = {};
    if (req.body.name) updates.name = req.body.name;
    if (req.body.phone) updates.phone = req.body.phone;
    await db.collection('users').doc(req.user.uid).update(updates);
    if (updates.name) await auth.updateUser(req.user.uid, { displayName: updates.name });
    res.json({ message: 'Profil mis à jour' });
  })
);

// POST /api/auth/fcm-token — enregistrer le token FCM de l'appareil (notifications)
router.post(
  '/fcm-token',
  authenticate,
  [body('token').isString().notEmpty()],
  validate,
  asyncHandler(async (req, res) => {
    await db.collection('users').doc(req.user.uid).update({
      fcmTokens: FieldValue.arrayUnion(req.body.token),
    });
    res.json({ message: 'Token enregistré' });
  })
);

module.exports = router;
