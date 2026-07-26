import { createHmac, timingSafeEqual } from 'node:crypto';
import type { Context, MiddlewareHandler, Next } from 'hono';
import { env } from '../env';

const BEARER = /^Bearer\s+([a-z0-9._-]{16,256})$/i;
const APIKEY = /^[A-Za-z0-9._-]{16,256}$/;
/** Upstream auth proxy sets `session=...` (see proxy Set-Cookie forwarding tests). */
const SESSION_COOKIE = /(?:^|;\s*)session=([^\s;]+)/i;

function verifyHmac(key: string): boolean {
  const expected = env.BFF_API_KEY;
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export interface AuthContext {
  keyPrefix: string;
  raw: string;
  /** How the request satisfied the production trust boundary. */
  via: 'api-key' | 'session-cookie';
}

/**
 * Production auth model (#392):
 * - Machine / automation: Bearer or x-api-key matching BFF_API_KEY
 * - Browser dashboard / tRPC: session cookie established via /api/auth/* (never BFF_API_KEY in the browser)
 */
export function hasBrowserSession(cookieHeader: string | undefined | null): boolean {
  if (!cookieHeader) return false;
  const match = SESSION_COOKIE.exec(cookieHeader);
  const value = match?.[1] ?? '';
  return value.length >= 8;
}

function unauthorized(c: Context) {
  return c.json(
    { ok: false, error: { code: 'UNAUTHORIZED', message: 'invalid or missing api key or session' } },
    401,
  );
}

export const requireAuth = (): MiddlewareHandler => async (c: Context, next: Next) => {
  const h = c.req.header('authorization') ?? '';
  const m = h.match(BEARER);
  const raw = m ? m[1] : c.req.header('x-api-key') ?? '';
  if (!raw || !APIKEY.test(raw) || !verifyHmac(raw)) {
    return unauthorized(c);
  }
  c.set('auth', { keyPrefix: raw.slice(0, 8), raw, via: 'api-key' } satisfies AuthContext);
  await next();
};

/** API key OR non-empty upstream session cookie (browser path). */
export const requireAuthOrSession = (): MiddlewareHandler => async (c: Context, next: Next) => {
  const h = c.req.header('authorization') ?? '';
  const m = h.match(BEARER);
  const raw = m ? m[1] : c.req.header('x-api-key') ?? '';
  if (raw && APIKEY.test(raw) && verifyHmac(raw)) {
    c.set('auth', { keyPrefix: raw.slice(0, 8), raw, via: 'api-key' } satisfies AuthContext);
    await next();
    return;
  }
  if (hasBrowserSession(c.req.header('cookie'))) {
    c.set('auth', { keyPrefix: 'session', raw: '', via: 'session-cookie' } satisfies AuthContext);
    await next();
    return;
  }
  return unauthorized(c);
};

export function getAuth(c: Context): AuthContext | undefined {
  return c.get('auth') as AuthContext | undefined;
}

/** HMAC-SHA256 helper for upstream signing. */
export function signPayload(secret: string, payload: string): string {
  return createHmac('sha256', secret).update(payload).digest('hex');
}
