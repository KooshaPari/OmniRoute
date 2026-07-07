/**
 * Token-bucket rate limiter. In-memory; per-process.
 * For multi-replica deployments swap with Redis-backed.
 */
import { createMiddleware } from 'hono/factory';

type Bucket = { tokens: number; updatedAt: number };
const buckets = new Map<string, Bucket>();
const CAPACITY = 600; // tokens
const REFILL_PER_SEC = 10;

export const ratelimitMiddleware = createMiddleware(async (c, next) => {
  const key = c.get('user')?.id ?? c.req.header('x-forwarded-for') ?? 'anonymous';
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: CAPACITY, updatedAt: now };
  const elapsed = (now - b.updatedAt) / 1000;
  b.tokens = Math.min(CAPACITY, b.tokens + elapsed * REFILL_PER_SEC);
  b.updatedAt = now;
  if (b.tokens < 1) {
    return c.json({ ok: false, error: { code: 'RATE_LIMITED', message: 'slow down', retryAfterSeconds: 1 } }, 429);
  }
  b.tokens -= 1;
  buckets.set(key, b);
  await next();
});
