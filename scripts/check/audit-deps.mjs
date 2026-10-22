#!/usr/bin/env node
// scripts/check/audit-deps.mjs
// Dependency advisory gate for the pnpm-only tree (no package-lock.json exists).
//
// Policy:
//   - `critical` advisories are BLOCKING.
//   - `high` advisories are reported as a warning (non-blocking here; the
//     Security Scan workflow owns the blocking high gate).
//   - A registry/transport failure is NOT a policy failure. pnpm's own retry
//     loop (5 attempts, exponential backoff) can spend ~13 minutes before
//     surfacing ERR_SOCKET_TIMEOUT, which turned this gate into a flaky
//     13-minute red on a healthy tree (observed 2026-10-22, PR #758). We bound
//     each attempt, retry a few times, and fail OPEN with an explicit warning
//     annotation when every attempt is a transport error. The authoritative
//     security job still runs, so a real advisory cannot hide behind this.
//
// Usage:
//   node scripts/check/audit-deps.mjs
//   node scripts/check/audit-deps.mjs --json     # machine-readable summary
//
// Exit codes: 0 clean/advisory-only, 1 critical advisory or non-transport error.

import { spawnSync } from "node:child_process";
import { pathToFileURL } from "node:url";

const ATTEMPTS = 3;
const ATTEMPT_TIMEOUT_MS = 90_000;
// Patterns that mean "the registry could not answer", never "the tree is bad".
const TRANSPORT_RE =
  /(ERR_SOCKET_TIMEOUT|ERR_PNPM_META_FETCH_FAIL|ECONNRESET|ECONNREFUSED|ETIMEDOUT|ENOTFOUND|EAI_AGAIN|socket timeout|request to .* failed|getaddrinfo)/i;

export const SEVERITIES = ["critical", "high", "moderate", "low", "info"];

/**
 * Normalise npm/pnpm advisory JSON into per-severity counts.
 * Handles npm v7 (`metadata.vulnerabilities` + `vulnerabilities` map) and
 * pnpm/npm v6 (`metadata.vulnerabilities` + `advisories` map).
 *
 * @param {unknown} report
 * @returns {Record<string, number>}
 */
export function severityCounts(report) {
  const counts = Object.fromEntries(SEVERITIES.map((severity) => [severity, 0]));
  if (!report || typeof report !== "object") return counts;

  const metadataCounts = report.metadata && report.metadata.vulnerabilities;
  if (metadataCounts && typeof metadataCounts === "object") {
    let sawNumber = false;
    for (const severity of SEVERITIES) {
      const value = Number(metadataCounts[severity] ?? 0);
      if (Number.isFinite(value) && value > 0) {
        counts[severity] = value;
        sawNumber = true;
      }
    }
    if (sawNumber) return counts;
  }

  const entries = Object.values(report.advisories || report.vulnerabilities || {});
  for (const entry of entries) {
    const severity = String(entry && entry.severity ? entry.severity : "").toLowerCase();
    if (severity in counts) counts[severity] += 1;
  }
  return counts;
}

/** @param {Record<string, number>} counts */
export function summariseCounts(counts) {
  const parts = SEVERITIES.filter((severity) => counts[severity] > 0).map(
    (severity) => `${counts[severity]} ${severity}`
  );
  return parts.length > 0 ? parts.join(", ") : "none";
}

function sleepSync(ms) {
  // Synchronous sleep without a busy loop; safe on the main thread here because
  // this script does nothing else while waiting for the registry.
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
}

function runAudit() {
  return spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["audit", "--json"], {
    encoding: "utf8",
    timeout: ATTEMPT_TIMEOUT_MS,
    maxBuffer: 32 * 1024 * 1024,
    shell: process.platform === "win32",
  });
}

function main() {
  const jsonOut = process.argv.includes("--json");
  let lastTransport = "";

  for (let attempt = 1; attempt <= ATTEMPTS; attempt += 1) {
    const result = runAudit();
    const stdout = result.stdout || "";
    const stderr = result.stderr || "";

    let report = null;
    try {
      report = JSON.parse(stdout);
    } catch {
      report = null;
    }

    if (report && typeof report === "object") {
      const counts = severityCounts(report);
      if (jsonOut) {
        process.stdout.write(`${JSON.stringify({ counts, attempt })}\n`);
      } else {
        console.log(`[audit:deps] advisories: ${summariseCounts(counts)}`);
      }

      if (counts.critical > 0) {
        console.error(
          `::error::${counts.critical} critical dependency advisory/advisories present — ` +
            "fix or pin before merging (non-blocking severities are advisory only)"
        );
        process.exit(1);
      }
      if (counts.high > 0 && !jsonOut) {
        console.log(
          `::warning::${counts.high} high-severity advisory/advisories present (non-blocking in this gate)`
        );
      }
      process.exit(0);
    }

    const diagnostic = `${stdout}\n${stderr}\n${result.error ? result.error.message : ""}`.trim();
    if (result.error && result.error.code === "ETIMEDOUT") {
      lastTransport = `attempt timed out after ${ATTEMPT_TIMEOUT_MS / 1000}s`;
    } else if (TRANSPORT_RE.test(diagnostic)) {
      lastTransport = diagnostic.split("\n").filter(Boolean).slice(-2).join(" ");
    } else {
      console.error("[audit:deps] FAIL — the audit could not evaluate the dependency tree:");
      console.error(diagnostic || "(no output)");
      process.exit(1);
    }

    if (attempt < ATTEMPTS) {
      const waitMs = attempt * 5_000;
      console.log(
        `[audit:deps] registry audit unavailable (${lastTransport}); ` +
          `retrying ${attempt}/${ATTEMPTS - 1} in ${waitMs / 1000}s`
      );
      sleepSync(waitMs);
    }
  }

  console.log(
    `::warning::dependency audit unavailable after ${ATTEMPTS} attempts ` +
      `(${lastTransport}); skipping this advisory gate for this run. ` +
      "The Security Scan workflow's blocking audit still runs."
  );
  process.exit(0);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) {
  main();
}
