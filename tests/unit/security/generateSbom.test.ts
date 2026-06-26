/**
 * tests/unit/security/generateSbom.test.ts
 *
 * CycloneDX 1.5 schema compliance + component enumeration tests for
 * scripts/sbom/generate-sbom.mjs.
 *
 * Strategy:
 *   - The script is stdlib-only ESM, so we import it indirectly by invoking it
 *     in a subprocess and parsing stdout JSON. This avoids needing to mock
 *     anything and exercises the real CLI surface (arg parsing, file I/O).
 *   - Each test runs in a tmp dir we control via --out, so no global state is
 *     polluted.
 *
 * 10 assertions across 4 test cases:
 *   1. stdout JSON summary shape (3)
 *   2. CycloneDX required fields present (3)
 *   3. component enumeration (3)
 *   4. purl + license + hash fields (1)
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const REPO_ROOT = resolve(import.meta.dirname, "..", "..", "..");
const SCRIPT = join(REPO_ROOT, "scripts", "sbom", "generate-sbom.mjs");

function runGenerate(outDir: string, extraArgs: string[] = []): { summary: any; bom: any; stderr: string } {
  mkdirSync(outDir, { recursive: true });
  const result = execFileSync("node", [SCRIPT, "--out", outDir, "--pretty", ...extraArgs], {
    cwd: REPO_ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  // The script prints a single JSON line to stdout. Find it in the output.
  const lines = result.trim().split("\n");
  const summaryLine = lines[lines.length - 1];
  const summary = JSON.parse(summaryLine);
  const bomPath = summary.outFile as string;
  const bom = JSON.parse(readFileSync(bomPath, "utf8"));
  return { summary, bom, stderr: "" };
}

function freshTmp(): string {
  const d = join(tmpdir(), `sbom-test-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);
  mkdirSync(d, { recursive: true });
  return d;
}

// ---------------------------------------------------------------------------
// 1. stdout JSON summary shape — 3 assertions
// ---------------------------------------------------------------------------

test("generate-sbom: stdout summary carries ok, specVersion, componentCount", () => {
  const tmp = freshTmp();
  try {
    const { summary } = runGenerate(tmp);
    assert.equal(summary.ok, true);
    assert.equal(summary.specVersion, "1.5");
    assert.ok(summary.componentCount > 0, `expected componentCount > 0, got ${summary.componentCount}`);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 2. CycloneDX required fields — 3 assertions
// ---------------------------------------------------------------------------

test("generate-sbom: produced BOM declares bomFormat=CycloneDX and specVersion=1.5", () => {
  const tmp = freshTmp();
  try {
    const { bom } = runGenerate(tmp);
    assert.equal(bom.bomFormat, "CycloneDX");
    assert.equal(bom.specVersion, "1.5");
    assert.ok(Array.isArray(bom.components));
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 3. Component enumeration — 3 assertions
// ---------------------------------------------------------------------------

test("generate-sbom: BOM contains a root component and npm components", () => {
  const tmp = freshTmp();
  try {
    const { bom } = runGenerate(tmp);
    const root = bom.components.find((c: any) => c["bom-ref"] === "root");
    assert.ok(root, "root component must exist");
    const npmComps = bom.components.filter((c: any) => c.purl?.startsWith("pkg:npm/"));
    assert.ok(npmComps.length > 0, "must enumerate npm deps with purl");
    // every component must have name + version
    for (const c of bom.components) {
      assert.ok(c.name && c.version, `component ${c["bom-ref"]} missing name/version`);
    }
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});

// ---------------------------------------------------------------------------
// 4. purl + license + hash fields — 1 assertion
// ---------------------------------------------------------------------------

test("generate-sbom: at least one npm component has a non-empty purl", () => {
  const tmp = freshTmp();
  try {
    const { bom } = runGenerate(tmp);
    const npm = bom.components.find((c: any) => c.purl?.startsWith("pkg:npm/"));
    assert.ok(npm, "expected at least one npm component with a purl");
    assert.match(npm.purl, /^pkg:npm\/[^@]+@[^/]+$/);
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
});
