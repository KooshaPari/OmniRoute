/**
 * Tests for B9.1 Kill Switch Wiring in BifrostBackendExecutor (bifrost.ts).
 *
 * Verifies the pre-check, post-record, env-bypass, and healthCheck
 * propagation for the B9 kill switch. Mocks `globalThis.fetch` like the
 * existing bifrost-backend.test.ts to control upstream behavior.
 *
 * Reference: docs/adr/0031-bifrost-tier1-router.md, ADR-031,
 * `open-sse/services/bifrostKillSwitch.ts` (B9), `open-sse/executors/bifrost.ts` (B9.1).
 *
 * @module tests/unit/bifrost-kill-switch-wiring.test.ts
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { BifrostBackendExecutor } from "../../open-sse/executors/bifrost.ts";
import * as killSwitch from "../../open-sse/services/bifrostKillSwitch.ts";
import {
  BifrostKillSwitchActiveError,
  BIFROST_KILLSWITCH_ACTIVE,
  resetAll,
  activate,
  forceActivate,
} from "../../open-sse/services/bifrostKillSwitch.ts";

const PROVIDER = "openai";

const originalBifrostEnabled = process.env.BIFROST_ENABLED;
const originalKillSwitchDisabled = process.env.BIFROST_KILLSWITCH_DISABLED;
const originalBifrostBaseUrl = process.env.BIFROST_BASE_URL;
const originalFetch = globalThis.fetch;

beforeEach(() => {
  // BIFROST_ENABLED must be set so execute() reaches the kill switch
  // pre-check (it short-circuits earlier otherwise). BIFROST_BASE_URL
  // is set to a stable test host.
  process.env.BIFROST_ENABLED = "1";
  process.env.BIFROST_BASE_URL = "http://bifrost.test:8080";
  delete process.env.BIFROST_KILLSWITCH_DISABLED;
  // Fresh kill switch state for every test.
  resetAll();
});

afterEach(() => {
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

// ── 1. Pre-check (kill switch is enforced) ────────────────────────────────

describe("B9.1 pre-check — throws when kill switch is active", () => {
  it("execute() throws BifrostKillSwitchActiveError when isActive() is true", async () => {
    // Trip the kill switch for this provider before the call.
    activate(PROVIDER, "manual", "critical", "test trip");
    const exec = new BifrostBackendExecutor(PROVIDER, {});

    let caught: unknown = null;
    try {
      await exec.execute(makeInput());
    } catch (err) {
      caught = err;
    }

    expect(caught).not.toBeNull();
    expect(caught).toBeInstanceOf(BifrostKillSwitchActiveError);
    expect((caught as Error).name).toBe(BIFROST_KILLSWITCH_ACTIVE);
    expect((caught as BifrostKillSwitchActiveError).provider).toBe(PROVIDER);
    expect((caught as BifrostKillSwitchActiveError).reason).toBe("manual");
    expect((caught as BifrostKillSwitchActiveError).severity).toBe("critical");
  });

  it("execute() proceeds past pre-check when isActive() is false (clean state)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"id":"x","choices":[]}', { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.execute(makeInput());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(200);
  });
});

// ── 2. Post-record observation (every execute path records once) ─────────

describe("B9.1 post-record — observation fields are correct", () => {
  it("records ok=true on a 2xx response with the right provider + latency", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"id":"x","choices":[]}', { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    expect(recordSpy).toHaveBeenCalledTimes(1);
    const obs = recordSpy.mock.calls[0]?.[0];
    expect(obs).toBeDefined();
    expect(obs?.provider).toBe(PROVIDER);
    expect(obs?.ok).toBe(true);
    expect(typeof obs?.latencyMs).toBe("number");
    expect(obs?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof obs?.timestamp).toBe("number");
  });

  it("records ok=false on a non-2xx response (4xx)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("bad request", { status: 400 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0]?.[0]?.ok).toBe(false);
  });

  it("records ok=false on a non-2xx response (5xx)", async () => {
    const mockFetch = vi.fn().mockResolvedValue(
      new Response("upstream error", { status: 502 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0]?.[0]?.ok).toBe(false);
  });

  it("does NOT call recordObservation when the pre-check throws (early exit)", async () => {
    activate(PROVIDER, "manual", "critical", "early-throw trip");
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await expect(exec.execute(makeInput())).rejects.toBeInstanceOf(
      BifrostKillSwitchActiveError
    );

    // Pre-check throws BEFORE the fetch; post-record must not be called.
    expect(mockFetch).not.toHaveBeenCalled();
    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("records ok=false on a network error then rethrows", async () => {
    const mockFetch = vi.fn().mockRejectedValue(new Error("ECONNREFUSED"));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});

    await expect(exec.execute(makeInput())).rejects.toThrow(/ECONNREFUSED/);

    expect(recordSpy).toHaveBeenCalledTimes(1);
    expect(recordSpy.mock.calls[0]?.[0]?.ok).toBe(false);
    expect(recordSpy.mock.calls[0]?.[0]?.provider).toBe(PROVIDER);
  });
});

// ── 3. Env-bypass (BIFROST_KILLSWITCH_DISABLED=true) ──────────────────────

describe("B9.1 env-bypass — BIFROST_KILLSWITCH_DISABLED=true skips the kill switch", () => {
  it("does NOT throw BifrostKillSwitchActiveError when the bypass is set", async () => {
    process.env.BIFROST_KILLSWITCH_DISABLED = "true";
    forceActivate(PROVIDER); // would normally trip

    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"id":"x"}', { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.execute(makeInput());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(result.response.status).toBe(200);
  });

  it("does NOT call recordObservation when the bypass is set (records suppressed)", async () => {
    process.env.BIFROST_KILLSWITCH_DISABLED = "true";

    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"id":"x"}', { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    expect(recordSpy).not.toHaveBeenCalled();
  });

  it("accepts BIFROST_KILLSWITCH_DISABLED=1 as an alias for true", async () => {
    process.env.BIFROST_KILLSWITCH_DISABLED = "1";
    forceActivate(PROVIDER);

    const mockFetch = vi.fn().mockResolvedValue(
      new Response('{"id":"x"}', { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    const recordSpy = vi.spyOn(killSwitch, "recordObservation");

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    await exec.execute(makeInput());

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(recordSpy).not.toHaveBeenCalled();
  });
});

// ── 4. healthCheck propagation (orchestrator probes see the kill switch) ──

describe("B9.1 healthCheck — propagates kill-switch state to orchestrator probes", () => {
  it("returns ok=false with error='kill_switch_active' when the switch is active", async () => {
    activate(PROVIDER, "error_rate_exceeded", "warn", "tripped");
    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("kill_switch_active");
  });

  it("does NOT short-circuit on the kill switch when it is not active", async () => {
    // No activation; kill switch is clean. Probe should proceed to /health.
    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", version: "1.0.0" }), { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.0.0");
  });

  it("ignores the kill switch when BIFROST_KILLSWITCH_DISABLED=true (env-bypass)", async () => {
    process.env.BIFROST_KILLSWITCH_DISABLED = "true";
    forceActivate(PROVIDER); // would normally short-circuit

    const mockFetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ status: "ok", version: "1.0.0" }), { status: 200 })
    );
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(true);
    expect(result.version).toBe("1.0.0");
  });

  it("does not touch the network when the kill switch is active (probe returns early)", async () => {
    activate(PROVIDER, "latency_exceeded", "warn", "tripped");
    const mockFetch = vi.fn();
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const exec = new BifrostBackendExecutor(PROVIDER, {});
    const result = await exec.healthCheck();
    expect(result.ok).toBe(false);
    expect(result.error).toBe("kill_switch_active");
    // No /health or /v1/models probe fired.
    expect(mockFetch).not.toHaveBeenCalled();
  });
});
