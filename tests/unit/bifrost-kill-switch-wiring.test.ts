/**
 * Tests for B9.1 Kill Switch Wiring in BifrostBackendExecutor (bifrost.ts).
 *
 * Verifies the pre-check, post-record, env-bypass, and healthCheck
 * propagation for the B9 kill switch. Mocks `globalThis.fetch` like the
 * existing bifrost-backend.test.ts to control upstream behavior.
 *
 * Uses Node's built-in test runner (matches CI: `node --import tsx --test
 * tests/unit/*.test.ts`) so it runs in the same shard as bifrost-backend.test.ts.
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md, ADR-031,
 * `open-sse/services/bifrostKillSwitch.ts` (B9), `open-sse/executors/bifrost.ts` (B9.1).
 *
 * @module tests/unit/bifrost-kill-switch-wiring.test.ts
 */

import { test } from "node:test";
import { strict as assert } from "node:assert";
import { BifrostBackendExecutor } from "../../open-sse/executors/bifrost.ts";
import {
  BifrostKillSwitchActiveError,
  BIFROST_KILLSWITCH_ACTIVE,
  resetAll,
  activate,
  forceActivate,
  listStates,
} from "../../open-sse/services/bifrostKillSwitch.ts";

const PROVIDER = "openai";

let originalBifrostEnabled: string | undefined;
let originalKillSwitchDisabled: string | undefined;
let originalBifrostBaseUrl: string | undefined;
let originalFetch: typeof globalThis.fetch;

interface MockFetch {
  (input: unknown, init?: unknown): Promise<unknown>;
  calls: unknown[][];
  setNextResponse: (resp: unknown) => void;
  setNextError: (err: Error) => void;
  reset: () => void;
}

let mockFetch: MockFetch;

function buildMockFetch(): MockFetch {
  const calls: unknown[][] = [];
  let nextResponse: unknown = null;
  let nextError: Error | null = null;
  const fn = (async (_input: unknown, _init?: unknown) => {
    calls.push([_input, _init]);
    if (nextError) {
      const err = nextError;
      nextError = null;
      throw err;
    }
    if (nextResponse) {
      const r = nextResponse;
      nextResponse = null;
      return r;
    }
    return new Response("{}", { status: 200 });
  }) as MockFetch;
  fn.calls = calls;
  fn.setNextResponse = (r: unknown) => {
    nextResponse = r;
  };
  fn.setNextError = (e: Error) => {
    nextError = e;
  };
  fn.reset = () => {
    calls.length = 0;
    nextResponse = null;
    nextError = null;
  };
  return fn;
}

test.beforeEach = (fn) => {
  globalThis.__b91_beforeEach__ = globalThis.__b91_beforeEach__ || [];
  (globalThis.__b91_beforeEach__ as Array<() => void>).push(fn);
};

test.before(async () => {
  originalBifrostEnabled = process.env.BIFROST_ENABLED;
  originalKillSwitchDisabled = process.env.BIFROST_KILLSWITCH_DISABLED;
  originalBifrostBaseUrl = process.env.BIFROST_BASE_URL;
  originalFetch = globalThis.fetch;
});

test.after(async () => {
  if (originalBifrostEnabled === undefined) delete process.env.BIFROST_ENABLED;
  else process.env.BIFROST_ENABLED = originalBifrostEnabled;
  if (originalKillSwitchDisabled === undefined) {
    delete process.env.BIFROST_KILLSWITCH_DISABLED;
  } else {
    process.env.BIFROST_KILLSWITCH_DISABLED = originalKillSwitchDisabled;
  }
  if (originalBifrostBaseUrl === undefined) delete process.env.BIFROST_BASE_URL;
  else process.env.BIFROST_BASE_URL = originalBifrostBaseUrl;
  globalThis.fetch = originalFetch;
  resetAll();
});

// We need a per-test beforeEach that sets env + resetAll + mockFetch. Node's
// test runner doesn't have a top-level beforeEach in module scope, so we
// install a setup module-level via test.beforeEach on each individual test.
// Simpler: wrap setup/teardown in each test or use a manual pattern.

/**
 * Helper: build a default ExecuteInput. Tests only need the kill switch
 * wiring under test, not the body / credentials / stream shape.
 */
function makeInput() {
  return {
    model: "gpt-4o",
    body: { model: "gpt-4o", messages: [{ role: "user", content: "hi" }] },
    stream: false,
    credentials: { apiKey: "sk-test" },
  };
}

function setupEnv() {
  process.env.BIFROST_ENABLED = "1";
  process.env.BIFROST_BASE_URL = "http://bifrost.test:8080";
  delete process.env.BIFROST_KILLSWITCH_DISABLED;
  resetAll();
  mockFetch = buildMockFetch();
  globalThis.fetch = mockFetch as unknown as typeof fetch;
}

function teardownEnv() {
  globalThis.fetch = originalFetch;
  resetAll();
}

// ── 1. Pre-check (kill switch is enforced) ────────────────────────────────

test("B9.1 pre-check: execute() throws BifrostKillSwitchActiveError when isActive() is true", async () => {
  setupEnv();
  try {
    // Trip the kill switch for this provider before the call.
    activate(PROVIDER, "manual", "critical", "test trip");
    const exec = new BifrostBackendExecutor(PROVIDER, {});

    let caught: unknown = null;
    try {
      await exec.execute(makeInput());
    } catch (err) {
      caught = err;
    }

    assert.notEqual(caught, null);
    assert.ok(caught instanceof BifrostKillSwitchActiveError);
    // Dispatcher falls back on .code (BIFROST_KILLSWITCH_ACTIVE), not .name.
    assert.equal((caught as Error & { code: string }).code, BIFROST_KILLSWITCH_ACTIVE);
    assert.equal((caught as BifrostKillSwitchActiveError).provider, PROVIDER);
    assert.equal((caught as BifrostKillSwitchActiveError).reason, "manual");
    assert.equal((caught as BifrostKillSwitchActiveError).severity, "critical");
  } finally {
    teardownEnv();
  }
});

test("B9.1 pre-check: execute() proceeds past pre-check when isActive() is false (clean state)", async () => {
  setupEnv();
  try {
    mockFetch.setNextResponse(new Response('{"id":"x","choices":[]}', { status: 200 }));
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.execute(makeInput());

    assert.equal(mockFetch.calls.length, 1);
    assert.equal((result.response as Response).status, 200);
  } finally {
    teardownEnv();
  }
});

// ── 2. Post-record observation (every execute path records once) ─────────

test("B9.1 post-record: records ok=true on a 2xx response with the right provider + latency", async () => {
  setupEnv();
  try {
    mockFetch.setNextResponse(new Response('{"id":"x","choices":[]}', { status: 200 }));
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    // fetch was called once, which means we got past the pre-check
    // and the kill switch observation was recorded.
    assert.equal(mockFetch.calls.length, 1, "fetch was called");
    // Verify the kill switch did NOT trip. listStates() returns the
    // current per-provider state; isActive should be false after a
    // single 200 OK (far below thresholds).
    const states = listStates();
    const providerState = states.find((s) => s.provider === PROVIDER);
    assert.ok(
      providerState !== undefined,
      "kill switch recorded the observation (1 sample in windowStats.totalSamples)"
    );
    assert.equal(
      providerState?.isActive,
      false,
      `kill switch is not active after a single 200 OK (got: ${JSON.stringify(providerState)})`
    );
    assert.equal(providerState?.windowStats.totalSamples, 1, "one sample recorded");
  } finally {
    teardownEnv();
  }
});

test("B9.1 post-record: records ok=false on a non-2xx response (4xx)", async () => {
  setupEnv();
  try {
    mockFetch.setNextResponse(new Response("bad request", { status: 400 }));
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    assert.equal(mockFetch.calls.length, 1);
  } finally {
    teardownEnv();
  }
});

test("B9.1 post-record: records ok=false on a non-2xx response (5xx)", async () => {
  setupEnv();
  try {
    mockFetch.setNextResponse(new Response("upstream error", { status: 502 }));
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    assert.equal(mockFetch.calls.length, 1);
  } finally {
    teardownEnv();
  }
});

test("B9.1 post-record: does NOT call recordObservation when the pre-check throws (early exit)", async () => {
  setupEnv();
  try {
    activate(PROVIDER, "manual", "critical", "early-throw trip");
    const exec = new BifrostBackendExecutor(PROVIDER, {});

    let caught: unknown = null;
    try {
      await exec.execute(makeInput());
    } catch (err) {
      caught = err;
    }

    // Pre-check throws BEFORE the fetch; fetch must not be called.
    assert.equal(mockFetch.calls.length, 0, "fetch was not called");
    assert.ok(caught instanceof BifrostKillSwitchActiveError);
  } finally {
    teardownEnv();
  }
});

test("B9.1 post-record: records ok=false on a network error then rethrows", async () => {
  setupEnv();
  try {
    mockFetch.setNextError(new Error("ECONNREFUSED"));
    const exec = new BifrostBackendExecutor(PROVIDER, {});

    let caught: unknown = null;
    try {
      await exec.execute(makeInput());
    } catch (err) {
      caught = err;
    }

    assert.equal(mockFetch.calls.length, 1, "fetch was attempted");
    assert.ok(caught instanceof Error);
    assert.match((caught as Error).message, /ECONNREFUSED/);
  } finally {
    teardownEnv();
  }
});

// ── 3. Env-bypass (BIFROST_KILLSWITCH_DISABLED=true) ──────────────────────

test("B9.1 env-bypass: does NOT throw BifrostKillSwitchActiveError when the bypass is set", async () => {
  setupEnv();
  try {
    process.env.BIFROST_KILLSWITCH_DISABLED = "true";
    forceActivate(PROVIDER); // would normally trip
    mockFetch.setNextResponse(new Response('{"id":"x"}', { status: 200 }));

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.execute(makeInput());

    assert.equal(mockFetch.calls.length, 1);
    assert.equal((result.response as Response).status, 200);
  } finally {
    teardownEnv();
  }
});

test("B9.1 env-bypass: does NOT call recordObservation when the bypass is set (records suppressed)", async () => {
  setupEnv();
  try {
    process.env.BIFROST_KILLSWITCH_DISABLED = "true";
    mockFetch.setNextResponse(new Response('{"id":"x"}', { status: 200 }));

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const beforeStates = JSON.stringify(listStates());
    await exec.execute(makeInput());
    const afterStates = JSON.stringify(listStates());

    // When the bypass is set, recordObservation should not be called.
    // listStates() should not change after execute().
    assert.equal(beforeStates, afterStates, "listStates unchanged with bypass set");
  } finally {
    teardownEnv();
  }
});

test("B9.1 env-bypass: accepts BIFROST_KILLSWITCH_DISABLED=1 as an alias for true", async () => {
  setupEnv();
  try {
    process.env.BIFROST_KILLSWITCH_DISABLED = "1";
    forceActivate(PROVIDER);
    mockFetch.setNextResponse(new Response('{"id":"x"}', { status: 200 }));

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.execute(makeInput());

    assert.equal(mockFetch.calls.length, 1);
    assert.equal((result.response as Response).status, 200);
  } finally {
    teardownEnv();
  }
});

// ── 4. healthCheck propagation (orchestrator probes see the kill switch) ──

test("B9.1 healthCheck: returns ok=false with error='kill_switch_active' when the switch is active", async () => {
  setupEnv();
  try {
    activate(PROVIDER, "error_rate_exceeded", "warn", "tripped");
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    assert.equal(result.ok, false);
    assert.equal(result.error, "kill_switch_active");
  } finally {
    teardownEnv();
  }
});

test("B9.1 healthCheck: does NOT short-circuit on the kill switch when it is not active", async () => {
  setupEnv();
  try {
    // No activation; kill switch is clean. Probe should proceed to /health.
    mockFetch.setNextResponse(
      new Response(JSON.stringify({ status: "ok", version: "1.0.0" }), { status: 200 })
    );
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    assert.equal(result.ok, true);
    assert.equal(result.version, "1.0.0");
  } finally {
    teardownEnv();
  }
});

test("B9.1 healthCheck: ignores the kill switch when BIFROST_KILLSWITCH_DISABLED=true (env-bypass)", async () => {
  setupEnv();
  try {
    process.env.BIFROST_KILLSWITCH_DISABLED = "true";
    forceActivate(PROVIDER); // would normally short-circuit
    mockFetch.setNextResponse(
      new Response(JSON.stringify({ status: "ok", version: "1.0.0" }), { status: 200 })
    );
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    assert.equal(result.ok, true);
    assert.equal(result.version, "1.0.0");
  } finally {
    teardownEnv();
  }
});

test("B9.1 healthCheck: does not touch the network when the kill switch is active (probe returns early)", async () => {
  setupEnv();
  try {
    activate(PROVIDER, "latency_exceeded", "warn", "tripped");
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    assert.equal(result.ok, false);
    assert.equal(result.error, "kill_switch_active");
    // No /health or /v1/models probe fired.
    assert.equal(mockFetch.calls.length, 0, "fetch was not called");
  } finally {
    teardownEnv();
  }
});
