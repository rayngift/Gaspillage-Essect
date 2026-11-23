import { useMemo, useState } from 'react';
import { MapPin, Navigation, Store } from 'lucide-react';
import type { Offer, Shop } from '../types/campussave';

interface CampusRadarViewProps {
  shops: Shop[];
  offers: Offer[];
  onSelectShopOffers: (shopId: string) => void;
}

interface NormalizedShop {
  id: string;
  name: string;
  category: string;
  address: string;
  distanceMeters: number;
  angleDeg: number;
  pickupWindow: string;
}

export function CampusRadarView({
  shops,
  offers,
  onSelectShopOffers,
}: CampusRadarViewProps) {
  const [maxRadius, setMaxRadius] = useState<number>(500);
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);

  // Normalize shops from Firestore (supports both web & mobile field shapes)
  const normalizedShops = useMemo<NormalizedShop[]>(() => {
    const validShops = shops.filter(
      (s) => s.status !== 'rejected' && s.status !== 'pending'
    );

    if (validShops.length > 0) {
      return validShops.map((s, idx) => {
        const raw = s as unknown as Record<string, unknown>;
        const rawDist = Number(raw.distanceMeters ?? raw.distance ?? 150);
        const rawAngle = Number(raw.angleDeg ?? raw.angle);
        return {
          id: s.id || `shop_${idx}`,
          name: String(raw.name || raw.shopName || 'Commerce partenaire'),
          category: String(raw.category || 'Commerce'),
          address: String(raw.address || 'À proximité de l’ESSECT Montfleury'),
          distanceMeters: Number.isFinite(rawDist) && rawDist > 0 ? rawDist : 150,
          angleDeg: Number.isFinite(rawAngle) ? rawAngle : (idx * 85 + 35) % 360,
          pickupWindow: String(raw.pickupWindow || '16h00 - 19h00'),
        };
      });
    }

    // Fallback: derive partner shops from active offers if shops collection is empty
    const derived = new Map<string, NormalizedShop>();
    let idx = 0;
    for (const offer of offers) {
      if (offer.active === false) continue;
      const sid = offer.shopId || offer.shopName || `derived_${idx}`;
      if (!derived.has(sid)) {
        derived.set(sid, {
          id: sid,
          name: offer.shopName || 'Commerce partenaire',
          category: offer.shopCategory || 'Commerce',
          address: 'Autour de l’ESSECT Montfleury',
          distanceMeters:
            Number.isFinite(Number(offer.distanceMeters)) && Number(offer.distanceMeters) > 0
              ? Number(offer.distanceMeters)
              : 180 + idx * 90,
          angleDeg: (idx * 85 + 35) % 360,
          pickupWindow: offer.pickupWindow || '16h00 - 19h00',
        });
        idx++;
      }
    }
    return Array.from(derived.values());
  }, [shops, offers]);

  const visibleShops = useMemo(
    () =>
      normalizedShops
        .filter((s) => s.distanceMeters <= maxRadius)
        .sort((a, b) => a.distanceMeters - b.distanceMeters),
    [normalizedShops, maxRadius]
  );

  const basketCountsByShop = useMemo(() => {
    const map = new Map<string, number>();
    for (const offer of offers) {
      const qty = Number(offer.quantityAvailable ?? 0);
      if (offer.active !== false && qty > 0) {
        const key = offer.shopId || offer.shopName;
        if (key) {
          map.set(key, (map.get(key) || 0) + qty);
        }
      }
    }
    return map;
  }, [offers]);

  const activeSelectedId = useMemo(() => {
    if (selectedShopId && visibleShops.some((s) => s.id === selectedShopId)) {
      return selectedShopId;
    }
    return visibleShops[0]?.id ?? null;
  }, [selectedShopId, visibleShops]);

  const selectedShop = useMemo(
    () => visibleShops.find((s) => s.id === activeSelectedId) ?? null,
    [visibleShops, activeSelectedId]
  );

  const radarSize = 420;
  const center = radarSize / 2;
  const maxVisualRadius = 166;

  // Compute distinct clean ring distances
  const ringDistances = useMemo(() => {
    if (maxRadius <= 250) return [Math.round(maxRadius / 2), maxRadius];
    if (maxRadius <= 400) return [150, maxRadius];
    return [150, 300, maxRadius];
  }, [maxRadius]);

  return (
    <section className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#166534] mb-1">
            Bonus Campus Radar · ESSECT Montfleury
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Commerces partenaires autour du campus
          </h2>
        </div>

        <div className="flex items-center gap-3 bg-white border border-neutral-200 rounded-xl px-4 py-2.5 shrink-0">
          <label
            htmlFor="radar-radius-slider"
            className="text-xs text-neutral-600 whitespace-nowrap"
          >
            Rayon max :{' '}
            <span className="font-mono tabular-nums font-semibold text-neutral-900">
              {maxRadius} m
            </span>
          </label>
          <input
            id="radar-radius-slider"
            type="range"
            min={150}
            max={1000}
            step={50}
            value={maxRadius}
            onChange={(e) => setMaxRadius(Number(e.target.value))}
            className="w-28 accent-[#166534] cursor-pointer"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Radar Visualization */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-6 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5 text-[#166534] font-medium">
              <Navigation className="w-3.5 h-3.5" />
              Centre ESSECT (4 Rue Abou Kacem Chabbi)
            </span>
            <span className="font-mono tabular-nums text-neutral-500">
              {visibleShops.length} commerce{visibleShops.length > 1 ? 's' : ''} détecté
              {visibleShops.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="border border-neutral-200 rounded-xl bg-[#FAFAFA] p-4 flex items-center justify-center overflow-hidden">
            <svg
              viewBox={`0 0 ${radarSize} ${radarSize}`}
              className="w-full max-w-[460px] h-auto select-none"
              role="img"
              aria-label="Radar des commerces partenaires autour de l'ESSECT"
            >
              {/* Crosshair axes */}
              <line
                x1={center}
                y1={24}
                x2={center}
                y2={radarSize - 24}
                stroke="#E5E7EB"
                strokeWidth="1"
              />
              <line
                x1={24}
                y1={center}
                x2={radarSize - 24}
                y2={center}
                stroke="#E5E7EB"
                strokeWidth="1"
              />

              {/* Concentric rings */}
              {ringDistances.map((ringMeters) => {
                const r = (ringMeters / maxRadius) * maxVisualRadius;
                return (
                  <g key={ringMeters}>
                    <circle
                      cx={center}
                      cy={center}
                      r={r}
                      fill="none"
                      stroke="#D1D5DB"
                      strokeDasharray="4 4"
                      strokeWidth="1.2"
                    />
                    <text
                      x={center}
                      y={center - r + 12}
                      textAnchor="middle"
                      className="fill-neutral-500 text-[10px] font-mono"
                    >
                      {ringMeters} m
                    </text>
                  </g>
                );
              })}

              {/* Highlighted vector line from ESSECT to selected shop */}
              {selectedShop && (() => {
                const rad = (selectedShop.angleDeg * Math.PI) / 180;
                const distRatio = Math.min(selectedShop.distanceMeters / maxRadius, 0.92);
                const r = Math.max(distRatio * maxVisualRadius, 42);
                const sx = center + Math.cos(rad) * r;
                const sy = center - Math.sin(rad) * r;
                return (
                  <line
                    x1={center}
                    y1={center}
                    x2={sx}
                    y2={sy}
                    stroke="#166534"
                    strokeOpacity="0.35"
                    strokeDasharray="3 3"
                    strokeWidth="1.5"
                  />
                );
              })()}

              {/* Partner shop nodes */}
              {visibleShops.map((shop) => {
                const rad = (shop.angleDeg * Math.PI) / 180;
                const distRatio = Math.min(shop.distanceMeters / maxRadius, 0.92);
                const r = Math.max(distRatio * maxVisualRadius, 42);
                const x = center + Math.cos(rad) * r;
                const y = center - Math.sin(rad) * r;
                const isSelected = shop.id === activeSelectedId;
                const count =
                  basketCountsByShop.get(shop.id) ??
                  basketCountsByShop.get(shop.name) ??
                  0;
                const shortName =
                  shop.name.length > 20 ? `${shop.name.slice(0, 18)}…` : shop.name;

                return (
                  <g
                    key={shop.id}
                    onClick={() => setSelectedShopId(shop.id)}
                    className="cursor-pointer"
                  >
                    {isSelected && (
                      <circle
                        cx={x}
                        cy={y}
                        r={24}
                        fill="none"
                        stroke="#166534"
                        strokeOpacity="0.25"
                        strokeWidth="4"
                      />
                    )}
                    <circle
                      cx={x}
                      cy={y}
                      r={18}
                      fill={isSelected ? '#166534' : '#FFFFFF'}
                      stroke="#166534"
                      strokeWidth={isSelected ? 2 : 1.75}
                    />
                    <text
                      x={x}
                      y={y + 4}
                      textAnchor="middle"
                      className={`text-[12px] font-mono font-bold ${
                        isSelected ? 'fill-white' : 'fill-neutral-900'
                      }`}
                    >
                      {count}
                    </text>
                    <text
                      x={x}
                      y={y + 32}
                      textAnchor="middle"
                      className="fill-neutral-800 text-[11px] font-medium"
                    >
                      {shortName}
                    </text>
                  </g>
                );
              })}

              {/* Center ESSECT Campus marker (drawn on top) */}
              <rect
                x={center - 30}
                y={center - 13}
                width={60}
                height={26}
                rx={6}
                fill="#111827"
              />
              <text
                x={center}
                y={center + 4}
                textAnchor="middle"
                className="fill-white text-[11px] font-semibold"
              >
                ESSECT
              </text>
            </svg>
          </div>

          {selectedShop && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 pt-1">
              <span>
                Sélection : <strong className="text-neutral-900">{selectedShop.name}</strong> ({selectedShop.distanceMeters} m)
              </span>
              <span className="font-mono tabular-nums text-neutral-500">
                Retrait {selectedShop.pickupWindow}
              </span>
            </div>
          )}
        </div>

        {/* Right Shop Cards List */}
        <div className="lg:col-span-5 space-y-3.5">
          {visibleShops.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center text-sm text-neutral-500">
              Aucun commerce dans un rayon de {maxRadius} m. Augmentez le rayon pour afficher plus de partenaires.
            </div>
          ) : (
            visibleShops.map((shop) => {
              const isSelected = shop.id === activeSelectedId;
              const basketCount =
                basketCountsByShop.get(shop.id) ??
                basketCountsByShop.get(shop.name) ??
                0;
              const walkMins = Math.max(1, Math.round(shop.distanceMeters / 75));

              return (
                <article
                  key={shop.id}
                  className={`bg-white rounded-2xl p-5 border transition-colors ${
                    isSelected
                      ? 'border-[#166534]'
                      : 'border-neutral-200 hover:border-neutral-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="space-y-1 min-w-0">
                      <p className="text-xs text-neutral-500 font-mono tabular-nums">
                        {shop.category} · {shop.distanceMeters} m (~{walkMins} min à pied)
                      </p>
                      <h3 className="text-base font-bold text-neutral-900 flex items-center gap-2">
                        <Store className="w-4 h-4 text-[#166534] shrink-0" />
                        <span className="truncate">{shop.name}</span>
                      </h3>
                      <p className="text-xs text-neutral-500 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 shrink-0 text-neutral-400" />
                        <span className="truncate">{shop.address}</span>
                      </p>
                    </div>

                    <div className="text-right shrink-0">
                      <p className="text-sm font-bold font-mono tabular-nums text-[#166534]">
                        {basketCount} panier{basketCount > 1 ? 's' : ''}
                      </p>
                      <p className="text-xs font-mono tabular-nums text-neutral-500">
                        {shop.pickupWindow}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 pt-3 border-t border-neutral-100 flex items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={() => setSelectedShopId(shop.id)}
                      className="text-xs font-medium text-neutral-600 hover:text-neutral-900 transition-colors cursor-pointer whitespace-nowrap"
                    >
                      Centrer sur le radar
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectShopOffers(shop.id)}
                      className="px-3.5 py-2 text-xs font-medium text-white bg-[#166534] rounded-lg hover:bg-[#14532d] transition-colors cursor-pointer whitespace-nowrap shrink-0"
                    >
                      Voir les offres
                    </button>
                  </div>
                </article>
              );
            })
          )}
        </div>
      </div>
    </section>
  );
}
