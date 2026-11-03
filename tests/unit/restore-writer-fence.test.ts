import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { SignJWT } from "jose";

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-restore-fence-"));
process.env.DATA_DIR = dir;
process.env.DISABLE_SQLITE_AUTO_BACKUP = "true";
const core = await import("../../src/lib/db/core.ts");
const backup = await import("../../src/lib/db/backup.ts");
const importRoute = await import("../../src/app/api/db-backups/import/route.ts");
const backupRoute = await import("../../src/app/api/db-backups/route.ts");

test.after(() => {
  core.closeDbInstance();
  fs.rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
});

test("online restore rejects before changing the open database or its WAL", async () => {
  const db = core.getDbInstance();
  const now = new Date().toISOString();
  const insert = db.prepare("INSERT INTO provider_connections (id, provider, auth_type, name, is_active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)");
  insert.run("before-backup", "openai", "apikey", "one", 1, now, now);
  fs.mkdirSync(core.DB_BACKUPS_DIR, { recursive: true });
  const id = "db_2026-01-01T00-00-00-000Z_manual.sqlite";
  await db.backup(path.join(core.DB_BACKUPS_DIR, id));
  insert.run("after-backup", "openai", "apikey", "two", 1, now, now);
  const walPath = `${core.SQLITE_FILE}-wal`;
  const walBefore = fs.readFileSync(walPath);
  await assert.rejects(() => backup.restoreDbBackup(id), /exclusive writer ownership/);
  const importResponse = await importRoute.POST(new Request("http://localhost/api/db-backups/import", { method: "POST" }));
  assert.equal(importResponse.status, 503);
  assert.match((await importResponse.json()).error, /offline recovery/);
  assert.equal(core.getDbInstance(), db);
  assert.equal((db.prepare("SELECT COUNT(*) AS n FROM provider_connections WHERE id IN (?, ?)").get("before-backup", "after-backup") as { n: number }).n, 2);
  assert.ok(fs.readFileSync(walPath).equals(walBefore));
  const initialPassword = process.env.INITIAL_PASSWORD;
  const jwtSecret = process.env.JWT_SECRET;
  process.env.INITIAL_PASSWORD = "test-only-password";
  process.env.JWT_SECRET = "test-only-jwt-secret";
  try {
    const deniedImport = await importRoute.POST(new Request("http://localhost/api/db-backups/import", { method: "POST" }));
    const deniedRestore = await backupRoute.POST(new Request("http://localhost/api/db-backups", { method: "POST" }));
    assert.equal(deniedImport.status, 401);
    assert.equal(deniedRestore.status, 401);
    const token = await new SignJWT({ authenticated: true })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime("1h")
      .sign(new TextEncoder().encode(process.env.JWT_SECRET));
    const authWalBefore = fs.readFileSync(walPath);
    const headers = { cookie: `auth_token=${token}`, "content-type": "application/json" };
    const authorizedRestore = await backupRoute.POST(new Request("http://localhost/api/db-backups", {
      method: "POST", headers, body: JSON.stringify({ backupId: id }),
    }));
    const authorizedImport = await importRoute.POST(new Request("http://localhost/api/db-backups/import", {
      method: "POST", headers,
    }));
    assert.equal(authorizedRestore.status, 503);
    assert.equal(authorizedImport.status, 503);
    assert.match((await authorizedRestore.json()).error, /offline recovery/);
    assert.match((await authorizedImport.json()).error, /offline recovery/);
    assert.ok(fs.readFileSync(walPath).equals(authWalBefore));
  } finally {
    if (initialPassword === undefined) delete process.env.INITIAL_PASSWORD;
    else process.env.INITIAL_PASSWORD = initialPassword;
    if (jwtSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = jwtSecret;
  }
});
