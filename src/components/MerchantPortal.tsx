import { useState } from 'react';
import { CheckCircle2, Edit3, Plus, QrCode, Store, Trash2 } from 'lucide-react';
import type { User } from 'firebase/auth';
import { deleteDoc, doc, serverTimestamp, setDoc, updateDoc } from 'firebase/firestore';
import { OFFER_IMAGE_PRESETS } from '../data/essectSeed';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Offer, OfferCategory, Order, Shop, ShopCategory } from '../types/campussave';

interface MerchantPortalProps {
  user: User;
  isAdmin: boolean;
  myShops: Shop[];
  myOffers: Offer[];
  merchantOrders: Order[];
}

export function MerchantPortal({
  user,
  isAdmin,
  myShops,
  myOffers,
  merchantOrders,
}: MerchantPortalProps) {
  const approvedShops = myShops.filter((s) => s.status === 'approved');
  const pendingShops = myShops.filter((s) => s.status === 'pending');

  // Shop registration state
  const [shopName, setShopName] = useState('');
  const [shopCategory, setShopCategory] = useState<ShopCategory>('Cafétéria');
  const [shopAddress, setShopAddress] = useState('');
  const [shopDistance, setShopDistance] = useState('150');
  const [shopPickupWindow, setShopPickupWindow] = useState('17h00 - 19h00');
  const [shopSubmitting, setShopSubmitting] = useState(false);
  const [shopMessage, setShopMessage] = useState<string | null>(null);

  // Offer form state
  const [editingOfferId, setEditingOfferId] = useState<string | null>(null);
  const [selectedShopId, setSelectedShopId] = useState<string>(approvedShops[0]?.id || '');
  const [offerTitle, setOfferTitle] = useState('');
  const [offerDesc, setOfferDesc] = useState('');
  const [offerCategory, setOfferCategory] = useState<OfferCategory>('Surprise Basket');
  const [originalPrice, setOriginalPrice] = useState('14.00');
  const [discountedPrice, setDiscountedPrice] = useState('5.00');
  const [quantityAvailable, setQuantityAvailable] = useState('5');
  const [pickupWindow, setPickupWindow] = useState('16h00 - 18h00');
  const [imageUrl, setImageUrl] = useState<string>(OFFER_IMAGE_PRESETS[0].url);
  const [offerSubmitting, setOfferSubmitting] = useState(false);
  const [offerError, setOfferError] = useState<string | null>(null);
  const [offerSuccess, setOfferSuccess] = useState<string | null>(null);

  // QR Validation state
  const [qrInput, setQrInput] = useState('');
  const [qrFeedback, setQrFeedback] = useState<string | null>(null);
  const [qrValidating, setQrValidating] = useState(false);

  const effectiveShopId =
    selectedShopId && approvedShops.some((s) => s.id === selectedShopId)
      ? selectedShopId
      : approvedShops[0]?.id || '';

  const paidOrders = merchantOrders.filter((o) => o.status === 'paid');
  const pickedUpOrders = merchantOrders.filter((o) => o.status === 'picked_up');
  const totalRevenueTnd = merchantOrders
    .filter((o) => o.status !== 'cancelled')
    .reduce((acc, o) => acc + o.totalPaidTnd, 0);

  const handleRegisterShop = async (e: React.FormEvent) => {
    e.preventDefault();
    setShopMessage(null);
    if (shopName.trim().length < 2 || shopAddress.trim().length < 4) {
      setShopMessage('Veuillez renseigner un nom et une adresse valides.');
      return;
    }

    const dist = Math.min(2000, Math.max(10, Number(shopDistance) || 150));
    const shopId = `shop_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    setShopSubmitting(true);
    try {
      await setDoc(doc(db, 'shops', shopId), {
        id: shopId,
        ownerId: user.uid,
        ownerName: (user.displayName || user.email?.split('@')[0] || 'Commerçant').slice(0, 80),
        name: shopName.trim().slice(0, 80),
        category: shopCategory,
        address: shopAddress.trim().slice(0, 160),
        distanceMeters: dist,
        angleDeg: Math.floor(Math.random() * 340) + 10,
        pickupWindow: shopPickupWindow.trim().slice(0, 40),
        status: isAdmin ? 'approved' : 'pending',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
      setShopName('');
      setShopAddress('');
      setShopMessage(
        isAdmin
          ? 'Commerce enregistré et approuvé immédiatement.'
          : 'Demande envoyée ! Votre commerce est en attente de validation par l’administrateur.'
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, `shops/${shopId}`);
    } finally {
      setShopSubmitting(false);
    }
  };

  const handleSaveOffer = async (e: React.FormEvent) => {
    e.preventDefault();
    setOfferError(null);
    setOfferSuccess(null);

    const shop = approvedShops.find((s) => s.id === effectiveShopId);
    if (!shop) {
      setOfferError('Sélectionnez un commerce validé avant de publier une offre.');
      return;
    }

    const orig = Number(originalPrice);
    const disc = Number(discountedPrice);
    const qty = Math.round(Number(quantityAvailable));

    if (!offerTitle.trim() || offerTitle.trim().length < 3) {
      setOfferError('Le titre doit contenir au moins 3 caractères.');
      return;
    }
    if (!offerDesc.trim() || offerDesc.trim().length < 5) {
      setOfferError('La description doit contenir au moins 5 caractères.');
      return;
    }
    if (!Number.isFinite(orig) || !Number.isFinite(disc) || disc <= 0 || disc >= orig) {
      setOfferError('Le prix réduit doit être strictement inférieur au prix initial.');
      return;
    }
    if (!Number.isInteger(qty) || qty < 0 || qty > 200) {
      setOfferError('La quantité doit être comprise entre 0 et 200.');
      return;
    }

    setOfferSubmitting(true);
    try {
      if (editingOfferId) {
        await updateDoc(doc(db, 'offers', editingOfferId), {
          title: offerTitle.trim().slice(0, 90),
          description: offerDesc.trim().slice(0, 260),
          category: offerCategory,
          isSurpriseBasket: offerCategory === 'Surprise Basket',
          originalPrice: Number(orig.toFixed(2)),
          discountedPrice: Number(disc.toFixed(2)),
          quantityAvailable: qty,
          pickupWindow: pickupWindow.trim().slice(0, 40),
          imageUrl,
          active: qty > 0,
          updatedAt: serverTimestamp(),
        });
        setOfferSuccess('Offre mise à jour avec succès.');
      } else {
        const offerId = `off_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
        await setDoc(doc(db, 'offers', offerId), {
          id: offerId,
          shopId: shop.id,
          shopName: shop.name,
          shopCategory: shop.category,
          distanceMeters: shop.distanceMeters,
          merchantId: shop.ownerId,
          title: offerTitle.trim().slice(0, 90),
          description: offerDesc.trim().slice(0, 260),
          category: offerCategory,
          isSurpriseBasket: offerCategory === 'Surprise Basket',
          originalPrice: Number(orig.toFixed(2)),
          discountedPrice: Number(disc.toFixed(2)),
          quantityAvailable: qty,
          pickupWindow: pickupWindow.trim().slice(0, 40),
          imageUrl,
          active: true,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });
        setOfferSuccess('Nouvelle offre publiée et visible sur CampusSave.');
      }

      setEditingOfferId(null);
      setOfferTitle('');
      setOfferDesc('');
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'offers');
    } finally {
      setOfferSubmitting(false);
    }
  };

  const handleEditOffer = (offer: Offer) => {
    setEditingOfferId(offer.id);
    setSelectedShopId(offer.shopId);
    setOfferTitle(offer.title);
    setOfferDesc(offer.description);
    setOfferCategory(offer.category);
    setOriginalPrice(String(offer.originalPrice));
    setDiscountedPrice(String(offer.discountedPrice));
    setQuantityAvailable(String(offer.quantityAvailable));
    setPickupWindow(offer.pickupWindow);
    setImageUrl(offer.imageUrl);
    setOfferSuccess(null);
    setOfferError(null);
  };

  const handleDeleteOffer = async (offerId: string) => {
    try {
      await deleteDoc(doc(db, 'offers', offerId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `offers/${offerId}`);
    }
  };

  const handleValidateQr = async (codeToValidate?: string) => {
    const code = (codeToValidate || qrInput).trim().toUpperCase();
    setQrFeedback(null);
    if (!code) {
      setQrFeedback('Saisissez ou sélectionnez un code QR de commande.');
      return;
    }

    const targetOrder = paidOrders.find((o) => o.qrCodeValue.toUpperCase() === code);
    if (!targetOrder) {
      setQrFeedback(`Aucune commande payée en attente trouvée pour le code ${code}.`);
      return;
    }

    setQrValidating(true);
    try {
      const apiCheck = await fetch('/api/qr/verify-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ qrCodeValue: targetOrder.qrCodeValue }),
      });
      if (!apiCheck.ok) {
        throw new Error('Format QR Code non reconnu par la passerelle.');
      }

      await updateDoc(doc(db, 'orders', targetOrder.id), {
        status: 'picked_up',
        pickedUpAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setQrInput('');
      setQrFeedback(
        `Retrait validé pour ${targetOrder.studentName} (+${targetOrder.ecoPointsEarned} EcoPoints attribués).`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${targetOrder.id}`);
    } finally {
      setQrValidating(false);
    }
  };

  return (
    <section className="space-y-8">
      <div>
        <p className="text-xs font-medium text-[#166534] mb-1">
          Espace Commerçant · Gestion des paniers et retraits QR
        </p>
        <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
          Tableau de bord commerçant
        </h2>
      </div>

      {/* Merchant KPI strip */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Commerces validés</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
            {approvedShops.length}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Offres publiées</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
            {myOffers.length}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Retraits en attente</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#166534] mt-1">
            {paidOrders.length}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Revenus sauvés</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
            {totalRevenueTnd.toFixed(2)} TND
          </p>
        </div>
      </div>

      {pendingShops.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-5 text-sm text-amber-900">
          <strong>Commerce en cours de validation :</strong>{' '}
          {pendingShops.map((s) => s.name).join(', ')}. Un administrateur CampusSave vérifiera votre établissement avant la mise en ligne.
        </div>
      )}

      {/* QR Validation + Offer Creation */}
      {approvedShops.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Offer Form */}
          <form
            onSubmit={handleSaveOffer}
            className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4"
          >
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-lg font-bold text-neutral-900">
                {editingOfferId ? 'Modifier une offre' : 'Publier une nouvelle offre'}
              </h3>
              {editingOfferId && (
                <button
                  type="button"
                  onClick={() => {
                    setEditingOfferId(null);
                    setOfferTitle('');
                    setOfferDesc('');
                  }}
                  className="text-xs font-medium text-neutral-600 hover:text-neutral-900 cursor-pointer"
                >
                  Annuler l’édition
                </button>
              )}
            </div>

            {offerError && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
                {offerError}
              </div>
            )}
            {offerSuccess && (
              <div className="p-3 rounded-lg bg-[#166534]/10 border border-[#166534]/20 text-xs text-[#166534]">
                {offerSuccess}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Commerce
                </label>
                <select
                  value={effectiveShopId}
                  onChange={(e) => setSelectedShopId(e.target.value)}
                  disabled={Boolean(editingOfferId)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                >
                  {approvedShops.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Catégorie
                </label>
                <select
                  value={offerCategory}
                  onChange={(e) => {
                    const cat = e.target.value as OfferCategory;
                    setOfferCategory(cat);
                    const match = OFFER_IMAGE_PRESETS.find((p) => p.category === cat);
                    if (match) setImageUrl(match.url);
                  }}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                >
                  <option value="Surprise Basket">Surprise Basket</option>
                  <option value="Boulangerie">Boulangerie</option>
                  <option value="Salades & Bowls">Salades & Bowls</option>
                  <option value="Plats chauds">Plats chauds</option>
                  <option value="Pâtisserie">Pâtisserie</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Titre de l’offre
              </label>
              <input
                type="text"
                required
                maxLength={90}
                value={offerTitle}
                onChange={(e) => setOfferTitle(e.target.value)}
                placeholder="Ex : Panier Sandwichs & Jus Fin de Service"
                className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                rows={2}
                required
                maxLength={260}
                value={offerDesc}
                onChange={(e) => setOfferDesc(e.target.value)}
                placeholder="Détaillez le contenu du panier ou des invendus du jour..."
                className="w-full p-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Prix initial (TND)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="1"
                  max="500"
                  required
                  value={originalPrice}
                  onChange={(e) => setOriginalPrice(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Prix réduit (TND)
                </label>
                <input
                  type="number"
                  step="0.10"
                  min="0.5"
                  max="500"
                  required
                  value={discountedPrice}
                  onChange={(e) => setDiscountedPrice(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Quantité
                </label>
                <input
                  type="number"
                  min="0"
                  max="200"
                  required
                  value={quantityAvailable}
                  onChange={(e) => setQuantityAvailable(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-700 mb-1">
                  Horaires retrait
                </label>
                <input
                  type="text"
                  required
                  maxLength={40}
                  value={pickupWindow}
                  onChange={(e) => setPickupWindow(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 mb-1">
                Visuel du panier
              </label>
              <select
                value={imageUrl}
                onChange={(e) => setImageUrl(e.target.value)}
                className="w-full h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
              >
                {OFFER_IMAGE_PRESETS.map((preset) => (
                  <option key={preset.url} value={preset.url}>
                    {preset.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              disabled={offerSubmitting}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>
                {offerSubmitting
                  ? 'Enregistrement...'
                  : editingOfferId
                    ? 'Enregistrer les modifications'
                    : 'Publier l’offre'}
              </span>
            </button>
          </form>

          {/* QR Pickup Validation Panel */}
          <div className="lg:col-span-5 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
            <div className="flex items-center gap-2">
              <QrCode className="w-5 h-5 text-[#166534]" />
              <h3 className="text-lg font-bold text-neutral-900">
                Validation QR Code retrait
              </h3>
            </div>
            <p className="text-xs text-neutral-600 leading-relaxed">
              Saisissez le code QR présenté par l’étudiant ou validez directement une réservation payée ci-dessous pour créditer ses EcoPoints.
            </p>

            <div className="flex gap-2">
              <input
                type="text"
                value={qrInput}
                onChange={(e) => setQrInput(e.target.value)}
                placeholder="CS-ESSECT-..."
                className="flex-1 h-10 px-3 rounded-lg border border-neutral-200 text-xs font-mono uppercase focus:outline-none focus:ring-2 focus:ring-[#166534]"
              />
              <button
                type="button"
                disabled={qrValidating}
                onClick={() => handleValidateQr()}
                className="px-4 py-2 bg-[#166534] text-white text-xs font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 cursor-pointer whitespace-nowrap"
              >
                Valider
              </button>
            </div>

            {qrFeedback && (
              <div className="p-3 rounded-lg bg-neutral-50 border border-neutral-200 text-xs text-neutral-800">
                {qrFeedback}
              </div>
            )}

            <div className="pt-2 space-y-2.5">
              <p className="text-xs font-semibold text-neutral-700">
                Commandes en attente ({paidOrders.length}) · Validées ({pickedUpOrders.length})
              </p>

              {paidOrders.length === 0 ? (
                <p className="text-xs text-neutral-500 py-4 text-center border border-dashed border-neutral-200 rounded-xl">
                  Aucune commande en attente de retrait.
                </p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {paidOrders.map((ord) => (
                    <div
                      key={ord.id}
                      className="p-3 rounded-xl border border-neutral-200 flex items-center justify-between gap-3"
                    >
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-neutral-900 truncate">
                          {ord.studentName} · {ord.quantity}x {ord.offerTitle}
                        </p>
                        <p className="text-[11px] font-mono text-neutral-500">
                          {ord.qrCodeValue} · {ord.totalPaidTnd.toFixed(2)} TND
                        </p>
                      </div>
                      <button
                        type="button"
                        disabled={qrValidating}
                        onClick={() => handleValidateQr(ord.qrCodeValue)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-medium text-white bg-[#166534] rounded-lg hover:bg-[#14532d] shrink-0 cursor-pointer"
                      >
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>Valider</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Existing Offers Table */}
      {myOffers.length > 0 && (
        <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
          <div className="px-6 py-4 border-b border-neutral-200">
            <h3 className="text-base font-bold text-neutral-900">
              Vos offres publiées ({myOffers.length})
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-500">
                <tr>
                  <th className="py-3 px-4 font-medium">Offre</th>
                  <th className="py-3 px-4 font-medium">Commerce</th>
                  <th className="py-3 px-4 font-medium text-right">Prix réduit</th>
                  <th className="py-3 px-4 font-medium text-right">Stock</th>
                  <th className="py-3 px-4 font-medium">Créneau</th>
                  <th className="py-3 px-4 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {myOffers.map((offer) => (
                  <tr key={offer.id} className="hover:bg-neutral-50/70">
                    <td className="py-3 px-4 font-medium text-neutral-900">{offer.title}</td>
                    <td className="py-3 px-4 text-neutral-600">{offer.shopName}</td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold text-[#166534]">
                      {offer.discountedPrice.toFixed(2)} TND
                    </td>
                    <td className="py-3 px-4 text-right font-mono tabular-nums">
                      {offer.quantityAvailable}
                    </td>
                    <td className="py-3 px-4 font-mono text-xs text-neutral-600">
                      {offer.pickupWindow}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => handleEditOffer(offer)}
                          title="Modifier"
                          className="p-1.5 text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-md cursor-pointer"
                        >
                          <Edit3 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteOffer(offer.id)}
                          title="Supprimer"
                          className="p-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 rounded-md cursor-pointer"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Shop Registration Card */}
      <form
        onSubmit={handleRegisterShop}
        className="bg-white border border-neutral-200 rounded-2xl p-6 space-y-4"
      >
        <div className="flex items-center gap-2">
          <Store className="w-5 h-5 text-[#166534]" />
          <h3 className="text-lg font-bold text-neutral-900">
            Inscrire un établissement partenaire autour de l’ESSECT
          </h3>
        </div>
        <p className="text-xs text-neutral-600">
          Cafétéria, boulangerie, restaurant ou pâtisserie : votre demande est soumise à la validation de l’administrateur avant publication.
        </p>

        {shopMessage && (
          <div className="p-3 rounded-lg bg-[#166534]/10 border border-[#166534]/20 text-xs text-[#166534]">
            {shopMessage}
          </div>
        )}

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          <input
            type="text"
            required
            maxLength={80}
            value={shopName}
            onChange={(e) => setShopName(e.target.value)}
            placeholder="Nom du commerce"
            className="h-10 px-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
          <select
            value={shopCategory}
            onChange={(e) => setShopCategory(e.target.value as ShopCategory)}
            className="h-10 px-3 rounded-lg border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
          >
            <option value="Cafétéria">Cafétéria</option>
            <option value="Boulangerie">Boulangerie</option>
            <option value="Restaurant">Restaurant</option>
            <option value="Pâtisserie">Pâtisserie</option>
          </select>
          <input
            type="text"
            required
            maxLength={160}
            value={shopAddress}
            onChange={(e) => setShopAddress(e.target.value)}
            placeholder="Adresse (Montfleury / Tunis)"
            className="h-10 px-3 rounded-lg border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
          <input
            type="number"
            min="10"
            max="2000"
            required
            value={shopDistance}
            onChange={(e) => setShopDistance(e.target.value)}
            placeholder="Distance ESSECT (m)"
            className="h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono tabular-nums focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
          <input
            type="text"
            required
            maxLength={40}
            value={shopPickupWindow}
            onChange={(e) => setShopPickupWindow(e.target.value)}
            placeholder="Créneau (ex: 17h00 - 19h00)"
            className="h-10 px-3 rounded-lg border border-neutral-200 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-[#166534]"
          />
        </div>

        <button
          type="submit"
          disabled={shopSubmitting}
          className="px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer"
        >
          {shopSubmitting ? 'Envoi...' : 'Soumettre l’établissement'}
        </button>
      </form>
    </section>
  );
}
