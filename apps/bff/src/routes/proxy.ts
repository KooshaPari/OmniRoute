import { Hono, type Context } from 'hono';

import { env } from '../env';

const WEB_STACK_COOKIE = /(?:^|;\s*)web_stack=(svelte|next)/;

const HOP_BY_HOP_HEADERS = new Set([
  'connection',
  'content-length',
  'host',
  'keep-alive',
  'proxy-authenticate',
  'proxy-authorization',
  'te',
  'trailer',
  'transfer-encoding',
  'upgrade',
]);

function shouldServeNext(cookieHeader: string | null, rollout: number): boolean {
  if (!cookieHeader) return false;
  const match = WEB_STACK_COOKIE.exec(cookieHeader);
  if (match) return match[1] === 'next';

  let hash = 0;
  for (let i = 0; i < cookieHeader.length; i++) {
    hash = (Math.imul(hash, 31) + (cookieHeader.codePointAt(i) ?? 0)) % 2_147_483_647;
  }
  return Math.abs(hash) % 100 >= rollout;
}

function proxyHeaders(source: Headers): Headers {
  const headers = new Headers();
  const connectionHeaders = new Set(
    (source.get('connection') ?? '')
      .split(',')
      .map((header) => header.trim().toLowerCase())
      .filter(Boolean),
  );

  source.forEach((value, key) => {
    const normalizedKey = key.toLowerCase();
    if (normalizedKey === 'set-cookie') return;
    if (!HOP_BY_HOP_HEADERS.has(normalizedKey) && !connectionHeaders.has(normalizedKey)) {
      headers.set(key, value);
    }
  });

  type HeadersWithSetCookie = Headers & { getSetCookie?: () => string[] };
  const getSetCookie = (source as HeadersWithSetCookie).getSetCookie;
  const cookies = getSetCookie
    ? getSetCookie.call(source)
    : [source.get('set-cookie')].filter((cookie): cookie is string => cookie !== null);
  for (const cookie of cookies) {
    headers.append('set-cookie', cookie);
  }

  return headers;
}

type ProxyOptions = {
  upstream?: string;
  rollout?: number;
  timeoutMs?: number;
};

async function forwardToUpstream(
  c: Context,
  upstreamPath: string,
  {
    upstream = env.OMNIROUTE_UPSTREAM,
    rollout = Number(process.env.OMNI_WEB_STACK_ROLLOUT ?? '100'),
    timeoutMs = env.BFF_UPSTREAM_TIMEOUT_MS,
  }: ProxyOptions,
  honorRollout: boolean,
) {
  if (honorRollout && shouldServeNext(c.req.header('cookie') ?? null, rollout)) {
    return c.json({
      message: 'This route is currently served by the Next.js frontend. Set web_stack=svelte or visit the upstream directly.',
      nextjs_upstream: upstream,
    }, 410);
  }

  const requestUrl = new URL(c.req.url);
  const base = upstream.endsWith('/') ? upstream.slice(0, -1) : upstream;
  const path = upstreamPath.startsWith('/') ? upstreamPath : `/${upstreamPath}`;
  const upstreamUrl = `${base}${path}${requestUrl.search}`;
  const headers = proxyHeaders(c.req.raw.headers);
  headers.set('x-proxied-by', 'argismonitor-bff');

  const controller = new AbortController();
  const abortUpstream = () => controller.abort(c.req.raw.signal.reason);
  if (c.req.raw.signal.aborted) {
    abortUpstream();
  } else {
    c.req.raw.signal.addEventListener('abort', abortUpstream, { once: true });
  }
  const timeout = setTimeout(() => controller.abort(new Error('upstream_timeout')), timeoutMs);

  const init: RequestInit = {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
    signal: controller.signal,
  };

  try {
    const upstreamResponse = await fetch(upstreamUrl, init);
    const responseHeaders = proxyHeaders(upstreamResponse.headers);
    responseHeaders.set('x-proxied-by', 'argismonitor-bff');
    return new Response(upstreamResponse.body, {
      status: upstreamResponse.status,
      headers: responseHeaders,
    });
  } catch (error) {
    if (c.req.raw.signal.aborted) {
      return new Response(null, { status: 499 });
    }
    if (controller.signal.aborted) {
      return c.json({
        error: 'upstream_timeout',
        message: 'Upstream request timed out',
      }, 504);
    }
    return c.json({
      error: 'upstream_unreachable',
      message: (error as Error).message,
    }, 502);
  } finally {
    clearTimeout(timeout);
    c.req.raw.signal.removeEventListener('abort', abortUpstream);
  }
}

export function createProxyRoutes(options: ProxyOptions = {}) {
  return new Hono().all('/*', (c) => {
    const path = new URL(c.req.url).pathname.replace('/api/v1', '/v1');
    return forwardToUpstream(c, path, options, true);
  });
}

export function createAuthProxyRoutes(options: ProxyOptions = {}) {
  return new Hono().all('/*', (c) => {
    const path = new URL(c.req.url).pathname;
    return forwardToUpstream(c, path, options, false);
  });
}

export const proxyRoutes = createProxyRoutes();
export const authProxyRoutes = createAuthProxyRoutes();
