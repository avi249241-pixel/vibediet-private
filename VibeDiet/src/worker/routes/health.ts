import { Hono } from 'hono';
import type { Bindings } from '../env.js';

export const healthRouter = new Hono<{ Bindings: Bindings }>();

healthRouter.get('/', async (c) => {
  const timestamp = new Date().toISOString();
  const supabaseUrl =
    c.env?.VITE_SUPABASE_URL ||
    (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined);
  const supabaseKey =
    c.env?.SUPABASE_SERVICE_ROLE_KEY ||
    c.env?.VITE_SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      : undefined);

  const isConfigured = Boolean(
    supabaseUrl &&
    supabaseKey &&
    supabaseUrl.trim() &&
    supabaseKey.trim() &&
    (supabaseUrl.startsWith('http://') || supabaseUrl.startsWith('https://'))
  );

  let reachable = false;

  if (isConfigured && supabaseUrl) {
    try {
      const pingUrl = `${supabaseUrl.trim().replace(/\/$/, '')}/auth/v1/health`;
      const res = await fetch(pingUrl, {
        method: 'GET',
        headers: {
          apikey: supabaseKey || '',
        },
        signal: AbortSignal.timeout(2000),
      });
      reachable = res.ok || res.status < 500;
    } catch {
      reachable = false;
    }
  }

  return c.json({
    status: 'ok',
    worker: {
      runtime: 'cloudflare-workers',
      timestamp,
    },
    supabase: {
      configured: isConfigured,
      reachable,
    },
  }, 200);
});
