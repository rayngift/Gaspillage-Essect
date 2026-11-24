// Remplit Firestore avec les commerces et offres étudiantes de CampusSave.
// Usage :  npm run seed            (écrit dans Firebase)
//          npm run seed -- --dry   (affiche seulement, sans toucher à Firebase)
// Le script est relançable : il ne duplique rien (ids fixes), met à jour les prix et garde le stock actuel.
require('dotenv').config();

const DRY = process.argv.includes('--dry');
const PASSWORD = process.env.SEED_PASSWORD || 'CampusSave2026!'; // mot de passe des comptes commerçants de test
const DEFAULT_QUANTITY = Number(process.env.SEED_QUANTITY || 10);
const DAYS_AVAILABLE = Number(process.env.SEED_DAYS || 30);

// ------------------------------------------------------------------
// DONNÉES (prix en dinars tunisiens, DT)
// ------------------------------------------------------------------
const SHOPS = [
  {
    slug: 'gg-food-n-drinks', name: "GG Food n' Drinks", type: 'restaurant',
    address: '8 Rue Sadok Bseis, Tunis', phone: '56 023 619', mapsUrl: 'https://maps.app.goo.gl/WFvFoP71u5tbTeZg9',
    offers: [
      { key: 'salade-cesar', title: 'Salade César', category: 'repas', originalPrice: 14, discountedPrice: 12.6 },
      { key: 'cocktail', title: 'Cocktail', category: 'boisson', originalPrice: 6, discountedPrice: 4 },
      { key: 'virgin-mojito', title: 'Virgin Mojito', category: 'boisson', originalPrice: 5, discountedPrice: 4 },
    ],
  },
  {
    slug: 'resto-hamoush', name: 'Resto Hamoush', type: 'restaurant',
    address: '47 Av. Ali Trad, Tunis', phone: '25 438 545', mapsUrl: 'https://maps.app.goo.gl/x2fBXJsvWNQU142Z8',
    offers: [
      // Offre étudiante = mozzarella offerte (le prix ne baisse pas)
      { key: 'sandwich-salami', title: 'Sandwich salami + mozzarella offerte', category: 'sandwich',
        originalPrice: 3, discountedPrice: 3, description: 'Sandwich salami avec mozzarella gratuite pour les étudiants' },
    ],
  },
  {
    slug: 'resto-gusto', name: 'Resto Gusto', type: 'restaurant',
    address: null, phone: null, mapsUrl: null,
    offers: [
      { key: 'pizza-9', title: 'Pizza (gamme 9 DT)', category: 'pizza', originalPrice: 9, discountedPrice: 8 },
      { key: 'pizza-17', title: 'Pizza (gamme 17 DT)', category: 'pizza', originalPrice: 17, discountedPrice: 15 },
    ],
  },
  {
    slug: 'caffe-pause', name: 'Caffe Pause', type: 'cafeteria',
    address: 'Rue Khemais Ternaine, Tunis', phone: '98 961 613', mapsUrl: 'https://maps.app.goo.gl/qBr8DHGa6DHUL2oJ8',
    offers: [
      { key: 'tiramisu-cocktail', title: 'Tiramisu + cocktail', category: 'formule', originalPrice: 13, discountedPrice: 10,
        description: 'Tiramisu (6 DT) + cocktail (7 DT)' },
      { key: 'gateau-cocktail', title: 'Gâteau soirée + cocktail', category: 'formule', originalPrice: 13, discountedPrice: 10,
        description: 'Gâteau soirée (6 DT) + cocktail (7 DT)' },
    ],
  },
  {
    slug: 'restaurant-pause-sandwich', name: 'Restaurant Pause Sandwich', type: 'restaurant',
    address: null, phone: null, mapsUrl: null,
    offers: [
      { key: 'sandwich-escalope', title: 'Sandwich escalope', category: 'sandwich', originalPrice: 7, discountedPrice: 5.5 },
    ],
  },
  {
    slug: 'caffe-chez-nous', name: 'Caffe Chez Nous', type: 'cafeteria',
    address: 'Av. Ali Trad, Tunis', phone: '22 296 363', mapsUrl: 'https://maps.app.goo.gl/GP1K5HWbehH9BUbX7',
    offers: [
      { key: 'cafe-cookies', title: 'Café au choix + cookies', category: 'formule', originalPrice: 7, discountedPrice: 6,
        description: 'Cookies (5 DT) + café au choix (2 DT)' },
    ],
  },
  {
    slug: 'resto-delicious', name: 'Resto Delicious', type: 'restaurant',
    address: null, phone: null, mapsUrl: null,
    offers: [
      { key: 'makloub-escalope', title: 'Sandwich makloub escalope', category: 'sandwich', originalPrice: 8, discountedPrice: 6.5 },
    ],
  },
];

// ------------------------------------------------------------------
const now = new Date();
const pickupStart = now.toISOString();
const pickupEnd = new Date(now.getTime() + DAYS_AVAILABLE * 86400000).toISOString();

async function main() {
  if (DRY) {
    SHOPS.forEach((s) => {
      console.log(`\n${s.name} (${s.type}) ${s.phone || ''}`);
      s.offers.forEach((o) => console.log(`  - ${o.title} : ${o.originalPrice} -> ${o.discountedPrice} DT [${o.category}]`));
    });
    console.log(`\n${SHOPS.length} commerces, ${SHOPS.reduce((n, s) => n + s.offers.length, 0)} offres (simulation, rien écrit).`);
    return;
  }

  const { auth, db, FieldValue } = require('../src/config/firebase');

  for (const shop of SHOPS) {
    const email = `${shop.slug}@campussave.tn`;
    let user;
    try {
      user = await auth.getUserByEmail(email);
    } catch {
      user = await auth.createUser({ email, password: PASSWORD, displayName: `Gérant ${shop.name}` });
    }
    await db.collection('users').doc(user.uid).set({
      email, name: `Gérant ${shop.name}`, phone: shop.phone, role: 'merchant',
      disabled: false, fcmTokens: [], createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    await db.collection('shops').doc(shop.slug).set({
      name: shop.name, type: shop.type, ownerId: user.uid,
      address: shop.address || 'À compléter', phone: shop.phone, mapsUrl: shop.mapsUrl,
      description: '', latitude: null, longitude: null, logoUrl: null,
      status: 'approved', createdAt: FieldValue.serverTimestamp(),
    }, { merge: true });

    let created = 0, updated = 0;
    for (const o of shop.offers) {
      const ref = db.collection('offers').doc(`${shop.slug}-${o.key}`);
      if ((await ref.get()).exists) {
        // offre déjà présente : on met à jour titre/prix, mais on garde le stock actuel
        await ref.update({
          title: o.title, description: o.description || '', category: o.category,
          originalPrice: o.originalPrice, discountedPrice: o.discountedPrice,
        });
        updated++;
        continue;
      }
      await ref.set({
        title: o.title, description: o.description || '', category: o.category,
        originalPrice: o.originalPrice, discountedPrice: o.discountedPrice,
        quantity: DEFAULT_QUANTITY, photoUrl: null, pickupStart, pickupEnd,
        shopId: shop.slug, shopName: shop.name, merchantId: user.uid,
        active: true, createdAt: FieldValue.serverTimestamp(),
      });
      created++;
    }
    console.log(`OK  ${shop.name} : compte ${email}, ${created} offre(s) créée(s), ${updated} mise(s) à jour`);
  }
  console.log(`\nTerminé. Mot de passe des comptes commerçants de test : ${PASSWORD}`);
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
