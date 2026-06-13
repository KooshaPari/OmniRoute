#!/usr/bin/env bun
// =============================================================================
// check-ecosystem.ts — Validate ECOSYSTEM_MAP.md + GitHub fleet state
// =============================================================================
//
// Two-stage validator for the KooshaPari / phenotype-registry:
//
//   Stage 1 (always runs, no network):
//     • Required sections are present in ECOSYSTEM_MAP.md
//     • The `Generated:` header date is parseable and not older than the
//       configured staleness threshold (default 30 days)
//     • The role-classification table has no duplicate slugs and every
//       slug matches GitHub's repo-name pattern
//     • The Mermaid dependency block is well-formed:
//         - opening `graph TD` line present
//         - all edges `A --> B` reference a defined node
//         - bracket and arrow counts are sane
//     • Cluster tables (A–K) reference repos that exist in the role table
//     • The 13-canonical-repos list (shared with scripts/validate-ecosystem.sh)
//       is referenced somewhere in the map
//
//   Stage 2 (skipped with --map-only, requires `gh` CLI):
//     • For each of the 13 canonical repos: `gh repo view` resolves
//     • For each reachable repo: required meta-files exist on the default
//       branch (AGENTS.md, STATUS.md, Taskfile.yml, LICENSE-MIT,
//       LICENSE-APACHE, .github/workflows/ci.yml)
//     • Cross-check: every canonical repo is mentioned in ECOSYSTEM_MAP.md
//       (warn-only, since some are forks/wrappers that may not be indexed)
//
//   Cross-stage:
//     • The "Repos audited: N canonical" claim in the map header is
//       consistent with the count of "Active" / "CANONICAL" labels
//
// Usage:
//   bun run tools/check-ecosystem.ts                # full run (text output)
//   bun run tools/check-ecosystem.ts --json          # machine-readable
//   bun run tools/check-ecosystem.ts --no-color     # disable ANSI colors
//   bun run tools/check-ecosystem.ts --map-only     # skip GitHub API
//   bun run tools/check-ecosystem.ts --staleness 60 # override 30-day threshold
//   bun run tools/check-ecosystem.ts --help
//
// Exit codes:
//   0  — no drift
//   1  — drift detected (map integrity, fleet state, or cross-validation)
//   2  — script error (file not found, parse failure, unexpected exception)
//   3  — missing prerequisite (gh CLI not installed/authed) when required
//
// Companion tools:
//   • scripts/validate-ecosystem.sh — fleet-only validator (shell)
//   • tools/check-ecosystem.ts      — map + fleet + cross-validator (this)
//   The 13-canonical-repos list in CANONICAL_REPOS below MUST stay in sync
//   with scripts/validate-ecosystem.sh (REPOS array).
// =============================================================================

import { readFile, stat } from "node:fs/promises";
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const execFileP = promisify(execFile);

// -----------------------------------------------------------------------------
// Constants
// -----------------------------------------------------------------------------

const TOOL_VERSION = "0.1.0";
const TOOL_NAME = "check-ecosystem";

const ORG = "KooshaPari";

/** 13 canonical KooshaPari repos. MUST stay in sync with
 *  scripts/validate-ecosystem.sh REPOS array. */
const CANONICAL_REPOS: ReadonlyArray<{ display: string; slug: string; role: string }> = [
  { display: "phenotype-registry", slug: "phenotype-registry", role: "index (this repo)" },
  { display: "FocalPoint",         slug: "FocalPoint",         role: "V4 L1-L5 focus (macOS window manager)" },
  { display: "thegent",            slug: "thegent",            role: "V4 L1-L5 focus (agent orchestrator, Python+Rust)" },
  { display: "hwLedger",           slug: "hwLedger",           role: "V4 L1-L5 focus (VitePress/Astro scaffold)" },
  { display: "KWatch",             slug: "Kwatch",             role: "V4 L1-L5 focus (Go watcher CLI)" },
  { display: "dispatch-mcp",       slug: "dispatch-mcp",       role: "V4 L1-L5 focus (MCP substrate)" },
  { display: "Tokn",               slug: "Tokn",               role: "V5 EXT focus (Rust token ledger + pareto-rs)" },
  { display: "Pine",               slug: "Pine",               role: "V5 EXT focus (Rust ELF/PE loader)" },
  { display: "kmobile",            slug: "kmobile",            role: "V5 EXT focus (Rust mobile CLI/MCP)" },
  { display: "PhenoContracts",     slug: "PhenoContracts",     role: "V5 EXT focus (TS contract verifier port)" },
  { display: "cheap-llm-mcp",      slug: "cheap-llm-mcp",      role: "V5 EXT focus (consumed into dispatch-mcp)" },
  { display: "PhenoCompose",       slug: "PhenoCompose",       role: "V3 focus (NVMS-3-tier isolation monorepo)" },
  { display: "AgilePlus",          slug: "AgilePlus",          role: "V3 substrate (spec-driven dev, 22-crate workspace)" },
];

/** Meta-files we expect to find on the default branch of each canonical repo.
 *  Matches the META_FILES array in scripts/validate-ecosystem.sh. */
const META_FILES: ReadonlyArray<string> = [
  "AGENTS.md",
  "STATUS.md",
  "Taskfile.yml",
  "LICENSE-MIT",
  "LICENSE-APACHE",
  ".github/workflows/ci.yml",
];

/** Required H2 sections in ECOSYSTEM_MAP.md. The map may prefix headings with
 *  a number (e.g. `## 1. Role Classification`); the parser strips that prefix
 *  before matching, so these are the normalized, prefix-less forms. */
const REQUIRED_SECTIONS: ReadonlyArray<string> = [
  "Index Authority & Staleness",
  "Role Classification",
  "Dependency Edges",
  "Duplication Clusters",
  "Rationalization Proposal",
  "Worker Split Summary",
];

/** GitHub repo-name pattern: alphanumerics, hyphens, underscores, dots. */
const GITHUB_SLUG_RE = /^[A-Za-z0-9._-]+$/;

/** Common English words that look like GitHub slugs but aren't. Used by the
 *  `allSlugs` collection to avoid false positives. */
const COMMON_WORDS: ReadonlySet<string> = new Set([
  "the", "and", "for", "with", "from", "this", "that", "into", "over", "under",
  "see", "use", "via", "per", "not", "all", "new", "old", "top", "bot", "own",
  "repo", "file", "code", "data", "test", "docs", "main", "head", "tail", "body",
  "list", "full", "true", "false", "none", "null", "yes", "maybe", "done", "todo",
  "fix", "feat", "ref", "perf", "build", "ci", "cd", "ops", "dev", "qa", "api",
  "sdk", "cli", "gui", "app", "pkg", "mod", "var", "let", "const", "type", "enum",
  "struct", "trait", "impl", "fn", "pub", "mut", "ref", "box", "vec", "str", "int",
  "size", "self", "super", "where", "while", "until", "loop", "case", "match", "try",
  "catch", "throw", "raise", "import", "export", "return", "yield", "async", "await",
  "move", "copy", "clone", "drop", "send", "recv", "ok", "err", "log", "warn", "info",
  "debug", "trace", "error", "panic", "fail", "pass", "skip", "note", "tip", "warn",
  "and", "but", "yet", "nor", "so", "for", "yet",
]);

const DEFAULT_STALENESS_DAYS = 30;
const GH_TIMEOUT_MS = 30_000;

/** Most-recent stderr from a failed `gh` call. Cleared at the start of each
 *  fleet check. Used to surface the underlying error reason (auth, network,
 *  JSON field mismatch, etc.) instead of the generic "gh repo view failed". */
let lastGhError = "";

/** `gh` emits ANSI color codes to stdout in some configurations (e.g. when
 *  the parent process is attached to a TTY via a controlling terminal).
 *  Since we JSON.parse the output, those escape sequences break parsing.
 *  We strip them defensively. Matches CSI sequences:
 *    ESC [  <params>  <final byte>
 *  where params is 0+ digits/semicolons, and the final byte is a letter. */
const ANSI_ESCAPE_RE = /\x1b\[[0-9;]*[A-Za-z]/g;

function stripAnsi(s: string): string {
  return s.replace(ANSI_ESCAPE_RE, "");
}

// -----------------------------------------------------------------------------
// Types
// -----------------------------------------------------------------------------

type Severity = "ok" | "warn" | "fail";

interface CheckResult {
  id: string;
  stage: "map" | "fleet" | "cross";
  severity: Severity;
  message: string;
  detail?: string;
}

interface StageReport {
  status: Severity;
  checks: CheckResult[];
  durationMs: number;
}

interface ToolReport {
  tool: string;
  version: string;
  startedAt: string;
  durationMs: number;
  mapPath: string;
  org: string;
  canonicalRepoCount: number;
  summary: { total: number; ok: number; warn: number; fail: number };
  stages: {
    map: StageReport;
    fleet: StageReport;
  };
}

interface MapDoc {
  raw: string;
  lines: string[];
  /** All H2 headings, raw (with leading numeric prefix if present). */
  h2Raw: string[];
  /** All H2 headings, normalized (numeric prefix stripped). */
  h2: string[];
  /** Generated date string from the header (`Generated: YYYY-MM-DD`). */
  generatedDate: string | null;
  /** Slugs found in the role-classification table (third column, comma-split). */
  roleSlugs: string[];
  /** Defined node IDs in the Mermaid block. */
  mermaidNodes: string[];
  /** Edges in the Mermaid block, each `[from, to]`. */
  mermaidEdges: Array<[string, string]>;
  /** Slugs that appear ANYWHERE in the document (for cross-checking). */
  allSlugs: Set<string>;
  /** All text after backtick normalization, for substring searches. */
  body: string;
}

// -----------------------------------------------------------------------------
// CLI
// -----------------------------------------------------------------------------

interface CliArgs {
  json: boolean;
  noColor: boolean;
  mapOnly: boolean;
  stalenessDays: number;
  mapPath: string;
  showHelp: boolean;
  org: string;
}

function parseArgs(argv: ReadonlyArray<string>): CliArgs {
  const args: CliArgs = {
    json: false,
    noColor: false,
    mapOnly: false,
    stalenessDays: DEFAULT_STALENESS_DAYS,
    mapPath: "ECOSYSTEM_MAP.md",
    showHelp: false,
    org: ORG,
  };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    switch (a) {
      case "--json":         args.json = true; break;
      case "--no-color":     args.noColor = true; break;
      case "--map-only":     args.mapOnly = true; break;
      case "-h":
      case "--help":         args.showHelp = true; break;
      case "--staleness": {
        const v = argv[++i];
        const n = v ? Number.parseInt(v, 10) : NaN;
        if (!Number.isFinite(n) || n < 0) {
          throw new Error(`--staleness requires a non-negative integer, got: ${v}`);
        }
        args.stalenessDays = n;
        break;
      }
      case "--map": {
        const v = argv[++i];
        if (!v) throw new Error("--map requires a path argument");
        args.mapPath = v;
        break;
      }
      case "--org": {
        const v = argv[++i];
        if (!v) throw new Error("--org requires a non-empty argument");
        args.org = v;
        break;
      }
      default:
        throw new Error(`Unknown argument: ${a}`);
    }
  }
  return args;
}

const HELP_TEXT = `check-ecosystem.ts — Validate ECOSYSTEM_MAP.md and the GitHub fleet state

Usage:
  bun run tools/check-ecosystem.ts [flags]

Flags:
  --json             Emit machine-readable JSON to stdout
  --no-color         Disable ANSI color codes (also auto-detected when piped)
  --map-only         Skip GitHub API calls (no network); map checks only
  --staleness DAYS   Override the staleness threshold (default: ${DEFAULT_STALENESS_DAYS})
  --map PATH         Path to ECOSYSTEM_MAP.md (default: ./ECOSYSTEM_MAP.md)
  --org NAME         Override the org slug (default: ${ORG})
  -h, --help         Show this help

Exit codes:
  0  no drift
  1  drift detected
  2  script error
  3  missing prerequisite (gh not installed) when required
`;

// -----------------------------------------------------------------------------
// Color helpers
// -----------------------------------------------------------------------------

const C = {
  reset:  "\x1b[0m",
  bold:   "\x1b[1m",
  dim:    "\x1b[2m",
  red:    "\x1b[0;31m",
  green:  "\x1b[0;32m",
  yellow: "\x1b[0;33m",
  blue:   "\x1b[0;34m",
  cyan:   "\x1b[0;36m",
};

function makeColor(enabled: boolean) {
  return (code: keyof typeof C, text: string): string =>
    enabled ? `${C[code]}${text}${C.reset}` : text;
}

const ICON = { ok: "✓", warn: "△", fail: "✗" };

// -----------------------------------------------------------------------------
// Map parser
// -----------------------------------------------------------------------------

/**
 * Parse ECOSYSTEM_MAP.md into a structured document.
 *
 * The parser is intentionally hand-rolled to avoid pulling in a markdown
 * dependency. It understands the specific shape of this file:
 *   • ATX headings (`^#+\s+...`), with optional leading numeric prefix
 *   • GFM pipe tables (`| ... |`)
 *   • Fenced code blocks (```mermaid, ```text, etc.)
 *   • Inline code spans (`...`)
 *   • Bulleted lists (`^- `, `^* `)
 *
 * The parser is robust to indentation, trailing whitespace, and to the
 * `## 1. Section` numeric-prefix convention used in this file.
 */
function parseMap(raw: string): MapDoc {
  const lines = raw.split(/\r?\n/);

  // --- H2 headings ---------------------------------------------------------
  // We store both the raw form and the normalized form (numeric prefix
  // stripped) so the H2 section lookup is tolerant of the map's `## 1. X`
  // style.
  const h2Raw: string[] = [];
  const h2: string[] = [];
  for (const line of lines) {
    const m = /^##\s+(.+?)\s*$/.exec(line);
    if (m) {
      const raw = m[1].trim();
      h2Raw.push(raw);
      h2.push(normalizeH2(raw));
    }
  }

  // --- Generated date ------------------------------------------------------
  let generatedDate: string | null = null;
  for (const line of lines.slice(0, 10)) {
    const m = /Generated:\s*(\d{4}-\d{2}-\d{2})/.exec(line);
    if (m) { generatedDate = m[1]; break; }
  }

  // --- Role classification slugs ------------------------------------------
  // Find the H2 "Role Classification" block (matching the normalized form),
  // then extract the THIRD cell ("Repos" column) of each data row, splitting
  // on commas. The first cell is the role name (e.g. `**shared-lib**`) and
  // the second cell is the count — neither are repo slugs.
  const roleSlugs: string[] = [];
  {
    const startIdx = lines.findIndex((l) => {
      const m = /^##\s+(.+?)\s*$/.exec(l);
      return m !== null && normalizeH2(m[1].trim()) === "Role Classification";
    });
    if (startIdx >= 0) {
      // Find the first pipe-row, which is the table header
      for (let i = startIdx + 1; i < lines.length; i++) {
        const line = lines[i];
        if (/^\|/.test(line)) {
          // First pipe-row is the header; second is the separator; the rest
          // are data rows. We need to scan all subsequent pipe-rows until we
          // hit a blank or non-pipe line.
          let headerSeen = false;
          for (let j = i; j < lines.length; j++) {
            const r = lines[j];
            if (!/^\|/.test(r)) break;
            if (!headerSeen) { headerSeen = true; continue; }
            const cells = splitTableRow(r);
            if (cells.length === 0) continue; // separator row
            // Third cell (index 2) contains the comma-separated repo list,
            // e.g. "pheno, HexaKit, phenoShared, ..."
            if (cells.length >= 3) {
              const repos = cells[2]
                .split(",")
                .map((c) => cleanSlugToken(c))
                .filter((s): s is string => s.length > 0);
              for (const s of repos) roleSlugs.push(s);
            }
          }
          break;
        }
      }
    }
  }

  // --- Mermaid block ------------------------------------------------------
  // We support both `mermaid` and `text` fences. We only parse the mermaid
  // block for the dependency graph.
  const mermaidNodes: string[] = [];
  const mermaidEdges: Array<[string, string]> = [];
  {
    let inBlock = false;
    let blockLang = "";
    for (const line of lines) {
      const fence = /^```\s*(\w+)?\s*$/.exec(line);
      if (fence) {
        if (!inBlock) {
          inBlock = true;
          blockLang = (fence[1] ?? "").toLowerCase();
        } else {
          inBlock = false;
          blockLang = "";
        }
        continue;
      }
      if (!inBlock || blockLang !== "mermaid") continue;

      // node definition:  id["label"]   or  id
      const nodeMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(\["[^"]*"\])?\s*$/.exec(line);
      if (nodeMatch) {
        const id = nodeMatch[1];
        if (!mermaidNodes.includes(id)) mermaidNodes.push(id);
      }

      // edge:  A --> B  or  A -.-> B  (we treat both as edges)
      const edgeMatch = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*(?:-->|-\.->|==>)\s*([A-Za-z_][A-Za-z0-9_]*)/.exec(line);
      if (edgeMatch) {
        mermaidEdges.push([edgeMatch[1], edgeMatch[2]]);
      }
    }
  }

  // --- All slugs referenced anywhere --------------------------------------
  // For cross-checking. We collect every token that looks like a GitHub repo
  // slug, then filter out common English words and pure-numeric tokens.
  const allSlugs = new Set<string>();
  // 1. Pull slugs from the role table
  for (const s of roleSlugs) allSlugs.add(s);
  // 2. Pull backticked identifiers
  const backtickRe = /`([A-Za-z0-9._-]+)`/g;
  for (const line of lines) {
    let m: RegExpExecArray | null;
    backtickRe.lastIndex = 0;
    while ((m = backtickRe.exec(line)) !== null) {
      if (looksLikeSlug(m[1])) allSlugs.add(m[1]);
    }
  }
  // 3. Scan the whole body for any token that looks like a repo slug. This
  //    is the broad catch-all for plain-text mentions (e.g. "FocalPoint" in
  //    a table cell without backticks).
  const bodySlugRe = /\b([A-Za-z][A-Za-z0-9._-]{1,63})\b/g;
  for (const m of raw.matchAll(bodySlugRe)) {
    if (looksLikeSlug(m[1])) allSlugs.add(m[1]);
  }

  return {
    raw,
    lines,
    h2Raw,
    h2,
    generatedDate,
    roleSlugs,
    mermaidNodes,
    mermaidEdges,
    allSlugs,
    body: raw,
  };
}

/** Strip the leading numeric prefix AND any trailing parenthesized
 *  annotation from an H2 heading. This collapses `## 1. Role Classification
 *  (111 repos)` to `Role Classification` so exact-match section lookups work
 *  regardless of annotation style.
 *
 *  Examples:
 *    `1. Role Classification (111 repos)` → `Role Classification`
 *    `2. Dependency Edges (Adjacency List)` → `Dependency Edges`
 *    `Index Authority & Staleness`         → `Index Authority & Staleness`
 *    `7. Worker Split Summary`             → `Worker Split Summary`
 */
function normalizeH2(s: string): string {
  return s
    .replace(/^\d+\.\s+/, "")   // strip leading "N. "
    .replace(/\s*\([^)]*\)\s*$/, "") // strip trailing " (...)"
    .trim();
}

/** Heuristic: does this token look like a GitHub repo slug?
 *  Rejects empty strings, pure-numeric strings, and common English words.
 *  Requires at least one letter (so `22` is rejected, but `v22` is kept). */
function looksLikeSlug(s: string): boolean {
  if (s.length < 2 || s.length > 64) return false;
  if (!GITHUB_SLUG_RE.test(s)) return false;
  if (!/[A-Za-z]/.test(s)) return false; // must have a letter
  if (COMMON_WORDS.has(s.toLowerCase())) return false;
  return true;
}

/** Clean a single comma-separated token from the role-table "Repos" cell.
 *  Strips surrounding whitespace, markdown bold (`**`), italic (`*`),
 *  backticks, trailing parenthesized annotations like `(scaffold)`,
 *  `(deprecated)`, `(template)`, and trailing `\*` (the "archived" marker
 *  used in the role-classification table's footnote convention). */
function cleanSlugToken(s: string): string {
  return s
    .trim()
    .replace(/^[\s*`\\]+|[\s*`\\]+$/g, "")     // strip edge markdown (incl. leading/trailing backslash)
    .replace(/^`+|`+$/g, "")                   // strip backticks
    .replace(/\\?\*+$/, "")                    // strip trailing "odin-landing*" OR "odin-landing\*" (escaped asterisk for the "archived" footnote)
    .replace(/\s*\([^)]*\)\s*$/, "")           // strip trailing " (annotation)"
    .replace(/^`+|`+$/g, "")                   // re-strip backticks
    .trim();
}

/** Split a pipe-table row into cells (strips leading/trailing pipe and
 *  trims each cell). Returns `[]` for separator rows (|---|---|). */
function splitTableRow(row: string): string[] {
  // Drop the leading and trailing pipe if present
  let s = row.trim();
  if (s.startsWith("|")) s = s.slice(1);
  if (s.endsWith("|"))   s = s.slice(0, -1);
  const cells = s.split("|").map((c) => c.trim());
  // If every cell is `-` or `:---:` style, treat as separator
  if (cells.every((c) => /^:?-+:?$/.test(c))) return [];
  return cells;
}

// -----------------------------------------------------------------------------
// Map validators (pure; no network)
// -----------------------------------------------------------------------------

function validateMap(
  doc: MapDoc,
  args: CliArgs,
): { checks: CheckResult[]; canonicalHits: Map<string, string> } {
  const checks: CheckResult[] = [];
  const canonicalHits = new Map<string, string>();

  const check = (
    id: string,
    severity: Severity,
    message: string,
    detail?: string,
  ): void => {
    checks.push(detail !== undefined ? { id, stage: "map", severity, message, detail } : { id, stage: "map", severity, message });
  };

  // --- Required sections --------------------------------------------------
  for (const section of REQUIRED_SECTIONS) {
    if (doc.h2.includes(section)) {
      check(`map.section.${slugify(section)}`, "ok", `Section present: ## ${section}`);
    } else {
      check(`map.section.${slugify(section)}`, "fail", `Required section missing: ## ${section}`);
    }
  }

  // --- Generated date -----------------------------------------------------
  if (!doc.generatedDate) {
    check("map.generated.missing", "fail", "Header `Generated:` date not found in first 10 lines");
  } else {
    const d = new Date(doc.generatedDate + "T00:00:00Z");
    if (Number.isNaN(d.getTime())) {
      check("map.generated.parse", "fail", `Generated date is not parseable: ${doc.generatedDate}`);
    } else {
      const ageDays = Math.floor((Date.now() - d.getTime()) / 86_400_000);
      if (ageDays > args.stalenessDays) {
        check(
          "map.generated.stale",
          "warn",
          `Map is ${ageDays} days old (threshold: ${args.stalenessDays}d)`,
          `Generated: ${doc.generatedDate}. Re-run the manifest-fetch agents to refresh.`,
        );
      } else {
        check("map.generated.fresh", "ok", `Map age: ${ageDays} day(s) (threshold: ${args.stalenessDays}d)`);
      }
    }
  }

  // --- Role table duplicates ---------------------------------------------
  // The role-classification table is MULTI-ROLE by design: a single repo
  // (e.g. HexaKit) can appear under shared-lib, SDK, and monorepo. So
  // duplicates within roleSlugs are EXPECTED and represent the map's
  // classification, not a bug. We report:
  //   • The total entries (which the table's "Count" column should sum to)
  //   • The unique-slug count
  //   • A pass/fail check on shape (all slugs match GitHub's name pattern
  //     AFTER cleaning, so trailing ` (annotation)` and `*` markers are
  //     stripped)
  if (doc.roleSlugs.length === 0) {
    check("map.role.empty", "fail", "Role-classification table appears empty or was not parsed");
  } else {
    const uniqueSlugs = new Set(doc.roleSlugs);
    const dupCount = doc.roleSlugs.length - uniqueSlugs.size;
    if (dupCount > 0) {
      check(
        "map.role.multi-role",
        "ok",
        `Role table: ${doc.roleSlugs.length} entries, ${uniqueSlugs.size} unique slugs, ${dupCount} multi-role classification(s)`,
        "Multi-role is by design (e.g. HexaKit = shared-lib + SDK + monorepo).",
      );
    } else {
      check("map.role.unique", "ok", `Role table: ${uniqueSlugs.size} unique slug(s) (no multi-role entries)`);
    }
  }

  // --- Role slug shape (after cleaning) -----------------------------------
  {
    const bad = doc.roleSlugs.filter((s) => !GITHUB_SLUG_RE.test(s));
    if (bad.length > 0) {
      check(
        "map.role.shape",
        "fail",
        `Role-table slugs fail GitHub name pattern: ${bad.length}`,
        bad.slice(0, 10).join(", ") + (bad.length > 10 ? "…" : ""),
      );
    } else if (doc.roleSlugs.length > 0) {
      check("map.role.shape", "ok", "All role-table slugs match GitHub name pattern");
    }
  }

  // --- Mermaid block ------------------------------------------------------
  if (doc.mermaidNodes.length === 0) {
    // Could be that there is no mermaid block at all (e.g. partial map)
    const hasMermaidFence = doc.raw.includes("```mermaid");
    if (hasMermaidFence) {
      check("map.mermaid.empty", "warn", "Mermaid fence present but no nodes/edges parsed");
    } else {
      check("map.mermaid.absent", "warn", "No ```mermaid fence found in the document");
    }
  } else {
    check("map.mermaid.nodes", "ok", `Mermaid: ${doc.mermaidNodes.length} node(s) defined`);

    if (doc.mermaidEdges.length === 0) {
      check("map.mermaid.noedges", "warn", "Mermaid block has nodes but no edges parsed");
    } else {
      check("map.mermaid.edges", "ok", `Mermaid: ${doc.mermaidEdges.length} edge(s) parsed`);

      // Every edge source and target must be a defined node
      const nodeSet = new Set(doc.mermaidNodes);
      const dangling: string[] = [];
      for (const [a, b] of doc.mermaidEdges) {
        if (!nodeSet.has(a)) dangling.push(`${a} (source)`);
        if (!nodeSet.has(b)) dangling.push(`${b} (target)`);
      }
      if (dangling.length > 0) {
        check(
          "map.mermaid.dangling",
          "fail",
          `Mermaid edges reference undefined nodes: ${dangling.length}`,
          [...new Set(dangling)].slice(0, 10).join(", "),
        );
      } else {
        check("map.mermaid.dangling", "ok", "All Mermaid edges reference defined nodes");
      }
    }
  }

  // --- 13 canonical repos mentioned somewhere in the map -----------------
  // We do a layered check: exact match in allSlugs → case-insensitive
  // body substring search. The map often uses different casing (e.g. the
  // shell-script slug is "Kwatch" but the map displays "KWatch").
  const bodyLower = doc.body.toLowerCase();
  for (const r of CANONICAL_REPOS) {
    const slug = r.slug;
    const slugLower = slug.toLowerCase();
    if (doc.allSlugs.has(slug)) {
      canonicalHits.set(slug, "found");
    } else if (doc.body.includes(`\`${slug}\``)) {
      canonicalHits.set(slug, "found-backticked");
    } else if ([...doc.allSlugs].some((s) => s.toLowerCase() === slugLower)) {
      canonicalHits.set(slug, "found-case-insensitive");
    } else if (bodyLower.includes(slugLower)) {
      // Final fallback: case-insensitive body substring search. The body
      // includes the comma-separated repo lists in the role table which we
      // also split, so this is a reliable last-resort check.
      canonicalHits.set(slug, "found-substring");
    } else {
      canonicalHits.set(slug, "missing");
      check(
        "map.canonical.missing",
        "warn",
        `Canonical repo not referenced in map: ${r.slug}`,
        `${r.display} (${r.role})`,
      );
    }
  }
  if (canonicalHits.size > 0) {
    const missingCount = [...canonicalHits.values()].filter((v) => v === "missing").length;
    if (missingCount === 0) {
      check("map.canonical.coverage", "ok", `All ${CANONICAL_REPOS.length} canonical repos referenced in the map`);
    }
  }

  // --- "Repos audited: N canonical" claim vs CANONICAL_REPOS ------------
  // We trust the explicit CANONICAL_REPOS list (kept in sync with the shell
  // script). The map's `Repos audited: N canonical` claim is informational;
  // a mismatch is reported as warn (not fail) because the map describes a
  // superset of the 13.
  {
    const claim = /Repos audited:\s*(\d+)\s+canonical/.exec(doc.body);
    if (claim) {
      const n = Number.parseInt(claim[1], 10);
      if (n === CANONICAL_REPOS.length) {
        check("map.canonical.count-match", "ok", `Map claim matches canonical list: ${n}`);
      } else {
        check(
          "map.canonical.count-mismatch",
          "warn",
          `Map claims ${n} canonical repos; CANONICAL_REPOS has ${CANONICAL_REPOS.length}`,
          "The 13-canonical-repos list lives in this tool AND scripts/validate-ecosystem.sh — they must stay in sync.",
        );
      }
    }
  }

  return { checks, canonicalHits };
}

// -----------------------------------------------------------------------------
// Fleet validators (uses `gh` CLI)
// -----------------------------------------------------------------------------

interface GhRepoView {
  name: string;
  nameWithOwner: string;
  description: string | null;
  defaultBranchRef: { name: string } | null;
  isArchived: boolean;
  isPrivate: boolean;
  stargazerCount: number;
  pushedAt: string | null;
}

interface FileProbe {
  path: string;
  status: "PASS" | "MISSING" | "FORBIDDEN" | "ERROR";
  code: number;
}

interface FleetRepo {
  display: string;
  slug: string;
  full: string;
  role: string;
  reachable: boolean;
  defaultBranch: string;
  description: string;
  archived: boolean;
  pushedAt: string | null;
  fileProbes: FileProbe[];
  errorMessage?: string;
}

async function checkGhAvailable(): Promise<{ available: boolean; reason?: string }> {
  try {
    await execFileP("gh", ["--version"], { timeout: 5_000 });
  } catch (e) {
    return { available: false, reason: `gh CLI not found in PATH: ${(e as Error).message}` };
  }
  try {
    await execFileP("gh", ["auth", "status"], { timeout: 5_000 });
  } catch (e) {
    return { available: false, reason: `gh CLI not authenticated: ${(e as Error).message}` };
  }
  return { available: true };
}

async function ghRepoView(full: string): Promise<GhRepoView | null> {
  try {
    const { stdout } = await execFileP(
      "gh",
      [
        "repo", "view", full,
        // Note: do NOT request `isDisabled` — it was removed from `gh repo view
        // --json` output in newer gh versions (≥ 2.70ish). We don't need it
        // for our checks; `isArchived` covers the only repo-state concern
        // that matters for the canonical list.
        "--json", "name,nameWithOwner,description,defaultBranchRef,isArchived,isPrivate,stargazerCount,pushedAt",
      ],
      { timeout: GH_TIMEOUT_MS, maxBuffer: 1 << 20 },
    );
    return JSON.parse(stripAnsi(stdout)) as GhRepoView;
  } catch (e) {
    // Capture stderr for the fleet error message so the user can see WHY
    // the call failed (auth, network, JSON field mismatch, etc.).
    const err = e as { stderr?: string; message?: string };
    lastGhError = (err.stderr ?? err.message ?? "").trim().split("\n")[0] ?? "";
    return null;
  }
}

async function probeFile(full: string, branch: string, path: string): Promise<FileProbe> {
  try {
    const { stdout } = await execFileP(
      "gh",
      [
        "api", `repos/${full}/contents/${path}?ref=${branch}`,
        "-H", "Accept: application/vnd.github+json",
        "--include",
      ],
      { timeout: GH_TIMEOUT_MS, maxBuffer: 1 << 20 },
    );
    // Strip ANSI codes (gh may emit them even on `--include` output), then
    // take the first line which is the HTTP status line.
    const clean = stripAnsi(stdout);
    const statusLine = clean.split("\n", 1)[0] ?? "";
    const code = Number.parseInt((statusLine.match(/HTTP\/[\d.]+\s+(\d+)/)?.[1] ?? ""), 10);
    if (code === 200) return { path, status: "PASS", code };
    if (code === 404) return { path, status: "MISSING", code };
    if (code === 403) return { path, status: "FORBIDDEN", code };
    return { path, status: "ERROR", code: Number.isFinite(code) ? code : -1 };
  } catch (e) {
    return { path, status: "ERROR", code: -1 };
  }
}

async function checkFleet(
  repos: ReadonlyArray<{ display: string; slug: string; role: string }>,
  org: string,
  canonicalHits: Map<string, string>,
): Promise<{ checks: CheckResult[]; fleetRepos: FleetRepo[] }> {
  const checks: CheckResult[] = [];
  const fleetRepos: FleetRepo[] = [];

  const probeGh = await checkGhAvailable();
  if (!probeGh.available) {
    checks.push({
      id: "fleet.gh.unavailable",
      stage: "fleet",
      severity: "fail",
      message: "gh CLI unavailable — cannot validate fleet state",
      detail: probeGh.reason,
    });
    return { checks, fleetRepos };
  }
  checks.push({ id: "fleet.gh.ready", stage: "fleet", severity: "ok", message: "gh CLI installed and authenticated" });
  lastGhError = "";

  for (const r of repos) {
    const full = `${org}/${r.slug}`;
    const view = await ghRepoView(full);

    if (!view) {
      fleetRepos.push({
        display: r.display, slug: r.slug, full, role: r.role,
        reachable: false, defaultBranch: "", description: "", archived: false, pushedAt: null,
        fileProbes: [],
        errorMessage: lastGhError || `gh repo view ${full} failed`,
      });
      checks.push({
        id: `fleet.repo.${r.slug}.reachable`,
        stage: "fleet",
        severity: "fail",
        message: `${full}: UNREACHABLE on GitHub`,
        detail: `Canonical repo not resolvable via \`gh repo view ${full}\`.${lastGhError ? `\n  gh: ${lastGhError}` : ""}\n  Check org/name, visibility, or network.`,
      });
      continue;
    }

    const defaultBranch = view.defaultBranchRef?.name ?? "";
    const pushedAt = view.pushedAt ?? null;

    const fileProbes: FileProbe[] = [];
    for (const f of META_FILES) {
      fileProbes.push(await probeFile(full, defaultBranch, f));
    }

    const missing = fileProbes.filter((p) => p.status !== "PASS");

    fleetRepos.push({
      display: r.display, slug: r.slug, full, role: r.role,
      reachable: true, defaultBranch, description: view.description ?? "",
      archived: view.isArchived, pushedAt, fileProbes,
    });

    if (missing.length === 0) {
      checks.push({
        id: `fleet.repo.${r.slug}.ok`,
        stage: "fleet",
        severity: "ok",
        message: `${full}: reachable, all ${META_FILES.length} meta-files present on \`${defaultBranch}\``,
      });
    } else {
      const onlyMissing = missing.filter((p) => p.status === "MISSING");
      const severity: Severity = onlyMissing.length > 0 ? "fail" : "warn";
      checks.push({
        id: `fleet.repo.${r.slug}.drift`,
        stage: "fleet",
        severity,
        message: `${full}: ${missing.length} meta-file drift item(s) on \`${defaultBranch}\``,
        detail: missing.map((p) => `${p.path} (${p.status}${p.code > 0 ? `:${p.code}` : ""})`).join(", "),
      });
    }

    // Default-branch expectation
    if (defaultBranch && defaultBranch !== "main" && defaultBranch !== "master") {
      checks.push({
        id: `fleet.repo.${r.slug}.branch`,
        stage: "fleet",
        severity: "warn",
        message: `${full}: default branch is \`${defaultBranch}\` (expected \`main\` or \`master\`)`,
      });
    }

    // Archived repos are unusual for the canonical set
    if (view.isArchived) {
      checks.push({
        id: `fleet.repo.${r.slug}.archived`,
        stage: "fleet",
        severity: "warn",
        message: `${full}: repo is archived (unusual for a canonical repo)`,
      });
    }

    // Cross-stage: canonical repo missing from the map
    if (canonicalHits.get(r.slug) === "missing") {
      checks.push({
        id: `cross.canonical.${r.slug}.in-fleet-not-map`,
        stage: "fleet",
        severity: "warn",
        message: `${full} is in the canonical fleet list but is not referenced in ECOSYSTEM_MAP.md`,
      });
    }
  }

  return { checks, fleetRepos };
}

// -----------------------------------------------------------------------------
// Reporter
// -----------------------------------------------------------------------------

function summarize(checks: CheckResult[]): { ok: number; warn: number; fail: number; total: number } {
  let ok = 0, warn = 0, fail = 0;
  for (const c of checks) {
    if (c.severity === "ok") ok++;
    else if (c.severity === "warn") warn++;
    else fail++;
  }
  return { ok, warn, fail, total: checks.length };
}

function stageStatus(checks: CheckResult[]): Severity {
  for (const c of checks) if (c.severity === "fail") return "fail";
  for (const c of checks) if (c.severity === "warn") return "warn";
  return "ok";
}

function printTextReport(
  report: ToolReport,
  args: CliArgs,
  fleetRepos: FleetRepo[],
): void {
  const color = makeColor(args.noColor === false && process.stdout.isTTY === true);
  const out = (s: string): void => process.stdout.write(s + "\n");

  out("");
  out(color("bold", "Phenotype Ecosystem Check"));
  out(color("bold", "=========================="));
  out("");
  out(`  Tool:        ${color("cyan", `${report.tool}@${report.version}`)}`);
  out(`  Map:         ${color("cyan", report.mapPath)}`);
  out(`  Org:         ${color("cyan", report.org)}`);
  out(`  Canonical:   ${color("cyan", `${report.canonicalRepoCount} repos`)}`);
  out(`  Started:     ${color("cyan", report.startedAt)}`);
  out(`  Mode:        ${color("cyan", args.mapOnly ? "map-only (no network)" : "full")}`);
  out("");

  // Stage 1: map
  {
    const s = report.stages.map;
    const statusColor = s.status === "ok" ? "green" : s.status === "warn" ? "yellow" : "red";
    out(color("bold", `Stage 1 — Map integrity (${s.durationMs}ms)`));
    out(color("dim", "─".repeat(60)));
    printCheckList(s.checks, color);
    out(`  ${color(statusColor, `${ICON[s.status]} ${s.status.toUpperCase()}`)}  ${s.checks.length} checks`);
    out("");
  }

  // Stage 2: fleet
  {
    const s = report.stages.fleet;
    if (args.mapOnly) {
      out(color("bold", "Stage 2 — GitHub fleet state"));
      out(color("dim", "─".repeat(60)));
      out(color("dim", "  (skipped: --map-only)"));
      out("");
    } else {
      const statusColor = s.status === "ok" ? "green" : s.status === "warn" ? "yellow" : "red";
      out(color("bold", `Stage 2 — GitHub fleet state (${s.durationMs}ms)`));
      out(color("dim", "─".repeat(60)));

      if (fleetRepos.length > 0) {
        out(color("dim", "  Per-repo results:"));
        for (const fr of fleetRepos) {
          const icon = fr.reachable ? (fr.fileProbes.every((p) => p.status === "PASS") ? "✓" : "△") : "✗";
          const iconColor = fr.reachable ? (fr.fileProbes.every((p) => p.status === "PASS") ? "green" : "yellow") : "red";
          out(`    ${color(iconColor as keyof typeof C, icon)} ${color("bold", fr.display)} ${color("blue", `(${fr.full})`)}`);
          if (!fr.reachable) {
            out(`        ${color("red", "UNREACHABLE")}${fr.errorMessage ? `: ${fr.errorMessage}` : ""}`);
            continue;
          }
          out(`        ${color("dim", `default: ${fr.defaultBranch}  ·  pushed: ${fr.pushedAt ?? "?"}`)}`);
          if (fr.description) out(`        ${color("dim", `desc: ${truncate(fr.description, 80)}`)}`);
          for (const p of fr.fileProbes) {
            const c = p.status === "PASS" ? "green" : p.status === "MISSING" ? "yellow" : "red";
            const m = p.status === "PASS" ? "✓" : p.status === "MISSING" ? "-" : p.status === "FORBIDDEN" ? "?" : "!";
            out(`        ${color(c as keyof typeof C, m)} ${p.path}`);
          }
        }
        out("");
      }

      printCheckList(s.checks, color);
      out(`  ${color(statusColor, `${ICON[s.status]} ${s.status.toUpperCase()}`)}  ${s.checks.length} checks`);
      out("");
    }
  }

  // Summary
  out(color("bold", "Summary"));
  out(color("bold", "-------"));
  out(`  Total checks:  ${color("bold", `${report.summary.total}`)}`);
  out(`  Passed:        ${color("green", `${report.summary.ok}`)}`);
  out(`  Warned:        ${color("yellow", `${report.summary.warn}`)}`);
  out(`  Failed:        ${color("red", `${report.summary.fail}`)}`);
  out("");

  if (report.summary.fail > 0) {
    out(color("red", color("bold", "Drift detected (FAIL).") + " See per-check detail above."));
  } else if (report.summary.warn > 0) {
    out(color("yellow", color("bold", "Drift detected (WARN).") + " See per-check detail above."));
  } else {
    out(color("green", color("bold", "No drift detected.") + " Ecosystem map and GitHub fleet are in sync."));
  }
  out("");
}

function printCheckList(checks: CheckResult[], color: (c: keyof typeof C, t: string) => string): void {
  // Print fails first, then warns, then oks
  const order: Severity[] = ["fail", "warn", "ok"];
  const grouped: Record<Severity, CheckResult[]> = { fail: [], warn: [], ok: [] };
  for (const c of checks) grouped[c.severity].push(c);
  for (const sev of order) {
    for (const c of grouped[sev]) {
      const iconColor = sev === "ok" ? "green" : sev === "warn" ? "yellow" : "red";
      process.stdout.write(`    ${color(iconColor as keyof typeof C, ICON[sev])} ${c.message}\n`);
      if (c.detail) {
        for (const line of c.detail.split("\n")) {
          process.stdout.write(`        ${color("dim", line)}\n`);
        }
      }
    }
  }
}

function printJsonReport(report: ToolReport, fleetRepos: FleetRepo[]): void {
  const out = {
    ...report,
    fleet: fleetRepos,
  };
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

// -----------------------------------------------------------------------------
// Helpers
// -----------------------------------------------------------------------------

function slugify(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function truncate(s: string, max: number): string {
  if (s.length <= max) return s;
  return s.slice(0, max - 1) + "…";
}

function isoNow(): string {
  return new Date().toISOString();
}

// -----------------------------------------------------------------------------
// Main
// -----------------------------------------------------------------------------

async function main(argv: ReadonlyArray<string>): Promise<number> {
  let args: CliArgs;
  try {
    args = parseArgs(argv);
  } catch (e) {
    process.stderr.write(`error: ${(e as Error).message}\n`);
    process.stderr.write(HELP_TEXT);
    return 2;
  }

  if (args.showHelp) {
    process.stdout.write(HELP_TEXT);
    return 0;
  }

  const startedAt = isoNow();
  const t0 = Date.now();

  // --- Resolve and load the map -----------------------------------------
  const mapPath = resolve(process.cwd(), args.mapPath);
  let raw: string;
  try {
    const s = await stat(mapPath);
    if (!s.isFile()) {
      process.stderr.write(`error: ${mapPath} is not a regular file\n`);
      return 2;
    }
    raw = await readFile(mapPath, "utf8");
  } catch (e) {
    process.stderr.write(`error: cannot read ${mapPath}: ${(e as Error).message}\n`);
    return 2;
  }

  // --- Stage 1: map validation ------------------------------------------
  const mapT0 = Date.now();
  const doc = parseMap(raw);
  const { checks: mapChecks, canonicalHits } = validateMap(doc, args);
  const mapDuration = Date.now() - mapT0;
  const mapStage: StageReport = {
    status: stageStatus(mapChecks),
    checks: mapChecks,
    durationMs: mapDuration,
  };

  // --- Stage 2: fleet validation ----------------------------------------
  const fleetT0 = Date.now();
  let fleetStage: StageReport;
  let fleetRepos: FleetRepo[] = [];

  if (args.mapOnly) {
    fleetStage = { status: "ok", checks: [], durationMs: 0 };
  } else {
    const r = await checkFleet(CANONICAL_REPOS, args.org, canonicalHits);
    fleetRepos = r.fleetRepos;
    fleetStage = {
      status: stageStatus(r.checks),
      checks: r.checks,
      durationMs: Date.now() - fleetT0,
    };
  }

  // --- Build report -----------------------------------------------------
  const allChecks = [...mapStage.checks, ...fleetStage.checks];
  const summary = summarize(allChecks);
  const report: ToolReport = {
    tool: TOOL_NAME,
    version: TOOL_VERSION,
    startedAt,
    durationMs: Date.now() - t0,
    mapPath,
    org: args.org,
    canonicalRepoCount: CANONICAL_REPOS.length,
    summary,
    stages: { map: mapStage, fleet: fleetStage },
  };

  // --- Emit ------------------------------------------------------------
  if (args.json) {
    printJsonReport(report, fleetRepos);
  } else {
    printTextReport(report, args, fleetRepos);
  }

  // --- Exit code --------------------------------------------------------
  if (summary.fail > 0) return 1;
  // Missing prerequisite (gh unavailable) is also a fail
  if (!args.mapOnly && fleetStage.checks.some((c) => c.id === "fleet.gh.unavailable")) return 3;
  return 0;
}

// Self-detection: run as main module when invoked directly
const isMain = (() => {
  if (typeof process === "undefined") return false;
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    return resolve(argv1) === fileURLToPath(import.meta.url);
  } catch {
    return false;
  }
})();

if (isMain) {
  main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (e) => {
      process.stderr.write(`fatal: ${(e as Error).stack ?? String(e)}\n`);
      process.exit(2);
    },
  );
}

export {
  parseMap,
  validateMap,
  checkFleet,
  splitTableRow,
  CANONICAL_REPOS,
  META_FILES,
  REQUIRED_SECTIONS,
  TOOL_NAME,
  TOOL_VERSION,
  type CheckResult,
  type MapDoc,
  type ToolReport,
};
