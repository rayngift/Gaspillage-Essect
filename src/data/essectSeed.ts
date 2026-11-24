import { doc, getDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { OfferCategory, ShopCategory } from '../types/campussave';

export const GENERATED_IMAGES = {
  hero: '/src/assets/images/essect_campus_hero.jpg',
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

export const DEMO_SHOP_IDS = new Set([
  'shop_buvette_essect',
  'shop_boulangerie_montfleury',
  'shop_pasta_bowl_campus',
  'shop_patisserie_el_medina',
]);

export const DEMO_OFFER_IDS = new Set([
  'offer_surprise_essect',
  'offer_boulangerie_montfleury',
  'offer_bowl_mediterraneen',
  'offer_penne_basilic',
  'offer_patisserie_el_medina',
  'offer_gouter_campus',
]);

const DEMO_OFFER_TITLES = new Set([
  'Surprise Basket Étudiant ESSECT',
  'Panier Boulangerie & Viennoiseries',
  'Bowl Méditerranéen Poulet Grillé',
  'Penne Sauce Tomate Basilic & Grillades',
  'Coffret Pâtisseries Tunisiennes',
  'Surprise Basket Goûter Montfleury',
]);

export function isDemoShop(shop: { id: string }): boolean {
  return DEMO_SHOP_IDS.has(shop.id);
}

export function isDemoOffer(offer: { id: string; title?: string }): boolean {
  return DEMO_OFFER_IDS.has(offer.id) || Boolean(offer.title && DEMO_OFFER_TITLES.has(offer.title));
}

export async function removeEssectDemoData(): Promise<number> {
  let deleted = 0;
  try {
    const batch = writeBatch(db);
    for (const offerId of DEMO_OFFER_IDS) {
      const ref = doc(db, 'offers', offerId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        batch.delete(ref);
        deleted++;
      }
    }
    for (const shopId of DEMO_SHOP_IDS) {
      const ref = doc(db, 'shops', shopId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        batch.delete(ref);
        deleted++;
      }
    }
    if (deleted > 0) {
      await batch.commit();
    }
    return deleted;
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, 'offers');
  }
}
