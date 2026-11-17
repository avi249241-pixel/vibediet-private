import { logSecurityEvent } from './auditLogger.js';

export interface MediaValidationResult {
  valid: boolean;
  format?: 'jpeg' | 'png' | 'webp';
  error?: string;
  buffer?: Buffer;
}

/**
 * Validates image payload by inspecting magic bytes of the decoded buffer.
 * Supports standard JPEG (FF D8 FF), PNG (89 50 4E 47), and WebP (RIFF....WEBP).
 */
export function validateImagePayload(payload: string): MediaValidationResult {
  if (!payload || typeof payload !== 'string') {
    return { valid: false, error: 'Empty or invalid media payload' };
  }

  try {
    const rawBase64 = payload.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '').trim();
    if (rawBase64.length === 0) {
      return { valid: false, error: 'Empty base64 payload' };
    }

    const buf = Buffer.from(rawBase64, 'base64');
    if (buf.length < 12) {
      return { valid: false, error: 'Image buffer is too small to contain valid headers' };
    }

    // 1. JPEG: FF D8 FF
    if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) {
      return { valid: true, format: 'jpeg', buffer: buf };
    }

    // 2. PNG: 89 50 4E 47 (0x89 'P' 'N' 'G')
    if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) {
      return { valid: true, format: 'png', buffer: buf };
    }

    // 3. WebP: 'RIFF' .... 'WEBP'
    if (
      buf[0] === 0x52 &&
      buf[1] === 0x49 &&
      buf[2] === 0x46 &&
      buf[3] === 0x46 &&
      buf.subarray(8, 12).toString('ascii') === 'WEBP'
    ) {
      return { valid: true, format: 'webp', buffer: buf };
    }

    logSecurityEvent({
      eventType: 'media_rejected',
      details: {
        reason: 'Magic byte check failed (unrecognized image signature)',
        headerHex: buf.subarray(0, 4).toString('hex'),
      },
    });

    return {
      valid: false,
      error: 'Unrecognized image signature. Only genuine JPEG, PNG, or WebP files are accepted.',
    };
  } catch (err: any) {
    return { valid: false, error: `Media parsing error: ${err?.message || err}` };
  }
}

/**
 * Zeros out volatile memory buffer to prevent memory dump inspection
 */
export function zeroFillBuffer(buffer?: Buffer): void {
  if (buffer && Buffer.isBuffer(buffer)) {
    try {
      buffer.fill(0);
    } catch {
      // Ignored
    }
  }
}
