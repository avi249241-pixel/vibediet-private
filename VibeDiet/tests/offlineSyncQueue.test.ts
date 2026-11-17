import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  enqueueOfflineMutation,
  getOfflineQueue,
  clearOfflineQueue,
  getOfflineQueueCount,
  peekOfflineQueue,
  dequeueOfflineMutation,
  flushOfflineQueue,
  setupOnlineAutoSync,
  OfflineMutation,
} from '../src/services/offlineSyncQueue.js';
import {
  formatOfflinePillText,
  isRunningStandalone,
  isIosSafari,
} from '../src/components/PwaInstallBanner.js';

describe('Offline Action Queue & PWA Integration Suite', () => {
  beforeEach(() => {
    clearOfflineQueue();
  });

  afterEach(() => {
    clearOfflineQueue();
    vi.restoreAllMocks();
  });

  describe('1. Offline Enqueueing & FIFO Order Preservation', () => {
    it('enqueues LOG_MEAL, LOG_WATER, and SAVE_PORTION_CALIBRATION mutations in FIFO order', () => {
      const mealMut = enqueueOfflineMutation('LOG_MEAL', {
        date: '2026-11-16',
        slot: 'lunch',
        title: 'Grilled Salmon Bowl',
        items: [{ name: 'Salmon', grams: 150, protein: 30, carbs: 0, fat: 12 }],
      });

      const waterMut = enqueueOfflineMutation('LOG_WATER', {
        date: '2026-11-16',
        deltaMl: 350,
      });

      const portionMut = enqueueOfflineMutation('SAVE_PORTION_CALIBRATION', {
        foodName: 'dal makhani',
        grams: 185,
        oilModifier: '1 tsp ghee',
      });

      expect(getOfflineQueueCount()).toBe(3);

      const queue = getOfflineQueue();
      expect(queue[0].clientMutationId).toBe(mealMut.clientMutationId);
      expect(queue[0].type).toBe('LOG_MEAL');
      expect(queue[0].payload.title).toBe('Grilled Salmon Bowl');

      expect(queue[1].clientMutationId).toBe(waterMut.clientMutationId);
      expect(queue[1].type).toBe('LOG_WATER');
      expect(queue[1].payload.deltaMl).toBe(350);

      expect(queue[2].clientMutationId).toBe(portionMut.clientMutationId);
      expect(queue[2].type).toBe('SAVE_PORTION_CALIBRATION');
      expect(queue[2].payload.grams).toBe(185);

      // Verify peek returns head of queue (FIFO)
      const head = peekOfflineQueue();
      expect(head?.id).toBe(mealMut.id);
    });

    it('removes specific mutations via dequeueOfflineMutation', () => {
      const mut1 = enqueueOfflineMutation('LOG_WATER', { date: '2026-11-16', deltaMl: 250 }, 'mut_water_1');
      const mut2 = enqueueOfflineMutation('LOG_WATER', { date: '2026-11-16', deltaMl: 500 }, 'mut_water_2');

      expect(getOfflineQueueCount()).toBe(2);

      const removed = dequeueOfflineMutation('mut_water_1');
      expect(removed).toBe(true);
      expect(getOfflineQueueCount()).toBe(1);

      const remaining = getOfflineQueue();
      expect(remaining[0].clientMutationId).toBe('mut_water_2');
    });
  });

  describe('2. Idempotency Key Deduplication', () => {
    it('prevents duplicate queue entries when using the same clientMutationId', () => {
      const customKey = 'client-tx-uuid-8829';

      const first = enqueueOfflineMutation(
        'LOG_MEAL',
        { date: '2026-11-16', slot: 'dinner', title: 'Tofu Stir Fry', items: [] },
        customKey
      );

      expect(getOfflineQueueCount()).toBe(1);

      // Attempt to re-enqueue identical mutation (e.g. rapid user taps)
      const second = enqueueOfflineMutation(
        'LOG_MEAL',
        { date: '2026-11-16', slot: 'dinner', title: 'Tofu Stir Fry (Retry)', items: [] },
        customKey
      );

      // Must return identical mutation and not expand the queue
      expect(second.clientMutationId).toBe(customKey);
      expect(second.payload.title).toBe('Tofu Stir Fry'); // Retains original
      expect(getOfflineQueueCount()).toBe(1);
    });
  });

  describe('3. Queue Draining & Auto-Flush Execution', () => {
    it('flushes queued mutations sequentially in FIFO order', async () => {
      const executionLog: string[] = [];

      enqueueOfflineMutation('LOG_MEAL', { title: 'Breakfast 1' }, 'm1');
      enqueueOfflineMutation('LOG_WATER', { deltaMl: 250 }, 'm2');
      enqueueOfflineMutation('SAVE_PORTION_CALIBRATION', { foodName: 'Oats' }, 'm3');

      const mockExecutor = vi.fn().mockImplementation(async (mutation: OfflineMutation) => {
        executionLog.push(mutation.clientMutationId);
        return true;
      });

      const result = await flushOfflineQueue(mockExecutor);

      expect(result.synced).toBe(3);
      expect(result.failed).toBe(0);
      expect(result.remaining).toBe(0);
      expect(getOfflineQueueCount()).toBe(0);

      // Verify strict FIFO order of execution
      expect(executionLog).toEqual(['m1', 'm2', 'm3']);
    });

    it('safely retains failed mutations and increments retryCount', async () => {
      enqueueOfflineMutation('LOG_WATER', { deltaMl: 300 }, 'mut_fail_1');

      const failingExecutor = vi.fn().mockResolvedValue({
        success: false,
        error: '503 Service Unavailable',
      });

      const firstFlush = await flushOfflineQueue(failingExecutor);

      expect(firstFlush.synced).toBe(0);
      expect(firstFlush.failed).toBe(1);
      expect(firstFlush.remaining).toBe(1);
      expect(getOfflineQueueCount()).toBe(1);

      const queueAfterFail = getOfflineQueue();
      expect(queueAfterFail[0].retryCount).toBe(1);
      expect(queueAfterFail[0].lastError).toBe('503 Service Unavailable');

      // Subsequent successful flush clears it
      const successExecutor = vi.fn().mockResolvedValue(true);
      const secondFlush = await flushOfflineQueue(successExecutor);

      expect(secondFlush.synced).toBe(1);
      expect(secondFlush.remaining).toBe(0);
      expect(getOfflineQueueCount()).toBe(0);
    });

    it('triggers flush on window online event via setupOnlineAutoSync', async () => {
      if (typeof window === 'undefined') {
        (globalThis as any).window = new EventTarget();
      }

      enqueueOfflineMutation('LOG_WATER', { deltaMl: 500 }, 'mut_auto_1');

      let executed = false;
      const autoExecutor = vi.fn().mockImplementation(async () => {
        executed = true;
        return true;
      });

      const teardown = setupOnlineAutoSync(autoExecutor);

      // Fire simulated browser online event
      window.dispatchEvent(new Event('online'));

      // Wait a microtask turn for promise resolution
      await new Promise((resolve) => setTimeout(resolve, 50));

      expect(executed).toBe(true);
      expect(getOfflineQueueCount()).toBe(0);

      teardown();
    });
  });

  describe('4. PWA Status & Install Pill Text Logic', () => {
    it('formats offline pill count text conforming to Apple-glass spec', () => {
      expect(formatOfflinePillText(0)).toBe('Offline • Ready for offline logging');
      expect(formatOfflinePillText(1)).toBe('Offline • 1 log queued for auto-sync');
      expect(formatOfflinePillText(2)).toBe('Offline • 2 logs queued for auto-sync');
      expect(formatOfflinePillText(12)).toBe('Offline • 12 logs queued for auto-sync');
    });

    it('detects standalone and iOS Safari environments safely', () => {
      expect(typeof isRunningStandalone()).toBe('boolean');
      expect(typeof isIosSafari()).toBe('boolean');
    });
  });
});
