import type { Context, MiddlewareHandler, Next } from 'hono';

const HEADER = 'x-request-id';
const VALID = /^[A-Za-z0-9_-]{8,128}$/;

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export const requestId = (): MiddlewareHandler => async (c: Context, next: Next) => {
  const incoming = c.req.header(HEADER);
  const id = incoming && VALID.test(incoming) ? incoming : generateRequestId();
  c.set('requestId', id);
  c.header(HEADER, id);
  await next();
};

export function getRequestId(c: Context): string {
  return (c.get('requestId') as string) ?? generateRequestId();
}
