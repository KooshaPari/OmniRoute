import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";

import { getDefaultDataDir, resolveWritableDataDir } from "../../src/lib/dataPaths.ts";

function withDataDirEnv(fn: () => void): void {
  const previousDataDir = process.env.DATA_DIR;
  const previousHome = process.env.HOME;
  const previousUserProfile = process.env.USERPROFILE;
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omniroute-datapaths-cycle-"));
  const home = path.join(root, "home");
  fs.mkdirSync(home, { recursive: true });
  process.env.HOME = home;
  process.env.USERPROFILE = home;
  process.env.DATA_DIR = path.join(root, "configured-data");

  try {
    fn();
  } finally {
    if (previousDataDir === undefined) delete process.env.DATA_DIR;
    else process.env.DATA_DIR = previousDataDir;
    if (previousHome === undefined) delete process.env.HOME;
    else process.env.HOME = previousHome;
    if (previousUserProfile === undefined) delete process.env.USERPROFILE;
    else process.env.USERPROFILE = previousUserProfile;
    fs.rmSync(root, { recursive: true, force: true });
  }
}

test("logger dynamically imports without a data-path initialization cycle", async () => {
  const previousLogToFile = process.env.APP_LOG_TO_FILE;
  process.env.APP_LOG_TO_FILE = "false";

  try {
    const loggerModule = await import("../../src/shared/utils/logger.ts");

    assert.equal(typeof loggerModule.logger.info, "function");
    assert.equal(typeof loggerModule.createLogger("import-cycle-test").warn, "function");
  } finally {
    if (previousLogToFile === undefined) delete process.env.APP_LOG_TO_FILE;
    else process.env.APP_LOG_TO_FILE = previousLogToFile;
  }
});

test("permission failures notify the optional callback with typed fallback details", () => {
  withDataDirEnv(() => {
    const originalMkdirSync = fs.mkdirSync;
    const expectedFallback = getDefaultDataDir();
    let details: { resolved: string; fallback: string; code: "EACCES" | "EPERM" } | undefined;
    fs.mkdirSync = (() => {
      const error = Object.assign(new Error("permission denied"), { code: "EACCES" });
      throw error;
    }) as typeof fs.mkdirSync;

    try {
      const resolved = resolveWritableDataDir({
        onPermissionFallback: (value) => {
          details = value;
        },
      });

      assert.equal(resolved, expectedFallback);
      assert.deepEqual(details, {
        resolved: path.resolve(process.env.DATA_DIR!),
        fallback: expectedFallback,
        code: "EACCES",
      });
    } finally {
      fs.mkdirSync = originalMkdirSync;
    }
  });
});

test("non-permission data directory failures are rethrown without invoking the callback", () => {
  withDataDirEnv(() => {
    const originalMkdirSync = fs.mkdirSync;
    let callbackCalls = 0;
    const expectedError = Object.assign(new Error("not a directory"), { code: "ENOTDIR" });
    fs.mkdirSync = (() => {
      throw expectedError;
    }) as typeof fs.mkdirSync;

    try {
      assert.throws(
        () => resolveWritableDataDir({ onPermissionFallback: () => callbackCalls++ }),
        (error) => error === expectedError
      );
      assert.equal(callbackCalls, 0);
    } finally {
      fs.mkdirSync = originalMkdirSync;
    }
  });
});
