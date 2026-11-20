import fs from 'node:fs';
import path from 'node:path';
import { env } from '../config/env.js';

export interface KeySlotTelemetry {
  id: string;
  maskedKey: string;
  requests: number;
  errors: number;
  lastLatencyMs: number | null;
  cooldownUntil: number | null;
  status: 'healthy' | 'cooldown' | 'revoked';
}

export interface KeyPoolTelemetry {
  configuredCount: number;
  activeCount: number;
  cooldownCount: number;
  revokedCount: number;
  poolSize: number;
  activeKeys: number;
  cooldownKeys: number;
  revokedKeys: number;
  models: { vision: string; fast: string; lite: string; swarm: string[] };
  slots: KeySlotTelemetry[];
}

export function maskKey(k: string): string {
  if (!k || typeof k !== 'string') return 'none';
  const clean = k.trim();
  if (clean.length > 9) {
    return `${clean.slice(0, 5)}...${clean.slice(-4)}`;
  }
  return clean;
}

export const DEFAULT_MODEL_FALLBACK: string[] = [
  'gemini-2.5-flash',
  'gemini-2.5-pro',
  'gemini-2.5-flash-lite',
];

export class GeminiKeyPoolRouter {
  private keys: string[] = [];
  private currentIndex = 0;
  private cooldowns = new Map<string, number>();
  private requestCounts = new Map<string, number>();
  private errorCounts = new Map<string, number>();
  private slotLatencies = new Map<string, number>();
  private revokedKeys = new Set<string>();
  private readonly cooldownMs: number;

  constructor(rawKeysEnv?: string, cooldownMs = 60_000) {
    this.cooldownMs = cooldownMs;
    this.reloadKeys(rawKeysEnv);
  }

  public reloadKeys(rawKeysEnv?: string): void {
    const source =
      rawKeysEnv ??
      env.GEMINI_API_KEYS ??
      env.GEMINI_API_KEY ??
      process.env.GEMINI_API_KEYS ??
      process.env.GEMINI_API_KEY ??
      '';
    const parsed: string[] = [];
    const rawList = source.split(',').map((k) => k.trim());
    for (const raw of rawList) {
      let k = raw.replace(/^['"]+|['"]+$/g, '').trim();
      if (k.startsWith('GEMINI_API_KEYS=') || k.startsWith('GEMINI_API_KEY=')) {
        k = k.split('=')[1]?.trim() || '';
      }
      if (
        k.length >= 3 &&
        k !== 'your_key_1' &&
        k !== 'your_fallback_single_key' &&
        !parsed.includes(k)
      ) {
        parsed.push(k);
        if (parsed.length >= 50) break;
      }
    }

    this.keys = parsed;
    this.currentIndex = 0;
    this.cooldowns.clear();
    this.revokedKeys.clear();
  }

  public addKeys(newKeys: string[], persist = true): number {
    let added = 0;
    for (const raw of newKeys) {
      let k = typeof raw === 'string' ? raw.trim().replace(/^['"]+|['"]+$/g, '') : '';
      if (k.startsWith('GEMINI_API_KEYS=') || k.startsWith('GEMINI_API_KEY=')) {
        k = k.split('=')[1]?.trim() || '';
      }
      if (
        k.length >= 3 &&
        k !== 'your_key_1' &&
        k !== 'your_fallback_single_key' &&
        !this.keys.includes(k)
      ) {
        if (this.keys.length < 50) {
          this.keys.push(k);
          added++;
        }
      }
    }
    if (added > 0 && persist) {
      this.persistKeysToEnv();
    }
    return added;
  }

  public removeKey(target: string): boolean {
    const clean = (target || '').trim();
    if (!clean) return false;

    let idx = -1;
    // Check if slot ID like key-slot-2 or slot-2
    const slotMatch = clean.match(/^(?:key-)?slot-(\d+)$/i);
    if (slotMatch) {
      const slotNum = parseInt(slotMatch[1], 10);
      if (slotNum >= 1 && slotNum <= this.keys.length) {
        idx = slotNum - 1;
      }
    }

    if (idx === -1) {
      idx = this.keys.findIndex((k) => {
        if (k === clean) return true;
        const masked = maskKey(k);
        if (masked === clean) return true;
        const legacyMask = k.length > 8 ? `${k.slice(0, 4)}...${k.slice(-4)}` : 'demo-slot';
        if (legacyMask === clean) return true;
        return false;
      });
    }

    if (idx !== -1) {
      const removedKey = this.keys[idx];
      this.keys.splice(idx, 1);
      this.cooldowns.delete(removedKey);
      for (const k of Array.from(this.cooldowns.keys())) {
        if (k.endsWith(`:${removedKey}`)) {
          this.cooldowns.delete(k);
        }
      }
      this.requestCounts.delete(removedKey);
      this.errorCounts.delete(removedKey);
      this.revokedKeys.delete(removedKey);
      this.slotLatencies.delete(removedKey);
      if (this.currentIndex >= this.keys.length) {
        this.currentIndex = 0;
      }
      this.persistKeysToEnv();
      return true;
    }
    return false;
  }

  public persistKeysToEnv(): void {
    // DISABLED: Never auto-overwrite .env — keys are set by the user and must not be clobbered.
    // Admin UI key additions are in-memory only until the user manually updates .env.
    return;
  }

  public hasConfiguredKeys(): boolean {
    return this.keys.length > 0 && this.keys.some((k) => !this.revokedKeys.has(k));
  }

  public getPoolSize(): number {
    return this.keys.length;
  }

  public markKeyRevoked(key: string): void {
    this.revokedKeys.add(key);
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  public isKeyRevoked(key: string): boolean {
    return this.revokedKeys.has(key);
  }

  public recordSlotLatency(key: string, latencyMs: number): void {
    this.slotLatencies.set(key, Math.round(latencyMs));
  }

  public markKeyRateLimited(key: string, model?: string): void {
    const until = Date.now() + this.cooldownMs;
    if (model) {
      this.cooldowns.set(`${model}:${key}`, until);
    } else {
      this.cooldowns.set(key, until);
    }
    this.errorCounts.set(key, (this.errorCounts.get(key) || 0) + 1);
  }

  public getNextHealthyKey(model?: string): string | null {
    if (this.keys.length === 0) return null;
    const now = Date.now();
    let bestCandidate: string | null = null;
    let minCooldown = Infinity;

    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.currentIndex + i) % this.keys.length;
      const candidate = this.keys[idx];
      if (this.revokedKeys.has(candidate)) {
        continue;
      }
      const cooldownUntil = model
        ? (this.cooldowns.get(`${model}:${candidate}`) || 0)
        : (this.cooldowns.get(candidate) || 0);

      if (now >= cooldownUntil) {
        this.currentIndex = (idx + 1) % this.keys.length;
        this.requestCounts.set(candidate, (this.requestCounts.get(candidate) || 0) + 1);
        return candidate;
      }

      if (cooldownUntil < minCooldown) {
        minCooldown = cooldownUntil;
        bestCandidate = candidate;
      }
    }

    if (bestCandidate) {
      const bestIdx = this.keys.indexOf(bestCandidate);
      this.currentIndex = (bestIdx + 1) % this.keys.length;
      this.requestCounts.set(bestCandidate, (this.requestCounts.get(bestCandidate) || 0) + 1);
      return bestCandidate;
    }

    return null;
  }

  public async executeWithRetry<T>(
    operation: (apiKey: string) => Promise<T>
  ): Promise<T> {
    const maxAttempts = Math.max(1, this.keys.length);
    let lastError: unknown = new Error('No healthy Gemini API keys available in pool');

    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      const apiKey = this.getNextHealthyKey();
      if (!apiKey) break;

      const t0 = Date.now();
      try {
        const result = await operation(apiKey);
        this.recordSlotLatency(apiKey, Date.now() - t0);
        return result;
      } catch (err: any) {
        this.recordSlotLatency(apiKey, Date.now() - t0);
        lastError = err;
        const msg = String(err?.message || err || '');
        const status = err?.status || err?.statusCode;
        if (
          status === 400 ||
          status === 403 ||
          msg.includes('400') ||
          msg.includes('403') ||
          msg.includes('API_KEY_INVALID') ||
          msg.includes('PERMISSION_DENIED') ||
          msg.includes('API key not valid')
        ) {
          this.markKeyRevoked(apiKey);
          continue;
        }
        if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
          this.markKeyRateLimited(apiKey);
          continue;
        }
        if (
          status === 503 ||
          msg.includes('503') ||
          msg.includes('high demand') ||
          msg.includes('UNAVAILABLE')
        ) {
          continue;
        }
        throw err;
      }
    }

    throw lastError;
  }

  public async executeWithModelFallback<T>(
    models: string[] = DEFAULT_MODEL_FALLBACK,
    operation: (apiKey: string, model: string) => Promise<T>
  ): Promise<T> {
    if (models.length === 0) {
      throw new Error('No models specified for executeWithModelFallback');
    }

    let lastError: unknown = new Error('No models or healthy keys succeeded');

    for (const model of models) {
      const unrevokedCount = this.keys.filter((k) => !this.revokedKeys.has(k)).length;
      if (this.keys.length > 0 && unrevokedCount === 0) {
        throw new Error('All configured Gemini API keys are permanently revoked or invalid');
      }

      const healthyKeyCount = Math.max(1, unrevokedCount);

      for (let attempt = 0; attempt < healthyKeyCount; attempt++) {
        const apiKey = this.getNextHealthyKey(model);
        if (!apiKey) {
          lastError = new Error(`No healthy keys available for model ${model}`);
          break;
        }

        const t0 = Date.now();
        try {
          const timeoutMs = 12000;
          let timer: NodeJS.Timeout | undefined;
          const timeoutPromise = new Promise<never>((_, reject) => {
            timer = setTimeout(() => reject(new Error(`Operation timed out after ${timeoutMs}ms for model ${model}`)), timeoutMs);
          });
          const result = await Promise.race([operation(apiKey, model), timeoutPromise]).finally(() => {
            if (timer) clearTimeout(timer);
          });
          this.recordSlotLatency(apiKey, Date.now() - t0);
          return result;
        } catch (err: any) {
          this.recordSlotLatency(apiKey, Date.now() - t0);
          lastError = err;
          const msg = String(err?.message || err || '');
          const status = err?.status || err?.statusCode;
          if (
            status === 400 ||
            status === 403 ||
            msg.includes('400') ||
            msg.includes('403') ||
            msg.includes('API_KEY_INVALID') ||
            msg.includes('PERMISSION_DENIED') ||
            msg.includes('API key not valid')
          ) {
            this.markKeyRevoked(apiKey);
            continue;
          }
          if (status === 429 || msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED')) {
            // Google AI Studio Free Tier has limit: 0 or daily quota exhausted on this model;
            // DO NOT cooldown the key slot for other models—immediately cascade to the next model in the fallback chain!
            if (
              msg.includes('limit: 0') ||
              msg.includes('limit:0') ||
              msg.includes('PerDay') ||
              msg.includes('per day limit')
            ) {
              break;
            }
            this.markKeyRateLimited(apiKey, model);
            continue;
          }
          if (
            status === 404 ||
            msg.includes('404') ||
            msg.includes('not found') ||
            msg.includes('no longer available') ||
            status === 503 ||
            msg.includes('503') ||
            msg.includes('high demand') ||
            msg.includes('UNAVAILABLE')
          ) {
            break;
          }
          break;
        }
      }
    }

    throw lastError;
  }

  public async provisionNewProjectKey(): Promise<string | null> {
    const telemetry = this.getTelemetry();
    if (telemetry.activeCount > 1) {
      return null;
    }

    const projectNumber = process.env.GCP_PROJECT_NUMBER;
    const saToken = process.env.GCP_SERVICE_ACCOUNT_TOKEN;

    if (!projectNumber || !saToken) {
      return null;
    }

    try {
      const url = `https://apikeys.googleapis.com/v2/projects/${projectNumber}/locations/global/keys`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${saToken}`,
        },
        body: JSON.stringify({
          displayName: `VibeDiet Auto-Swarm Key-${Date.now()}`,
          restrictions: {
            apiTargets: [
              {
                service: 'generativelanguage.googleapis.com',
              },
            ],
          },
        }),
      });

      if (!response.ok) {
        console.warn(`[KeyPoolRouter] Failed to auto-provision key: HTTP ${response.status}`);
        return null;
      }

      const data: any = await response.json();
      const keyString = data?.keyString || data?.response?.keyString;
      if (keyString && typeof keyString === 'string') {
        this.addKeys([keyString]);
        return keyString;
      }
    } catch (err) {
      console.warn('[KeyPoolRouter] Error during provisionNewProjectKey:', err);
    }

    return null;
  }

  public getTelemetry(): KeyPoolTelemetry {
    const now = Date.now();
    const slots: KeySlotTelemetry[] = this.keys.map((key, idx) => {
      const isRevoked = this.revokedKeys.has(key);
      let until = this.cooldowns.get(key) || 0;
      for (const [cKey, cUntil] of this.cooldowns.entries()) {
        if (cKey.endsWith(`:${key}`) && cUntil > until) {
          until = cUntil;
        }
      }
      const inCooldown = !isRevoked && now < until;
      let status: 'healthy' | 'cooldown' | 'revoked' = 'healthy';
      if (isRevoked) {
        status = 'revoked';
      } else if (inCooldown) {
        status = 'cooldown';
      }

      return {
        id: `key-slot-${idx + 1}`,
        maskedKey: maskKey(key),
        requests: this.requestCounts.get(key) || 0,
        errors: this.errorCounts.get(key) || 0,
        lastLatencyMs: this.slotLatencies.get(key) ?? null,
        cooldownUntil: inCooldown ? until : null,
        status,
      };
    });

    const cooldownKeys = slots.filter((s) => s.status === 'cooldown').length;
    const revokedKeysCount = slots.filter((s) => s.status === 'revoked').length;
    const activeKeys = slots.filter((s) => s.status === 'healthy').length;

    return {
      configuredCount: this.keys.length,
      activeCount: activeKeys,
      cooldownCount: cooldownKeys,
      revokedCount: revokedKeysCount,
      poolSize: this.keys.length,
      activeKeys,
      cooldownKeys,
      revokedKeys: revokedKeysCount,
      models: {
        vision: 'gemini-2.5-flash',
        fast: 'gemini-2.5-flash',
        lite: 'gemini-2.5-flash-lite',
        swarm: ['gemini-2.5-flash', 'gemini-2.5-pro'],
      },
      slots,
    };
  }
}

export const keyPoolRouter = new GeminiKeyPoolRouter();
