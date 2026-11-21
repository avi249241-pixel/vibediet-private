import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Bindings } from './env.js';

let cachedClient: SupabaseClient | null = null;
let cachedUrl: string | null = null;
let cachedKey: string | null = null;

/**
 * Returns a zero-TCP HTTP Supabase admin client.
 * Configured with persistSession: false and autoRefreshToken: false to stay well under 1ms CPU time.
 * Returns null if Supabase credentials are missing or unconfigured.
 */
export function getSupabaseAdmin(env?: Partial<Bindings>): SupabaseClient | null {
  const url =
    env?.VITE_SUPABASE_URL ||
    (typeof process !== 'undefined' ? process.env.VITE_SUPABASE_URL : undefined);

  const key =
    env?.SUPABASE_SERVICE_ROLE_KEY ||
    env?.VITE_SUPABASE_ANON_KEY ||
    (typeof process !== 'undefined'
      ? process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_ANON_KEY
      : undefined);

  if (!url || !key || typeof url !== 'string' || typeof key !== 'string' || !url.trim() || !key.trim()) {
    return null;
  }

  const cleanUrl = url.trim();
  const cleanKey = key.trim();

  // If URL is not valid HTTP/HTTPS, return null safely
  if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
    return null;
  }

  // Reuse cached client if URL and key match (keeps Worker CPU time < 1ms)
  if (cachedClient && cachedUrl === cleanUrl && cachedKey === cleanKey) {
    return cachedClient;
  }

  try {
    const client = createClient(cleanUrl, cleanKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    cachedClient = client;
    cachedUrl = cleanUrl;
    cachedKey = cleanKey;
    return client;
  } catch (err) {
    console.warn('[SupabaseAdmin] Failed to initialize client:', err);
    return null;
  }
}
