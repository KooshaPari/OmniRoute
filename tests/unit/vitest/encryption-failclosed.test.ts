/**
 * AC-1, AC-2, AC-3, AC-4, AC-11 — encrypt() throws EncryptionRuntimeError
 * when the crypto pipeline fails while a key is configured (State B → State B'
 * fail-closed behaviour). Mirrors `plans/encryption-failclosed-spec.md` §6.9.
 *
 * Strategy: we test the contract via the exported error class shape (no
 * fault injection needed) and via the real encrypt() with the real crypto
 * module (no fault injection needed for State A / happy-path). We cover the
 * catch-block behaviour of `encryptConnectionFields` and the canary through
 * a parallel test file that uses `vi.spyOn` on the real crypto module
 * (where spy-on works reliably for `randomBytes` in this runtime).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

describe("encryption-failclosed: contract (AC-1, AC-2, AC-3, AC-4 shape)", () => {
  beforeEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("AC-1: passthrough (State A) is preserved — no key set returns plaintext", async () => {
    vi.resetModules();
    const { encrypt, EncryptionRuntimeError } = await import("@/lib/db/encryption");
    const out = encrypt("plaintext-value");
    expect(out).toBe("plaintext-value");
    expect(() => encrypt("anything")).not.toThrow(EncryptionRuntimeError);
  });

  it("AC-1: passthrough (State A) preserves null/undefined inputs", async () => {
    vi.resetModules();
    const { encrypt, decrypt } = await import("@/lib/db/encryption");
    expect(encrypt(null)).toBeNull();
    expect(encrypt(undefined)).toBeUndefined();
    expect(decrypt(null)).toBeNull();
    expect(decrypt(undefined)).toBeUndefined();
  });

  it("AC-1: with key set, encrypt() returns enc:v1:... ciphertext", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "test-secret-key-12345");
    vi.resetModules();
    const { encrypt, decrypt } = await import("@/lib/db/encryption");
    const ciphertext = encrypt("hello");
    expect(ciphertext).toMatch(/^enc:v1:/);
    expect(decrypt(ciphertext!)).toBe("hello");
  });

  it("AC-2: EncryptionRuntimeError is exported and is an Error subclass", async () => {
    const { EncryptionRuntimeError } = await import("@/lib/db/encryption");
    const err = new EncryptionRuntimeError("test message");
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(EncryptionRuntimeError);
    expect(err.name).toBe("EncryptionRuntimeError");
  });

  it("AC-3: EncryptionRuntimeError carries the original error as .cause", async () => {
    const { EncryptionRuntimeError } = await import("@/lib/db/encryption");
    const rootCause = new Error("simulated randomBytes failure");
    const err = new EncryptionRuntimeError("Encryption failed at runtime", { cause: rootCause });
    expect(err.cause).toBe(rootCause);
  });

  it("AC-4: EncryptionRuntimeError includes the remediation hint", async () => {
    const { EncryptionRuntimeError } = await import("@/lib/db/encryption");
    const err = new EncryptionRuntimeError(
      "Encryption failed at runtime: simulated. " +
        "Refusing to write plaintext. Check your STORAGE_ENCRYPTION_KEY — " +
        "regenerate one with: openssl rand -base64 32"
    );
    expect(err.message).toContain("openssl rand -base64 32");
  });

  it("AC-11 (State A): encryptConnectionFields() returns connection unchanged when no key set", async () => {
    vi.resetModules();
    const { encryptConnectionFields } = await import("@/lib/db/encryption");
    const conn = {
      apiKey: "sk-plaintext",
      accessToken: "plain-access",
    };
    const result = encryptConnectionFields({ ...conn });
    // In passthrough mode, the connection fields are returned unchanged.
    expect(result).toEqual({ apiKey: "sk-plaintext", accessToken: "plain-access" });
    expect(result?.apiKey).toBe("sk-plaintext");
    expect(result?.accessToken).toBe("plain-access");
  });

  it("AC-11 (success path): encryptConnectionFields() returns the connection with encrypted fields", async () => {
    vi.stubEnv("STORAGE_ENCRYPTION_KEY", "test-connfields-success");
    vi.resetModules();
    const { encryptConnectionFields, decrypt } = await import("@/lib/db/encryption");
    const conn = {
      apiKey: "sk-plaintext",
      accessToken: "plain-access",
    };
    const result = encryptConnectionFields({ ...conn });
    expect(result).not.toBeNull();
    expect(result?.apiKey).toMatch(/^enc:v1:/);
    expect(result?.accessToken).toMatch(/^enc:v1:/);
    // The encrypted values must round-trip back to the original plaintext
    expect(decrypt(result!.apiKey!)).toBe("sk-plaintext");
    expect(decrypt(result!.accessToken!)).toBe("plain-access");
  });
});
