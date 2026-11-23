import { useState } from 'react';
import { Check, Database, Shield, Users, X } from 'lucide-react';
import type { User } from 'firebase/auth';
import { doc, getDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { seedEssectDemoData } from '../data/essectSeed';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import type { Offer, Order, Shop, UserProfile, UserRole } from '../types/campussave';

interface AdminDashboardProps {
  user: User;
  shops: Shop[];
  offers: Offer[];
  orders: Order[];
  usersList: UserProfile[];
}

export function AdminDashboard({
  user,
  shops,
  offers,
  orders,
  usersList,
}: AdminDashboardProps) {
  const [seeding, setSeeding] = useState(false);
  const [adminMessage, setAdminMessage] = useState<string | null>(null);

  const pendingShops = shops.filter((s) => s.status === 'pending');
  const approvedShops = shops.filter((s) => s.status === 'approved');
  const validOrders = orders.filter((o) => o.status !== 'cancelled');
  const totalMealsSaved = validOrders.reduce((acc, o) => acc + o.quantity, 0);
  const totalCo2Kg = Number((totalMealsSaved * 2.5).toFixed(1));
  const totalVolumeTnd = validOrders.reduce((acc, o) => acc + o.totalPaidTnd, 0);

  const handleSeedEssect = async () => {
    setSeeding(true);
    setAdminMessage(null);
    try {
      await seedEssectDemoData(
        user.uid,
        user.displayName || user.email?.split('@')[0] || 'Administrateur ESSECT'
      );
      setAdminMessage('Données ESSECT Montfleury synchronisées dans Firestore.');
    } catch (err) {
      setAdminMessage(
        err instanceof Error ? err.message : 'Erreur lors de la synchronisation.'
      );
    } finally {
      setSeeding(false);
    }
  };

  const handleShopDecision = async (shop: Shop, status: 'approved' | 'rejected') => {
    try {
      await updateDoc(doc(db, 'shops', shop.id), {
        status,
        updatedAt: serverTimestamp(),
      });
      if (status === 'approved') {
        const ownerRef = doc(db, 'users', shop.ownerId);
        const ownerSnap = await getDoc(ownerRef);
        if (ownerSnap.exists() && ownerSnap.data()?.role !== 'admin') {
          await updateDoc(ownerRef, {
            role: 'merchant',
            updatedAt: serverTimestamp(),
          });
        }
      }
      setAdminMessage(
        `Commerce "${shop.name}" ${status === 'approved' ? 'validé' : 'refusé'}.`
      );
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `shops/${shop.id}`);
    }
  };

  const handleChangeUserRole = async (targetUser: UserProfile, nextRole: UserRole) => {
    try {
      await updateDoc(doc(db, 'users', targetUser.uid), {
        role: nextRole,
        updatedAt: serverTimestamp(),
      });
      setAdminMessage(`Rôle de ${targetUser.displayName} mis à jour (${nextRole}).`);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${targetUser.uid}`);
    }
  };

  return (
    <section className="space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#166534] mb-1">
            Administration CampusSave ESSECT
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Supervision de la plateforme
          </h2>
        </div>

        <button
          type="button"
          disabled={seeding}
          onClick={handleSeedEssect}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] disabled:opacity-60 transition-colors cursor-pointer whitespace-nowrap shrink-0"
        >
          <Database className="w-4 h-4" />
          <span>{seeding ? 'Synchronisation...' : 'Synchroniser données ESSECT'}</span>
        </button>
      </div>

      {adminMessage && (
        <div className="p-3.5 rounded-xl bg-[#166534]/10 border border-[#166534]/20 text-xs font-medium text-[#166534]">
          {adminMessage}
        </div>
      )}

      {/* Global Platform KPIs */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Commerces actifs</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
            {approvedShops.length}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Offres actives</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
            {offers.length}
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Repas sauvés (plateforme)</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-[#166534] mt-1">
            {totalMealsSaved} ({totalCo2Kg} kg CO₂)
          </p>
        </div>
        <div className="bg-white border border-neutral-200 rounded-xl p-5">
          <p className="text-xs text-neutral-500">Volume Konnect</p>
          <p className="text-2xl font-bold font-mono tabular-nums text-neutral-900 mt-1">
            {totalVolumeTnd.toFixed(2)} TND
          </p>
        </div>
      </div>

      {/* Pending Merchant Validations */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4 text-[#166534]" />
            <h3 className="text-base font-bold text-neutral-900">
              Validation des commerces ({pendingShops.length} en attente)
            </h3>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-500">
              <tr>
                <th className="py-3 px-4 font-medium">Commerce</th>
                <th className="py-3 px-4 font-medium">Catégorie</th>
                <th className="py-3 px-4 font-medium">Responsable</th>
                <th className="py-3 px-4 font-medium text-right">Distance</th>
                <th className="py-3 px-4 font-medium">Statut</th>
                <th className="py-3 px-4 font-medium text-right">Décision</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {shops.map((shop) => (
                <tr key={shop.id} className="hover:bg-neutral-50/70">
                  <td className="py-3 px-4 font-medium text-neutral-900">{shop.name}</td>
                  <td className="py-3 px-4 text-neutral-600">{shop.category}</td>
                  <td className="py-3 px-4 text-neutral-600">{shop.ownerName}</td>
                  <td className="py-3 px-4 text-right font-mono tabular-nums">
                    {shop.distanceMeters} m
                  </td>
                  <td className="py-3 px-4 text-xs font-medium">
                    {shop.status === 'approved' && (
                      <span className="text-[#166534]">Validé</span>
                    )}
                    {shop.status === 'pending' && (
                      <span className="text-amber-700">En attente</span>
                    )}
                    {shop.status === 'rejected' && (
                      <span className="text-red-600">Refusé</span>
                    )}
                  </td>
                  <td className="py-3 px-4 text-right">
                    <div className="inline-flex items-center gap-2">
                      {shop.status !== 'approved' && (
                        <button
                          type="button"
                          onClick={() => handleShopDecision(shop, 'approved')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-[#166534] text-white rounded-md hover:bg-[#14532d] cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Valider</span>
                        </button>
                      )}
                      {shop.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleShopDecision(shop, 'rejected')}
                          className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Refuser</span>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Users Management */}
      <div className="bg-white border border-neutral-200 rounded-2xl overflow-hidden">
        <div className="px-6 py-4 border-b border-neutral-200 flex items-center gap-2">
          <Users className="w-4 h-4 text-[#166534]" />
          <h3 className="text-base font-bold text-neutral-900">
            Utilisateurs inscrits ({usersList.length})
          </h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-neutral-50 border-b border-neutral-200 text-xs text-neutral-500">
              <tr>
                <th className="py-3 px-4 font-medium">Nom</th>
                <th className="py-3 px-4 font-medium">Email</th>
                <th className="py-3 px-4 font-medium">Campus</th>
                <th className="py-3 px-4 font-medium">Rôle</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {usersList.map((u) => (
                <tr key={u.uid} className="hover:bg-neutral-50/70">
                  <td className="py-3 px-4 font-medium text-neutral-900">{u.displayName}</td>
                  <td className="py-3 px-4 text-neutral-600">{u.email}</td>
                  <td className="py-3 px-4 text-neutral-600">{u.campus}</td>
                  <td className="py-3 px-4">
                    <select
                      value={u.role}
                      onChange={(e) => handleChangeUserRole(u, e.target.value as UserRole)}
                      className="h-8 px-2.5 rounded-md border border-neutral-200 text-xs bg-white focus:outline-none focus:ring-2 focus:ring-[#166534]"
                    >
                      <option value="student">Étudiant</option>
                      <option value="merchant">Commerçant</option>
                      <option value="admin">Administrateur</option>
                    </select>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </section>
  );
}
