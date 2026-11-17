import fs from 'node:fs';
import path from 'node:path';
import type pg from 'pg';
import {
  DaySummary,
  MealEntry,
  SupportTicket,
  UserBiometrics,
  WeightLogEntry,
} from '../types/index.js';
import { PhotoDraft } from '../shared/draftTypes.js';
import { PortionCalibration } from '../services/portionMemory.js';

let customDataDir: string | null = null;

export function setDataDir(dir: string | null): void {
  customDataDir = dir;
}

export function getDataDir(): string {
  let resolvedDir: string;
  if (customDataDir) {
    resolvedDir = path.isAbsolute(customDataDir)
      ? customDataDir
      : path.resolve(process.cwd(), customDataDir);
  } else if (typeof process !== 'undefined' && process.env?.VIBEDIET_DATA_DIR) {
    resolvedDir = path.isAbsolute(process.env.VIBEDIET_DATA_DIR)
      ? process.env.VIBEDIET_DATA_DIR
      : path.resolve(process.cwd(), process.env.VIBEDIET_DATA_DIR);
  } else {
    resolvedDir = typeof process !== 'undefined' && process.cwd
      ? path.resolve(process.cwd(), '.data/tenants')
      : '.data/tenants';
  }

  // Ensure directory exists
  try {
    if (typeof fs !== 'undefined' && fs.existsSync && !fs.existsSync(resolvedDir)) {
      fs.mkdirSync(resolvedDir, { recursive: true });
    }
  } catch {}

  return resolvedDir;
}

// Ensure atomic storage directory exists
try {
  const initialDir = getDataDir();
  if (typeof fs !== 'undefined' && fs.existsSync && !fs.existsSync(initialDir)) {
    fs.mkdirSync(initialDir, { recursive: true });
  }
} catch {}

let pool: pg.Pool | null = null;
let isPostgresConnected = false;
let initChecked = false;

/**
 * Initializes PostgreSQL Pool if DATABASE_URL is set in environment.
 */
export async function getPostgresPool(): Promise<pg.Pool | null> {
  if (initChecked) return pool;
  initChecked = true;

  const dbUrl = process.env.DATABASE_URL;
  if (!dbUrl) {
    return null;
  }

  try {
    const { default: pg } = await import('pg');
    pool = new pg.Pool({
      connectionString: dbUrl,
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 3000,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined,
    });

    const client = await pool.connect();
    try {
      await initSchema(client);
      isPostgresConnected = true;
      console.log('[PostgresRepository] Connected to PostgreSQL with multi-tenant partition schema.');
    } finally {
      client.release();
    }
    return pool;
  } catch (err: any) {
    console.warn(`[PostgresRepository] PostgreSQL connection bypassed: ${err?.message || err}. Falling back to atomic disk persistence.`);
    pool = null;
    isPostgresConnected = false;
    return null;
  }
}

export function isUsingPostgres(): boolean {
  return isPostgresConnected && pool !== null;
}

async function initSchema(client: pg.PoolClient): Promise<void> {
  await client.query(`
    CREATE TABLE IF NOT EXISTS vibe_users (
      uid TEXT PRIMARY KEY,
      email TEXT,
      is_admin BOOLEAN DEFAULT false,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vibe_meals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      slot TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vibe_meals_user_date ON vibe_meals(user_id, date);

    CREATE TABLE IF NOT EXISTS vibe_days (
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, date)
    );

    CREATE TABLE IF NOT EXISTS vibe_drafts (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vibe_drafts_user ON vibe_drafts(user_id);

    CREATE TABLE IF NOT EXISTS vibe_weights (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      date TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vibe_weights_user ON vibe_weights(user_id);

    CREATE TABLE IF NOT EXISTS vibe_repeat_meals (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS idx_vibe_repeat_user ON vibe_repeat_meals(user_id);

    CREATE TABLE IF NOT EXISTS vibe_biometrics (
      user_id TEXT PRIMARY KEY,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW()
    );

    CREATE TABLE IF NOT EXISTS vibe_portion_calibrations (
      user_id TEXT NOT NULL,
      food_key TEXT NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, food_key)
    );

    CREATE TABLE IF NOT EXISTS vibe_support_tickets (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      payload JSONB NOT NULL,
      created_at TIMESTAMPTZ DEFAULT NOW()
    );
  `);
}

// =========================================================================
// ATOMIC DISK PERSISTENCE ENGINE (ACID-safe tmp-write + rename)
// =========================================================================

export interface TenantFileStore {
  userId: string;
  meals: Record<string, MealEntry>;
  days: Record<string, DaySummary>;
  drafts: Record<string, PhotoDraft>;
  weights: WeightLogEntry[];
  repeatMeals: MealEntry[];
  biometrics?: UserBiometrics;
  portionCalibrations: Record<string, PortionCalibration>;
}

export function readAtomicTenantFile(userId: string): TenantFileStore | null {
  try {
    const dir = getDataDir();
    const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(dir, `${safeUid}.json`);
    if (!fs.existsSync(filePath)) return null;
    const raw = fs.readFileSync(filePath, 'utf-8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function writeAtomicTenantFile(userId: string, data: TenantFileStore): void {
  try {
    const dir = getDataDir();
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(dir, `${safeUid}.json`);
    const tmpPath = path.join(dir, `${safeUid}.tmp.${Date.now()}.${Math.random().toString(36).slice(2, 7)}`);
    fs.writeFileSync(tmpPath, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpPath, filePath);
  } catch (err) {
    // Non-fatal, in-memory store remains primary
  }
}

export function deleteAtomicTenantFile(userId: string): void {
  try {
    const dir = getDataDir();
    const safeUid = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
    const filePath = path.join(dir, `${safeUid}.json`);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    // Non-fatal
  }
}

// =========================================================================
// POSTGRESQL MULTI-TENANT ADAPTER
// =========================================================================

export const postgresRepository = {
  // DRAFTS
  async getDraft(userId: string, draftId: string): Promise<PhotoDraft | null> {
    if (!pool) return null;
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_drafts WHERE user_id = $1 AND id = $2',
        [userId, draftId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].payload as PhotoDraft;
    } catch {
      return null;
    }
  },

  async saveDraft(userId: string, draft: PhotoDraft): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_drafts (id, user_id, payload, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET payload = $3, updated_at = NOW()`,
        [draft.id, userId, JSON.stringify(draft)]
      );
    } catch (err) {
      console.warn('[postgresRepository.saveDraft] Error:', err);
    }
  },

  async getAllDrafts(): Promise<PhotoDraft[]> {
    if (!pool) return [];
    try {
      const res = await pool.query('SELECT payload FROM vibe_drafts ORDER BY updated_at DESC');
      return res.rows.map((r) => r.payload as PhotoDraft);
    } catch {
      return [];
    }
  },

  // MEALS
  async getMeal(userId: string, mealId: string): Promise<MealEntry | null> {
    if (!pool) return null;
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_meals WHERE user_id = $1 AND id = $2',
        [userId, mealId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].payload as MealEntry;
    } catch {
      return null;
    }
  },

  async saveMeal(userId: string, meal: MealEntry): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_meals (id, user_id, date, slot, payload, created_at)
         VALUES ($1, $2, $3, $4, $5, NOW())
         ON CONFLICT (id) DO UPDATE SET date = $3, slot = $4, payload = $5`,
        [meal.id, userId, meal.date, meal.slot, JSON.stringify(meal)]
      );
    } catch (err) {
      console.warn('[postgresRepository.saveMeal] Error:', err);
    }
  },

  async deleteMeal(userId: string, mealId: string): Promise<void> {
    if (!pool) return;
    try {
      await pool.query('DELETE FROM vibe_meals WHERE user_id = $1 AND id = $2', [userId, mealId]);
    } catch (err) {
      console.warn('[postgresRepository.deleteMeal] Error:', err);
    }
  },

  async listMealsForDate(userId: string, date: string): Promise<MealEntry[]> {
    if (!pool) return [];
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_meals WHERE user_id = $1 AND date = $2 ORDER BY created_at ASC',
        [userId, date]
      );
      return res.rows.map((r) => r.payload as MealEntry);
    } catch {
      return [];
    }
  },

  // DAYS
  async getDaySummary(userId: string, date: string): Promise<DaySummary | null> {
    if (!pool) return null;
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_days WHERE user_id = $1 AND date = $2',
        [userId, date]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].payload as DaySummary;
    } catch {
      return null;
    }
  },

  async saveDaySummary(userId: string, date: string, summary: DaySummary): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_days (user_id, date, payload, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, date) DO UPDATE SET payload = $3, updated_at = NOW()`,
        [userId, date, JSON.stringify(summary)]
      );
    } catch (err) {
      console.warn('[postgresRepository.saveDaySummary] Error:', err);
    }
  },

  // WEIGHTS
  async getWeights(userId: string): Promise<WeightLogEntry[]> {
    if (!pool) return [];
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_weights WHERE user_id = $1 ORDER BY date ASC',
        [userId]
      );
      return res.rows.map((r) => r.payload as WeightLogEntry);
    } catch {
      return [];
    }
  },

  async saveWeight(userId: string, weight: WeightLogEntry): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_weights (id, user_id, date, payload, created_at)
         VALUES ($1, $2, $3, $4, NOW())
         ON CONFLICT (id) DO UPDATE SET date = $3, payload = $4`,
        [weight.id, userId, weight.date, JSON.stringify(weight)]
      );
    } catch (err) {
      console.warn('[postgresRepository.saveWeight] Error:', err);
    }
  },

  // REPEAT MEALS
  async getRepeatMeals(userId: string): Promise<MealEntry[]> {
    if (!pool) return [];
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_repeat_meals WHERE user_id = $1 ORDER BY created_at DESC',
        [userId]
      );
      return res.rows.map((r) => r.payload as MealEntry);
    } catch {
      return [];
    }
  },

  async saveRepeatMeal(userId: string, meal: MealEntry): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_repeat_meals (id, user_id, payload, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET payload = $3`,
        [meal.id, userId, JSON.stringify(meal)]
      );
    } catch (err) {
      console.warn('[postgresRepository.saveRepeatMeal] Error:', err);
    }
  },

  // BIOMETRICS
  async getBiometrics(userId: string): Promise<UserBiometrics | null> {
    if (!pool) return null;
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_biometrics WHERE user_id = $1',
        [userId]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].payload as UserBiometrics;
    } catch {
      return null;
    }
  },

  async saveBiometrics(userId: string, biometrics: UserBiometrics): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_biometrics (user_id, payload, updated_at)
         VALUES ($1, $2, NOW())
         ON CONFLICT (user_id) DO UPDATE SET payload = $2, updated_at = NOW()`,
        [userId, JSON.stringify(biometrics)]
      );
    } catch (err) {
      console.warn('[postgresRepository.saveBiometrics] Error:', err);
    }
  },

  // PORTION CALIBRATIONS
  async getPortionCalibration(userId: string, foodKey: string): Promise<PortionCalibration | null> {
    if (!pool) return null;
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_portion_calibrations WHERE user_id = $1 AND food_key = $2',
        [userId, foodKey]
      );
      if (res.rows.length === 0) return null;
      return res.rows[0].payload as PortionCalibration;
    } catch {
      return null;
    }
  },

  async getAllPortionCalibrations(userId: string): Promise<PortionCalibration[]> {
    if (!pool) return [];
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_portion_calibrations WHERE user_id = $1',
        [userId]
      );
      return res.rows.map((r) => r.payload as PortionCalibration);
    } catch {
      return [];
    }
  },

  async savePortionCalibration(userId: string, calibration: PortionCalibration): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_portion_calibrations (user_id, food_key, payload, updated_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (user_id, food_key) DO UPDATE SET payload = $3, updated_at = NOW()`,
        [userId, calibration.foodKey, JSON.stringify(calibration)]
      );
    } catch (err) {
      console.warn('[postgresRepository.savePortionCalibration] Error:', err);
    }
  },

  // SUPPORT TICKETS
  async createSupportTicket(ticket: SupportTicket): Promise<void> {
    if (!pool) return;
    try {
      await pool.query(
        `INSERT INTO vibe_support_tickets (id, user_id, payload, created_at)
         VALUES ($1, $2, $3, NOW())
         ON CONFLICT (id) DO UPDATE SET payload = $3`,
        [ticket.id, ticket.uid, JSON.stringify(ticket)]
      );
    } catch (err) {
      console.warn('[postgresRepository.createSupportTicket] Error:', err);
    }
  },

  async listSupportTickets(): Promise<SupportTicket[]> {
    if (!pool) return [];
    try {
      const res = await pool.query(
        'SELECT payload FROM vibe_support_tickets ORDER BY created_at DESC'
      );
      return res.rows.map((r) => r.payload as SupportTicket);
    } catch {
      return [];
    }
  },

  async resolveSupportTicket(ticketId: string, adminUid: string): Promise<void> {
    if (!pool) return;
    try {
      const res = await pool.query('SELECT payload FROM vibe_support_tickets WHERE id = $1', [ticketId]);
      if (res.rows.length > 0) {
        const ticket = res.rows[0].payload as SupportTicket;
        ticket.status = 'resolved';
        ticket.resolvedAt = new Date().toISOString();
        ticket.resolvedBy = adminUid;
        await pool.query('UPDATE vibe_support_tickets SET payload = $2 WHERE id = $1', [
          ticketId,
          JSON.stringify(ticket),
        ]);
      }
    } catch (err) {
      console.warn('[postgresRepository.resolveSupportTicket] Error:', err);
    }
  },

  // FULL ERASURE
  async eraseUserData(userId: string): Promise<void> {
    if (!pool) return;
    try {
      await pool.query('DELETE FROM vibe_meals WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM vibe_days WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM vibe_drafts WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM vibe_weights WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM vibe_repeat_meals WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM vibe_biometrics WHERE user_id = $1', [userId]);
      await pool.query('DELETE FROM vibe_portion_calibrations WHERE user_id = $1', [userId]);
    } catch (err) {
      console.warn('[postgresRepository.eraseUserData] Error:', err);
    }
  },
};
