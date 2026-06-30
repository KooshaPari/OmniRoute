// tests/unit/combo/combo-exhaustion-skip-reason-route.test.ts
// Tests for the GET /api/combos/exhaustion/skip-reason route handler — a thin
// management-auth wrapper around the pure `getExhaustedTargetSkipReason`
// predicate (open-sse/services/combo/comboPredicates.ts). The predicate's own
// behavior is locked by combo-exhausted-skip.test.ts; this file focuses on
// the route's wire shape + HTTP-level validation + auth gating.
import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const routePath = path.join(
  repoRoot,
  "src/app/api/combos/exhaustion/skip-reason/route.ts"
);
const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-exh-skip-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-api-key-secret";

const core = await import("../../../src/lib/db/core.ts");
const localDb = await import("../../../src/lib/localDb.ts");

async function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

test.beforeEach(async () => {
  await resetStorage();
});

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true });
});

function buildRoute() {
  return import(
    // Path is repo-root-relative at runtime; tests live at tests/unit/combo/
    // so we walk up 3 levels to the project root and back into src/app/...
    "../../../src/app/api/combos/exhaustion/skip-reason/route.ts"
  );
}

function skipAuthRequest(url: string): Request {
  return new Request(url);
}

test("GET /api/combos/exhaustion/skip-reason exists and exports GET", () => {
  const source = fs.readFileSync(routePath, "utf8");
  assert.match(source, /export async function GET/);
  assert.match(
    source,
    /requireManagementAuth/,
    "route must require management auth (matches sibling /api/combos routes)"
  );
});

test("returns reason: null when nothing is exhausted", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason?model=openai/gpt-4o&provider=openai&connectionId=conn-1"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reason, null);
  assert.deepEqual(body.exhaustedProviders, []);
  assert.deepEqual(body.exhaustedConnections, []);
  assert.equal(body.model, "openai/gpt-4o");
  assert.equal(body.provider, "openai");
  assert.equal(body.connectionId, "conn-1");
});

test("returns the #1731 provider-exhaustion reason when provider is exhausted", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason" +
        "?model=openai/gpt-4o&provider=openai&connectionId=conn-1" +
        "&exhaustedProviders=openai,anthropic"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(
    body.reason,
    "Skipping openai/gpt-4o \u2014 provider openai marked exhausted this request (#1731)"
  );
  assert.deepEqual(body.exhaustedProviders, ["openai", "anthropic"]);
});

test("returns the #1731v2 connection-pair reason when provider:connection is exhausted", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason" +
        "?model=openai/gpt-4o&provider=openai&connectionId=conn-1" +
        "&exhaustedConnections=openai:conn-1,anthropic:conn-2"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(
    body.reason,
    "Skipping openai/gpt-4o \u2014 connection conn-1 for provider openai had connection error (#1731v2)"
  );
});

test("connection-pair exhaustion takes precedence over provider exhaustion", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason" +
        "?model=openai/gpt-4o&provider=openai&connectionId=conn-1" +
        "&exhaustedProviders=openai" +
        "&exhaustedConnections=openai:conn-1"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.ok(
    body.reason?.includes("(#1731v2)"),
    "connection-level skip must win over provider-level skip (#1731v2 precedence)"
  );
  assert.ok(!body.reason?.includes("(#1731)"));
});

test("connectionId is optional and omitted sets normalize to null", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason" +
        "?model=openai/gpt-4o&provider=openai" +
        "&exhaustedProviders=openai"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(
    body.reason,
    "Skipping openai/gpt-4o \u2014 provider openai marked exhausted this request (#1731)"
  );
  assert.equal(body.connectionId, null);
});

test("unrelated connection of an exhausted pair is not skipped", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason" +
        "?model=openai/gpt-4o&provider=openai&connectionId=conn-2" +
        "&exhaustedConnections=openai:conn-1"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  assert.equal(body.reason, null);
});

test("400 when 'model' query param is missing", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason?provider=openai"
    )
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(String(body.error), /model/);
});

test("400 when 'provider' query param is missing", async () => {
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason?model=openai/gpt-4o"
    )
  );

  assert.equal(response.status, 400);
  const body = await response.json();
  assert.match(String(body.error), /provider/);
});

test("trims whitespace and skips empty entries in CSV set inputs", async () => {
  // Reproduces the documented contract: trailing commas / stray whitespace
  // must NOT silently match the target via an empty entry.
  await localDb.updateSettings({ requireLogin: false });

  const { GET } = await buildRoute();
  const response = await GET(
    skipAuthRequest(
      "https://example.com/api/combos/exhaustion/skip-reason" +
        "?model=openai/gpt-4o&provider=openai&connectionId=conn-1" +
        "&exhaustedProviders=%20openai%20,,%20%20,anthropic" +
        "&exhaustedConnections=%20,:conn-1,openai:conn-1"
    )
  );

  assert.equal(response.status, 200);
  const body = await response.json();
  // The actual skip reason is the #1731v2 connection-match — we just assert
  // no spurious match was generated from the empty / whitespace-only entries.
  assert.ok(body.reason?.includes("(#1731v2)"));
});
