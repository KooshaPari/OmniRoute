import test, { after, beforeEach, describe } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { makeManagementSessionRequest } from "../../helpers/managementSession.ts";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-vkeys-route-"));
const originalDataDir = process.env.DATA_DIR;
const originalJwtSecret = process.env.JWT_SECRET;

process.env.DATA_DIR = TEST_DATA_DIR;
process.env.OMNIROUTE_DISABLE_REDIS_AUTH_CACHE = "1";

const core = await import("../../../src/lib/db/core.ts");
const apiKeysDb = await import("../../../src/lib/db/apiKeys.ts");
const route = await import("../../../src/app/api/virtual-keys/route.ts");

async function resetStorage(): Promise<void> {
  core.resetDbInstance();
  apiKeysDb.resetApiKeyState();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
  core.getDbInstance();
}

async function post(body: unknown): Promise<{
  status: number;
  body: Record<string, unknown>;
}> {
  const response = await route.POST(
    await makeManagementSessionRequest("http://localhost/api/virtual-keys", {
      method: "POST",
      body,
    })
  );
  return {
    status: response.status,
    body: (await response.json()) as Record<string, unknown>,
  };
}

beforeEach(async () => {
  await resetStorage();
});

after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  if (originalDataDir === undefined) delete process.env.DATA_DIR;
  else process.env.DATA_DIR = originalDataDir;
  if (originalJwtSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalJwtSecret;
});

describe("POST /api/virtual-keys", () => {
  test("rejects a non-object body", async () => {
    const { status, body } = await post(null);

    assert.equal(status, 400);
    assert.equal(body.error, "Body must be a JSON object");
  });

  test("rejects a body without tenantId", async () => {
    const { status, body } = await post({ label: "missing tenant" });

    assert.equal(status, 400);
    assert.equal(body.error, "tenantId is required");
  });

  test("mints a scoped virtual key from a valid body", async () => {
    const { status, body } = await post({
      tenantId: "tenant_a",
      label: "primary",
      allowedModels: ["gpt-4o"],
      maxCostUsd: 10,
      maxRpd: 25,
      expiresAt: "2027-01-01T00:00:00Z",
    });

    assert.equal(status, 201);
    assert.equal(typeof body.rawKey, "string");
    assert.ok((body.rawKey as string).startsWith("vk_"));
    assert.equal((body.key as { tenantId?: string }).tenantId, "tenant_a");
    assert.equal((body.key as { label?: string }).label, "primary");
  });
});
