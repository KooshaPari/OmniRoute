import test from "node:test";
import assert from "node:assert/strict";

test("data paths imports without initializing the logger cycle", async () => {
  const module = await import("../../src/lib/dataPaths.ts");

  assert.equal(module.APP_NAME, "omniroute");
});
