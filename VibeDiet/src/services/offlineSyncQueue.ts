/**
 * Resilient Offline Action Queue (src/services/offlineSyncQueue.ts)
 * Persistent offline-first queue backed by localStorage with FIFO ordering,
 * idempotency deduplication (clientMutationId), and automatic online auto-sync.
 */

import { MealSlot, FoodItemEntry } from '../types/index.js';

export type OfflineMutationType =
  | 'LOG_MEAL'
  | 'LOG_WATER'
  | 'SAVE_PORTION_CALIBRATION';

export interface LogMealPayload {
  date: string; // YYYY-MM-DD
  slot: MealSlot;
  title: string;
  items: Partial<FoodItemEntry>[];
  thumbnailDataUrl?: string;
  isDemoMode?: boolean;
}

export interface LogWaterPayload {
  date: string; // YYYY-MM-DD
  deltaMl: number;
}

export interface SavePortionCalibrationPayload {
  uid?: string;
  foodName: string;
  grams: number;
  oilModifier?: string;
}

export interface OfflineMutation<T = any> {
  id: string; // Synonymous with clientMutationId
  clientMutationId: string;
  type: OfflineMutationType;
  payload: T;
  createdAt: string; // ISO 8601
  retryCount: number;
  maxRetries: number;
  lastError?: string;
}

export interface FlushResult {
  synced: number;
  failed: number;
  remaining: number;
  errors: Array<{ id: string; error: string }>;
}

export type MutationExecutor = (
  mutation: OfflineMutation
) => Promise<boolean | { success: boolean; error?: string }>;

export const OFFLINE_QUEUE_STORAGE_KEY = 'vibediet_offline_sync_queue_v1';
export const QUEUE_CHANGE_EVENT = 'vibediet-offline-queue-changed';

/**
 * In-memory storage fallback for environments without localStorage access
 */
class MemoryStorage {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.get(key) ?? null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, String(value));
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }

  clear(): void {
    this.store.clear();
  }

  get length(): number {
    return this.store.size;
  }
}

const memoryStorage = new MemoryStorage();

/**
 * Safe accessor for web storage
 */
export function getStorage(): {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
  removeItem: (key: string) => void;
  clear?: () => void;
} {
  try {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage;
    }
    if (typeof localStorage !== 'undefined') {
      return localStorage;
    }
  } catch {
    // Restricted or private browser mode
  }
  return memoryStorage;
}

/**
 * Dispatches an event across the window so UI components update reactively
 */
export function notifyQueueChanged(): void {
  if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
    try {
      const count = getOfflineQueueCount();
      window.dispatchEvent(
        new CustomEvent(QUEUE_CHANGE_EVENT, {
          detail: { count },
        })
      );
    } catch {
      // Ignored in non-DOM environments
    }
  }
}

/**
 * Retrieves the current offline queue from storage
 */
export function getOfflineQueue(): OfflineMutation[] {
  const storage = getStorage();
  const raw = storage.getItem(OFFLINE_QUEUE_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.warn('[OfflineQueue] Failed to parse offline queue JSON:', err);
    return [];
  }
}

/**
 * Saves the offline queue array to persistent storage
 */
export function saveOfflineQueue(queue: OfflineMutation[]): void {
  const storage = getStorage();
  try {
    storage.setItem(OFFLINE_QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (err) {
    console.error('[OfflineQueue] Failed to save offline queue to storage:', err);
  }
}

/**
 * Clears the offline queue completely
 */
export function clearOfflineQueue(): void {
  const storage = getStorage();
  storage.removeItem(OFFLINE_QUEUE_STORAGE_KEY);
  notifyQueueChanged();
}

/**
 * Returns current count of queued mutations
 */
export function getOfflineQueueCount(): number {
  return getOfflineQueue().length;
}

/**
 * Peeks at the head of the FIFO queue without removing it
 */
export function peekOfflineQueue(): OfflineMutation | null {
  const queue = getOfflineQueue();
  return queue.length > 0 ? queue[0] : null;
}

/**
 * Enqueues a new mutation with idempotency key deduplication (clientMutationId).
 * If a mutation with clientMutationId already exists, returns the existing record.
 */
export function enqueueOfflineMutation<T = any>(
  type: OfflineMutationType,
  payload: T,
  customMutationId?: string
): OfflineMutation<T> {
  const queue = getOfflineQueue();

  // Deduplication check: enforce idempotency
  if (customMutationId) {
    const existing = queue.find((m) => m.clientMutationId === customMutationId);
    if (existing) {
      return existing as OfflineMutation<T>;
    }
  }

  const clientMutationId =
    customMutationId || `mut_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;

  const mutation: OfflineMutation<T> = {
    id: clientMutationId,
    clientMutationId,
    type,
    payload,
    createdAt: new Date().toISOString(),
    retryCount: 0,
    maxRetries: 5,
  };

  // FIFO append
  queue.push(mutation);
  saveOfflineQueue(queue);
  notifyQueueChanged();
  return mutation;
}

/**
 * Dequeues a single mutation by clientMutationId
 */
export function dequeueOfflineMutation(clientMutationId: string): boolean {
  const queue = getOfflineQueue();
  const filtered = queue.filter((m) => m.clientMutationId !== clientMutationId);
  if (filtered.length !== queue.length) {
    saveOfflineQueue(filtered);
    notifyQueueChanged();
    return true;
  }
  return false;
}

/**
 * Default network executor that submits queued payloads to the backend API
 */
export async function defaultMutationExecutor(
  mutation: OfflineMutation
): Promise<boolean | { success: boolean; error?: string }> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return { success: false, error: 'Network offline' };
  }

  let token = 'uid:guest-local-uid';
  try {
    if (typeof window !== 'undefined') {
      const stored = window.localStorage.getItem('token') || window.sessionStorage.getItem('token');
      if (stored) token = stored;
    }
  } catch {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
    'X-Client-Mutation-Id': mutation.clientMutationId,
  };

  try {
    let endpoint = '';
    let bodyData: any = {};

    switch (mutation.type) {
      case 'LOG_MEAL': {
        endpoint = '/v1/meals/manual';
        const p = mutation.payload as LogMealPayload;
        bodyData = {
          date: p.date,
          slot: p.slot,
          title: p.title,
          items: p.items,
        };
        break;
      }
      case 'LOG_WATER': {
        const p = mutation.payload as LogWaterPayload;
        endpoint = `/v1/days/${encodeURIComponent(p.date)}/water`;
        bodyData = { deltaMl: p.deltaMl };
        break;
      }
      case 'SAVE_PORTION_CALIBRATION': {
        endpoint = '/v1/user/portion-calibrations';
        bodyData = mutation.payload;
        break;
      }
      default:
        return { success: false, error: `Unsupported mutation type: ${(mutation as any).type}` };
    }

    const res = await fetch(endpoint, {
      method: 'POST',
      headers,
      body: JSON.stringify(bodyData),
    });

    if (res.ok || res.status === 201) {
      return true;
    }

    const errText = await res.text().catch(() => 'HTTP Error');
    return { success: false, error: `Server returned status ${res.status}: ${errText}` };
  } catch (err: any) {
    return { success: false, error: err?.message || 'Network fetch failure' };
  }
}

let isFlushing = false;

/**
 * Drains all queued offline mutations in FIFO order, with retry tracking and deduplication.
 */
export async function flushOfflineQueue(
  customExecutor?: MutationExecutor
): Promise<FlushResult> {
  if (isFlushing) {
    const current = getOfflineQueue();
    return { synced: 0, failed: 0, remaining: current.length, errors: [] };
  }

  isFlushing = true;
  const result: FlushResult = {
    synced: 0,
    failed: 0,
    remaining: 0,
    errors: [],
  };

  try {
    const queue = getOfflineQueue();
    if (queue.length === 0) {
      result.remaining = 0;
      return result;
    }

    const executor = customExecutor || defaultMutationExecutor;
    const remainingQueue: OfflineMutation[] = [];

    for (const mutation of queue) {
      try {
        const execResult = await executor(mutation);
        const isSuccess =
          typeof execResult === 'boolean' ? execResult : execResult?.success ?? false;

        if (isSuccess) {
          result.synced++;
        } else {
          const errMsg =
            typeof execResult === 'object' && execResult?.error
              ? execResult.error
              : 'Mutation execution failed';

          mutation.retryCount += 1;
          mutation.lastError = errMsg;
          result.failed++;
          result.errors.push({ id: mutation.clientMutationId, error: errMsg });

          // Keep in queue if under max retries
          if (mutation.retryCount < mutation.maxRetries) {
            remainingQueue.push(mutation);
          } else {
            console.warn(
              `[OfflineQueue] Mutation ${mutation.clientMutationId} exceeded max retries (${mutation.maxRetries}), dropping.`
            );
          }
        }
      } catch (err: any) {
        mutation.retryCount += 1;
        mutation.lastError = err?.message || 'Uncaught error during execution';
        result.failed++;
        result.errors.push({
          id: mutation.clientMutationId,
          error: mutation.lastError || 'Uncaught error',
        });

        if (mutation.retryCount < mutation.maxRetries) {
          remainingQueue.push(mutation);
        }
      }
    }

    saveOfflineQueue(remainingQueue);
    result.remaining = remainingQueue.length;
    notifyQueueChanged();
  } finally {
    isFlushing = false;
  }

  return result;
}

/**
 * Sets up an event listener on window 'online' to auto-flush the queue when network reconnects.
 * Returns a teardown function.
 */
export function setupOnlineAutoSync(executor?: MutationExecutor): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleOnline = () => {
    flushOfflineQueue(executor).catch((err) => {
      console.warn('[OfflineQueue] Automatic online flush encountered an error:', err);
    });
  };

  window.addEventListener('online', handleOnline);

  return () => {
    window.removeEventListener('online', handleOnline);
  };
}

/**
 * Subscribes to queue changes and returns an unsubscribe callback
 */
export function subscribeToQueueChanges(callback: (count: number) => void): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handler = (e: any) => {
    const count = e?.detail?.count ?? getOfflineQueueCount();
    callback(count);
  };

  window.addEventListener(QUEUE_CHANGE_EVENT, handler);

  return () => {
    window.removeEventListener(QUEUE_CHANGE_EVENT, handler);
  };
}
