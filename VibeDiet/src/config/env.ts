import { z } from 'zod';

const EnvironmentSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(3000),

  // Cloud Firestore & Firebase Admin
  FIREBASE_PROJECT_ID: z.string().optional().default('vibediet-prod-saas'),
  FIREBASE_SERVICE_ACCOUNT_KEY: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),

  // Google Gemini Key Pool
  GEMINI_API_KEY: z.string().optional(),
  GEMINI_API_KEYS: z.string().optional(),
  GEMINI_KEY_POOL_COUNT: z.coerce.number().int().min(1).max(50).default(50),

  // Auth & Admin Roles
  ADMIN_UIDS: z
    .string()
    .default('admin-local-uid,avi-architect-uid,demo-user-uid'),

  // External Nutrition Databases
  USDA_FDC_API_KEY: z.string().default('DEMO_KEY'),
  OPEN_FOOD_FACTS_USER_AGENT: z
    .string()
    .default('VibeDietSaaS/3.0 (support@vibediet.app)'),

  // Commercial Payment Webhook & API Keys
  RAZORPAY_KEY_ID: z.string().optional(),
  RAZORPAY_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
});

export type AppEnvironment = z.infer<typeof EnvironmentSchema>;

function loadDotEnvFile(): Record<string, string> {
  const envMap: Record<string, string> = {};

  // Strictly guard server-only .env loading so browser client builds never touch Node built-ins
  if (
    typeof window !== 'undefined' ||
    typeof process === 'undefined' ||
    !process.versions?.node
  ) {
    return envMap;
  }

  try {
    const fs = typeof (process as any).getBuiltinModule === 'function'
      ? (process as any).getBuiltinModule('node:fs')
      : null;
    const path = typeof (process as any).getBuiltinModule === 'function'
      ? (process as any).getBuiltinModule('node:path')
      : null;

    if (!fs || !path) return envMap;

    const possiblePaths = [
      path.resolve(process.cwd(), '.env'),
      path.resolve(process.cwd(), 'VibeDiet/.env'),
    ];

    for (const envPath of possiblePaths) {
      if (fs.existsSync(envPath)) {
        try {
          const content = fs.readFileSync(envPath, 'utf8');
          for (const line of content.split(/\r?\n/)) {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) continue;
            const clean = trimmed.replace(/^(\$env:|export\s+)/, '');
            const eqIdx = clean.indexOf('=');
            if (eqIdx !== -1) {
              const k = clean.slice(0, eqIdx).trim();
              const v = clean.slice(eqIdx + 1).trim().replace(/^['"]+|['"]+$/g, '');
              if (k) {
                envMap[k] = v;
                if (typeof process !== 'undefined' && process.env && !process.env[k]) {
                  process.env[k] = v;
                }
              }
            }
          }
          break;
        } catch {
          // Fall back gracefully if unreadable
        }
      }
    }
  } catch {
    // Non-fatal fallback
  }

  return envMap;
}

function parseEnv(): AppEnvironment {
  const fileEnv = loadDotEnvFile();
  const envSource = typeof process !== 'undefined' && process.env ? { ...fileEnv, ...process.env } : fileEnv;
  const result = EnvironmentSchema.safeParse(envSource);
  if (!result.success) {
    return EnvironmentSchema.parse({});
  }
  return result.data;
}

export const env = parseEnv();
