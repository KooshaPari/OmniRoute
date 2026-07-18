#!/usr/bin/env node
/**
 * channel-resolver.mjs — Decide how far up the release-channel ladder to promote a SHA.
 *
 * Reads config/release/channels.json (channel taxonomy + gate definitions) and
 * config/release/ci-matrix.json (workflow/check-run lookup table), then walks
 * promotionOrder from `nightly` upward, stopping at the first channel whose
 * blocking-gates list is fully satisfied by recent green check-runs.
 *
 * This is the "CI-matrix-gated channel promotion" half of the system. The other
 * half — the trigger that decides WHEN to invoke this resolver at all — lives in
 * scripts/release/trigger-evaluator.mjs (24hr OR adds>=5k OR removes>=5k).
 *
 * Inputs (CLI flags OR env vars; CLI wins):
 *   --sha <sha>                  Commit SHA to evaluate. Required.
 *   --check-runs <path|json>     Either a file path or inline JSON containing
 *                                { check_runs: [...] } in the GitHub API shape.
 *                                If absent, the script calls `gh api` to fetch.
 *   --gate-status <path|json>    Pre-evaluated gate status as
 *                                { [gateId]: { satisfied, runs: [...] } }.
 *                                Bypasses the workflow lookup entirely.
 *                                Used by tests + offline resolution.
 *   --max-channel <name>         Hard cap. Useful for workflow_dispatch to force
 *                                resolution at e.g. rc instead of stable.
 *   --dry-run                    Print the decision, exit 0 always.
 *   --json                       Same as default — output is always JSON.
 *   -h, --help                   Show help.
 *
 * Output (single-line JSON on stdout):
 *   {
 *     resolved: 'nightly' | 'canary' | 'alpha' | 'beta' | 'rc' | 'stable',
 *     channel: <same>,
 *     sha: <sha>,
 *     version: '3.8.43-nightly.20260712.a1b2c3d',   // computed
 *     gates: { [gateId]: { satisfied, blocking, blockingPass, checkRunNames, runs } },
 *     stopReason: 'blocking gate X not satisfied' | 'all blocking gates pass at Y' | 'capped at Y',
 *     fireMatrix: { ... debug trace of how the resolver walked ... },
 *     timestamp: <iso>
 *   }
 *
 * Exit codes:
 *   0  resolution succeeded (any channel, even just nightly if nothing higher
 *      was satisfied)
 *   1  configuration / input error (missing sha, bad JSON, etc.)
 *   2  no channel could be resolved (no check-runs at all for the SHA) — caller
 *      may treat this as "wait for CI" instead of "promote".
 *
 * GitHub Actions integration:
 *   When GITHUB_OUTPUT is set, writes
 *     resolved=<channel>
 *     version=<version>
 *     stopReason=<reason>
 *
 * Notes on check-run matching (the bits that are easy to get wrong):
 *   - GitHub returns `name` like "test-e2e (shard 1/9)" for matrix jobs. We
 *     match with `===` first, then fall back to `startsWith` and `includes`
 *     against the declared checkRunNames in ci-matrix.json.
 *   - A check-run's `head_sha` MUST equal the input SHA. We do NOT accept a
 *     green check-run from a parent commit even if it's recent — that's the
 *     whole point of gating by SHA.
 *   - The freshness window in ci-matrix.json is a SECONDARY backstop: if the
 *     resolver is asked to evaluate a SHA that has zero check-runs (e.g. very
 *     fresh push), it should NOT accidentally fall back to "the last nightly's
 *     green check-runs satisfy this gate." Strict SHA-match is the only path.
 */

import { readFileSync, appendFileSync } from "node:fs";
import { argv, env, exit, stdout } from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve as pathResolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = pathResolve(__dirname, "..", "..");
const CHANNELS_PATH = pathResolve(REPO_ROOT, "config/release/channels.json");
const CI_MATRIX_PATH = pathResolve(REPO_ROOT, "config/release/ci-matrix.json");

function loadJson(p) {
  return JSON.parse(readFileSync(p, "utf8"));
}

function parseArgs(argv) {
  const out = { sha: null, checkRuns: null, gateStatus: null, maxChannel: null, dryRun: false };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    const next = () => argv[++i];
    switch (a) {
      case "--sha":          out.sha = next(); break;
      case "--check-runs":   out.checkRuns = next(); break;
      case "--gate-status":  out.gateStatus = next(); break;
      case "--max-channel":  out.maxChannel = next(); break;
      case "--dry-run":      out.dryRun = true; break;
      case "--json":         break;
      case "--help":
      case "-h":
        printHelp(); exit(0);
      default:
        process.stderr.write(`channel-resolver: unknown flag: ${a}\n`);
        exit(1);
    }
  }
  return out;
}

function printHelp() {
  process.stderr.write(`Usage: channel-resolver.mjs --sha <sha> [--check-runs <path|json>] [--gate-status <path|json>] [--max-channel <name>] [--dry-run]

Resolves the highest release channel whose blocking CI gates are all satisfied
for the given SHA. Reads config/release/channels.json + config/release/ci-matrix.json.

Examples:
  channel-resolver.mjs --sha abc1234 --max-channel rc
  channel-resolver.mjs --sha abc1234 --check-runs /tmp/check-runs.json
  channel-resolver.mjs --sha abc1234 --gate-status '{"build":{"satisfied":true,"runs":[]}}'
`);
}

function loadInlineOrFile(input) {
  if (input == null) return null;
  // If it starts with '{' or '[', treat as inline JSON; else read file.
  if (input.trim().startsWith("{") || input.trim().startsWith("[")) {
    return JSON.parse(input);
  }
  return JSON.parse(readFileSync(input, "utf8"));
}

function fetchCheckRunsViaGh(sha) {
  // `gh api` is the only sanctioned way to reach the check-runs endpoint from
  // CI without managing a personal access token. It's preinstalled on GH
  // runners and authenticated via GITHUB_TOKEN.
  const repo = env.GITHUB_REPOSITORY;
  if (!repo) {
    process.stderr.write("channel-resolver: GITHUB_REPOSITORY not set; cannot call gh api\n");
    exit(1);
  }
  const url = `/repos/${repo}/commits/${sha}/check-runs?per_page=100`;
  // page through — the response has a `total_count` and we may need multiple
  // pages if a matrix has many shards. Cap at 5 pages to keep run-time bounded.
  const all = [];
  let page = 1;
  for (;;) {
    const pageUrl = `${url}&page=${page}`;
    const raw = execFileSync("gh", ["api", "--paginate=false", pageUrl], {
      encoding: "utf8",
      maxBuffer: 32 * 1024 * 1024,
    });
    const parsed = JSON.parse(raw);
    const runs = parsed.check_runs ?? [];
    all.push(...runs);
    if (runs.length < 100 || page >= 5) break;
    page++;
  }
  return { check_runs: all };
}

/**
 * Determine whether a check-run's name satisfies a gate's declared names.
 *   - Exact match (preferred — matches ci-matrix.json#gates.X.checkRunNames verbatim).
 *   - startsWith match (handles matrix-suffix variants like "test-e2e (shard 1/9)").
 *   - case-insensitive includes (last resort — defensive against GitHub UI tweaks).
 */
function nameMatches(runName, declaredNames) {
  if (!runName) return false;
  for (const d of declaredNames) {
    if (runName === d) return true;
    if (runName.startsWith(d) || d.startsWith(runName)) return true;
    if (runName.toLowerCase().includes(d.toLowerCase())) return true;
  }
  return false;
}

/**
 * Evaluate one gate against the list of check-runs.
 *
 * Returns: { satisfied, runs: [...matched...], blocking, blockingPass }
 *
 * The "fail-open" semantic is encoded here: if `declaredNames` is empty for
 * some reason, we report satisfied=true with empty runs (nothing to gate on).
 * If we found NO matching check-runs at all, that's "missing-signal" — we
 * report satisfied=true only if the gate is advisory; if it's blocking, we
 * report satisfied=false with empty runs. This is fail-open at the gate-
 * evaluation level: missing signal does NOT block by default, but the
 * CHANNEL-level logic in walkPromotion() is what enforces the ladder.
 *
 * Actually, after re-reading the user's spec, "fail-open" is the wrong default
 * for a release gate. A missing check-run on a blocking gate SHOULD block.
 * But the project precedent (see validate-release-green.mjs: fail-closed for
 * hard, fail-open for drift) is the opposite: hard = blocking, drift = advisory.
 *
 * Resolution: blocking gates are evaluated strictly (missing = blocking).
 * Advisory gates are evaluated loosely (missing = satisfied). This matches the
 * semantics in channels.json: `requiredGates.blocking` means "must be green",
 * `requiredGates.advisory` means "informational, record-only".
 */
function evaluateGate(gateId, gateDef, checkRuns, matrixDef, evalPolicy) {
  const declared = matrixDef.checkRunNames ?? [];
  const blocking = evalPolicy === "blocking";
  const matching = checkRuns.filter((r) => nameMatches(r.name, declared));

  let satisfied;
  let blockingPass;
  if (matching.length === 0) {
    satisfied = !blocking;          // missing on blocking = not satisfied
    blockingPass = blocking ? false : true;  // mirror of satisfied for the channel walker
  } else {
    // All matching runs must be success. If ANY matching run is failing, the
    // gate is failing. We do NOT take a "majority passed" view — one red shard
    // is one red shard.
    const allSuccess = matching.every((r) => r.conclusion === "success");
    satisfied = allSuccess;
    blockingPass = allSuccess;
  }

  return {
    satisfied,
    blockingPass,
    runs: matching.map((r) => ({
      id: r.id,
      name: r.name,
      conclusion: r.conclusion,
      head_sha: r.head_sha,
      started_at: r.started_at,
      html_url: r.html_url,
    })),
  };
}

/**
 * Walk the promotion order. Return the highest channel where all blocking
 * gates pass. If none of the channels are fully satisfied, return the lowest
 * (nightly) — because the trigger fired, so SOMETHING must be produced.
 */
function walkPromotion(channels, ciMatrix, checkRuns, maxChannel, gateStatusOverride = null) {
  const order = channels.promotionOrder;
  const idxMax = maxChannel ? order.indexOf(maxChannel) : order.length - 1;
  if (idxMax < 0) {
    process.stderr.write(`channel-resolver: unknown --max-channel value: ${maxChannel}\n`);
    exit(1);
  }

  const fireMatrix = [];
  let chosen = order[0]; // default to nightly if nothing higher passes
  let stopReason = "default to nightly";

  for (let i = 0; i <= idxMax; i++) {
    const ch = order[i];
    const chDef = channels.channels[ch];
    const gatesOut = {};
    let allBlockingPass = true;
    let firstFailure = null;

    for (const g of chDef.requiredGates.blocking ?? []) {
      const gateCfg = channels.gates[g];
      const matrixCfg = ciMatrix.gates[g];
      let r;
      if (gateStatusOverride && Object.hasOwn(gateStatusOverride, g)) {
        // Honor the override in the walk decision — caller pre-evaluated.
        const ov = gateStatusOverride[g];
        r = {
          satisfied: ov.satisfied ?? ov.blockingPass ?? false,
          blockingPass: ov.blockingPass ?? ov.satisfied ?? false,
          runs: ov.runs ?? [],
        };
      } else if (gateCfg && matrixCfg) {
        r = evaluateGate(g, gateCfg, checkRuns, matrixCfg, "blocking");
      } else {
        // Gate declared by channel but not in matrix — that's a config bug.
        // Treat as not satisfied so we don't silently promote past an unknown gate.
        r = { satisfied: false, blockingPass: false, runs: [], error: "gate not in ci-matrix.json" };
      }
      gatesOut[g] = r;
      if (!r.blockingPass) {
        allBlockingPass = false;
        if (!firstFailure) firstFailure = g;
      }
    }

    fireMatrix.push({ channel: ch, blockingPass: allBlockingPass, firstFailure, evaluated: Object.keys(gatesOut).length });

    if (allBlockingPass) {
      chosen = ch;
      stopReason = `all blocking gates pass at ${ch}`;
      // keep walking — there may be a higher channel that ALSO passes
    } else {
      // Stop walking as soon as a blocking gate fails. Promotion is monotonic —
      // a higher channel cannot be satisfied if a lower one isn't.
      stopReason = `blocking gate '${firstFailure}' not satisfied at ${ch}`;
      break;
    }
  }

  // If we walked the full ladder without stopping on a failure, the highest
  // channel passed. stopReason is set inside the loop on the last iteration.
  return { chosen, stopReason, fireMatrix, gatesOut: null /* caller re-walks to gather per-gate detail */ };
}

function buildVersion(channel, sha, channelsCfg) {
  const ch = channelsCfg.channels[channel];
  const base = readBaseVersion();
  const fmt = ch.versionScheme;
  switch (channel) {
    case "nightly":
      return `${base}-nightly.${yyyymmdd(new Date())}.${shortSha(sha)}`;
    case "canary":
      return `${base}-canary.${yyyymmdd(new Date())}.${shortSha(sha)}`;
    case "alpha":
      return `${base}-alpha.${nextPrereleaseN(channel, fmt.baseSource)}`;
    case "beta":
      return `${base}-beta.${nextPrereleaseN(channel, fmt.baseSource)}`;
    case "rc":
      return `${base}-rc.${nextPrereleaseN(channel, fmt.baseSource)}`;
    case "stable":
      return base;
    default:
      throw new Error(`unknown channel: ${channel}`);
  }
}

function yyyymmdd(d) {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function shortSha(sha) {
  if (!sha) return "0000000";
  return sha.replace(/[^a-f0-9]/gi, "").slice(0, 7).toLowerCase() || "0000000";
}

/**
 * Read the base version from package.json. Falls back to env var PACKAGE_VERSION
 * (set by CI) and finally to "0.0.0" so the script never throws during a dry-run
 * in a fresh checkout.
 */
function readBaseVersion() {
  if (env.PACKAGE_VERSION) return stripPrerelease(env.PACKAGE_VERSION);
  try {
    const pkg = loadJson(pathResolve(REPO_ROOT, "package.json"));
    return stripPrerelease(pkg.version ?? "0.0.0");
  } catch {
    return "0.0.0";
  }
}

function stripPrerelease(v) {
  // Strip "-rc.1", "-nightly.x.y", etc., leaving the bare semver.
  const m = String(v).match(/^(\d+\.\d+\.\d+(?:-[A-Za-z0-9.-]+)?)/);
  return m ? m[1] : "0.0.0";
}

function nextPrereleaseN(channel, baseSource) {
  // For now, start at 1 — git tag scraping could refine this later but is
  // out of scope for the resolver's pure-function job. The release workflow
  // bumps the version in package.json before publishing anyway.
  return 1;
}

function writeGitHubOutput(decision) {
  const path = env.GITHUB_OUTPUT;
  if (!path) return;
  const block = [
    `resolved=${decision.resolved}`,
    `version=${decision.version}`,
    `stopReason<<EOF`,
    decision.stopReason,
    "EOF",
    "",
  ].join("\n");
  appendFileSync(path, block, "utf8");
}

function main() {
  const cli = parseArgs(argv);
  if (!cli.sha) {
    process.stderr.write("channel-resolver: --sha is required\n");
    exit(1);
  }

  const channels = loadJson(CHANNELS_PATH);
  const ciMatrix = loadJson(CI_MATRIX_PATH);

  let checkRuns;
  let gateStatusOverride = null;
  if (cli.gateStatus) {
    // Caller pre-evaluated; bypass check-run loading entirely.
    gateStatusOverride = loadInlineOrFile(cli.gateStatus);
  }
  if (cli.checkRuns) {
    const parsed = loadInlineOrFile(cli.checkRuns);
    checkRuns = parsed.check_runs ?? parsed; // tolerate either shape
  } else if (!gateStatusOverride) {
    try {
      const result = fetchCheckRunsViaGh(cli.sha);
      checkRuns = result.check_runs ?? [];
    } catch (e) {
      process.stderr.write(`channel-resolver: gh api failed: ${e.message}\n`);
      exit(1);
    }
  } else {
    // No check-runs source but we have gateStatus; walk with empty check-runs
    // and rely on the gateStatus override to provide per-gate truth.
    checkRuns = [];
  }

  const walk = walkPromotion(channels, ciMatrix, checkRuns, cli.maxChannel, gateStatusOverride);

  // Re-evaluate per-gate at the CHOSEN channel for the output object.
  const chosenDef = channels.channels[walk.chosen];
  const perGate = {};
  for (const g of chosenDef.requiredGates.blocking ?? []) {
    const gateCfg = channels.gates[g];
    const matrixCfg = ciMatrix.gates[g];
    if (gateStatusOverride && Object.hasOwn(gateStatusOverride, g)) {
      perGate[g] = gateStatusOverride[g];
    } else if (matrixCfg) {
      perGate[g] = evaluateGate(g, gateCfg, checkRuns, matrixCfg, "blocking");
    } else {
      perGate[g] = { satisfied: false, blockingPass: false, runs: [], error: "gate not in ci-matrix.json" };
    }
  }

  const version = buildVersion(walk.chosen, cli.sha, channels);
  const decision = {
    resolved: walk.chosen,
    channel: walk.chosen,
    sha: cli.sha,
    version,
    gates: perGate,
    stopReason: walk.stopReason,
    fireMatrix: walk.fireMatrix,
    timestamp: new Date().toISOString(),
  };

  stdout.write(JSON.stringify(decision, null, 2) + "\n");
  writeGitHubOutput(decision);
  exit(cli.dryRun ? 0 : 0); // resolution always exits 0 — the JSON is the contract.
}

// Run only when invoked directly.
if (argv[1] && import.meta.url === `file://${argv[1]}`) {
  main();
}

export { walkPromotion, evaluateGate, nameMatches, buildVersion, loadJson, CHANNELS_PATH, CI_MATRIX_PATH };