import { useState } from 'react';
import { QrCode, Utensils } from 'lucide-react';
import { GENERATED_IMAGES } from '../data/essectSeed';

interface HeroSectionProps {
  isAuthenticated: boolean;
  canOpenOrders?: boolean;
  activeOrderCount: number;
  approvedShopsCount: number;
  activeOffersCount: number;
  avgDiscountPct: number;
  mealsSaved: number;
  co2SavedKg: number;
  studentSavingsTnd: number;
  ecoPoints: number;
  onExploreOffers: () => void;
  onOpenOrders: () => void;
  onSignIn: () => void;
}

export function HeroSection({
  isAuthenticated,
  canOpenOrders = false,
  activeOrderCount,
  approvedShopsCount,
  activeOffersCount,
  avgDiscountPct,
  mealsSaved,
  co2SavedKg,
  studentSavingsTnd,
  ecoPoints,
  onExploreOffers,
  onOpenOrders,
}: HeroSectionProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);

  const kpis = isAuthenticated
    ? [
        { label: 'Repas sauvés', value: String(mealsSaved) },
        { label: 'CO₂ évité', value: `${co2SavedKg.toFixed(1).replace(/\.0$/, '')} kg` },
        { label: 'Économies étudiantes', value: `${studentSavingsTnd.toFixed(2)} TND` },
        { label: 'Mes EcoPoints', value: `${ecoPoints} pts`, accent: true },
      ]
    : [
        {
          label: 'Commerces partenaires',
          value: `${approvedShopsCount} partenaire${approvedShopsCount > 1 ? 's' : ''}`,
        },
        {
          label: 'Offres actives',
          value: `${activeOffersCount} disponible${activeOffersCount > 1 ? 's' : ''}`,
        },
        {
          label: 'Réduction moyenne',
          value: avgDiscountPct > 0 ? `-${avgDiscountPct}%` : '—',
          accent: true,
        },
        { label: 'Paiement sécurisé', value: 'Konnect & QR' },
      ];

  return (
    <section className="space-y-4">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 items-stretch">
        <div className="lg:col-span-6 bg-white border border-neutral-200 rounded-2xl p-6 sm:p-8 flex flex-col justify-between">
          <div className="space-y-4">
            <p className="text-xs font-medium text-[#166534]">
              ESSECT Montfleury · Plateforme solidaire anti-gaspillage
            </p>
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-neutral-900 leading-[1.12] text-balance">
              Sauvez les invendus du campus à prix étudiant.
            </h1>
            <p className="text-sm sm:text-base text-neutral-600 leading-relaxed max-w-xl">
              Réservez les paniers du jour et Surprise Baskets des cafétérias et boulangeries autour de l’ESSECT, réglez via Konnect et récupérez votre commande avec votre QR Code.
            </p>
          </div>

          <div className="pt-6 flex flex-wrap items-center gap-3">
            {isAuthenticated ? (
              <>
                <button
                  type="button"
                  onClick={onExploreOffers}
                  className="px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
                >
                  Explorer les offres
                </button>
                {canOpenOrders && (
                  <button
                    type="button"
                    onClick={onOpenOrders}
                    className="inline-flex items-center gap-2 px-4 py-2.5 bg-neutral-100 text-neutral-800 text-sm font-medium rounded-lg border border-neutral-200 hover:bg-neutral-200/70 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#166534]"
                  >
                    <QrCode className="w-4 h-4 text-[#166534]" />
                    <span>Mes commandes QR ({activeOrderCount})</span>
                  </button>
                )}
              </>
            ) : (
              <button
                type="button"
                onClick={onExploreOffers}
                className="px-5 py-2.5 bg-[#166534] text-white text-sm font-medium rounded-lg hover:bg-[#14532d] transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
              >
                Explorer les offres
              </button>
            )}
          </div>
        </div>

        <div className="lg:col-span-6 rounded-2xl overflow-hidden border border-neutral-200 bg-neutral-100 min-h-[260px] lg:min-h-[320px]">
          {!heroImgFailed ? (
            <img
              src={GENERATED_IMAGES.hero}
              alt="Cour du campus ESSECT Montfleury à Tunis"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#166534]/10 via-neutral-100 to-neutral-200 text-neutral-700">
              <Utensils className="w-10 h-10 text-[#166534] mb-3" />
              <p className="text-sm font-medium text-center">
                Paniers campus ESSECT Montfleury
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4-column KPI strip matching screenshot */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((kpi) => (
          <div
            key={kpi.label}
            className="bg-white border border-neutral-200 rounded-xl px-5 py-4"
          >
            <p className="text-xs text-neutral-500 mb-1.5">{kpi.label}</p>
            <p
              className={`text-2xl font-bold font-mono tabular-nums tracking-tight ${
                kpi.accent ? 'text-[#166534]' : 'text-neutral-900'
              }`}
            >
              {kpi.value}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
