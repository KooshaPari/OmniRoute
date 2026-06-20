/**
 * Regression tests for the `src/app/api/combos/route.ts` and
 * `src/app/api/combos/[id]/route.ts` endpoints.
 *
 * L5-121 (2026-06-19): these two routes were inadvertently deleted in
 * 3a9e04ccf "fix(tsconfig): enable strict mode" (3116 files changed,
 * 1,250,994 deletions). Frontend pages still POST/PUT/DELETE to them,
 * so every GUI combo modification has been returning 4xx. These tests
 * fail before the route files are restored and pass after.
 *
 * Test surface:
 *  - GET   /api/combos        (list)
 *  - POST  /api/combos        (create)
 *  - GET   /api/combos/[id]   (single)
 *  - PUT   /api/combos/[id]   (update — the primary 400 source)
 *  - DELETE /api/combos/[id]  (remove)
 *
 * Auth is disabled in the test environment (`requireLogin: false`),
 * so the routes accept unauthenticated requests just like a local
 * single-user deployment.
 */
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// ── DB / auth setup ───────────────────────────────────────────────────────────

const TEST_DATA_DIR = fs.mkdtempSync(
  path.join(os.tmpdir(), "omniroute-combos-routes-regression-")
);
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";

const core = await import("../../src/lib/db/core.ts");
const settingsDb = await import("../../src/lib/db/settings.ts");

// Ensure auth is disabled so requireManagementAuth() passes through.
await settingsDb.updateSettings({ requireLogin: false });

// Routes loaded AFTER env is set (DB initialization is lazy)
const combosListRoute = await import("../../src/app/api/combos/route.ts");
const comboItemRoute = await import("../../src/app/api/combos/[id]/route.ts");

// ── Helpers ───────────────────────────────────────────────────────────────────

function jsonRequest(url: string, method: string, body?: unknown): Request {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
}

const baseUrl = "http://localhost";
const listUrl = `${baseUrl}/api/combos`;

// ── Setup / Teardown ──────────────────────────────────────────────────────────

test.after(async () => {
  core.resetDbInstance();
  try {
    fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  } catch {
    // best-effort cleanup
  }
});

// ── /api/combos (list) ────────────────────────────────────────────────────────

test("GET /api/combos returns 200 with an empty list initially", async () => {
  const res = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.ok(Array.isArray(body.combos), "body.combos must be an array");
  assert.equal(body.combos.length, 0);
});

test("POST /api/combos creates a new combo and returns 201", async () => {
  const payload = {
    name: "regression-test-combo",
    models: [
      { provider: "openai", model: "gpt-4o-mini", weight: 100 },
    ],
    strategy: "priority",
  };

  const res = await combosListRoute.POST(
    jsonRequest(listUrl, "POST", payload) as never
  );
  assert.equal(res.status, 201);
  const combo = await res.json();
  assert.ok(combo.id, "created combo must have an id");
  assert.equal(combo.name, "regression-test-combo");
  assert.equal(combo.strategy, "priority");
});

test("POST /api/combos rejects duplicate name with 400", async () => {
  const payload = {
    name: "regression-test-combo",
    models: [
      { provider: "openai", model: "gpt-4o-mini", weight: 100 },
    ],
    strategy: "priority",
  };

  const res = await combosListRoute.POST(
    jsonRequest(listUrl, "POST", payload) as never
  );
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error, "error body must be present");
});

test("POST /api/combos rejects invalid body with 400", async () => {
  const res = await combosListRoute.POST(
    jsonRequest(listUrl, "POST", { wrong: "shape" }) as never
  );
  assert.equal(res.status, 400);
});

// ── /api/combos/[id] ──────────────────────────────────────────────────────────

test("GET /api/combos/[id] returns 404 for an unknown id", async () => {
  const res = await comboItemRoute.GET(
    jsonRequest(`${baseUrl}/api/combos/does-not-exist`, "GET") as never,
    { params: Promise.resolve({ id: "does-not-exist" }) }
  );
  assert.equal(res.status, 404);
});

test("PUT /api/combos/[id] toggles isActive successfully (the primary 400 regression)", async () => {
  // Find the combo we created earlier.
  const listRes = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  const { combos } = await listRes.json();
  assert.equal(combos.length, 1);
  const comboId = combos[0].id;

  // The GUI's handleToggleCombo sends exactly this body shape.
  const res = await comboItemRoute.PUT(
    jsonRequest(`${baseUrl}/api/combos/${comboId}`, "PUT", { isActive: false }) as never,
    { params: Promise.resolve({ id: comboId }) }
  );

  // Before the route restoration this returned 4xx (route not found).
  // After restoration it returns 200 with the updated combo.
  assert.equal(res.status, 200, "PUT isActive toggle must succeed");
  const body = await res.json();
  assert.equal(body.isActive, false);
});

test("PUT /api/combos/[id] updates strategy and returns 200", async () => {
  const listRes = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  const { combos } = await listRes.json();
  const comboId = combos[0].id;

  const res = await comboItemRoute.PUT(
    jsonRequest(`${baseUrl}/api/combos/${comboId}`, "PUT", {
      strategy: "weighted",
    }) as never,
    { params: Promise.resolve({ id: comboId }) }
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.strategy, "weighted");
});

test("PUT /api/combos/[id] rejects invalid body with 400", async () => {
  const listRes = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  const { combos } = await listRes.json();
  const comboId = combos[0].id;

  // Strategy must be one of the enum values — an unknown value triggers
  // the schema strict path.
  const res = await comboItemRoute.PUT(
    jsonRequest(`${baseUrl}/api/combos/${comboId}`, "PUT", {
      strategy: "definitely-not-a-real-strategy",
    }) as never,
    { params: Promise.resolve({ id: comboId }) }
  );
  assert.equal(res.status, 400);
});

test("PUT /api/combos/[id] rejects invalid JSON body with 400 (not 500)", async () => {
  const listRes = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  const { combos } = await listRes.json();
  const comboId = combos[0].id;

  const req = new Request(`${baseUrl}/api/combos/${comboId}`, {
    method: "PUT",
    headers: { "content-type": "application/json" },
    body: "{not valid json",
  });
  const res = await comboItemRoute.PUT(req as never, {
    params: Promise.resolve({ id: comboId }),
  });
  assert.equal(res.status, 400);
  const body = await res.json();
  assert.ok(body.error, "error body must be present");
});

test("DELETE /api/combos/[id] removes the combo and returns success", async () => {
  const listRes = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  const { combos } = await listRes.json();
  const comboId = combos[0].id;

  const res = await comboItemRoute.DELETE(
    jsonRequest(`${baseUrl}/api/combos/${comboId}`, "DELETE") as never,
    { params: Promise.resolve({ id: comboId }) }
  );
  assert.equal(res.status, 200);
  const body = await res.json();
  assert.equal(body.success, true);

  // List is now empty.
  const after = await combosListRoute.GET(jsonRequest(listUrl, "GET") as never);
  const afterBody = await after.json();
  assert.equal(afterBody.combos.length, 0);
});

test("DELETE /api/combos/[id] returns 404 for an unknown id", async () => {
  const res = await comboItemRoute.DELETE(
    jsonRequest(`${baseUrl}/api/combos/does-not-exist`, "DELETE") as never,
    { params: Promise.resolve({ id: "does-not-exist" }) }
  );
  assert.equal(res.status, 404);
});