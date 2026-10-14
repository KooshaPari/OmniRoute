/**
 * #13469 — the fail-closed proxy guard must be scoped to the combo a request
 * is actually routed under.
 *
 * A dead pool pinned to ONE combo must not take down every other combo (or
 * non-combo traffic) on the same connection. `hasBlockingProxyAssignment` gains
 * a third `comboName` argument and a `scope = 'combo'` arm in its query.
 *
 * Pristine main has neither: its query only knows account/provider/global, so a
 * combo-scoped assignment is invisible to it and the guard returns false.
 */

import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

const TEST_DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-combo-guard-"));
process.env.DATA_DIR = TEST_DATA_DIR;
process.env.API_KEY_SECRET = "test-secret";

const core = await import("../../src/lib/db/core.ts");
const proxiesDb = await import("../../src/lib/db/proxies.ts");
const providersDb = await import("../../src/lib/db/providers.ts");

function resetStorage() {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  fs.mkdirSync(TEST_DATA_DIR, { recursive: true });
}

async function makeConnection(): Promise<string> {
  const conn = await providersDb.createProviderConnection({
    provider: "openai",
    authType: "apiKey",
    name: `Conn ${Date.now()} ${Math.random()}`,
    apiKey: "sk-test",
  });
  return (conn as { id: string }).id;
}

async function deadComboProxy(comboId: string): Promise<void> {
  const proxy = await proxiesDb.createProxy({
    name: `Dead proxy for ${comboId}`,
    type: "http",
    host: "127.0.0.1",
    port: 9001,
  });
  await proxiesDb.updateProxy(proxy!.id, { status: "inactive" });
  await proxiesDb.assignProxyToScope("combo", comboId, proxy!.id);
}

test.after(() => {
  core.resetDbInstance();
  fs.rmSync(TEST_DATA_DIR, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("#13469: a dead combo-scoped assignment blocks that combo's request", async () => {
  resetStorage();
  const connId = await makeConnection();
  await deadComboProxy("combo-alpha");

  assert.equal(
    proxiesDb.hasBlockingProxyAssignment(connId, undefined, "combo-alpha"),
    true,
    "the combo that owns the dead pool must be blocked"
  );
});

test("#13469: other combos on the same connection are unaffected", async () => {
  resetStorage();
  const connId = await makeConnection();
  await deadComboProxy("combo-alpha");

  assert.equal(
    proxiesDb.hasBlockingProxyAssignment(connId, undefined, "combo-beta"),
    false,
    "a dead pool pinned to combo-alpha must not take down combo-beta"
  );
  assert.equal(
    proxiesDb.hasBlockingProxyAssignment(connId),
    false,
    "non-combo traffic must not match a combo-scoped assignment"
  );
});
