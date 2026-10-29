import { test } from "node:test";
import assert from "node:assert";
import { execFileSync } from "node:child_process";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { evaluateFileSizes, getBaseLoc } from "../../scripts/check/check-file-size.mjs";

const cap = 800;

test("frozen file at exactly its baseline passes", () => {
  const r = evaluateFileSizes({ "a.ts": 1000 }, { "a.ts": 1000 }, cap);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, []);
});

test("frozen file that grew is a violation", () => {
  const r = evaluateFileSizes({ "a.ts": 1001 }, { "a.ts": 1000 }, cap);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /a\.ts/);
});

test("frozen file that shrank is an improvement, not a violation", () => {
  const r = evaluateFileSizes({ "a.ts": 950 }, { "a.ts": 1000 }, cap);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, [["a.ts", 950]]);
});

test("new file over the cap is a violation", () => {
  const r = evaluateFileSizes({ "new.ts": 801 }, {}, cap);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /new\.ts/);
});

test("new file at or under the cap passes", () => {
  const r = evaluateFileSizes({ "new.ts": 800 }, {}, cap);
  assert.deepEqual(r.violations, []);
});

// --- Test-file path (Layer 1 anti-reinflation: same evaluateFileSizes, testCap=800) ---
// The test-file gate reuses evaluateFileSizes with (currentTestLoc, testFrozen, testCap),
// so we exercise it directly with test-file-shaped inputs.

const testCap = 800;

test("new test file over the testCap is a violation", () => {
  const r = evaluateFileSizes({ "tests/unit/huge.test.ts": 1200 }, {}, testCap);
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /huge\.test\.ts/);
});

test("new test file at or under the testCap passes", () => {
  const r = evaluateFileSizes({ "tests/unit/small.test.ts": 800 }, {}, testCap);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, []);
});

test("frozen test file that grew is a violation", () => {
  const r = evaluateFileSizes(
    { "tests/unit/combo-routing-engine.test.ts": 3300 },
    { "tests/unit/combo-routing-engine.test.ts": 3213 },
    testCap
  );
  assert.equal(r.violations.length, 1);
  assert.match(r.violations[0], /combo-routing-engine\.test\.ts/);
});

test("frozen test file that shrank is an improvement, not a violation", () => {
  const r = evaluateFileSizes(
    { "tests/unit/combo-routing-engine.test.ts": 3000 },
    { "tests/unit/combo-routing-engine.test.ts": 3213 },
    testCap
  );
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, [["tests/unit/combo-routing-engine.test.ts", 3000]]);
});

// --- Redundant entries (#8584): an entry that no longer needs to exist ---
// `--update` could only ever delete an entry from inside the improvement branch
// (loc < frozen), so a file sitting at EXACTLY its frozen value while already
// within the new-file cap could never leave the baseline, however far under the
// cap it was. Those entries are reported separately as `redundant`.

test("frozen file sitting at its baseline but already within the cap is redundant", () => {
  const r = evaluateFileSizes({ "a.ts": 500 }, { "a.ts": 500 }, cap);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, []);
  assert.deepEqual(r.redundant, ["a.ts"]);
});

test("frozen file sitting at its baseline but still over the cap is NOT redundant", () => {
  const r = evaluateFileSizes({ "a.ts": 1000 }, { "a.ts": 1000 }, cap);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, []);
  assert.deepEqual(r.redundant, []);
});

test("frozen file exactly at the cap is redundant (cap is inclusive)", () => {
  const r = evaluateFileSizes({ "a.ts": 800 }, { "a.ts": 800 }, cap);
  assert.deepEqual(r.redundant, ["a.ts"]);
});

test("a file that shrank stays an improvement and is not double-counted as redundant", () => {
  const r = evaluateFileSizes({ "a.ts": 500 }, { "a.ts": 1000 }, cap);
  assert.deepEqual(r.improvements, [["a.ts", 500]]);
  assert.deepEqual(r.redundant, []);
});

test("a frozen file that grew is a violation and never redundant", () => {
  const r = evaluateFileSizes({ "a.ts": 1001 }, { "a.ts": 1000 }, cap);
  assert.equal(r.violations.length, 1);
  assert.deepEqual(r.redundant, []);
});

test("the real residual entries from #8584 are reported as redundant", () => {
  // Measured on release/v3.8.49 @ 4053e2314: each sits at exactly its frozen
  // value and far below the 800 cap, yet survived a full `--update` run.
  const frozen = {
    "src/app/(dashboard)/dashboard/providers/[id]/ProviderDetailPageClient.tsx": 798,
    "src/app/(dashboard)/dashboard/providers/[id]/hooks/useProviderModels.ts": 155,
    "src/app/(dashboard)/dashboard/providers/[id]/hooks/useProviderSettings.ts": 264,
  };
  const r = evaluateFileSizes({ ...frozen }, frozen, cap);
  assert.deepEqual(r.violations, []);
  assert.deepEqual(r.improvements, []);
  assert.deepEqual(r.redundant.sort(), Object.keys(frozen).sort());
});

test("redundant applies to the test-file path too", () => {
  const r = evaluateFileSizes(
    { "tests/unit/small.test.ts": 300 },
    { "tests/unit/small.test.ts": 300 },
    testCap
  );
  assert.deepEqual(r.redundant, ["tests/unit/small.test.ts"]);
});

// ─── getBaseLoc (--base-ref reader, #8522) ───────────────────────────────────

test("getBaseLoc counts every path in one pass, same as split('\\n').length", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "file-size-baseloc-"));
  try {
    execFileSync("git", ["init", "-q"], { cwd: dir, stdio: "ignore" });
    execFileSync("git", ["config", "user.email", "t@example.com"], { cwd: dir });
    execFileSync("git", ["config", "user.name", "t"], { cwd: dir });
    fs.mkdirSync(path.join(dir, "src"), { recursive: true });
    fs.writeFileSync(path.join(dir, "src/a.ts"), "a\nb\nc\n");
    fs.writeFileSync(path.join(dir, "src/empty.ts"), "");
    execFileSync("git", ["add", "."], { cwd: dir });
    execFileSync("git", ["commit", "-qm", "base"], { cwd: dir, stdio: "ignore" });

    const loc = getBaseLoc("HEAD", ["src/a.ts", "src/empty.ts", "src/missing.ts"], { cwd: dir });

    assert.deepEqual(loc, { "src/a.ts": 4, "src/empty.ts": 1 });
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test("getBaseLoc yields no entries when the ref is unknown", () => {
  const loc = getBaseLoc("refs/heads/definitely-not-a-real-ref", ["package.json"]);
  assert.deepEqual(loc, {});
});
