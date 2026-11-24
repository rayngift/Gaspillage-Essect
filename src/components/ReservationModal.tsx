import { useState } from 'react';
import { CheckCircle2, CreditCard, Minus, Plus, QrCode, ShieldCheck, Wallet, X } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, serverTimestamp, setDoc, writeBatch } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Offer, Order, PaymentMethod } from '../types/campussave';

interface ReservationModalProps {
  offer: Offer;
  user: User;
  canOpenOrders?: boolean;
  onClose: () => void;
  onSuccessGoOrders: () => void;
}

export function ReservationModal({
  offer,
  user,
  canOpenOrders = false,
  onClose,
  onSuccessGoOrders,
}: ReservationModalProps) {
  const unitDiscounted = Math.max(0.01, Number(offer.discountedPrice) || 0);
  const unitOriginal =
    Number(offer.originalPrice) > unitDiscounted
      ? Number(offer.originalPrice)
      : unitDiscounted;
  const maxQty = Math.min(5, Math.max(1, Number(offer.quantityAvailable) || 1));
  const [quantity, setQuantity] = useState<number>(1);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('konnect_wallet');
  const [step, setStep] = useState<'summary' | 'konnect' | 'confirmed'>('summary');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [paymentRef, setPaymentRef] = useState<string>('');
  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const totalPaid = Number((unitDiscounted * quantity).toFixed(2));
  const totalOriginal = Number((unitOriginal * quantity).toFixed(2));
  const savings = Number(Math.max(0, totalOriginal - totalPaid).toFixed(2));
  const ecoPoints = Math.round(quantity * 25);

  const handleInitKonnect = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const safeTitle = (offer.title || 'Offre CampusSave').slice(0, 120);
      const res = await fetch('/api/konnect/init-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          offerId: offer.id,
          offerTitle: safeTitle,
          amountTnd: totalPaid,
          paymentMethod,
        }),
      });
      const data = (await res.json()) as { paymentRef?: string; error?: string };
      if (!res.ok || !data.paymentRef) {
        throw new Error(data.error || 'Impossible d’initialiser le paiement Konnect.');
      }
      setPaymentRef(data.paymentRef);
      setStep('konnect');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Erreur de connexion Konnect.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmPayment = async () => {
    setErrorMsg(null);
    setSubmitting(true);
    try {
      const verifyRes = await fetch('/api/konnect/verify-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentRef }),
      });
      const verifyData = (await verifyRes.json()) as { verified?: boolean; error?: string };
      if (!verifyRes.ok || !verifyData.verified) {
        throw new Error(verifyData.error || 'Validation Konnect refusée.');
      }

      const orderId = `ord_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
      const qrCodeValue = `CS-ESSECT-${orderId.slice(4, 14).toUpperCase()}`;

      const rawShopName = (offer.shopName || 'Commerce ESSECT').trim();
      const safeShopName = (rawShopName.length >= 2 ? rawShopName : 'Commerce ESSECT').slice(0, 80);
      const rawShopId = (offer.shopId || safeShopName).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeShopId = (rawShopId.length >= 1 ? rawShopId : 'shop_essect').slice(0, 128);
      const rawMerchantId = (offer.merchantId || safeShopId || user.uid).replace(/[^a-zA-Z0-9_-]/g, '_');
      const safeMerchantId = (rawMerchantId.length >= 1 ? rawMerchantId : user.uid).slice(0, 128);
      const rawPickup = (offer.pickupWindow || '').trim();
      const safePickup = (rawPickup.length >= 3 ? rawPickup : 'Aujourd’hui').slice(0, 40);
      const rawTitle = (offer.title || '').trim();
      const safeOfferTitle = (rawTitle.length >= 2 ? rawTitle : 'Offre CampusSave').slice(0, 90);

      const orderPayload: Omit<Order, 'createdAt' | 'updatedAt'> = {
        id: orderId,
        offerId: offer.id,
        offerTitle: safeOfferTitle,
        shopId: safeShopId,
        shopName: safeShopName,
        merchantId: safeMerchantId,
        studentId: user.uid,
        studentName: (user.displayName || user.email?.split('@')[0] || 'Étudiant ESSECT').slice(0, 80),
        studentEmail: (user.email || 'etudiant@essect.tn').slice(0, 120),
        quantity: Math.round(quantity),
        unitOriginalPrice: Number(unitOriginal.toFixed(2)),
        unitPaidPrice: Number(unitDiscounted.toFixed(2)),
        totalOriginalTnd: totalOriginal,
        totalPaidTnd: totalPaid,
        ecoPointsEarned: ecoPoints,
        pickupWindow: safePickup,
        paymentMethod,
        paymentRef,
        qrCodeValue,
        status: 'paid',
      };

      const stockField = offer._stockField;
      const nextStock = Math.max(0, Math.round((Number(offer.quantityAvailable) || 0) - quantity));
      const orderRef = doc(db, 'orders', orderId);

      try {
        if (stockField) {
          const batch = writeBatch(db);
          const offerRef = doc(db, 'offers', offer.id);
          batch.update(offerRef, {
            [stockField]: nextStock,
            updatedAt: serverTimestamp(),
          });
          batch.set(orderRef, {
            ...orderPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
          await batch.commit();
        } else {
          await setDoc(orderRef, {
            ...orderPayload,
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          });
        }
      } catch (fsErr) {
        const msg = fsErr instanceof Error ? fsErr.message : String(fsErr);
        if (stockField && /permission|insufficient/i.test(msg)) {
          try {
            await setDoc(orderRef, {
              ...orderPayload,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (fallbackErr) {
            handleFirestoreError(fallbackErr, OperationType.WRITE, `orders/${orderId}`);
          }
        } else {
          handleFirestoreError(fsErr, OperationType.WRITE, `orders/${orderId}`);
        }
      }

      setCreatedOrder(orderPayload);
      setStep('confirmed');
    } catch (err) {
      let friendly = 'Erreur lors de la confirmation.';
      if (err instanceof Error) {
        try {
          const parsed = JSON.parse(err.message) as { error?: string };
          friendly = parsed.error || err.message;
        } catch {
          friendly = err.message;
        }
      }
      setErrorMsg(friendly);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="reservation-modal-title"
    >
      <div className="bg-white border border-neutral-200 rounded-2xl w-full max-w-lg overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between gap-4">
          <div>
            <p className="text-xs text-[#166534] font-medium">
              {step === 'summary' && 'Réservation de panier'}
              {step === 'konnect' && 'Paiement électronique Konnect (Mode Test)'}
              {step === 'confirmed' && 'Commande confirmée'}
            </p>
            <h2 id="reservation-modal-title" className="text-lg font-bold text-neutral-900 truncate">
              {offer.title}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fermer"
            className="p-2 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700">
              {errorMsg}
            </div>
          )}

          {step === 'summary' && (
            <>
              <div className="flex items-center justify-between gap-4 pb-4 border-b border-neutral-100">
                <div className="space-y-0.5">
                  <p className="text-sm font-semibold text-neutral-900">{offer.shopName}</p>
                  <p className="text-xs text-neutral-500 font-mono tabular-nums">
                    Retrait {offer.pickupWindow} · {offer.quantityAvailable} restant(s)
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-base font-bold font-mono tabular-nums text-[#166534]">
                    {unitDiscounted.toFixed(2)} TND
                  </p>
                  {unitOriginal > unitDiscounted && (
                    <p className="text-xs font-mono tabular-nums text-neutral-400 line-through">
                      {unitOriginal.toFixed(2)} TND
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-neutral-800">Quantité souhaitée</span>
                <div className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={quantity <= 1}
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    aria-label="Diminuer la quantité"
                    className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Minus className="w-4 h-4" />
                  </button>
                  <span className="w-6 text-center font-mono tabular-nums font-bold text-neutral-900">
                    {quantity}
                  </span>
                  <button
                    type="button"
                    disabled={quantity >= maxQty}
                    onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                    aria-label="Augmenter la quantité"
                    className="w-9 h-9 rounded-lg border border-neutral-200 flex items-center justify-center text-neutral-700 hover:bg-neutral-100 disabled:opacity-40 cursor-pointer"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs font-medium text-neutral-600">
                  Moyen de paiement Konnect
                </p>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'konnect_wallet' as PaymentMethod, label: 'Konnect Wallet', icon: Wallet },
                    { id: 'konnect_card' as PaymentMethod, label: 'Carte CIB', icon: CreditCard },
                    { id: 'edinar_jeune' as PaymentMethod, label: 'e-Dinar Jeune', icon: ShieldCheck },
                  ].map((item) => {
                    const Icon = item.icon;
                    const active = paymentMethod === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        onClick={() => setPaymentMethod(item.id)}
                        className={`p-3 rounded-xl border text-left transition-colors cursor-pointer ${
                          active
                            ? 'border-[#166534] bg-[#166534]/5 text-[#166534]'
                            : 'border-neutral-200 text-neutral-700 hover:bg-neutral-50'
                        }`}
                      >
                        <Icon className="w-4 h-4 mb-1.5" />
                        <span className="block text-xs font-medium leading-tight">
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-4 space-y-2 text-sm">
                <div className="flex justify-between text-neutral-600">
                  <span>Économie réalisée</span>
                  <span className="font-mono tabular-nums font-medium text-[#166534]">
                    -{savings.toFixed(2)} TND
                  </span>
                </div>
                <div className="flex justify-between text-neutral-600">
                  <span>Récompense au retrait</span>
                  <span className="font-mono tabular-nums font-medium text-[#166534]">
                    +{ecoPoints} EcoPoints
                  </span>
                </div>
                <div className="pt-2 border-t border-neutral-200 flex justify-between font-bold text-neutral-900">
                  <span>Total à régler</span>
                  <span className="font-mono tabular-nums text-base">
                    {totalPaid.toFixed(2)} TND
                  </span>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleInitKonnect}
                  className="px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? 'Initialisation...' : `Payer ${totalPaid.toFixed(2)} TND via Konnect`}
                </button>
              </div>
            </>
          )}

          {step === 'konnect' && (
            <div className="space-y-5">
              <div className="border border-neutral-200 rounded-xl p-5 bg-[#FAFAFA] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-bold text-neutral-900">Konnect Sandbox</span>
                  <span className="text-xs font-mono tabular-nums text-neutral-500">
                    Réf : {paymentRef}
                  </span>
                </div>
                <p className="text-xs text-neutral-600 leading-relaxed">
                  Passerelle de test Konnect Tunisia. Aucun débit réel n’est effectué. Cliquez ci-dessous pour simuler la validation instantanée du paiement et générer votre QR Code de retrait.
                </p>
                <div className="pt-2 flex items-center justify-between text-sm font-semibold text-neutral-900">
                  <span>Montant autorisé</span>
                  <span className="font-mono tabular-nums">{totalPaid.toFixed(2)} TND</span>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => setStep('summary')}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  Retour
                </button>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={handleConfirmPayment}
                  className="px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer"
                >
                  {submitting ? 'Validation en cours...' : 'Confirmer le paiement test'}
                </button>
              </div>
            </div>
          )}

          {step === 'confirmed' && createdOrder && (
            <div className="space-y-5 text-center">
              <div className="w-11 h-11 rounded-full bg-[#166534]/10 text-[#166534] flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-6 h-6" />
              </div>

              <div>
                <h3 className="text-lg font-bold text-neutral-900">
                  Paiement Konnect accepté
                </h3>
                <p className="text-xs text-neutral-600 mt-1">
                  Présentez ce QR Code chez <strong>{createdOrder.shopName}</strong> entre{' '}
                  <span className="font-mono">{createdOrder.pickupWindow}</span>.
                </p>
              </div>

              <div className="inline-flex flex-col items-center p-5 bg-white border border-neutral-200 rounded-2xl mx-auto">
                <QRCodeSVG value={createdOrder.qrCodeValue} size={160} level="M" />
                <p className="mt-3 text-xs font-mono font-semibold text-neutral-900 tracking-wider">
                  {createdOrder.qrCodeValue}
                </p>
                <p className="text-[11px] font-mono text-neutral-500 mt-0.5">
                  Konnect : {createdOrder.paymentRef}
                </p>
              </div>

              <div className="flex items-center justify-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2.5 text-sm font-medium text-neutral-700 hover:bg-neutral-100 rounded-lg cursor-pointer"
                >
                  Fermer
                </button>
                {canOpenOrders && (
                  <button
                    type="button"
                    onClick={onSuccessGoOrders}
                    className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] transition-colors cursor-pointer"
                  >
                    <QrCode className="w-4 h-4" />
                    <span>Voir mes commandes</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
