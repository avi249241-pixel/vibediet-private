import { createClient, SupabaseClient, User, Session } from '@supabase/supabase-js';

// Safe environment variable resolution with vite / node compatibility
const getEnvVar = (key: string): string | undefined => {
  try {
    if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env[key]) {
      return String(import.meta.env[key]);
    }
  } catch {}
  try {
    if (typeof process !== 'undefined' && process.env && process.env[key]) {
      return String(process.env[key]);
    }
  } catch {}
  return undefined;
};

const supabaseUrl = getEnvVar('VITE_SUPABASE_URL') || getEnvVar('SUPABASE_URL');
const supabaseAnonKey = getEnvVar('VITE_SUPABASE_ANON_KEY') || getEnvVar('SUPABASE_ANON_KEY');

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    supabaseUrl &&
    supabaseAnonKey &&
    supabaseUrl.startsWith('http') &&
    !supabaseUrl.includes('placeholder') &&
    !supabaseAnonKey.includes('placeholder')
  );
};

let clientInstance: SupabaseClient | null = null;

export const getSupabaseClient = (): SupabaseClient | null => {
  if (!isSupabaseConfigured()) {
    return null;
  }
  if (!clientInstance && supabaseUrl && supabaseAnonKey) {
    try {
      clientInstance = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: true,
        },
      });
    } catch (err) {
      console.warn('[SupabaseClient] Initialization warning:', err);
      clientInstance = null;
    }
  }
  return clientInstance;
};

export interface AuthActionResult<T = any> {
  success: boolean;
  data?: T;
  error?: string | null;
  mode: 'supabase_cloud' | 'local_fallback';
}

/**
 * Initiates Google OAuth Sign-In via Supabase.
 * Gracefully falls back to mock user data in local offline dev / test mode.
 */
export async function signInWithGoogle(redirectTo?: string): Promise<AuthActionResult<{ url?: string; user?: any }>> {
  const client = getSupabaseClient();

  if (client) {
    try {
      const redirect = redirectTo || (typeof window !== 'undefined' ? window.location.origin : 'http://127.0.0.1:3000');
      const { data, error } = await client.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: redirect,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      });

      if (error) {
        return { success: false, error: error.message, mode: 'supabase_cloud' };
      }

      return { success: true, data: { url: data?.url }, mode: 'supabase_cloud' };
    } catch (err: any) {
      return { success: false, error: err?.message || 'Google Auth Error', mode: 'supabase_cloud' };
    }
  }

  // Graceful local fallback for 127.0.0.1 / Playwright E2E testing
  const fallbackUser = {
    id: 'google-verified-user-1',
    email: 'user@google-verified.io',
    user_metadata: {
      full_name: 'Google Verified User',
      avatar_url: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100&auto=format&fit=crop&q=80',
    },
  };

  return {
    success: true,
    data: { user: fallbackUser },
    mode: 'local_fallback',
  };
}

/**
 * Signs out the active user session.
 */
export async function signOutUser(): Promise<AuthActionResult<void>> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { error } = await client.auth.signOut();
      if (error) {
        return { success: false, error: error.message, mode: 'supabase_cloud' };
      }
      return { success: true, mode: 'supabase_cloud' };
    } catch (err: any) {
      return { success: false, error: err?.message, mode: 'supabase_cloud' };
    }
  }

  return { success: true, mode: 'local_fallback' };
}

/**
 * Attaches Authorization: Bearer <access_token> to outgoing HTTP requests.
 * Pulls from real Supabase session or falls back gracefully to local dev token.
 */
export async function getAuthHeaders(fallbackToken?: string): Promise<Record<string, string>> {
  const client = getSupabaseClient();
  if (client) {
    try {
      const { data } = await client.auth.getSession();
      const token = data?.session?.access_token;
      if (token) {
        return {
          Authorization: `Bearer ${token}`,
          'X-Client-Auth-Mode': 'supabase_cloud',
        };
      }
    } catch {}
  }

  const effectiveToken = fallbackToken || 'uid:demo-user-uid';
  return {
    Authorization: `Bearer ${effectiveToken}`,
    'X-Client-Auth-Mode': 'local_fallback',
  };
}

/**
 * Synchronously generates fallback auth headers for immediate fetch calls.
 */
export function getSyncAuthHeaders(fallbackToken?: string): Record<string, string> {
  const effectiveToken = fallbackToken || 'uid:demo-user-uid';
  return {
    Authorization: `Bearer ${effectiveToken}`,
    'X-Client-Auth-Mode': isSupabaseConfigured() ? 'supabase_pending' : 'local_fallback',
  };
}

/**
 * Retrieves the currently signed-in user, checking Supabase first then falling back.
 */
export async function getCurrentUser(): Promise<{ user: User | null; session: Session | null }> {
  const client = getSupabaseClient();
  if (!client) {
    return { user: null, session: null };
  }
  try {
    const { data } = await client.auth.getSession();
    return {
      user: data?.session?.user || null,
      session: data?.session || null,
    };
  } catch {
    return { user: null, session: null };
  }
}
