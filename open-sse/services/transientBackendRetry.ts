import { randomUUID } from "node:crypto";

/**
 * Transient HTTP status codes that suggest the upstream is briefly unavailable
 * (e.g. OmniRoute backend returning 503 while it's restarting or under load).
 *
 * Treat as retryable when:
 *  - 502 Bad Gateway    — proxy received an invalid upstream response
 *  - 503 Service Unavailable — upstream temporarily overloaded / maintenance
 *  - 504 Gateway Timeout — upstream took too long to respond
 *  - 429 Too Many Requests — explicit rate-limit (handled separately by cooldown logic,
 *                             but we include it here so retry-with-jitter is the same code path)
 *
 * Non-retryable:
 *  - 4xx (auth, validation, not-found, etc.) — user must fix, retrying is harmful
 *  - 501 Not Implemented — endpoint doesn't support this method, retrying is futile
 */
export const TRANSIENT_BACKEND_STATUS_CODES = new Set<number>([
  429, 502, 503, 504,
]);

/** Returns true if a status code suggests a transient backend failure worth retrying. */
export function isTransientBackendStatusCode(status: number | null | undefined): boolean {
  if (status == null || !Number.isFinite(status)) return false;
  return TRANSIENT_BACKEND_STATUS_CODES.has(status);
}

/** Default config for retry-with-jitter inside a single combo target attempt. */
export interface TransientBackendRetryConfig {
  /** Maximum number of attempts (initial + retries). Default 3. */
  maxAttempts: number;
  /** Base delay (ms) before the first retry. Default 250. */
  baseDelayMs: number;
  /** Maximum delay (ms) between attempts. Default 4000. */
  maxDelayMs: number;
  /** Overall cap (ms) for cumulative wait time across all retries. Default 10000. */
  budgetMs: number;
  /** Optional abort signal so cancellation propagates. */
  signal?: AbortSignal | null;
}

const DEFAULTS: Omit<TransientBackendRetryConfig, "signal"> = {
  maxAttempts: 3,
  baseDelayMs: 250,
  maxDelayMs: 4000,
  budgetMs: 10000,
};

/**
 * Compute the wait time (ms) before the next retry using decorrelated jitter
 * (AWS Architecture Blog: "Exponential Backoff and Jitter").
 *
 * Formula: sleep = min(cap, random_between(base, sleep_prev * 3))
 * For first retry, sleep_prev = base.
 */
export function computeRetryDelay(
  attempt: number,
  config: TransientBackendRetryConfig
): number {
  const base = config.baseDelayMs;
  const cap = config.maxDelayMs;
  // Decorrelated jitter (per AWS): pick a sleep between base and (prev * 3),
  // capped at maxDelayMs.
  const exponential = base * Math.pow(3, attempt - 1);
  const upper = Math.min(cap, exponential);
  const lower = base;
  return lower + Math.random() * Math.max(0, upper - lower);
}

/** Helper that sleeps for `ms` and resolves false if the signal aborted. */
export function sleep(ms: number, signal?: AbortSignal | null): Promise<boolean> {
  if (signal?.aborted) return Promise.resolve(false);
  if (!Number.isFinite(ms) || ms <= 0) return Promise.resolve(!signal?.aborted);
  return new Promise((resolve) => {
    const id = setTimeout(() => {
      signal?.removeEventListener("abort", onAbort);
      resolve(!signal?.aborted);
    }, ms);
    const onAbort = () => {
      clearTimeout(id);
      signal?.removeEventListener("abort", onAbort);
      resolve(false);
    };
    signal?.addEventListener("abort", onAbort, { once: true });
  });
}

/**
 * Wrap a function that returns a `status` (and optionally a body) so that
 * transient 5xx responses are retried with decorrelated jitter, bounded by
 * a total time budget. The function is invoked at most `maxAttempts` times.
 *
 * @example
 * const r = await withTransientBackendRetry(async () => {
 *   const res = await fetch(url, init);
 *   return { status: res.status, body: await res.text() };
 * });
 * if (!r.ok) throw new Error(`upstream returned ${r.status}`);
 *
 * @returns the result of the first non-transient call, or the last call if
 *          every attempt was transient. `ok` is true iff a non-transient
 *          response was returned.
 */
export interface TransientBackendRetryResult<T> {
  ok: boolean;
  status: number | null | undefined;
  attempts: number;
  totalWaitMs: number;
  correlationId: string;
  value: T;
}

export async function withTransientBackendRetry<T>(
  fn: () => Promise<{ status: number | null | undefined; value: T }>,
  config: Partial<TransientBackendRetryConfig> = {}
): Promise<TransientBackendRetryResult<T>> {
  const cfg: TransientBackendRetryConfig = { ...DEFAULTS, ...config };
  const correlationId = randomUUID();
  const start = Date.now();

  let attempts = 0;
  let lastResult: TransientBackendRetryResult<T> | null = null;

  while (attempts < cfg.maxAttempts) {
    if (cfg.signal?.aborted) break;
    attempts += 1;

    let result;
    try {
      result = await fn();
    } catch (err) {
      // Network-level failure (e.g. socket reset, DNS error) — treat as transient
      // and retry if budget remains.
      const totalWaitMs = Date.now() - start;
      if (totalWaitMs >= cfg.budgetMs || attempts >= cfg.maxAttempts) {
        return {
          ok: false,
          status: null,
          attempts,
          totalWaitMs,
          correlationId,
          value: undefined as unknown as T,
        };
      }
      const wait = computeRetryDelay(attempts, cfg);
      const remaining = cfg.budgetMs - totalWaitMs;
      const slept = await sleep(Math.min(wait, remaining), cfg.signal);
      if (!slept) break;
      continue;
    }

    const { status, value } = result;
    const transient = isTransientBackendStatusCode(status);

    if (!transient) {
      return {
        ok: true,
        status,
        attempts,
        totalWaitMs: Date.now() - start,
        correlationId,
        value,
      };
    }

    lastResult = {
      ok: false,
      status,
      attempts,
      totalWaitMs: Date.now() - start,
      correlationId,
      value,
    };

    if (attempts >= cfg.maxAttempts) break;
    const elapsed = Date.now() - start;
    const remaining = cfg.budgetMs - elapsed;
    if (remaining <= 0) break;
    const wait = computeRetryDelay(attempts, cfg);
    const slept = await sleep(Math.min(wait, remaining), cfg.signal);
    if (!slept) break;
  }

  // Every attempt was transient (or aborted). Return the last result so the
  // caller can surface the most informative error to the user.
  return (
    lastResult ?? {
      ok: false,
      status: null,
      attempts,
      totalWaitMs: Date.now() - start,
      correlationId,
      value: undefined as unknown as T,
    }
  );
}
