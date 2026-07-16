import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeManagementSessionRequest } from "../../helpers/managementSession.ts";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-bifrost-route-metrics-"));
const originalDataDir = process.env.DATA_DIR;
const originalJwtSecret = process.env.JWT_SECRET;

process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../../src/lib/db/core.ts");
const settingsDb = await import("../../../src/lib/db/settings.ts");
const metrics = await import("../../../open-sse/observability/bifrostRouteMetrics.ts");
const route = await import("../../../src/app/api/observability/bifrost-route-metrics/route.ts");

test.beforeEach(async () => {
  core.resetDbInstance();
  metrics.resetBifrostRouteMetricsForTest();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  process.env.DATA_DIR = TEST_DATA_DIR;
  await settingsDb.updateSettings({
    requireLogin: true,
    setupComplete: true,
    password: "test-password-hash",
  });
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

test("GET rejects unauthenticated requests", async () => {
  const response = await route.GET(
    new Request("http://localhost/api/observability/bifrost-route-metrics")
  );

  assert.equal(response.status, 401);
});

test("GET returns aggregate metrics to an authenticated management session", async () => {
  metrics.recordBifrostRouteOutcome({
    provider: "openai",
    model: "gpt-4o-mini",
    latencyMs: 120,
    status: 200,
    timestampMs: 1_700_000_000_000,
  });

  const response = await route.GET(
    await makeManagementSessionRequest("http://localhost/api/observability/bifrost-route-metrics")
  );

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { metrics: metrics.getAllBifrostRouteMetrics() });
});
