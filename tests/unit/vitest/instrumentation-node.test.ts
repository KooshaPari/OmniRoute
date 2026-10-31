/**
 * OTel SDK bootstrap tests — B10 of v8.1.
 *
 * Exercises `initOtel()` from src/instrumentation-node.ts:
 *   - no-op when OTEL_EXPORTER_OTLP_ENDPOINT is unset
 *   - no-op when OTEL_SDK_DISABLED is set
 *   - tries to dynamic-import the SDK when endpoint IS set
 *
 * The SDK packages are NOT installed in the test environment, so the
 * third case logs a warning and returns false — the function must
 * not throw. We verify the warning message instead of the SDK init.
 *
 * Reference: src/instrumentation-node.ts (initOtel), PLAN.md § 2.5.2 (B10).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("initOtel", () => {
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(async () => {
    vi.resetModules();
    delete process.env.OTEL_EXPORTER_OTLP_ENDPOINT;
    delete process.env.OTEL_SDK_DISABLED;
    delete process.env.OTEL_SERVICE_NAME;
    // Reset the idempotency latch inside instrumentation-node.ts so each test
    // gets a clean slate (vi.resetModules alone doesn't reset module-scope lets).
    const mod = await import("../../../src/instrumentation-node.ts");
    mod.__resetOtelInitForTests();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it("returns false (no-op) when OTEL_EXPORTER_OTLP_ENDPOINT is unset", async () => {
    const mod = await import("../../../src/instrumentation-node.ts");
    const result = await mod.initOtel();
    expect(result).toBe(false);
  });

  it("returns false (no-op) when OTEL_EXPORTER_OTLP_ENDPOINT is empty string", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "";
    const mod = await import("../../../src/instrumentation-node.ts");
    const result = await mod.initOtel();
    expect(result).toBe(false);
  });

  it("returns false when OTEL_SDK_DISABLED=true even with endpoint set", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
    process.env.OTEL_SDK_DISABLED = "true";
    const mod = await import("../../../src/instrumentation-node.ts");
    const result = await mod.initOtel();
    expect(result).toBe(false);
  });

  it("returns false and logs a warning when SDK package is not installed", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../../../src/instrumentation-node.ts");
    const result = await mod.initOtel();

    // In test env, the SDK package isn't installed, so dynamic
    // import fails. The wrapper logs a warning and returns false.
    expect(result).toBe(false);
    expect(warnSpy).toHaveBeenCalled();
    const lastWarn = warnSpy.mock.calls
      .map((c) => String(c[0] ?? ""))
      .find((m) => m.startsWith("[OTEL]"));
    expect(lastWarn).toBeDefined();
    expect(lastWarn).toMatch(/OTel SDK init failed/);
    expect(lastWarn).toMatch(/To enable, install/);
  });

  it("is idempotent: second call short-circuits after first no-op", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "http://collector:4318";
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../../../src/instrumentation-node.ts");
    const r1 = await mod.initOtel();
    // Reset spy to count calls from second invocation only.
    warnSpy.mockClear();
    const r2 = await mod.initOtel();
    expect(r1).toBe(false);
    expect(r2).toBe(false);
    // Second call should NOT re-attempt import — no new warning.
    expect(warnSpy).not.toHaveBeenCalled();
  });

  it("does not throw when process.env values are weird", async () => {
    process.env.OTEL_EXPORTER_OTLP_ENDPOINT = "  http://collector:4318  ";
    process.env.OTEL_SERVICE_NAME = "";
    vi.spyOn(console, "warn").mockImplementation(() => {});

    const mod = await import("../../../src/instrumentation-node.ts");
    // Should not throw.
    await expect(mod.initOtel()).resolves.toBeDefined();
  });

  it("exports initOtel as a function", async () => {
    const mod = await import("../../../src/instrumentation-node.ts");
    expect(typeof mod.initOtel).toBe("function");
  });

  it("exports registerNodejs as a function", async () => {
    const mod = await import("../../../src/instrumentation-node.ts");
    expect(typeof mod.registerNodejs).toBe("function");
  });
});
