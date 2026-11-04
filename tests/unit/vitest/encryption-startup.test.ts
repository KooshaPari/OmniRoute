/**
 * AC-6, AC-10 — validateEncryptionAtStartup() canary.
 *
 * Covers:
 *   - State A: no key set → returns without throwing (passthrough mode is intentional)
 *   - Success path: key set, round-trip works → returns without throwing
 *   - runEncryptionStartupCanary() async wrapper exposes the same behaviour
 *
 * Failure paths (encrypt() throws) require crypto fault injection; this file
 * covers the contract via the real crypto module to keep the tests
 * deterministic and fast. Pair with `encryption-connection-fields-failclosed.test.mjs`
 * for the encrypt() throw contract.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("encryption-startup: canary contract (AC-6, AC-10)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("AC-6 (State A): no STORAGE_ENCRYPTION_KEY → canary returns without throwing", async () => {
    vi.resetModules();
    const { validateEncryptionAtStartup } = await import("@/lib/db/encryption");
    // No key set: canary must return cleanly (passthrough mode is intentional)
    expect(() => validateEncryptionAtStartup()).not.toThrow();
  });

  it("AC-10 (success path): with key set and round-trip works → canary returns", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "test-startup-canary-secret");
    vi.resetModules();
    const { validateEncryptionAtStartup } = await import("@/lib/db/encryption");
    expect(() => validateEncryptionAtStartup()).not.toThrow();
  });

  it("runEncryptionStartupCanary() async wrapper returns cleanly on State A", async () => {
    vi.resetModules();
    const { runEncryptionStartupCanary } = await import("@/lib/db/encryptionStartup");
    await expect(runEncryptionStartupCanary()).resolves.toBeUndefined();
  });

  it("runEncryptionStartupCanary() async wrapper returns cleanly on success path", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "test-async-canary-secret");
    vi.resetModules();
    const { runEncryptionStartupCanary } = await import("@/lib/db/encryptionStartup");
    await expect(runEncryptionStartupCanary()).resolves.toBeUndefined();
  });

  it("StartupEncryptionError is exported and is an Error subclass", async () => {
    const { StartupEncryptionError } = await import("@/lib/db/encryption");
    const err = new StartupEncryptionError("test");
    expect(err).toBeInstanceOf(Error);
    expect(err.name).toBe("StartupEncryptionError");
  });

  it("runEncryptionStartupCheck() re-exports the canary and error class", async () => {
    const startup = await import("@/lib/db/encryptionStartup");
    expect(typeof startup.runEncryptionStartupCheck).toBe("function");
    expect(typeof startup.runEncryptionStartupCanary).toBe("function");
    expect(startup.StartupEncryptionError).toBeDefined();
    expect(startup.validateEncryptionAtStartup).toBeDefined();
  });
});
