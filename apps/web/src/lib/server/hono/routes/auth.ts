/**
 * /api/auth/login, /logout, /refresh
 */
import { Hono } from 'hono';
import { LoginRequest, LogoutRequest, Session } from '@omniroute/shared-types';
import { setSession, clearSession } from '../../auth/session';

export const authRoute = new Hono()
  .post('/login', async (c) => {
    const body = LoginRequest.parse(await c.req.json());
    if (body.kind === 'password') {
      // TODO: argon2 verify against storage
      const session: Session = {
        id: '01J9X3F4A2B7C5D6E7F8G9H0JK' as Session['id'],
        user: {
          id: '01J9X3F4A2B7C5D6E7F8G9H0JK' as Session['user']['id'],
          email: body.email,
          displayName: body.email.split('@')[0],
          role: 'owner',
          createdAt: new Date().toISOString(),
        },
        issuedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 7 * 86400_000).toISOString(),
        csrfToken: crypto.randomUUID(),
      };
      await setSession(c as unknown as { req: { raw: { headers: Headers } }, env: unknown }, session);
      return c.json({ ok: true, data: session });
    }
    return c.json({ ok: false, error: { code: 'AUTH_PROVIDER_ERROR', message: `oauth ${body.provider} not yet wired` } }, 501);
  })
  .post('/logout', async (c) => {
    const _body = LogoutRequest.parse((await c.req.json().catch(() => ({}))) ?? {});
    await clearSession(c as unknown as { req: { raw: { headers: Headers } }, env: unknown });
    return c.json({ ok: true, data: { loggedOut: true } });
  })
  .get('/me', (c) => c.json({ ok: true, data: c.get('user') }));
