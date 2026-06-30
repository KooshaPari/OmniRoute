import test, { describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { makeManagementSessionRequest } from "../../helpers/managementSession.ts";

const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "omniroute-provider-health-autopilot-actions-route-")
);
const originalDataDir = process.env.DATA_DIR;
const originalJwtSecret = process.env.JWT_SECRET;
const originalPublicBaseUrl = process.env.OMNIROUTE_PUBLIC_BASE_URL;

process.env.DATA_DIR = TEST_DATA_DIR;

const core = await import("../../../src/lib/db/core.ts");
const settingsDb = await import("../../../src/lib/db/settings.ts");
const route = await import(
  "../../../src/app/api/providers/health-autopilot/actions/route.ts"
);

async function setupAuth(): Promise<void> {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  await settingsDb.updateSettings({
    requireLogin: true,
    setupComplete: true,
    password: "test-password-hash",
  });
}

test.beforeEach(async () => {
  process.env.DATA_DIR = TEST_DATA_DIR;
  process.env.OMNIROUTE_PUBLIC_BASE_URL = "http://localhost:20128";
  await setupAuth();
});

test.after(() => {
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
  if (originalPublicBaseUrl === undefined) delete process.env.OMNIROUTE_PUBLIC_BASE_URL;
  else process.env.OMNIROUTE_PUBLIC_BASE_URL = originalPublicBaseUrl;
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

describe("POST /api/providers/health-autopilot/actions", () => {
  test("rejects authenticated browser mutations from an invalid origin", async () => {
    const req = await makeManagementSessionRequest(
      "http://localhost:20128/api/providers/health-autopilot/actions",
      {
        method: "POST",
        headers: {
          origin: "https://attacker.example",
        },
        body: {
          type: "clear_provider_breaker",
          target: { provider: "openai" },
          preconditionsHash: "12345678",
          dryRun: true,
        },
      }
    );

    const res = await route.POST(req);

    assert.equal(res.status, 403);
    assert.deepEqual(await res.json(), { error: { message: "Invalid request origin" } });
  });
});
