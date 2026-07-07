/**
 * SvelteKit handle: Hono for /api/*, SvelteKit for everything else.
 * Paraglide lang negotiation, request ID, auth via session cookie.
 */
import { sequence } from '@sveltejs/kit/hooks';
import type { Handle, HandleFetch } from '@sveltejs/kit';
import { honoApp } from '$lib/server/hono/app';
import { negotiateLanguage } from '$lib/server/paraglide/negotiate';
import { getSession } from '$lib/server/auth/session';

const sessionAndLang: Handle = async ({ event, resolve }) => {
  event.locals.requestId = crypto.randomUUID();
  const lang = negotiateLanguage(event.request);
  const session = await getSession(event.cookies);
  event.locals.user = session?.user ?? null;
  return resolve(event, { transformPageChunk: ({ html }) => html.replace('%paraglide.lang%', lang) });
};

const honoDispatch: Handle = async ({ event, resolve }) => {
  const url = new URL(event.request.url);
  if (url.pathname.startsWith('/api/')) {
    return honoApp.fetch(event.request, {
      locals: event.locals,
      cookies: event.cookies,
      platform: event.platform,
    });
  }
  return resolve(event);
};

export const handle = sequence(sessionAndLang, honoDispatch);

export const handleFetch: HandleFetch = async ({ request, fetch, event }) => {
  // Allow Hono (running server-side) to call the kbridge Unix socket via BFF.
  return fetch(request);
};
