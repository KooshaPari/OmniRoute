import test from "node:test";
import assert from "node:assert/strict";

import { SlidingWindowRateLimiter } from "../../src/shared/utils/slidingWindowRateLimiter.ts";

function makeClock(start = 0) {
  let t = start;
  return {
    now: () => t,
    set: (value: number) => {
      t = value;
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

test("invalid config throws", () => {
  assert.throws(() => new SlidingWindowRateLimiter({ limit: 0, windowMs: 1000 }), /limit/);
  assert.throws(() => new SlidingWindowRateLimiter({ limit: -1, windowMs: 1000 }), /limit/);
  assert.throws(
    () => new SlidingWindowRateLimiter({ limit: Number.NaN, windowMs: 1000 }),
    /limit/
  );
  assert.throws(() => new SlidingWindowRateLimiter({ limit: 1, windowMs: 0 }), /windowMs/);
  assert.throws(() => new SlidingWindowRateLimiter({ limit: 1, windowMs: -5 }), /windowMs/);
  assert.throws(
    () => new SlidingWindowRateLimiter({ limit: 1, windowMs: Number.POSITIVE_INFINITY }),
    /windowMs/
  );
  assert.throws(
    () => new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, maxKeys: 0 }),
    /maxKeys/
  );
  assert.throws(
    () => new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, maxKeys: -2 }),
    /maxKeys/
  );
});

test("boundary behavior: consume denies when count is already at limit", () => {
  const clock = makeClock(1000);
  const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });

  const first = limiter.consume("k");
  assert.deepEqual(first, { allowed: true, remaining: 1, resetAt: 2000, retryAfterMs: 0 });

  const second = limiter.consume("k");
  assert.deepEqual(second, { allowed: true, remaining: 0, resetAt: 2000, retryAfterMs: 0 });

  // At limit: deny (not allowed even "at" limit)
  const third = limiter.consume("k");
  assert.deepEqual(third, { allowed: false, remaining: 0, resetAt: 2000, retryAfterMs: 1000 });
});

test("check does not consume and reports same state for repeated checks", () => {
  const clock = makeClock(500);
  const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 100, now: clock.now });

  const c1 = limiter.check("k");
  assert.deepEqual(c1, { allowed: true, remaining: 1, resetAt: 500, retryAfterMs: 0 });
  const c2 = limiter.check("k");
  assert.deepEqual(c2, c1);

  const used = limiter.consume("k");
  assert.deepEqual(used, { allowed: true, remaining: 0, resetAt: 600, retryAfterMs: 0 });

  const blocked = limiter.check("k");
  assert.deepEqual(blocked, { allowed: false, remaining: 0, resetAt: 600, retryAfterMs: 100 });
  const blockedAgain = limiter.check("k");
  assert.deepEqual(blockedAgain, blocked);
});

test("per-key isolation", () => {
  const clock = makeClock(0);
  const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 1000, now: clock.now });

  assert.equal(limiter.consume("a").allowed, true);
  assert.equal(limiter.consume("a").allowed, false);

  assert.equal(limiter.consume("b").allowed, true);
  assert.equal(limiter.check("b").allowed, false);
  assert.equal(limiter.check("a").allowed, false);
});

test("expiry and reset use sliding window oldest timestamp", () => {
  const clock = makeClock(1000);
  const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 1000, now: clock.now });

  assert.equal(limiter.consume("k").allowed, true); // t=1000
  clock.set(1400);
  assert.equal(limiter.consume("k").allowed, true); // t=1400

  let denied = limiter.consume("k");
  assert.equal(denied.allowed, false);
  assert.equal(denied.resetAt, 2000); // oldest (1000) + window
  assert.equal(denied.retryAfterMs, 600);

  // At 2000, timestamp at 1000 is expired (<= cutoff), so one slot frees.
  clock.set(2000);
  const allowedAfterFirstExpiry = limiter.consume("k");
  assert.deepEqual(allowedAfterFirstExpiry, {
    allowed: true,
    remaining: 0,
    resetAt: 2400, // now oldest is 1400
    retryAfterMs: 0,
  });

  // Still blocked until 1400 expires.
  denied = limiter.consume("k");
  assert.equal(denied.allowed, false);
  assert.equal(denied.resetAt, 2400);
  assert.equal(denied.retryAfterMs, 400);

  // At 2400, timestamp at 1400 expires as well (<= cutoff), leaving [2000] before consume.
  clock.set(2400);
  const allowedAfterSecondExpiry = limiter.consume("k");
  assert.equal(allowedAfterSecondExpiry.allowed, true);
  assert.equal(allowedAfterSecondExpiry.remaining, 0);
  assert.equal(allowedAfterSecondExpiry.resetAt, 3000); // oldest remaining is 2000
});

test("retryAfterMs is zero after expiry even when clock jumps far past resetAt", () => {
  const clock = makeClock(0);
  const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 100, now: clock.now });
  limiter.consume("k");

  clock.set(1000);
  const result = limiter.consume("k");
  assert.equal(result.allowed, true);
  assert.equal(result.retryAfterMs, 0);
  assert.equal(result.resetAt, 1100);
});

test("prunes expired timestamps on access so stale history does not count", () => {
  const clock = makeClock(0);
  const limiter = new SlidingWindowRateLimiter({ limit: 3, windowMs: 100, now: clock.now });

  assert.equal(limiter.consume("k").allowed, true); // 0
  clock.set(10);
  assert.equal(limiter.consume("k").allowed, true); // 10
  clock.set(20);
  assert.equal(limiter.consume("k").allowed, true); // 20
  assert.equal(limiter.consume("k").allowed, false);

  clock.set(111); // cutoff=11, so timestamps at 0 and 10 expire; 20 is still active
  const check = limiter.check("k");
  assert.deepEqual(check, { allowed: true, remaining: 2, resetAt: 120, retryAfterMs: 0 });

  const consume = limiter.consume("k");
  assert.deepEqual(consume, { allowed: true, remaining: 1, resetAt: 120, retryAfterMs: 0 });
});

test("maxKeys evicts fully-expired keys first (oldest last-access) when adding a new key", () => {
  const clock = makeClock(0);
  const limiter = new SlidingWindowRateLimiter({ limit: 1, windowMs: 100, maxKeys: 2, now: clock.now });

  assert.equal(limiter.consume("a").allowed, true); // a expires at 100
  clock.set(10);
  assert.equal(limiter.consume("b").allowed, true); // b expires at 110, b becomes MRU

  clock.set(150); // both expired; eviction prefers fully-expired key with oldest lastAccess => "a"
  assert.equal(limiter.consume("c").allowed, true);

  // "b" remained (expired) and "c" is active; "b" should be usable again as a fresh key.
  clock.set(300);
  const b = limiter.consume("b");
  assert.equal(b.allowed, true);
  assert.equal(b.remaining, 0);
  assert.equal(b.resetAt, 400);

  // "a" was evicted earlier; it must behave as a fresh key.
  const a = limiter.consume("a");
  assert.equal(a.allowed, true);
  assert.equal(a.remaining, 0);
  assert.equal(a.resetAt, 400);
});

test("maxKeys evicts least-recently-used key when no fully-expired key exists", () => {
  const clock = makeClock(0);
  const limiter = new SlidingWindowRateLimiter({ limit: 5, windowMs: 1000, maxKeys: 2, now: clock.now });

  assert.equal(limiter.consume("a").allowed, true); // a is LRU after b is added
  clock.set(10);
  assert.equal(limiter.consume("b").allowed, true);

  // Touch a so b becomes LRU.
  clock.set(20);
  assert.equal(limiter.check("a").allowed, true);

  clock.set(30);
  assert.equal(limiter.consume("c").allowed, true); // should evict b (LRU, not expired)

  // b was evicted, so it should behave as fresh key with full allowance.
  // Adding b now evicts the current LRU ("a"), while "c" remains.
  const bFresh = limiter.consume("b");
  assert.equal(bFresh.allowed, true);
  assert.equal(bFresh.remaining, 4);
  assert.equal(bFresh.resetAt, 1030);

  const cState = limiter.check("c");
  assert.equal(cState.allowed, true);
  assert.equal(cState.remaining, 4);
  assert.equal(cState.resetAt, 1030);

  // "a" was evicted when "b" was added back, so it is fresh now.
  const aFresh = limiter.check("a");
  assert.deepEqual(aFresh, { allowed: true, remaining: 5, resetAt: 30, retryAfterMs: 0 });
});

test("new empty key gets resetAt equal to now and no retry delay", () => {
  const clock = makeClock(1234);
  const limiter = new SlidingWindowRateLimiter({ limit: 2, windowMs: 500, now: clock.now });
  const result = limiter.check("fresh");
  assert.deepEqual(result, { allowed: true, remaining: 2, resetAt: 1234, retryAfterMs: 0 });
});
