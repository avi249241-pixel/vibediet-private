import { describe, it, expect, vi } from 'vitest';
import { buildDemoRecognizedItems } from '../src/services/draftProcessor.js';
import { GeminiKeyPoolRouter } from '../src/services/keyPoolRouter.js';

describe('4-Tier Nutrition Evidence & 50-Key Gemini Swarm Router', () => {
  it('returns 4-tier recognized items with USDA Tier 1 and Gemini 3.1 Pro Tier 3 badges', () => {
    const items = buildDemoRecognizedItems();
    expect(items.length).toBe(4);
    expect(items.some((i) => i.tier === 1)).toBe(true);
    expect(items.some((i) => i.tier === 3)).toBe(true);
    expect(items.some((i) => i.cookingFatCategory === 'unobservable_unknown')).toBe(true);
  });

  it('rotates up to 50 Gemini API keys round-robin and quarantines 429 keys for 60s', async () => {
    const router = new GeminiKeyPoolRouter('keyA,keyB,keyC', 60_000);
    expect(router.getPoolSize()).toBe(3);
    expect(router.getNextHealthyKey()).toBe('keyA');
    expect(router.getNextHealthyKey()).toBe('keyB');

    // Simulate 429 on keyC and automatic retry onto keyA
    let calls = 0;
    const result = await router.executeWithRetry(async (key) => {
      calls++;
      if (key === 'keyC') {
        const err: any = new Error('429 RESOURCE_EXHAUSTED');
        err.status = 429;
        throw err;
      }
      return `success-with-${key}`;
    });

    expect(calls).toBe(2);
    expect(result).toBe('success-with-keyA');
    expect(router.getTelemetry().cooldownKeys).toBe(1);
  });

  it('supports live key injection (addKeys) with deduplication, placeholder filtering, and 50-key cap', () => {
    const router = new GeminiKeyPoolRouter('key-init-1,key-init-2');
    expect(router.getPoolSize()).toBe(2);

    // Try adding duplicate, empty, placeholder, and valid keys
    const addedCount = router.addKeys([
      'key-init-1', // duplicate
      '  ', // empty
      'your_key_1', // placeholder
      'your_fallback_single_key', // placeholder
      'key-new-3',
      'key-new-4',
    ]);
    expect(addedCount).toBe(2);
    expect(router.getPoolSize()).toBe(4);

    // Test capping at 50 slots
    const manyKeys = Array.from({ length: 60 }, (_, i) => `bulk-key-${i + 1}`);
    const bulkAdded = router.addKeys(manyKeys);
    expect(bulkAdded).toBe(46); // 4 + 46 = 50 max
    expect(router.getPoolSize()).toBe(50);
  });

  it('removes keys by exact key string or masked representation', () => {
    const router = new GeminiKeyPoolRouter('key-123456789-A,key-123456789-B,shortkey');
    expect(router.getPoolSize()).toBe(3);

    // Remove by exact key
    const removedShort = router.removeKey('shortkey');
    expect(removedShort).toBe(true);
    expect(router.getPoolSize()).toBe(2);

    // Remove by masked key (key-123456789-A -> "key-...89-A")
    const telemetry = router.getTelemetry();
    const mask = telemetry.slots[0].maskedKey;
    const removedMasked = router.removeKey(mask);
    expect(removedMasked).toBe(true);
    expect(router.getPoolSize()).toBe(1);

    // Non-existent key removal returns false
    expect(router.removeKey('non-existent-key')).toBe(false);
  });

  it('permanently isolates revoked keys (400/403/invalid) and excludes them from healthy rotation', async () => {
    const router = new GeminiKeyPoolRouter('badKey1,goodKey2');
    expect(router.getTelemetry().activeKeys).toBe(2);

    // Key 1 fails with 400 API_KEY_INVALID
    let attempts = 0;
    const result = await router.executeWithRetry(async (key) => {
      attempts++;
      if (key === 'badKey1') {
        const err: any = new Error('API key not valid. Please pass a valid API key.');
        err.status = 400;
        throw err;
      }
      return `ok-${key}`;
    });

    expect(attempts).toBe(2);
    expect(result).toBe('ok-goodKey2');

    // Telemetry reflects revoked status
    const telemetry = router.getTelemetry();
    expect(telemetry.revokedKeys).toBe(1);
    expect(telemetry.slots[0].status).toBe('revoked');
    expect(telemetry.slots[1].status).toBe('healthy');
    expect(telemetry.activeKeys).toBe(1);

    // Subsequent calls to getNextHealthyKey() will never return badKey1
    expect(router.getNextHealthyKey()).toBe('goodKey2');
    expect(router.getNextHealthyKey()).toBe('goodKey2');
  });

  it('cascades to fallback models (executeWithModelFallback) when primary model fails', async () => {
    const router = new GeminiKeyPoolRouter('key1,key2');
    const modelExecutionLog: string[] = [];

    const result = await router.executeWithModelFallback(
      ['gemini-2.5-flash', 'gemini-2.5-flash-lite'],
      async (key, model) => {
        modelExecutionLog.push(`${model}:${key}`);
        if (model === 'gemini-2.5-flash') {
          // Primary model unavailable / 429
          const err: any = new Error('Model overloaded');
          err.status = 429;
          throw err;
        }
        return `success-on-${model}-with-${key}`;
      }
    );

    expect(result).toContain('success-on-gemini-2.5-flash-lite');
    expect(modelExecutionLog.some((l) => l.startsWith('gemini-2.5-flash:'))).toBe(true);
    expect(modelExecutionLog.some((l) => l.startsWith('gemini-2.5-flash-lite:'))).toBe(true);
  });

  it('provisions new project key via GCP API hook when activeKeys <= 1 and env is configured', async () => {
    const originalEnv = { ...process.env };
    process.env.GCP_PROJECT_NUMBER = '1234567890';
    process.env.GCP_SERVICE_ACCOUNT_TOKEN = 'mock-sa-token-xyz';

    const router = new GeminiKeyPoolRouter('single-active-key');
    expect(router.getTelemetry().activeKeys).toBe(1);

    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        keyString: 'AIzaSyAutoProvisionedNewKey999',
      }),
    });
    vi.stubGlobal('fetch', mockFetch);

    try {
      const provisioned = await router.provisionNewProjectKey();
      expect(provisioned).toBe('AIzaSyAutoProvisionedNewKey999');
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [url, options] = mockFetch.mock.calls[0];
      expect(url).toContain('https://apikeys.googleapis.com/v2/projects/1234567890/locations/global/keys');
      expect(options.headers.Authorization).toBe('Bearer mock-sa-token-xyz');
      expect(router.getPoolSize()).toBe(2);
      expect(router.getTelemetry().activeKeys).toBe(2);
    } finally {
      vi.unstubAllGlobals();
      process.env = originalEnv;
    }
  });
});
