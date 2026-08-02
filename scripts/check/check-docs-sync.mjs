#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const DEFAULT_MANIFEST = "config/release/release-contract.json";
const SCOPES = new Set(["release", "mirrors", "all"]);
const SOURCE_KINDS = new Set(["package", "openapi", "changelog"]);
const LOWERCASE_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const SEMVER = /^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/;

function fail(message) {
  throw new Error(message);
}

function parseArgs(argv = process.argv.slice(2)) {
  const options = { scope: "all", manifest: DEFAULT_MANIFEST, product: null, json: false };
  const seen = new Set();

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--help" || argument === "-h") {
      return { ...options, help: true };
    }
    if (argument === "--json") {
      if (seen.has("json")) fail("duplicate option: --json");
      seen.add("json");
      options.json = true;
      continue;
    }

    const match = argument.match(/^--(scope|manifest|product)(?:=(.*))?$/);
    if (!match) fail(`unknown option: ${argument}`);
    const [, key, inlineValue] = match;
    if (seen.has(key)) fail(`duplicate option: --${key}`);
    seen.add(key);
    const value = inlineValue ?? argv[++index];
    if (!value || value.startsWith("--")) fail(`missing value for --${key}`);
    options[key] = value;
  }

  if (!SCOPES.has(options.scope)) {
    fail(
      `invalid --scope value: ${JSON.stringify(options.scope)} (expected release, mirrors, or all)`
    );
  }
  if (options.product !== null && !LOWERCASE_ID.test(options.product)) {
    fail(
      `invalid --product value: ${JSON.stringify(options.product)} (expected lowercase kebab-case)`
    );
  }
  return options;
}

function normalizeRelativePath(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty path`);
  const portable = value.replaceAll("\\", "/");
  if (portable.startsWith("/") || /^[A-Za-z]:\//.test(portable)) {
    fail(`${label} must be repository-relative: ${value}`);
  }
  const segments = portable.split("/");
  if (segments.includes("..") || portable === "." || portable.startsWith("../")) {
    fail(`${label} must not traverse parent directories: ${value}`);
  }
  if (portable.includes("\0")) fail(`${label} contains a NUL byte`);
  return portable;
}

function isInside(root, candidate) {
  const relative = path.relative(root, candidate);
  return (
    relative === "" ||
    (relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative))
  );
}

function resolveDeclaredPath(relativePath, label, { mustExist = false } = {}) {
  const normalized = normalizeRelativePath(relativePath, label);
  const absolute = path.resolve(ROOT, normalized);
  const rootReal = fs.realpathSync(ROOT);
  if (fs.existsSync(absolute)) {
    const resolved = fs.realpathSync(absolute);
    if (!isInside(rootReal, resolved))
      fail(`${label} resolves outside repository: ${relativePath}`);
  } else if (mustExist) {
    fail(`${label} does not exist: ${relativePath}`);
  }
  return absolute;
}

function readText(relativePath, label) {
  const absolute = resolveDeclaredPath(relativePath, label, { mustExist: true });
  if (!fs.statSync(absolute).isFile()) fail(`${label} is not a file: ${relativePath}`);
  return fs.readFileSync(absolute, "utf8");
}

function readJson(relativePath, label) {
  try {
    return JSON.parse(readText(relativePath, label));
  } catch (error) {
    if (error instanceof SyntaxError) fail(`${label} is not valid JSON: ${error.message}`);
    throw error;
  }
}

function assertObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
}

function assertString(value, label) {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
}

function loadManifest(relativePath) {
  const manifest = readJson(relativePath, "release manifest");
  assertObject(manifest, "release manifest");
  if (manifest.schemaVersion !== 1) fail("release manifest schemaVersion must be 1");
  assertObject(manifest.product, "release manifest product");
  assertString(manifest.product.id, "release manifest product.id");
  if (!LOWERCASE_ID.test(manifest.product.id)) {
    fail(`release manifest product.id must be lowercase kebab-case: ${manifest.product.id}`);
  }
  assertString(manifest.product.name, "release manifest product.name");
  assertString(manifest.product.packageName, "release manifest product.packageName");

  if (!Array.isArray(manifest.versionSources) || manifest.versionSources.length === 0) {
    fail("release manifest versionSources must be a non-empty array");
  }
  const sources = new Map();
  for (const [index, source] of manifest.versionSources.entries()) {
    assertObject(source, `release manifest versionSources[${index}]`);
    assertString(source.path, `release manifest versionSources[${index}].path`);
    assertString(source.kind, `release manifest versionSources[${index}].kind`);
    if (!SOURCE_KINDS.has(source.kind)) fail(`unsupported release source kind: ${source.kind}`);
    if (sources.has(source.kind)) fail(`duplicate release source kind: ${source.kind}`);
    resolveDeclaredPath(source.path, `release source ${source.kind}`);
    sources.set(source.kind, source.path);
  }
  for (const kind of SOURCE_KINDS) {
    if (!sources.has(kind)) fail(`release manifest is missing ${kind} version source`);
  }

  assertObject(manifest.i18n, "release manifest i18n");
  for (const field of ["configPath", "messagesPath", "generatedDocsPath"]) {
    assertString(manifest.i18n[field], `release manifest i18n.${field}`);
    normalizeRelativePath(manifest.i18n[field], `release manifest i18n.${field}`);
  }
  if (manifest.i18n.statePath !== undefined) {
    assertString(manifest.i18n.statePath, "release manifest i18n.statePath");
    normalizeRelativePath(manifest.i18n.statePath, "release manifest i18n.statePath");
  }
  const stateMode = manifest.i18n.stateMode ?? "optional-artifact";
  if (!new Set(["optional-artifact", "required"]).has(stateMode)) {
    fail(`unsupported i18n stateMode: ${stateMode}`);
  }
  if (stateMode === "required" && manifest.i18n.statePath === undefined) {
    fail("release manifest i18n.statePath is required when stateMode is required");
  }
  if (manifest.i18n.policy !== "generated-docs-ignored") {
    fail("release manifest i18n.policy must be generated-docs-ignored");
  }
  return { ...manifest, versionSources: sources, stateMode };
}

function extractOpenApiVersion(content) {
  let inInfo = false;
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!inInfo) {
      if (trimmed === "info:") inInfo = true;
      continue;
    }
    if (line.length > 0 && !line.startsWith(" ")) break;
    const match = line.match(/^\s{2}version:\s*["']?([^"'\s]+)["']?\s*$/);
    if (match) return match[1];
  }
  return null;
}

function extractChangelogSections(content) {
  return [...content.matchAll(/^##\s+\[([^\]]+)\](?:\s+[-—–].*)?$/gm)].map((match) => match[1]);
}

function checkRelease(manifest) {
  const packageData = readJson(manifest.versionSources.get("package"), "package version source");
  assertObject(packageData, "package version source");
  if (packageData.name !== manifest.product.packageName) {
    fail(
      `package identity differs from release manifest: ${packageData.name} (expected ${manifest.product.packageName})`
    );
  }
  assertString(packageData.version, "package.json version");
  if (!SEMVER.test(packageData.version))
    fail(`package.json version is not valid semver: ${packageData.version}`);
  const version = packageData.version;

  const openApiVersion = extractOpenApiVersion(
    readText(manifest.versionSources.get("openapi"), "OpenAPI version source")
  );
  if (!openApiVersion) fail("could not extract OpenAPI info.version");
  if (openApiVersion !== version)
    fail(`OpenAPI version (${openApiVersion}) differs from package.json (${version})`);

  const changelogSections = extractChangelogSections(
    readText(manifest.versionSources.get("changelog"), "CHANGELOG version source")
  );
  if (changelogSections[0] !== "Unreleased")
    fail('CHANGELOG.md first section must be "## [Unreleased]"');
  const releases = changelogSections.filter((section) => SEMVER.test(section));
  if (releases.length === 0) fail("CHANGELOG.md has no semver release section");
  if (releases[0] !== version)
    fail(`latest changelog release (${releases[0]}) differs from package.json (${version})`);

  console.log(`[docs-sync] release identity: ${manifest.product.id} ${version}`);
  console.log(
    `[docs-sync] declared sources: package, openapi, changelog (${releases.length} changelog releases)`
  );
  return version;
}

function localeCodes(config) {
  if (!Array.isArray(config.locales) || config.locales.length === 0)
    fail("i18n config locales must be a non-empty array");
  const codes = config.locales.map((entry, index) => {
    const code = typeof entry === "string" ? entry : entry?.code;
    assertString(code, `i18n config locales[${index}].code`);
    if (code.includes("/") || code.includes("\\") || code === "." || code === "..") {
      fail(`i18n locale code is not a safe path segment: ${code}`);
    }
    return code;
  });
  if (new Set(codes).size !== codes.length) fail("i18n config locales contains duplicates");
  return codes;
}

function checkMirrors(manifest) {
  const config = readJson(manifest.i18n.configPath, "i18n config");
  assertObject(config, "i18n config");
  const codes = localeCodes(config);
  const messageRoot = resolveDeclaredPath(manifest.i18n.messagesPath, "i18n messages directory", {
    mustExist: true,
  });
  if (!fs.statSync(messageRoot).isDirectory()) fail("i18n messages path is not a directory");
  for (const code of codes) {
    const localePath = path.join(manifest.i18n.messagesPath, `${code}.json`);
    readJson(localePath, `i18n locale ${code}`);
  }
  if (config.default !== undefined && !codes.includes(config.default)) {
    fail(`i18n default locale is not configured: ${config.default}`);
  }
  if (manifest.i18n.stateMode === "required") {
    readJson(manifest.i18n.statePath, "i18n state");
  } else if (manifest.i18n.statePath) {
    resolveDeclaredPath(manifest.i18n.statePath, "i18n state");
  }
  console.log(
    `[docs-sync] i18n configured locales: ${codes.length}; generated docs ignored per ADR-0005`
  );
  return codes.length;
}

function main(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.help) {
    console.log(
      "Usage: node scripts/check/check-docs-sync.mjs [--scope release|mirrors|all] [--manifest PATH] [--product ID]"
    );
    return { ok: true, help: true };
  }
  const manifest = loadManifest(options.manifest);
  if (options.product !== null && options.product !== manifest.product.id) {
    fail(
      `requested product ${options.product} differs from manifest product ${manifest.product.id}`
    );
  }
  const result = { product: manifest.product.id, scope: options.scope };
  if (options.scope === "release" || options.scope === "all")
    result.version = checkRelease(manifest);
  if (options.scope === "mirrors" || options.scope === "all")
    result.locales = checkMirrors(manifest);
  console.log(`[docs-sync] PASS - ${options.scope} contract is consistent.`);
  return result;
}

export {
  checkMirrors,
  checkRelease,
  extractChangelogSections,
  extractOpenApiVersion,
  loadManifest,
  main,
  parseArgs,
};

try {
  main();
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  console.error(`[docs-sync] FAIL - ${message}`);
  process.exitCode = 1;
}
