import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { maskKey } from './keyPoolRouter.js';

export interface SecurityAuditEvent {
  eventType:
    | 'key_added'
    | 'key_removed'
    | 'admin_ping'
    | 'rate_limit_blocked'
    | 'origin_rejected'
    | 'media_rejected'
    | 'draft_confirmed'
    | 'draft_purged'
    | 'admin_auth_success'
    | 'admin_auth_failed'
    | 'support_ticket_created'
    | 'support_ticket_resolved'
    | 'ai_analyze_completed';
  ip?: string;
  uid?: string;
  details?: Record<string, any>;
}

const LOGS_DIR = path.resolve(process.cwd(), 'logs');
const AUDIT_LOG_FILE = path.join(LOGS_DIR, 'security-audit.ndjson');

export function logSecurityEvent(event: SecurityAuditEvent): void {
  try {
    if (!fs.existsSync(LOGS_DIR)) {
      fs.mkdirSync(LOGS_DIR, { recursive: true });
    }

    const sanitizedDetails: Record<string, any> = {};
    if (event.details) {
      for (const [key, val] of Object.entries(event.details)) {
        if (typeof val === 'string' && (key.toLowerCase().includes('key') || key.toLowerCase().includes('token') || key.toLowerCase().includes('secret'))) {
          sanitizedDetails[key] = maskKey(val);
        } else if (Array.isArray(val) && key.toLowerCase().includes('key')) {
          sanitizedDetails[key] = val.map((k) => (typeof k === 'string' ? maskKey(k) : k));
        } else {
          sanitizedDetails[key] = val;
        }
      }
    }

    const entry = {
      timestamp: new Date().toISOString(),
      eventType: event.eventType,
      ip: event.ip || '127.0.0.1',
      uid: event.uid || 'system',
      details: sanitizedDetails,
    };

    fs.appendFileSync(AUDIT_LOG_FILE, JSON.stringify(entry) + '\n', 'utf8');
  } catch (err) {
    // Non-blocking fallback so file IO never brings down the API
    console.warn('[AuditLogger] Failed to write security audit log entry:', err);
  }
}

/**
 * Timing-safe string comparison to protect against side-channel timing attacks
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const bufA = Buffer.from(a, 'utf8');
  const bufB = Buffer.from(b, 'utf8');
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

export interface SanitizedAuditEntry {
  timestamp: string;
  eventType: string;
  ip: string;
  uid: string;
  details: Record<string, any>;
}

export function getRecentAuditLogs(limit = 25): SanitizedAuditEntry[] {
  try {
    if (!fs.existsSync(AUDIT_LOG_FILE)) {
      return [];
    }
    const content = fs.readFileSync(AUDIT_LOG_FILE, 'utf8');
    const lines = content.trim().split('\n').filter(Boolean);
    const entries: SanitizedAuditEntry[] = [];
    for (let i = lines.length - 1; i >= 0 && entries.length < limit; i--) {
      try {
        const parsed = JSON.parse(lines[i]);
        entries.push(parsed);
      } catch {
        // ignore malformed line
      }
    }
    return entries;
  } catch (err) {
    console.warn('[AuditLogger] Failed to read audit logs:', err);
    return [];
  }
}
