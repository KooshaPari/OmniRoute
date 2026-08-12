#!/usr/bin/env node
// scripts/check/check-docs-symbols.mjs
// Anti-hallucination gate (docs → code): every reference to a `/api/...` route
// inside docs/**/*.md must resolve to a real `route.ts` in src/app/api/.
// Catches INVENTED/deprecated endpoints that LLMs write in docs/PRs describing a
// route that doesn't exist — a recurring pattern from docs PRs (e.g. oyi77) that
// fabricate endpoints/APIs.
//
// Complements the other anti-hallucination gates:
//   - check-fetch-targets.mjs  : fetch("/api/...") in the UI → route.ts (code → code)
//   - check-openapi-routes.mjs : openapi.yaml path → route.ts (spec → code)
//   - this gate                : /api/... in prose/markdown → route.ts (docs → code)
//
// LOW-NOISE by design: scopes ONLY route paths `/api/...` (highest-signal target).
// Anything that is known noise (OpenAI-compat proxy surface, source-file refs,
// third-party upstream APIs, placeholders) goes to IGNORE with justification,
// NOT to the allowlist. The allowlist freezes only REAL pre-existing doc drift.
// Stale-enforcement (6A.3): an entry in KNOWN_STALE_DOC_REFS that suppresses no
// real miss → gate fails with a removal instruction (avoids silent regression gaps).
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { reportStaleEntries } from "./lib/allowlist.mjs";
import { collectApiRouteFiles } from "./lib/apiRoutes.mjs";

const ROOT = process.cwd();
const DOCS = path.join(ROOT, "docs");

// Patterns that are NOT internal OmniRoute routes (structural noise, not drift).
// Add here (with justification) instead of the allowlist when a category
// generates false positives — the allowlist is only for REAL stale endpoints.
const IGNORE = [
  /^\/api\/v1\//, // OpenAI-compat surface (proxy), not internal route
  /^\/api\/v1beta\//, // Gemini-compat surface (proxy)
  /^\/api\/v0\//, // third-party upstream APIs cited in research docs
  /^\/api\/v2\//, // same (deployments etc.)
  /^\/api\/(organizations|map-image|graphql|gql)\b/, // documented external provider APIs
  /your-/i, // example placeholder
  /example/i, // example placeholder
  /\.{3}/, // "..." placeholder
  /\{\}/, // empty param placeholder
  /_(POST|GET|PUT|DELETE|PATCH)$/, // network-trace style refs (gql_POST)
];

// Refs to SOURCE FILES, not URLs (e.g. src/app/api/.../route.ts cited in prose).
// The gate only validates route URLs, not file paths.
function isFileRef(p) {
  return /\.(ts|tsx|js|mjs|jsx)$/.test(p) || /\/route$/.test(p);
}

// Refs to `/api/...` that do NOT resolve to a real route, frozen for triage
// (ratchet: blocks ANY new invented refs in docs). These are REAL findings of
// drift/hallucination in pre-existing docs — each one needs: create the route,
// fix the path in the doc, or remove the mention. Do NOT add new entries here
// without justification — that is the point of the gate. Tracking issues must
// be opened for each cluster.
export const KNOWN_STALE_DOC_REFS = new Set([
  // docs/reference/API_REFERENCE.md — guardrails/shadow doc-fiction RESOLVED in #3496:
  // GET /api/guardrails + POST /api/guardrails/test are now REAL routes (wrapping the
  // existing guardrailRegistry); the fictional enable/disable/logs rows and the entire
  // shadow table were removed from the doc (shadow A-B comparison is combo-config +
  // /api/combos/metrics). No allowlist entries needed for these anymore.
  // (DISCOVERY_TOOL_DESIGN.md moved out of docs/research/ into the isolated _tasks/research/
  // repo — gitignored, outside this gate's scope. The 4 entries /api/discovery/* became
  // obsolete and were removed to satisfy the allowlist's stale-enforcement.)
  // docs/reference/ENVIRONMENT.md — UPSTREAM endpoint of the Blackbox Web provider,
  // cited in an env-var description (not an OmniRoute route):
  "/api/chat",
  // docs/ops/TUNNELS_GUIDE.md — the doc EXPLICITLY states that this endpoint does
  // NOT exist ("There is no central /api/settings/tunnels endpoint"); pedagogical mention:
  "/api/settings/tunnels",
]);

function walk(dir, filter, acc = []) {
  if (!fs.existsSync(dir)) return acc;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, filter, acc);
    else if (filter(e.name)) acc.push(p);
  }
  return acc;
}

export function collectRouteFiles() {
  return new Set(
    walk(API, (n) => /^route\.tsx?$/.test(n)).map((p) => path.relative(ROOT, p).replace(/\\/g, "/"))
  );
}

/** Normaliza um segmento dinâmico ({param} / [param] / [...param] / :param) para wildcard. */
function normSeg(seg) {
  if (/^\[\[?\.{3}.+\]\]?$/.test(seg)) return ""; // catch-all [...x] / [[...x]]
  if (/^\{[^}]+\}$/.test(seg) || /^\[[^\]]+\]$/.test(seg) || /^:[^/]+$/.test(seg)) return " ";
  return seg;
}

// /api/providers/{id}/models → src/app/api/providers/[id]/models/route.ts
// Matches by segment count OR by prefix (a doc may cite only the prefix of a
// deeper route, e.g. /api/auth describing the /api/auth/login family). Any
// dynamic segment ([..]/{..}/:..) matches a real dynamic segment.
export function resolveApiDocPathToRoute(apiPath, routeFiles) {
  const segs = apiPath
    .replace(/^\//, "")
    .replace(/[?#].*$/, "")
    .split("/")
    .map(normSeg);
  for (const rf of routeFiles) {
    const rsegs = rf
      .replace(/^src\/app\//, "")
      .replace(/\/route\.tsx?$/, "")
      .split("/");
    const rnorm = rsegs.map((rs) => {
      if (/^\[\[?\.{3}.+\]\]?$/.test(rs)) return ""; // catch-all
      if (/^\[[^\]]+\]$/.test(rs)) return " "; // [param]
      return rs;
    });
    const catchAll = rnorm.includes("");
    const effLen = catchAll ? rnorm.indexOf("") : rnorm.length;
    if (!catchAll && segs.length > rnorm.length) continue; // doc mais profunda que a rota
    if (catchAll && segs.length < effLen) continue;
    const cmpLen = Math.min(segs.length, effLen || rnorm.length);
    let match = true;
    for (let i = 0; i < cmpLen; i++) {
      const rs = rnorm[i];
      if (rs === "") break; // catch-all absorve o resto
      if (!(rs === segs[i] || rs === " " || segs[i] === " ")) {
        match = false;
        break;
      }
    }
    if (match) return true;
  }
  return false;
}

/** Limpa o path capturado: remove pontuação/ênfase de prosa, fecha brackets pendentes. */
function cleanCapturedPath(raw) {
  let p = raw.replace(/[.,:;_)>]+$/, "");
  const ob = (p.match(/\[/g) || []).length;
  const cb = (p.match(/\]/g) || []).length;
  const oc = (p.match(/\{/g) || []).length;
  const cc = (p.match(/\}/g) || []).length;
  if (ob !== cb || oc !== cc) {
    // segmento final truncado pelo regex (bracket aberto sem fechar na prosa) → descarta
    p = p.replace(/\/[^/]*[[{][^/]*$/, "");
  }
  return p.replace(/\/$/, ""); // remove barra final (forma de prefixo)
}

// /api/... só conta como URL quando NÃO é a cauda de um caminho de arquivo-fonte
// (src/lib/api/, @/app/api/, app/api/). O grupo 2 é o path.
const API_PATH_RE = /(^|[^A-Za-z0-9_/])(\/api\/[A-Za-z0-9_\-/{}\[\].:]+)/g;

/** Extrai os paths /api/... distintos de um arquivo markdown (forma URL, não arquivo). */
export function extractDocApiPaths(src) {
  const out = new Set();
  let m;
  API_PATH_RE.lastIndex = 0;
  while ((m = API_PATH_RE.exec(src))) {
    const p = cleanCapturedPath(m[2]);
    if (p && p !== "/api") out.add(p);
  }
  return [...out];
}

/**
 * Núcleo puro/testável.
 * @param {{file: string, paths: string[]}[]} docPathsByFile
 * @param {Set<string>} routeFiles  conjunto de "src/app/api/.../route.ts"
 * @param {Set<string>} allowlist   paths stale congelados
 * @returns {string[]}  misses no formato "file → /api/path"
 */
export function findStaleDocApiRefs(docPathsByFile, routeFiles, allowlist) {
  const misses = [];
  for (const { file, paths } of docPathsByFile) {
    for (const p of paths) {
      if (IGNORE.some((rx) => rx.test(p))) continue;
      if (isFileRef(p)) continue;
      if (allowlist.has(p)) continue;
      if (!resolveApiDocPathToRoute(p, routeFiles)) {
        misses.push(`${file} → ${p}`);
      }
    }
  }
  return misses;
}

/**
 * @param {{ root?: string, routeFiles?: Set<string> }} [opts]
 * @returns {{ ok: boolean, exitCode: number, message: string }}
 */
export function runDocsSymbolsCheck(opts = {}) {
  const root = opts.root || ROOT;
  const docsDir = path.join(root, "docs");
  const routeFiles = opts.routeFiles || collectApiRouteFiles(root);
  // docs/i18n/** are auto-generated mirrors of the canonical docs — validate only
  // the canonical to avoid 40× duplicated noise (and mirrors inherit any fix).
  // docs/superpowers/** are internal implementation plans (historical intent
  // snapshots — may cite planned/abandoned routes), not claims about the
  // current code; out of the gate's scope (drift arose in the v3.8.18 cycle).
  const docFiles = walk(docsDir, (n) => /\.md$/.test(n)).filter((f) => {
    const rel = path.relative(root, f).replace(/\\/g, "/");
    return !rel.startsWith("docs/i18n/") && !rel.startsWith("docs/superpowers/");
  });
  const docPathsByFile = docFiles.map((f) => ({
    file: path.relative(root, f).replace(/\\/g, "/"),
    paths: extractDocApiPaths(fs.readFileSync(f, "utf8")),
  }));

  const allMisses = findStaleDocApiRefs(docPathsByFile, routeFiles, new Set());
  const liveMissPaths = allMisses.map((m) => m.split(" → ")[1]);
  const stale = reportStaleEntries(KNOWN_STALE_DOC_REFS, liveMissPaths, "check-docs-symbols");
  const misses = findStaleDocApiRefs(docPathsByFile, routeFiles, KNOWN_STALE_DOC_REFS);

  const parts = [];
  if (stale.length) {
    parts.push(
      `[check-docs-symbols] ${stale.length} entrada(s) obsoleta(s) na allowlist ` +
        `— a violação foi corrigida; REMOVA a entrada para travar a correção:\n` +
        stale.map((e) => `  ✗ ${e}`).join("\n")
    );
  }
  if (misses.length) {
    parts.push(
      `[check-docs-symbols] ${misses.length} ref(s) /api in docs without a real route:\n` +
        misses.map((m) => "  ✗ " + m).join("\n") +
        `\n  → create the route.ts, fix the path in the doc, or (if upstream/placeholder)` +
        ` add a pattern to IGNORE with justification. Do NOT add to the allowlist without` +
        ` confirming it's real pre-existing drift.`
    );
  }
  if (parts.length) {
    return { ok: false, exitCode: 1, message: parts.join("\n") };
  }
  return {
    ok: true,
    exitCode: 0,
    message:
      `[check-docs-symbols] OK — ${docFiles.length} canonical docs, ` +
      `${routeFiles.size} known routes, ${KNOWN_STALE_DOC_REFS.size} frozen stale refs`,
  };
}

function main() {
  const result = runDocsSymbolsCheck();
  if (result.ok) console.log(result.message);
  else console.error(result.message);
  process.exit(result.exitCode);
}

if (import.meta.url === pathToFileURL(process.argv[1] || "").href) main();
