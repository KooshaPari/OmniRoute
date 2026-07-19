import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { test } from "node:test";

const routes = ["src/app/api/compression/budget/route.ts", "src/app/api/virtual-keys/route.ts"];

test("request bodies for compression budget and virtual keys use schema validation", () => {
  const result = spawnSync(
    process.execPath,
    ["scripts/check/check-route-validation.mjs", "--files", ...routes],
    { cwd: process.cwd(), encoding: "utf8" },
  );

  assert.equal(result.status, 0, `${result.stdout}\n${result.stderr}`);
  assert.match(result.stdout, /PASS/);
});
