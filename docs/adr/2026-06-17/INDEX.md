# ADR Index — 2026-06-17 (refreshed 2026-06-18 for v8)

This index lists the ADRs accepted on 2026-06-17 for the v7/v8 governance sweeps
(`plans/2026-06-17-v7-dag-stable.md`, `plans/2026-06-18-v8-dag-stable.md`).
All files live in this directory.

| #     | Title                                                                                | Status   | File                                                  |
| :---- | :----------------------------------------------------------------------------------- | :------- | :---------------------------------------------------- |
| 024   | 71-pillar industry-standard audit framework (L1–L71, 9 domains)                     | Accepted | `ADR-024-71-pillar-audit-framework.md`                |
| 025   | Worklog schema v2.1 (11th column `device:`) — supersedes v2.0 from ADR-015           | Accepted | `ADR-025-worklog-v2-1-device-column.md`               |
| 026   | Factory AI Agent Readiness Model as cross-cutting external standard                 | Accepted | `ADR-026-factory-ai-agent-readiness.md`               |
| 027   | Git LFS 3-tier policy (always-track / on-demand / never-track)                       | Accepted | `ADR-027-git-lfs-strategy.md`                         |
| 028   | Monorepo architecture eval: hybrid-with-staging-repo                                | Accepted | `ADR-028-monorepo-architecture-eval.md`               |
| 029   | Dmouse92 → KooshaPari migration — absorb all DM92 work to substrate, archive emptied | Accepted | `ADR-029-dmouse92-to-kooshapari.md`                   |
| 030   | Spine repos are read-only references (Decision D)                                    | Accepted | `ADR-030-spine-repos-readonly.md`                     |
| 031   | Configra as canonical config repo name (supersedes ADR-022 naming)                   | Accepted | `ADR-031-configra-absorb.md`                          |
| 032   | `pheno-worklog-schema` vs `AgilePlus` worklog format split (Decision B)              | Accepted | `ADR-032-pheno-worklog-schema-decision.md`            |
| 033   | `phenotype-monorepo-state` deletion plan (Decision C)                                | Accepted | `ADR-033-phenotype-monorepo-state-deletion.md`        |
| 034   | Monorepo-state deletion schedule + grace window                                      | Accepted | `ADR-034-monorepo-state-deletion-schedule.md`         |

## Scope

- **ADR-024** formalizes the 71-pillar audit framework (superset of 30-pillar + UX/AX/DX layers), replacing the prior 30-pillar as the *internal* scoring model.
- **ADR-025** adds the 11th `device:` column to the worklog schema (mandatory for new worklogs starting 2026-06-17; v2.0 deprecates 2026-06-22). Required by ADR-023 Rule 1 (device-fit gate).
- **ADR-026** adopts the Factory AI Agent Readiness Model as the cross-cutting external standard, pairing with the 71-pillar to give a *depth* view alongside the 71-pillar *breadth* view.
- **ADR-027** closes L66 (DX: git LFS guidance) with a 3-tier policy: always-track (iOS/Unity/Unreal/disk images/native libs), on-demand (release binaries/wheels/fixtures > 5 MB), never-track (source/configs/lockfiles/docs).
- **ADR-028** closes L25 (Monorepo Polyrepo Trade-off) with a hybrid model: keep the local monorepo for DX, add `KooshaPari/phenotype-org-audits` as the staging repo for governance artifacts.
- **ADR-029** (L5-104) executes the Dmouse92 → KooshaPari migration: 6 PRs opened, 18 repos archived, 0 net content loss. Dmouse92 token removed from keyring.
- **ADR-030** (Decision D) makes the 5 spine repos (PhenoHandbook, PhenoSpecs, phenotype-registry, phenotype-infra, phenokits-commons) read-only. Active governance lives in the local monorepo's `findings/`, `docs/adr/`, `plans/`.
- **ADR-031** renames the canonical config repo to `Configra` (KooshaPari/Configra), superseding ADR-022's two-crate split for *naming only*. `phenotype-config` is deprecated; `Conft` (TS edge) keeps its name.
- **ADR-032** resolves Decision B: `pheno-worklog-schema` (Python lib, markdown validation) and `AgilePlus` worklogs (JSONL, machine-readable) are **complementary, not duplicating**. Both stay. Future design session may merge.
- **ADR-033** resolves Decision C: `phenotype-monorepo-state` should not exist going forward. 4 governance-snapshot commits migrate back to local monorepo's `archive/2026-06-15-30-pillar-fleet`, then the repo is deleted.
- **ADR-034** schedules `phenotype-monorepo-state` deletion: 14-day grace from 2026-06-17 → deletion on 2026-07-01. Archive pre-delete snapshot at `archive/2026-07-01-phenotype-monorepo-state-snapshot`.

## Decision-log files

Each ADR has a corresponding decision-log finding at `findings/2026-06-17-L5-10X-*.md`:

- ADR-024 → `findings/2026-06-17-L5-102-71-pillar-audit.md`
- ADR-025 → `findings/2026-06-17-L5-103-worklog-v2-1.md`
- ADR-026 → `findings/2026-06-17-L5-104-factory-ai-readiness.md`
- ADR-027 → `findings/2026-06-17-L5-105-git-lfs-3-tier.md`
- ADR-028 → `findings/2026-06-17-L5-106-monorepo-hybrid-staging.md`
- ADR-029 → `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md`
- ADR-030 → `findings/2026-06-17-L5-109-spine-repos-readonly.md`
- ADR-031 → `findings/2026-06-17-L5-104-7-configra-absorb-plan.md`
- ADR-032 → `findings/2026-06-17-L5-107-worklog-merge-decision.md`
- ADR-033 → `findings/2026-06-17-L5-108-phenotype-monorepo-state-deletion.md`
- ADR-034 → `findings/2026-06-17-L5-108-1-phenotype-monorepo-state-schedule.md`

> **Note on L5-104 ID collision:** the `findings/2026-06-17-L5-104-*.md` prefix is also used by the 2026-06-17 Dmouse92→KooshaPari migration track (5 files, separate concern: `dmouse92-to-kooshapari.md`, `forgecode-migration.md`, `dispatch-mcp-migration-plan.md`, `bulk-rust-ts-migration.md`, `pheno-adr012-migration-plan.md`). The Factory AI finding is intentionally co-numbered L5-104 (per the user-specified L5-ID allocation in the v7 plan); the two are unrelated and the ID collision is preserved for traceability.

## Supersedes

- **ADR-024** supersedes the 30-pillar audit as the *internal* scoring model; the 30-pillar files (`audit-30-pillar-L0..L29.md`) remain valid for tech-only deep dives.
- **ADR-025** supersedes ADR-015 v2.0 10-column schema for *new* worklogs only; v2.0 remains valid for historical entries until 2026-06-22.
- **ADR-031** supersedes ADR-022's *naming* decision (the Rust/TS edge split remains valid).
- **ADR-033** supersedes the implicit decision to keep `phenotype-monorepo-state` as a separate repo (it was a temporary snapshot, now consolidated).

## Cross-references

- `AGENTS.md` "Active ADRs" table (rows ADR-024..ADR-034)
- `audit-71-pillar-2026-06-17-wrapup.md` § 6 (strands) + § 8.2 (pillar status) + § 10 (Factory AI crosswalk)
- `findings/71-PILLAR-AUDIT-FRAMEWORK-2026-06-17.md` (71-pillar schema)
- `.gitattributes.example` (Tier 1/2/3 policy template, ADR-027)
- `AGENTS.md` § "App-level repo triage" (ADR-023 substrate placement referenced by ADR-028)
- `AGENTS.md` § "Decision A/B/C/D" (ADR-031, 032, 033, 030 respectively)
- `AGENTS.md` § "Dmouse92 → KooshaPari migration" (ADR-029)
