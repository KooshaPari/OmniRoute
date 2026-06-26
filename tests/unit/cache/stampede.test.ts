/**
 * Unit tests for cache stampede protection — PR-036
 *
 * Tests the stampedeGuard mechanism that prevents thundering-herd
 * effects when a popular cache key expires and N concurrent requests
 * all miss simultaneously.
 *
 * @module tests/unit/cache/stampede.test
 */

import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import {
  stampedeGuard,
  isInflight,
  inflightCount,
  clearInflight,
} from "../../../src/lib/cache/cacheStampede.ts";

describe("stampedeGuard", () => {
  before(() => clearInflight());
  after(() => clearInflight());

  // ── Basic single-caller path ────────────────────

  it("returns the generated value for a single caller", async () => {
    const result = await stampedeGuard("single", async () => "hello");
    assert.equal(result, "hello");
  });

  it("only calls the generator once per key", async () => {
    let callCount = 0;
    const results = await Promise.all([
      stampedeGuard("dedup", async () => {
        callCount++;
        await new Promise((r) => setTimeout(r, 30));
        return "value";
      }),
      stampedeGuard("dedup", async () => {
        // This should never execute — the first caller's promise is reused
        callCount++;
        return "wrong";
      }),
    ]);

    assert.equal(callCount, 1, "generator should be called exactly once");
    assert.equal(results[0], "value");
    assert.equal(results[1], "value", "second caller should get the same result");
  });

  it("releases the lock after generation completes", async () => {
    assert.equal(isInflight("release-key"), false);
    await stampedeGuard("release-key", async () => "done");
    assert.equal(isInflight("release-key"), false);
  });

  // ── Error propagation ───────────────────────────

  it("propagates generator errors to all waiters", async () => {
    const err = new Error("generator-failure");
    await assert.rejects(
      Promise.all([
        stampedeGuard("err-key", async () => { throw err; }),
        stampedeGuard("err-key", async () => "should-not-run"),
      ]),
      /generator-failure/,
    );
    // Lock should be released after error
    assert.equal(isInflight("err-key"), false);
  });

  // ── Lock timeout safety net ─────────────────────

  it("releases the lock after timeout if generator hangs", async () => {
    // Start a generation that never resolves
    stampedeGuard(
      "hang-key",
      async () => {
        await new Promise(() => {}); // never resolves
        return "never";
      },
      { lockTimeoutMs: 10 },
    );

    // Wait for the timeout to fire
    await new Promise((r) => setTimeout(r, 50));

    // The lock should be released so subsequent callers can try
    assert.equal(isInflight("hang-key"), false, "lock should be released after timeout");

    // Clean up any remaining state
    clearInflight();
  });

  // ── Introspection helpers ───────────────────────

  it("isInflight returns true while generation is in progress", async () => {
    let resolvePromise!: () => void;
    const genPromise = stampedeGuard("inflight-check", async () => {
      await new Promise<void>((r) => { resolvePromise = r; });
      return "resolved";
    });

    // Give the microtask a chance to set the lock
    await new Promise((r) => setImmediate(r));
    assert.equal(isInflight("inflight-check"), true);

    resolvePromise();
    await genPromise;
    assert.equal(isInflight("inflight-check"), false);
  });

  it("inflightCount returns the number of in-flight generations", async () => {
    let resolve1!: () => void;
    let resolve2!: () => void;

    const p1 = stampedeGuard("count-a", async () => {
      await new Promise<void>((r) => { resolve1 = r; });
      return "a";
    });
    const p2 = stampedeGuard("count-b", async () => {
      await new Promise<void>((r) => { resolve2 = r; });
      return "b";
    });

    await new Promise((r) => setImmediate(r));
    assert.equal(inflightCount(), 2);

    resolve1();
    await p1;
    assert.equal(inflightCount(), 1);

    resolve2();
    await p2;
    assert.equal(inflightCount(), 0);
  });

  it("clearInflight resets all in-flight locks", async () => {
    // Start two generations that never resolve
    stampedeGuard("zombie-a", () => new Promise(() => {}));
    stampedeGuard("zombie-b", () => new Promise(() => {}));

    await new Promise((r) => setImmediate(r));
    assert.equal(inflightCount(), 2);

    clearInflight();
    assert.equal(inflightCount(), 0);
    assert.equal(isInflight("zombie-a"), false);
    assert.equal(isInflight("zombie-b"), false);
  });
});
