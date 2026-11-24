const path = require('path');
const admin = require('firebase-admin');
require('dotenv').config();

if (!admin.apps.length) {
  let credential;
  if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
    const serviceAccount = require(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    credential = admin.credential.cert(serviceAccount);
  } else if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    credential = admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    });
  } else {
    throw new Error('Configuration Firebase manquante : voir .env.example');
  }
  admin.initializeApp({ credential });
}

module.exports = {
  admin,
  db: admin.firestore(),
  auth: admin.auth(),
  messaging: admin.messaging(),
  FieldValue: admin.firestore.FieldValue,
};
