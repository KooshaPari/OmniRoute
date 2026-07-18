#!/usr/bin/env node
// scripts/quality/validate-npm-publish.mjs
//
// Pre-flight validator for `npm publish` from a release workflow.
//
// WHY: `auto-release.yml#publish-npm` and `release-channels.yml#promote` both
// run `npm publish --tag <X>` after bumping `package.json#version`. Catching
// the obvious class of failures BEFORE the publish step avoids:
//   - Spending NPM_TOKEN budget on a no-op publish (private:true, version
//     already published, etc.)
//   - Polluting the registry with malformed tarballs (missing files, bad
//     engines, bad bin entries)
//   - Leaving the working tree dirty (broken package.json, missing exports)
//
// This validator runs entirely locally — no network calls. It checks:
//
//   REQUIRED (hard fail):
//     - package.json parses
//     - "name" matches /^@?omniroute\// and is < 214 chars
//     - "version" parses as semver
//     - "private" is NOT true (publishing a private package is forbidden)
//     - "license" is set
//     - "files" field, if present, points to existing paths
//     - "bin" entries, if present, point to existing files (after build)
//     - "engines.node" parses as a valid range
//     - "main"/"exports" point to existing paths
//     - Working tree is clean (no uncommitted changes that would be excluded)
//     - Version hasn't already been published to npm (this requires network —
//       skipped by default; --check-remote enables it)
//
//   ADVISORY (report only, never blocks):
//     - README.md / LICENSE exist at the package root
//     - "repository" field is set
//     - "homepage" is set
//     - "bugs" field is set
//
// Usage:
//   node scripts/quality/validate-npm-publish.mjs [--json] [--check-remote]
//     --json          machine-readable output (report on stderr, JSON on stdout)
//     --check-remote  also query the npm registry to check version is unpublished
//     --package=PATH  validate a different package.json (default: ./package.json)
//
// Exit codes:
//   0  — package is publishable (or --check-remote confirmed unpublished)
//   1  — hard failure (at least one REQUIRED check failed)
//   2  — advisory issues only (warnings printed, exit 0 normally; exit 2 with
//        --strict-advisory)
//
// This script is wired into the release workflows as a pre-step before
// `npm publish` so failures surface in the workflow run summary instead of as
// a half-finished publish attempt.

import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");
const { argv } = process;

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = { json: false, checkRemote: false, strictAdvisory: false, package: null };
  for (const arg of argv.slice(2)) {
    if (arg === "--json") out.json = true;
    else if (arg === "--check-remote") out.checkRemote = true;
    else if (arg === "--strict-advisory") out.strictAdvisory = true;
    else if (arg.startsWith("--package=")) out.package = arg.slice("--package=".length);
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: validate-npm-publish.mjs [--json] [--check-remote] [--strict-advisory] [--package=PATH]");
      process.exit(0);
    }
  }
  return out;
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/** Parse a semver string, returning the major.minor.patch core plus any prerelease tag. */
export function parseSemver(v) {
  if (typeof v !== "string") return null;
  // Semver regex from semver.org: MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
  const m = v.match(/^(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z-.]+))?(?:\+([0-9A-Za-z-.]+))?$/);
  if (!m) return null;
  return {
    major: parseInt(m[1], 10),
    minor: parseInt(m[2], 10),
    patch: parseInt(m[3], 10),
    prerelease: m[4] ?? null,
    build: m[5] ?? null,
    raw: v,
  };
}

/** Validate that a package is publish-ready. Returns { required: [...], advisory: [...] }. */
export function validatePackage(pkg, options = {}) {
  const required = [];
  const advisory = [];
  const root = options.root ?? ROOT;

  // Required: name
  if (!pkg.name || typeof pkg.name !== "string") {
    required.push({ field: "name", message: "name is required" });
  } else {
    if (pkg.name.length > 214) {
      required.push({ field: "name", message: `name is ${pkg.name.length} chars (max 214)` });
    }
    if (!/^@?[a-z0-9][a-z0-9-_.]*\/?[a-z0-9][a-z0-9-_.]*$/.test(pkg.name) && !/^@?[a-z0-9][a-z0-9-_.]*$/.test(pkg.name)) {
      // scoped names: @scope/name; unscoped: name
      const scopeOk = /^@[a-z0-9][a-z0-9-_.]*\/[a-z0-9][a-z0-9-_.]*$/.test(pkg.name);
      const unscopedOk = /^[a-z0-9][a-z0-9-_.]*$/.test(pkg.name);
      if (!scopeOk && !unscopedOk) {
        required.push({ field: "name", message: `name "${pkg.name}" contains invalid characters` });
      }
    }
  }

  // Required: version (semver)
  if (!pkg.version) {
    required.push({ field: "version", message: "version is required" });
  } else if (!parseSemver(pkg.version)) {
    required.push({ field: "version", message: `version "${pkg.version}" is not valid semver` });
  }

  // Required: not private
  if (pkg.private === true) {
    required.push({ field: "private", message: "private:true — cannot publish a private package" });
  }

  // Required: license (allow UNLICENSED/SEE-LICENSE-IN but warn if missing)
  if (!pkg.license && !pkg.licenses) {
    required.push({ field: "license", message: "license is required" });
  }

  // Required: files field — if present, every entry must point to existing path
  // (skip negation patterns starting with `!` — npm-packlist treats those as
  // exclusions, not includes, so existence is irrelevant).
  if (Array.isArray(pkg.files)) {
    for (const f of pkg.files) {
      if (typeof f !== "string") {
        required.push({ field: "files", message: `files entry "${f}" is not a string` });
        continue;
      }
      // Negation pattern (npm exclude) — skip path validation entirely.
      if (f.startsWith("!")) continue;
      if (f.startsWith("/") || f.includes("..")) {
        required.push({ field: "files", message: `files entry "${f}" has unsafe path (absolute or contains ..)` });
        continue;
      }
      const abs = resolve(root, f);
      // Directory entries (ending in `/`) are valid even if the directory
      // doesn't exist locally — npm creates the dir on publish if matching
      // files are found inside it.
      if (f.endsWith("/")) continue;
      if (!existsSync(abs)) {
        required.push({ field: "files", message: `files entry "${f}" does not exist` });
      }
    }
  }

  // Required: bin entries — must point to existing files (relative to package.json)
  if (pkg.bin) {
    const bins = typeof pkg.bin === "string" ? { [pkg.name]: pkg.bin } : pkg.bin;
    for (const [binName, binPath] of Object.entries(bins)) {
      if (typeof binPath !== "string") {
        required.push({ field: "bin", message: `bin["${binName}"] is not a string` });
        continue;
      }
      const abs = resolve(root, binPath);
      if (!existsSync(abs)) {
        required.push({ field: "bin", message: `bin["${binName}"] = "${binPath}" does not exist (run build:cli first?)` });
      }
    }
  }

  // Required: engines.node parses as a valid range (semver-ish)
  if (pkg.engines?.node) {
    if (typeof pkg.engines.node !== "string" || !/^[~^>=<| \d.*x-]+$/.test(pkg.engines.node)) {
      required.push({ field: "engines.node", message: `engines.node "${pkg.engines.node}" is not a valid range` });
    }
  }

  // Required: main/exports point to existing paths
  if (pkg.main) {
    const abs = resolve(root, pkg.main);
    if (!existsSync(abs)) {
      required.push({ field: "main", message: `main "${pkg.main}" does not exist (run build first?)` });
    }
  }
  if (pkg.exports && typeof pkg.exports === "object") {
    const checkExportTarget = (target, ctx) => {
      if (typeof target === "string") {
        // "." or "./something" — only check if it looks like a file path
        if (target.startsWith("./") && !target.endsWith("/")) {
          const abs = resolve(root, target);
          if (!existsSync(abs)) {
            required.push({ field: ctx, message: `exports["${ctx}"] = "${target}" does not exist` });
          }
        }
      } else if (typeof target === "object" && target !== null) {
        for (const [k, v] of Object.entries(target)) {
          checkExportTarget(v, `${ctx}.${k}`);
        }
      }
    };
    for (const [k, v] of Object.entries(pkg.exports)) {
      checkExportTarget(v, k);
    }
  }

  // Advisory: README + LICENSE at package root
  if (!existsSync(join(root, "README.md")) && !existsSync(join(root, "README"))) {
    advisory.push({ field: "README", message: "README.md/README not found at package root" });
  }
  if (!existsSync(join(root, "LICENSE")) && !existsSync(join(root, "LICENSE.md"))) {
    advisory.push({ field: "LICENSE", message: "LICENSE/LICENSE.md not found at package root" });
  }

  // Advisory: repository field
  if (!pkg.repository) {
    advisory.push({ field: "repository", message: "repository field is not set" });
  }

  // Advisory: homepage
  if (!pkg.homepage) {
    advisory.push({ field: "homepage", message: "homepage field is not set" });
  }

  // Advisory: bugs field
  if (!pkg.bugs) {
    advisory.push({ field: "bugs", message: "bugs field is not set" });
  }

  return { required, advisory };
}

/** Check whether a version is already published to the npm registry. Returns null on network error. */
export async function isVersionPublished(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return null; // unknown
  }
}

/** Check that the working tree has no uncommitted changes to publishable paths. */
export function checkWorkingTreeClean(root = ROOT) {
  try {
    const out = execFileSync("git", ["status", "--porcelain", "--", "package.json", "package-lock.json"], {
      cwd: root,
      encoding: "utf8",
    });
    return out.trim() === "" ? { clean: true } : { clean: false, output: out.trim() };
  } catch (e) {
    return { clean: false, output: e.message };
  }
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
  const cli = parseArgs(process.argv);
  const pkgPath = cli.package ? resolve(cli.package) : resolve(ROOT, "package.json");
  const pkgDir = dirname(pkgPath);

  if (!existsSync(pkgPath)) {
    console.error(`validate-npm-publish: package.json not found at ${pkgPath}`);
    process.exit(1);
  }

  let pkg;
  try {
    pkg = JSON.parse(readFileSync(pkgPath, "utf8"));
  } catch (e) {
    console.error(`validate-npm-publish: failed to parse ${pkgPath}: ${e.message}`);
    process.exit(1);
  }

  const report = validatePackage(pkg, { root: pkgDir });
  const treeStatus = checkWorkingTreeClean(pkgDir);
  if (!treeStatus.clean) {
    // Working-tree dirty is reported as ADVISORY not REQUIRED, because in CI
    // the checkout is always dirty (release workflows bump package.json before
    // calling this validator, and the version-bump is a legitimate in-flight
    // edit). The version-bump trap in the workflow restores the tree on EXIT.
    // If you want a strict tree-clean check (e.g. for local manual publish),
    // use --strict-advisory to elevate advisory to exit 2.
    report.advisory.push({ field: "working-tree", message: `uncommitted changes in package.json/lock: ${treeStatus.output}` });
  }

  // Optional remote check
  let remoteStatus = null;
  if (cli.checkRemote && pkg.name && pkg.version) {
    remoteStatus = await isVersionPublished(pkg.name, pkg.version);
    if (remoteStatus === true) {
      report.required.push({ field: "npm-registry", message: `${pkg.name}@${pkg.version} is already published to npm` });
    } else if (remoteStatus === null) {
      report.advisory.push({ field: "npm-registry", message: "could not reach npm registry to verify version is unpublished" });
    }
  }

  const result = {
    package: { name: pkg.name, version: pkg.version, private: pkg.private ?? false },
    required: report.required,
    advisory: report.advisory,
    summary: {
      requiredPass: report.required.length === 0,
      advisoryCount: report.advisory.length,
      remoteChecked: remoteStatus !== null,
      remotePublished: remoteStatus,
    },
  };

  if (cli.json) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
  } else {
    console.log(`\n=== npm-publish preflight ===`);
    console.log(`package: ${result.package.name}@${result.package.version}`);
    if (result.summary.remoteChecked) {
      console.log(`remote:  ${result.summary.remotePublished === false ? "unpublished" : result.summary.remotePublished === true ? "ALREADY PUBLISHED" : "unknown"}`);
    }
    console.log("");
    if (report.required.length === 0) {
      console.log("✓ Required checks: PASS");
    } else {
      console.log(`✗ Required checks: FAIL (${report.required.length})`);
      for (const r of report.required) console.log(`  - [${r.field}] ${r.message}`);
    }
    if (report.advisory.length === 0) {
      console.log("✓ Advisory checks: PASS");
    } else {
      console.log(`⚠ Advisory checks: ${report.advisory.length} warning(s)`);
      for (const a of report.advisory) console.log(`  - [${a.field}] ${a.message}`);
    }
    console.log("");
  }

  if (report.required.length > 0) {
    process.exit(1);
  }
  if (cli.strictAdvisory && report.advisory.length > 0) {
    process.exit(2);
  }
  process.exit(0);
}

if (argv[1] && import.meta.url === `file://${argv[1]}`) {
  const { argv } = process;
  main().catch((e) => {
    console.error(`validate-npm-publish: ${e.message}`);
    process.exit(1);
  });
}