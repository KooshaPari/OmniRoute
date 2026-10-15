#!/usr/bin/env node
// scripts/check/check-resurrection-patterns.mjs
//
// Detects verbatim re-adds of files that were previously deleted on main.
//
// Background (KI-026, 2026-10-15): The OmniRoute Q5 128-file untracked
// spike included 61 Electron/Electrobun files that were a verbatim
// resurrection of code deleted 25 days earlier across 5 separate
// removal commits. The resurrection was byte-for-byte identical to
// the deleted content, and the original 4 KB → 1.7 MB bulk re-author
// happened in a 1-second window (2026-10-13 17:52:59-17:53:00).
//
// This check prevents that recurrence by comparing the content hash
// of any newly-added file (untracked, staged, or in a PR diff) against
// a deletion set built from the last N months of main.
//
// Algorithm:
//   1. Walk `git log --diff-filter=D --name-only` for main in the
//      last N months. For each deleted file, store (path → sha256 of
//      content at deletion-commit^). Duplicate paths are deduped by
//      keeping the most recent deletion (a file deleted twice should
//      be resurrection-checked against its latest removal).
//   2. Enumerate candidate new files:
//        - untracked (git ls-files --others --exclude-standard)
//        - staged-added (git diff --cached --diff-filter=A --name-only)
//        - PR diff (when --pr-base <ref> is provided)
//      Optional `--working-tree-only` mode restricts to untracked +
//      staged (skips the --pr-base path).
//   3. For each candidate file, hash its current content (or the
//      pre-image when comparing pre/post) and look it up in the
//      deletion set. Matches are reported as resurrections.
//   4. Allowlist (`config/quality/resurrection-allowlist.json`):
//      per-path glob patterns that are permitted even on hash match.
//      Used for shared monorepo modules that legitimately exist in
//      multiple package sub-trees (e.g. a contract schema mirrored
//      in `contracts/` and `packages/sdk/src/contracts/`).
//
// Exit codes:
//   0 = no resurrections detected (or all matches are allowlisted)
//   1 = one or more resurrections detected; details printed to stderr
//   2 = invocation error (missing git, missing allowlist, etc.)
//
// Usage:
//   bun scripts/check/check-resurrection-patterns.mjs            # check all
//   bun scripts/check/check-resurrection-patterns.mjs --working-tree-only
//   bun scripts/check/check-resurrection-patterns.mjs --since 6.months
//   bun scripts/check/check-resurrection-patterns.mjs --since 12.months --json
//   bun scripts/check/check-resurrection-patterns.mjs --tracked  # current main
//   bun scripts/check/check-resurrection-patterns.mjs --historical-scan  # full audit
//
// --tracked: enumerate tracked files (git ls-files) instead of untracked.
//   Catches resurrections that have ALREADY landed on main (historical
//   bug audit). Combined with --since 10.years this is a one-time full
//   audit. Default --working-tree-only mode is for the pre-commit loop.
//
// --historical-scan: shorthand for --tracked --since 100.years.
//   Walks ALL of main's history and ALL tracked files; reports any file
//   on HEAD whose content is byte-for-byte identical to a previous
//   deletion. Slow (~1 min for 3k tracked files) but read-only.
//
// --staged-only: judge ONLY files staged for the current commit (git
//   diff --cached --diff-filter=A); skip untracked. Intended for the
//   pre-commit hook, where the working tree may hold unrelated operator
//   evidence that must not gate the commit. Ignored when --pr-base or
//   --tracked/--historical-scan is set (those modes use the PR diff or
//   git ls-files, not staged contents).
//
// Performance: deletion-set build is O(history × files-per-commit) but
// bounded by `--since`. New-file hashing is O(1) per file via
// `git cat-file --batch`. For a 2-year-old repo with default 6-month
// window, the deletion set is typically 1k-5k entries (<1 MB).

import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, existsSync, statSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ALLOWLIST_PATH = path.join(ROOT, "config/quality/resurrection-allowlist.json");

// --- argv parsing --------------------------------------------------------

const args = process.argv.slice(2);
function flag(name, fallback = null) {
  const i = args.indexOf(name);
  if (i === -1 || i + 1 >= args.length) return fallback;
  return args[i + 1];
}
function boolFlag(name) {
  return args.includes(name);
}

const SINCE = flag("--since", "6.months"); // matches git log's relative format
const WORKING_TREE_ONLY = boolFlag("--working-tree-only");
const STAGED_ONLY = boolFlag("--staged-only");
const TRACKED = boolFlag("--tracked");
const HISTORICAL_SCAN = boolFlag("--historical-scan");
const PR_BASE = flag("--pr-base", null);
const JSON_OUTPUT = boolFlag("--json");
const VERBOSE = boolFlag("--verbose") || boolFlag("-v");

// --historical-scan is shorthand for --tracked --since 100.years
// (we use 100.years as a sentinel "all of main" value)
const EFFECTIVE_SINCE = HISTORICAL_SCAN ? "100.years" : SINCE;
const EFFECTIVE_TRACKED = HISTORICAL_SCAN || TRACKED;
const SKIP_SINCE = HISTORICAL_SCAN; // when true, omit --since entirely (all of main)

// --- allowlist -----------------------------------------------------------

function loadAllowlist() {
  if (!existsSync(ALLOWLIST_PATH)) {
    if (VERBOSE)
      console.error(`[resurrection] no allowlist at ${ALLOWLIST_PATH}; treating as empty`);
    return { allow: [], reason: {} };
  }
  try {
    const parsed = JSON.parse(readFileSync(ALLOWLIST_PATH, "utf8"));
    return {
      allow: Array.isArray(parsed.allow) ? parsed.allow : [],
      reason: parsed.reason || {},
    };
  } catch (err) {
    console.error(`[resurrection] failed to parse ${ALLOWLIST_PATH}: ${err.message}`);
    process.exit(2);
  }
}

const ALLOWLIST = loadAllowlist();
function isAllowlisted(filepath) {
  for (const pattern of ALLOWLIST.allow) {
    // tiny glob: ** and * support, no extglob
    const re = new RegExp(
      "^" +
        pattern
          .replace(/[.+^${}()|[\]\\]/g, "\\$&")
          .replace(/\*\*/g, "::DOUBLESTAR::")
          .replace(/\*/g, "[^/]*")
          .replace(/::DOUBLESTAR::/g, ".*") +
        "$"
    );
    if (re.test(filepath)) return { matched: pattern, reason: ALLOWLIST.reason[pattern] || null };
  }
  return null;
}

// --- git helpers ---------------------------------------------------------

function git(...args) {
  // maxBuffer: 64 MiB. The default 1 MiB is too small for `git log
  // --diff-filter=D --name-only` on a long-lived repo with many
  // deletions (e.g. Tracera, observed ENOBUFS 2026-10-15 on its
  // first scan). 64 MiB comfortably covers a 6-month window even
  // on a busy monorepo.
  return execFileSync("git", args, {
    cwd: ROOT,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
    maxBuffer: 64 * 1024 * 1024,
  });
}

function gitOrNull(...args) {
  try {
    return git(...args);
  } catch (err) {
    return null;
  }
}

// hash a file's current content
function hashFile(filepath) {
  try {
    const full = path.join(ROOT, filepath);
    const stat = statSync(full);
    if (!stat.isFile()) return null;
    // Skip 0-byte files: they all hash to the same value, producing
    // false-positive matches against any deleted empty file. Most
    // .gitkeep / placeholder files are 0 bytes.
    if (stat.size === 0) return null;
    const buf = readFileSync(full);
    return createHash("sha256").update(buf).digest("hex");
  } catch (err) {
    if (VERBOSE) console.error(`[resurrection] hash failed for ${filepath}: ${err.message}`);
    return null;
  }
}

// hash a file's content at a specific git revision
function hashAtRev(rev, filepath) {
  const blob = gitOrNull("show", `${rev}:${filepath}`);
  if (blob === null) return null;
  return createHash("sha256").update(blob).digest("hex");
}

// --- step 1: build deletion set -----------------------------------------

// Returns Map<path, { hash, deletedAt, commit, message }>
// Only includes paths whose content hash can be computed at deletion^.
function buildDeletionSet() {
  // git log --diff-filter=D --name-only --pretty=format:'COMMIT:%H %ci%nSUBJECT:%s'
  // produces a parseable stream. We accumulate per-commit deletions.
  // when --historical-scan is set, omit --since entirely to walk ALL of main
  const logArgs = ["log", "main"];
  if (!SKIP_SINCE) logArgs.push(`--since=${EFFECTIVE_SINCE}`);
  logArgs.push(
    "--diff-filter=D",
    "--name-only",
    "--pretty=format:COMMIT:%H	%ci	%s"
  );
  const raw = git(...logArgs);
  if (!raw.trim()) return new Map();

  const map = new Map();
  const lines = raw.split("\n");
  let current = null;
  for (const line of lines) {
    if (line.startsWith("COMMIT:")) {
      const rest = line.slice("COMMIT:".length);
      const [hash, date, ...subjectParts] = rest.split("\t");
      current = { hash, date, message: subjectParts.join("\t") };
    } else if (line.trim() && current) {
      const filepath = line.trim();
      // hash the content at the parent (pre-deletion) revision
      const parent = `${current.hash}^`;
      const hash = hashAtRev(parent, filepath);
      if (!hash) continue;
      // Skip 0-byte (empty) files: they all hash to the same value
      // (e3b0c44298fc... = SHA-256 of empty input). Including them
      // produces 100+ false-positive matches on every .gitkeep /
      // placeholder file. Sub-cat C/empty fix (2026-10-15).
      const isEmptyHash = hash === "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
      if (isEmptyHash) continue;
      // only keep the most recent deletion per path
      const prev = map.get(filepath);
      if (!prev || prev.deletedAt < current.date) {
        map.set(filepath, {
          hash,
          deletedAt: current.date,
          commit: current.hash,
          message: current.message,
        });
      }
    }
  }
  if (VERBOSE) console.error(`[resurrection] deletion set: ${map.size} entries from last ${EFFECTIVE_SINCE}`);
  return map;
}

// --- step 2: enumerate new files ----------------------------------------

function listUntracked() {
  const raw = git("ls-files", "--others", "--exclude-standard");
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listTracked() {
  const raw = git("ls-files");
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listStagedAdded() {
  const raw = git("diff", "--cached", "--diff-filter=A", "--name-only");
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function listPRAdded(base) {
  // three-dot diff: committed on this branch since base
  const raw = git("diff", "--name-only", "--diff-filter=A", `${base}...HEAD`);
  return raw
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);
}

function gatherCandidates() {
  if (PR_BASE) {
    const pr = listPRAdded(PR_BASE);
    return { candidates: pr, source: `pr-base ${PR_BASE}` };
  }
  if (EFFECTIVE_TRACKED) {
    const tracked = listTracked();
    return { candidates: tracked, source: "tracked files (historical scan)" };
  }
  const untracked = STAGED_ONLY ? [] : listUntracked();
  const staged = WORKING_TREE_ONLY || STAGED_ONLY || !PR_BASE ? listStagedAdded() : [];
  const merged = Array.from(new Set([...untracked, ...staged])).sort();
  const source = STAGED_ONLY
    ? "staged only"
    : WORKING_TREE_ONLY
      ? "working tree"
      : "working tree + PR";
  return { candidates: merged, source };
}

// --- step 3: check for resurrection -------------------------------------

function check(deletionSet, candidates) {
  const matches = [];
  for (const filepath of candidates) {
    const currentHash = hashFile(filepath);
    if (!currentHash) continue;
    for (const [deletionPath, entry] of deletionSet) {
      if (entry.hash === currentHash) {
        const allow = isAllowlisted(filepath);
        matches.push({
          newPath: filepath,
          deletedPath: deletionPath,
          deletedAt: entry.deletedAt,
          deletionCommit: entry.commit,
          deletionMessage: entry.message,
          hash: currentHash,
          allowlisted: !!allow,
          allowlistPattern: allow ? allow.matched : null,
          allowlistReason: allow ? allow.reason : null,
        });
        break; // one match per new file is enough
      }
    }
  }
  return matches;
}

// --- main ----------------------------------------------------------------

const deletionSet = buildDeletionSet();
const { candidates, source } = gatherCandidates();
if (VERBOSE)
  console.error(`[resurrection] scanning ${candidates.length} new files (source: ${source})`);

const matches = check(deletionSet, candidates);
const allowlisted = matches.filter((m) => m.allowlisted);
const real = matches.filter((m) => !m.allowlisted);

if (JSON_OUTPUT) {
  console.log(
    JSON.stringify(
      {
        source,
        candidatesScanned: candidates.length,
        deletionSetSize: deletionSet.size,
        matchesTotal: matches.length,
        matchesAllowlisted: allowlisted.length,
        matchesReal: real.length,
        since: EFFECTIVE_SINCE,
        scanMode: EFFECTIVE_TRACKED ? "tracked" : "untracked",
        matches: matches.map((m) => ({
          newPath: m.newPath,
          deletedPath: m.deletedPath,
          deletedAt: m.deletedAt,
          deletionCommit: m.deletionCommit,
          deletionMessage: m.deletionMessage,
          allowlisted: m.allowlisted,
          allowlistPattern: m.allowlistPattern,
          allowlistReason: m.allowlistReason,
        })),
      },
      null,
      2
    )
  );
} else {
  for (const m of matches) {
    const tag = m.allowlisted ? "ALLOWLISTED" : "RESURRECTED";
    console.error(
      `[${tag}] ${m.newPath}\n` +
        `          matches deletion of ${m.deletedPath}\n` +
        `          deleted at ${m.deletedAt} in ${m.deletionCommit.slice(0, 7)}\n` +
        `          message: ${m.deletionMessage.slice(0, 80)}\n` +
        (m.allowlisted
          ? `          allowlist: ${m.allowlistPattern}${m.allowlistReason ? ` — ${m.allowlistReason}` : ""}\n`
          : "")
    );
  }
}

if (real.length > 0) {
  console.error(
    `\n[resurrection] ${real.length} unallowlisted resurrection(s) detected (${allowlisted.length} allowlisted)`
  );
  process.exit(1);
}

console.log(
  JSON_OUTPUT
    ? ""
    : `[resurrection] OK — scanned ${candidates.length} new file(s) against ${deletionSet.size} deletion(s); no resurrections`
);

// Note: --historical-scan may produce a non-trivial result count on
// long-lived repos; allowlist handling is the same. The scan is
// read-only and never auto-fixes.
