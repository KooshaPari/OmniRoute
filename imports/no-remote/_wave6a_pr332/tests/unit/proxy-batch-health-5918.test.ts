import assert from "node:assert/strict";
import { after, before, describe, test } from "node:test";

// Prevent the scheduler's import-time auto-init (60s timer + network sweep)
// from leaving a dangling handle that hangs the native test runner.
process.env.PROXY_HEALTH_ENABLED = "false";

const ORIGINAL_ENV = {
  PROXY_HEALTH_ENABLED: process.env.PROXY_HEALTH_ENABLED,
  OMNIROUTE_DISABLE_BACKGROUND_SERVICES: process.env.OMNIROUTE_DISABLE_BACKGROUND_SERVICES,
};

after(() => {
  for (const [k, v] of Object.entries(ORIGINAL_ENV)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  delete globalThis.__proxyHealthInterval;
  delete globalThis.__proxyHealthConsecutiveFailures;
});

describe("#5918 proxy batch-delete route", () => {
  let POST: (req: Request) => Promise<Response>;

  before(async () => {
    ({ POST } = await import("@/app/api/settings/proxies/batch-delete/route.ts"));
  });

  function localRequest(body: unknown): Request {
    // Loopback origin so requireManagementAuth() permits the request without a key.
    return new Request("http://localhost:20128/api/settings/proxies/batch-delete", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:20128" },
      body: JSON.stringify(body),
    });
  }

  test("rejects an empty ids array (Zod min(1))", async () => {
    const res = await POST(localRequest({ ids: [] }));
    assert.equal(res.status, 400);
    const json = (await res.json()) as { error?: { message?: string } };
    // Error body must be sanitized — never leak a stack trace path.
    assert.ok(!(json.error?.message ?? "").includes("at /"));
  });

  test("rejects more than 100 ids (Zod max(100))", async () => {
    const ids = Array.from({ length: 101 }, (_, i) => `p${i}`);
    const res = await POST(localRequest({ ids }));
    assert.equal(res.status, 400);
  });

  test("rejects a malformed JSON body", async () => {
    const req = new Request("http://localhost:20128/api/settings/proxies/batch-delete", {
      method: "POST",
      headers: { "content-type": "application/json", host: "localhost:20128" },
      body: "{ not json",
    });
    const res = await POST(req);
    assert.equal(res.status, 400);
  });
});

describe("#5918 proxy health scheduler lifecycle", () => {
  let initProxyHealthCheck: () => void;
  let stopProxyHealthCheck: () => void;

  before(async () => {
    ({ initProxyHealthCheck, stopProxyHealthCheck } = await import(
      "@/lib/proxyHealth/scheduler.ts"
    ));
  });

  test("does not arm a timer when PROXY_HEALTH_ENABLED=false", () => {
    process.env.PROXY_HEALTH_ENABLED = "false";
    delete globalThis.__proxyHealthInterval;
    initProxyHealthCheck();
    assert.equal(globalThis.__proxyHealthInterval, undefined);
  });

  test("does not arm a timer when background services are disabled", () => {
    process.env.PROXY_HEALTH_ENABLED = "true";
    process.env.OMNIROUTE_DISABLE_BACKGROUND_SERVICES = "1";
    delete globalThis.__proxyHealthInterval;
    initProxyHealthCheck();
    assert.equal(globalThis.__proxyHealthInterval, undefined);
    stopProxyHealthCheck();
  });

  test("stopProxyHealthCheck clears an armed interval", () => {
    globalThis.__proxyHealthInterval = setInterval(() => {}, 1_000_000);
    stopProxyHealthCheck();
    assert.equal(globalThis.__proxyHealthInterval, undefined);
  });
});
