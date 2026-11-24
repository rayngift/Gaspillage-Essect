import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ExternalLink,
  LocateFixed,
  MapPin,
  Navigation,
  Store,
} from 'lucide-react';
import {
  APIProvider,
  APILoadingStatus,
  AdvancedMarker,
  InfoWindow,
  Map as GoogleMap,
  Pin,
  useAdvancedMarkerRef,
  useApiLoadingStatus,
  useMap,
} from '@vis.gl/react-google-maps';
import type { Offer, Shop } from '../types/campussave';

interface CampusRadarViewProps {
  shops: Shop[];
  offers: Offer[];
  onSelectShopOffers: (shopId: string) => void;
}

interface LatLngPoint {
  lat: number;
  lng: number;
}

interface GeocodePayload {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

interface NormalizedShop {
  id: string;
  name: string;
  category: string;
  address: string;
  fallbackDistanceMeters: number;
  pickupWindow: string;
  storedCoords: LatLngPoint | null;
}

interface PositionedShop extends NormalizedShop {
  position: LatLngPoint | null;
  formattedAddress: string;
  distanceMeters: number;
}

const ESSECT_CAMPUS_ADDRESS = 'ESSECT Montfleury, Tunis, Tunisia';

function extractCoordsFromDoc(raw: Record<string, unknown>): LatLngPoint | null {
  const candidates: Array<[unknown, unknown]> = [
    [raw.lat, raw.lng],
    [raw.latitude, raw.longitude],
    [
      (raw.coordinates as Record<string, unknown> | undefined)?.lat,
      (raw.coordinates as Record<string, unknown> | undefined)?.lng,
    ],
    [
      (raw.location as Record<string, unknown> | undefined)?.latitude,
      (raw.location as Record<string, unknown> | undefined)?.longitude,
    ],
  ];

  for (const [latRaw, lngRaw] of candidates) {
    const lat = Number(latRaw);
    const lng = Number(lngRaw);
    if (
      Number.isFinite(lat) &&
      Number.isFinite(lng) &&
      lat >= -90 &&
      lat <= 90 &&
      lng >= -180 &&
      lng <= 180 &&
      (lat !== 0 || lng !== 0)
    ) {
      return { lat, lng };
    }
  }
  return null;
}

function haversineMeters(a: LatLngPoint, b: LatLngPoint): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const R = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * sinLng * sinLng;
  return Math.round(2 * R * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h)));
}

function MapsStatusMonitor({
  onStatusError,
}: {
  onStatusError: (message: string | null) => void;
}) {
  const status = useApiLoadingStatus();

  useEffect(() => {
    if (status === APILoadingStatus.AUTH_FAILURE) {
      window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
      onStatusError(
        'Authentification Google Maps impossible. Vérifiez la configuration de la clé API.'
      );
    } else if (status === APILoadingStatus.FAILED) {
      onStatusError(
        'Impossible de charger Google Maps Platform. Vérifiez votre connexion réseau.'
      );
    } else {
      onStatusError(null);
    }
  }, [status, onStatusError]);

  return null;
}

function MapCameraController({
  campusCoords,
  shops,
  selectedShop,
  focusRequestTick,
}: {
  campusCoords: LatLngPoint | null;
  shops: PositionedShop[];
  selectedShop: PositionedShop | null;
  focusRequestTick: number;
}) {
  const map = useMap();
  const [hasFittedInitial, setHasFittedInitial] = useState(false);

  useEffect(() => {
    if (!map || hasFittedInitial) return;
    const points: LatLngPoint[] = [];
    if (campusCoords) points.push(campusCoords);
    for (const s of shops) {
      if (s.position) points.push(s.position);
    }
    if (points.length === 0) return;

    if (points.length === 1) {
      map.setCenter(points[0]);
      map.setZoom(16);
      setHasFittedInitial(true);
      return;
    }

    const lats = points.map((p) => p.lat);
    const lngs = points.map((p) => p.lng);
    map.fitBounds(
      {
        north: Math.max(...lats),
        south: Math.min(...lats),
        east: Math.max(...lngs),
        west: Math.min(...lngs),
      },
      64
    );
    setHasFittedInitial(true);
  }, [map, campusCoords, shops, hasFittedInitial]);

  useEffect(() => {
    if (!map || focusRequestTick === 0 || !selectedShop?.position) return;
    map.panTo(selectedShop.position);
    const currentZoom = map.getZoom() ?? 15;
    if (currentZoom < 16) {
      map.setZoom(16);
    }
  }, [map, selectedShop, focusRequestTick]);

  return null;
}

function CampusOriginMarker({ position }: { position: LatLngPoint }) {
  const [markerRef, marker] = useAdvancedMarkerRef();
  const [open, setOpen] = useState(false);

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={position}
        zIndex={500}
        title="Campus ESSECT Montfleury"
        onClick={() => setOpen((prev) => !prev)}
      >
        <div className="px-2.5 py-1 rounded-lg bg-neutral-900 text-white text-[11px] font-bold shadow-md border border-white/80 whitespace-nowrap">
          ESSECT
        </div>
      </AdvancedMarker>
      {open && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={240}
          onCloseClick={() => setOpen(false)}
        >
          <div className="p-1 space-y-1">
            <p className="text-xs font-bold text-neutral-900">
              Campus ESSECT Montfleury
            </p>
            <p className="text-[11px] text-neutral-600">
              ESSECT, Avenue Ali Trad, Montfleury, Tunis
            </p>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

function ShopAdvancedMarker({
  shop,
  basketCount,
  isSelected,
  infoOpen,
  onSelect,
  onCloseInfo,
  onViewOffers,
}: {
  shop: PositionedShop;
  basketCount: number;
  isSelected: boolean;
  infoOpen: boolean;
  onSelect: () => void;
  onCloseInfo: () => void;
  onViewOffers: () => void;
}) {
  const [markerRef, marker] = useAdvancedMarkerRef();

  if (!shop.position) return null;

  const directionsUrl = `https://www.google.com/maps/dir/?api=1&destination=${shop.position.lat},${shop.position.lng}&travelmode=walking`;

  return (
    <>
      <AdvancedMarker
        ref={markerRef}
        position={shop.position}
        zIndex={isSelected ? 1000 : 100 + basketCount}
        title={`${shop.name} · ${shop.address}`}
        onClick={onSelect}
      >
        <Pin
          background={isSelected ? '#166534' : '#ffffff'}
          borderColor="#166534"
          glyphColor={isSelected ? '#ffffff' : '#166534'}
          scale={isSelected ? 1.25 : 1.05}
        >
          <span className="text-[11px] font-mono font-bold">{basketCount}</span>
        </Pin>
      </AdvancedMarker>

      {isSelected && infoOpen && marker && (
        <InfoWindow
          anchor={marker}
          maxWidth={280}
          onCloseClick={onCloseInfo}
        >
          <div className="p-1 space-y-2 min-w-[210px]">
            <div>
              <p className="text-[11px] font-medium text-[#166534]">
                {shop.category} · {shop.distanceMeters} m
              </p>
              <h3 className="text-sm font-bold text-neutral-900 leading-snug">
                {shop.name}
              </h3>
              <p className="text-[11px] text-neutral-600 mt-0.5">
                {shop.formattedAddress}
              </p>
            </div>

            <div className="flex items-center justify-between text-[11px] font-mono text-neutral-700 pt-1 border-t border-neutral-100">
              <span className="font-semibold text-[#166534]">
                {basketCount} panier{basketCount > 1 ? 's' : ''}
              </span>
              <span>{shop.pickupWindow}</span>
            </div>

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                onClick={onViewOffers}
                className="flex-1 px-2.5 py-1.5 bg-[#166534] text-white text-xs font-medium rounded-md hover:bg-[#14532d] cursor-pointer"
              >
                Voir les offres
              </button>
              <a
                href={directionsUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2.5 py-1.5 bg-neutral-100 text-neutral-800 text-xs font-medium rounded-md hover:bg-neutral-200"
                title="Ouvrir l’itinéraire sur Google Maps"
              >
                <ExternalLink className="w-3 h-3" />
                <span>Itinéraire</span>
              </a>
            </div>
          </div>
        </InfoWindow>
      )}
    </>
  );
}

export function CampusRadarView({
  shops,
  offers,
  onSelectShopOffers,
}: CampusRadarViewProps) {
  const [maxRadius, setMaxRadius] = useState<number>(0); // 0 = show all partners
  const [selectedShopId, setSelectedShopId] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState<boolean>(true);
  const [focusRequestTick, setFocusRequestTick] = useState<number>(0);

  const [apiKey, setApiKey] = useState<string>(
    () => (import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim() || ''
  );
  const [configLoaded, setConfigLoaded] = useState<boolean>(
    () => Boolean((import.meta.env.VITE_GOOGLE_MAPS_API_KEY as string | undefined)?.trim())
  );
  const [mapStatusError, setMapStatusError] = useState<string | null>(null);

  const [campusCoords, setCampusCoords] = useState<LatLngPoint | null>(null);
  const [geocodedByKey, setGeocodedByKey] = useState<Record<string, GeocodePayload | null>>({});
  const [geocodingLoading, setGeocodingLoading] = useState<boolean>(false);
  const [geocodeError, setGeocodeError] = useState<string | null>(null);

  // Resolve Google Maps key via server endpoint if not embedded in Vite build env
  useEffect(() => {
    if (apiKey) {
      setConfigLoaded(true);
      return;
    }
    let cancelled = false;
    fetch('/api/maps/config')
      .then((res) => res.json())
      .then((data: { apiKey?: string }) => {
        if (!cancelled) {
          setApiKey((data.apiKey || '').trim());
          setConfigLoaded(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setConfigLoaded(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [apiKey]);

  // Normalize shops from Firestore (supports both web & mobile field shapes)
  const normalizedShops = useMemo<NormalizedShop[]>(() => {
    const validShops = shops.filter(
      (s) => s.status !== 'rejected' && s.status !== 'pending'
    );

    if (validShops.length > 0) {
      return validShops.map((s, idx) => {
        const raw = s as unknown as Record<string, unknown>;
        const rawDist = Number(raw.distanceMeters ?? raw.distance ?? 150);
        return {
          id: s.id || `shop_${idx}`,
          name: String(raw.name || raw.shopName || 'Commerce partenaire'),
          category: String(raw.category || 'Commerce'),
          address: String(raw.address || 'Montfleury, Tunis'),
          fallbackDistanceMeters:
            Number.isFinite(rawDist) && rawDist > 0 ? rawDist : 150,
          pickupWindow: String(raw.pickupWindow || '16h00 - 19h00'),
          storedCoords: extractCoordsFromDoc(raw),
        };
      });
    }

    // Fallback: derive partner shops from active offers if shops collection is empty
    const derived = new window.Map<string, NormalizedShop>();
    let idx = 0;
    for (const offer of offers) {
      if (offer.active === false) continue;
      const raw = offer as unknown as Record<string, unknown>;
      const sid = offer.shopId || offer.shopName || `derived_${idx}`;
      if (!derived.has(sid)) {
        derived.set(sid, {
          id: sid,
          name: offer.shopName || 'Commerce partenaire',
          category: offer.shopCategory || 'Commerce',
          address: String(raw.address || raw.shopAddress || 'Montfleury, Tunis'),
          fallbackDistanceMeters:
            Number.isFinite(Number(offer.distanceMeters)) &&
            Number(offer.distanceMeters) > 0
              ? Number(offer.distanceMeters)
              : 180 + idx * 90,
          pickupWindow: offer.pickupWindow || '16h00 - 19h00',
          storedCoords: extractCoordsFromDoc(raw),
        });
        idx++;
      }
    }
    return Array.from(derived.values());
  }, [shops, offers]);

  // Geocode ESSECT campus & Firestore shop addresses via backend proxy (CF1)
  useEffect(() => {
    if (!configLoaded) return;

    const pendingRequests: Array<{ id: string; address: string }> = [];
    if (!campusCoords && geocodedByKey['__essect_campus__'] === undefined) {
      pendingRequests.push({
        id: '__essect_campus__',
        address: ESSECT_CAMPUS_ADDRESS,
      });
    }

    for (const shop of normalizedShops) {
      if (shop.storedCoords) continue;
      const cacheKey = `${shop.id}::${shop.address.trim().toLowerCase()}`;
      if (geocodedByKey[cacheKey] === undefined && shop.address.trim().length >= 2) {
        pendingRequests.push({
          id: cacheKey,
          address: shop.address,
        });
      }
    }

    if (pendingRequests.length === 0) return;

    let cancelled = false;
    setGeocodingLoading(true);
    setGeocodeError(null);

    fetch('/api/maps/geocode', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ addresses: pendingRequests.slice(0, 50) }),
    })
      .then(async (res) => {
        const payload = (await res.json().catch(() => null)) as {
          results?: Record<string, GeocodePayload | null>;
          error?: { status?: string; message?: string };
        } | null;

        if (
          res.status === 429 ||
          payload?.error?.status === 'RESOURCE_EXHAUSTED'
        ) {
          window.dispatchEvent(new CustomEvent('gmp-quota-exceeded'));
          throw new Error('Quota Google Maps Platform dépassé pour le géocodage.');
        }

        if (!res.ok) {
          throw new Error(
            payload?.error?.message ||
              'Impossible de géocoder les adresses Firestore.'
          );
        }

        return payload?.results || {};
      })
      .then((results) => {
        if (cancelled) return;
        const campusGeo = results['__essect_campus__'];
        if (campusGeo) {
          setCampusCoords({ lat: campusGeo.lat, lng: campusGeo.lng });
        }
        setGeocodedByKey((prev) => ({
          ...prev,
          ...results,
        }));
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setGeocodeError(
          err instanceof Error
            ? err.message
            : 'Erreur lors du géocodage des adresses.'
        );
      })
      .finally(() => {
        if (!cancelled) setGeocodingLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [configLoaded, normalizedShops, campusCoords, geocodedByKey]);

  const positionedShops = useMemo<PositionedShop[]>(() => {
    return normalizedShops.map((shop) => {
      const cacheKey = `${shop.id}::${shop.address.trim().toLowerCase()}`;
      const geo = geocodedByKey[cacheKey] ?? null;
      const position = shop.storedCoords
        ? shop.storedCoords
        : geo
          ? { lat: geo.lat, lng: geo.lng }
          : null;

      const distanceMeters =
        position && campusCoords
          ? Math.max(10, haversineMeters(campusCoords, position))
          : shop.fallbackDistanceMeters;

      return {
        ...shop,
        position,
        formattedAddress: geo?.formattedAddress || shop.address,
        distanceMeters,
      };
    });
  }, [normalizedShops, geocodedByKey, campusCoords]);

  const visibleShops = useMemo(() => {
    const filtered =
      maxRadius === 0
        ? positionedShops
        : positionedShops.filter((s) => s.distanceMeters <= maxRadius);
    return [...filtered].sort((a, b) => a.distanceMeters - b.distanceMeters);
  }, [positionedShops, maxRadius]);

  const basketCountsByShop = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const offer of offers) {
      const qty = Number(offer.quantityAvailable ?? 0);
      if (offer.active !== false && qty > 0) {
        const key = offer.shopId || offer.shopName;
        if (key) {
          counts[key] = (counts[key] || 0) + qty;
        }
      }
    }
    return counts;
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

  const initialMapCenter = useMemo<LatLngPoint | null>(() => {
    if (campusCoords) return campusCoords;
    const firstPositioned = positionedShops.find((s) => s.position !== null);
    return firstPositioned?.position ?? null;
  }, [campusCoords, positionedShops]);

  const handleSelectAndCenter = useCallback((shopId: string) => {
    setSelectedShopId(shopId);
    setInfoOpen(true);
    setFocusRequestTick((t) => t + 1);
  }, []);

  const mappedCount = visibleShops.filter((s) => s.position !== null).length;

  return (
    <section className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-4">
        <div>
          <p className="text-xs font-medium text-[#166534] mb-1">
            Campus Radar · Carte Google Maps · Adresses Firestore
          </p>
          <h2 className="text-2xl sm:text-3xl font-bold tracking-tight text-neutral-900">
            Commerces partenaires autour de l’ESSECT
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-2 bg-white border border-neutral-200 rounded-xl p-1.5 shrink-0">
          {[
            { value: 0, label: 'Tous' },
            { value: 500, label: '500 m' },
            { value: 1000, label: '1 km' },
            { value: 2500, label: '2.5 km' },
            { value: 5000, label: '5 km' },
          ].map((opt) => {
            const active = maxRadius === opt.value;
            return (
              <button
                key={opt.value}
                type="button"
                onClick={() => setMaxRadius(opt.value)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-[#166534] text-white'
                    : 'text-neutral-600 hover:bg-neutral-100 hover:text-neutral-900'
                }`}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      </div>

      {(geocodeError || mapStatusError) && (
        <div className="p-3.5 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900">
          {mapStatusError || geocodeError}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Interactive Google Map */}
        <div className="lg:col-span-7 bg-white border border-neutral-200 rounded-2xl p-4 sm:p-5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600">
            <span className="inline-flex items-center gap-1.5 text-[#166534] font-medium">
              <Navigation className="w-3.5 h-3.5" />
              ESSECT Montfleury · Géolocalisation en direct
            </span>
            <span className="font-mono tabular-nums text-neutral-500">
              {geocodingLoading
                ? 'Géocodage des adresses...'
                : `${mappedCount}/${visibleShops.length} commerce${visibleShops.length > 1 ? 's' : ''} localisé${mappedCount > 1 ? 's' : ''}`}
            </span>
          </div>

          <div className="w-full h-[460px] sm:h-[520px] rounded-xl overflow-hidden border border-neutral-200 bg-neutral-100 relative">
            {!configLoaded ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-neutral-500">
                Initialisation de Google Maps Platform...
              </div>
            ) : !apiKey ? (
              <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center space-y-2">
                <MapPin className="w-7 h-7 text-neutral-400" />
                <p className="text-sm font-semibold text-neutral-800">
                  Clé Google Maps API requise
                </p>
                <p className="text-xs text-neutral-500 max-w-md">
                  Configurez votre clé Google Maps Platform dans les paramètres du projet pour afficher la carte interactive.
                </p>
              </div>
            ) : !initialMapCenter ? (
              <div className="w-full h-full flex items-center justify-center text-sm text-neutral-500">
                {geocodingLoading
                  ? 'Localisation des adresses Firestore sur Google Maps...'
                  : 'Aucune coordonnée disponible pour les adresses actuelles.'}
              </div>
            ) : (
              <APIProvider
                apiKey={apiKey}
                libraries={['marker']}
                language="fr"
                region="TN"
              >
                <MapsStatusMonitor onStatusError={setMapStatusError} />
                <GoogleMap
                  mapId="DEMO_MAP_ID"
                  defaultCenter={initialMapCenter}
                  defaultZoom={15}
                  gestureHandling="greedy"
                  streetViewControl={false}
                  mapTypeControl={false}
                  internalUsageAttributionIds={['gmp_mcp_codeassist_v1_aistudio']}
                  className="w-full h-full"
                >
                  <MapCameraController
                    campusCoords={campusCoords}
                    shops={visibleShops}
                    selectedShop={selectedShop}
                    focusRequestTick={focusRequestTick}
                  />

                  {campusCoords && <CampusOriginMarker position={campusCoords} />}

                  {visibleShops.map((shop) => {
                    const count =
                      basketCountsByShop[shop.id] ??
                      basketCountsByShop[shop.name] ??
                      0;
                    const isSelected = shop.id === activeSelectedId;
                    return (
                      <ShopAdvancedMarker
                        key={shop.id}
                        shop={shop}
                        basketCount={count}
                        isSelected={isSelected}
                        infoOpen={infoOpen}
                        onSelect={() => {
                          setSelectedShopId(shop.id);
                          setInfoOpen(true);
                        }}
                        onCloseInfo={() => setInfoOpen(false)}
                        onViewOffers={() => onSelectShopOffers(shop.id)}
                      />
                    );
                  })}
                </GoogleMap>
              </APIProvider>
            )}
          </div>

          {selectedShop && (
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-neutral-600 pt-1">
              <span>
                Sélection : <strong className="text-neutral-900">{selectedShop.name}</strong> ·{' '}
                {selectedShop.formattedAddress}
              </span>
              <span className="font-mono tabular-nums text-neutral-500">
                {selectedShop.distanceMeters} m · Retrait {selectedShop.pickupWindow}
              </span>
            </div>
          )}
        </div>

        {/* Right Shop Cards List */}
        <div className="lg:col-span-5 space-y-3.5 max-h-[600px] overflow-y-auto pr-1">
          {visibleShops.length === 0 ? (
            <div className="bg-white border border-neutral-200 rounded-2xl p-6 text-center text-sm text-neutral-500">
              Aucun commerce trouvé dans ce rayon. Sélectionnez « Tous » ou élargissez la distance.
            </div>
          ) : (
            visibleShops.map((shop) => {
              const isSelected = shop.id === activeSelectedId;
              const basketCount =
                basketCountsByShop[shop.id] ??
                basketCountsByShop[shop.name] ??
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
                      {!shop.position && !geocodingLoading && (
                        <p className="text-[11px] text-amber-700">
                          Adresse non géolocalisée sur Google Maps
                        </p>
                      )}
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
                      disabled={!shop.position}
                      onClick={() => handleSelectAndCenter(shop.id)}
                      className="inline-flex items-center gap-1.5 text-xs font-medium text-neutral-600 hover:text-neutral-900 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer whitespace-nowrap"
                    >
                      <LocateFixed className="w-3.5 h-3.5" />
                      <span>Centrer sur la carte</span>
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
