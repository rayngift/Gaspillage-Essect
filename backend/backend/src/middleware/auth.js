const { auth, db, FieldValue } = require('../config/firebase');

const ADMIN_EMAIL = 'admin@gmail.com';

// Vérifie le Firebase ID Token (Authorization: Bearer <token>) et charge le profil
exports.authenticate = async (req, res, next) => {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Token manquant' });

  try {
    const decoded = await auth.verifyIdToken(token);
    const email = String(decoded.email || '').trim().toLowerCase();
    const isAdminEmail = email === ADMIN_EMAIL;

    const userRef = db.collection('users').doc(decoded.uid);
    const snap = await userRef.get();

    if (!snap.exists) {
      if (!isAdminEmail) {
        return res.status(403).json({ error: 'Profil utilisateur introuvable' });
      }
      const adminData = {
        uid: decoded.uid,
        email,
        name: decoded.name || 'Administrateur CampusSave',
        role: 'admin',
        disabled: false,
      };
      await userRef.set({
        ...adminData,
        createdAt: FieldValue.serverTimestamp(),
      });
      req.user = adminData;
      return next();
    }

    const user = snap.data();
    if (user.disabled) return res.status(403).json({ error: 'Compte désactivé' });

    if (isAdminEmail && user.role !== 'admin') {
      await userRef.update({
        role: 'admin',
        updatedAt: FieldValue.serverTimestamp(),
      });
      user.role = 'admin';
    }

    req.user = { uid: decoded.uid, ...user };
    next();
  } catch (e) {
    return res.status(401).json({ error: 'Token invalide ou expiré' });
  }
};

// Contrôle d'accès selon le rôle : requireRole('admin'), requireRole('merchant','admin')
exports.requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'Accès interdit pour ce rôle' });
  }
  next();
};