/**
 * Cloudflare Workers typed Bindings environment interface.
 */

export interface AssetFetcher {
  fetch: (request: Request) => Promise<Response>;
}

export interface Bindings {
  ASSETS: AssetFetcher;
  VITE_SUPABASE_URL?: string;
  VITE_SUPABASE_ANON_KEY?: string;
  SUPABASE_SERVICE_ROLE_KEY?: string;
  ADMIN_ACCESS_TOKEN?: string;
  GEMINI_API_KEY?: string;
  GEMINI_API_KEYS?: string;
  USDA_FDC_API_KEY?: string;
  OPEN_FOOD_FACTS_USER_AGENT?: string;
  RAZORPAY_KEY_ID?: string;
  RAZORPAY_KEY_SECRET?: string;
  RAZORPAY_WEBHOOK_SECRET?: string;
  [key: string]: unknown;
}
