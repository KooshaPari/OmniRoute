import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { discoverTopLevelUnitTests } from "../../../scripts/test/unit-test-manifest.mjs";

test("partitions top-level unit tests by imported runner API", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "unit-manifest-"));
  const unit = path.join(root, "tests/unit");
  fs.mkdirSync(unit, { recursive: true });
  fs.writeFileSync(path.join(unit, "native.test.ts"), `import test from "node:test";`);
  fs.writeFileSync(path.join(unit, "vitest.test.ts"), `import { test } from "vitest";`);
  fs.writeFileSync(path.join(unit, "bun.test.ts"), `import { test } from "bun:test";`);
  fs.writeFileSync(path.join(unit, "implicit.test.ts"), `test("global", () => {});`);
  fs.writeFileSync(path.join(unit, "ignored.spec.ts"), `import { test } from "vitest";`);

  assert.deepEqual(discoverTopLevelUnitTests(root), {
    node: ["tests/unit/implicit.test.ts", "tests/unit/native.test.ts"],
    vitest: ["tests/unit/vitest.test.ts"],
    bun: ["tests/unit/bun.test.ts"],
  });
  fs.rmSync(root, { recursive: true, force: true });
});

test("the repository manifest is disjoint and classifies every top-level .test.ts", () => {
  const manifest = discoverTopLevelUnitTests(process.cwd());
  const expected = fs.readdirSync("tests/unit").filter((file) => file.endsWith(".test.ts"));
  const classified = [...manifest.node, ...manifest.vitest, ...manifest.bun];
  assert.equal(new Set(classified).size, classified.length);
  assert.equal(classified.length, expected.length);
  assert.ok(manifest.vitest.some((file) => file.endsWith("a2a-mint-virtual-key.test.ts")));
  assert.ok(manifest.bun.includes("tests/unit/combos-routes-regression.test.ts"));
  assert.ok(manifest.bun.includes("tests/unit/combos-routes.test.ts"));
  assert.ok(!manifest.node.includes("tests/unit/combos-routes-regression.test.ts"));
  assert.ok(!manifest.node.includes("tests/unit/combos-routes.test.ts"));
});

test("fails closed when a test imports more than one runner API", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "unit-manifest-overlap-"));
  const unit = path.join(root, "tests/unit");
  fs.mkdirSync(unit, { recursive: true });
  fs.writeFileSync(
    path.join(unit, "ambiguous.test.ts"),
    `import test from "node:test"; import { expect } from "vitest";`
  );
  assert.throws(
    () => discoverTopLevelUnitTests(root),
    /imports more than one of Vitest, node:test, and bun:test/
  );
  fs.rmSync(root, { recursive: true, force: true });
});

test("all native unit consumers use the manifest and Vitest consumes its partition", () => {
  const packageJson = fs.readFileSync("package.json", "utf8");
  const workflow = fs.readFileSync(".github/workflows/ci.yml", "utf8");
  const vitestConfig = fs.readFileSync("vitest.mcp.config.ts", "utf8");
  assert.doesNotMatch(packageJson, /tests\/unit\/\*\.test\.ts/);
  assert.doesNotMatch(workflow, /tests\/unit\/\*\.test\.ts/);
  assert.equal(packageJson.match(/unit-test-manifest\.mjs --node/g)?.length, 8);
  assert.equal(workflow.match(/unit-test-manifest\.mjs --node/g)?.length, 4);
  assert.match(vitestConfig, /discoverTopLevelUnitTests\(\)\.vitest/);
  assert.match(vitestConfig, /\.\.\.topLevelVitestTests/);
});
