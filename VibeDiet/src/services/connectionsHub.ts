/**
 * VibeDiet Multi-Connection Ecosystem Hub & Direct GitHub REST API Publisher
 * Connects Customer App & Founder Console to:
 *  1. USDA FoodData Central REST API v1 (Pre-configured with DEMO_KEY)
 *  2. Open Food Facts REST API v2 (world.openfoodfacts.org)
 *  3. Google Gemini Multimodal API (generativelanguage.googleapis.com)
 *  4. Apple HealthKit / Google Health Connect Active Burn Sync
 *  5. Ultrahuman M1 / FreeStyle Libre Continuous Glucose Monitor (CGM) Bridge
 *  6. GitHub REST API v3 Direct Browser-to-Repo Code Publisher (api.github.com)
 */

import { env } from '../config/env.js';

export interface ApiVaultConfig {
  GEMINI_API_KEY: string;
  USDA_FDC_API_KEY: string;
  RAZORPAY_KEY_ID: string;
  STRIPE_PUBLISHABLE_KEY: string;
  FIREBASE_PROJECT_ID: string;
  GITHUB_PAT: string;
  GITHUB_REPO: string;
}

export const DEFAULT_API_VAULT: ApiVaultConfig = {
  GEMINI_API_KEY: env.GEMINI_API_KEY || '',
  USDA_FDC_API_KEY: env.USDA_FDC_API_KEY || 'DEMO_KEY',
  RAZORPAY_KEY_ID: env.RAZORPAY_KEY_ID || '',
  STRIPE_PUBLISHABLE_KEY: env.STRIPE_PUBLISHABLE_KEY || '',
  FIREBASE_PROJECT_ID: env.FIREBASE_PROJECT_ID || 'vibediet-prod-saas',
  GITHUB_PAT: '',
  GITHUB_REPO: 'avi/vibediet-production-saas',
};

export async function searchUsdaLive(query: string, apiKey = 'DEMO_KEY') {
  const url = `https://api.nal.usda.gov/fdc/v1/foods/search?api_key=${encodeURIComponent(apiKey)}&query=${encodeURIComponent(query)}&pageSize=5`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`USDA API HTTP ${res.status}`);
  return res.json();
}

export async function pushBundleToGitHub(
  pat: string,
  repoFullName: string,
  htmlContent: string,
  commitMessage = 'feat(deploy): update VibeDiet production web app via Founder Console'
) {
  const [owner, repo] = repoFullName.split('/');
  if (!owner || !repo) throw new Error('Repo must be in owner/repo format');
  const headers = {
    Authorization: `Bearer ${pat}`,
    Accept: 'application/vnd.github+json',
    'Content-Type': 'application/json',
  };

  // Ensure repo exists or create it
  const checkResp = await fetch(`https://api.github.com/repos/${owner}/${repo}`, { headers });
  if (checkResp.status === 404) {
    await fetch('https://api.github.com/user/repos', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        name: repo,
        description: 'VibeDiet Commercial AI Nutrition & Adaptive TDEE SaaS',
        private: false,
        auto_init: true,
      }),
    });
  }

  // Encode index.html to Base64 and PUT to repository
  const b64 = btoa(unescape(encodeURIComponent(htmlContent)));
  const putResp = await fetch(`https://api.github.com/repos/${owner}/${repo}/contents/index.html`, {
    method: 'PUT',
    headers,
    body: JSON.stringify({
      message: commitMessage,
      content: b64,
    }),
  });
  return putResp.json();
}
