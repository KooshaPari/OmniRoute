# 71-pillar audit — pheno-llms-txt, pheno-mcp-router, pheno-scaffold-kit, pheno-vibecoding-guard, pheno-worklog-schema

**Date:** 2026-06-18 | **Track:** T13.9-T13.13 (v8 batch 9E) | **Author:** Subagent E (focused audit)
**Method:** rapid probe per ADR-024 schema (`findings/71-pillar-2026-06-17-schema.md`); each pillar scored 0-3, N/A=3 for inapplicable (UX L38-L45 N/A across the board for headless libs).
**Scope:** READ-ONLY audit. No code, CI, or repo files modified.

## Per-repo original scores (consolidates T13-9, T13-10, T13-11, T13-12, T13-13)

| Repo | LoC | Tests | Tier | Pillar score |
|---|---|---|---|---|
| pheno-llms-txt | ~280 | 2 files | 0 | **14/71 (20%)** |
| pheno-mcp-router | ~5,260 | 7 files | 0 (39% → near-Tier-1) | **28/71 (39%)** |
| pheno-scaffold-kit | ~323 | 1 file | 0 | **16/71 (23%)** |
| pheno-vibecoding-guard | ~978 | 4 files | 0 | **22/71 (31%)** |
| pheno-worklog-schema | ~1,129 | 4 files | 0 | **22/71 (31%)** |

**Individual audit originals:**
- `findings/2026-06-18-T13-9-audit-pheno-llms-txt.md`
- `findings/2026-06-18-T13-10-audit-pheno-mcp-router.md`
- `findings/2026-06-18-T13-11-audit-pheno-scaffold-kit.md`
- `findings/2026-06-18-T13-12-audit-pheno-vibecoding-guard.md`
- `findings/2026-06-18-T13-13-audit-pheno-worklog-schema.md`

## Aggregate 71-pillar matrix (5 repos × 71 pillars)

| Pillar domain | pheno-llms-txt | pheno-mcp-router | pheno-scaffold-kit | pheno-vibecoding-guard | pheno-worklog-schema | Σ |
|---|---|---|---|---|---|---|
| **AX (L1-L12)** | 3 | 8 | 3 | 4 | 5 | **23/60** |
| **Performance (L13-L19)** | 1 | 2 | 1 | 1 | 1 | **6/35** |
| **QC (L20-L27)** | 2 | 5 | 1 | 4 | 5 | **17/40** |
| **DX (L28-L37)** | 4 | 5 | 4 | 5 | 5 | **23/50** |
| **UX (L38-L45)** | 0 (N/A) | 0 (N/A) | 0 (N/A) | 0 (N/A) | 0 (N/A) | **0/40 (all N/A)** |
| **Security (L46-L55)** | 2 | 4 | 4 | 5 | 3 | **18/50** |
| **OO (L56-L63)** | 0 | 1 | 0 | 0 | 0 | **1/40** |
| **Docs/SSOT (L64-L68)** | 2 | 2 | 2 | 2 | 2 | **10/25** |
| **Governance (L69-L71)** | 0 | 1 | 1 | 1 | 1 | **4/15** |
| **TOTAL** | **14/71** | **28/71** | **16/71** | **22/71** | **22/71** | **102/355 (28.7%)** |
| **Tier (post-audit)** | 0 | 0 (1 short) | 0 | 0 | 0 | — |

**Per-repo avg:** 102 ÷ 5 = 20.4 pillars (28.7% of 71).
**Fleet Δ vs batch 9 (`2026-06-18-T13-x-71-pillar-audit-3-repos-batch-7.md`):** this batch adds 5 repos × 71 pillars = **355 audited pillars**, of which 102 hit — slightly higher hit-rate (28.7%) than batch 7's 31% (which was buoyed by pheno-go-ctxkit's clean-room meta-bundle score of 20/71). Net: **+102 pillars added to fleet scorecard**.

## Detailed audit (L1-L71)

### pheno-llms-txt (~280 LoC, 2 test files)

**Original:** `findings/2026-06-18-T13-9-audit-pheno-llms-txt.md` (14/71 = 20%, Tier 0)

| Pillar cluster | Score | Evidence |
|---|---|---|
| L1-L5 (arch basic) | 2/3 | core.py + cli.py + __init__.py split; 3 pub items; thiserror-ish exceptions; minimal deps (click+pyyaml) |
| L6-L12 (arch advanced) | 1/3 | no Port trait; no DI; no async; pure-Python module layout only |
| L13-L19 (perf) | 1/3 | regex/parse; 0 benchmarks; no async I/O; no flamegraphs |
| L20-L27 (QC) | 2/3 | tests/test_core.py + tests/test_init.py; no doc tests; no proptest; no mutation; no unsafe |
| L28-L37 (DX) | 4/3 | AGENTS.md, README.md, CHANGELOG.md, WORKLOG.md, llms.txt all present; CI runs pytest; **no SPEC.md**; **no examples/**; no dev-container |
| L38-L45 (UX) | 0/3 | N/A (library) |
| L46-L55 (security) | 2/3 | LICENSE-MIT present; **no deny.toml**; no input-validation tests; no SBOM; no SLSA doc |
| L56-L63 (OO) | 0/3 | no tracing dep; no metrics; no OTLP; no health endpoint |
| L64-L68 (SSOT) | 2/3 | llms.txt + AGENTS.md; **no SPEC.md**; no glossary; no ADR-link |
| L69-L71 (governance) | 0/3 | no CODEOWNERS; no SUPPORT.md; no release-policy |

**Top 3 gaps:** L8 SPEC.md missing, L17 deny.toml missing, L30 examples/ missing.

### pheno-mcp-router (~5,260 LoC, 7 test files)

**Original:** `findings/2026-06-18-T13-10-audit-pheno-mcp-router.md` (28/71 = 39%, Tier 0 — strongest in this batch)

| Pillar cluster | Score | Evidence |
|---|---|---|
| L1-L5 | 3/3 | 10 src modules (tiers, cost, budget, quota, audit, cost_middleware, ports, adapters, cli); clean separation |
| L6-L12 | 2/3 | Port trait + Adapter impl per ADR-014; no async (sync only — gap for prod scale); 6 L5-104.1 absorbed modules |
| L13-L19 | 2/3 | rate-limit logic in budget/quota; 0 benchmarks; sync I/O only |
| L20-L27 | 5/3 | 7 test files (audit/budget/cost_middleware/cost/ports/quota/tiers/smoke); **no doc tests**; no proptest for cost arith |
| L28-L37 | 5/3 | AGENTS.md + README.md + CHANGELOG.md + WORKLOG.md + llms.txt + audit_scorecard.json + pyrightconfig.json; **no SPEC.md**; **no examples/** |
| L38-L45 | 0/3 | N/A (library) |
| L46-L55 | 4/3 | LICENSE-MIT + LICENSE (dual); SECURITY.md; CODE_OF_CONDUCT; CONTRIBUTING; **no deny.toml**; cost-middleware is auth-adjacent (good!) |
| L56-L63 | 1/3 | audit_scorecard.json is structured-log-like (partial credit); no tracing dep; no OTLP; no health |
| L64-L68 | 2/3 | llms.txt + AGENTS.md + audit_scorecard.json; no SPEC.md; no glossary; no ADR-link |
| L69-L71 | 1/3 | CODE_OF_CONDUCT + CONTRIBUTING + SECURITY.md; **no CODEOWNERS**; no SUPPORT |

**Top 3 gaps:** L8 SPEC.md missing on fleet-critical substrate, L30 examples/ missing, L17 deny.toml/pip-audit missing.

### pheno-scaffold-kit (~323 LoC, 1 test file)

**Original:** `findings/2026-06-18-T13-11-audit-pheno-scaffold-kit.md` (16/71 = 23%, Tier 0)

| Pillar cluster | Score | Evidence |
|---|---|---|
| L1-L5 | 2/3 | cli.py + __init__.py; click-based CLI; minimal deps; 2 pub items |
| L6-L12 | 1/3 | no Port trait; filesystem walks + jinja-like templating; minimal layering |
| L13-L19 | 1/3 | 0 benchmarks; no async I/O |
| L20-L27 | 1/3 | 1 test file (test_smoke.py) — minimal; **no doc tests**; no proptest; no mutation |
| L28-L37 | 4/3 | AGENTS.md + README.md + CHANGELOG.md + WORKLOG.md + llms.txt + audit_scorecard.json; CI runs 5 workflows (ci, doc-links, fr-coverage, quality-gate, trufflehog); **no SPEC.md**; **no examples/** |
| L38-L45 | 0/3 | N/A |
| L46-L55 | 4/3 | LICENSE-MIT + LICENSE + SECURITY.md + trufflehog workflow + quality-gate workflow; no SBOM; no SLSA doc |
| L56-L63 | 0/3 | no tracing; no metrics; no OTLP; no health |
| L64-L68 | 2/3 | llms.txt + AGENTS.md + audit_scorecard.json; no SPEC.md; no glossary |
| L69-L71 | 1/3 | CODE_OF_CONDUCT + CONTRIBUTING + SECURITY.md; no CODEOWNERS; no SUPPORT |

**Top 3 gaps:** L8 SPEC.md (template variables undocumented), L30 examples/ (no before/after), L21-L22 doc tests + proptest (only smoke today).

### pheno-vibecoding-guard (~978 LoC, 4 test files)

**Original:** `findings/2026-06-18-T13-12-audit-pheno-vibecoding-guard.md` (22/71 = 31%, Tier 0)

| Pillar cluster | Score | Evidence |
|---|---|---|
| L1-L5 | 3/3 | guard.py + validation.py + cli.py + __init__.py; clear responsibility split; minimal deps |
| L6-L12 | 1/3 | no Port trait; regex/AST pattern matching; no async |
| L13-L19 | 1/3 | 0 benchmarks; no async |
| L20-L27 | 4/3 | 4 test files (cli, guard, init, validation) — good coverage; no doc tests; no proptest |
| L28-L37 | 5/3 | AGENTS.md + README.md + CHANGELOG.md + WORKLOG.md + llms.txt + audit_scorecard.json + pyrightconfig.json; 5 CI workflows; **no SPEC.md**; **no examples/** |
| L38-L45 | 0/3 | N/A |
| L46-L55 | 5/3 | LICENSE-MIT + LICENSE + SECURITY.md + trufflehog + quality-gate; tool itself is security-adjacent; no SBOM; no SLSA doc |
| L56-L63 | 0/3 | no tracing; no metrics; no OTLP; no health — **big gap for a security tool** |
| L64-L68 | 2/3 | llms.txt + AGENTS.md + audit_scorecard.json; no SPEC.md; no glossary |
| L69-L71 | 1/3 | CODE_OF_CONDUCT + CONTRIBUTING + SECURITY.md; no CODEOWNERS; no SUPPORT |

**Top 3 gaps:** L8 SPEC.md (threat model + rule taxonomy), L56 tracing (security tool with no fire telemetry), L69 CODEOWNERS (security-critical tool needs ownership per ADR-035).

### pheno-worklog-schema (~1,129 LoC, 4 test files)

**Original:** `findings/2026-06-18-T13-13-audit-pheno-worklog-schema.md` (22/71 = 31%, Tier 0)

| Pillar cluster | Score | Evidence |
|---|---|---|
| L1-L5 | 3/3 | schema.py + cli.py + __init__.py; v2 → v2.1 migration tool bundled (ADR-025) |
| L6-L12 | 2/3 | clean separation; migration tool is its own concern; minimal deps |
| L13-L19 | 1/3 | markdown-table parse; 0 benchmarks; no async |
| L20-L27 | 5/3 | 4 test files (init, schema, validate_worklog, migrate_v2_to_v2_1) — **best test coverage in this batch** |
| L28-L37 | 5/3 | AGENTS.md + README.md + CHANGELOG.md + WORKLOG.md + llms.txt + audit_scorecard.json + pyrightconfig.json; **no SPEC.md (ironic!)**; **no examples/** |
| L38-L45 | 0/3 | N/A |
| L46-L55 | 3/3 | LICENSE-MIT + LICENSE + SECURITY.md; **no deny.toml/pip-audit**; no SBOM; no SLSA doc |
| L56-L63 | 0/3 | no tracing; no metrics; no OTLP; no health |
| L64-L68 | 2/3 | llms.txt + AGENTS.md + audit_scorecard.json; **no SPEC.md (gap!)**; no glossary |
| L69-L71 | 1/3 | CODE_OF_CONDUCT + CONTRIBUTING + SECURITY.md; no CODEOWNERS; no SUPPORT |

**Top 3 gaps:** L8 SPEC.md (meta: schema-defining lib lacks its own spec!), L30 examples/ (round-trip), L17 deny.toml / pip-audit.

## New L72-L74 pillars (ADR-041/042/043)

These three new pillars were added by ADRs 2026-06-18 (ADR-041 predictive DRY, ADR-042 substrate graduation, ADR-043 app-substrate drift detector). Scoring them across this batch:

| New pillar | Definition | pheno-llms-txt | pheno-mcp-router | pheno-scaffold-kit | pheno-vibecoding-guard | pheno-worklog-schema |
|---|---|---|---|---|---|---|
| **L72 Predictive DRY** (ADR-041) | Does the repo expose hooks (or be consumable by) `pheno-predict` for duplicate-detection? | 0 (passive lib) | 0 (no integration) | 0 (passive) | 0 (passive) | 0 (passive) |
| **L73 Substrate graduation** (ADR-042) | Does it ship the graduation artifacts (SPEC, examples, dual-license, OTLP, CI)? | 0 | 1 (has dual-license + CI; missing SPEC, examples, OTLP) | 0 | 1 (has CI + trufflehog; missing SPEC, examples, OTLP) | 0 |
| **L74 App-substrate drift** (ADR-043) | Is it monitored by `pheno-drift-detector` (L8-012) for untracked substrate? | 0 | 0 | 0 | 0 | 0 |
| **Σ (out of 9 new)** | | **0/3** | **1/3** | **0/3** | **1/3** | **0/3** |

**Fleet L72-L74 sum:** 2/15 (13%). **Biggest gap:** L74 (drift detector) is fully absent — pheno-drift-detector (L8-012) needs to be operationalized to monitor all 22 pheno-* repos.

## Top 10 priority remediations across the 5 repos (sorted by ROI)

1. **pheno-mcp-router: add SPEC.md** (highest ROI — fleet-critical substrate per ADR-013; closes L8) → +1 pillar → 28 → 29 (41%, Tier 1 threshold 56/71 still distant but on track)
2. **All 5: add `examples/`** (L30) — single biggest cross-cutting gap, 5 repos × 1 pillar = +5 → 102 → 107
3. **pheno-mcp-router + pheno-scaffold-kit + pheno-worklog-schema + pheno-llms-txt: add `deny.toml` / `pip-audit` config** (L17) — supply-chain gate, +4 → 111
4. **pheno-mcp-router + pheno-vibecoding-guard + pheno-worklog-schema: add doc tests inline** (L21) — closes gap on schema-defining / security / fleet-critical libs, +3 → 114
5. **All 5: add `pheno-tracing` (or stdlib `logging`) + OTLP stub** (L56-L57) — closes biggest cross-cutting OO gap, +5 → 119
6. **pheno-vibecoding-guard: add rule-fire metrics** (L57 — security tool with no telemetry is the largest single gap) → +1 → 120
7. **All 5: add CODEOWNERS** (L69) — sign-off governance, +5 → 125
8. **pheno-worklog-schema: add SPEC.md (v2.1 11-column schema)** (L8) — meta: a schema-defining lib without its own spec is the largest doc gap; closes ADR-015 v2.1 deprecation prep
9. **pheno-scaffold-kit: add proptest for path normalization** (L22) — closes the single smallest test surface in the batch
10. **All 5: register with `pheno-drift-detector`** (L74) — operationalize ADR-043; +5 → 130 (and protects against future drift)

## Tier progression per repo (per ADR-023 Rule 3.1 + ADR-040 gates)

| Tier | Threshold | pheno-llms-txt | pheno-mcp-router | pheno-scaffold-kit | pheno-vibecoding-guard | pheno-worklog-schema |
|---|---|---|---|---|---|---|
| Tier 0 | <30/71 | ✓ (14) | (39%, near-Tier-1) | ✓ (16) | ✓ (22) | ✓ (22) |
| Tier 1 (substrate) | 56/71 (80%) | needs +42 | needs +28 | needs +40 | needs +34 | needs +34 |
| Tier 2 (SDK) | 50/71 (70%) | needs +36 | needs +22 | needs +34 | needs +28 | needs +28 |
| Tier 3 (framework) | 43/71 (60%) | needs +29 | needs +15 | needs +27 | needs +21 | needs +21 |
| Tier 4 (federated service) | 43/71 (60%) | needs +29 | needs +15 | needs +27 | needs +21 | needs +21 |

**All 5 currently Tier 0.** **pheno-mcp-router** is the strongest (39%) and closest to Tier 1 — needs +28 pillars. **pheno-llms-txt** is the weakest (14%) and furthest from Tier 1.

## Cross-cutting findings

1. **All 5 repos lack SPEC.md** (L8) — this is the single most universal gap in the batch. 5/5 missing.
2. **All 5 repos lack `examples/`** (L30) — second-most universal gap. 5/5 missing.
3. **All 5 repos have ZERO observability** (L56-L63, ~1/40 partial credit from mcp-router's audit_scorecard.json) — the entire batch is observability-blind.
4. **4/5 repos lack `deny.toml` / pip-audit config** (L17) — only pheno-scaffold-kit and pheno-vibecoding-guard have security gates via trufflehog/quality-gate workflows.
5. **Only pheno-mcp-router has a Port trait** (ADR-014) — 4/5 repos are still in "module-only" architecture.
6. **0/5 repos have CODEOWNERS** (L69) — release/sign-off governance is missing across the entire batch.
7. **pheno-mcp-router is the fleet-critical substrate** (ADR-013) — its 39% is the highest in the batch, but still 17 pillars short of Tier 1.

## Critical-path pillars (still missing across all 5)

- **OO L56-L63 (tracing/logs/metrics/OTLP/health/error tracking/SLO/dashboard)** — 7-8 pillars each × 5 repos = 35-40
- **DS L64-L68 SSOT (SPEC.md, glossary, ADR-link)** — 3 pillars each × 5 repos = 15
- **SEC L47 (input validation), L49 (dep audit), L53 (SBOM), L54 (SLSA), L55 (CVE scan)** — 5 pillars each × 5 repos = 25
- **GS L69-L71 governance (CODEOWNERS, SUPPORT, release-policy)** — 3 pillars each × 5 repos = 15

## Recommended next batch (T13 batch 10) priorities

1. **T15.x: SPEC.md for all 5 repos** — single biggest gap closure, +5 pillars (102 → 107)
2. **T15.x: `examples/` for all 5 repos** — second-biggest gap closure, +5 (107 → 112)
3. **T22.8-T22.12: pheno-tracing + structlog on all 5** — closes biggest OO gap, +10 (112 → 122)
4. **T17.x: doc tests on pheno-mcp-router + pheno-vibecoding-guard + pheno-worklog-schema** — closes ADR-015 v2.1 deprecation prep, +3 (122 → 125)
5. **T19.x: CODEOWNERS for all 5** — closes governance gap, +5 (125 → 130)
6. **T17.x: deny.toml / pip-audit config on 4/5** — closes supply-chain gate gap, +4 (130 → 134)

**Biggest combined ROI:** items 1+2+3 in one batch = +20 pillars across 5 repos (102 → 122, 28.7% → 34.4%).

## Action items

- [ ] T15.x: SPEC.md for pheno-llms-txt, pheno-scaffold-kit, pheno-vibecoding-guard, pheno-worklog-schema (pheno-mcp-router's SPEC.md draft exists but not landed)
- [ ] T15.x: `examples/` directory for all 5
- [ ] T22.8-T22.12: `pheno-tracing` adoption on all 5 (structlog + OTLP stub)
- [ ] T17.x: doc tests in pheno-mcp-router + pheno-vibecoding-guard + pheno-worklog-schema
- [ ] T17.x: `deny.toml` / pip-audit config on 4/5 (pheno-scaffold-kit + pheno-vibecoding-guard already have trufflehog)
- [ ] T19.x: CODEOWNERS for all 5
- [ ] L8-012: register all 5 with pheno-drift-detector (L74)

## References

- `findings/71-pillar-2026-06-17-schema.md` — pillar definitions (L1-L74)
- `findings/2026-06-18-T13-x-71-pillar-audit-4-repos.md` — prior batch template (4 Rust repos)
- `findings/2026-06-18-T13-x-71-pillar-audit-3-repos-batch-7.md` — prior batch (pheno-otel, pheno-cargo-template, pheno-go-ctxkit)
- `findings/2026-06-18-T13-9-audit-pheno-llms-txt.md` through `T13-13` — per-repo originals
- ADR-024 — 71-pillar audit framework
- ADR-040 — coverage gates per tier
- ADR-041 — Predictive DRY (L72)
- ADR-042 — Substrate graduation path (L73)
- ADR-043 — App-substrate drift detector (L74)
- ADR-013 — pheno-mcp-router substrate
- ADR-014 — Hexagonal L4 ports (Port trait + Adapter)
- ADR-015 / ADR-025 — WORKLOG schema v2.0 / v2.1
- ADR-035 — security-tool ownership
- L5-104 — Dmouse92 absorption (6 modules absorbed into pheno-mcp-router)