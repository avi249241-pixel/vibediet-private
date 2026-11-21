import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Bindings } from './env.js';
import { healthRouter } from './routes/health.js';
import { syncRouter } from './routes/sync.js';
import { adminRouter } from './routes/admin.js';
import { billingRouter } from './routes/billing.js';
import v1Handler from '../../netlify/functions/v1.mts';

export const app = new Hono<{ Bindings: Bindings }>();

// Restrict cross-origin access to local dev, Cloudflare Workers domains, and configured APP_ORIGIN
app.use(
  '*',
  cors({
    origin: (origin, c) => {
      if (!origin) return '*';
      const customOrigin =
        typeof c.env?.APP_ORIGIN === 'string' ? c.env.APP_ORIGIN.trim() : '';
      if (customOrigin && origin === customOrigin) return origin;
      if (
        /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/i.test(origin) ||
        /^https:\/\/[a-z0-9-]+\.workers\.dev$/i.test(origin)
      ) {
        return origin;
      }
      return '';
    },
  })
);

// Mount modular sub-routers
app.route('/v1/health', healthRouter);
app.route('/v1/sync', syncRouter);
app.route('/v1/admin', adminRouter);
app.route('/v1/billing', billingRouter);

// Delegate remaining /v1/* routes to shared serverless handler
app.all('/v1/*', async (c) => {
  try {
    return await v1Handler(c.req.raw, { env: c.env });
  } catch (err: unknown) {
    console.error('[Worker:/v1/*] Unhandled error:', err);
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
 * Executes a lightweight Postgres REST query on vibe_users so Supabase
 * registers real database activity and does not pause free-tier projects.
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

      if (!supabaseUrl) {
        console.warn('[Cron:SupabaseKeepAlive] VITE_SUPABASE_URL not configured. Skipping ping.');
        return;
      }

      const serviceKey =
        env?.SUPABASE_SERVICE_ROLE_KEY ||
        (typeof process !== 'undefined' ? process.env.SUPABASE_SERVICE_ROLE_KEY : undefined);

      const baseUrl = supabaseUrl.replace(/\/$/, '');
      const pingUrl = serviceKey
        ? `${baseUrl}/rest/v1/vibe_users?select=id&limit=1`
        : `${baseUrl}/auth/v1/health`;

      const headers: Record<string, string> = serviceKey
        ? {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
          }
        : {};

      const res = await fetch(pingUrl, {
        method: 'GET',
        headers,
        signal: AbortSignal.timeout(5000),
      });
      console.log(`[Cron:SupabaseKeepAlive] Supabase ping status: ${res.status}`);
    } catch (err: unknown) {
      console.warn('[Cron:SupabaseKeepAlive] Keep-alive ping failed (non-fatal):', err);
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