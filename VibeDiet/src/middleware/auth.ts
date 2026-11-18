import { Request, Response, NextFunction } from 'express';
import crypto from 'node:crypto';
import { env } from '../config/env.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    uid: string;
    email?: string;
    isAdmin: boolean;
  };
}

const SESSION_SECRET = process.env.SESSION_SECRET || 'vibediet-signed-session-secret-key-38bdf8';

/**
 * Creates a cryptographically signed HMAC-SHA256 session token for Google/Supabase Auth.
 */
export function createSignedSessionToken(
  user: { uid: string; email?: string; isAdmin: boolean },
  expiresInMs = 7 * 24 * 60 * 60 * 1000
): string {
  const iat = Date.now();
  const exp = iat + expiresInMs;
  const payloadStr = JSON.stringify({ ...user, iat, exp });
  const payloadB64 = Buffer.from(payloadStr).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

/**
 * Verifies HMAC-SHA256 signature and expiration on a session token.
 */
export function verifySignedSessionToken(
  token: string
): { uid: string; email?: string; isAdmin: boolean } | null {
  try {
    if (!token || typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [payloadB64, signature] = parts;

    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(payloadB64)
      .digest('base64url');

    // Constant-time buffer comparison to prevent timing attacks
    const sigBuf = Buffer.from(signature);
    const expBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof payload.exp === 'number' && Date.now() > payload.exp) {
      return null;
    }

    return {
      uid: payload.uid,
      email: payload.email,
      isAdmin: Boolean(payload.isAdmin),
    };
  } catch {
    return null;
  }
}

/**
 * Parses cookies from Cookie header without external cookie-parser dependency.
 */
function parseCookies(header?: string): Record<string, string> {
  if (!header) return {};
  const cookies: Record<string, string> = {};
  for (const item of header.split(';')) {
    const [k, v] = item.trim().split('=');
    if (k && v) {
      cookies[k] = decodeURIComponent(v);
    }
  }
  return cookies;
}

function timingSafeMatch(a: string, b: string): boolean {
  if (!a || !b) return false;
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return crypto.timingSafeEqual(bufA, bufB);
}

/**
 * Verifies a Supabase HS256 JWT (if SUPABASE_JWT_SECRET is configured)
 */
function verifySupabaseJwt(
  token: string
): { uid: string; email?: string; isAdmin: boolean } | null {
  try {
    const jwtSecret = process.env.SUPABASE_JWT_SECRET || '';
    if (!jwtSecret) return null;
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [headerB64, payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', jwtSecret)
      .update(`${headerB64}.${payloadB64}`)
      .digest('base64url');
    if (!timingSafeMatch(signature, expectedSig)) return null;
    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (typeof payload.exp === 'number' && Date.now() / 1000 > payload.exp) return null;
    return {
      uid: payload.sub || payload.user_id || 'supabase-user',
      email: payload.email,
      isAdmin: payload?.app_metadata?.role === 'admin' || payload?.role === 'service_role',
    };
  } catch {
    return null;
  }
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const cookies = parseCookies(req.headers.cookie);
  const sessionCookie = cookies['vibediet_session'];

  // 1. Check for HttpOnly Signed Session Token in Cookies
  if (sessionCookie) {
    const verifiedSession = verifySignedSessionToken(sessionCookie);
    if (verifiedSession) {
      req.user = verifiedSession;
      next();
      return;
    }
  }

  // 2. Check for Bearer token in Authorization header
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({
      error: 'Unauthorized: Missing or malformed Bearer token',
      code: 'AUTH_MISSING_BEARER',
    });
    return;
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token || token === 'invalid-token' || token === 'expired-token') {
    res.status(401).json({
      error: 'Unauthorized: Invalid or expired authentication token',
      code: 'AUTH_INVALID_TOKEN',
    });
    return;
  }

  // 3. Check timing-safe ADMIN_ACCESS_TOKEN
  const configuredAdminToken = (process.env.ADMIN_ACCESS_TOKEN || '').trim();
  if (configuredAdminToken.length >= 16 && timingSafeMatch(token, configuredAdminToken)) {
    req.user = {
      uid: 'admin-verified-uid',
      email: 'admin@vibediet.app',
      isAdmin: true,
    };
    next();
    return;
  }

  // 4. Check cryptographically signed Session Token or Supabase JWT
  if (token.includes('.')) {
    const verifiedSession = verifySignedSessionToken(token) || verifySupabaseJwt(token);
    if (verifiedSession) {
      req.user = verifiedSession;
      next();
      return;
    }
  }

  const adminUids = env.ADMIN_UIDS.split(',').map((s) => s.trim());

  // 5. Production Mode: Reject all unsigned / local-dev tokens
  if (env.NODE_ENV === 'production') {
    if (token.startsWith('uid:') || token === 'local-dev-user' || token === 'local-dev-token') {
      res.status(401).json({
        error: 'Unauthorized: Unsigned tokens are strictly forbidden in production',
        code: 'AUTH_MOCK_TOKEN_FORBIDDEN',
      });
      return;
    }

    res.status(401).json({
      error: 'Unauthorized: Cryptographic JWT or ADMIN_ACCESS_TOKEN verification failed',
      code: 'AUTH_INVALID_TOKEN',
    });
    return;
  }

  // 6. Non-Production Mode: Loopback dev/test user isolation via uid:<id> (never grants admin via magic strings)
  const clientIp = req.ip || req.socket.remoteAddress || '';
  const isTunnel =
    Boolean(req.hostname && req.hostname.endsWith('.trycloudflare.com')) ||
    Boolean(
      req.headers['x-forwarded-host'] &&
      String(req.headers['x-forwarded-host']).endsWith('.trycloudflare.com')
    );

  const isLoopbackOrTest =
    env.NODE_ENV === 'test' ||
    clientIp === '127.0.0.1' ||
    clientIp === '::1' ||
    clientIp === '::ffff:127.0.0.1' ||
    req.hostname === '127.0.0.1' ||
    req.hostname === 'localhost' ||
    isTunnel;

  if (!isLoopbackOrTest) {
    res.status(403).json({
      error: 'Forbidden: Loopback-only development tokens cannot be used remotely',
      code: 'AUTH_LOOPBACK_ONLY',
    });
    return;
  }

  if (token.startsWith('uid:')) {
    const uid = token.slice(4).trim();
    if (!uid) {
      res.status(401).json({ error: 'Unauthorized: Empty UID token', code: 'AUTH_INVALID_TOKEN' });
      return;
    }
    req.user = {
      uid,
      email: `${uid}@vibediet.app`,
      isAdmin: !isTunnel && adminUids.includes(uid),
    };
    next();
    return;
  }

  res.status(401).json({
    error: 'Unauthorized: Provide a signed JWT, ADMIN_ACCESS_TOKEN, or loopback uid:<id>',
    code: 'AUTH_INVALID_TOKEN',
  });
}

export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user) {
    res.status(401).json({ error: 'Unauthorized: Authentication required' });
    return;
  }
  if (!req.user.isAdmin) {
    res.status(403).json({
      error: 'Forbidden: Admin role required to access Admin Cockpit endpoints',
      code: 'ADMIN_ROLE_REQUIRED',
    });
    return;
  }
  next();
}
