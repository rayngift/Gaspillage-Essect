// Usage : npm run create-admin -- admin@campussave.tn MotDePasse123 "Admin"
// Crée (ou promeut) un administrateur : le rôle admin ne peut pas être obtenu via /register
require('dotenv').config();
const { auth, db, FieldValue } = require('../src/config/firebase');

(async () => {
  const [email, password, name = 'Administrateur'] = process.argv.slice(2);
  if (!email || !password) {
    console.error('Usage : npm run create-admin -- <email> <motdepasse> [nom]');
    process.exit(1);
  }
  let user;
  try {
    user = await auth.getUserByEmail(email);
  } catch {
    user = await auth.createUser({ email, password, displayName: name });
  }
  await db.collection('users').doc(user.uid).set({
    email, name, phone: null, role: 'admin', disabled: false, fcmTokens: [],
    createdAt: FieldValue.serverTimestamp(),
  }, { merge: true });
  console.log(`Admin prêt : ${email} (uid ${user.uid})`);
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
