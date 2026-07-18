#!/usr/bin/env node
/**
 * trigger-evaluator.mjs — Release trigger evaluator.
 *
 * Decides whether an automated release build of the most primitive channel
 * (nightly) should fire. Per config/release/channels.json#autoTrigger, the
 * rule is: 24hr OR adds>=5k OR removes>=5k. Any single condition trips it.
 *
 * Inputs (CLI flags OR env vars; CLI wins):
 *   --last-release-ts <ms>       Epoch ms of the last release (any channel).
 *                                Defaults to env LAST_RELEASE_TS, or 0.
 *   --added-lines <n>            Lines added since last release.
 *                                Defaults to env ADDED_LINES, or 0.
 *   --removed-lines <n>          Lines removed since last release.
 *                                Defaults to env REMOVED_LINES, or 0.
 *   --now <ms>                   Override 'now' (for deterministic tests).
 *   --interval-hours <n>         Override the 24h threshold.
 *   --add-threshold <n>          Override the 5000 adds threshold.
 *   --remove-threshold <n>       Override the 5000 removes threshold.
 *   --dry-run                    Print the decision, exit 0 whether fire or not.
 *                                (Without --dry-run, exit 0 on fire, exit 2 on no-fire.)
 *   --json                       Same as the default — output is always JSON.
 *
 * Output:
 *   stdout:  single-line JSON object
 *              { fire: bool, channel: 'nightly', reason: string, conditions: {...} }
 *
 * GitHub Actions integration:
 *   When GITHUB_OUTPUT is set, also writes
 *     fire=<bool>
 *     channel=nightly
 *     reason=<string>
 *   so the calling step can `id: trigger` and reference ${{ steps.trigger.fire }}.
 *
 * Exit codes:
 *   0  decision recorded (fire or no-fire), continue the workflow
 *   1  configuration / input error (bad flags, NaN, negative numbers)
 *   2  no-fire WITHOUT --dry-run — used by callers that want to short-circuit
 *
 * Design notes:
 *   - The "most primitive channel" is always `nightly` here. This script is the
 *     primitive-type trigger. Promotion to a higher channel is the resolver's job
 *     (channel-resolver.mjs), not this script's.
 *   - We deliberately do NOT consider merge-commit-vs-squash semantics for the
 *     diff calculation. The caller is expected to compute --added-lines and
 *     --removed-lines however the project's release-engineering convention dictates
 *     (currently: `git diff --shortstat <last-release-sha>..HEAD` for the auto
 *     push-to-main workflow; `git diff --shortstat <base>..<head>` for dispatch).
 *   - "Stable" is never the result of this script. Stable promotion is human-driven
 *     via release-channels.yml workflow_dispatch.
 */

import { writeFileSync, appendFileSync } from "node:fs";
import { argv, env, exit, stdout } from "node:process";

const DEFAULT_INTERVAL_HOURS = 24;
const DEFAULT_ADD_THRESHOLD = 5000;
const DEFAULT_REMOVE_THRESHOLD = 5000;

function parseArgs(argv) {
  const out = {
    lastReleaseTs: null,
    addedLines: null,
    removedLines: null,
    now: null,
    intervalHours: null,
    addThreshold: null,
    removeThreshold: null,
    dryRun: false,
  };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--last-release-ts":   out.lastReleaseTs = Number(next()); break;
      case "--added-lines":       out.addedLines   = Number(next()); break;
      case "--removed-lines":     out.removedLines = Number(next()); break;
      case "--now":               out.now          = Number(next()); break;
      case "--interval-hours":    out.intervalHours = Number(next()); break;
      case "--add-threshold":     out.addThreshold = Number(next()); break;
      case "--remove-threshold":  out.removeThreshold = Number(next()); break;
      case "--dry-run":           out.dryRun = true; break;
      case "--json":              break; // output is always JSON
      case "--help":
      case "-h":
        printHelp();
        exit(0);
      default:
        process.stderr.write(`trigger-evaluator: unknown flag: ${a}\n`);
        exit(1);
    }
  }
  return out;
}

function printHelp() {
  process.stderr.write(`Usage: trigger-evaluator.mjs [options]

  --last-release-ts <ms>      Epoch ms of the last release (any channel).
  --added-lines <n>          Lines added since last release.
  --removed-lines <n>        Lines removed since last release.
  --now <ms>                 Override 'now' (defaults to Date.now()).
  --interval-hours <n>       Override the 24h threshold (default: ${DEFAULT_INTERVAL_HOURS}).
  --add-threshold <n>        Override the 5000 adds threshold (default: ${DEFAULT_ADD_THRESHOLD}).
  --remove-threshold <n>     Override the 5000 removes threshold (default: ${DEFAULT_REMOVE_THRESHOLD}).
  --dry-run                  Always exit 0; just print the decision.
  -h, --help                 Show this help.

Outputs single-line JSON: { fire, channel, reason, conditions }.
`);
}

function envNumber(name) {
  const v = env[name];
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function resolve(cli) {
  const get = (cliVal, envName, fallback) =>
    cliVal != null && Number.isFinite(cliVal)
      ? cliVal
      : (envNumber(envName) ?? fallback);

  const intervalHours = get(cli.intervalHours, "TRIGGER_INTERVAL_HOURS", DEFAULT_INTERVAL_HOURS);
  const addThreshold  = get(cli.addThreshold,  "TRIGGER_ADD_THRESHOLD",  DEFAULT_ADD_THRESHOLD);
  const removeThreshold = get(cli.removeThreshold, "TRIGGER_REMOVE_THRESHOLD", DEFAULT_REMOVE_THRESHOLD);

  // lastReleaseTs / added / removed default to 0 (treat missing data as "no signal").
  // We choose 0 over null because:
  //   - missing timestamp → "never released" → very stale → fire (matches intent)
  //   - missing diff → "no diff known" → don't fire on diff (matches intent)
  const lastReleaseTs = get(cli.lastReleaseTs, "LAST_RELEASE_TS", 0);
  const addedLines    = get(cli.addedLines,    "ADDED_LINES",    0);
  const removedLines  = get(cli.removedLines,  "REMOVED_LINES",  0);
  const now           = get(cli.now,           "TRIGGER_NOW",    Date.now());

  // Validation.
  for (const [n, v] of [
    ["--interval-hours", intervalHours],
    ["--add-threshold",  addThreshold],
    ["--remove-threshold", removeThreshold],
    ["--last-release-ts", lastReleaseTs],
    ["--added-lines",    addedLines],
    ["--removed-lines",  removedLines],
    ["--now",            now],
  ]) {
    if (!Number.isFinite(v) || v < 0) {
      process.stderr.write(`trigger-evaluator: ${n} must be a non-negative finite number, got: ${v}\n`);
      exit(1);
    }
  }

  return { intervalHours, addThreshold, removeThreshold, lastReleaseTs, addedLines, removedLines, now };
}

function evaluate(r) {
  const ageHours = r.lastReleaseTs > 0 ? (r.now - r.lastReleaseTs) / 3_600_000 : Infinity;

  const stale = ageHours >= r.intervalHours;
  const bigAdd = r.addedLines >= r.addThreshold;
  const bigRemove = r.removedLines >= r.removeThreshold;

  const conditions = {
    timeBased: {
      ageHours: Number.isFinite(ageHours) ? round2(ageHours) : null,
      thresholdHours: r.intervalHours,
      fire: stale,
      note: r.lastReleaseTs === 0 ? "no previous release recorded" : undefined,
    },
    addedLines: {
      value: r.addedLines,
      threshold: r.addThreshold,
      fire: bigAdd,
    },
    removedLines: {
      value: r.removedLines,
      threshold: r.removeThreshold,
      fire: bigRemove,
    },
  };

  const firedConditions = [];
  if (stale) firedConditions.push(`stale (${conditions.timeBased.ageHours}h ≥ ${r.intervalHours}h)`);
  if (bigAdd) firedConditions.push(`+${r.addedLines} ≥ ${r.addThreshold}`);
  if (bigRemove) firedConditions.push(`-${r.removedLines} ≥ ${r.removeThreshold}`);

  const fire = firedConditions.length > 0;
  const reason = fire
    ? `release trigger fired: ${firedConditions.join(" OR ")}`
    : `no trigger: age=${conditions.timeBased.ageHours ?? "n/a"}h (<${r.intervalHours}h), +${r.addedLines} (<${r.addThreshold}), -${r.removedLines} (<${r.removeThreshold})`;

  return { fire, channel: "nightly", reason, conditions };
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

function writeGitHubOutput(decision) {
  const path = env.GITHUB_OUTPUT;
  if (!path) return;
  // Each line of the heredoc file becomes an output. Multiline values are
  // delimited by <<EOF ... EOF; here we use the simple form because all
  // values are single-line.
  const block = [
    `fire=${decision.fire}`,
    `channel=${decision.channel}`,
    `reason<<EOF`,
    decision.reason,
    "EOF",
    "",
  ].join("\n");
  appendFileSync(path, block, "utf8");
}

function main() {
  const cli = parseArgs(argv);
  const r = resolve(cli);
  const decision = evaluate(r);

  // Output: single-line JSON.
  stdout.write(JSON.stringify(decision) + "\n");

  writeGitHubOutput(decision);

  // Decision-tree exit:
  //   --dry-run        → always 0 (the caller wants the verdict, not the gate)
  //   fire=true        → 0 (continue workflow)
  //   fire=false       → 2 (caller can `if: steps.trigger.outcome == 'success'`
  //                       style-guard; or just let it short-circuit by reading
  //                       the JSON output's `fire` field)
  if (cli.dryRun) exit(0);
  exit(decision.fire ? 0 : 2);
}

// Run only when invoked directly. Tests can import `evaluate`/`resolve` for
// pure-function coverage.
if (env.NODE_TEST_TRIGGER_EVAL === "1") {
  // Test harness mode: importable shape only.
} else if (argv[1] && import.meta.url === `file://${argv[1]}`) {
  main();
}

export { evaluate, resolve, parseArgs };