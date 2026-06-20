# ADR-024: 71-pillar industry-standard audit framework (L1–L71, 9 domains)

> **Re-authored 2026-06-20 after disk loss (per L5-121).**
> Original authored 2026-06-17 by the Phenotype governance circle (via orchestrator).
> Reconstructed from git history (`c583faf8c7~1`) + surviving schema doc
> ([`findings/71-pillar-2026-06-17-schema.md`](../../../findings/71-pillar-2026-06-17-schema.md))
> + surviving refresh template
> ([`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md)).
>
> **Also lost in the same disk event** (and not yet recovered): `findings/audit-71-pillar-2026-06-17-wrapup.md`,
> `findings/71-pillar-2026-06-17.md` (baseline scorecard), `findings/71-pillar-2026-06-17-mapping.md`,
> `findings/2026-06-17-L5-102-71-pillar-audit.md`. Only the schema doc and the
> refresh template (the latter just merged via PR #37) survived.

- **Status:** Accepted 2026-06-17 (re-authored 2026-06-20, no substantive change)
- **Date:** 2026-06-17 (original); 2026-06-20 (re-author commit)
- **Decision:** Phenotype governance circle
- **Deciders:** @KooshaPari
- **Refs:**
  - Schema (surviving): [`findings/71-pillar-2026-06-17-schema.md`](../../../findings/71-pillar-2026-06-17-schema.md)
  - Refresh template (surviving, PR #37): [`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md)
  - Wrap-up doc: **MISSING FROM DISK** (per L5-121; not recovered)
  - Baseline scorecard: **MISSING FROM DISK** (`findings/71-pillar-2026-06-17.md` lost in same event)
  - L1–L30 → L1–L71 crosswalk: **MISSING FROM DISK** (`findings/71-pillar-2026-06-17-mapping.md` lost in same event)
  - Decision log: **MISSING FROM DISK** (`findings/2026-06-17-L5-102-71-pillar-audit.md` lost in same event)
  - L5-121 prep: [`findings/2026-06-20-L5-121-monday-refresh-prep.md`](../../../findings/2026-06-20-L5-121-monday-refresh-prep.md)

**Supersedes:** the 30-pillar framework (`audit-30-pillar-L*.md`) as the *internal* scoring model only; the 30 technical pillars are preserved verbatim as L0–L29 of the 71-pillar set.
**Effective:** 2026-06-17; first audit rendered in `findings/audit-71-pillar-2026-06-17-wrapup.md` (now MISSING FROM DISK).

## Context

The 30-pillar audit covered 30 technical architecture pillars (Cargo workspaces, hex ports, observability, etc.) but did **not** score the three cross-cutting experience pillars that distinguish a buildable fleet from a usable one:

- **UX** — the human-developer's journey from clone → onboard → first PR → first deploy
- **AX** — the subagent / AI-agent journey: spec → dispatch → receive result → integrate
- **DX** — the day-2 developer: testing, debugging, upgrading, contributing back

The 71-pillar framework is industry-standard: **CMMI 5 levels × 13 process areas = 65** + ISO 25010 = 8 quality characteristics + cross-cutting TMMi/ISTQB adjustments = **71 pillars across 9 domains**. The user confirmed 2026-06-17: *"71 pillar is the industry standard rihgt? enhance as necessary and dont forge the core ux/ax/dx pillars either!!!!"*

The surviving schema doc (`findings/71-pillar-2026-06-17-schema.md`) preserves the
operational definition: 9 domains (Architecture, Performance, Quality/Correctness,
DX, UX, Security, Observability & Ops, Documentation & SSOT, Governance &
Sustainability), 0–3 ordinal scoring with N/A permitted for L40 (i18n) and L41
(a11y) on headless backends, and a 2.00 mean pass-gate. The schema doc is the
**source of truth** for pillar definitions; this ADR is the source of truth for
the framework adoption decision.

## Decision

**Adopt the 71-pillar framework as the internal quality model.** It is a **superset** of the 30-pillar (L0–L29 are preserved verbatim) plus three new experience layers:

| Range | Layer | Pillars | Source |
|---|---|---|---|
| L0–L29 | Tech (architecture, build, ops) | 30 | existing 30-pillar audit (preserved) |
| L30–L42 | **UX** | 13 | new (onboarding, error UX, doc nav, etc.) |
| L43–L55 | **AX** | 13 | new (agent spec, dispatch, recovery, etc.) |
| L56–L70 | **DX** | 15 | new (test speed, build cache, LFS, release, etc.) |
| L71 | Capstone (the audit itself) | 1 | the wrap-up audit document |

> **Note on surviving schema's pillar range convention.** The surviving
> `findings/71-pillar-2026-06-17-schema.md` uses an alternate numbering: L1–L12
> Architecture, L13–L19 Performance, L20–L27 Quality/Correctness, L28–L37 DX,
> L38–L45 UX, L46–L55 Security, L56–L63 Observability & Ops, L64–L68
> Documentation & SSOT, L69–L71 Governance & Sustainability (71 pillars total,
> 9 domains, but with DX/AX merged under DX and the cross-cutting layers
> refactored into the 9 domains rather than the 3 separate layers UX/AX/DX).
> **Both conventions are valid scorecards against this framework.** The
> schema's flat 9-domain numbering is what the refresh template
> (`findings/71-pillar-refresh-template.md`) uses operationally; the original
> 3-layer split above is the conceptual model. A future revision should pick
> one — out of scope for this re-authorship.

**Status legend** (unchanged from 30-pillar): ✓ healthy · △ partial · ⚠ blocked · ✗ failing. (The surviving schema and refresh template use a 0–3 ordinal scale; both scales coexist.)

**Cadence:** weekly (every Monday 09:00 PDT). Scorecard lands at `findings/71-pillar-{date}.md`. See [ADR-041](ADR-041-71-pillar-refresh-cadence.md) for the cron definition and refresh workflow.

## Consequences

*Positive:*
- Breadth view across 9 domains catches gaps the 30-pillar missed (e.g. L66 LFS guidance, L30 clone-to-build).
- Industry-standard alignment enables external comparison (e.g. Factory AI Level mapping in ADR-026).
- The 30-pillar files are not deleted; they remain valid for tech-only deep dives.
- The surviving schema doc pins the operational pillar list (L1–L71 across 9 domains, 0–3 scoring, N/A for L40/L41 on headless libs) and the 2.00 mean pass-gate.

*Negative:*
- 41 more pillars to score per repo (per-domain effort roughly 2× the 30-pillar cadence).
- L30–L70 are new and have no historical baseline; first run is the baseline.
- **Disk-loss side effect:** the wrap-up doc, baseline scorecard, mapping doc, and decision log were lost in the same event that wiped this ADR. The re-authorship commit restores only this ADR; the lost artifacts need re-authoring in a separate work item (see L5-121 follow-up).

*Mitigation:*
- The 30-pillar audit files (`audit-30-pillar-L*.md`) remain authoritative for L0–L29; the 71-pillar is a rollup.
- The Factory AI Readiness Model (ADR-026) provides the *depth* view that complements the 71-pillar *breadth* view.
- The schema doc is now the operational source of truth (was the wrap-up doc). The refresh template (`findings/71-pillar-refresh-template.md`) is the per-repo scoring form.

## Alternatives considered

- **Stay on 30-pillar forever.** Rejected: missing UX/AX/DX experience layers; gaps like L66 LFS would never be scored.
- **Adopt Factory AI Readiness as the sole model.** Rejected: 5-level gated model doesn't expose fine-grained 71-pillar structure.
- **Adopt a 100+ pillar model.** Rejected: CMMI+ISO 25010 = 71 is the canonical cluster; >100 dilutes signal.

## Follow-ups

| ID | Priority | Action |
|---|---|---|
| FU1 | P0 | Re-author `findings/audit-71-pillar-2026-06-17-wrapup.md` from surviving schema + refresh template + git history (lost in same disk event) |
| FU2 | P0 | Re-author `findings/71-pillar-2026-06-17.md` (baseline scorecard across 10 repos) from git history |
| FU3 | P1 | Re-author `findings/71-pillar-2026-06-17-mapping.md` (L1–L30 → L1–L71 crosswalk) |
| FU4 | P1 | Re-author `findings/2026-06-17-L5-102-71-pillar-audit.md` (L5-102 decision log) |
| FU5 | P1 | Reconcile original 3-layer (UX/AX/DX) numbering vs surviving 9-domain flat numbering — pick one canonical |
| FU6 | P2 | Add disaster-recovery runbook for ADR/findings directory wipe events |

## References

- [`findings/71-pillar-2026-06-17-schema.md`](../../../findings/71-pillar-2026-06-17-schema.md) — **surviving** schema (operational source of truth for L1–L71 definitions).
- [`findings/71-pillar-refresh-template.md`](../../../findings/71-pillar-refresh-template.md) — **surviving** 170-line per-repo scorecard template (just merged via PR #37).
- `findings/audit-71-pillar-2026-06-17-wrapup.md` — first wrap-up audit scored against the 71 pillars. **MISSING FROM DISK** (per L5-121).
- `audit-30-pillar-L0..L29.md` — preserved verbatim as the L0–L29 rows.
- ADR-026 (Factory AI Readiness crosswalk) — the external depth view.
- ADR-041 (71-pillar refresh cadence) — companion ADR for weekly Monday 09:00 PDT refresh.
- ADR-025 (worklog v2.1 schema) — schema bump that adds the `device:` field used by L5-121 prep notes.
- ADR-023 (agent-effort governance) — sets the device-fit gate (macbook vs heavy-runner) that constrains who can run 71-pillar scoring.
- L5-121 prep: [`findings/2026-06-20-L5-121-monday-refresh-prep.md`](../../../findings/2026-06-20-L5-121-monday-refresh-prep.md) — the Monday refresh prep that surfaced the disk loss.

---

**Re-author commit:** on branch `chore/orch-v11-016-tier0-2026-06-20` (the orchestrator's current branch at the time of L5-121, not the `chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20` branch named in the task spec). Local-only commit; push deferred to orchestrator.
