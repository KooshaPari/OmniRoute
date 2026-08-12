#!/usr/bin/env node
// scripts/check/check-codeql-ratchet.mjs
// Ratchet for CodeQL alerts (Task 7.3 — Phase 7).
//
// Uses the GitHub API via `gh` CLI to fetch open, non-dismissed code-scanning
// alerts (respects Hard Rule #14: dismissed alerts don't count).
//
// Output (stdout):
//   codeqlAlerts=N        — count of open, non-dismissed CodeQL alerts
//   codeqlAlerts=SKIP reason=binary-absent   — `gh` not in PATH
//   codeqlAlerts=SKIP reason=no-auth         — `gh` present but unauthenticated
//   codeqlAlerts=SKIP reason=api-error:<code>  — GitHub API error
//
// BLOCKING RATCHET (default): reads metrics.codeqlAlerts.value from
// config/quality/quality-baseline.json and EXITS 1 IF — AND ONLY IF — the count
// MEASURED is GREATER than the baseline (real regression, more CodeQL alerts open).
// Any MEASUREMENT failure (gh absent / no auth / no repo / API error) is a
// graceful SKIP that EXITS 0 — never blocks the build on infrastructure gaps.
// Direction: down (the count can only DROP). Supports --update to ratchet.
//
// Usage:
//   node scripts/check/check-codeql-ratchet.mjs
//   node scripts/check/check-codeql-ratchet.mjs --json    # print alert array
//   node scripts/check/check-codeql-ratchet.mjs --quiet   # suppress diagnostic logs
//   node scripts/check/check-codeql-ratchet.mjs --update  # ratchet the baseline (drop)
//   node scripts/check/check-codeql-ratchet.mjs --advisory  # never fails (collector mode)

import { execFileSync, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const QUIET = process.argv.includes("--quiet");
const PRINT_JSON = process.argv.includes("--json");
const UPDATE = process.argv.includes("--update");
// --advisory: never fails on the count (legacy collector mode). Without this
// flag the gate is BLOCKING: exits 1 on a real regression (measured > baseline).
const ADVISORY = process.argv.includes("--advisory");

const ROOT = process.cwd();
const BASELINE_PATH = path.resolve(
  process.argv.includes("--baseline")
    ? process.argv[process.argv.indexOf("--baseline") + 1]
    : path.join(ROOT, "config/quality/quality-baseline.json")
);

// ---------------------------------------------------------------------------
// Pure parsing function (exported for tests)
// ---------------------------------------------------------------------------

/**
 * Count open, non-dismissed CodeQL alerts from the GitHub API JSON.
 *
 * A GitHub API /code-scanning/alerts returns an array of:
 * {
 *   number: number,
 *   state: "open" | "dismissed" | "fixed",
 *   dismissed_reason: string | null,
 *   dismissed_at: string | null,
 *   tool: { name: string, ... },
 *   rule: { id: string, severity: string, security_severity_level?: string, ... },
 *   ...
 * }
 *
 * Hard Rule #14: alerts with `state="dismissed"` do NOT count, regardless of reason.
 * We filter by state="open" AND tool.name containing "CodeQL" (case-insensitive).
 * Alerts from other tools (e.g. Semgrep) are ignored.
 *
 * @param {Array|null} alerts - Array of alerts from the GitHub API
 * @returns {{ alertCount: number, bySeverity: Record<string, number>, byRule: Record<string, number> }}
 */
export function parseCodeQLAlerts(alerts) {
  if (!Array.isArray(alerts)) {
    return { alertCount: 0, bySeverity: {}, byRule: {} };
  }

  let alertCount = 0;
  const bySeverity = {};
  const byRule = {};

  for (const alert of alerts) {
    // Ignore non-CodeQL alerts (other code-scanning tools)
    const toolName = alert?.tool?.name ?? "";
    if (!toolName.toLowerCase().includes("codeql")) continue;

    // Hard Rule #14: dismissed alerts do not count
    if (alert.state === "dismissed") continue;

    // Only open alerts
    if (alert.state !== "open") continue;

    alertCount++;

    // Coletar por severidade (security_severity_level ou severity da rule)
    const severity = (
      alert?.rule?.security_severity_level ??
      alert?.rule?.severity ??
      "unknown"
    ).toLowerCase();
    bySeverity[severity] = (bySeverity[severity] ?? 0) + 1;

    // Collect by rule ID
    const ruleId = alert?.rule?.id ?? "unknown";
    byRule[ruleId] = (byRule[ruleId] ?? 0) + 1;
  }

  return { alertCount, bySeverity, byRule };
}

/**
 * Evaluate the MEASURED count of CodeQL alerts against the baseline.
 * Direction: down (the count can only DROP — more alerts = regression).
 *
 * Exported for unit testing — mirrors evaluateDeadCode in check-dead-code.mjs.
 *
 * @param {number} current  - Count of alerts measured now.
 * @param {number} baseline - Count frozen in quality-baseline.json.
 * @returns {{ regressed: boolean, improved: boolean }}
 */
export function evaluateCodeqlRatchet(current, baseline) {
  return {
    regressed: current > baseline,
    improved: current < baseline,
  };
}

// ---------------------------------------------------------------------------
// Repository detection
// ---------------------------------------------------------------------------

/**
 * Detects the owner/repo of the current repository using `gh repo view`.
 * Returns null if `gh` is unavailable or unauthenticated.
 *
 * @param {string} ghBin - Path to the gh binary
 * @returns {string|null} "owner/repo" or null
 */
export function detectRepo(ghBin) {
  try {
    const stdout = execFileSync(
      ghBin,
      ["repo", "view", "--json", "nameWithOwner", "-q", ".nameWithOwner"],
      {
        encoding: "utf8",
        timeout: 15_000,
      }
    );
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Binary detection
// ---------------------------------------------------------------------------

/**
 * Detects if the `gh` binary is available on the PATH.
 * Uses `which` (Unix) without shell interpolation — Hard Rule #13.
 *
 * @returns {string|null} Absolute path to the binary, or null if absent.
 */
export function findGhCli() {
  try {
    const result = spawnSync("which", ["gh"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    if (result.status === 0) {
      return result.stdout.trim();
    }
  } catch {
    // which unavailable
  }

  // Fallback: tentar executar diretamente para verificar ENOENT
  try {
    const result = spawnSync("gh", ["--version"], {
      encoding: "utf8",
      timeout: 5_000,
    });
    if (result.error?.code === "ENOENT") return null;
    if (result.status !== null) return "gh"; // found in PATH
  } catch {
    // noop
  }

  return null;
}

// ---------------------------------------------------------------------------
// API caller
// ---------------------------------------------------------------------------

/**
 * Fetch open CodeQL alerts via `gh api`.
 * Pagina automaticamente (GitHub retorna max 100 por página).
 *
 * @param {string} ghBin - Path to the gh binary
 * @param {string} repo  - "owner/repo"
 * @returns {Array} Array of alerts
 */
function fetchCodeQLAlerts(ghBin, repo) {
  const allAlerts = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const endpoint = `/repos/${repo}/code-scanning/alerts?state=open&tool_name=CodeQL&per_page=${perPage}&page=${page}`;

    if (!QUIET) {
      process.stderr.write(`[codeql-ratchet] Fetching alerts: page ${page} ...\n`);
    }

    let stdout;
    try {
      stdout = execFileSync(ghBin, ["api", endpoint], {
        encoding: "utf8",
        timeout: 30_000,
        maxBuffer: 16 * 1024 * 1024,
      });
    } catch (err) {
      const errMsg = String(err.stderr ?? err.message ?? "");

      // No authentication
      if (
        errMsg.includes("authentication") ||
        errMsg.includes("401") ||
        errMsg.includes("not logged")
      ) {
        return { error: "no-auth", message: errMsg };
      }

      // Rate limit ou outro erro HTTP
      const codeMatch = /HTTP (\d{3})/.exec(errMsg);
      const code = codeMatch ? codeMatch[1] : "unknown";
      return { error: `api-error:${code}`, message: errMsg };
    }

    let page_alerts;
    try {
      page_alerts = JSON.parse(stdout);
    } catch (parseErr) {
      // A malformed (but HTTP-200) API response is a MEASUREMENT failure, not a
      // regression. A blocking gate must never red on it — return the same
      // {error,message} shape the caller already maps to a graceful SKIP (exit 0).
      return { error: "parse-error", message: String(parseErr.message ?? parseErr) };
    }

    // The API returns null when there are no more pages (or an empty array)
    if (!Array.isArray(page_alerts) || page_alerts.length === 0) break;

    allAlerts.push(...page_alerts);

    // Se retornou menos que perPage, chegamos à última página
    if (page_alerts.length < perPage) break;

    page++;
  }

  return allAlerts;
}

// ---------------------------------------------------------------------------
// Baseline
// ---------------------------------------------------------------------------

/**
 * Read metrics.codeqlAlerts.value from quality-baseline.json.
 * Returns null if the file or the metric is absent (pure collector mode:
 * without a baseline there is no ratchet, just emission of the count).
 *
 * @returns {number|null}
 */
function readBaselineCodeqlValue() {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  let baselineJson;
  try {
    baselineJson = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
  } catch {
    return null;
  }
  const metric = baselineJson?.metrics?.codeqlAlerts;
  if (!metric || typeof metric.value !== "number") return null;
  return metric.value;
}

/**
 * Apply the ratchet (direction:down) to the measured count vs the baseline.
 * Sets process.exitCode = 1 on a real regression (measured > baseline) except
 * --advisory. Rachets the baseline with --update when the count drops.
 *
 * Exported for unit testing (drives the effect on process.exitCode).
 *
 * @param {number} alertCount - MEASURED count (successful measurement).
 */
export function applyRatchet(alertCount) {
  const baselineValue = readBaselineCodeqlValue();

  // No baseline → pure collector mode (emits the count, does not fail).
  if (baselineValue === null) {
    if (!QUIET) {
      process.stderr.write(
        "[codeql-ratchet] baseline absent (metrics.codeqlAlerts) — collector mode, no ratchet.\n"
      );
    }
    process.exitCode = 0;
    return;
  }

  const { regressed, improved } = evaluateCodeqlRatchet(alertCount, baselineValue);

  if (UPDATE && improved) {
    const baselineJson = JSON.parse(fs.readFileSync(BASELINE_PATH, "utf8"));
    baselineJson.metrics.codeqlAlerts.value = alertCount;
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(baselineJson, null, 2) + "\n");
    console.log(`[codeql-ratchet] baseline ratcheted: ${alertCount} (was ${baselineValue})`);
  }

  if (regressed && !ADVISORY) {
    process.stderr.write(
      `[codeql-ratchet] REGRESSION — ${alertCount} open CodeQL alerts > baseline ${baselineValue}\n` +
        "  → Fix the new alerts under Security → Code scanning, or run\n" +
        "    'node scripts/check/check-codeql-ratchet.mjs --update' if the count legitimately dropped.\n"
    );
    process.exitCode = 1;
    return;
  }

  if (!QUIET) {
    const verdict = regressed ? "ADVISORY — regression ignored (--advisory)" : "OK — no regression";
    process.stderr.write(
      `[codeql-ratchet] ${verdict} — ${alertCount} alerts (baseline ${baselineValue})\n`
    );
  }
  process.exitCode = 0;
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

function main() {
  const ghBin = findGhCli();

  if (!ghBin) {
    console.log("codeqlAlerts=SKIP reason=binary-absent");
    if (!QUIET) {
      process.stderr.write(
        "[codeql-ratchet] SKIP — `gh` CLI not found in PATH.\n" +
          "[codeql-ratchet] Install via: https://cli.github.com/\n" +
          "[codeql-ratchet] ADVISORY — this gate exits 0 (ratchet runs in Phase 7 INT CI).\n"
      );
    }
    process.exitCode = 0;
    return;
  }

  // Detect repository
  const repo = detectRepo(ghBin);
  if (!repo) {
    console.log("codeqlAlerts=SKIP reason=no-repo");
    if (!QUIET) {
      process.stderr.write(
        "[codeql-ratchet] SKIP — could not detect the GitHub repository.\n" +
          "[codeql-ratchet] Run inside a GitHub repository with `gh` authenticated.\n"
      );
    }
    process.exitCode = 0;
    return;
  }

  if (!QUIET) {
    process.stderr.write(`[codeql-ratchet] Repository detected: ${repo}\n`);
  }

  // Fetch alerts
  const result = fetchCodeQLAlerts(ghBin, repo);

  // Treat API errors with a graceful skip
  if (!Array.isArray(result)) {
    const { error, message } = result;
    console.log(`codeqlAlerts=SKIP reason=${error}`);
    if (!QUIET) {
      process.stderr.write(
        `[codeql-ratchet] SKIP — error querying GitHub API: ${message.slice(0, 200)}\n`
      );
    }
    process.exitCode = 0;
    return;
  }

  if (PRINT_JSON) {
    process.stdout.write(JSON.stringify(result, null, 2) + "\n");
    return;
  }

  const { alertCount, bySeverity, byRule } = parseCodeQLAlerts(result);

  // Emitir em formato KEY=VALUE para o coletor de métricas (collect-metrics.mjs)
  console.log(`codeqlAlerts=${alertCount}`);

  if (!QUIET) {
    const severitySummary =
      Object.entries(bySeverity)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ") || "nenhum";
    const topRules =
      Object.entries(byRule)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)
        .map(([r, n]) => `${r}(${n})`)
        .join(", ") || "nenhum";

    process.stderr.write(
      `[codeql-ratchet] Open CodeQL alerts (non-dismissed): ${alertCount}\n`
    );
    if (alertCount > 0) {
      process.stderr.write(`[codeql-ratchet]   Por severidade: ${severitySummary}\n`);
      process.stderr.write(`[codeql-ratchet]   Top regras: ${topRules}\n`);
    }
  }

  // Successful measurement → apply the ratchet (blocking except --advisory).
  // Any MEASUREMENT failure above already returned with exit 0 (graceful skip).
  applyRatchet(alertCount);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
