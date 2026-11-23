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

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '64kb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({
      status: 'ok',
      service: 'CampusSave ESSECT REST API',
      konnectMode: process.env.KONNECT_API_KEY ? 'live-sandbox' : 'local-test-mode',
      timestamp: new Date().toISOString(),
    });
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
