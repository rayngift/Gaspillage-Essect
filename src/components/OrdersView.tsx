import { useState } from 'react';
import { CheckCircle2, Clock, Leaf, QrCode, XCircle } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { doc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Order } from '../types/campussave';

interface OrdersViewProps {
  orders: Order[];
  mealsSaved: number;
  co2SavedKg: number;
  studentSavingsTnd: number;
  ecoPoints: number;
  onBrowseOffers: () => void;
}

export function OrdersView({
  orders,
  mealsSaved,
  co2SavedKg,
  studentSavingsTnd,
  ecoPoints,
  onBrowseOffers,
}: OrdersViewProps) {
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const activeOrders = orders.filter((o) => o.status === 'paid');
  const pastOrders = orders.filter((o) => o.status !== 'paid');

  const handleCancelOrder = async (order: Order) => {
    setCancellingId(order.id);
    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'cancelled',
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `orders/${order.id}`);
    } finally {
      setCancellingId(null);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#166534] mb-1">
            Suivi QR Code & Impact Dashboard
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Mes commandes et impact écologique
          </h2>
        </div>

        <button
          type="button"
          onClick={onBrowseOffers}
          className="px-4 py-2 text-sm font-medium text-[#166534] bg-white border border-neutral-200 rounded-lg hover:bg-neutral-50 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          Découvrir d’autres paniers
        </button>
      </div>

      {/* Personal Impact Dashboard */}
      <div className="bg-white border border-neutral-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-neutral-900 mb-4">
          <Leaf className="w-4 h-4 text-[#166534]" />
          <span>Mon Impact Anti-Gaspillage (ESSECT)</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
            <p className="text-xs text-neutral-500">Repas sauvés</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
              {mealsSaved}
            </p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
            <p className="text-xs text-neutral-500">CO₂ évité</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
              {co2SavedKg.toFixed(1).replace(/\.0$/, '')} kg
            </p>
          </div>
          <div className="p-4 rounded-xl bg-neutral-50 border border-neutral-100">
            <p className="text-xs text-neutral-500">Économies totales</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
              {studentSavingsTnd.toFixed(2)} TND
            </p>
          </div>
          <div className="p-4 rounded-xl bg-[#166534]/5 border border-[#166534]/20">
            <p className="text-xs text-[#166534]">Mes EcoPoints validés</p>
            <p className="text-2xl font-bold font-mono tabular-nums text-[#166534] mt-1">
              {ecoPoints} pts
            </p>
          </div>
        </div>
      </div>

      {/* Active QR Passes */}
      <div className="space-y-4">
        <h3 className="text-lg font-bold text-neutral-900">
          Pass QR Code à retirer ({activeOrders.length})
        </h3>

        {activeOrders.length === 0 ? (
          <div className="bg-white border border-neutral-200 rounded-2xl p-8 text-center space-y-3">
            <QrCode className="w-8 h-8 text-neutral-400 mx-auto" />
            <p className="text-sm text-neutral-600">
              Vous n’avez aucune commande en attente de retrait pour le moment.
            </p>
            <button
              type="button"
              onClick={onBrowseOffers}
              className="px-4 py-2 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] cursor-pointer"
            >
              Explorer les offres du jour
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {activeOrders.map((order) => (
              <article
                key={order.id}
                className="bg-white border border-neutral-200 rounded-2xl p-6 flex flex-col sm:flex-row items-center gap-6"
              >
                <div className="p-3 bg-white border border-neutral-200 rounded-xl shrink-0">
                  <QRCodeSVG value={order.qrCodeValue || order.id} size={116} level="M" />
                </div>

                <div className="flex-1 min-w-0 space-y-2 w-full">
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[#166534]">
                      <Clock className="w-3.5 h-3.5" />
                      Prêt pour retrait
                    </span>
                    <span className="text-xs font-mono text-neutral-500">
                      {order.paymentRef}
                    </span>
                  </div>

                  <h4 className="text-base font-bold text-neutral-900 truncate">
                    {order.offerTitle}
                  </h4>

                  <p className="text-xs text-neutral-600">
                    {order.shopName} · {order.quantity} panier{order.quantity > 1 ? 's' : ''} ·{' '}
                    <span className="font-mono tabular-nums font-semibold">
                      {Number(order.totalPaidTnd ?? 0).toFixed(2)} TND
                    </span>
                  </p>

                  <p className="text-xs font-mono tabular-nums text-neutral-500">
                    Créneau : {order.pickupWindow} · Code : {order.qrCodeValue}
                  </p>

                  <div className="pt-2 flex items-center justify-between gap-3">
                    <span className="text-xs font-mono font-medium text-[#166534]">
                      +{order.ecoPointsEarned} pts au scan
                    </span>
                    <button
                      type="button"
                      disabled={cancellingId === order.id}
                      onClick={() => handleCancelOrder(order)}
                      className="text-xs font-medium text-red-600 hover:text-red-700 disabled:opacity-50 cursor-pointer"
                    >
                      {cancellingId === order.id ? 'Annulation...' : 'Annuler'}
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      {/* History */}
      {pastOrders.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-bold text-neutral-900">
            Historique ({pastOrders.length})
          </h3>
          <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-500">
                  <tr>
                    <th className="py-3 px-4 font-medium">Offre</th>
                    <th className="py-3 px-4 font-medium">Commerce</th>
                    <th className="py-3 px-4 font-medium text-right">Qté</th>
                    <th className="py-3 px-4 font-medium text-right">Montant</th>
                    <th className="py-3 px-4 font-medium">Statut</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-neutral-100">
                  {pastOrders.map((order) => (
                    <tr key={order.id} className="hover:bg-neutral-50/70">
                      <td className="py-3 px-4 font-medium text-neutral-900">
                        {order.offerTitle}
                      </td>
                      <td className="py-3 px-4 text-neutral-600">{order.shopName}</td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums">
                        {order.quantity}
                      </td>
                      <td className="py-3 px-4 text-right font-mono tabular-nums font-semibold">
                        {Number(order.totalPaidTnd ?? 0).toFixed(2)} TND
                      </td>
                      <td className="py-3 px-4">
                        {order.status === 'picked_up' ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-[#166534]">
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            Récupéré (+{order.ecoPointsEarned} pts)
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-500">
                            <XCircle className="w-3.5 h-3.5" />
                            Annulé
                          </span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
