import { Hono } from 'hono';

const UPSTREAM = process.env.OMNIROUTE_UPSTREAM ?? 'http://localhost:20128';

export const proxyRoutes = new Hono().all('/*', async (c) => {
  const url = new URL(c.req.url);
  const upstreamUrl = `${UPSTREAM}${url.pathname.replace('/api/v1', '/v1')}${url.search}`;

  const headers = new Headers();
  c.req.raw.headers.forEach((value, key) => {
    if (!['host', 'content-length'].includes(key.toLowerCase())) {
      headers.set(key, value);
    }
  });

  const init: RequestInit = {
    method: c.req.method,
    headers,
    body: ['GET', 'HEAD'].includes(c.req.method) ? undefined : c.req.raw.body,
  };

  const upstream = await fetch(upstreamUrl, init);
  const responseHeaders = new Headers(upstream.headers);
  responseHeaders.set('x-proxied-by', 'omniroute-bff');

  return new Response(upstream.body, {
    status: upstream.status,
    headers: responseHeaders,
  });
});
