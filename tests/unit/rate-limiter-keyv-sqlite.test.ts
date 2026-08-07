import assert from "node:assert/strict";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

test("rate limiter initializes the pinned Keyv SQLite adapter", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "omniroute-rate-limiter-"));
  const previousDataDir = process.env.DATA_DIR;
  process.env.DATA_DIR = dataDir;

  try {
    const moduleUrl = `${pathToFileURL(
      join(process.cwd(), "src/shared/utils/rateLimiter.ts"),
    ).href}?keyv-sqlite-regression=${Date.now()}`;
    const { checkRateLimit } = await import(moduleUrl);

    const first = await checkRateLimit("keyv-sqlite-regression", 2, 60_000);
    const second = await checkRateLimit("keyv-sqlite-regression", 2, 60_000);
    const third = await checkRateLimit("keyv-sqlite-regression", 2, 60_000);

    assert.equal(first.allowed, true);
    assert.equal(second.allowed, true);
    assert.equal(third.allowed, false);
    assert.equal(third.remaining, 0);
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
  }
});

test("rate limiter admits only one concurrent request at a limit of one", async () => {
  const dataDir = mkdtempSync(join(tmpdir(), "omniroute-rate-limiter-concurrent-"));
  const previousDataDir = process.env.DATA_DIR;
  const previousRedisUrl = process.env.REDIS_URL;
  process.env.DATA_DIR = dataDir;
  process.env.REDIS_URL = "redis://keyv-opt-in.example.test:6379";

  try {
    const moduleUrl = `${pathToFileURL(
      join(process.cwd(), "src/shared/utils/rateLimiter.ts"),
    ).href}?keyv-concurrency-regression=${Date.now()}`;
    const { checkRateLimit } = await import(moduleUrl);

    const results = await Promise.all(
      Array.from({ length: 12 }, () =>
        checkRateLimit("keyv-sqlite-concurrency", [{ limit: 1, window: 60 }]),
      ),
    );

    assert.equal(results.filter((result) => result.allowed).length, 1);
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousRedisUrl === undefined) delete process.env.REDIS_URL;
    else process.env.REDIS_URL = previousRedisUrl;
  }
});
