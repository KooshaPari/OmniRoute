# ADR-042: Graduation discipline (L73, v1.1 71-pillar PAX domain)

**Date:** 2026-06-19
**Status:** PROPOSED
**Authors:** orchestrator + forge subagent (L5-110/111/112/113 audit wave)
**Refs:**
- `findings/71-pillar-2026-06-19.md` §0, §3, §9 (L73 PAX domain, v1.1 framework)
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` §6 (G3 — same v1.0 ADR-042 conflict; same resolution)
- ADR-014 (Hexagonal L4 Port/Adapter — codifies the port-trait / adapter-impl detection that L73 enforces)
- ADR-018 (PRCP — Polyglot Reuse via Canonical Ports; L73 detects pyo3 / uniffi / wasm_bindgen / pyimport / grpc markers)
- ADR-022 (config consolidation — two-crate canonical split; L73 enforces the lib vs SDK vs framework vs service placement)
- ADR-023 (substrate placement policy — 4-tier rule that L73 enforces; the source of the 4 `TIER_PATTERNS` regexes)
- ADR-038 (hexagonal L4 port/adapter L4 policy — codifies ADR-014; L73 enforces it)
- ADR-024 (71-pillar v1.0 framework; the v1.1 extension is in flight)
- `pheno-framework-lint` (`KooshaPari/pheno-framework-lint`; commit `9862abe`)
- `pheno-framework-lint/pheno_framework_lint.py:1-473` (the L73 implementation)
- `pheno-framework-lint/README.md:1-124` (the L73 user-facing doc; L5-110 §5 catalog of 33 items)
- `docs/adr/2026-06-18/ADR-042-security-audit-cadence.md` (v1.0 ADR-042; **different subject**, retained per spec)

> **Number-collision note (intentional).** v1.0 ADR-042 in `docs/adr/2026-06-18/` is *Security audit cadence (monthly)* — an unrelated audit-cadence policy. v1.1 ADR-042 (this file) is the *Graduation discipline* pillar of the PAX extension (L73). Both ADRs exist; the date dir + slug disambiguate. The v1.1 scorecard (`findings/71-pillar-2026-06-19.md:42, 123, 216`) cites the v1.1 PAX assignment, not the v1.0 cadence.

---

## Context

L73 (Graduation discipline) is the **second** PAX pillar of the v1.1 71-pillar framework. The 2026-06-19 scorecard (`findings/71-pillar-2026-06-19.md:123`) names `pheno-framework-lint` (a 473-line stdlib-only Python tier-convention linter) as the L73 measurement instrument; the tool's 10 tier-specific rules across 4 substrate patterns, plus 2 CLI subcommands, are the L73 enforcement surface. The scorecard also records an L73 fleet average of 1.4 (out of 3.0) across 20 repos, with 3 repos scoring 3 (AgilePlus, pheno, Configra — all have `release-plz.toml` + CHANGELOG + deprecation warnings).

L73 enforces the **4-tier substrate placement policy** from ADR-023: every fleet repo must be classified as exactly one of `pheno-*-lib`, `phenotype-*-sdk`, `phenotype-*-framework`, or `federated-service`. The linter detects tier violations via:

- **Tier inference** from repo name (4 regexes: `pheno-*-lib` / `phenotype-*-sdk` / `phenotype-*-framework` / `federated-service`; `pheno_framework_lint.py:45-50`).
- **10 tier-specific rules** across the 4 substrate patterns (e.g. `pheno-*-lib` cannot contain `domain/` or business-logic markers; `phenotype-*-framework` must have port-traits + adapter-impls + IoC-lifecycle; `federated-service` must have deploy-config + health-endpoint; `pheno_framework_lint.py:137-361`).
- **PRCP marker detection** (5 regexes: `pyo3`, `uniffi::`, `wasm_bindgen`, `pyimport`, `grpc`) for ADR-018 polyglot enforcement; `pheno_framework_lint.py:79-85`.
- **Port/Adapter detection** (3 regexes: `trait X {`, `interface X {`, `protocol X`) for ADR-014 / ADR-038 hexagonal enforcement; `pheno_framework_lint.py:88-92`.
- **Business-logic-marker detection** (5 regexes: `domain/`, `usecase`, `app/`, `controller`, `handler`) for pheno-*-lib purity enforcement; `pheno_framework_lint.py:53-59`.

L73 is the **only** enforcement mechanism in the fleet for the 4-tier placement policy. The 8 candidate targets in L5-110 §4 (phenotype-registry, pheno-scaffold-kit, pheno-context, pheno-llms-txt, pheno-prompt-test, phenotype-python-sdk, pheno-worklog-schema, pheno-vibecoding-guard) plus 3 sibling governance tools (L72 pheno-predict, L74 pheno-drift-detector, pheno-secret-scan) have **zero parity** with `pheno-framework-lint` (L5-110 §4 verdict: "0 of 11 inspected targets implements any of these 7 features"). Deleting the source would delete the only canonical implementation of the 10 L73 rules.

## Decision

**L73 (Graduation discipline) is the second PAX pillar of the v1.1 71-pillar framework. Its measurement + enforcement instrument is `pheno-framework-lint` (`KooshaPari/pheno-framework-lint`); the weekly Monday 09:00 PDT cron (ADR-044) runs the tool against the fleet and posts `framework-lint`-labelled issues to `KooshaPari/phenotype-org-audits`. The v1.1 scorecard (`findings/71-pillar-2026-06-19.md:123`) is the canonical scoring rubric.**

### L73 scoring rubric (0-3 scale, per `findings/71-pillar-2026-06-19.md:123`)

| Score | Meaning | Detection signal |
|---:|---|---|
| 0 | Absent — repo violates ≥ 5 of 10 tier rules; no graduation gate | `pheno-framework-lint check` exits 2 with ≥ 5 violations |
| 1 | Minimal — repo has deprecation warnings but no CHANGELOG; partial release-plz | Deprecation warnings present; no `release-plz.toml`; CHANGELOG absent or auto-generated |
| 2 | Adequate — repo meets ≥ 7 of 10 tier rules; has CHANGELOG + `release-plz.toml`; lint exits 1 (warnings only) | Lint exit 1; 7-9 rules pass; CHANGELOG + release-plz present |
| 3 | Strong — repo meets all 10 tier rules; has `release-plz.toml` + CHANGELOG + deprecation warnings + version-pinned tags + SPEC.md citing ADR-023 | Lint exit 0; all 10 rules pass; full graduation metadata present |

**Note:** L73 is the only PAX pillar with **CI-enforceable** rules (exit codes 0/1/2 map to pass/warn/fail). The other two PAX pillars (L72, L74) are signal generators, not quality gates.

### L73 instrument contract

- **Repository:** `KooshaPari/pheno-framework-lint` (status: PRESERVE per L5-110 §1; 5 patches in flight)
- **CLI:** `pheno-framework-lint check --path <repo>` (single-repo) or `pheno-framework-lint check-all --root <dir> [--out <file>]` (fleet-wide)
- **Output:** JSON via `--format json` (default stdout) or markdown via `--format md`; exit 0 (no violations), 1 (warnings), 2 (errors)
- **Schedule:** weekly Monday 09:00 PDT (combined with L72 + L74; see ADR-044)
- **Output consumer:** `KooshaPari/phenotype-org-audits` issues labelled `framework-lint`; orchestrator triages during wave planning
- **CI integration:** per `pheno-framework-lint/README.md:95-109`, add to `.github/workflows/ci.yml` per substrate repo; the 10 rules are the gate; the example workflow is documentation, not yet implemented (L5-110 §5 row 32 patch)

## Consequences

**Positive:**
- L73 is the **only** CI-enforceable PAX pillar — the 10 tier rules can block PRs that violate the 4-tier placement policy. This closes the L5-110 §6 G6 gap (no umbrella for the L72/L73/L74 trio; L73 acts as the canonical enforcer).
- The 4-tier placement policy (ADR-023 Rule 3) now has a **canonical enforcement instrument** — previously the policy was doc-only.
- Cross-reference: L73 detects port-traits (ADR-014 / ADR-038) and PRCP markers (ADR-018), so the 3 hexagonal/polyglot ADRs are now operationally enforced by a single tool.
- Pillar scoring is reproducible and **CI-runnable** (vs L72/L74 which are signal generators).

**Negative:**
- L73 currently has a **lowest fleet average** of any PAX pillar tied with L74 (1.4 vs L72's 1.9) — 17 of 20 repos fail to meet all 10 tier rules. The first 1-2 weekly runs will produce a high PR-queue volume (~28 PRs as estimated in the L5-110 §3 inventory).
- The 5 L5-110 patches (P1-P5, same pattern as L5-112) are a prerequisite for production-grade operation. Until they land, the tool is "Pre-hygiene" and the cron will run against an under-instrumented tool.
- The v1.0 ↔ v1.1 ADR-042 number collision requires consumers to disambiguate via the date dir + slug.

## Cross-references

- `findings/71-pillar-2026-06-19.md` §0 (L73 PAX line), §3 (L73 fleet avg), §9 (L73 tool citation)
- `findings/2026-06-18-L5-110-pheno-framework-lint-absorption-audit.md` §4, §5, §6
- `findings/2026-06-18-L5-111-pheno-drift-detector-absorption-audit.md` §6.10 (sibling analysis: same pattern as L73/L74 trio)
- `findings/2026-06-18-L5-112-pheno-predict-absorption-audit.md` §4.1 (sibling forward-looking cross-refs)
- ADR-014, ADR-038 (hexagonal L4 port/adapter — what L73 detects)
- ADR-018 (PRCP — what L73 detects)
- ADR-022 (config consolidation — what L73 enforces for config-tier repos)
- ADR-023 (substrate placement policy — the 4-tier rule that L73 enforces)
- ADR-024 (71-pillar v1.0; the v1.1 extension is in flight)
- ADR-044 (3-tool heavy-runner cron deployment; the L73 cron schedule)
- `pheno-framework-lint/pheno_framework_lint.py:1-473` (the L73 implementation)
- `pheno-framework-lint/README.md:1-124` (the L73 user-facing doc)

## Rollout plan

| Phase | Date | Action |
|:---|:---|:---|
| Phase 0 | 2026-06-19 | ADR-042 PROPOSED (this file) + v1.1 scorecard published |
| Phase 1 | 2026-06-20 | L5-110 P1-P5 patches land on `pheno-framework-lint` (5 files × ~30 min each) |
| Phase 2 | 2026-06-23 (Mon 09:00 PDT) | First scheduled L73 run via ADR-044 cron; expect 5-15 violations across fleet |
| Phase 3 | 2026-06-30 (Mon 09:00 PDT) | Second L73 run; reconcile with v1.1 scorecard L73 scores; file remediation PRs |
| Phase 4 | 2026-07-21 (5 weeks) | Re-evaluate ADR-042; if v1.1 framework is not cut over, switch to PROPOSED → DEPRECATED |
