export type UserRole = 'student' | 'merchant' | 'admin';

export type ShopCategory = 'Cafétéria' | 'Boulangerie' | 'Restaurant' | 'Pâtisserie';

export type ShopStatus = 'pending' | 'approved' | 'rejected';

export type OfferCategory =
  | 'Surprise Basket'
  | 'Boulangerie'
  | 'Salades & Bowls'
  | 'Plats chauds'
  | 'Pâtisserie';

export type PaymentMethod = 'konnect_wallet' | 'konnect_card' | 'edinar_jeune';

export type OrderStatus = 'paid' | 'picked_up' | 'cancelled';

export type ActiveView = 'portals' | 'offers' | 'radar' | 'orders' | 'impact' | 'merchant' | 'admin';

export interface UserProfile {
  uid: string;
  displayName: string;
  email: string;
  photoUrl?: string;
  role: UserRole;
  campus: string;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Shop {
  id: string;
  ownerId: string;
  ownerName: string;
  name: string;
  category: ShopCategory;
  address: string;
  distanceMeters: number;
  angleDeg: number;
  pickupWindow: string;
  status: ShopStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
}

export interface Offer {
  id: string;
  shopId: string;
  shopName: string;
  shopCategory: string;
  distanceMeters: number;
  merchantId: string;
  title: string;
  description: string;
  category: OfferCategory;
  isSurpriseBasket: boolean;
  originalPrice: number;
  discountedPrice: number;
  quantityAvailable: number;
  pickupWindow: string;
  imageUrl: string;
  active: boolean;
  createdAt?: unknown;
  updatedAt?: unknown;
  _stockField?: string | null;
}

export interface Order {
  id: string;
  offerId: string;
  offerTitle: string;
  shopId: string;
  shopName: string;
  merchantId: string;
  studentId: string;
  studentName: string;
  studentEmail: string;
  quantity: number;
  unitOriginalPrice: number;
  unitPaidPrice: number;
  totalOriginalTnd: number;
  totalPaidTnd: number;
  ecoPointsEarned: number;
  pickupWindow: string;
  paymentMethod: PaymentMethod;
  paymentRef: string;
  qrCodeValue: string;
  status: OrderStatus;
  createdAt?: unknown;
  updatedAt?: unknown;
  pickedUpAt?: unknown;
}
