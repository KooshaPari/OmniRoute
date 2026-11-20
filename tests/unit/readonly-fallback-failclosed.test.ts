import test from "node:test";
import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { openDatabaseAsync } from "../../src/lib/db/adapters/driverFactory.ts";

test("readonly open fails closed when native drivers are unavailable", async () => {
  const file = path.join(
    mkdtempSync(path.join(tmpdir(), "omniroute-readonly-")),
    "db.sqlite",
  );
  const seed = new DatabaseSync(file);
  seed.exec(
    "CREATE TABLE witness(value TEXT); INSERT INTO witness VALUES ('preserve')",
  );
  seed.close();
  const nativeReadonly = await openDatabaseAsync(file, { readonly: true });
  assert.notEqual(nativeReadonly.driver, "sql.js");
  assert.throws(() =>
    nativeReadonly.exec("INSERT INTO witness VALUES ('forbidden')"),
  );
  nativeReadonly.close();
  const oldSmoke = process.env.OMNIROUTE_PACK_BOOT_SMOKE;
  const oldForce = process.env.OMNIROUTE_PACK_BOOT_FORCE_SQLJS;
  process.env.OMNIROUTE_PACK_BOOT_SMOKE = "1";
  process.env.OMNIROUTE_PACK_BOOT_FORCE_SQLJS = "1";
  try {
    await assert.rejects(
      openDatabaseAsync(file, { readonly: true }),
      /read.only.*unavailable/i,
    );
    const verify = new DatabaseSync(file, { readOnly: true });
    assert.equal(
      verify.prepare("SELECT value FROM witness").get().value,
      "preserve",
    );
    verify.close();
    const writable = await openDatabaseAsync(file);
    assert.equal(writable.driver, "sql.js");
    writable.exec("INSERT INTO witness VALUES ('writable-control')");
    writable.close();
  } finally {
    if (oldSmoke === undefined) delete process.env.OMNIROUTE_PACK_BOOT_SMOKE;
    else process.env.OMNIROUTE_PACK_BOOT_SMOKE = oldSmoke;
    if (oldForce === undefined)
      delete process.env.OMNIROUTE_PACK_BOOT_FORCE_SQLJS;
    else process.env.OMNIROUTE_PACK_BOOT_FORCE_SQLJS = oldForce;
  }
});
