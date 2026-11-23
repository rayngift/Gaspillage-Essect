import { useEffect, useMemo, useRef, useState } from 'react';
import { Filter, Search, X } from 'lucide-react';
import { onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import {
  collection,
  doc,
  getDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  where,
} from 'firebase/firestore';
import { AdminDashboard } from './components/AdminDashboard';
import { AuthGateCard } from './components/AuthGateCard';
import { CampusRadarView } from './components/CampusRadarView';
import { Header } from './components/Header';
import { HeroSection } from './components/HeroSection';
import { MerchantPortal } from './components/MerchantPortal';
import { OfferCard } from './components/OfferCard';
import { OrdersView } from './components/OrdersView';
import { ReservationModal } from './components/ReservationModal';
import { RoleSelectorView } from './components/RoleSelectorView';
import { seedEssectDemoData } from './data/essectSeed';
import {
  ADMIN_BOOTSTRAP_EMAIL,
  auth,
  db,
  googleProvider,
  handleFirestoreError,
  OperationType,
} from './lib/firebase';
import type {
  ActiveView,
  Offer,
  OfferCategory,
  Order,
  Shop,
  UserProfile,
} from './types/campussave';

type CategoryFilter = 'Toutes' | OfferCategory;
type PriceFilter = 'all' | 'under_5' | '5_to_8' | 'over_8';

const CATEGORIES: CategoryFilter[] = [
  'Toutes',
  'Surprise Basket',
  'Boulangerie',
  'Salades & Bowls',
  'Plats chauds',
  'Pâtisserie',
];

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [authReady, setAuthReady] = useState(false);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [isAdminDoc, setIsAdminDoc] = useState(false);

  const [activeView, setActiveView] = useState<ActiveView>('offers');
  const [shops, setShops] = useState<Shop[]>([]);
  const [offers, setOffers] = useState<Offer[]>([]);
  const [myOrders, setMyOrders] = useState<Order[]>([]);
  const [merchantOrders, setMerchantOrders] = useState<Order[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [usersList, setUsersList] = useState<UserProfile[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Catalog filters
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<CategoryFilter>('Toutes');
  const [priceFilter, setPriceFilter] = useState<PriceFilter>('all');
  const [selectedShopFilter, setSelectedShopFilter] = useState<string | null>(null);

  // Reservation modal
  const [reserveTarget, setReserveTarget] = useState<Offer | null>(null);

  const catalogRef = useRef<HTMLDivElement | null>(null);
  const autoSeededRef = useRef(false);
  const prevSignedInRef = useRef(false);

  const isBootstrapAdmin =
    Boolean(user?.emailVerified) && user?.email === ADMIN_BOOTSTRAP_EMAIL;
  const isAdmin = isBootstrapAdmin || isAdminDoc || userProfile?.role === 'admin';
  const isMerchant = userProfile?.role === 'merchant';

  // 1. Auth state listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (currentUser) => {
      const wasSignedIn = prevSignedInRef.current;
      prevSignedInRef.current = Boolean(currentUser);

      setUser(currentUser);
      setAuthReady(true);

      if (!currentUser) {
        setUserProfile(null);
        setIsAdminDoc(false);
        setShops([]);
        setOffers([]);
        setMyOrders([]);
        setMerchantOrders([]);
        setAllOrders([]);
        setUsersList([]);
        setReserveTarget(null);
        autoSeededRef.current = false;
        return;
      }

      if (!wasSignedIn) {
        setActiveView('portals');
      }

      try {
        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
        setIsAdminDoc(adminSnap.exists());
      } catch {
        setIsAdminDoc(false);
      }
    });

    return () => unsub();
  }, []);

  // 2. Sync user profile document when signed in
  useEffect(() => {
    if (!authReady || !user) return;

    const userRef = doc(db, 'users', user.uid);
    const unsub = onSnapshot(
      userRef,
      async (snap) => {
        if (snap.exists()) {
          setUserProfile(snap.data() as UserProfile);
        } else {
          const initialProfile: UserProfile = {
            uid: user.uid,
            displayName: (user.displayName || user.email?.split('@')[0] || 'Étudiant ESSECT').slice(0, 80),
            email: (user.email || '').slice(0, 120),
            photoUrl: (user.photoURL || '').slice(0, 500),
            role: isBootstrapAdmin ? 'admin' : 'student',
            campus: 'ESSECT Montfleury',
          };
          try {
            await setDoc(userRef, {
              ...initialProfile,
              createdAt: serverTimestamp(),
              updatedAt: serverTimestamp(),
            });
          } catch (err) {
            handleFirestoreError(err, OperationType.CREATE, `users/${user.uid}`);
          }
        }
      },
      (err) => {
        handleFirestoreError(err, OperationType.GET, `users/${user.uid}`);
      }
    );

    return () => unsub();
  }, [authReady, user, isBootstrapAdmin]);

  // 3. Firestore live listeners (strictly gated behind authentication)
  useEffect(() => {
    if (!authReady || !user) return;

    setDataLoading(true);
    const unsubscribers: (() => void)[] = [];

    if (isBootstrapAdmin) {
      unsubscribers.push(
        onSnapshot(
          collection(db, 'shops'),
          (snap) => {
            const list = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Shop);
            setShops(list);
            setDataLoading(false);
            if (list.length === 0 && !autoSeededRef.current) {
              autoSeededRef.current = true;
              seedEssectDemoData(
                user.uid,
                user.displayName || user.email?.split('@')[0] || 'Admin ESSECT'
              ).catch((err) => {
                console.error('Auto-seed error:', err);
              });
            }
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'shops')
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, 'offers'),
          (snap) => {
            setOffers(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Offer));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'offers')
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, 'orders'),
          (snap) => {
            const all = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order);
            setAllOrders(all);
            setMyOrders(all.filter((o) => o.studentId === user.uid));
            setMerchantOrders(all.filter((o) => o.merchantId === user.uid));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );

      unsubscribers.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            setUsersList(
              snap.docs.map((d) => ({ ...d.data(), uid: d.id }) as UserProfile)
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
    } else {
      // Non-admin queries strictly satisfy resource.data security rules
      let approvedShops: Shop[] = [];
      let ownedShops: Shop[] = [];
      const syncShops = () => {
        const merged = new Map<string, Shop>();
        for (const s of approvedShops) merged.set(s.id, s);
        for (const s of ownedShops) merged.set(s.id, s);
        setShops(Array.from(merged.values()));
        setDataLoading(false);
      };

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'shops'), where('status', '==', 'approved')),
          (snap) => {
            approvedShops = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Shop);
            syncShops();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'shops')
        )
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'shops'), where('ownerId', '==', user.uid)),
          (snap) => {
            ownedShops = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Shop);
            syncShops();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'shops')
        )
      );

      let activeOffers: Offer[] = [];
      let ownedOffers: Offer[] = [];
      const syncOffers = () => {
        const merged = new Map<string, Offer>();
        for (const o of activeOffers) merged.set(o.id, o);
        for (const o of ownedOffers) merged.set(o.id, o);
        setOffers(Array.from(merged.values()));
      };

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'offers'), where('active', '==', true)),
          (snap) => {
            activeOffers = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Offer);
            syncOffers();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'offers')
        )
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'offers'), where('merchantId', '==', user.uid)),
          (snap) => {
            ownedOffers = snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Offer);
            syncOffers();
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'offers')
        )
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'orders'), where('studentId', '==', user.uid)),
          (snap) => {
            setMyOrders(snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );

      unsubscribers.push(
        onSnapshot(
          query(collection(db, 'orders'), where('merchantId', '==', user.uid)),
          (snap) => {
            setMerchantOrders(
              snap.docs.map((d) => ({ ...d.data(), id: d.id }) as Order)
            );
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );
    }

    return () => {
      for (const unsub of unsubscribers) unsub();
    };
  }, [authReady, user, isBootstrapAdmin]);

  const handleSignIn = async () => {
    setAuthError(null);
    setAuthLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setActiveView('portals');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'La connexion Google a été interrompue.';
      setAuthError(msg);
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignOut = async () => {
    await signOut(auth);
    setActiveView('offers');
  };

  // Student KPI calculations from real orders
  const activeOrders = useMemo(
    () => myOrders.filter((o) => o.status === 'paid'),
    [myOrders]
  );

  const studentStats = useMemo(() => {
    const valid = myOrders.filter((o) => o.status !== 'cancelled');
    const mealsSaved = valid.reduce((sum, o) => sum + o.quantity, 0);
    const co2SavedKg = mealsSaved * 2.5;
    const studentSavingsTnd = valid.reduce(
      (sum, o) => sum + (o.totalOriginalTnd - o.totalPaidTnd),
      0
    );
    const ecoPoints = myOrders
      .filter((o) => o.status === 'picked_up')
      .reduce((sum, o) => sum + o.ecoPointsEarned, 0);

    return { mealsSaved, co2SavedKg, studentSavingsTnd, ecoPoints };
  }, [myOrders]);

  // Filtered offers
  const visibleOffers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return offers
      .filter((offer) => offer.active !== false)
      .filter((offer) => {
        if (selectedShopFilter && (offer.shopId || offer.shopName) !== selectedShopFilter) return false;
        if (selectedCategory !== 'Toutes' && offer.category !== selectedCategory) return false;
        if (priceFilter === 'under_5' && offer.discountedPrice >= 5) return false;
        if (
          priceFilter === '5_to_8' &&
          (offer.discountedPrice < 5 || offer.discountedPrice > 8)
        ) {
          return false;
        }
        if (priceFilter === 'over_8' && offer.discountedPrice <= 8) return false;
        if (q) {
          const hay = `${offer.title || ''} ${offer.shopName || ''} ${offer.description || ''} ${offer.category || ''}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0));
  }, [offers, searchQuery, selectedCategory, priceFilter, selectedShopFilter]);

  const myShops = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return shops;
    return shops.filter((s) => s.ownerId === user.uid);
  }, [shops, user, isAdmin]);

  const myMerchantOffers = useMemo(() => {
    if (!user) return [];
    if (isAdmin) return offers;
    return offers.filter((o) => o.merchantId === user.uid);
  }, [offers, user, isAdmin]);

  const selectedShopName = useMemo(() => {
    if (!selectedShopFilter) return null;
    return shops.find((s) => s.id === selectedShopFilter)?.name ?? null;
  }, [shops, selectedShopFilter]);

  return (
    <div className="min-h-screen flex flex-col bg-[#F8F9F8] text-neutral-900">
      <Header
        activeView={activeView}
        onNavigate={(view) => {
          if (view === 'merchant' && !isMerchant) return;
          if (view === 'admin' && !isAdmin) return;
          setActiveView(view);
        }}
        user={user}
        isAdmin={isAdmin}
        isMerchant={isMerchant}
        activeOrderCount={activeOrders.length}
        authLoading={authLoading}
        onSignIn={handleSignIn}
        onSignOut={handleSignOut}
      />

      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-10">
        {authError && (
          <div className="p-3.5 rounded-xl bg-red-50 border border-red-200 text-xs text-red-700 flex items-center justify-between gap-3">
            <span>{authError}</span>
            <button
              type="button"
              onClick={() => setAuthError(null)}
              className="text-red-700 hover:text-red-900 cursor-pointer"
              aria-label="Fermer l'alerte"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* 3 Role Panels on Sign-In */}
        {activeView === 'portals' && user && (
          <RoleSelectorView
            user={user}
            isAdmin={isAdmin}
            isMerchant={isMerchant}
            activeOrderCount={activeOrders.length}
            approvedShopsCount={shops.filter((s) => s.status === 'approved').length}
            offersCount={offers.filter((o) => o.active).length}
            onSelectPortal={(view) => {
              if (view === 'merchant' && !isMerchant) return;
              if (view === 'admin' && !isAdmin) return;
              setActiveView(view);
            }}
          />
        )}

        {/* Offers View */}
        {activeView === 'offers' && (
          <div className="space-y-10">
            <HeroSection
              isAuthenticated={Boolean(user)}
              activeOrderCount={activeOrders.length}
              mealsSaved={studentStats.mealsSaved}
              co2SavedKg={studentStats.co2SavedKg}
              studentSavingsTnd={studentStats.studentSavingsTnd}
              ecoPoints={studentStats.ecoPoints}
              onExploreOffers={() =>
                catalogRef.current?.scrollIntoView({ behavior: 'smooth' })
              }
              onOpenOrders={() => setActiveView('orders')}
              onSignIn={handleSignIn}
            />

            <div ref={catalogRef} className="space-y-5">
              {!user ? (
                <AuthGateCard
                  title="Connectez-vous pour consulter les offres et réserver"
                  description="Les paniers anti-gaspillage, tarifs étudiants et réservations QR Code autour de l'ESSECT Montfleury sont exclusivement accessibles après connexion."
                  loading={authLoading}
                  onSignIn={handleSignIn}
                />
              ) : (
                <>
                  {/* Catalog Header + Search & Price Filters */}
                  <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-bold tracking-tight text-neutral-900">
                        Paniers disponibles aujourd’hui
                      </h2>
                      <p className="text-xs text-neutral-500 mt-1 font-mono tabular-nums">
                        {visibleOffers.length} offre(s) vérifiée(s) autour de l’ESSECT
                        {selectedShopName ? ` · Filtré sur ${selectedShopName}` : ''}
                      </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="relative flex-1 sm:w-64">
                        <Search className="w-4 h-4 text-neutral-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <input
                          type="search"
                          value={searchQuery}
                          onChange={(e) => setSearchQuery(e.target.value)}
                          placeholder="Rechercher produit, commerce..."
                          className="w-full h-10 pl-9 pr-3 bg-white border border-neutral-200 rounded-xl text-sm placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-[#166534]"
                        />
                      </div>

                      <div className="relative">
                        <Filter className="w-3.5 h-3.5 text-neutral-500 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                        <select
                          aria-label="Filtrer par prix"
                          value={priceFilter}
                          onChange={(e) => setPriceFilter(e.target.value as PriceFilter)}
                          className="h-10 pl-8 pr-8 bg-white border border-neutral-200 rounded-xl text-sm text-neutral-700 focus:outline-none focus:ring-2 focus:ring-[#166534]"
                        >
                          <option value="all">Tous les prix</option>
                          <option value="under_5">Moins de 5 TND</option>
                          <option value="5_to_8">5 à 8 TND</option>
                          <option value="over_8">Plus de 8 TND</option>
                        </select>
                      </div>

                      {selectedShopFilter && (
                        <button
                          type="button"
                          onClick={() => setSelectedShopFilter(null)}
                          className="inline-flex items-center gap-1 h-10 px-3 bg-white border border-neutral-200 rounded-xl text-xs font-medium text-neutral-700 hover:bg-neutral-50 cursor-pointer"
                        >
                          <span>Tous commerces</span>
                          <X className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Category Segmented Tabs */}
                  <div className="flex items-center gap-1.5 p-1 bg-white border border-neutral-200 rounded-xl w-fit max-w-full overflow-x-auto">
                    {CATEGORIES.map((category) => {
                      const active = selectedCategory === category;
                      return (
                        <button
                          key={category}
                          type="button"
                          onClick={() => setSelectedCategory(category)}
                          className={`px-3.5 py-1.5 text-xs font-medium rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            active
                              ? 'bg-[#166534] text-white'
                              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                          }`}
                        >
                          {category}
                        </button>
                      );
                    })}
                  </div>

                  {/* Offers Grid */}
                  {dataLoading && offers.length === 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {[1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className="bg-white border border-neutral-200 rounded-2xl h-80 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : visibleOffers.length === 0 ? (
                    <div className="bg-white border border-neutral-200 rounded-2xl p-10 text-center space-y-3">
                      <p className="text-sm text-neutral-600">
                        Aucune offre disponible ne correspond à vos critères actuels.
                      </p>
                      {(searchQuery || selectedCategory !== 'Toutes' || priceFilter !== 'all' || selectedShopFilter) && (
                        <button
                          type="button"
                          onClick={() => {
                            setSearchQuery('');
                            setSelectedCategory('Toutes');
                            setPriceFilter('all');
                            setSelectedShopFilter(null);
                          }}
                          className="px-4 py-2 text-xs font-medium text-white bg-[#166534] rounded-lg hover:bg-[#14532d] cursor-pointer"
                        >
                          Réinitialiser les filtres
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                      {visibleOffers.map((offer) => (
                        <OfferCard
                          key={offer.id}
                          offer={offer}
                          onReserve={(selected) => setReserveTarget(selected)}
                        />
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        )}

        {/* Campus Radar View (strictly gated behind authentication) */}
        {activeView === 'radar' &&
          (!user ? (
            <AuthGateCard
              title="Connectez-vous pour explorer le Campus Radar"
              description="Localisez les cafétérias, boulangeries et restaurants partenaires autour de l'ESSECT Montfleury et consultez leurs paniers disponibles après connexion."
              loading={authLoading}
              onSignIn={handleSignIn}
            />
          ) : (
            <CampusRadarView
              shops={shops}
              offers={offers}
              onSelectShopOffers={(shopId) => {
                setSelectedShopFilter(shopId);
                setActiveView('offers');
              }}
            />
          ))}

        {/* Student Orders & Impact View */}
        {activeView === 'orders' && user && (
          <OrdersView
            orders={myOrders}
            mealsSaved={studentStats.mealsSaved}
            co2SavedKg={studentStats.co2SavedKg}
            studentSavingsTnd={studentStats.studentSavingsTnd}
            ecoPoints={studentStats.ecoPoints}
            onBrowseOffers={() => setActiveView('offers')}
          />
        )}

        {/* Merchant Portal (Strictly Merchant Only) */}
        {activeView === 'merchant' && user && (
          isMerchant ? (
            <MerchantPortal
              user={user}
              isAdmin={false}
              myShops={myShops}
              myOffers={myMerchantOffers}
              merchantOrders={merchantOrders}
            />
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Accès réservé aux commerçants
              </h2>
              <p className="text-sm text-neutral-600">
                Seuls les comptes ayant le rôle Commerçant peuvent accéder à l’espace de gestion des commerces et offres.
              </p>
              <button
                type="button"
                onClick={() => setActiveView('portals')}
                className="px-4 py-2 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] cursor-pointer"
              >
                Retour aux espaces
              </button>
            </div>
          )
        )}

        {/* Admin Dashboard (Strictly Admin Only) */}
        {activeView === 'admin' && user && (
          isAdmin ? (
            <AdminDashboard
              user={user}
              shops={shops}
              offers={offers}
              orders={allOrders}
              usersList={usersList}
            />
          ) : (
            <div className="bg-white border border-neutral-200 rounded-2xl p-8 max-w-xl mx-auto text-center space-y-4">
              <h2 className="text-xl font-bold text-neutral-900">
                Accès réservé aux administrateurs
              </h2>
              <p className="text-sm text-neutral-600">
                Seuls les administrateurs autorisés peuvent accéder à la page d’administration.
              </p>
              <button
                type="button"
                onClick={() => setActiveView('portals')}
                className="px-4 py-2 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] cursor-pointer"
              >
                Retour aux espaces
              </button>
            </div>
          )
        )}
      </main>

      <footer className="border-t border-neutral-200 bg-white mt-auto">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-neutral-500">
          <span>CampusSave ESSECT · 3ème année Business Computing · Montfleury, Tunis</span>
          <span>Paiement test Konnect · Synchronisation temps réel Firebase</span>
        </div>
      </footer>

      {reserveTarget && user && (
        <ReservationModal
          offer={reserveTarget}
          user={user}
          onClose={() => setReserveTarget(null)}
          onSuccessGoOrders={() => {
            setReserveTarget(null);
            setActiveView('orders');
          }}
        />
      )}
    </div>
  );
}
