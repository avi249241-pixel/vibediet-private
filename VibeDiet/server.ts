import 'dotenv/config';
import './src/config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { v1Router } from './src/routes/v1.js';
import { mockDb } from './src/lib/mockFirestore.js';
import { isUsingRealFirestore } from './src/lib/dataStore.js';
import { env } from './src/config/env.js';
import { helmetSecurityMiddleware, originGate } from './src/middleware/security.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);

  // 1. Hardened Helmet Security Headers & Content Security Policy
  app.use(helmetSecurityMiddleware);

  // 2. Strict CORS Origin Whitelist & Origin Gate
  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://127.0.0.1:3000', 'http://localhost:3000'];

  app.use(
    cors((req, callback) => {
      const origin = req.headers.origin;
      if (!origin) {
        return callback(null, { origin: true, credentials: true });
      }

      const host = req.headers.host;
      const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;

      const isHostMatch =
        Boolean(host && (origin === `http://${host}` || origin === `https://${host}`)) ||
        Boolean(forwardedHost && (origin === `http://${forwardedHost}` || origin === `https://${forwardedHost}`));

      const isCloudflareTunnel = Boolean(origin && origin.endsWith('.trycloudflare.com'));

      if (allowedOrigins.includes(origin) || isHostMatch || isCloudflareTunnel) {
        callback(null, { origin: true, credentials: true });
      } else {
        callback(new Error('CORS origin not allowed by VibeDiet security shield'));
      }
    })
  );
  app.use(originGate);

  // 3. Payload Size Hardening: 500kb exclusively for /v1/drafts, 100kb for everything else
  app.use((req, res, next) => {
    if (req.path.startsWith('/v1/drafts') && req.method === 'POST') {
      express.json({ limit: '500kb' })(req, res, next);
    } else {
      express.json({ limit: '100kb' })(req, res, next);
    }
  });

  // 4. Rate Limiting: 15 scans / 15m on drafts, 120 req / 15m general API
  const shouldSkipRateLimit = (req: any) => {
    if (env.NODE_ENV === 'test' || process.env.PLAYWRIGHT === '1') return true;
    const ip = req.ip || req.socket?.remoteAddress || '';
    return (
      ip === '127.0.0.1' ||
      ip === '::1' ||
      ip === '::ffff:127.0.0.1' ||
      req.hostname === '127.0.0.1' ||
      req.hostname === 'localhost'
    );
  };

  const standardApiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 120,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: {
      error: 'Too many requests to VibeDiet API, please try again in 15 minutes',
      code: 'API_RATE_LIMIT_EXCEEDED',
    },
  });

  const draftsQuotaLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 15,
    standardHeaders: true,
    legacyHeaders: false,
    skip: shouldSkipRateLimit,
    message: {
      error: 'Gemini vision draft scan quota exceeded (maximum 15 scans per 15 minutes)',
      code: 'DRAFTS_QUOTA_EXCEEDED',
    },
  });

  // 9.1 System Diagnostics
  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', service: 'vibediet-backend', timestamp: new Date().toISOString() });
  });

  app.get('/ready', (_req, res) => {
    if (typeof (global as any).gc === 'function') {
      try {
        (global as any).gc();
      } catch {}
    }
    const mem = process.memoryUsage();
    const isFirestore = isUsingRealFirestore();
    const bucket = mockDb.getUserBucket('demo-user-uid');

    res.json({
      status: 'ready',
      database: isFirestore ? 'connected' : bucket ? 'connected' : 'degraded',
      persistence: isFirestore ? 'cloud-firestore' : 'in-memory-mock',
      uptimeSeconds: Math.round(process.uptime()),
      memoryRssMb: Number((mem.rss / 1024 / 1024).toFixed(2)),
    });
  });

  app.get('/version', (_req, res) => {
    res.json({
      version: '2.1.0',
      tag: 'phase-production-ready',
      commit: '8982499',
      environment: env.NODE_ENV,
      persistence: isUsingRealFirestore() ? 'cloud-firestore' : 'in-memory-mock',
      models: {
        vision: 'gemini-2.5-flash',
        fast: 'gemini-2.5-flash',
      },
    });
  });

  // Mount rate-limited v1 API routes
  app.use('/v1/drafts', draftsQuotaLimiter);
  app.use('/v1', standardApiLimiter);
  app.use('/v1', v1Router);

  // Dist directory path for static assets
  const distPath = path.join(__dirname, 'dist');

  // Helper to serve the React SPA index.html
  const sendSpaIndex = (_req: express.Request, res: express.Response) => {
    const indexPath = path.join(distPath, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.sendFile(indexPath);
    } else {
      const offlinePath = path.join(distPath, 'VibeDiet-App.html');
      if (fs.existsSync(offlinePath)) {
        res.sendFile(offlinePath);
      } else {
        res.status(404).send('VibeDiet bundle not found. Please run npm run build.');
      }
    }
  };

  // Explicit Zero-Blank-Screen Offline Standalone PWA route
  app.get(['/offline', '/standalone', '/VibeDiet-App.html', '/app.html'], (_req, res) => {
    const offlinePath = path.join(distPath, 'VibeDiet-App.html');
    if (fs.existsSync(offlinePath)) {
      res.setHeader('Cache-Control', 'public, max-age=3600');
      res.sendFile(offlinePath);
    } else {
      sendSpaIndex(_req, res);
    }
  });

  // Intercept /admin.html explicitly BEFORE static serving to ensure SPA entry point is served
  app.get(['/admin.html', '/admin/admin.html'], (req, res) => {
    sendSpaIndex(req, res);
  });

  // 1. Serve static assets: { redirect: false, index: false } prevents 301 redirects on /admin
  // and ensures JS/CSS bundles under /admin/assets resolve cleanly
  app.use('/admin', express.static(distPath, { redirect: false, index: false }));
  app.use(express.static(distPath));

  // 2. Admin Cockpit route — serve SPA entry point
  app.get(['/admin', '/admin/', '/admin/*'], (req, res) => {
    sendSpaIndex(req, res);
  });

  // SPA Fallback: non-API GET requests serve the compiled index.html or offline standalone
  app.get('*', (req, res, next) => {
    if (
      req.path.startsWith('/v1') ||
      req.path.startsWith('/health') ||
      req.path.startsWith('/ready') ||
      req.path.startsWith('/version')
    ) {
      return next();
    }
    sendSpaIndex(req, res);
  });

  // 5. Global Secure Express Error Handler (Never leaks stack traces in production)
  app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
    if (err.type === 'entity.too.large') {
      res.status(413).json({
        error: 'Payload Too Large: Maximum allowed payload is 100 KB (500 KB for photo drafts)',
        code: 'PAYLOAD_TOO_LARGE',
      });
      return;
    }
    if (err.message && err.message.includes('CORS origin not allowed')) {
      res.status(403).json({
        error: 'Forbidden: CORS origin denied',
        code: 'CORS_FORBIDDEN',
      });
      return;
    }

    console.error('[VibeDiet Error]', err.message || err);
    const status = err.status || 500;
    res.status(status).json({
      error:
        env.NODE_ENV === 'production'
          ? 'Internal server error'
          : err.message || 'Internal server error',
      code: err.code || 'INTERNAL_SERVER_ERROR',
    });
  });

  return app;
}

const isDirectRun = process.argv[1] && path.resolve(process.argv[1]) === path.resolve(__filename);
if (isDirectRun) {
  const port = env.PORT;
  const app = createApp();
  app.listen(port, '127.0.0.1', () => {
    const rssMb = (process.memoryUsage().rss / 1024 / 1024).toFixed(1);
    const persistenceMode = isUsingRealFirestore() ? 'Cloud Firestore' : 'In-Memory Mock';
    console.log(
      `[VibeDiet v2.0.0] Server listening on http://127.0.0.1:${port} (RSS: ${rssMb} MB | Persistence: ${persistenceMode})`
    );
  });
}
