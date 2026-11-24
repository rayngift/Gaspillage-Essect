import express from 'express';
import type { Request, Response } from 'express';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import dotenv from 'dotenv';

dotenv.config();

const PORT = 3000;
const isProduction = process.env.NODE_ENV === 'production';

interface KonnectSession {
  paymentRef: string;
  offerId: string;
  offerTitle: string;
  amountMillimes: number;
  paymentMethod: 'konnect_wallet' | 'konnect_card' | 'edinar_jeune';
  status: 'pending' | 'completed';
  createdAt: string;
  paidAt?: string;
}

const konnectSessions = new Map<string, KonnectSession>();

interface GeocodeResultPayload {
  lat: number;
  lng: number;
  formattedAddress: string;
  placeId?: string;
}

const geocodeCache = new Map<
  string,
  { value: GeocodeResultPayload | null; expiresAt: number }
>();

function getGoogleMapsKey(): string {
  return (
    process.env.GOOGLE_MAPS_API_KEY ||
    process.env.VITE_GOOGLE_MAPS_API_KEY ||
    ''
  ).trim();
}

function normalizeTunisAddress(raw: string): string {
  const cleaned = raw.trim().slice(0, 200);
  if (/(tunis|tunisie|tunisia)/i.test(cleaned)) {
    return cleaned;
  }
  return `${cleaned}, Tunis, Tunisia`;
}

async function geocodeSingleAddress(
  rawAddress: string,
  apiKey: string
): Promise<{ result: GeocodeResultPayload | null; quotaExceeded?: boolean }> {
  const queryAddress = normalizeTunisAddress(rawAddress);
  const cacheKey = queryAddress.toLowerCase();
  const cached = geocodeCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return { result: cached.value };
  }

  // Primary: Geocoding API v4
  const encodedAddr = encodeURIComponent(queryAddress);
  const v4Url =
    `https://geocode.googleapis.com/v4/geocode/address/${encodedAddr}` +
    `?regionCode=tn&languageCode=fr` +
    `&locationBias.rectangle.low.latitude=36.73` +
    `&locationBias.rectangle.low.longitude=10.10` +
    `&locationBias.rectangle.high.latitude=36.86` +
    `&locationBias.rectangle.high.longitude=10.26`;

  try {
    const v4Res = await fetch(v4Url, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'results.placeId,results.location,results.formattedAddress',
        'X-Goog-Maps-Solution-ID': 'gmp_mcp_codeassist_v1_aistudio',
      },
    });

    if (v4Res.status === 429) {
      return { result: null, quotaExceeded: true };
    }

    if (v4Res.ok) {
      const v4Data = (await v4Res.json()) as {
        results?: Array<{
          placeId?: string;
          formattedAddress?: string;
          location?: { latitude?: number; longitude?: number };
        }>;
        error?: { status?: string };
      };
      if (v4Data.error?.status === 'RESOURCE_EXHAUSTED') {
        return { result: null, quotaExceeded: true };
      }
      const first = v4Data.results?.[0];
      if (
        first?.location &&
        typeof first.location.latitude === 'number' &&
        typeof first.location.longitude === 'number'
      ) {
        const value: GeocodeResultPayload = {
          lat: first.location.latitude,
          lng: first.location.longitude,
          formattedAddress: first.formattedAddress || rawAddress,
          placeId: first.placeId,
        };
        geocodeCache.set(cacheKey, {
          value,
          expiresAt: Date.now() + 24 * 60 * 60 * 1000,
        });
        return { result: value };
      }
    } else {
      const errBody = (await v4Res.json().catch(() => null)) as {
        error?: { status?: string };
      } | null;
      if (errBody?.error?.status === 'RESOURCE_EXHAUSTED') {
        return { result: null, quotaExceeded: true };
      }
    }
  } catch {
    // Fall through to standard Geocoding endpoint
  }

  // Fallback: Standard Geocoding REST endpoint
  try {
    const legacyUrl =
      `https://maps.googleapis.com/maps/api/geocode/json` +
      `?address=${encodeURIComponent(queryAddress)}` +
      `&region=tn&language=fr&bounds=36.73,10.10|36.86,10.26` +
      `&key=${encodeURIComponent(apiKey)}`;
    const res = await fetch(legacyUrl);
    if (res.status === 429) {
      return { result: null, quotaExceeded: true };
    }
    const data = (await res.json()) as {
      status?: string;
      results?: Array<{
        place_id?: string;
        formatted_address?: string;
        geometry?: { location?: { lat?: number; lng?: number } };
      }>;
    };
    if (data.status === 'OVER_QUERY_LIMIT') {
      return { result: null, quotaExceeded: true };
    }
    const first = data.results?.[0];
    const loc = first?.geometry?.location;
    if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
      const value: GeocodeResultPayload = {
        lat: loc.lat,
        lng: loc.lng,
        formattedAddress: first?.formatted_address || rawAddress,
        placeId: first?.place_id,
      };
      geocodeCache.set(cacheKey, {
        value,
        expiresAt: Date.now() + 24 * 60 * 60 * 1000,
      });
      return { result: value };
    }
  } catch {
    // Return null below
  }

  if (geocodeCache.size > 500) {
    const oldest = geocodeCache.keys().next().value;
    if (oldest) geocodeCache.delete(oldest);
  }
  return { result: null };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'CampusSave ESSECT REST API',
      konnectMode: process.env.KONNECT_API_KEY ? 'live-sandbox' : 'local-test-mode',
      mapsConfigured: Boolean(getGoogleMapsKey()),
      timestamp: new Date().toISOString(),
    });
  });

  app.get('/api/maps/config', (_req: Request, res: Response) => {
    const apiKey = getGoogleMapsKey();
    res.json({ apiKey });
  });

  app.post('/api/maps/geocode', async (req: Request, res: Response) => {
    const apiKey = getGoogleMapsKey();
    if (!apiKey) {
      res.status(503).json({
        error: { status: 'UNAVAILABLE', message: 'Google Maps API key not configured.' },
      });
      return;
    }

    const body = req.body as Record<string, unknown> | undefined;
    const rawItems = body && Array.isArray(body.addresses) ? body.addresses : null;
    if (!rawItems || rawItems.length === 0 || rawItems.length > 50) {
      res.status(400).json({ error: 'Liste d’adresses invalide (1 à 50 éléments).' });
      return;
    }

    const results: Record<string, GeocodeResultPayload | null> = {};

    for (const item of rawItems) {
      if (!item || typeof item !== 'object') continue;
      const obj = item as Record<string, unknown>;
      const id = typeof obj.id === 'string' ? obj.id.trim().slice(0, 128) : '';
      const address = typeof obj.address === 'string' ? obj.address.trim().slice(0, 200) : '';
      if (!id || address.length < 2) continue;

      const geo = await geocodeSingleAddress(address, apiKey);
      if (geo.quotaExceeded) {
        res.status(429).json({
          error: {
            status: 'RESOURCE_EXHAUSTED',
            message: 'Quota Google Maps Platform dépassé.',
          },
        });
        return;
      }
      results[id] = geo.result;
    }

    res.json({ results });
  });

  app.post('/api/konnect/init-payment', async (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    if (!body || typeof body !== 'object') {
      res.status(400).json({ error: 'Corps de requête invalide.' });
      return;
    }

    const offerId = typeof body.offerId === 'string' ? body.offerId.trim() : '';
    const offerTitle = typeof body.offerTitle === 'string' ? body.offerTitle.trim() : '';
    const amountTnd = typeof body.amountTnd === 'number' ? body.amountTnd : Number(body.amountTnd);
    const paymentMethod = body.paymentMethod;

    if (!offerId || offerId.length > 128 || !/^[a-zA-Z0-9_-]+$/.test(offerId)) {
      res.status(400).json({ error: 'Identifiant offre invalide.' });
      return;
    }

    if (!offerTitle || offerTitle.length > 120) {
      res.status(400).json({ error: 'Titre offre invalide.' });
      return;
    }

    if (!Number.isFinite(amountTnd) || amountTnd <= 0 || amountTnd > 5000) {
      res.status(400).json({ error: 'Montant TND invalide.' });
      return;
    }

    if (
      paymentMethod !== 'konnect_wallet' &&
      paymentMethod !== 'konnect_card' &&
      paymentMethod !== 'edinar_jeune'
    ) {
      res.status(400).json({ error: 'Méthode de paiement Konnect non reconnue.' });
      return;
    }

    const amountMillimes = Math.round(amountTnd * 1000);
    const paymentRef = `KNT-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;

    const session: KonnectSession = {
      paymentRef,
      offerId,
      offerTitle,
      amountMillimes,
      paymentMethod,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    konnectSessions.set(paymentRef, session);

    if (konnectSessions.size > 500) {
      const oldestKey = konnectSessions.keys().next().value;
      if (oldestKey) {
        konnectSessions.delete(oldestKey);
      }
    }

    res.json({
      paymentRef,
      amountMillimes,
      currency: 'TND',
      mode: 'test',
      gateway: 'Konnect Sandbox',
      status: 'pending',
    });
  });

  app.post('/api/konnect/verify-payment', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const paymentRef = body && typeof body.paymentRef === 'string' ? body.paymentRef.trim() : '';

    if (!paymentRef || !/^KNT-[A-F0-9]{8}$/.test(paymentRef)) {
      res.status(400).json({ error: 'Référence de paiement Konnect invalide.' });
      return;
    }

    const session = konnectSessions.get(paymentRef);
    if (!session) {
      res.status(404).json({ error: 'Session de paiement introuvable.' });
      return;
    }

    session.status = 'completed';
    session.paidAt = new Date().toISOString();

    res.json({
      verified: true,
      paymentRef: session.paymentRef,
      amountMillimes: session.amountMillimes,
      paymentMethod: session.paymentMethod,
      status: 'completed',
      paidAt: session.paidAt,
    });
  });

  app.post('/api/qr/verify-token', (req: Request, res: Response) => {
    const body = req.body as Record<string, unknown> | undefined;
    const qrCodeValue = body && typeof body.qrCodeValue === 'string' ? body.qrCodeValue.trim() : '';

    if (!qrCodeValue || qrCodeValue.length > 120 || !/^CS-ESSECT-[A-Z0-9-]+$/.test(qrCodeValue)) {
      res.status(400).json({ valid: false, error: 'Format de QR Code CampusSave invalide.' });
      return;
    }

    res.json({
      valid: true,
      qrCodeValue,
      campus: 'ESSECT Montfleury',
      checkedAt: new Date().toISOString(),
    });
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distPath, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build introuvable.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`CampusSave ESSECT server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
