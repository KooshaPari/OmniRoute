#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const cwd = process.cwd();
const packageJsonPath = path.resolve(cwd, "package.json");
const openApiPath = path.resolve(cwd, "docs/openapi.yaml");
const changelogPath = path.resolve(cwd, "CHANGELOG.md");

function readText(filePath) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`File not found: ${path.relative(cwd, filePath)}`);
  }
  return fs.readFileSync(filePath, "utf8");
}

function extractOpenApiVersion(content) {
  const lines = content.split(/\r?\n/);
  let inInfoBlock = false;

  for (const line of lines) {
    const trimmed = line.trim();

    if (!inInfoBlock) {
      if (trimmed === "info:") {
        inInfoBlock = true;
      }
      continue;
    }

    if (line.length > 0 && !line.startsWith(" ")) {
      break;
    }

    const match = line.match(/^\s{2}version:\s*["']?([^"'\s]+)["']?\s*$/);
    if (match) {
      return match[1];
    }
  }

  return null;
}

function extractChangelogSections(content) {
  const headings = [...content.matchAll(/^##\s+\[([^\]]+)\](?:\s+[-—–].*)?$/gm)];
  return headings.map((match) => match[1]);
}

function isSemver(value) {
  // Accept X.Y.Z and X.Y.Z-prerelease.N (e.g. 3.0.0-rc.1, 3.0.0-beta.2)
  return /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/.test(value);
}

let hasFailure = false;

function fail(message) {
  hasFailure = true;
  console.error(`[docs-sync] FAIL - ${message}`);
}

try {
  // package.json is optional in this polyglot monorepo (no root package.json).
  // Guard the Tight coupling block; still run OpenAPI/CHANGELOG independence checks.
  const packageJsonExists = fs.existsSync(packageJsonPath);
  const packageVersion = packageJsonExists ? JSON.parse(readText(packageJsonPath)).version : null;

  if (packageVersion) {
    if (!isSemver(packageVersion)) {
      fail(`package.json version is not valid semver: "${packageVersion}"`);
    } else {
      console.log(`[docs-sync] package.json version: ${packageVersion}`);
    }
  } else {
    console.log("[docs-sync] package.json not at repo root — skipping package-version cross-checks");
  }

  // OpenAPI version independence check runs whenever the OpenAPI spec exists
  // (it is our source of truth for the public API surface). We only cross-check
  // against package.json when both exist.
  const openApiVersion = extractOpenApiVersion(readText(openApiPath));
  if (!openApiVersion) {
    fail("could not extract docs/openapi.yaml info.version");
  } else if (packageVersion && openApiVersion !== packageVersion) {
    fail(`OpenAPI version (${openApiVersion}) differs from package.json (${packageVersion})`);
  } else {
    console.log(`[docs-sync] openapi.yaml info.version: ${openApiVersion}`);
  }

  // CHANGELOG.md checks run independently of package.json (polyglot checkout
  // may have docs but not a root package.json).
  if (!fs.existsSync(changelogPath)) {
    fail("CHANGELOG.md is missing");
  }
  const changelogSections = extractChangelogSections(readText(changelogPath));
  if (changelogSections.length === 0) {
    fail("CHANGELOG.md has no version sections");
  } else {
    if (changelogSections[0] !== "Unreleased") {
      fail('CHANGELOG.md first section must be "## [Unreleased]"');
    } else {
      console.log("[docs-sync] changelog has top Unreleased section");
    }

    const semverSections = changelogSections.filter((section) => isSemver(section));
    if (semverSections.length === 0) {
      fail("CHANGELOG.md has no semver release section");
    } else if (packageVersion && semverSections[0] !== packageVersion) {
      fail(
        `Latest changelog release (${semverSections[0]}) differs from package.json (${packageVersion})`
      );
    } else if (!packageVersion) {
      // When package.json is absent we skip the version-equality check but still
      // confirm a semver release exists somewhere in the changelog.
      console.log(`[docs-sync] latest changelog release (no package.json to cross-check): ${semverSections[0]}`);
    } else {
      console.log(
        `[docs-sync] latest changelog release matches package version: ${packageVersion}`
      );
    }
  }

  // ADR 0005 makes docs/i18n generated, gitignored output. Strict sync checks
  // only canonical tracked sources; translation freshness belongs to the
  // generation pipeline and must not depend on local mirror presence.

  // Anti-regression: legacy duplicate docs that have been superseded must not return.
  // Use docs/reference/* as the source of truth.
  const supersededDocs = [{ legacy: "docs/CLI-TOOLS.md", current: "docs/reference/CLI-TOOLS.md" }];
  for (const { legacy, current } of supersededDocs) {
    const legacyAbs = path.resolve(cwd, legacy);
    if (fs.existsSync(legacyAbs)) {
      fail(
        `legacy duplicate ${legacy} reappeared — use ${current} instead (single source of truth)`
      );
    }
  }
} catch (error) {
  fail(error instanceof Error ? error.message : String(error));
}

if (hasFailure) {
  process.exit(1);
}

console.log("[docs-sync] PASS - documentation version sync is consistent.");
