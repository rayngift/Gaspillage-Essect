const router = require('express').Router();
const { body } = require('express-validator');
const { auth, db } = require('../config/firebase');
const { authenticate, requireRole } = require('../middleware/auth');
const validate = require('../middleware/validate');
const asyncHandler = require('../utils/asyncHandler');
const { httpError } = require('../utils/httpError');
const { serialize, byDateDesc } = require('../utils/helpers');

router.use(authenticate, requireRole('admin'));

// GET /api/admin/users?role=student
router.get('/users', asyncHandler(async (req, res) => {
  let q = db.collection('users');
  if (req.query.role) q = q.where('role', '==', req.query.role);
  const snap = await q.get();
  res.json(snap.docs.map((d) => { const u = serialize(d); delete u.fcmTokens; return u; }).sort(byDateDesc()));
}));

// PATCH /api/admin/users/:id/disable { disabled: true|false } — bloquer / débloquer
router.patch('/users/:id/disable', [body('disabled').isBoolean()], validate, asyncHandler(async (req, res) => {
  if (req.params.id === req.user.uid) throw httpError(400, 'Vous ne pouvez pas vous désactiver vous-même');
  const ref = db.collection('users').doc(req.params.id);
  if (!(await ref.get()).exists) throw httpError(404, 'Utilisateur introuvable');
  const disabled = req.body.disabled === true || req.body.disabled === 'true';
  await ref.update({ disabled });
  await auth.updateUser(req.params.id, { disabled });
  res.json({ message: disabled ? 'Utilisateur désactivé' : 'Utilisateur réactivé' });
}));

module.exports = router;
