# ADR-024: 71-pillar industry-standard audit framework (L1–L71, 9 domains)

**Status:** Accepted 2026-06-17 · **Deciders:** Phenotype governance circle
**Supersedes:** the 30-pillar framework (`audit-30-pillar-L*.md`) as the *internal* scoring model only; the 30 technical pillars are preserved verbatim as L0–L29 of the 71-pillar set.
**Effective:** 2026-06-17; first audit rendered in `audit-71-pillar-2026-06-17-wrapup.md`.

## Context

The 30-pillar audit covered 30 technical architecture pillars (Cargo workspaces, hex ports, observability, etc.) but did **not** score the three cross-cutting experience pillars that distinguish a buildable fleet from a usable one:

- **UX** — the human-developer's journey from clone → onboard → first PR → first deploy
- **AX** — the subagent / AI-agent journey: spec → dispatch → receive result → integrate
- **DX** — the day-2 developer: testing, debugging, upgrading, contributing back

The 71-pillar framework is industry-standard: **CMMI 5 levels × 13 process areas = 65** + ISO 25010 = 8 quality characteristics + cross-cutting TMMi/ISTQB adjustments = **71 pillars across 9 domains**. The user confirmed 2026-06-17: *"71 pillar is the industry standard rihgt? enhance as necessary and dont forge the core ux/ax/dx pillars either!!!!"*

## Decision

**Adopt the 71-pillar framework as the internal quality model.** It is a **superset** of the 30-pillar (L0–L29 are preserved verbatim) plus three new experience layers:

| Range | Layer | Pillars | Source |
|---|---|---|---|
| L0–L29 | Tech (architecture, build, ops) | 30 | existing 30-pillar audit (preserved) |
| L30–L42 | **UX** | 13 | new (onboarding, error UX, doc nav, etc.) |
| L43–L55 | **AX** | 13 | new (agent spec, dispatch, recovery, etc.) |
| L56–L70 | **DX** | 15 | new (test speed, build cache, LFS, release, etc.) |
| L71 | Capstone (the audit itself) | 1 | the wrap-up audit document |

**Status legend** (unchanged from 30-pillar): ✓ healthy · △ partial · ⚠ blocked · ✗ failing.

**Cadence:** weekly (every Monday 09:00 PDT). Scorecard lands at `findings/71-pillar-{date}.md`.

## Consequences

*Positive:*
- Breadth view across 9 domains catches gaps the 30-pillar missed (e.g. L66 LFS guidance, L30 clone-to-build).
- Industry-standard alignment enables external comparison (e.g. Factory AI Level mapping in ADR-026).
- The 30-pillar files are not deleted; they remain valid for tech-only deep dives.

*Negative:*
- 41 more pillars to score per repo (per-domain effort roughly 2× the 30-pillar cadence).
- L30–L70 are new and have no historical baseline; first run is the baseline.

*Mitigation:*
- The 30-pillar audit files (`audit-30-pillar-L*.md`) remain authoritative for L0–L29; the 71-pillar is a rollup.
- The Factory AI Readiness Model (ADR-026) provides the *depth* view that complements the 71-pillar *breadth* view.

## Alternatives considered

- **Stay on 30-pillar forever.** Rejected: missing UX/AX/DX experience layers; gaps like L66 LFS would never be scored.
- **Adopt Factory AI Readiness as the sole model.** Rejected: 5-level gated model doesn't expose fine-grained 71-pillar structure.
- **Adopt a 100+ pillar model.** Rejected: CMMI+ISO 25010 = 71 is the canonical cluster; >100 dilutes signal.

## References

- `findings/71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md` — full 71-pillar schema.
- `audit-71-pillar-2026-06-17-wrapup.md` — first wrap-up audit scored against the 71 pillars.
- `audit-30-pillar-L0..L29.md` — preserved verbatim as the L0–L29 rows.
- ADR-026 (Factory AI Readiness crosswalk) — the external depth view.
