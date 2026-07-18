import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const source = fs.readFileSync(path.resolve("src/mitm/manager.ts"), "utf8");

test("MITM worker startup rejects duplicate active or in-flight starts", () => {
  assert.match(source, /if \(mitmWorker \|\| mitmWorkerStarting\)/);
  assert.match(source, /already running or starting/);
});

test("failed MITM worker startup clears state and terminates the failed worker", () => {
  assert.match(source, /if \(mitmWorker === worker\) mitmWorker = null/);
  assert.match(source, /await worker\.terminate\(\)\.catch/);
  assert.match(source, /finally \{\s*mitmWorkerStarting = false;/s);
});

test("MITM worker readiness delegates to the explicit-message readiness gate", () => {
  assert.match(source, /await waitForMitmWorkerReady\(worker\)/);
  assert.doesNotMatch(source, /setTimeout\(\(\) => settleReady/);
});
