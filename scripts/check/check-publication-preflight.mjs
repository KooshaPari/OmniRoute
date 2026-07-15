#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { basename, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(fileURLToPath(new URL("../..", import.meta.url)));
const manifest = JSON.parse(readFileSync(resolve(root, "package.json"), "utf8"));
const workflow = readFileSync(resolve(root, ".github/workflows/npm-publish.yml"), "utf8");
const failures = [];

if (typeof manifest.name !== "string" || !manifest.name.trim()) {
  failures.push("root package.json must declare a non-empty package name");
}
if (typeof manifest.version !== "string" || !/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?$/.test(manifest.version)) {
  failures.push("root package.json must declare a publishable semver version");
}

const requiredBins = ["argismonitor", "omniroute"];
for (const binName of requiredBins) {
  const binPath = manifest.bin?.[binName];
  if (typeof binPath !== "string" || !binPath) {
    failures.push(`root package.json must expose the ${binName} bin`);
  }
}

if (!workflow.includes('PACKAGE_NAME="$(node -p "require(\'./package.json\').name")"')) {
  failures.push("npm publish workflow must derive PACKAGE_NAME from root package.json");
}
if (!workflow.includes('npm view "${PACKAGE_NAME}@${VERSION}" version')) {
  failures.push("npm publish workflow must query the dynamically derived package identity");
}
if (/npm view\s+["']?omniroute@\$\{?VERSION/.test(workflow)) {
  failures.push("npm publish workflow must not hard-code the legacy omniroute registry identity");
}
if (!workflow.includes("npm ci --ignore-scripts --no-audit --no-fund")) {
  failures.push("npm publish workflow dependency install must use frozen npm ci intent");
}

try {
  const npm = process.platform === "win32" ? "npm.cmd" : "npm";
  const output = execFileSync(npm, ["pack", "--dry-run", "--json", "--ignore-scripts"], {
    cwd: root,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
  const start = output.indexOf("[");
  const end = output.lastIndexOf("]");
  const reports = JSON.parse(start >= 0 && end > start ? output.slice(start, end + 1) : output);
  const report = Array.isArray(reports) ? reports[0] : null;
  if (!report) {
    failures.push("npm pack dry-run did not return a package report");
  } else {
    if (report.name !== manifest.name) {
      failures.push(`npm pack name ${report.name ?? "<missing>"} does not match ${manifest.name}`);
    }
    if (report.version !== manifest.version) {
      failures.push(`npm pack version ${report.version ?? "<missing>"} does not match ${manifest.version}`);
    }
    const packedPaths = new Set((report.files ?? []).map((file) => file.path));
    for (const binName of requiredBins) {
      const binPath = manifest.bin?.[binName];
      if (binPath && !packedPaths.has(binPath)) {
        failures.push(`npm pack listing is missing ${binName} bin target ${binPath}`);
      }
    }
    if (report.filename && !basename(report.filename).includes(manifest.version)) {
      failures.push(`npm pack filename ${report.filename} does not include version ${manifest.version}`);
    }
  }
} catch (error) {
  failures.push(`npm pack dry-run failed: ${error instanceof Error ? error.message : String(error)}`);
}

if (failures.length) {
  for (const failure of failures) console.error(`publication preflight failed: ${failure}`);
  process.exit(1);
}

console.log(
  `publication preflight passed for ${manifest.name}@${manifest.version} with bins: ${requiredBins.join(", ")}`,
);
