# ADR-043: Drift-detection discipline (L74, v1.1 71-pillar PAX domain)

**Date:** 2026-06-19
**Status:** PROPOSED
**Authors:** orchestrator + forge subagent (L5-110/111/112/113 audit wave)
**Refs:**
- `findings/71-pillar-2026-06-19.md` §0, §3, §9 (L74 PAX domain, v1.1 framework)
- `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` §6, §8, §9
- `ops/heavy-runner-cron/INSTALL.md:5, 7, 47-49, 100-104, 178, 185` (the operational deployment consumer)
- `ops/heavy-runner-cron/FIRST_RUN_MOCKUP.md` (planned first-run output)
- `ops/heavy-runner-cron/MONITORING.md:14-19, 50-54, 64-71, 84-92, 110` (cron monitoring)
- ADR-023 (substrate placement policy — the 4-tier rule that L74 enforces via PAUSED/CONDITIONAL/CAPSTONE capability extraction)
- ADR-024 (71-pillar v1.0 framework; the v1.1 extension is in flight)
- ADR-029 (Dmouse92 → KooshaPari migration — exemplar of capability-extraction PR pattern)
- ADR-035 (HwLedger reclassification — exemplar of CONDITIONAL → KEEP-archived)
- `pheno-drift-detector` (`KooshaPari/pheno-drift-detector`; commit `32c8d4d`)
- `pheno-drift-detector/pheno_drift_detector.py:1-413` (the L74 implementation)
- `pheno-drift-detector/README.md:1-111` (the L74 user-facing doc; L5-111 §4.1 catalog of 13 claims)
- `docs/adr/2026-06-18/ADR-043-registry-refresh-cadence.md` (v1.0 ADR-043; **different subject**, retained per spec)

> **Number-collision note (intentional).** v1.0 ADR-043 in `docs/adr/2026-06-18/` is *Registry refresh cadence (quarterly)* — an unrelated audit-cadence policy. v1.1 ADR-043 (this file) is the *Drift-detection discipline* pillar of the PAX extension (L74). Both ADRs exist; the date dir + slug disambiguate. The v1.1 scorecard (`findings/71-pillar-2026-06-19.md:42, 124, 217`) cites the v1.1 PAX assignment, not the v1.0 cadence.

---

## Context

L74 (Drift-detection discipline) is the **third** PAX pillar of the v1.1 71-pillar framework. The 2026-06-19 scorecard (`findings/71-pillar-2026-06-19.md:124`) names `pheno-drift-detector` (a 413-line stdlib-only Python app-substrate drift scanner) as the L74 measurement instrument; the tool's 3-pass algorithm (discover app repos, find capabilities, score) plus 3 renderers (json / md / gh-issues) are the L74 enforcement surface. The scorecard also records an L74 fleet average of 1.4 (out of 3.0) across 20 repos, with 1 repo scoring 3 (Configra — has `audit_scorecard.json` + `release-drafter`).

L74 enforces the **PAUSED / CONDITIONAL / CAPSTONE capability-extraction signal** from ADR-023 Rule 3. The 7 PAUSED + 2 CONDITIONAL + 5 CAPSTONE app repos (per `AGENTS.md § PAUSED APPs` table) currently have **no automated capability-extraction signal**. The drift detector's 3-pass algorithm:

1. **Discover** (`pheno_drift_detector.py:134-144`) — walk `--root` for sub-dirs matching the PAUSED_APPS / CONDITIONAL_APPS / CAPSTONE_APPS sets (multi-bucket support; a repo can be in both `paused` and `capstone`).
2. **Find capabilities** (`pheno_drift_detector.py:147-204`) — walk each candidate repo for top-level capability dirs, apply `MIN_DIR_FILES=3` and `MIN_DIR_BYTES=5000` thresholds, detect port-trait / adapter-impl / test-pattern matches via 5 regexes.
3. **Score drift** (`pheno_drift_detector.py:211-246`) — `score = 1.0*n + 0.4*ports + 0.3*adapters + 0.3*tests`; substrate placement = `phenotype-*-framework` (≥2 ports + ≥2 adapters) / `phenotype-*-sdk` (≥1 of each) / `pheno-*-lib` (≥1 port) / `(TBD)`; threshold `DRIFT_THRESHOLD = 1.5`.

L74 is the **only** tool in the fleet that performs *content-based* capability detection (port / adapter / test regex matching across 12 languages). The 9 candidate targets in L5-111 §6 (phenotype-registry, pheno-scaffold-kit, phenotype-org-audits, pheno-context, pheno-llms-txt, phenotype-python-sdk, pheno-prompt-test, pheno-cargo-template) plus 2 sibling governance tools (L72 pheno-predict, L73 pheno-framework-lint) have **zero parity** with `pheno-drift-detector` (L5-111 §6 verdict: "Net target parity: 0 of 8 candidate targets replaces the drift detector").

The README's "Retroactive hits" table (L5-111 §4.1 claim 7) claims HwLedger (CONDITIONAL, 2.4), Dino (CONDITIONAL, 1.9), and AtomsBot* (CAPSTONE, 0.8) are the expected first hits — these are the same repos called out in ADR-023, ADR-035, and the AGENTS.md "PAUSED APPs" table. The cron first run is **scheduled for 2026-06-23 09:00 PDT** (5 days from this ADR); per `ops/heavy-runner-cron/INSTALL.md:185`, the operational doc references `ADR-044` for the cron deployment, which this wave is also authoring.

## Decision

**L74 (Drift-detection discipline) is the third PAX pillar of the v1.1 71-pillar framework. Its measurement instrument is `pheno-drift-detector` (`KooshaPari/pheno-drift-detector`); the weekly Monday 09:00 PDT cron (ADR-044) runs the tool against the fleet and posts `drift-detector`-labelled issues to `KooshaPari/phenotype-org-audits`. The v1.1 scorecard (`findings/71-pillar-2026-06-19.md:124`) is the canonical scoring rubric.**

### L74 scoring rubric (0-3 scale, per `findings/71-pillar-2026-06-19.md:124`)

| Score | Meaning | Detection signal |
|---:|---|---|
| 0 | Absent — no drift-detection discipline; PAUSED/CONDITIONAL/CAPSTONE capabilities evolve unchecked | Repo is in PAUSED_APPS / CONDITIONAL_APPS / CAPSTONE_APPS set per `pheno-drift-detector.py:47-55`; capability extraction never triggered; no `audit_scorecard.json` or `release-drafter` workflow |
| 1 | Minimal — repo has `deny.toml` (implicit supply-chain hygiene); no explicit drift workflow | `deny.toml` present; no `audit_scorecard.json`; no weekly drift cron output referencing this repo |
| 2 | Adequate — repo has explicit `drift.yml` GitHub Actions workflow + `cargo-deny`; capabilities reviewed quarterly | `drift.yml` workflow present; `cargo-deny` clean; manual quarterly review of capability dirs |
| 3 | Strong — repo has `audit_scorecard.json` + `release-drafter` + weekly drift cron output + 71-pillar L74 score tracked | All 4 sub-signals present; L74 score in v1.1 scorecard; cron issues resolved within 7 days |

**Note:** L74 is currently scored manually by the worklog-schema circle each Monday (file/line signal probe + 0-3 scale). A future ADR may codify an automated `pheno-drift-detector scan --pillar l74` adapter; out of scope for v1.1.

### L74 instrument contract

- **Repository:** `KooshaPari/pheno-drift-detector` (status: PRESERVE per L5-111 §10.6; 5 patches in flight)
- **CLI:** `pheno-drift-detector scan --root <dir> --format md --out <file>` (full fleet) or `pheno-drift-detector validate --hit <json> --yes` (HITL gate per drift hit)
- **Output:** 3 formats (`json` / `md` / `gh-issues`); the cron uses `--format gh-issues` to auto-file GitHub issues
- **Schedule:** weekly Monday 09:00 PDT (combined with L72 + L73; see ADR-044)
- **Output consumer:** `KooshaPari/phenotype-org-audits` issues labelled `drift-detector`; orchestrator triages during wave planning; HITL gate via `pheno-drift-detector validate --yes` before any substrate-extraction PR
- **App bucket coverage:** PAUSED (4), CONDITIONAL (2), CAPSTONE (5); per `pheno_drift_detector.py:47-55` and AGENTS.md "PAUSED APPs" table
- **Minimum fleet size:** ≥ 1 PAUSED / CONDITIONAL / CAPSTONE app repo for drift generation (active repos are excluded by design)

## Consequences

**Positive:**
- L74 closes the **PAUSED/CONDITIONAL/CAPSTONE capability-extraction signal gap** that ADR-023 Rule 3 identified but had no automated tool for. The HwLedger / Dino / AtomsBot* retroactive hits provide immediate substrate-extraction candidates.
- The `pheno-drift-detector.py:47-55` hard-coded PAUSED_APPS / CONDITIONAL_APPS / CAPSTONE_APPS sets mirror the `AGENTS.md` "PAUSED APPs" table exactly; divergence is detectable via the weekly cron (a `pheno-drift-detector validate` against the AGENTS.md).
- The `gh-issues` renderer (`pheno_drift_detector.py:261-289`) auto-files GitHub issues with 5 sections per hit (header, score, target, rationale, capabilities table, suggested action, candidate paths) — orchestrator triages via standard `gh issue` workflow.
- L74 is a **signal generator** (not a quality gate), so weekly runs are idempotent and can be retro-applied to historical AGENTS.md "PAUSED APPs" deltas.

**Negative:**
- L74 is **not enforceable in CI** (it is a signal generator; the substrate-extraction PR is the gate). The orchestrator must triage drift hits weekly; this is ~15 min/week of orchestrator time.
- The 5 L5-111 patches (P1-P5, same pattern as L5-110/112) are a prerequisite for production-grade operation. Until they land, the tool is "Pre-hygiene" and the cron will run against an under-instrumented tool.
- The 7 PAUSED + 2 CONDITIONAL + 5 CAPSTONE app repos are a **moving target**; the `PAUSED_APPS` / `CONDITIONAL_APPS` / `CAPSTONE_APPS` sets must be re-verified quarterly with the AGENTS.md "PAUSED APPs" delta (per L5-111 §7 row 2). HwLedger is the most recent bucket change (PAUSED → CONDITIONAL per ADR-035, L5-105).
- The v1.0 ↔ v1.1 ADR-043 number collision requires consumers to disambiguate via the date dir + slug.

## Cross-references

- `findings/71-pillar-2026-06-19.md` §0 (L74 PAX line), §3 (L74 fleet avg), §9 (L74 tool citation)
- `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` §4.1, §5, §6, §8, §9
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` §5 row 31 (sibling analysis: same pattern as L72/L73/L74 trio)
- `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` §4.1 claim 13 (sibling forward-looking cross-ref)
- `ops/heavy-runner-cron/INSTALL.md:5, 7, 47-49, 100-104, 178, 185` (operational deployment; references ADR-044)
- `ops/heavy-runner-cron/FIRST_RUN_MOCKUP.md` (planned first-run output for 2026-06-23 09:00 PDT)
- `ops/heavy-runner-cron/MONITORING.md:14-19, 50-54, 64-71, 84-92, 110` (cron monitoring)
- ADR-023 (substrate placement policy — what L74 enforces via PAUSED/CONDITIONAL/CAPSTONE capability extraction)
- ADR-024 (71-pillar v1.0; the v1.1 extension is in flight)
- ADR-029 (Dmouse92 → KooshaPari migration — exemplar of capability-extraction PR pattern; 18 archived repos)
- ADR-035 (HwLedger reclassification — exemplar of CONDITIONAL → KEEP-archived)
- ADR-044 (3-tool heavy-runner cron deployment; the L74 cron schedule)
- `pheno-drift-detector/pheno_drift_detector.py:1-413` (the L74 implementation)
- `pheno-drift-detector/README.md:1-111` (the L74 user-facing doc; L5-111 §4.1 catalog of 13 claims, 8 of which are fabricated/wrong and require the 5-patch fix)

## Rollout plan

| Phase | Date | Action |
|:---|:---|:---|
| Phase 0 | 2026-06-19 | ADR-043 PROPOSED (this file) + v1.1 scorecard published |
| Phase 1 | 2026-06-20 | L5-111 P1-P5 patches land on `pheno-drift-detector` (5 files × ~30 min each) |
| Phase 2 | 2026-06-23 (Mon 09:00 PDT) | First scheduled L74 run via ADR-044 cron; expect 3-5 drift hits (HwLedger, Dino, AtomsBot*) |
| Phase 3 | 2026-06-30 (Mon 09:00 PDT) | Second L74 run; reconcile with v1.1 scorecard L74 scores; file substrate-extraction PRs |
| Phase 4 | 2026-07-21 (5 weeks) | Re-evaluate ADR-043; if v1.1 framework is not cut over, switch to PROPOSED → DEPRECATED |
