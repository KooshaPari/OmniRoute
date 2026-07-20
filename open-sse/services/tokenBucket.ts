/** Continuously refilled token bucket for TPM and TPD enforcement. */
export class TokenBucket {
  private tokens: number;
  private lastRefillAt: number;

  constructor(
    private readonly capacity: number,
    private readonly refillRatePerMs: number
  ) {
    this.tokens = capacity;
    this.lastRefillAt = Date.now();
  }

  get currentTokens(): number {
    this.refill();
    return this.tokens;
  }

  tryConsume(tokens: number): boolean {
    this.refill();
    if (tokens <= 0) return this.capacity > 0 || this.tokens >= 0;
    if (this.tokens < tokens) return false;
    this.tokens -= tokens;
    return true;
  }

  private refill(): void {
    if (this.refillRatePerMs <= 0) return;
    const now = Date.now();
    const elapsed = now - this.lastRefillAt;
    if (elapsed <= 0) return;
    this.tokens = Math.min(this.capacity, this.tokens + elapsed * this.refillRatePerMs);
    this.lastRefillAt = now;
  }
}
