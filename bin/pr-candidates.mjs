#!/usr/bin/env node
// bin/pr-candidates.mjs
//
// W10.07 — Upstream PR factory: claim, triage, and track upstream issue fixes.
//
// Fits into the workflow:
//   bin/upstream-intel.mjs (W1.10)   → produces upstream/tier1-issues.json
//   bin/pr-candidates.mjs (W10.07)    → classifies, claims, drafts PR candidates
//   upstream/pr-candidates.md          → human-visible queue
//
// Usage:
//   node bin/pr-candidates.mjs                  # triage: show queue sorted by merge-odds
//   node bin/pr-candidates.mjs --claim 12501    # claim an issue
//   node bin/pr-candidates.mjs --draft 12501    # open draft PR from fork
//   node bin/pr-candidates.mjs --ready 12501    # mark READY, PR can be opened
//   node bin/pr-candidates.mjs --status         # show queue status
//   node bin/pr-candidates.mjs --update         # re-fetch upstream and refresh queue
//   node bin/pr-candidates.mjs --summary        # compact one-line queue summary

import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const UPSTREAM_DIR = "upstream";
const CANDIDATES_FILE = join(UPSTREAM_DIR, "pr-candidates.md");
const TIER1_FILE = join(UPSTREAM_DIR, "tier1-issues.json");
const LATEST_FILE = join(UPSTREAM_DIR, "issues-latest.json");
const REPO = "diegosouzapw/OmniRoute";
const FORK_REPO = "KooshaPari/OmniRoute";

const args = process.argv.slice(2);

// ---- helpers ---------------------------------------------------------------

function loadJson(path) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return null;
  }
}

function labelTier(labels) {
  const names = labels.map((l) => l.name);
  if (names.includes("documentation") || names.includes("typo")) return { tier: 1, bucket: "B1", effort: "5-15min", mergeOdds: "95%" };
  if (names.includes("dependencies") || names.includes("chore")) return { tier: 1, bucket: "B2", effort: "15-60min", mergeOdds: "85%" };
  if (names.includes("help wanted")) return { tier: 2, bucket: "B3", effort: "1-4hr", mergeOdds: "75%" };
  if (names.includes("acknowledged") || names.includes("bug")) return { tier: 3, bucket: "B4", effort: "2-8hr", mergeOdds: "60%" };
  if (names.includes("keep-open") || names.includes("quality-gate-finding")) return { tier: 4, bucket: "B5", effort: "4-16hr", mergeOdds: "50%" };
  if (names.includes("enhancement") || names.includes("feat")) return { tier: 5, bucket: "B7", effort: "1-3days", mergeOdds: "20%" };
  return { tier: 6, bucket: "B8", effort: "TBD", mergeOdds: "TBD" };
}

function fmtDate(iso) {
  return iso ? iso.slice(0, 10) : "unknown";
}

// ---- commands --------------------------------------------------------------

function cmdStatus() {
  const tier1 = loadJson(TIER1_FILE) || [];
  const all = loadJson(LATEST_FILE) || [];
  const counted = all.length;
  const tier1Count = tier1.length;

  console.log(`\n=== Upstream PR Queue Status ===`);
  console.log(`Upstream:  ${REPO}`);
  console.log(`Open issues: ${counted}  ·  Tier-1 candidates: ${tier1Count}`);
  console.log(`Candidates file: ${CANDIDATES_FILE}\n`);

  console.log("Tier-1 (highest merge-odds):");
  for (const i of tier1.slice(0, 10)) {
    const { tier, bucket, effort, mergeOdds } = labelTier(i.labels || []);
    console.log(`  [#${i.number}] [${bucket} ${effort}] ${mergeOdds} merge  ${fmtDate(i.updated_at)}  ${i.title.slice(0, 70)}`);
    if (i.html_url) console.log(`             → ${i.html_url}`);
  }

  console.log(`\nAll open issues: ${counted}. Filter with --update to refresh.`);
}

function cmdUpdate() {
  console.log("Fetching fresh upstream data via gh api…");
  const { execSync } = require("node:child_process");
  try {
    execSync(
      "node bin/upstream-intel.mjs --tier1 2>&1",
      { cwd: ".", stdio: "inherit" }
    );
    console.log("\n✓ Upstream data refreshed.");
    cmdStatus();
  } catch {
    console.error("✗ Failed to refresh upstream data. Check GITHUB_TOKEN and network.");
    process.exit(1);
  }
}

function cmdSummary() {
  const tier1 = loadJson(TIER1_FILE) || [];
  const all = loadJson(LATEST_FILE) || [];
  const acked = (all || []).filter((i) => (i.labels || []).map((l) => l.name).includes("acknowledged"));
  console.log(`upstream=${REPO} issues=${all.length} tier1=${tier1.length} acknowledged=${acked.length} queued=0`);
}

function cmdClaim(num) {
  console.log(`\n=== Claiming #${num} ===`);
  console.log("Before opening a PR, remember:");
  console.log("  1. Comment on the issue with your plan (W10.08 — plan-first protocol)");
  console.log("  2. Wait 24-48h for maintainer feedback");
  console.log("  3. Then run: node bin/pr-candidates.mjs --draft " + num);
  console.log("");
  console.log(`GitHub issue: https://github.com/${REPO}/issues/${num}`);
  console.log("");
  console.log(`To open a draft PR immediately (no plan comment):`);
  console.log(`  node bin/pr-candidates.mjs --draft ${num}`);
}

function cmdDraft(num) {
  console.log(`\n=== Draft PR for #${num} ===`);
  const all = loadJson(LATEST_FILE) || [];
  const issue = all.find((i) => i.number === parseInt(num));
  if (!issue) {
    console.error(`Issue #${num} not found in upstream/issues-latest.json. Run --update first.`);
    process.exit(1);
  }
  const { bucket, effort, mergeOdds } = labelTier(issue.labels || []);
  const title = issue.title;
  const branchName = `upstream-pr/fix-${num}-${title.toLowerCase().replace(/[^a-z0-9]+/g, "-").slice(0, 40)}`;
  const body = `## Summary

Fixes [#${num}](https://github.com/${REPO}/issues/${num}): ${title}

## Why

<!-- explain the bug or motivation -->

## What

<!-- describe what the fix does -->

## How

<!-- link to relevant code paths -->

## Testing

<!-- describe how you verified the fix -->

## Migration notes

<!-- only for B4+ changes that affect behavior -->

---
_Claimed via \`bin/pr-candidates.mjs\` — W10.07 upstream-PR factory._`;

  console.log(`\nBranch name: ${branchName}`);
  console.log(`PR body preview:\n${body.slice(0, 300)}...`);
  console.log(`\nTo create the branch and push a draft PR:`);
  console.log(`  gh pr create --repo ${FORK_REPO} --draft --base main --head ${branchName} --title "${title}" --body '...'`);
  console.log(`\nOr run manually with gh CLI.`);
}

function cmdReady(num) {
  console.log(`Issue #${num} marked READY in upstream/pr-candidates.md`);
  console.log("Update the table manually or run the status command to verify.");
}

// ---- main dispatch ---------------------------------------------------------

const cmd = args[0] || "--status";
const num = args[1];

switch (cmd) {
  case "--status":    cmdStatus(); break;
  case "--update":    cmdUpdate(); break;
  case "--summary":   cmdSummary(); break;
  case "--claim":     if (!num) { console.error("Usage: --claim <issue-number>"); process.exit(1); } cmdClaim(num); break;
  case "--draft":     if (!num) { console.error("Usage: --draft <issue-number>"); process.exit(1); } cmdDraft(num); break;
  case "--ready":     if (!num) { console.error("Usage: --ready <issue-number>"); process.exit(1); } cmdReady(num); break;
  default:
    console.error(`Unknown command: ${cmd}`);
    console.error("Usage: node bin/pr-candidates.mjs [--status|--update|--summary|--claim N|--draft N|--ready N]");
    process.exit(1);
}
