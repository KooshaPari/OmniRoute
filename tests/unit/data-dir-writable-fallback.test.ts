import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import {
  resolveWritableDataDir,
  getDefaultDataDir,
  resolveDataDir,
} from "../../src/lib/dataPaths.ts";

// Running as root bypasses POSIX permission bits, so a chmod-based "unwritable"
// directory would still be writable and the EACCES/EPERM branch never triggers.
const IS_ROOT = typeof process.getuid === "function" && process.getuid() === 0;
const IS_WINDOWS = process.platform === "win32";

async function withTempEnv(fn: (paths: { root: string; home: string }) => void | Promise<void>) {
  const originalEnv = { ...process.env };
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-datadir-"));
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });

  delete process.env.DATA_DIR;
  delete process.env.XDG_CONFIG_HOME;
  delete process.env.APPDATA;
  process.env.HOME = home;
  process.env.USERPROFILE = home;

  try {
    await fn({ root, home });
  } finally {
    for (const key of Object.keys(process.env)) {
      if (!(key in originalEnv)) delete process.env[key];
    }
    for (const [key, value] of Object.entries(originalEnv)) {
      process.env[key] = value;
    }
    // Restore perms before cleanup so rmSync can delete read-only parents.
    try {
      fs.chmodSync(root, 0o755);
    } catch {
      // ignore
    }
    fs.rmSync(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  }
}

test("resolveWritableDataDir returns the configured DATA_DIR when it is writable", async () => {
  await withTempEnv(({ root }) => {
    const configured = path.join(root, "writable-data");
    process.env.DATA_DIR = configured;

    const resolved = resolveWritableDataDir();
    assert.equal(resolved, path.resolve(configured));
    // The probe creates the directory as a side effect.
    assert.ok(fs.existsSync(configured));
  });
});

test(
  "explicit inaccessible DATA_DIR fails without touching the default directory",
  { skip: IS_ROOT || IS_WINDOWS },
  async () => {
    await withTempEnv(({ root, home }) => {
      process.env.XDG_CONFIG_HOME = home;
      const fallback = getDefaultDataDir();
      assert.ok(fallback.startsWith(path.resolve(home)));
      fs.mkdirSync(fallback, { recursive: true });
      const sentinel = path.join(fallback, "sentinel");
      fs.writeFileSync(sentinel, "preserve");
      const lockedParent = path.join(root, "locked");
      fs.mkdirSync(lockedParent);
      fs.chmodSync(lockedParent, 0o555);
      process.env.DATA_DIR = path.join(lockedParent, "data");
      assert.throws(() => resolveWritableDataDir(), (error) => {
        const code = (error as NodeJS.ErrnoException).code;
        return code === "EACCES" || code === "EPERM";
      });
      assert.equal(fs.readFileSync(sentinel, "utf8"), "preserve");
      assert.deepEqual(fs.readdirSync(fallback), ["sentinel"]);
    });
  }
);

test("resolveWritableDataDir returns the default dir (no probe) when DATA_DIR is unset", async () => {
  await withTempEnv(() => {
    delete process.env.DATA_DIR;
    // #10428: this asserts the SERVER path. Since the test-context guard now redirects a
    // DATA_DIR-less test process to a temp dir (so a test can never open the operator's
    // real DB), opt back in explicitly here — otherwise this test would be asserting the
    // guard's behavior instead of the server's.
    process.env.OMNIROUTE_ALLOW_DEFAULT_DATA_DIR = "1";
    const resolved = resolveWritableDataDir();
    assert.equal(resolved, getDefaultDataDir());
    // Matches the pure resolver when no override is present.
    assert.equal(resolved, resolveDataDir());
  });
});

test("resolveWritableDataDir rethrows non-permission errors", { skip: IS_WINDOWS }, async () => {
  await withTempEnv(({ root }) => {
    // Point DATA_DIR at a path whose parent is a regular file → ENOTDIR, not EACCES.
    const fileParent = path.join(root, "iam-a-file");
    fs.writeFileSync(fileParent, "x");

    const configured = path.join(fileParent, "data");
    process.env.DATA_DIR = configured;

    assert.throws(
      () => resolveWritableDataDir(),
      (err: NodeJS.ErrnoException) => {
        return err.code !== "EACCES" && err.code !== "EPERM";
      }
    );
  });
});

test("resolveWritableDataDir leaves the cloud sentinel untouched", async () => {
  await withTempEnv(() => {
    process.env.DATA_DIR = "/some/configured/path";
    const resolved = resolveWritableDataDir({ isCloud: true });
    assert.equal(resolved, "/tmp");
  });
});
