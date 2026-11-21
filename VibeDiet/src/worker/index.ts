import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './env.js';
import { healthRouter } from './routes/health.js';
import { syncRouter } from './routes/sync.js';
import { adminRouter } from './routes/admin.js';
import { billingRouter } from './routes/billing.js';
import v1Handler from '../../netlify/functions/v1.mts';

export const app = new Hono<{ Bindings: Bindings }>();

// Enable CORS with restricted origin policy
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return '*';
      const appOrigin = (c.env as Bindings | undefined)?.APP_ORIGIN as string | undefined;
      if (appOrigin && origin === appOrigin) return origin;
      if (/^https?:\/\/localhost(:\d+)?$/.test(origin)) return origin;
      if (/^https?:\/\/127\.0\.0\.1(:\d+)?$/.test(origin)) return origin;
      if (/^https:\/\/[a-zA-Z0-9-]+\.workers\.dev$/.test(origin)) return origin;
      return undefined;
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowHeaders: ['Content-Type', 'Authorization', 'X-Razorpay-Signature', 'X-Requested-With'],
  })
);

// Mount modular sub-routers
app.route('/v1/health', healthRouter);
app.route('/v1/sync', syncRouter);
app.route('/v1/admin', adminRouter);
app.route('/v1/billing', billingRouter);

// Delegate remaining /v1/* routes to the shared Netlify serverless handler
app.all('/v1/*', async (c) => {
  try {
    return await v1Handler(c.req.raw, { env: c.env });
  } catch (err: any) {
    console.error('[Worker] /v1/* route error:', err);
    return c.json({ error: 'Internal Server Error' }, 500);
  }
});

// Serve static SPA assets with Worker fallback
app.all('*', async (c) => {
  if (c.env?.ASSETS?.fetch) {
    return c.env.ASSETS.fetch(c.req.raw);
  }
  return c.text('Not Found', 404);
});

/**
 * 3-Day Cron Keep-Alive Ping (0 3 * / 3 * *)
 * Pings Supabase Postgres REST endpoint when service key is available,
 * falling back to Auth health endpoint to prevent inactive database pausing.
 */
export async function scheduled(
  _event: { cron?: string; scheduledTime?: number },
  env: Bindings,
  ctx?: { waitUntil: (promise: Promise<unknown>) => void }
): Promise<void> {
  const promise = (async () => {
    try {
      const supabaseUrl =
        env?.VITE_SUPABASE_URL ||
        (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined);
      const serviceKey =
        env?.SUPABASE_SERVICE_ROLE_KEY ||
        (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);

      if (!supabaseUrl) {
        console.warn('[Cron:SupabaseKeepAlive] VITE_SUPABASE_URL not configured. Skipping ping.');
        return;
      }

      const cleanUrl = supabaseUrl.replace(/\/$/, '');
      if (serviceKey && serviceKey.trim()) {
        const pingUrl = `${cleanUrl}/rest/v1/vibe_users?select=id&limit=1`;
        const res = await fetch(pingUrl, {
          method: 'GET',
          headers: {
            apikey: serviceKey.trim(),
            Authorization: `Bearer ${serviceKey.trim()}`,
          },
          signal: AbortSignal.timeout(5000),
        });
        console.log(`[Cron:SupabaseKeepAlive] Supabase Postgres REST ping status: ${res.status}`);
      } else {
        const pingUrl = `${cleanUrl}/auth/v1/health`;
        const res = await fetch(pingUrl, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        console.log(`[Cron:SupabaseKeepAlive] Supabase Auth health ping status: ${res.status}`);
      }
    } catch (err: any) {
      console.warn('[Cron:SupabaseKeepAlive] Keep-alive ping failed (non-fatal):', err?.message || err);
    }
  })();

  if (ctx?.waitUntil) {
    ctx.waitUntil(promise);
  } else {
    await promise;
  }
}

export default {
  fetch: app.fetch,
  scheduled,
};
