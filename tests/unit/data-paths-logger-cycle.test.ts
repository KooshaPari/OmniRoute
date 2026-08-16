import assert from "node:assert/strict";
import test from "node:test";

test("dataPaths initializes without recursively initializing the logger", async () => {
  const dataPaths = await import("../../src/lib/dataPaths.ts?logger-cycle-regression");

  assert.equal(dataPaths.APP_NAME, "omniroute");
  assert.equal(typeof dataPaths.resolveWritableDataDir, "function");
});
