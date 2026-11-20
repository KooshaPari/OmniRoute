import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { getDefaultDataDir, resolveWritableDataDir } from "../../src/lib/dataPaths.ts";

function withEnv(values: Record<string, string | undefined>, fn: () => void) {
  const previous = Object.fromEntries(Object.keys(values).map((key) => [key, process.env[key]]));
  for (const [key, value] of Object.entries(values)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
  try {
    fn();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

for (const code of ["EACCES", "EPERM", "ENOTDIR", "ENOSPC"]) {
  test(`explicit DATA_DIR refuses ${code} without using a default`, () => {
    withEnv({ DATA_DIR: path.join(os.tmpdir(), "omni-denied-fixture") }, () => {
      const original = fs.mkdirSync;
      const expected = Object.assign(new Error("fixture failure"), { code });
      let calls = 0;
      fs.mkdirSync = (() => {
        calls++;
        throw expected;
      }) as typeof fs.mkdirSync;
      try {
        assert.throws(
          () => resolveWritableDataDir(),
          (error) => error === expected
        );
        assert.equal(calls, 1);
      } finally {
        fs.mkdirSync = original;
      }
    });
  });
}

test("explicit new data directory is created and returned", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "omni-datadir-failclosed-"));
  const configured = path.join(root, "new", "data");
  withEnv({ DATA_DIR: configured }, () => {
    assert.equal(resolveWritableDataDir(), path.resolve(configured));
    assert.equal(fs.statSync(configured).isDirectory(), true);
  });
});

test("unconfigured opted-in default and cloud sentinel stay unchanged", () => {
  withEnv({ DATA_DIR: undefined, OMNIROUTE_ALLOW_DEFAULT_DATA_DIR: "1" }, () => {
    assert.equal(resolveWritableDataDir(), getDefaultDataDir());
    assert.equal(resolveWritableDataDir({ isCloud: true }), "/tmp");
  });
});
