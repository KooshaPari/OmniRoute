# Phase 5 — Agent runtime absorption — 2026-06-19

**Predecessor:** Phase 4 closeout (registry #255 docs:build; wave15 L7 #244/#245)  
**Charter:** ECOSYSTEM_MAP §6 P5 + RATIONALIZATION_PLAN Agentora absorption cluster  
**Canonical owner:** `KooshaPari/Agentora`

## Scope

Close the agent-runtime repo surface by absorbing stubs into Agentora and archiving
source repos after zero-dep gates. Python proc plane already lives at
`Agentora/agents/phenoagent/python/*` (PhenoProc wave 6).

## Task ledger

| ID | Task | Source repo | Target | Status |
|----|------|-------------|--------|--------|
| P5-1 | PhenoAgent Rust/CLI/docs → `crates/pheno-agent/` + absorption doc | PhenoAgent | Agentora | **done** — [Agentora#91](https://github.com/KooshaPari/Agentora/pull/91); archived 2026-06-19 |
| P5-2 | PhenoAgent archive gate (post P5-1 merge) | PhenoAgent | archive | **done** — archived 2026-06-19 |
| P5-3 | PhenoProc archive gate verify | PhenoProc | archive | **done** — archived 2026-06-19 |
| P5-4 | phenoRouterMonitor Rust core → phenoAI | phenoRouterMonitor | phenoAI | **deferred** — repo archived; Streamlit dash retained; no code migration, docs-only boundary note |
| P5-4 | phenoRouterMonitor → phenoAI resolution (sidecar) | phenoRouterMonitor | phenoAI | **done** 2026-06-20 — Rust router canonical in phenoAI/crates/llm-router/; spec doc [p5-4-phenoroutermonitor-absorption-2026-06-20.md](./p5-4-phenoroutermonitor-absorption-2026-06-20.md) |
| P5-5 | thegent vs Agentora boundary | thegent | AFFIRM split | **open** — Python runtime stays separate from pheno-agent Rust; next step is boundary confirmation, registry handoff, and PR linkage |
| P5-6 | FocalPoint vendor → HexaKit | FocalPoint | HexaKit | **deferred** — 867MB vendor; repo archived |

## Consumer chokepoints

| Source | Blocked consumers | Target pin | Status |
|--------|-------------------|------------|--------|
| PhenoAgent | PhenoDevOps, Pyron | Agentora `crates/pheno-agent` | Pyron **404**; org manifest scan: **0 git deps** on PhenoAgent (2026-06-19) |
| PhenoProc | (none) | Agentora `pheno-proc-runtime` | absorption complete; archive pending |
| pheno | phenoRouterMonitor | HexaKit phenotype-* | **done** — phenoRouterMonitor#632 |
| pheno | phenoRouterMonitor (Rust core) | phenoAI crates/llm-router/ | **done** 2026-06-20 — absorbed; see sidecar row gate-phenoroutermonitor-p5-4-resolution |

## Similar merges (ECOSYSTEM_MAP priority)

| Priority | Action | Notes |
|----------|--------|-------|
| P5 | PhenoAgent → Agentora | This wave |
| P3 | Metron + Traceon → PhenoObservability | **done** prior waves |
| P6 | heliosBench/heliosApp → phenotype-tooling | deferred |
| P8 | phenotype-hub → phenotype-infra | **done** G19 |

## Verification

```bash
# Zero-dep gate (org manifest scan)
gh api "search/code?q=org:KooshaPari+KooshaPari/PhenoAgent+in:file" \
  --jq '.items[] | select(.path | test("Cargo.toml|go.mod|package.json|pyproject.toml"))'

# Agentora subset build
cargo check -p phenotype-daemon -p phenotype-skills  # in Agentora workspace
```

## PR tracker

| PR | Repo | Status |
|----|------|--------|
| P5 ledger | phenotype-registry | open |
| PhenoAgent absorption doc | Agentora | open |
| PhenoProc archive | PhenoProc | pending gate |
| PhenoAgent archive | PhenoAgent | pending P5-1 |
