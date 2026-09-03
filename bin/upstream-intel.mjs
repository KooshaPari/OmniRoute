#!/usr/bin/env node
// bin/upstream-intel.mjs
//
// W1.10 — Daily upstream intelligence gather for the fork.
//
// Fetches the open issues + open PRs from diegosouzapw/OmniRoute (upstream)
// into ./upstream/ as JSON + a digest.md, so the fork maintainer can see
// what's happening upstream at a glance without leaving the working tree.
//
// Usage:
//   node bin/upstream-intel.mjs                 # all pages, default 100/page
//   node bin/upstream-intel.mjs --tier1         # filter to Tier-1 PR candidates
//   node bin/upstream-intel.mjs --since 7d      # only show items updated in the last 7 days
//   GITHUB_TOKEN=$(gh auth token) node bin/upstream-intel.mjs   # authenticated (higher rate limit)
//
// Exit code 0 on success, 1 on any error (so the daily cron can flag failures).

import { mkdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";

const REPO = "diegosouzapw/OmniRoute";
const OUT_DIR = "upstream";
const PER_PAGE = 100;

const args = process.argv.slice(2);
const tier1Only = args.includes("--tier1");
const sinceArg = args.find((a) => a.startsWith("--since="));
const SINCE = sinceArg ? sinceArg.split("=")[1] : null;

const SINCE_DATE = SINCE ? parseSince(SINCE) : null;

if (SINCE && !SINCE_DATE) {
  console.error(`Could not parse --since=${SINCE} (expected like 7d, 24h, 30d, 2026-08-01)`);
  process.exit(1);
}

function parseSince(s) {
  const m = /^(\d+)([hdwm])$/.exec(s);
  if (m) {
    const n = parseInt(m[1], 10);
    const unit = { h: 3600_000, d: 86400_000, w: 7 * 86400_000, m: 30 * 86400_000 }[m[2]];
    return new Date(Date.now() - n * unit);
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function ghFetch(path, params = {}) {
  const url = new URL(`https://api.github.com/repos/${REPO}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const headers = {
    "Accept": "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
    "User-Agent": "omniroute-fork-upstream-intel/1.0",
  };
  if (process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;

  const res = await fetch(url, { headers });
  if (!res.ok) {
    throw new Error(`GitHub API ${res.status} ${res.statusText} on ${path}`);
  }
  return res.json();
}

async function fetchAllPages(path, params) {
  const all = [];
  for (let page = 1; page <= 5; page++) {
    const batch = await ghFetch(path, { ...params, page, per_page: PER_PAGE });
    if (!Array.isArray(batch) || batch.length === 0) break;
    all.push(...batch);
    if (batch.length < PER_PAGE) break;
  }
  return all;
}

function labelTier(item) {
  const labels = (item.labels || []).map((l) => l.name);
  if (labels.includes("documentation") || labels.includes("help wanted") || labels.includes("dependencies")) {
    return "Tier 1";
  }
  if (labels.includes("acknowledged") || labels.includes("bug")) {
    return "Tier 2";
  }
  if (labels.includes("base-red") || labels.includes("keep-open") || labels.includes("quality-gate-finding")) {
    return "Tier 3";
  }
  if (labels.includes("question")) return "Tier 4 (question)";
  if (labels.includes("enhancement")) return "Tier 5 (enhancement)";
  return "Unclassified";
}

function withinSince(item) {
  if (!SINCE_DATE) return true;
  return new Date(item.updated_at) >= SINCE_DATE;
}

async function main() {
  await mkdir(join(OUT_DIR, "issues"), { recursive: true });
  await mkdir(join(OUT_DIR, "prs"), { recursive: true });

  console.log(`Fetching upstream open issues from ${REPO}…`);
  const issues = await fetchAllPages("issues", { state: "open" });
  console.log(`  → ${issues.length} open issues`);

  console.log(`Fetching upstream open PRs from ${REPO}…`);
  const prs = await fetchAllPages("pulls", { state: "open" });
  console.log(`  → ${prs.length} open PRs`);

  const stamp = new Date().toISOString().replace(/[:.]/g, "-");
  await writeFile(
    join(OUT_DIR, "issues", `${stamp}.json`),
    JSON.stringify(issues, null, 2)
  );
  await writeFile(
    join(OUT_DIR, "prs", `${stamp}.json`),
    JSON.stringify(prs, null, 2)
  );
  await writeFile(
    join(OUT_DIR, "issues-latest.json"),
    JSON.stringify(issues, null, 2)
  );
  await writeFile(
    join(OUT_DIR, "prs-latest.json"),
    JSON.stringify(prs, null, 2)
  );

  // Tier 1 PR candidates (for the W10.07 pipeline).
  const tier1Issues = issues
    .filter((i) => labelTier(i) === "Tier 1")
    .filter(withinSince)
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
  await writeFile(
    join(OUT_DIR, "tier1-issues.json"),
    JSON.stringify(tier1Issues, null, 2)
  );
  console.log(`  → ${tier1Issues.length} Tier-1 issues${SINCE ? ` (since ${SINCE})` : ""}`);

  // Markdown digest.
  const digest = [];
  digest.push(`# Upstream Digest — ${new Date().toUTCString()}`);
  digest.push("");
  digest.push(`Repo: **${REPO}**`);
  digest.push(`Issues open: ${issues.length}  ·  PRs open: ${prs.length}`);
  if (SINCE) digest.push(`Filter: updated since ${SINCE_DATE.toISOString()}`);
  digest.push("");
  digest.push(`## Tier 1 (fastest merges)${SINCE ? ` — updated in last ${SINCE}` : ""}`);
  digest.push("");
  if (tier1Issues.length === 0) {
    digest.push("_None._");
  } else {
    digest.push("| # | Title | Labels | Updated |");
    digest.push("|---|-------|--------|---------|");
    for (const i of tier1Issues.slice(0, 25)) {
      const labels = i.labels.map((l) => `\`${l.name}\``).join(", ");
      digest.push(`| [#${i.number}](${i.html_url}) | ${i.title.replace(/\|/g, "\\|")} | ${labels} | ${i.updated_at.slice(0, 10)} |`);
    }
  }
  digest.push("");
  digest.push("## Top 10 most-recently-active open issues");
  digest.push("");
  const recent = issues
    .slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 10);
  digest.push("| # | Title | Tier | Updated |");
  digest.push("|---|-------|------|---------|");
  for (const i of recent) {
    digest.push(`| [#${i.number}](${i.html_url}) | ${i.title.replace(/\|/g, "\\|").slice(0, 80)} | ${labelTier(i)} | ${i.updated_at.slice(0, 10)} |`);
  }
  digest.push("");
  digest.push("## Open PRs (most recently updated)");
  digest.push("");
  const recentPrs = prs
    .slice()
    .sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at))
    .slice(0, 15);
  digest.push("| # | Title | Draft | Updated |");
  digest.push("|---|-------|-------|---------|");
  for (const p of recentPrs) {
    digest.push(`| [#${p.number}](${p.html_url}) | ${p.title.replace(/\|/g, "\\|").slice(0, 80)} | ${p.draft ? "yes" : "no"} | ${p.updated_at.slice(0, 10)} |`);
  }
  digest.push("");
  digest.push("---");
  digest.push("");
  digest.push(`_Generated by \`bin/upstream-intel.mjs\` at ${new Date().toISOString()}._`);

  const digestPath = join(OUT_DIR, "digest.md");
  await writeFile(digestPath, digest.join("\n"));
  console.log(`Wrote digest → ${digestPath}`);

  if (tier1Only) {
    console.log(`\n--- Tier 1 issue summary ---`);
    for (const i of tier1Issues.slice(0, 20)) {
      console.log(`  #${i.number}  ${i.title}  [${i.labels.map((l) => l.name).join(", ")}]`);
    }
  }
}

main().catch((e) => {
  console.error(e.message);
  process.exit(1);
});
