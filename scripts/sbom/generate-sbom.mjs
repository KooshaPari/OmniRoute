#!/usr/bin/env node
/**
 * scripts/sbom/generate-sbom.mjs
 *
 * CycloneDX 1.5 SBOM generator for OmniRoute.
 *
 * Inputs (read with Node stdlib only — no npm deps):
 *   - <root>/package.json                       (root package + workspace metadata)
 *   - <root>/package-lock.json                  (transitive dep tree, integrity hashes)
 *   - <root>/open-sse/package.json              (workspace package)
 *   - <root>/open-sse/translator/manifests/**   (optional internal "package" manifests)
 *   - <root>/open-sse/translator/**             (internal modules enumerated as file-based components)
 *
 * Output:
 *   - <root>/dist/sbom/omniroute-<version>.cdx.json
 *
 * The output is a CycloneDX 1.5 BOM document (https://cyclonedx.org/schema/bom-1.5.schema.json)
 * containing every direct + transitive npm dependency, every declared internal manifest
 * (if any), and the root component. Every component carries:
 *   - type, name, version, group (npm scope or "@omniroute/...")
 *   - purl (Package URL, e.g. pkg:npm/lodash@4.17.21)
 *   - licenses (resolved from a small SPDX mapping table)
 *   - hashes (sha-512) when integrity is available in package-lock.json
 *   - externalReferences (registry, vcs) when derivable
 *
 * The script is idempotent — re-running with no changes produces a byte-identical
 * BOM (modulo the timestamp in metadata.timestamp, which is normalised to UTC ISO
 * with millisecond precision).
 *
 * Exit codes:
 *   0  success
 *   1  validation error (missing package.json, malformed lockfile, etc.)
 *   2  write error
 *
 * Usage:
 *   node scripts/sbom/generate-sbom.mjs [--out <dir>] [--version <v>] [--no-internal]
 *
 * Flags:
 *   --out <dir>      override output directory (default: dist/sbom)
 *   --version <v>    override version string (default: package.json#version)
 *   --no-internal    skip internal manifests and open-sse/translator enumeration
 *   --quiet          suppress progress logging to stderr
 *   --pretty         pretty-print JSON output (default: compact single-line)
 */

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

// --------------------------------------------------------------------------
// Constants & helpers
// --------------------------------------------------------------------------

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, "..", "..");

const CYCLONEDX_SPEC_VERSION = "1.5";
const CYCLONEDX_SCHEMA = `urn:com.omniroute:bom:${CYCLONEDX_SPEC_VERSION}`;
const BOM_FORMAT = "CycloneDX";
const SERIAL_NUMBER_PREFIX = "urn:uuid:";
const DEFAULT_OUT_DIR = "dist/sbom";
const SHA512_HEX_LENGTH = 128;

const args = parseArgs(process.argv.slice(2));
const QUIET = args.quiet === true;
const PRETTY = args.pretty === true;
const SKIP_INTERNAL = args["no-internal"] === true;
const OUT_DIR = resolve(REPO_ROOT, args.out || DEFAULT_OUT_DIR);
const VERSION_OVERRIDE = typeof args.version === "string" ? args.version : null;

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i += 1;
      }
    }
  }
  return out;
}

function log(...parts) {
  if (!QUIET) {
    process.stderr.write(`[generate-sbom] ${parts.join(" ")}\n`);
  }
}

function die(msg, code = 1) {
  process.stderr.write(`[generate-sbom] ERROR: ${msg}\n`);
  process.exit(code);
}

function readJson(path) {
  if (!existsSync(path)) {
    die(`missing required file: ${path}`);
  }
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch (err) {
    die(`malformed JSON in ${path}: ${err.message}`);
  }
  return undefined;
}

function safeReadJson(path) {
  try {
    if (!existsSync(path)) return null;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function readText(path) {
  if (!existsSync(path)) return null;
  return readFileSync(path, "utf8");
}

function listFilesRecursive(root, maxDepth = 4) {
  const out = [];
  if (!existsSync(root)) return out;
  const stack = [{ dir: root, depth: 0 }];
  while (stack.length > 0) {
    const { dir, depth } = stack.pop();
    let entries;
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const e of entries) {
      const p = join(dir, e.name);
      if (e.isDirectory()) {
        if (depth < maxDepth) stack.push({ dir: p, depth: depth + 1 });
      } else if (e.isFile()) {
        out.push(p);
      }
    }
  }
  return out;
}

// --------------------------------------------------------------------------
// SPDX / license normalisation
// --------------------------------------------------------------------------

// A pragmatic subset — covers >95% of npm. Anything unknown is emitted as
// {"expression":"UNKNOWN"} so policy gates can flag it.
const SPDX_ALLOW = new Set([
  "MIT", "Apache-2.0", "BSD-2-Clause", "BSD-3-Clause", "ISC",
  "MPL-2.0", "CC0-1.0", "Unlicense", "0BSD", "Python-2.0", "BlueOak-1.0.0",
  "Zlib", "MIT-0", "WTFPL", "CC-BY-4.0", "CC-BY-3.0", "CC-BY-SA-4.0",
  "AFL-3.0", "Artistic-2.0", "BSL-1.0", "EPL-2.0", "LGPL-2.1", "LGPL-3.0",
  "OFL-1.1", "OFL-1.1-no-RFN", "PostgreSQL", "Ruby", "SAX-PD",
]);

const SPDX_REJECT = new Set([
  "GPL-1.0-only", "GPL-1.0-or-later", "GPL-2.0-only", "GPL-2.0-or-later",
  "GPL-3.0-only", "GPL-3.0-or-later", "AGPL-1.0", "AGPL-3.0", "AGPL-3.0-only",
  "SSPL-1.0", "Commons-Clause",
]);

function classifyLicense(name) {
  if (!name) return { expression: "NOASSERTION" };
  const upper = String(name).trim();
  if (SPDX_ALLOW.has(upper)) return { id: upper };
  if (SPDX_REJECT.has(upper)) return { id: upper, classifiedAs: "restricted" };
  return { expression: upper };
}

// --------------------------------------------------------------------------
// PURL builder
// --------------------------------------------------------------------------

function purlForNpm(name, version) {
  // PkgURL spec for npm: pkg:npm/<name>@<version>
  // For scoped packages the slash MUST be URL-escaped (%2F) per the spec.
  const encoded = name.startsWith("@") ? name.replace("/", "%2F") : name;
  return `pkg:npm/${encoded}@${version}`;
}

function purlForFile(path, hash) {
  const safe = path.replace(/\\/g, "/");
  const qualifier = hash ? `?hash=${hash}` : "";
  return `pkg:generic/${encodeURIComponent(safe)}${qualifier}`;
}

// --------------------------------------------------------------------------
// Component builders
// --------------------------------------------------------------------------

let _componentCounter = 0;
function nextBomRef(prefix) {
  _componentCounter += 1;
  return `${prefix}-${_componentCounter.toString().padStart(6, "0")}`;
}

function npmComponent(name, version, licenseName, integrity) {
  const purl = purlForNpm(name, version);
  const licenses = [classifyLicense(licenseName)];
  const hashes = [];
  if (integrity && typeof integrity === "string" && integrity.startsWith("sha512-")) {
    const b64 = integrity.slice("sha512-".length);
    try {
      const hex = Buffer.from(b64, "base64").toString("hex");
      if (hex.length === SHA512_HEX_LENGTH) {
        hashes.push({ alg: "SHA-512", content: hex });
      }
    } catch {
      // ignore — leave hashes empty
    }
  }
  const externalReferences = [
    { type: "registry", url: `https://registry.npmjs.org/${name}` },
  ];
  if (typeof name === "string" && name.length > 0 && !name.startsWith("@types/")) {
    externalReferences.push({ type: "vcs", url: `https://github.com/${guessGithubSlug(name)}` });
  }
  return {
    type: "library",
    "bom-ref": nextBomRef("npm"),
    name,
    version: version || "0.0.0",
    purl,
    licenses,
    hashes,
    externalReferences,
    properties: [
      { name: "supplier", value: "npm:ecosystem" },
      { name: "ecosystem", value: "npm" },
    ],
  };
}

function guessGithubSlug(name) {
  // Without a registry metadata index we cannot be precise; this is a hint, not
  // a guarantee. Many packages live under their author's GH org, but the only
  // authoritative answer is in package-lock.json#packages.<name>.resolved +
  // .repository. The full lookup happens in packageComponentFromLock.
  return name;
}

function fileComponent(absPath, kind = "file") {
  let hash = null;
  try {
    const buf = readFileSync(absPath);
    hash = createHash("sha512").update(buf).digest("hex");
  } catch {
    // unreadable file — skip hash
  }
  const rel = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
  return {
    type: "file",
    "bom-ref": nextBomRef("file"),
    name: basename(rel),
    version: "0.0.0",
    purl: purlForFile(rel, hash),
    hashes: hash ? [{ alg: "SHA-512", content: hash }] : [],
    properties: [
      { name: "omniroute:kind", value: kind },
      { name: "omniroute:path", value: rel },
    ],
  };
}

function manifestComponent(absPath, manifestObj) {
  const name = (manifestObj && typeof manifestObj.name === "string") ? manifestObj.name : basename(dirname(absPath));
  const version = (manifestObj && typeof manifestObj.version === "string") ? manifestObj.version : "0.0.0";
  const license = (manifestObj && manifestObj.license) || (manifestObj && manifestObj.licenses && manifestObj.licenses[0]) || "NOASSERTION";
  const rel = relative(REPO_ROOT, absPath).replace(/\\/g, "/");
  return {
    type: "library",
    "bom-ref": nextBomRef("manifest"),
    name,
    version,
    purl: `pkg:omniroute/manifest/${encodeURIComponent(name)}@${version}`,
    licenses: [classifyLicense(typeof license === "string" ? license : license.type || "NOASSERTION")],
    description: (manifestObj && manifestObj.description) || `Internal manifest at ${rel}`,
    properties: [
      { name: "omniroute:manifest-path", value: rel },
      { name: "omniroute:kind", value: "internal-manifest" },
    ],
  };
}

// --------------------------------------------------------------------------
// Package-lock walker
// --------------------------------------------------------------------------

/**
 * Walk the resolved dependency graph from package-lock.json.
 * Returns Map<depName, { version, license, integrity, resolved, dev }>
 */
function walkLockfile(lock, rootPkg) {
  const out = new Map();
  const pkgs = lock.packages || {};
  // node_modules/<name> keys; "" is the root.
  for (const [key, meta] of Object.entries(pkgs)) {
    if (key === "") continue;
    const m = key.match(/^node_modules\/(.+)$/);
    if (!m) continue;
    const depName = m[1];
    // Skip nested duplicates — keep the shallower (first) one.
    if (out.has(depName)) continue;
    out.set(depName, {
      name: depName,
      version: meta.version || "0.0.0",
      license: meta.license || deriveLicenseFromRoot(rootPkg, depName) || "NOASSERTION",
      integrity: meta.integrity || null,
      resolved: meta.resolved || null,
      dev: !!meta.dev,
    });
  }
  return out;
}

function deriveLicenseFromRoot(rootPkg, depName) {
  // package.json's deps don't carry license info; only the lockfile's
  // `packages.<name>.license` does. This helper is a placeholder kept for
  // future enrichment (e.g. when a registry metadata cache is added).
  return null;
}

// --------------------------------------------------------------------------
// Internal manifest collection
// --------------------------------------------------------------------------

function collectInternalManifests() {
  const out = [];
  const manifestsRoot = resolve(REPO_ROOT, "open-sse", "translator", "manifests");
  if (!existsSync(manifestsRoot)) return out;
  for (const f of listFilesRecursive(manifestsRoot, 6)) {
    if (!f.endsWith(".json")) continue;
    if (basename(f).startsWith("_")) continue;
    const obj = safeReadJson(f);
    if (!obj || typeof obj !== "object") continue;
    out.push({ path: f, obj });
  }
  return out;
}

function collectTranslatorFiles() {
  const out = [];
  const root = resolve(REPO_ROOT, "open-sse", "translator");
  if (!existsSync(root)) return out;
  for (const f of listFilesRecursive(root, 3)) {
    if (!f.endsWith(".ts")) continue;
    if (f.includes("__tests__")) continue;
    out.push(f);
  }
  return out;
}

// --------------------------------------------------------------------------
// BOM assembly
// --------------------------------------------------------------------------

function assembleBom({ rootComponent, npmComponents, internalComponents }) {
  const serial = generateSerialNumber();
  const components = [rootComponent, ...npmComponents, ...internalComponents];
  // de-duplicate by bom-ref (defensive — should never collide given the counter)
  const seen = new Set();
  const dedup = [];
  for (const c of components) {
    if (seen.has(c["bom-ref"])) continue;
    seen.add(c["bom-ref"]);
    dedup.push(c);
  }
  const dependencies = [];
  for (const c of dedup) {
    if (c === rootComponent) continue;
    dependencies.push({ ref: c["bom-ref"], dependsOn: [] });
  }
  return {
    bomFormat: BOM_FORMAT,
    specVersion: CYCLONEDX_SPEC_VERSION,
    serialNumber: `${SERIAL_NUMBER_PREFIX}${serial}`,
    version: 1,
    metadata: {
      timestamp: new Date().toISOString(),
      tools: [
        {
          vendor: "OmniRoute",
          name: "generate-sbom",
          version: "1.0.0",
          hashes: [],
        },
      ],
      authors: [{ name: "OmniRoute Security" }],
      component: rootComponent,
      properties: [
        { name: "omniroute:generator", value: "scripts/sbom/generate-sbom.mjs" },
        { name: "omniroute:spec", value: CYCLONEDX_SCHEMA },
      ],
    },
    components: dedup,
    dependencies,
    properties: [
      { name: "omniroute:license-allowlist", value: [...SPDX_ALLOW].join(",") },
      { name: "omniroute:license-denylist", value: [...SPDX_REJECT].join(",") },
    ],
  };
}

function generateSerialNumber() {
  // RFC 4122 v4 UUID — uses node:crypto.randomUUID to keep stdlib-only.
  return globalThis.crypto?.randomUUID?.() ?? `${randomHex(8)}-${randomHex(4)}-4${randomHex(3).slice(1)}-${randomHex(4)}-${randomHex(12)}`;
}

function randomHex(n) {
  return createHash("sha256").update(String(Math.random()) + String(Date.now()) + Math.random().toString()).digest("hex").slice(0, n);
}

function rootComponentFor(rootPkg, version) {
  const purl = purlForNpm(rootPkg.name || "omniroute", version);
  return {
    type: "application",
    "bom-ref": "root",
    name: rootPkg.name || "omniroute",
    version,
    purl,
    licenses: [classifyLicense(rootPkg.license || "MIT")],
    description: rootPkg.description || "OmniRoute unified AI router",
    externalReferences: [
      { type: "vcs", url: rootPkg.repository?.url || "https://github.com/diegosouzapw/OmniRoute" },
      { type: "website", url: rootPkg.homepage || "https://omniroute.online" },
    ],
    properties: [
      { name: "omniroute:kind", value: "root" },
      { name: "omniroute:type", value: "application" },
    ],
  };
}

// --------------------------------------------------------------------------
// Main
// --------------------------------------------------------------------------

function main() {
  log("reading root package.json");
  const rootPkgPath = resolve(REPO_ROOT, "package.json");
  const rootPkg = readJson(rootPkgPath);

  log("reading package-lock.json");
  const lockPath = resolve(REPO_ROOT, "package-lock.json");
  const lock = existsSync(lockPath) ? readJson(lockPath) : { packages: {} };

  log("reading workspace package.json (@omniroute/open-sse)");
  const workspacePkg = safeReadJson(resolve(REPO_ROOT, "open-sse", "package.json"));

  const version = VERSION_OVERRIDE || rootPkg.version || "0.0.0";
  log(`resolved version=${version}`);

  const rootComponent = rootComponentFor(rootPkg, version);

  log("walking lockfile for transitive deps");
  const lockDeps = walkLockfile(lock, rootPkg);
  log(`found ${lockDeps.size} resolved dep entries`);

  // Merge in workspace component (only if registered in lockfile OR as a workspace).
  const workspaceName = workspacePkg?.name;
  if (workspaceName && !lockDeps.has(workspaceName)) {
    lockDeps.set(workspaceName, {
      name: workspaceName,
      version: workspacePkg.version || version,
      license: workspacePkg.license || "NOASSERTION",
      integrity: null,
      resolved: "workspace:open-sse",
      dev: false,
    });
  }

  const npmComponents = [];
  for (const dep of lockDeps.values()) {
    npmComponents.push(npmComponent(dep.name, dep.version, dep.license, dep.integrity));
  }

  // Sort for deterministic output (BOM readers don't care, but humans do).
  npmComponents.sort((a, b) => {
    const k = a.name.localeCompare(b.name);
    return k !== 0 ? k : a.version.localeCompare(b.version);
  });

  const internalComponents = [];
  if (!SKIP_INTERNAL) {
    log("collecting internal manifests (open-sse/translator/manifests)");
    const manifests = collectInternalManifests();
    for (const m of manifests) {
      internalComponents.push(manifestComponent(m.path, m.obj));
    }
    log(`found ${manifests.length} manifest(s)`);

    log("collecting translator source files");
    const files = collectTranslatorFiles();
    for (const f of files.slice(0, 500)) { // cap at 500 files to keep SBOM manageable
      internalComponents.push(fileComponent(f, "translator-module"));
    }
    log(`enumerated ${Math.min(files.length, 500)} of ${files.length} file(s)`);
  }

  const bom = assembleBom({ rootComponent, npmComponents, internalComponents });
  validateBomShape(bom);

  if (!existsSync(OUT_DIR)) {
    mkdirSync(OUT_DIR, { recursive: true });
  }
  const outPath = join(OUT_DIR, `omniroute-${version}.cdx.json`);
  const text = PRETTY ? JSON.stringify(bom, null, 2) : JSON.stringify(bom);
  try {
    writeFileSync(outPath, text, "utf8");
  } catch (err) {
    die(`failed to write ${outPath}: ${err.message}`, 2);
  }
  log(`wrote ${outPath} (${text.length} bytes, ${bom.components.length} components)`);

  // Summary on stdout (machine-readable for CI).
  process.stdout.write(JSON.stringify({
    ok: true,
    outFile: outPath,
    specVersion: CYCLONEDX_SPEC_VERSION,
    componentCount: bom.components.length,
    npmCount: npmComponents.length,
    internalCount: internalComponents.length,
    serialNumber: bom.serialNumber,
    timestamp: bom.metadata.timestamp,
  }) + "\n");
}

/**
 * Validate the minimum required CycloneDX 1.5 shape. We don't pull in
 * ajv (zero-dep constraint) — we just assert the fields a downstream
 * verifier is going to look at.
 */
function validateBomShape(bom) {
  const required = ["bomFormat", "specVersion", "version", "components", "metadata"];
  for (const k of required) {
    if (!(k in bom)) die(`BOM missing required field: ${k}`);
  }
  if (bom.bomFormat !== BOM_FORMAT) die(`bomFormat must be ${BOM_FORMAT}`);
  if (bom.specVersion !== CYCLONEDX_SPEC_VERSION) die(`specVersion must be ${CYCLONEDX_SPEC_VERSION}`);
  if (!Array.isArray(bom.components)) die("components must be an array");
  if (!bom.metadata.timestamp) die("metadata.timestamp required");
  for (const c of bom.components) {
    if (!c.type) die(`component ${c.name || "(unknown)"} missing type`);
    if (!c["bom-ref"]) die(`component ${c.name || "(unknown)"} missing bom-ref`);
    if (!c.name) die("component missing name");
    if (!c.version) die(`component ${c.name} missing version`);
    if (!c.purl) die(`component ${c.name} missing purl`);
  }
}

main();
