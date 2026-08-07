/**
 * tests/unit/quota/keyvDefaultConfig.test.ts
 *
 * Coverage for src/lib/quota/keyvDefaultConfig.ts:
 *   - AC-7: QUOTA_KEYV_BACKEND=memory → memory:// URI
 *   - AC-8: QUOTA_KEYV_BACKEND=sqlite (default) → keyv://sqlite:... URI
 *   - AC-9: QUOTA_KEYV_BACKEND=file → keyv://sqlite:... URI (URI = KEYV_DEFAULT_URI)
 *   - AC-10: QUOTA_KEYV_BACKEND=garbage → zod throws
 *   - QUOTA_STORE_KEYV_URL explicit override is honored verbatim
 *   - QUOTA_STORE_DRIVER defaults to "keyv"
 *
 * Plan: plans/keyv-as-embedded-default-spec.md §4.3.2 / §5 (AC-7..AC-10).
 */
import { describe, it, expect, beforeEach, afterAll } from "vitest";

const KEYV_DEFAULT_URI = "keyv://sqlite:.agileplus/quota/quota.db";

// Snapshot/restore the env vars we mutate.
const SNAPSHOT_KEYS = [
  "QUOTA_STORE_DRIVER",
  "QUOTA_KEYV_BACKEND",
  "QUOTA_STORE_KEYV_URL",
] as const;
const ORIGINAL_ENV: Record<string, string | undefined> = {};

beforeEach(() => {
  for (const k of SNAPSHOT_KEYS) delete process.env[k];
});

afterAll(() => {
  for (const k of SNAPSHOT_KEYS) {
    if (ORIGINAL_ENV[k] === undefined) delete process.env[k];
    else process.env[k] = ORIGINAL_ENV[k];
  }
});

// Snapshot at module-load time. AfterAll restores them.
for (const k of SNAPSHOT_KEYS) ORIGINAL_ENV[k] = process.env[k];

// Lazy import so beforeEach env resets are observed.
async function load() {
  return await import("../../../src/lib/quota/keyvDefaultConfig.ts");
}

describe("keyvDefaultConfig", () => {
  it("defaults — driver=keyv, backend=sqlite, kvUrl=KEYV_DEFAULT_URI", async () => {
    const { readKeyvDefaultConfigFromEnv, KEYV_DEFAULTS } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.driver).toBe("keyv");
    expect(cfg.backend).toBe("sqlite");
    expect(cfg.kvUrl).toBe(KEYV_DEFAULT_URI);
    // Sanity check the exported bundle.
    expect(KEYV_DEFAULTS.driver).toBe("keyv");
    expect(KEYV_DEFAULTS.backend).toBe("sqlite");
    expect(KEYV_DEFAULTS.KEYV_DEFAULT_URI).toBe(KEYV_DEFAULT_URI);
  });

  it("AC-8 — backend=sqlite (default) → durable sqlite URI", async () => {
    process.env.QUOTA_KEYV_BACKEND = "sqlite";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.backend).toBe("sqlite");
    expect(cfg.kvUrl).toBe(KEYV_DEFAULT_URI);
  });

  it("AC-7 — backend=memory → memory:// URI", async () => {
    process.env.QUOTA_KEYV_BACKEND = "memory";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.backend).toBe("memory");
    expect(cfg.kvUrl).toBe("memory://");
  });

  it("AC-9 — backend=file → durable sqlite URI (KEYV_DEFAULT_URI)", async () => {
    process.env.QUOTA_KEYV_BACKEND = "file";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.backend).toBe("file");
    expect(cfg.kvUrl).toBe(KEYV_DEFAULT_URI);
  });

  it("AC-10 — invalid backend value → zod throws", async () => {
    process.env.QUOTA_KEYV_BACKEND = "garbage";
    const { readKeyvDefaultConfigFromEnv } = await load();
    expect(() => readKeyvDefaultConfigFromEnv()).toThrow();
  });

  it("invalid driver value → zod throws", async () => {
    process.env.QUOTA_STORE_DRIVER = "memcached";
    const { readKeyvDefaultConfigFromEnv } = await load();
    expect(() => readKeyvDefaultConfigFromEnv()).toThrow();
  });

  it("driver=sqlite honored (legacy pin)", async () => {
    process.env.QUOTA_STORE_DRIVER = "sqlite";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.driver).toBe("sqlite");
  });

  it("driver=redis honored (distributed pin)", async () => {
    process.env.QUOTA_STORE_DRIVER = "redis";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.driver).toBe("redis");
  });

  it("driver=keyv honored (explicit keyv)", async () => {
    process.env.QUOTA_STORE_DRIVER = "keyv";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.driver).toBe("keyv");
  });

  it("explicit QUOTA_STORE_KEYV_URL overrides default URI", async () => {
    process.env.QUOTA_STORE_KEYV_URL = "redis://user:pw@host:6379/2";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    // Backend env is unset (defaults to sqlite), but explicit URL wins.
    expect(cfg.backend).toBe("sqlite");
    expect(cfg.kvUrl).toBe("redis://user:pw@host:6379/2");
  });

  it("backend=memory + explicit URI → explicit URI wins", async () => {
    process.env.QUOTA_KEYV_BACKEND = "memory";
    process.env.QUOTA_STORE_KEYV_URL = "memory://some-namespace";
    const { readKeyvDefaultConfigFromEnv } = await load();
    const cfg = readKeyvDefaultConfigFromEnv();
    expect(cfg.backend).toBe("memory");
    expect(cfg.kvUrl).toBe("memory://some-namespace");
  });

  it("KEYV_DEFAULT_URI is the durable default", async () => {
    const { KEYV_DEFAULT_URI: uri } = await load();
    expect(uri).toBe("keyv://sqlite:.agileplus/quota/quota.db");
  });
});
