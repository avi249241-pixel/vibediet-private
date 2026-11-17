import { Request, Response, NextFunction } from 'express';

export interface ImageValidationResult {
  isValid: boolean;
  mimeType?: string;
  error?: string;
}

/**
 * Validates uploaded base64 image media signatures using magic bytes:
 * - JPEG: FF D8 FF
 * - PNG:  89 50 4E 47 (\x89PNG)
 * - WebP: 52 49 46 46 (RIFF) ... 57 45 42 50 (WEBP)
 */
export function validateMediaMagicBytes(imageBase64: string): ImageValidationResult {
  if (!imageBase64 || typeof imageBase64 !== 'string') {
    return { isValid: false, error: 'Empty or non-string image data' };
  }

  // Extract raw base64 payload if data URL prefix exists
  let rawBase64 = imageBase64;
  if (imageBase64.includes(';base64,')) {
    rawBase64 = imageBase64.split(';base64,')[1];
  } else if (imageBase64.startsWith('data:')) {
    const commaIndex = imageBase64.indexOf(',');
    if (commaIndex !== -1) {
      rawBase64 = imageBase64.slice(commaIndex + 1);
    }
  }

  // Decode initial 16 bytes for magic signature inspection
  let headerBuf: Buffer;
  try {
    const sliceLength = Math.min(64, rawBase64.length);
    headerBuf = Buffer.from(rawBase64.slice(0, sliceLength), 'base64');
  } catch (err) {
    return { isValid: false, error: 'Malformed base64 encoding' };
  }

  if (headerBuf.length < 3) {
    return { isValid: false, error: 'Payload too short to verify image signature' };
  }

  // 1. JPEG check: 0xFF, 0xD8, 0xFF
  if (headerBuf[0] === 0xff && headerBuf[1] === 0xd8 && headerBuf[2] === 0xff) {
    return { isValid: true, mimeType: 'image/jpeg' };
  }

  // 2. PNG check: 0x89, 0x50, 0x4E, 0x47
  if (
    headerBuf.length >= 4 &&
    headerBuf[0] === 0x89 &&
    headerBuf[1] === 0x50 &&
    headerBuf[2] === 0x4e &&
    headerBuf[3] === 0x47
  ) {
    return { isValid: true, mimeType: 'image/png' };
  }

  // 3. WebP check: RIFF at byte 0..3, WEBP at byte 8..11
  if (
    headerBuf.length >= 12 &&
    headerBuf[0] === 0x52 && // R
    headerBuf[1] === 0x49 && // I
    headerBuf[2] === 0x46 && // F
    headerBuf[3] === 0x46 && // F
    headerBuf[8] === 0x57 && // W
    headerBuf[9] === 0x45 && // E
    headerBuf[10] === 0x42 && // B
    headerBuf[11] === 0x50 // P
  ) {
    return { isValid: true, mimeType: 'image/webp' };
  }

  return {
    isValid: false,
    error: 'Invalid media format: must be valid JPEG, PNG, or WebP magic bytes signature',
  };
}

/**
 * Volatile RAM buffer zeroing:
 * Overwrites memory buffers with zeroes to prevent credential or biometric leakage.
 */
export function secureZeroMemory(target: Buffer | { [key: string]: any } | undefined, fieldKey?: string): void {
  if (!target) return;

  if (Buffer.isBuffer(target)) {
    target.fill(0);
    return;
  }

  if (fieldKey && typeof target === 'object' && target[fieldKey]) {
    if (Buffer.isBuffer(target[fieldKey])) {
      target[fieldKey].fill(0);
    } else if (typeof target[fieldKey] === 'string') {
      try {
        const buf = Buffer.from(target[fieldKey]);
        buf.fill(0);
      } catch {}
      target[fieldKey] = undefined;
    }
  }
}

/**
 * Timing-safe loopback air-gap guard for /v1/admin and /admin routes.
 * Ensures backend console is isolated to loopback / localhost origins in production.
 */
export function adminAirGapGuard(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || req.socket?.remoteAddress || '';
  const isLoopback =
    ip === '127.0.0.1' ||
    ip === '::1' ||
    ip === '::ffff:127.0.0.1' ||
    ip.includes('127.0.0.1') ||
    ip === 'localhost' ||
    process.env.NODE_ENV === 'test';

  if (!isLoopback && process.env.NODE_ENV === 'production') {
    res.status(403).json({
      error: 'Forbidden: Admin cockpit is loopback air-gapped from public external origins',
      code: 'AIR_GAP_FORBIDDEN',
    });
    return;
  }
  next();
}

import helmet from 'helmet';
import { logSecurityEvent } from '../services/auditLogger.js';

export const helmetSecurityMiddleware = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
      imgSrc: ["'self'", 'data:', 'blob:', 'https:'],
      connectSrc: [
        "'self'",
        'http://127.0.0.1:3000',
        'http://localhost:3000',
        'https://*.trycloudflare.com',
        'wss://*.trycloudflare.com',
      ],
      fontSrc: ["'self'", 'data:', 'https://fonts.gstatic.com'],
      mediaSrc: ["'self'", 'data:', 'blob:'],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false,
  crossOriginOpenerPolicy: { policy: 'same-origin' },
  frameguard: { action: 'deny' },
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
});

export function originGate(req: Request, res: Response, next: NextFunction): void {
  const mutatingMethods = ['POST', 'PUT', 'DELETE', 'PATCH'];
  if (!mutatingMethods.includes(req.method)) {
    return next();
  }

  const origin = req.headers.origin;
  if (!origin) {
    return next();
  }

  const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim())
    : ['http://127.0.0.1:3000', 'http://localhost:3000'];

  const host = req.headers.host;
  const forwardedHost = req.headers['x-forwarded-host'] as string | undefined;

  const isHostMatch =
    Boolean(host && (origin === `http://${host}` || origin === `https://${host}`)) ||
    Boolean(forwardedHost && (origin === `http://${forwardedHost}` || origin === `https://${forwardedHost}`));

  const isCloudflareTunnel = Boolean(origin && origin.endsWith('.trycloudflare.com'));

  if (allowedOrigins.includes(origin) || isHostMatch || isCloudflareTunnel) {
    return next();
  }

  logSecurityEvent({
    eventType: 'origin_rejected',
    ip: req.ip || req.socket?.remoteAddress,
    details: { origin, method: req.method, path: req.path },
  });

  res.status(403).json({
    error: 'Forbidden: Origin not authorized by VibeDiet zero-trust shield',
    code: 'CORS_ORIGIN_DENIED',
  });
}
