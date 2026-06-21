# SSOT — Single Source of Truth

This document records the canonical authority for cross-cutting facts.
When a fact conflicts across docs, the source listed here wins.

## Scope

| Domain | Authoritative source |
|---|---|
| Agent-effort governance | `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` |
| Worklog schema | `pheno-worklog-schema` v2.1 — 11-column `device:` enum |
| Config (Rust) | `KooshaPari/Configra` |
| Config (Python) | `pheno-config/` |
| Repo registry + disposition | `phenotype-registry/registry/disposition-index.json` |
| ADR index (2026-06-15) | `docs/adr/2026-06-15/INDEX.md` |
| 71-pillar refresh cadence | `docs/adr/2026-06-18/ADR-041-71-pillar-refresh-cadence.md` (weekly Mon 09:00 PDT) |
| v17 cycle-7 plan | `plans/2026-06-21-v17-71-pillar-cycle-7-p0.md` |
| v17 cycle-7 probe | `findings/2026-06-21-v17-cycle-7-probe.md` |
| v18 cycle-8 plan | `plans/2026-06-21-v18-71-pillar-cycle-8-p0.md` |
| v18 cycle-8 probe | `findings/2026-06-21-v18-cycle-8-probe.md` |
| Worktree orchestration | per ADR-018 PRCP — substrate work in `/private/tmp/<track>-<crate>-<date>`; this monorepo is the coordination hub only |

## Precedence order

1. Executable config (workflows, `justfile`, `Cargo.toml`)
2. `*.md` governance files in this SSOT table
3. The L5 governance ADRs (ADR-023 and successors) override any substrate
   decision where the conflict is "should the agent be working on this" —
   effort-decision is L5; substrate decisions are L3/L4.
4. Anything else.

## Updating this file

- Keep the table narrow and unambiguous.
- Cite the canonical file by path; do not duplicate content.
- Update via a governance commit referencing the change.
