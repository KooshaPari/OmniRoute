/**
 * #13470 — background OAuth refresh must consult PROXY_FAIL_OPEN.
 *
 * When a proxy is ASSIGNED to a connection but its pool is dead,
 * resolveProxyForCredentials used to fall through to direct egress silently,
 * leaking the account's refresh token on the host's real IP — exactly the
 * scenario PROXY_FAIL_OPEN exists to prevent.
 *
 * Behaviour under test:
 *   - blocking assignment + no flag  -> refuse (PROXY_ASSIGNED_UNAVAILABLE)
 *   - blocking assignment + flag=true -> allow the direct refresh
 *
 * Pristine main has no such guard, so the first case does not throw there.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-oauth-failopen-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-secret";

const core = await import("../../src/lib/db/core.ts");
const proxiesDb = await import("../../src/lib/db/proxies.ts");
const providersDb = await import("../../src/lib/db/providers.ts");
const { checkAndRefreshToken } = await import("../../src/sse/services/tokenRefresh.ts");

function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

/** Create a connection whose assigned proxy is dead -> blocking assignment. */
async function connectionWithDeadProxy(): Promise<string> {
  const conn = await providersDb.createProviderConnection({
    provider: "github",
    authType: "oauth",
    name: `Conn ${Date.now()} ${Math.random()}`,
    apiKey: "",
  });
  const connId = (conn as { id: string }).id;
  const proxy = await proxiesDb.createProxy({
    name: "Dead paid proxy",
    type: "http",
    host: "127.0.0.1",
    port: 9001,
  });
  await proxiesDb.updateProxy(proxy!.id, { status: "inactive" });
  await proxiesDb.assignProxyToScope("account", connId, proxy!.id);
  return connId;
}

/** Credentials that force the proactive refresh path (already expired). */
function expiredCredentials(connId: string) {
  return {
    connectionId: connId,
    accessToken: "x",
    refreshToken: "y",
    expiresAt: new Date(Date.now() - 1000).toISOString(),
  };
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("#13470: dead assigned proxy without PROXY_FAIL_OPEN refuses direct refresh", async () => {
  resetStorage();
  delete process.env.PROXY_FAIL_OPEN;
  const connId = await connectionWithDeadProxy();
  assert.equal(proxiesDb.hasBlockingProxyAssignment(connId), true, "setup must be blocking");

  await assert.rejects(
    () => checkAndRefreshToken("github", expiredCredentials(connId)),
    (err: unknown) => {
      const message = String((err as { message?: string }).message ?? "");
      assert.ok(
        message.includes("PROXY_ASSIGNED_UNAVAILABLE"),
        `expected the fail-closed guard, got: ${message.slice(0, 160)}`
      );
      return true;
    }
  );
});

test("#13470: PROXY_FAIL_OPEN=true allows the direct refresh past the guard", async () => {
  resetStorage();
  process.env.PROXY_FAIL_OPEN = "true";
  try {
    const connId = await connectionWithDeadProxy();
    assert.equal(proxiesDb.hasBlockingProxyAssignment(connId), true, "setup must be blocking");

    try {
      await checkAndRefreshToken("github", expiredCredentials(connId));
      // Resolved: the guard let the refresh through (or it settled without
      // needing a token). Either way it was not refused.
    } catch (err) {
      // A downstream refresh/network failure is fine and environment
      // dependent; the guard refusing is not.
      const message = String((err as { message?: string }).message ?? "");
      assert.ok(
        !message.includes("PROXY_ASSIGNED_UNAVAILABLE"),
        `fail-open must not be refused by the guard: ${message.slice(0, 160)}`
      );
    }
  } finally {
    delete process.env.PROXY_FAIL_OPEN;
  }
});
