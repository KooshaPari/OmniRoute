import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

type RateLimiterModule = typeof import("../../src/shared/utils/rateLimiter");

test("rate limiter initializes the pinned Keyv SQLite adapter", async (): Promise<void> => {
  const dataDir = mkdtempSync(join(tmpdir(), "omniroute-rate-limiter-"));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;
  let cleanupRateLimiters: (() => Promise<void>) | undefined;

  try {
    const moduleUrl = `${pathToFileURL(
      join(process.cwd(), "src/shared/utils/rateLimiter.ts"),
    ).href}?keyv-sqlite-regression=${Date.now()}`;
    const rateLimiter: RateLimiterModule = await import(moduleUrl);
    cleanupRateLimiters = rateLimiter.cleanupRateLimiters;

    const first = await rateLimiter.checkRateLimit("keyv-sqlite-regression", 2, 60_000);
    const second = await rateLimiter.checkRateLimit("keyv-sqlite-regression", 2, 60_000);
    const third = await rateLimiter.checkRateLimit("keyv-sqlite-regression", 2, 60_000);

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
  } finally {
    try {
      await cleanupRateLimiters?.();
    } finally {
      if (previousDataDir === undefined) delete process.env.DATA_DIR;
      else process.env.DATA_DIR = previousDataDir;
      rmSync(dataDir, { recursive: true, force: true });
    }
  }
});
