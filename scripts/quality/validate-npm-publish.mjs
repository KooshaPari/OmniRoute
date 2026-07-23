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
//   - Burning CI minutes on oversized tarballs (npm hard limit is 100 MB
//     unpacked, 1 MB tarball for non-provenance scoped packages)
//
// Modes:
//   --check-remote        additionally verifies the version hasn't been published
//   --strict-advisory     promotes ADVISORY failures to REQUIRED (for final gates)
//   --max-tarball-mb N    override the tarball limit (default 1.0 MB)
//   --max-unpacked-mb N   override the unpacked limit (default 100 MB)
//
// Exit codes:
//   0   all REQUIRED checks pass (advisories may fail unless --strict-advisory)
//   1   one or more REQUIRED checks failed
//   2   unexpected runtime error (uncaught exception)
//
// Usage:
//   node scripts/quality/validate-npm-publish.mjs [--json] [--check-remote]
//     [--strict-advisory] [--max-tarball-mb N] [--max-unpacked-mb N] [--package=PATH]

import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, "..", "..");

// ─── CLI ────────────────────────────────────────────────────────────────────

function parseArgs(argv) {
  const out = {
    json: false,
    checkRemote: false,
    strictAdvisory: false,
    package: null,
    maxTarballMb: 1.0,
    maxUnpackedMb: 100.0,
  };
  for (const arg of argv.slice(2)) {
    if (arg === "--json") out.json = true;
    else if (arg === "--check-remote") out.checkRemote = true;
    else if (arg === "--strict-advisory") out.strictAdvisory = true;
    else if (arg.startsWith("--package=")) out.package = arg.slice("--package=".length);
    else if (arg.startsWith("--max-tarball-mb=")) out.maxTarballMb = parseFloat(arg.slice("--max-tarball-mb=".length));
    else if (arg.startsWith("--max-unpacked-mb=")) out.maxUnpackedMb = parseFloat(arg.slice("--max-unpacked-mb=".length));
    else if (arg === "--help" || arg === "-h") {
      console.log("Usage: validate-npm-publish.mjs [--json] [--check-remote] [--strict-advisory]");
      console.log("                              [--max-tarball-mb N] [--max-unpacked-mb N] [--package=PATH]");
      process.exit(0);
    }
  }
  return out;
}

// ─── Pure helpers (exported for tests) ──────────────────────────────────────

/**
 * Parse a semver string, returning the major.minor.patch core plus any prerelease tag.
 */
export function parseSemver(v) {
  if (typeof v !== "string") return null;
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

/**
 * Validate that a package is publish-ready. Returns { required: [...], advisory: [...] }.
 */
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
    const scopeOk = /^@[a-z0-9][a-z0-9-_.]*\/[a-z0-9][a-z0-9-_.]*$/.test(pkg.name);
    const unscopedOk = /^[a-z0-9][a-z0-9-_.]*$/.test(pkg.name);
    if (!scopeOk && !unscopedOk) {
      required.push({ field: "name", message: `name "${pkg.name}" contains invalid characters` });
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

  // Required: license
  if (!pkg.license && !pkg.licenses) {
    required.push({ field: "license", message: "license is required" });
  }

  // Required: files field — every entry must point to existing path
  if (Array.isArray(pkg.files)) {
    for (const f of pkg.files) {
      if (typeof f !== "string") {
        required.push({ field: "files", message: `files entry "${f}" is not a string` });
        continue;
      }
      if (f.startsWith("!")) continue; // negation pattern
      if (f.startsWith("/") || f.includes("..")) {
        required.push({ field: "files", message: `files entry "${f}" has unsafe path` });
        continue;
      }
      if (f.endsWith("/")) continue; // directory entries are valid
      const abs = resolve(root, f);
      if (!existsSync(abs)) {
        required.push({ field: "files", message: `files entry "${f}" does not exist` });
      }
    }
  }

  // Required: bin entries — must point to existing files
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

  // Required: engines.node parses as a valid range
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

  // Advisory: README + LICENSE
  if (!existsSync(join(root, "README.md")) && !existsSync(join(root, "README"))) {
    advisory.push({ field: "README", message: "README.md/README not found at package root" });
  }
  if (!existsSync(join(root, "LICENSE")) && !existsSync(join(root, "LICENSE.md"))) {
    advisory.push({ field: "LICENSE", message: "LICENSE/LICENSE.md not found at package root" });
  }
  if (!pkg.repository) advisory.push({ field: "repository", message: "repository field is not set" });
  if (!pkg.homepage) advisory.push({ field: "homepage", message: "homepage field is not set" });
  if (!pkg.bugs) advisory.push({ field: "bugs", message: "bugs field is not set" });

  return { required, advisory };
}

/**
 * Check whether a version is already published to the npm registry.
 * Returns null on network error.
 */
export async function isVersionPublished(name, version) {
  const url = `https://registry.npmjs.org/${encodeURIComponent(name)}/${version}`;
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.status === 200;
  } catch {
    return null;
  }
}

/**
 * Check that the working tree has no uncommitted changes to publishable paths.
 */
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

/**
 * Run `npm pack --dry-run` and return the declared tarball + unpacked sizes.
 * npm's publish hard limit is 100 MB unpacked and ~1 MB tarball for non-provenance
 * scoped packages, 4 MB tarball for provenance.
 *
 * @param {object} opts
 * @param {number} [opts.limitTarballMb=1.0] tarball size cap in MB
 * @param {number} [opts.limitUnpackedMb=100.0] unpacked size cap in MB
 * @param {string} [opts.cwd=process.cwd()]
 * @returns {Promise<{ok: boolean, tarballMb: number, unpackedMb: number, fileCount: number, errors: string[], warnings: string[]}>}
 */
export async function checkTarballSize({ limitTarballMb = 1.0, limitUnpackedMb = 100.0, cwd = process.cwd() } = {}) {
  const result = { ok: true, tarballMb: 0, unpackedMb: 0, fileCount: 0, errors: [], warnings: [] };
  try {
    const out = spawnSync("npm", ["pack", "--dry-run", "--json"], { cwd, encoding: "utf8" });
    if (out.status !== 0) {
      result.ok = false;
      result.errors.push(`npm pack --dry-run exited ${out.status}: ${(out.stderr || "").trim().slice(0, 300)}`);
      return result;
    }
    const json = JSON.parse(out.stdout || "[]");
    if (!Array.isArray(json) || json.length === 0) {
      result.warnings.push("npm pack --dry-run produced no entries");
      return result;
    }
    const entry = json[0];
    result.fileCount = (entry.entryCount != null) ? entry.entryCount : (Array.isArray(entry.files) ? entry.files.length : 0);
    result.tarballMb  = Number(entry.tarballSize  || 0) / (1024 * 1024);
    result.unpackedMb = Number(entry.unpackedSize || 0) / (1024 * 1024);
    if (result.tarballMb > limitTarballMb) {
      result.ok = false;
      result.errors.push(`Tarball size ${result.tarballMb.toFixed(2)} MB exceeds limit ${limitTarballMb} MB (npm non-provenance cap). Tighten the "files" array in package.json or enable provenance (--provenance).`);
    } else if (result.tarballMb > limitTarballMb * 0.8) {
      result.warnings.push(`Tarball size ${result.tarballMb.toFixed(2)} MB is approaching limit ${limitTarballMb} MB.`);
    }
    if (result.unpackedMb > limitUnpackedMb) {
      result.ok = false;
      result.errors.push(`Unpacked size ${result.unpackedMb.toFixed(2)} MB exceeds npm hard limit ${limitUnpackedMb} MB.`);
    }
  } catch (e) {
    result.ok = false;
    result.errors.push(`checkTarballSize threw: ${e.message}`);
  }
  return result;
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

  // Tarball-size check (catches E413 Payload Too Large BEFORE publish).
  // Per npm publish-policies: max tarball is 1 MB for non-provenance packages
  // and 100 MB for provenance-enabled. We default to the stricter limit and
  // allow override via --max-tarball-mb / --max-unpacked-mb.
  const packResult = await checkTarballSize({
    limitTarballMb: cli.maxTarballMb,
    limitUnpackedMb: cli.maxUnpackedMb,
    cwd: pkgDir,
  });
  if (!packResult.ok) {
    for (const err of packResult.errors) {
      report.required.push({ field: "tarball-size", message: err });
    }
  }
  for (const warn of packResult.warnings) {
    report.advisory.push({ field: "tarball-size", message: warn });
  }

  if (!treeStatus.clean) {
    // Working-tree dirty is reported as ADVISORY not REQUIRED, because in CI
    // the checkout is always dirty (release workflows bump package.json before
    // calling this validator, and the version-bump is a legitimate in-flight
    // edit). The version-bump trap in the workflow restores the tree on EXIT.
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
    tarball: {
      sizeMb: packResult.tarballMb,
      unpackedMb: packResult.unpackedMb,
      fileCount: packResult.fileCount,
    },
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
    console.log(`tarball: ${result.tarball.sizeMb.toFixed(2)} MB (${result.tarball.fileCount} files, ${result.tarball.unpackedMb.toFixed(1)} MB unpacked)`);
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

const isCli = import.meta.url === `file://${process.argv[1]}` || process.argv[1]?.endsWith("validate-npm-publish.mjs");
if (isCli) {
  main().catch((e) => {
    console.error(`validate-npm-publish: ${e.message}`);
    process.exit(2);
  });
}
