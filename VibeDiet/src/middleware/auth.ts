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

  // 3. Check if Bearer token is a signed session token
  if (token.includes('.')) {
    const verifiedSession = verifySignedSessionToken(token);
    if (verifiedSession) {
      req.user = verifiedSession;
      next();
      return;
    }
  }

  const adminUids = env.ADMIN_UIDS.split(',').map((s) => s.trim());

  // 4. Production Mode: Strict Cryptographic Firebase ID Token Verification
  if (env.NODE_ENV === 'production') {
    if (
      token.startsWith('uid:') ||
      token === 'admin-token' ||
      token === 'guest-non-admin-token' ||
      token === 'local-dev-user' ||
      token === 'local-dev-token'
    ) {
      res.status(401).json({
        error: 'Unauthorized: Mock tokens are strictly forbidden in production',
        code: 'AUTH_MOCK_TOKEN_FORBIDDEN',
      });
      return;
    }

    try {
      let adminModule: any = null;
      if (env.FIREBASE_PROJECT_ID || env.FIREBASE_SERVICE_ACCOUNT_KEY || env.GOOGLE_APPLICATION_CREDENTIALS) {
        try {
          adminModule = (await import('firebase-admin')).default;
        } catch {}
      }

      if (adminModule && adminModule.apps.length > 0) {
        const decoded = await adminModule.auth().verifyIdToken(token);
        const isAdmin = decoded.admin === true || adminUids.includes(decoded.uid);
        req.user = {
          uid: decoded.uid,
          email: decoded.email || `${decoded.uid}@vibediet.app`,
          isAdmin,
        };
        next();
        return;
      } else {
        res.status(401).json({
          error: 'Unauthorized: Firebase Admin authentication not initialized',
          code: 'AUTH_UNINITIALIZED',
        });
        return;
      }
    } catch {
      res.status(401).json({
        error: 'Unauthorized: Cryptographic JWT verification failed',
        code: 'AUTH_INVALID_TOKEN',
      });
      return;
    }
  }

  // 5. Non-Production Mode: Restrict Mock Tokens to Loopback Dev / Test & Authorized Tunnels
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

  if (!isLoopbackOrTest && (token.startsWith('uid:') || token.includes('token') || token === 'local-dev-user')) {
    res.status(403).json({
      error: 'Forbidden: Mock authentication shortcuts are restricted to loopback (127.0.0.1)',
      code: 'AUTH_LOOPBACK_ONLY',
    });
    return;
  }

  let uid = 'demo-user-uid';
  if (token.startsWith('uid:')) {
    uid = token.slice(4);
  } else if (token === 'admin-token') {
    uid = 'admin-local-uid';
  } else if (token === 'guest-non-admin-token') {
    uid = 'regular-guest-uid';
  } else if (token === 'local-dev-user' || token === 'local-dev-token') {
    uid = 'local-dev-user';
  }

  // Admin access is air-gapped strictly to local loopback (never granted over public tunnels)
  const isAdmin =
    !isTunnel &&
    (token === 'admin-token' || adminUids.includes(uid));

  req.user = {
    uid,
    email: `${uid}@vibediet.app`,
    isAdmin,
  };

  next();
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
