#!/usr/bin/env node
/**
 * Render the progress tree from its canonical JSON.
 *
 * SOURCE OF TRUTH: progress-tree.json. This script produces every derived
 * projection (Markdown tree, derived tables). Do not hand-edit the output —
 * edit the JSON and re-run:
 *
 *   node render-progress-tree.mjs
 *
 * Rationale: the CVP Execution Addendum requires derived tables and PDF/HTML to
 * come from the same versioned records, with "no duplicated hand-edited
 * source-of-truth documents".
 *
 *   --check   exit 1 if the committed Markdown differs from the rendered output
 */

import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const HERE = dirname(fileURLToPath(import.meta.url));
const JSON_PATH = join(HERE, "progress-tree.json");
const MD_PATH = join(HERE, "PROGRESS-TREE.md");
const WIDTH = 20;

const data = JSON.parse(readFileSync(JSON_PATH, "utf8"));

function bar(p, width = WIDTH) {
  if (p === null || p === undefined) return "?".padEnd(width, "?");
  const filled = Math.round(p * width);
  return "█".repeat(filled) + "░".repeat(width - filled);
}

const pct = (p) =>
  p === null || p === undefined ? "  ?" : String(Math.round(p * 100)).padStart(3);
const label = (p) => (p === null || p === undefined ? "UNKNOWN" : `${pct(p)}%`);

const out = [];
out.push(`# OmniRoute — Intent × Dimension Progress Tree`);
out.push("");
out.push(`**Subject:** \`${data.subject}\` @ \`${data.revision}\` (branch \`${data.branch}\`)`);
out.push(`**Observed:** ${data.observed_at} by ${data.observed_by}`);
out.push("");
out.push("> **Generated file.** Rendered from `progress-tree.json` by");
out.push("> `render-progress-tree.mjs`. Edit the JSON, then re-run the renderer.");
out.push("> Verify with `node render-progress-tree.mjs --check`.");
out.push("");
out.push("**Conventions.** `progress` is 0.0–1.0, or `null` when **UNKNOWN** — and");
out.push('`null` means *no measurement exists*, never "probably fine".');
out.push("");
for (const n of data.conventions.never_equate) out.push(`- ${n}`);
out.push("");
out.push("---");
out.push("");
out.push("## A. By dimension (CVP 8-state ladder, measured independently)");
out.push("");
out.push("```");
for (const d of data.dimensions) {
  out.push(
    `${d.id.padEnd(4)} ${d.name.padEnd(14)} ${bar(d.progress)} ${label(d.progress).padStart(7)}  ${d.note ?? ""}`
  );
}
out.push("```");
out.push("");
out.push("## B. By intent");
out.push("");
out.push("```");
for (const g of data.intents) {
  out.push(
    `${g.id.padEnd(4)} ${g.name.padEnd(38)} ${bar(g.progress)} ${label(g.progress).padStart(7)}`
  );
  for (const c of g.children ?? []) {
    const m = c.measured ? `  ${JSON.stringify(c.measured).slice(0, 96)}` : "";
    out.push(
      `     └─ ${c.id.padEnd(7)} ${c.name.padEnd(38)} ${bar(c.progress).padStart(WIDTH)}${m}`
    );
  }
}
out.push("```");
out.push("");
out.push("## C. Security (contract: 100% required, not 85%)");
out.push("");
out.push(`**${data.security_obligations.met} of ${data.security_obligations.total} MET.**`);
out.push("");
out.push("| ID | Obligation | State | Evidence |");
out.push("|---|---|---|---|");
for (const s of data.security_obligations.items) {
  out.push(`| ${s.id} | ${s.obligation} | **${s.state}** | ${s.evidence} |`);
}
out.push("");
out.push("## D. Assurance");
out.push("");
out.push("| Family | Files | Coverage | Floor | Blocking |");
out.push("|---|---:|---|---|---|");
for (const f of data.assurance.families) {
  const cov = f.coverage === null ? "**UNKNOWN**" : `${Math.round(f.coverage * 100)}%`;
  const fl = f.floor === null ? "—" : `${Math.round(f.floor * 100)}%`;
  out.push(`| ${f.id} | ${f.files ?? "—"} | ${cov} | ${fl} | ${f.blocking ? "yes" : "**no**"} |`);
}
out.push("");
out.push(
  `Disabled tests: **${data.assurance.disabled.files_with_skip_or_todo}** files with \`.skip\`/\`.todo\`.`
);
out.push("");
out.push(
  `Masked failure: \`${data.assurance.masked_failure.file}:${data.assurance.masked_failure.line}\` — ${data.assurance.masked_failure.note}`
);
out.push("");
out.push("## E. Operations");
out.push("");
out.push("| Signal | Value |");
out.push("|---|---|");
for (const [k, v] of Object.entries(data.operations)) {
  out.push(`| ${k} | ${Array.isArray(v) ? v.join("; ") : v} |`);
}
out.push("");
out.push("## F. Roll-up");
out.push("");
out.push("```");
for (const [k, v] of Object.entries(data.rollup)) {
  if (typeof v !== "number") continue;
  out.push(`${k.padEnd(38)} ${bar(v)} ${label(v).padStart(7)}`);
}
out.push("```");
out.push("");
out.push(`CVP definition: _${data.rollup.cvp_definition}_`);
out.push("");
out.push("## G. Delta this session");
out.push("");
out.push("| Dimension | Change | From | To |");
out.push("|---|---|---|---|");
for (const e of data.delta_this_session.earned) {
  out.push(`| ${e.dimension} | ${e.change} | ${e.from ?? "—"} | ${e.to ?? "—"} |`);
}
out.push("");
out.push(
  `Lost: ${data.delta_this_session.lost.length ? data.delta_this_session.lost.join(", ") : "**none**"} · Retained: ${data.delta_this_session.retained}`
);
out.push("");
out.push("## H. Blockers");
out.push("");
out.push("| ID | Blocker | Consequence | Owner | Unblock |");
out.push("|---|---|---|---|---|");
for (const b of data.blockers) {
  out.push(`| ${b.id} | ${b.blocker} | ${b.consequence} | ${b.owner} | ${b.unblock} |`);
}
out.push("");
out.push("## I. Evidence");
out.push("");
for (const e of data.evidence) out.push(`- \`${e}\``);
out.push("");

const rendered = out.join("\n");

if (process.argv.includes("--check")) {
  let current = "";
  try {
    current = readFileSync(MD_PATH, "utf8");
  } catch {
    console.error("PROGRESS-TREE.md is missing; run the renderer without --check");
    process.exit(1);
  }
  if (current !== rendered) {
    console.error("PROGRESS-TREE.md is STALE relative to progress-tree.json");
    process.exit(1);
  }
  console.log("PROGRESS-TREE.md is in sync with progress-tree.json");
  process.exit(0);
}

writeFileSync(MD_PATH, rendered);
console.log(`rendered ${MD_PATH} (${rendered.length} bytes) from progress-tree.json`);
