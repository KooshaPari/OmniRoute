# SSOT — Single Source of Truth (focalpoint)

This document records the canonical authority for cross-cutting facts in the
focalpoint repository. When a fact conflicts across docs, the source listed
here wins.

## Scope

| Domain | Authoritative source |
| --- | --- |
| Build & test commands | `justfile` (root) and per-crate `Cargo.toml` |
| Release & versioning | `cliff.toml` + `CHANGELOG.md` (git-cliff generated) |
| Security disclosure process | `SECURITY.md` |
| Dependency updates | `.github/dependabot.yml` |
| Branch & commit policy | `.github/workflows/governance.yml` |
| Repository health score | `.github/workflows/scorecard.yml` (OpenSSF) |
| Editor / formatting baseline | `.editorconfig` |
| Workspace architecture | `ARCHITECTURE.md` (per-crate breakdown) |
| Agent operating model | `AGENTS.md` |
| Canonical config (Rust) | **`KooshaPari/Configra`** (ADR-031, absorb target — was `phenoShared/phenotype-config-core` per ADR-012; rename proposed 2026-06-17) |
| Canonical config (Python) | `pheno-config/` (ADR-012 PR-6/7) |
| Config consolidation plan | `findings/ADR-012_CONFIG_CONSOLIDATION_PR1-3_DONE-2026_06_15.md` (PR-1/2/3 done; 4-11 planned) |
| **Agent-effort governance** | `docs/adr/2026-06-15/ADR-023-agent-effort-governance.md` (device-fit gate, app-level repo triage, app substrate placement) |
| **App-level repo triage table** | `AGENTS.md` § "App-level repo triage & app substrate placement (ADR-023)" + mirrored in `STATUS.md` § "App-level repo triage" |
| **Worklog schema** | `pheno-worklog-schema` v2.1 (ADR-015) — 11th column `device:` enum `macbook \| heavy-runner \| subagent \| ci`; v2.0 deprecated 2026-06-22; migration script: `pheno-worklog-schema/migrate_v2_to_v2_1.py`; spec: `pheno-worklog-schema/SPEC-v2.1.md` |
| **Agent readiness scoring (internal)** | 71-pillar framework (ADR-024) — `findings/71-pillar-2026-06-17-schema.md` (schema) + `findings/71-pillar-2026-06-17.md` (scorecard) + `findings/71-pillar-2026-06-17-mapping.md` (L30→L71 crosswalk) |
| **Agent readiness scoring (external standard)** | Factory AI Agent Readiness Model (5 levels, 9 pillars, 80% threshold per level) — <https://docs.factory.ai/web/agent-readiness/overview> |
| **Quality audit crosswalk (71-pillar ↔ Factory AI)** | `audit-71-pillar-2026-06-17-wrapup.md` § 10 (ADR-026, this turn) |
| **Dmouse92 → KooshaPari migration audit** | `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (ADR-029, this turn) + sub-plans: dispatch-mcp (527 lines), pheno-ADR-012 (414 lines), bulk-rust-ts (999 lines), forgecode (305 lines) |
| **Substrate ownership** | `pheno-mcp-router` (ADR-013) owns all `pheno-mcp-*` server tier/cost/budget/quota/audit/llama_cpp/openai_compat; `phenotype-config` (ADR-022) owns Rust core + Conft TS edge; `phenotype-ops` (ADR-023) owns deployment; `phenotype-hub` / `phenotype-bus` (ADR-014) own IoC frameworks |
| **Git-hook bypass env vars (per P47)** | `HOOKS_SKIP=1` skips all git hooks (trufflehog pre-commit timeout workaround on the 4.3GB monorepo); `SKIP=pre-push,pre-commit` skips specific named hooks (git-standard variable, accepted by lefthook/overcommit/git hooks). Use `HOOKS_SKIP=1` for orchestrator pushes; use `SKIP=...` for surgical hook bypasses. Both must be set as env vars in the same shell as the `git push` / `git commit` invocation (env vars do not persist across shell sessions). |

## Precedence order

1. Executable config (workflows, `justfile`, `Cargo.toml`, `deny.toml`) — observed behavior.
2. `*.md` governance files in this SSOT table.
3. `ARCHITECTURE.md` crate-level contracts.
4. The L5 governance ADRs (ADR-023 and successors) override any L3/L4 substrate decision where the conflict is "should the agent be working on this at all?" — substrate decisions (which crate to use) are L3/L4; effort-decision (whether to work on it, on which device) is L5.
5. Anything else.

## Updating this file

- Keep the table narrow and unambiguous.
- Cite the canonical file by path; do not duplicate content.
- Update via a `chore(governance):` commit referencing the change.
