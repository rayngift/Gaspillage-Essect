import { useEffect, useState } from 'react';
import { Utensils } from 'lucide-react';
import { getCategoryFallbackImage } from '../data/essectSeed';
import type { Offer } from '../types/campussave';

interface OfferCardProps {
  offer: Offer;
  onReserve: (offer: Offer) => void;
}

function extractRawOfferImage(offer: Offer): string | null {
  const record = offer as unknown as Record<string, unknown>;
  const candidates = [
    record.imageUrl,
    record.imageURL,
    record.photoUrl,
    record.photoURL,
    record.image,
    record.photo,
    record.image_url,
    record.photo_url,
    record.imgUrl,
    record.img,
    record.picture,
    record.thumbnail,
    record.url,
  ];

  for (const candidate of candidates) {
    if (typeof candidate === 'string') {
      const trimmed = candidate.trim();
      if (
        trimmed.startsWith('http://') ||
        trimmed.startsWith('https://') ||
        trimmed.startsWith('data:image/') ||
        trimmed.startsWith('/src/assets/') ||
        trimmed.startsWith('/assets/')
      ) {
        return trimmed;
      }
    }
  }
  return null;
}

export function OfferCard({ offer, onReserve }: OfferCardProps) {
  const primaryImage = extractRawOfferImage(offer);
  const categoryFallback = getCategoryFallbackImage(offer.category, offer.title);

  const [imgSrc, setImgSrc] = useState<string>(primaryImage || categoryFallback);
  const [imgFailed, setImgFailed] = useState(false);

  useEffect(() => {
    setImgSrc(primaryImage || categoryFallback);
    setImgFailed(false);
  }, [primaryImage, categoryFallback]);

  const originalPrice = Number(offer.originalPrice) || 0;
  const discountedPrice = Number(offer.discountedPrice) || 0;
  const discountPct =
    originalPrice > 0
      ? Math.round(((originalPrice - discountedPrice) / originalPrice) * 100)
      : 0;
  const soldOut = (offer.quantityAvailable ?? 0) <= 0;

  const handleImageError = () => {
    if (imgSrc !== categoryFallback) {
      setImgSrc(categoryFallback);
    } else {
      setImgFailed(true);
    }
  };

  return (
    <article className="bg-white border border-neutral-200/90 rounded-xl overflow-hidden flex flex-col transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md">
      <div className="aspect-[16/10] w-full bg-neutral-100 overflow-hidden">
        {!imgFailed && imgSrc ? (
          <img
            src={imgSrc}
            alt={offer.title}
            referrerPolicy="no-referrer"
            onError={handleImageError}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-[#166534]/10 via-neutral-100 to-neutral-200 text-neutral-700">
            <Utensils className="w-8 h-8 text-[#166534] mb-2" />
            <span className="text-xs font-medium text-center">{offer.title}</span>
          </div>
        )}
      </div>

      <div className="p-5 flex-1 flex flex-col justify-between gap-3">
        <div className="space-y-1">
          {(offer.shopName || offer.category) && (
            <p className="text-xs text-neutral-500 flex items-center gap-1.5 truncate">
              {offer.shopName && <span className="truncate">{offer.shopName}</span>}
              {offer.shopName && offer.category && <span aria-hidden="true">·</span>}
              {offer.category && <span className="shrink-0">{offer.category}</span>}
            </p>
          )}

          <h3 className="text-[17px] font-bold text-neutral-900 leading-snug line-clamp-1 pt-0.5">
            {offer.title}
          </h3>

          {offer.description && (
            <p className="text-[13px] text-neutral-600 leading-snug line-clamp-2">
              {offer.description}
            </p>
          )}
        </div>

        <div className="space-y-3 pt-1">
          <p className="text-xs text-neutral-500 tabular-nums">
            {offer.pickupWindow && (
              <>
                Retrait {offer.pickupWindow} <span aria-hidden="true">·</span>{' '}
              </>
            )}
            <span className={soldOut ? 'text-red-600 font-medium' : 'text-neutral-500'}>
              {soldOut
                ? 'Épuisé'
                : offer._stockField !== null
                  ? `${offer.quantityAvailable} dispo`
                  : 'Disponible'}
            </span>
          </p>

          <div className="flex items-center justify-between gap-3">
            <div className="flex items-baseline gap-2 min-w-0">
              <span className="text-xl font-bold tabular-nums text-[#166534] whitespace-nowrap">
                {discountedPrice.toFixed(2)} TND
              </span>
              {originalPrice > discountedPrice && (
                <span className="text-xs tabular-nums text-neutral-400 line-through whitespace-nowrap">
                  {originalPrice.toFixed(2)} TND
                </span>
              )}
              {discountPct > 0 && (
                <span className="text-xs font-semibold tabular-nums text-[#c2410c] whitespace-nowrap">
                  -{discountPct}%
                </span>
              )}
            </div>

            <button
              type="button"
              disabled={soldOut}
              onClick={() => onReserve(offer)}
              className="px-5 py-2.5 text-xs font-semibold text-white bg-[#166534] rounded-lg hover:bg-[#14532d] disabled:bg-neutral-300 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-[#166534]"
            >
              {soldOut ? 'Complet' : 'Réserver'}
            </button>
          </div>
        </div>
      </div>
    </article>
  );
}
