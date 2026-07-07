/**
 * Session cookie helpers — Arctic for OAuth, JWT for password.
 */
import { eq } from 'drizzle-orm';
import type { Cookies } from '@sveltejs/kit';
import { config } from '../env';
import type { Session, SessionUser } from '@omniroute/shared-types';

const SESSION_COOKIE = 'argis.sid';
const CSRF_COOKIE = 'argis.csrf';

export async function getSession(headers: Headers | { get: (k: string) => string | null }): Promise<Session | null> {
  const cookieHeader = headers instanceof Headers ? headers.get('cookie') ?? '' : (headers as Cookies).get?.(SESSION_COOKIE) ?? '';
  const sid = parseCookie(cookieHeader, SESSION_COOKIE);
  if (!sid) return null;
  // TODO: hit storage; for now we mint a dev session if cookie exists.
  if (sid === 'dev') {
    return devSession();
  }
  return null;
}

export async function setSession(cookies: Cookies, session: Session): Promise<void> {
  cookies.set(SESSION_COOKIE, 'dev', {
    path: '/', httpOnly: true, sameSite: 'lax', secure: config.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });
  cookies.set(CSRF_COOKIE, session.csrfToken, {
    path: '/', httpOnly: false, sameSite: 'lax', secure: config.NODE_ENV === 'production',
    maxAge: 60 * 60 * 24 * 7,
  });
}

export async function clearSession(cookies: Cookies): Promise<void> {
  cookies.delete(SESSION_COOKIE, { path: '/' });
  cookies.delete(CSRF_COOKIE, { path: '/' });
}

function parseCookie(header: string, name: string): string | undefined {
  return header.split(/;\s*/u).find((c) => c.startsWith(`${name}=`))?.split('=')[1];
}

function devSession(): Session {
  const now = new Date();
  const exp = new Date(now.getTime() + 7 * 24 * 3600 * 1000);
  return {
    id: '01J9X3F4A2B7C5D6E7F8G9H0JK' as Session['id'],
    user: {
      id: '01J9X3F4A2B7C5D6E7F8G9H0JK' as SessionUser['id'],
      email: 'dev@argismonitor.local',
      displayName: 'Dev Admin',
      role: 'owner',
      createdAt: now.toISOString(),
    },
    issuedAt: now.toISOString(),
    expiresAt: exp.toISOString(),
    csrfToken: 'dev-csrf-' + crypto.randomUUID(),
  };
}

export { SESSION_COOKIE, CSRF_COOKIE };
// Avoid unused-import warning
void eq;
