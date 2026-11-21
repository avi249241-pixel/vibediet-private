/**
 * Hybrid Local-First Delta Sync Service (src/services/cloudDeltaSync.ts)
 *
 * Provides resilient, low-latency (<5ms) local-first persistence with an
 * IndexedDB outbox queue. Flushes compact (~120 byte) delta payloads to
 * Cloudflare Worker / Supabase via POST /v1/sync/push, and hydrates client
 * state via GET /v1/sync/pull on login or reconnect.
 *
 * Protects iOS Safari users against 7-day ITP storage eviction while maintaining
 * zero-network-dependency offline capability.
 */

export interface MealDeltaRecord {
  id: string;
  date: string;
  slot: string;
  title: string;
  calories: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  action: 'upsert' | 'delete';
  updated_at: string;
}

export interface WeightDeltaRecord {
  id: string;
  date: string;
  weight_kg: number;
  action: 'upsert' | 'delete';
  updated_at: string;
}

export interface DeltaOutboxEntry {
  id: string;
  entity: 'meal' | 'weight';
  data: MealDeltaRecord | WeightDeltaRecord;
  createdAt: number;
  retryCount: number;
}

export interface SyncPushPayload {
  vibe_meal_sync?: MealDeltaRecord[];
  vibe_weight_sync?: WeightDeltaRecord[];
  clientMutationId?: string;
}

export interface SyncPullResponse {
  success: boolean;
  pulledAt: string;
  meals: MealDeltaRecord[];
  weights: WeightDeltaRecord[];
}

const DB_NAME = 'vibediet_delta_sync_db';
const STORE_NAME = 'delta_outbox';
const DB_VERSION = 1;
const FALLBACK_KEY = 'vibediet_delta_outbox_fallback_v1';
const LAST_SYNC_KEY = 'vibediet_last_delta_sync_ts';

// In-memory cache fallback for environments without IndexedDB (e.g., node/tests)
let memoryOutbox: DeltaOutboxEntry[] = [];
let memoryLastSyncTimestamp: string | null = null;

/**
 * Open or upgrade the local IndexedDB outbox database.
 */
function openOutboxDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }

  return new Promise((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION);

      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        }
      };

      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
      request.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Persist an item into the fallback queue (localStorage / memory).
 */
function enqueueFallback(entry: DeltaOutboxEntry): void {
  memoryOutbox.push(entry);
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(memoryOutbox));
    } catch {
      // Memory only
    }
  }
}

/**
 * Read all fallback outbox entries.
 */
function readFallback(): DeltaOutboxEntry[] {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const raw = window.localStorage.getItem(FALLBACK_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          memoryOutbox = parsed;
        }
      }
    } catch {
      // Use memory
    }
  }
  return [...memoryOutbox];
}

/**
 * Remove items from fallback store by id.
 */
function removeFallback(ids: string[]): void {
  const set = new Set(ids);
  memoryOutbox = memoryOutbox.filter((item) => !set.has(item.id));
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(FALLBACK_KEY, JSON.stringify(memoryOutbox));
    } catch {
      // Memory only
    }
  }
}

/**
 * Add an entry to the outbox queue.
 */
export async function enqueueDeltaOutbox(
  entity: 'meal' | 'weight',
  data: MealDeltaRecord | WeightDeltaRecord
): Promise<string> {
  const id = `delta-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const entry: DeltaOutboxEntry = {
    id,
    entity,
    data,
    createdAt: Date.now(),
    retryCount: 0,
  };

  const db = await openOutboxDB();
  if (!db) {
    enqueueFallback(entry);
    return id;
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      const req = store.put(entry);
      req.onsuccess = () => resolve(id);
      req.onerror = () => {
        enqueueFallback(entry);
        resolve(id);
      };
      tx.oncomplete = () => db.close();
    } catch {
      enqueueFallback(entry);
      resolve(id);
    }
  });
}

/**
 * Retrieve all pending entries from the outbox.
 */
export async function getPendingOutbox(): Promise<DeltaOutboxEntry[]> {
  const db = await openOutboxDB();
  if (!db) {
    return readFallback();
  }

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.getAll();
      req.onsuccess = () => {
        const items: DeltaOutboxEntry[] = req.result || [];
        const fallback = readFallback();
        // Merge without duplicating IDs
        const seen = new Set(items.map((i) => i.id));
        for (const item of fallback) {
          if (!seen.has(item.id)) {
            items.push(item);
          }
        }
        resolve(items);
      };
      req.onerror = () => resolve(readFallback());
      tx.oncomplete = () => db.close();
    } catch {
      resolve(readFallback());
    }
  });
}

/**
 * Remove synced entries from the outbox.
 */
export async function removeOutboxEntries(ids: string[]): Promise<void> {
  if (ids.length === 0) return;
  removeFallback(ids);

  const db = await openOutboxDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      for (const id of ids) {
        store.delete(id);
      }
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Get total pending outbox items count.
 */
export async function getOutboxCount(): Promise<number> {
  const items = await getPendingOutbox();
  return items.length;
}

/**
 * Clear the entire outbox queue (e.g., on user account wipe / GDPR erasure).
 */
export async function clearOutbox(): Promise<void> {
  memoryOutbox = [];
  memoryLastSyncTimestamp = null;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.removeItem(FALLBACK_KEY);
      window.localStorage.removeItem(LAST_SYNC_KEY);
    } catch {
      // Ignore
    }
  }

  const db = await openOutboxDB();
  if (!db) return;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite');
      const store = tx.objectStore(STORE_NAME);
      store.clear();
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    } catch {
      resolve();
    }
  });
}

/**
 * Last synchronization timestamp accessor.
 */
export function getLastSyncTimestamp(): string | null {
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      return window.localStorage.getItem(LAST_SYNC_KEY) || memoryLastSyncTimestamp;
    } catch {
      return memoryLastSyncTimestamp;
    }
  }
  return memoryLastSyncTimestamp;
}

export function setLastSyncTimestamp(ts: string): void {
  memoryLastSyncTimestamp = ts;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      window.localStorage.setItem(LAST_SYNC_KEY, ts);
    } catch {
      // Ignore
    }
  }
}

/**
 * Queue a meal delta update (upsert or delete).
 * Executes asynchronously without blocking UI latency (<5ms).
 */
export function queueMealDelta(
  meal: {
    id: string;
    date: string;
    slot?: string;
    title?: string;
    totalCalories?: number;
    totalProtein?: number;
    totalCarbs?: number;
    totalFat?: number;
  },
  action: 'upsert' | 'delete' = 'upsert'
): Promise<string> {
  const record: MealDeltaRecord = {
    id: meal.id,
    date: meal.date,
    slot: meal.slot || 'lunch',
    title: meal.title || 'Logged Meal',
    calories: Math.round(meal.totalCalories || 0),
    protein_g: Number((meal.totalProtein || 0).toFixed(1)),
    carbs_g: Number((meal.totalCarbs || 0).toFixed(1)),
    fat_g: Number((meal.totalFat || 0).toFixed(1)),
    action,
    updated_at: new Date().toISOString(),
  };

  return enqueueDeltaOutbox('meal', record).catch(() => 'fallback-id');
}

/**
 * Queue a scale weight delta update (upsert or delete).
 */
export function queueWeightDelta(
  weight: {
    id: string;
    date: string;
    weightKg: number;
  },
  action: 'upsert' | 'delete' = 'upsert'
): Promise<string> {
  const record: WeightDeltaRecord = {
    id: weight.id,
    date: weight.date,
    weight_kg: Number(weight.weightKg.toFixed(2)),
    action,
    updated_at: new Date().toISOString(),
  };

  return enqueueDeltaOutbox('weight', record).catch(() => 'fallback-id');
}

/**
 * Flushes pending delta mutations to the edge sync endpoint POST /v1/sync/push.
 * Returns { synced, failed } count.
 */
export async function flushDeltaOutbox(token?: string): Promise<{ synced: number; failed: number }> {
  // If no bearer token or in local guest mode, keep outbox queued without failing
  if (!token || !token.trim() || token.startsWith('uid:usr_') || token.startsWith('uid:guest')) {
    return { synced: 0, failed: 0 };
  }

  // Check if browser is offline
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return { synced: 0, failed: 0 };
  }

  const entries = await getPendingOutbox();
  if (entries.length === 0) {
    return { synced: 0, failed: 0 };
  }

  const mealDeltas: MealDeltaRecord[] = [];
  const weightDeltas: WeightDeltaRecord[] = [];
  const processedIds: string[] = [];

  for (const entry of entries) {
    processedIds.push(entry.id);
    if (entry.entity === 'meal') {
      mealDeltas.push(entry.data as MealDeltaRecord);
    } else if (entry.entity === 'weight') {
      weightDeltas.push(entry.data as WeightDeltaRecord);
    }
  }

  const payload: SyncPushPayload = {
    vibe_meal_sync: mealDeltas,
    vibe_weight_sync: weightDeltas,
    clientMutationId: `push-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  };

  try {
    const res = await fetch('/v1/sync/push', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token.trim()}`,
      },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      const data = await res.json().catch(() => ({}));
      await removeOutboxEntries(processedIds);
      if (data?.syncedAt) {
        setLastSyncTimestamp(data.syncedAt);
      }
      return { synced: processedIds.length, failed: 0 };
    }

    // 401 Unauthorized or 503 Supabase not configured: keep items in outbox
    return { synced: 0, failed: processedIds.length };
  } catch (err) {
    // Network failure: preserve outbox
    return { synced: 0, failed: processedIds.length };
  }
}

/**
 * Hydrates local state by pulling remote delta updates via GET /v1/sync/pull.
 * Returns the payload or null if unauthenticated or offline.
 */
export async function pullRemoteDeltas(
  token?: string,
  since?: string | null
): Promise<SyncPullResponse | null> {
  if (!token || !token.trim() || token.startsWith('uid:usr_') || token.startsWith('uid:guest')) {
    return null;
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return null;
  }

  try {
    const query = since ? `?since=${encodeURIComponent(since)}` : '';
    const res = await fetch(`/v1/sync/pull${query}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token.trim()}`,
      },
    });

    if (!res.ok) {
      return null;
    }

    const data: SyncPullResponse = await res.json();
    if (data?.pulledAt) {
      setLastSyncTimestamp(data.pulledAt);
    }
    return data;
  } catch {
    return null;
  }
}
