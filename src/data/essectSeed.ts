import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { OfferCategory, ShopCategory } from '../types/campussave';

export const GENERATED_IMAGES = {
  hero: '/src/assets/images/hero_campussave_essect_1795458889307.jpg',
  surpriseBasket: '/src/assets/images/offer_surprise_basket_1795458890216.jpg',
  boulangerie: '/src/assets/images/offer_boulangerie_viennoiseries_1795458889892.jpg',
  saladBowl: '/src/assets/images/offer_bowl_mediterraneen_1795458890551.jpg',
  hotMeal: '/src/assets/images/offer_plat_chaud_pates_1795458891276.jpg',
  patisserie: '/src/assets/images/offer_patisserie_orientale_1795458892399.jpg',
} as const;

export const OFFER_IMAGE_PRESETS: { label: string; category: OfferCategory; url: string }[] = [
  { label: 'Surprise Basket Campus', category: 'Surprise Basket', url: GENERATED_IMAGES.surpriseBasket },
  { label: 'Boulangerie & Viennoiseries', category: 'Boulangerie', url: GENERATED_IMAGES.boulangerie },
  { label: 'Salades & Bowls', category: 'Salades & Bowls', url: GENERATED_IMAGES.saladBowl },
  { label: 'Plats chauds', category: 'Plats chauds', url: GENERATED_IMAGES.hotMeal },
  { label: 'Pâtisserie tunisienne', category: 'Pâtisserie', url: GENERATED_IMAGES.patisserie },
];

export function getCategoryFallbackImage(category?: string, title?: string): string {
  const cat = (category || '').toLowerCase();
  const txt = `${cat} ${(title || '').toLowerCase()}`;

  if (cat === 'boulangerie' || /croissant|pain|baguette|viennoiser|boulanger/.test(txt)) {
    return GENERATED_IMAGES.boulangerie;
  }
  if (cat === 'salades & bowls' || /bowl|salade|poulet|houmous|vegan/.test(txt)) {
    return GENERATED_IMAGES.saladBowl;
  }
  if (cat === 'plats chauds' || /pasta|penne|plat|pizza|couscous|lasagne|repas/.test(txt)) {
    return GENERATED_IMAGES.hotMeal;
  }
  if (cat === 'pâtisserie' || /pâtiss|patiss|baklava|baklawa|makroudh|gâteau|gateau|dessert/.test(txt)) {
    return GENERATED_IMAGES.patisserie;
  }
  return GENERATED_IMAGES.surpriseBasket;
}

interface SeedShopItem {
  id: string;
  name: string;
  category: ShopCategory;
  address: string;
  distanceMeters: number;
  angleDeg: number;
  pickupWindow: string;
}

interface SeedOfferItem {
  id: string;
  shopId: string;
  shopName: string;
  shopCategory: string;
  distanceMeters: number;
  title: string;
  description: string;
  category: OfferCategory;
  isSurpriseBasket: boolean;
  originalPrice: number;
  discountedPrice: number;
  quantityAvailable: number;
  pickupWindow: string;
  imageUrl: string;
}

const SEED_SHOPS: SeedShopItem[] = [
  {
    id: 'shop_buvette_essect',
    name: 'Buvette ESSECT Central',
    category: 'Cafétéria',
    address: '4 Rue Abou Kacem Chabbi, Campus ESSECT, Montfleury',
    distanceMeters: 40,
    angleDeg: 135,
    pickupWindow: '15h30 - 17h30',
  },
  {
    id: 'shop_boulangerie_montfleury',
    name: 'Boulangerie Montfleury',
    category: 'Boulangerie',
    address: '18 Avenue Ali Trad, Montfleury, Tunis',
    distanceMeters: 165,
    angleDeg: 35,
    pickupWindow: '18h00 - 20h00',
  },
  {
    id: 'shop_pasta_bowl_campus',
    name: 'Pasta & Bowl Campus',
    category: 'Restaurant',
    address: '22 Rue de Marseille Prolongée, Montfleury',
    distanceMeters: 280,
    angleDeg: 225,
    pickupWindow: '14h30 - 16h30',
  },
  {
    id: 'shop_patisserie_el_medina',
    name: 'Pâtisserie El Medina',
    category: 'Pâtisserie',
    address: '9 Place El Jazira, Bab El Fella',
    distanceMeters: 410,
    angleDeg: 22,
    pickupWindow: '17h30 - 19h30',
  },
];

const SEED_OFFERS: SeedOfferItem[] = [
  {
    id: 'offer_surprise_essect',
    shopId: 'shop_buvette_essect',
    shopName: 'Buvette ESSECT Central',
    shopCategory: 'Cafétéria',
    distanceMeters: 40,
    title: 'Surprise Basket Étudiant ESSECT',
    description: 'Assortiment mystère du jour : 2 sandwichs panini ou wraps frais, 1 fruit de saison et 1 viennoiserie.',
    category: 'Surprise Basket',
    isSurpriseBasket: true,
    originalPrice: 14.5,
    discountedPrice: 5.0,
    quantityAvailable: 6,
    pickupWindow: '15h30 - 17h30',
    imageUrl: GENERATED_IMAGES.surpriseBasket,
  },
  {
    id: 'offer_boulangerie_montfleury',
    shopId: 'shop_boulangerie_montfleury',
    shopName: 'Boulangerie Montfleury',
    shopCategory: 'Boulangerie',
    distanceMeters: 165,
    title: 'Panier Boulangerie & Viennoiseries',
    description: '3 croissants pur beurre, 2 pains au chocolat et 1 baguette aux graines de sésame sortis du four.',
    category: 'Boulangerie',
    isSurpriseBasket: false,
    originalPrice: 11.0,
    discountedPrice: 4.2,
    quantityAvailable: 9,
    pickupWindow: '18h00 - 20h00',
    imageUrl: GENERATED_IMAGES.boulangerie,
  },
  {
    id: 'offer_bowl_mediterraneen',
    shopId: 'shop_pasta_bowl_campus',
    shopName: 'Pasta & Bowl Campus',
    shopCategory: 'Restaurant',
    distanceMeters: 280,
    title: 'Bowl Méditerranéen Poulet Grillé',
    description: 'Poulet mariné aux herbes, pois chiches rôtis, houmous maison, légumes grillés et boulgour aux épices.',
    category: 'Salades & Bowls',
    isSurpriseBasket: false,
    originalPrice: 16.5,
    discountedPrice: 6.5,
    quantityAvailable: 5,
    pickupWindow: '14h30 - 16h30',
    imageUrl: GENERATED_IMAGES.saladBowl,
  },
  {
    id: 'offer_penne_basilic',
    shopId: 'shop_pasta_bowl_campus',
    shopName: 'Pasta & Bowl Campus',
    shopCategory: 'Restaurant',
    distanceMeters: 280,
    title: 'Penne Sauce Tomate Basilic & Grillades',
    description: 'Portion généreuse de penne al dente, courgettes grillées, sauce tomate fraîche au basilic et parmesan.',
    category: 'Plats chauds',
    isSurpriseBasket: false,
    originalPrice: 14.0,
    discountedPrice: 5.8,
    quantityAvailable: 8,
    pickupWindow: '14h30 - 16h30',
    imageUrl: GENERATED_IMAGES.hotMeal,
  },
  {
    id: 'offer_patisserie_el_medina',
    shopId: 'shop_patisserie_el_medina',
    shopName: 'Pâtisserie El Medina',
    shopCategory: 'Pâtisserie',
    distanceMeters: 410,
    title: 'Coffret Pâtisseries Tunisiennes',
    description: 'Assortiment anti-gaspi du soir : baklawa aux pistaches, makroudh dorés au miel et douceurs aux amandes.',
    category: 'Pâtisserie',
    isSurpriseBasket: false,
    originalPrice: 19.0,
    discountedPrice: 7.5,
    quantityAvailable: 4,
    pickupWindow: '17h30 - 19h30',
    imageUrl: GENERATED_IMAGES.patisserie,
  },
  {
    id: 'offer_gouter_campus',
    shopId: 'shop_boulangerie_montfleury',
    shopName: 'Boulangerie Montfleury',
    shopCategory: 'Boulangerie',
    distanceMeters: 165,
    title: 'Surprise Basket Goûter Montfleury',
    description: 'Panier surprise sucré-salé de fin d’après-midi préparé avec les invendus frais de la journée.',
    category: 'Surprise Basket',
    isSurpriseBasket: true,
    originalPrice: 9.5,
    discountedPrice: 3.8,
    quantityAvailable: 6,
    pickupWindow: '18h00 - 20h00',
    imageUrl: GENERATED_IMAGES.surpriseBasket,
  },
];

export async function seedEssectDemoData(adminUid: string, adminName: string): Promise<void> {
  const ownerDisplay = (adminName || 'Administration ESSECT').slice(0, 80);

  try {
    const shopsBatch = writeBatch(db);
    let shopOps = 0;

    for (const shop of SEED_SHOPS) {
      const ref = doc(db, 'shops', shop.id);
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        shopsBatch.set(ref, {
          id: shop.id,
          ownerId: adminUid,
          ownerName: ownerDisplay,
          name: shop.name,
          category: shop.category,
          address: shop.address,
          distanceMeters: shop.distanceMeters,
          angleDeg: shop.angleDeg,
          pickupWindow: shop.pickupWindow,
          status: 'approved',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        shopOps++;
      }
    }

    if (shopOps > 0) {
      await shopsBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'shops');
  }

  try {
    const offersBatch = writeBatch(db);
    let offerOps = 0;

    for (const offer of SEED_OFFERS) {
      const ref = doc(db, 'offers', offer.id);
      const existingSnap = await getDoc(ref);
      if (!existingSnap.exists()) {
        offersBatch.set(ref, {
          id: offer.id,
          shopId: offer.shopId,
          shopName: offer.shopName,
          shopCategory: offer.shopCategory,
          distanceMeters: offer.distanceMeters,
          merchantId: adminUid,
          title: offer.title,
          description: offer.description,
          category: offer.category,
          isSurpriseBasket: offer.isSurpriseBasket,
          originalPrice: offer.originalPrice,
          discountedPrice: offer.discountedPrice,
          quantityAvailable: offer.quantityAvailable,
          pickupWindow: offer.pickupWindow,
          imageUrl: offer.imageUrl,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        offerOps++;
      }
    }

    if (offerOps > 0) {
      await offersBatch.commit();
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'offers');
  }
}
