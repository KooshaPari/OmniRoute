// ── TokenBucket — lightweight token-based rate limiter ────────────────────────
//
// Bottleneck's reservoir is request-count based, not token-count based.
// This class provides a simple token bucket that refills continuously over time,
// suitable for TPM (tokens-per-minute) and TPD (tokens-per-day) enforcement.

export class TokenBucket {
  private _capacity: number;
  private _refillRatePerMs: number;
  private _tokens: number;
  private _lastRefillAt: number;

  /**
   * @param capacity       Maximum token count (bucket ceiling).
   * @param refillRatePerMs Tokens added per millisecond (e.g. 1/60000 for 1 TPM).
   */
  constructor(capacity: number, refillRatePerMs: number) {
    this._capacity = capacity;
    this._refillRatePerMs = refillRatePerMs;
    this._tokens = capacity;
    this._lastRefillAt = Date.now();
  }

  /** Current available tokens (lazily refilled on read). */
  get currentTokens(): number {
    this._refill();
    return this._tokens;
  }

  /**
   * Attempt to consume `tokens` from the bucket.
   * Returns `true` if successful, `false` if insufficient tokens.
   */
  tryConsume(tokens: number): boolean {
    this._refill();
    if (tokens <= 0) {
      // Zero or negative consumption always allowed; no state change needed
      // unless the bucket itself has zero capacity.
      return this._capacity > 0 || this._tokens >= 0;
    }
    if (this._tokens < tokens) return false;
    this._tokens -= tokens;
    return true;
  }

  private _refill(): void {
    if (this._refillRatePerMs <= 0) return;
    const now = Date.now();
    const elapsed = now - this._lastRefillAt;
    if (elapsed <= 0) return;
    this._tokens = Math.min(this._capacity, this._tokens + elapsed * this._refillRatePerMs);
    this._lastRefillAt = now;
  }
}
