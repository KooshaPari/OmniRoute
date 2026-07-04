#!/usr/bin/env node
// scripts/check/check-agent-index.mjs
//
// Drift gate for `open-sse/AGENT-INDEX.md`.
//
// Why: `open-sse/AGENT-INDEX.md` is generated from `open-sse/executors/index.ts`
// (see `scripts/build/gen-agent-index.mjs`). If a contributor adds an executor
// file, registers a new alias, or removes an executor, the regenerated index
// will change -- but the committed copy will drift unless the regen runs in
// CI. This gate makes that drift a hard failure.
//
// The gate runs the generator in `--check` mode and surfaces the drift
// findings as a human-readable report. Mirrors the stale-allowlist pattern
// (6A.3) used by `check-provider-consistency.ts`: the gate reports WHICH
// drift findings exist, so the developer knows exactly what to regen or fix.
//
// Usage:
//   node scripts/check/check-agent-index.mjs           # strict (CI gate)
//   node scripts/check/check-agent-index.mjs --report # human report, exit 0
//
// Exit codes:
//   0  AGENT-INDEX.md is in sync with the registry
//   1  one or more drift findings detected; run `npm run gen:agent-index`

import { execFileSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const SCRIPT_DIR = path.dirname(__filename);
const REPO_ROOT = path.resolve(SCRIPT_DIR, "..", "..");
const GEN = path.join(REPO_ROOT, "scripts", "build", "gen-agent-index.mjs");

function parseArgs(argv) {
  const opts = { report: false };
  for (const arg of argv.slice(2)) {
    if (arg === "--report") opts.report = true;
    else if (arg === "--help" || arg === "-h") {
      console.log(
        [
          "Usage: node scripts/check/check-agent-index.mjs [options]",
          "",
          "  --report   Print drift findings and exit 0 regardless",
          "  --help     Show this help",
        ].join("\n"),
      );
      process.exit(0);
    }
  }
  return opts;
}

function runGeneratorCheck() {
  // Run the generator in `--check` mode; capture both stdout (OK message)
  // and stderr (drift findings) so we can attach them to our exit-1 message.
  let stdout = "";
  let stderr = "";
  let exitCode = 0;
  try {
    stdout = execFileSync("node", [GEN, "--check"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
  } catch (err) {
    exitCode = err.status || 1;
    stdout = err.stdout ? String(err.stdout) : "";
    stderr = err.stderr ? String(err.stderr) : "";
  }
  return { stdout, stderr, exitCode };
}

function runGeneratorJson() {
  try {
    const out = execFileSync("node", [GEN, "--json"], {
      cwd: REPO_ROOT,
      stdio: ["ignore", "pipe", "pipe"],
      encoding: "utf8",
    });
    return JSON.parse(out);
  } catch {
    return null;
  }
}

function main() {
  const opts = parseArgs(process.argv);
  const { stdout, stderr, exitCode } = runGeneratorCheck();

  if (exitCode === 0) {
    if (!opts.report) {
      console.log((stdout || "").trim());
    }
    return;
  }

  // Drift detected. In --report mode we still want a useful summary.
  const json = runGeneratorJson();
  const driftList = (json && json.summary && json.summary.drift) || [];
  const isRealDrift = driftList.length > 0;

  const headline = isRealDrift
    ? "[check:agent-index] DRIFT in the registry source."
    : "[check:agent-index] open-sse/AGENT-INDEX.md is OUT OF SYNC with the registry.";

  const actionLine = isRealDrift
    ? "Address the drift findings below (or update KNOWN_HELPER_FILES for legitimate helpers)."
    : "Run `npm run gen:agent-index` and commit the regenerated file.";

  const block = [
    headline,
    "",
    actionLine,
    "",
    ...(driftList.length > 0
      ? ["Drift findings:", ...driftList.map((d) => "  - " + d), ""]
      : []),
    "Note: If a finding is a known helper that you do NOT intend to register",
    "in the executor map, add it to KNOWN_HELPER_FILES in",
    "scripts/build/gen-agent-index.mjs. The stale-allowlist hygiene check",
    "will flag any name you forget to remove once the file is gone or",
    "promoted into the registry.",
  ].join("\n");

  if (opts.report) {
    // --report: emit findings to stdout, exit 0 regardless.
    console.log(block);
    return;
  }

  console.error(block);
  process.exit(1);
}

main();
