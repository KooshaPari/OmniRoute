import cacheService from '../cache/redis';

/**
 * Distributed idempotency helpers. Best-effort using Redis if enabled; otherwise no-op.
 * Keys should be short, URL-safe strings. TTL in seconds.
 */
export async function tryAcquireIdempotencyKey(key: string, ttlSeconds: number): Promise<boolean> {
  try {
    // Prefer Redis NX when available
    if (await cacheService.healthCheck()) {
      if (typeof (cacheService as any).setNX === 'function') {
        return await (cacheService as any).setNX(key, '1', ttlSeconds);
      }
    }
  } catch {}
  // Fallback: allow local-only acquisition; return true to proceed
  return true;
}

export async function releaseIdempotencyKey(key: string): Promise<void> {
  try {
    if (await cacheService.healthCheck()) {
      if (typeof (cacheService as any).del === 'function') {
        await (cacheService as any).del(key);
        return;
      }
    }
  } catch {}
}

export function makeIssueIdempotencyKey(parts: { forumId: string; title: string; submitterId: string }): string {
  const t = (parts.title || '').trim().toLowerCase();
  return `issue:idemp:${parts.forumId}:${t}:${parts.submitterId || 'unknown'}`;
}

