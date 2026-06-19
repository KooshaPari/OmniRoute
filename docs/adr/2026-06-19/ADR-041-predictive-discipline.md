# ADR-041: Predictive discipline (L72, v1.1 71-pillar PAX domain)

**Date:** 2026-06-19
**Status:** PROPOSED
**Authors:** orchestrator + forge subagent (L5-110/111/112/113 audit wave)
**Refs:**
- `findings/71-pillar-2026-06-19.md` §0, §3, §9 (L72 PAX domain, v1.1 framework)
- `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` §6, §8, §9
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (L5-104 migration context)
- `pheno-predict` (`KooshaPari/pheno-predict`; commit `21666b3`)
- ADR-016 (fork-only-not-rewrite for SOTA libraries — see L5-112 §4.2 on `jscpd`)
- ADR-024 (71-pillar audit framework, v1.0)
- `docs/adr/2026-06-18/ADR-041-substrate-audit-cadence.md` (v1.0 ADR-041; **different subject**, retained per spec)

> **Number-collision note (intentional).** v1.0 ADR-041 in `docs/adr/2026-06-18/` is *Substrate audit cadence (quarterly)* — an unrelated audit-cadence policy. v1.1 ADR-041 (this file) is the *Predictive discipline* pillar of the PAX extension (L72). Both ADRs exist; the date dir + slug disambiguate. The v1.1 scorecard (`findings/71-pillar-2026-06-19.md:42, 122, 215`) cites the v1.1 PAX assignment, not the v1.0 cadence.

---

## Context

The 71-pillar framework (ADR-024) currently covers 9 domains × 71 pillars (L1–L71). The 2026-06-19 weekly scorecard (`findings/71-pillar-2026-06-19.md`) introduces a planned 10th domain — **PAX (Predictive, Audit, eXecution) — L72–L74** — to capture three discipline areas that fall outside the v1.0 schema: predictive-DRY scanning, substrate-graduation linting, and app→substrate drift detection.

L72 (Predictive discipline) is the **first** PAX pillar. The 2026-06-19 scorecard (line 122) names `pheno-predict` (a 375-line stdlib-only Python token-shingle Jaccard similarity scanner) as the L72 measurement instrument; the tool's algorithm, CLI, and JSON/CSV/MD output formats are all called out as the L72 measurement surface. The scorecard also records an L72 fleet average of 1.9 (out of 3.0) across 20 repos, with 4 repos scoring 3 (Configra, pheno-zod-schemas, pheno-errors, pheno-port-adapter, pheno-context — Rust type-state + `thiserror` + input-validation patterns prevent whole classes of runtime errors).

**Why L72 needs a separate ADR.** L72 is a *discipline* (predictive: anticipate duplication before it becomes debt), not a *pillar of measurement* (unlike L20 unit coverage, L24 formatting). L72 lives in the PAX domain because (a) it operates on the *intent* layer (what code is *about* to duplicate), (b) it is fleet-wide (cross-repo, not per-repo), and (c) it produces **candidate lists** that require human sign-off (criteria 2+3 of the heuristic pre-check are HUMAN; per `pheno-predict/pheno_predict.py:232-263`). L72 is **not** a quality gate that can be enforced in CI; it is a *signal generator* that the orchestrator reviews during wave planning.

**Why a Python stdlib-only tool is the right L72 instrument.** The fleet has zero existing implementation of cross-repo similarity detection (`L5-112 §4.3` is exhaustive on parity). The SOTA alternative (`jscpd`, named in 71-pillar schema L27) is a Node + 30+ language plugin tool not in the fleet; per ADR-016, the fleet would either fork or wrap `jscpd`, not reimplement. A stdlib-only Python tool is justified for the cron/automation use case (no Node dependency, no plugin maintenance, runs on the heavy-runner under MacBook-guarded `device:heavy-runner` policy per ADR-023). The 5 patches in L5-112 §9 close the substrate-quality-bar gaps (tests, SPEC, CI, deny.toml, LICENSE) so the tool meets ADR-023 Rule 3.1.

## Decision

**L72 (Predictive discipline) is the first PAX pillar of the v1.1 71-pillar framework. Its measurement instrument is `pheno-predict` (`KooshaPari/pheno-predict`); the weekly Monday 09:00 PDT cron (ADR-044) runs the tool against the fleet and posts `predictive-dry`-labelled issues to `KooshaPari/phenotype-org-audits`. The v1.1 scorecard (`findings/71-pillar-2026-06-19.md`) is the canonical scoring rubric.**

### L72 scoring rubric (0-3 scale, per `findings/71-pillar-2026-06-19.md:122`)

| Score | Meaning | Detection signal |
|---:|---|---|
| 0 | Absent — repo is wholly reactive; no predictive discipline | No type-state / `thiserror` / input-validation patterns; `pheno-predict` produces >10 candidates referencing this repo |
| 1 | Minimal — partial type-safety, partial input validation; some predictive value | `thiserror` or input-validation in 1-2 files; `pheno-predict` produces 5-10 candidates |
| 2 | Adequate — type-state + `thiserror` + input validation across the public API; suppresses most runtime-error classes | All public API functions return `Result`/raise typed exceptions; `pheno-predict` produces 1-4 candidates |
| 3 | Strong — Rust `enum` state machines + `thiserror` + `derive_more` + custom validators; predictive discipline prevents most *whole-classes* of runtime errors | No candidate `pheno-predict` pairs in last 30 days; L20 coverage ≥ 80%; no `unwrap()`/`panic!` in non-test code |

**Note:** L72 is currently scored manually by the worklog-schema circle each Monday (file/line signal probe + 0-3 scale). A future ADR may codify an automated `pheno-predict scan --pillar l72` adapter; out of scope for v1.1.

### L72 instrument contract

- **Repository:** `KooshaPari/pheno-predict` (status: PRESERVE per L5-112 §8.6; 5 patches in flight)
- **CLI:** `pheno-predict scan --target <repo> --baseline <other> --threshold 0.55 --format md`
- **Output:** 3 formats (`json` / `csv` / `md`); the cron uses `--format md` (the `--format gh-issues` README claim is broken; P1 patch in L5-112 §9.1 fixes it)
- **Schedule:** weekly Monday 09:00 PDT (combined with L73 + L74; see ADR-044)
- **Output consumer:** `KooshaPari/phenotype-org-audits` issues labelled `predictive-dry`; orchestrator triages during wave planning
- **Minimum fleet size:** ≥ 3 repos for candidate generation (single-repo runs are no-ops by design)

## Consequences

**Positive:**
- L72 is the **highest-scoring PAX pillar** (fleet avg 1.9 vs 1.4 for L73 and L74) — the existing type-state / `thiserror` / input-validation patterns across 5 substrate repos already constitute a meaningful L72 signal.
- Cross-repo similarity detection now has a canonical instrument; the SOTA alternative (`jscpd`) is documented in L5-112 §4.2 for future SOTA-sweep consideration.
- Pillar scoring is reproducible (same input → same output); the weekly Monday cron re-scores all 20 repos and re-emits the scorecard.
- The 5 L5-112 patches (P1-P5) close the substrate-quality-bar gaps and align the tool with ADR-023 Rule 3.1 (lib tier: 80% coverage, 1-page SPEC, 1 concept doc, observability N/A for CLI, CI, worklog v2.1).

**Negative:**
- L72 is **not enforceable in CI** (it is a signal generator, not a quality gate). The orchestrator must triage candidate lists weekly; this is ~15 min/week of orchestrator time.
- The 5 L5-112 patches are a prerequisite for production-grade operation. Until they land, the tool is "Pre-hygiene" (per L6 health inventory) and the cron will run against an under-instrumented tool.
- The v1.0 ↔ v1.1 ADR-041 number collision requires consumers to disambiguate via the date dir + slug. A future v2.0 ADR sweep may renumber the v1.0 cadence ADRs; out of scope for this turn.

## Cross-references

- `findings/71-pillar-2026-06-19.md` §0 (L72 PAX line), §3 (L72 fleet avg), §9 (L72 tool citation)
- `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` §4.1, §6, §8, §9
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` §6 (G3 — same v1.0 ADR-041 conflict; same resolution)
- `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` §6.1 (same pattern for ADR-042/043)
- ADR-016 (fork-only-not-rewrite for SOTA libraries; `jscpd` consideration in L5-112 §4.2)
- ADR-024 (71-pillar v1.0 framework; the v1.1 extension is in flight)
- ADR-023 (substrate quality bar Rule 3.1; L5-112 §9.1 P3 patches close the gaps)
- ADR-044 (3-tool heavy-runner cron deployment; the L72 cron schedule)
- `pheno-predict/pheno_predict.py:1-376` (the L72 implementation)
- `pheno-predict/README.md:1-122` (the L72 user-facing doc; forward-looking v1.1 references per L5-112 §4.1 claims 1-20)

## Rollout plan

| Phase | Date | Action |
|:---|:---|:---|
| Phase 0 | 2026-06-19 | ADR-041 PROPOSED (this file) + v1.1 scorecard published |
| Phase 1 | 2026-06-20 | L5-112 P1-P5 patches land on `pheno-predict` (5 files × ~30 min each) |
| Phase 2 | 2026-06-23 (Mon 09:00 PDT) | First scheduled L72 run via ADR-044 cron; expect 0-3 candidate issues |
| Phase 3 | 2026-06-30 (Mon 09:00 PDT) | Second L72 run; reconcile with v1.1 scorecard L72 scores |
| Phase 4 | 2026-07-21 (5 weeks) | Re-evaluate ADR-041; if v1.1 framework is not cut over, switch to PROPOSED → DEPRECATED and switch ADR-044 to use the v1.0 L1-L71 framework only |
