import { Hono, type Context } from 'hono';

const UPSTREAM = process.env.OMNIROUTE_UPSTREAM ?? 'http://localhost:20128';
const DEFAULT_ROLLOUT = Number(process.env.OMNI_WEB_STACK_ROLLOUT ?? '100');
const WEB_STACK_COOKIE = /(?:^|;\s*)web_stack=(svelte|next)/;

function shouldServeNext(cookieHeader: string | null): boolean {
  if (!cookieHeader) return false;
  const m = WEB_STACK_COOKIE.exec(cookieHeader);
  if (m) return m[1] === 'next';
  let h = 0;
  for (let i = 0; i < cookieHeader.length; i++) {
    h = (Math.imul(h, 31) + (cookieHeader.codePointAt(i) ?? 0)) % 2_147_483_647;
  }
  return Math.abs(h) % 100 >= DEFAULT_ROLLOUT;
}

async function forwardToUpstream(
  c: Context,
  upstreamPath: string,
  honorRollout: boolean,
) {
  if (honorRollout && shouldServeNext(c.req.header('cookie') ?? null)) {
    return c.json({
      message: 'This route is currently served by the Next.js frontend. Set web_stack=svelte or visit the upstream directly.',
      nextjs_upstream: UPSTREAM,
    }, 410);
  }

  const url = new URL(c.req.url);
  const upstreamUrl = `${UPSTREAM}${upstreamPath}${url.search}`;

  const headers = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    if (!['host', 'content-length'].includes(key.toLowerCase())) headers.set(key, value);
  });
  headers.set('x-proxied-by', 'argismonitor-bff');

  const init: RequestInit = {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
  };

  try {
    const upstream = await fetch(upstreamUrl, init);
    const responseHeaders = new Headers(upstream.headers);
    responseHeaders.set('x-proxied-by', 'argismonitor-bff');
    return new Response(upstream.body, { status: upstream.status, headers: responseHeaders });
  } catch (err) {
    return c.json({ error: 'upstream_unreachable', message: (err as Error).message }, 502);
  }
}

export const proxyRoutes = new Hono().all('/*', (c) => {
  const path = new URL(c.req.url).pathname.replace('/api/v1', '/v1');
  return forwardToUpstream(c, path, true);
});

export const authProxyRoutes = new Hono().all('/*', (c) => {
  const path = new URL(c.req.url).pathname;
  return forwardToUpstream(c, path, false);
});
