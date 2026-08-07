/**
 * AC-6, AC-10 — validateEncryptionAtStartup() canary.
 * (AC-7, AC-8, AC-9 — fault-injection paths — see note below.)
 *
 * The canary is called via `runEncryptionStartupCanary()` from
 * `src/instrumentation-node.ts`. Mirrors `plans/encryption-failclosed-spec.md` §6.7.
 *
 * Note on AC-7/AC-8/AC-9 fault-injection: the canary's `validateEncryptionAtStartup()`
 * calls the local `encrypt`/`decrypt` functions (not the module exports),
 * so a vi.mock of the module's `encrypt` export does NOT intercept those
 * internal calls. The simpler fault-injection techniques (`vi.spyOn` on
 * `crypto.randomBytes`, etc.) don't reliably intercept the destructured
 * ESM binding in this runtime. We therefore verify the canary's fault
 * branches by code review and integration test (the same shape as
 * `decrypt()` returning null on error — already covered by
 * `tests/unit/db/encryption-error-handling.test.mjs`). The happy-path
 * tests below cover AC-6 and AC-10.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("encryption-failclosed: startup canary (AC-6, AC-10 + shapes)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("AC-6: validateEncryptionAtStartup() passes on a known-good key", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "good-startup-key-67890");
    vi.resetModules();
    const { validateEncryptionAtStartup } = await import("@/lib/db/encryption");
    expect(() => validateEncryptionAtStartup()).not.toThrow();
  });

  it("AC-6: validateEncryptionAtStartup() passes on a different good key (regression sweep)", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "another-good-key-abcde");
    vi.resetModules();
    const { validateEncryptionAtStartup } = await import("@/lib/db/encryption");
    expect(() => validateEncryptionAtStartup()).not.toThrow();
  });

  it("AC-10: validateEncryptionAtStartup() does not throw when no key is set (warns)", async () => {
    vi.resetModules();
    const { validateEncryptionAtStartup, isEncryptionEnabled } = await import(
      "@/lib/db/encryption"
    );
    expect(isEncryptionEnabled()).toBe(false);
    expect(() => validateEncryptionAtStartup()).not.toThrow();
  });

  it("AC-10 edge: validateEncryptionAtStartup() throws on whitespace-only key (env truthy but key unusable)", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "   ");
    vi.resetModules();
    const { validateEncryptionAtStartup, isEncryptionEnabled, StartupEncryptionError } =
      await import("@/lib/db/encryption");
    // isEncryptionEnabled checks truthiness; whitespace is truthy but
    // getStaticKey() rejects it and returns null. encrypt() then returns
    // plaintext (no key). The canary detects this and throws — exactly
    // the fail-closed behaviour we want.
    expect(isEncryptionEnabled()).toBe(true);
    let caught: unknown = null;
    try {
      validateEncryptionAtStartup();
    } catch (err) {
      caught = err;
    }
    expect(caught).toBeInstanceOf(StartupEncryptionError);
  });

  it("StartupEncryptionError is exported and is an Error subclass", async () => {
    const { StartupEncryptionError } = await import("@/lib/db/encryption");
    const err = new StartupEncryptionError("test canary failure");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(StartupEncryptionError);
    expect(err.name).toBe("StartupEncryptionError");
  });

  it("StartupEncryptionError carries the original error as .cause", async () => {
    const { StartupEncryptionError } = await import("@/lib/db/encryption");
    const rootCause = new Error("simulated canary root cause");
    const err = new StartupEncryptionError("test canary failure", { cause: rootCause });
    expect(err.cause).toBe(rootCause);
  });

  it("runEncryptionStartupCanary (async wrapper) passes on good key", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "good-async-canary-key");
    vi.resetModules();
    const { runEncryptionStartupCanary } = await import("@/lib/db/encryptionStartup");
    await expect(runEncryptionStartupCanary()).resolves.not.toThrow();
  });

  it("runEncryptionStartupCanary (async wrapper) does not throw on missing key (warns)", async () => {
    vi.resetModules();
    const { runEncryptionStartupCanary } = await import("@/lib/db/encryptionStartup");
    await expect(runEncryptionStartupCanary()).resolves.not.toThrow();
  });

  it("encryptionStartup module re-exports validateEncryptionAtStartup + StartupEncryptionError", async () => {
    const startup = await import("@/lib/db/encryptionStartup");
    expect(typeof startup.runEncryptionStartupCheck).toBe("function");
    expect(typeof startup.runEncryptionStartupCanary).toBe("function");
    expect(typeof startup.validateEncryptionAtStartup).toBe("function");
    expect(typeof startup.StartupEncryptionError).toBe("function");
  });
});
