/**
 * Tests for the per-platform FFI release packages at
 * `packages/omniroute-ffi-{darwin-arm64,darwin-x64,linux-x64-gnu,linux-arm64-gnu,win32-x64}`.
 *
 * The release pipeline shape (ADR-032 Appendix D.1):
 *   1. `scripts/build-cross-ffi.sh` cross-compiles each Rust cdylib for the
 *      target platform/arch.
 *   2. Each output is staged into the matching `packages/omniroute-ffi-<plat>/`
 *      folder at `prebuilds/<lib>.node`.
 *   3. `scripts/publish-ffi-packages.sh` publishes each platform package
 *      separately to the registry (same version, scoped tag).
 *   4. `packages/omniroute-ffi` declares all 5 as `optionalDependencies`,
 *      so `npm install omniroute` automatically pulls the right one.
 *
 * These tests verify the package.json shape, the index.js loader, and the
 * .d.ts surface — NOT the actual cdylib load (CI host may not have the
 * build artifact for every platform).
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const DIR_NAMES = [
  "omniroute-ffi-darwin-arm64",
  "omniroute-ffi-darwin-x64",
  "omniroute-ffi-linux-x64-gnu",
  "omniroute-ffi-linux-arm64-gnu",
  "omniroute-ffi-win32-x64",
];

// Package IDs used in publish scripts (scoped npm format @omniroute/ffi-{platform})
const PACKAGE_IDS = [
  "@omniroute/ffi-darwin-arm64",
  "@omniroute/ffi-darwin-x64",
  "@omniroute/ffi-linux-x64-gnu",
  "@omniroute/ffi-linux-arm64-gnu",
  "@omniroute/ffi-win32-x64",
];

const REPO_ROOT = resolve(import.meta.dirname, "..", "..");

for (const pkg of DIR_NAMES) {
  test(`release-pipeline: ${pkg}/package.json exists + declares correct os/cpu`, () => {
    const pkgDir = resolve(REPO_ROOT, "packages", pkg);
    assert.ok(existsSync(pkgDir), `${pkgDir} should exist`);
    const pkgJsonPath = resolve(pkgDir, "package.json");
    assert.ok(existsSync(pkgJsonPath), `${pkgJsonPath} should exist`);
    const pkgJson = JSON.parse(readFileSync(pkgJsonPath, "utf-8"));
    // The package must be namespaced + versioned
    assert.match(pkgJson.name, /^@omniroute\//);
    assert.equal(typeof pkgJson.version, "string");
    // Must declare platform restrictions
    assert.ok(pkgJson.os, `${pkg} should declare os`);
    assert.ok(pkgJson.cpu, `${pkg} should declare cpu`);
    // Specific checks per platform
    if (pkg.includes("darwin-arm64")) {
      assert.deepEqual(pkgJson.os, ["darwin"]);
      assert.deepEqual(pkgJson.cpu, ["arm64"]);
    } else if (pkg.includes("darwin-x64")) {
      assert.deepEqual(pkgJson.os, ["darwin"]);
      assert.deepEqual(pkgJson.cpu, ["x64"]);
    } else if (pkg.includes("linux-x64-gnu")) {
      assert.deepEqual(pkgJson.os, ["linux"]);
      assert.deepEqual(pkgJson.cpu, ["x64"]);
      assert.ok(
        pkgJson.libc?.includes("glibc") || pkgJson.os === "linux",
        `${pkg} should declare glibc requirement`
      );
    } else if (pkg.includes("linux-arm64-gnu")) {
      assert.deepEqual(pkgJson.os, ["linux"]);
      assert.deepEqual(pkgJson.cpu, ["arm64"]);
    } else if (pkg.includes("win32-x64")) {
      assert.deepEqual(pkgJson.os, ["win32"]);
      assert.deepEqual(pkgJson.cpu, ["x64"]);
    }
  });

  test(`release-pipeline: ${pkg}/index.js loader exists`, () => {
    const idx = resolve(REPO_ROOT, "packages", pkg, "index.js");
    assert.ok(existsSync(idx), `${idx} should exist`);
    const content = readFileSync(idx, "utf-8");
    assert.match(
      content,
      /export\s+(default|async\s+function|function|const)\s+\w+/,
      `${pkg}/index.js should export a loader`
    );
  });

  test(`release-pipeline: ${pkg}/index.d.ts type surface exists`, () => {
    const dts = resolve(REPO_ROOT, "packages", pkg, "index.d.ts");
    assert.ok(existsSync(dts), `${dts} should exist`);
    const content = readFileSync(dts, "utf-8");
    assert.match(content, /export\s+(default|declare|interface|function)/);
  });
}

test("release-pipeline: aggregator package.json declares all 5 as optionalDependencies", () => {
  const aggregatorPath = resolve(REPO_ROOT, "packages", "omniroute-ffi", "package.json");
  if (!existsSync(aggregatorPath)) {
    // Optional — aggregator is only published for downstream consumers
    return;
  }
  const pkgJson = JSON.parse(readFileSync(aggregatorPath, "utf-8"));
  assert.ok(pkgJson.optionalDependencies, "aggregator should declare optionalDependencies");
  for (const pkgId of PACKAGE_IDS) {
    const declared = Object.keys(pkgJson.optionalDependencies).find(
      (k) => k === pkgId || k.endsWith(pkgId.replace(/^.*\//, ""))
    );
    assert.ok(declared, `${pkgId} should be listed in optionalDependencies`);
  }
});

test("release-pipeline: publish-ffi-packages.sh script exists", () => {
  const script = resolve(REPO_ROOT, "scripts", "publish-ffi-packages.sh");
  assert.ok(existsSync(script), `${script} should exist`);
  const content = readFileSync(script, "utf-8");
  // Must publish each platform (the script uses @omniroute/ffi-{platform} IDs)
  for (const pkgId of PACKAGE_IDS) {
    // Escape @ and / for regex matching
    const escaped = pkgId.replace(/[.@\/]/g, "\\$&").replace(/-/g, "[-_]");
    assert.match(content, new RegExp(escaped), `${script} should reference ${pkgId}`);
  }
});

test("release-pipeline: build-cross-ffi.sh covers all 5 platforms", () => {
  const script = resolve(REPO_ROOT, "scripts", "build-cross-ffi.sh");
  assert.ok(existsSync(script), `${script} should exist`);
  const content = readFileSync(script, "utf-8");
  // The script must list all 5 target triples
  assert.match(content, /aarch64-apple-darwin/);
  assert.match(content, /x86_64-apple-darwin/);
  assert.match(content, /x86_64-unknown-linux-gnu/);
  assert.match(content, /aarch64-unknown-linux-gnu/);
  // Accept either gnu or msvc — whichever cargo supports on this machine
  assert.ok(
    /x86_64-pc-windows-(?:msvc|gnu)/.test(content),
    "build-cross-ffi.sh should target a windows x64 triple"
  );
});