import type { Offer } from '../types/campussave';

const STOCK_FIELD_CANDIDATES = [
  'quantityAvailable',
  'quantity_available',
  'availableQuantity',
  'available_quantity',
  'quantity',
  'quantite',
  'qty',
  'stock',
  'available',
  'remaining',
  'remainingQuantity',
  'remaining_quantity',
  'dispo',
  'nbDispo',
  'nb_dispo',
  'disponible',
  'portions',
  'count',
] as const;

function pickString(record: Record<string, unknown>, keys: readonly string[]): string | null {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === 'string') {
      const trimmed = val.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return null;
}

function pickNumber(record: Record<string, unknown>, keys: readonly string[]): number | null {
  for (const key of keys) {
    const val = record[key];
    if (typeof val === 'number' && Number.isFinite(val)) {
      return val;
    }
    if (typeof val === 'string') {
      const normalized = val.trim().replace(',', '.');
      const match = normalized.match(/-?\d+(?:\.\d+)?/);
      if (match) {
        const parsed = Number(match[0]);
        if (Number.isFinite(parsed)) return parsed;
      }
    }
  }
  return null;
}

function extractStockInfo(
  record: Record<string, unknown>,
  isActive: boolean
): { quantityAvailable: number; stockField: string | null } {
  for (const key of STOCK_FIELD_CANDIDATES) {
    const val = record[key];
    if (val === undefined || val === null || val === '') continue;

    if (typeof val === 'number' && Number.isFinite(val)) {
      return {
        quantityAvailable: Math.max(0, Math.floor(val)),
        stockField: key,
      };
    }

    if (typeof val === 'string') {
      const match = val.trim().match(/\d+/);
      if (match) {
        const parsed = Number.parseInt(match[0], 10);
        if (Number.isFinite(parsed)) {
          return {
            quantityAvailable: Math.max(0, parsed),
            stockField: key,
          };
        }
      }
    }
  }

  return {
    quantityAvailable: isActive ? 1 : 0,
    stockField: null,
  };
}

export function normalizeOffer(raw: Record<string, unknown>, docId: string): Offer {
  const isActive =
    raw.active !== false &&
    raw.isActive !== false &&
    raw.status !== 'inactive' &&
    raw.status !== 'archived' &&
    raw.status !== 'sold_out';

  const shopId =
    pickString(raw, [
      'shopId',
      'shop_id',
      'storeId',
      'store_id',
      'commerceId',
      'commerce_id',
      'restaurantId',
      'restaurant_id',
      'vendorId',
      'vendor_id',
    ]) || '';

  const shopName =
    pickString(raw, [
      'shopName',
      'shop_name',
      'merchantName',
      'merchant_name',
      'restaurantName',
      'restaurant_name',
      'storeName',
      'store_name',
      'commerceName',
      'commerce',
      'vendorName',
      'vendor_name',
      'businessName',
    ]) || '';

  const category =
    pickString(raw, [
      'category',
      'categorie',
      'type',
      'offerCategory',
      'offer_category',
      'shopCategory',
      'shop_category',
    ]) || '';

  const shopCategory =
    pickString(raw, ['shopCategory', 'shop_category', 'category', 'categorie', 'type']) ||
    category;

  const title =
    pickString(raw, ['title', 'titre', 'name', 'nom', 'offerTitle', 'offer_title']) || '';

  const description =
    pickString(raw, ['description', 'desc', 'details', 'subtitle', 'summary']) || '';

  const merchantId =
    pickString(raw, [
      'merchantId',
      'merchant_id',
      'ownerId',
      'owner_id',
      'vendorId',
      'vendor_id',
      'uid',
      'userId',
      'user_id',
      'createdBy',
    ]) || shopId;

  const discountedPriceRaw = pickNumber(raw, [
    'discountedPrice',
    'discounted_price',
    'discountPrice',
    'discount_price',
    'promoPrice',
    'promo_price',
    'studentPrice',
    'student_price',
    'salePrice',
    'sale_price',
    'newPrice',
    'new_price',
    'price',
    'prix',
    'prixReduit',
    'prix_reduit',
  ]);
  const discountedPrice =
    discountedPriceRaw !== null && discountedPriceRaw > 0 ? discountedPriceRaw : 0;

  const originalPriceRaw = pickNumber(raw, [
    'originalPrice',
    'original_price',
    'oldPrice',
    'old_price',
    'regularPrice',
    'regular_price',
    'basePrice',
    'base_price',
    'prixInitial',
    'prix_initial',
    'initialPrice',
    'initial_price',
    'marketPrice',
  ]);
  const originalPrice =
    originalPriceRaw !== null && originalPriceRaw > 0 ? originalPriceRaw : discountedPrice;

  const pickupWindow =
    pickString(raw, [
      'pickupWindow',
      'pickup_window',
      'pickup',
      'pickupTime',
      'pickup_time',
      'pickupDate',
      'pickup_date',
      'pickupUntil',
      'pickup_until',
      'retrait',
      'horaire',
      'validUntil',
      'valid_until',
    ]) || '';

  const imageUrl =
    pickString(raw, [
      'imageUrl',
      'imageURL',
      'photoUrl',
      'photoURL',
      'image',
      'photo',
      'image_url',
      'photo_url',
      'imgUrl',
      'img',
      'picture',
      'thumbnail',
      'url',
    ]) || '';

  const distanceRaw = pickNumber(raw, ['distanceMeters', 'distance_meters', 'distance']);
  const distanceMeters = distanceRaw !== null && distanceRaw >= 0 ? distanceRaw : 0;

  const { quantityAvailable, stockField } = extractStockInfo(raw, isActive);

  return {
    id: docId,
    shopId,
    shopName,
    shopCategory,
    distanceMeters,
    merchantId,
    title,
    description,
    category: category as Offer['category'],
    isSurpriseBasket: Boolean(
      raw.isSurpriseBasket ?? /surprise/i.test(`${category} ${title}`)
    ),
    originalPrice,
    discountedPrice,
    quantityAvailable,
    pickupWindow,
    imageUrl,
    active: isActive,
    createdAt: raw.createdAt,
    updatedAt: raw.updatedAt,
    _stockField: stockField,
  };
}
