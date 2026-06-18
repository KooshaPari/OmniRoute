# ADR-029: Dmouse92 → KooshaPari migration — absorb all DM92 work to substrate, archive emptied repos

**Status:** ACCEPTED
**Date:** 2026-06-17
**Author:** orchestrator (claude opus 4.7) + forge subagent
**L5-104** (parallel with ADR-024..028; see INDEX § "Note on L5-104 ID collision")
**Refs:**
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (execution log, 364 lines)
- `findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md`
- `findings/2026-06-17-L5-104-pheno-adr012-migration-plan.md`
- `findings/2026-06-17-L5-104-bulk-rust-ts-migration.md`
- `findings/2026-06-17-L5-104-forgecode-migration.md`
- ADR-013 (mcp-router substrate), ADR-022 (config split, superseded by ADR-031 naming), ADR-023 (substrate placement)

---

## Context

Two parallel git-account sources exist for the Phenotype fleet:

1. **`KooshaPari/*`** — the canonical, owner-managed account
2. **`Dmouse92/*`** — a historical mirror, with overlapping and in some cases unique work

The user's directive (2026-06-17): *"focus solely on the dmouse92 aspects of work — merge all over to kooshapari → then reconcile/absorb to proper repos. e.g. dispatch-mcp should be deleted as it needs to have all remaining work fully absorbed to substrate (The ver on kooshapari had this done yesterday, repeat for any dmouse additions worthwhile to migrate)."*

20 Dmouse92 phenorepos were audited. 6 carried unique content worth preserving; 14 were bulk mirrors with 0 unique commits.

## Decision

**100% of meaningful Dmouse92 work is migrated to KooshaPari substrate repos per ADR-013/022/023. Dmouse92 repositories are archived (read-only) — not deleted, because the Dmouse92 token lacks `delete_repo` scope (HTTP 403, current scopes: `'gist', 'read:org', 'repo', 'workflow'`).**

### 6 PRs opened on KooshaPari (2026-06-17 20:40-20:50 PDT)

| # | Repo | Branch → base | Title |
|---|---|---|---|
| [pheno-mcp-router#1](https://github.com/KooshaPari/pheno-mcp-router/pull/1) | pheno-mcp-router | `feat/port-cost-budget-quota-audit-tiers-2026-06-17` → `chore/l3-57-pheno-plugin-registry-2026-06-11` | feat(cost): port tiers/cost/budget/quota/audit/cost_middleware from dispatch-mcp W2-1 (L5-104.1) |
| [pheno-mcp-router#2](https://github.com/KooshaPari/pheno-mcp-router/pull/2) | pheno-mcp-router | `feat/llama-adapter-2026-06-17` → same | feat(adapters): add LlamaAdapter (LlmPort) |
| [pheno-mcp-router#3](https://github.com/KooshaPari/pheno-mcp-router/pull/3) | pheno-mcp-router | `feat/openai-compat-adapter-2026-06-17` → same | feat(adapters): add OpenAICompatAdapter (LlmPort) |
| [phenotype-config#1](https://github.com/KooshaPari/phenotype-config/pull/1) | phenotype-config | `feat/l5-104-canonical-markers-2026-06-17` → `main` | feat(docs): port CANONICAL.md markers + SLSA doc from pheno ADR-012 (L5-104.2) |
| [phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2) | phenotype-ops | `feat/llama-cpp-devops-2026-06-17` → `main` | feat(devops): add llama-cpp docker setup (L5-104.1) |
| [dispatch-mcp#1](https://github.com/KooshaPari/dispatch-mcp/pull/1) | dispatch-mcp | `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15` → `main` | docs: cherry-pick cheap-llm-mcp deprecation notice (W1.1, ADR-008) |

### 18 Dmouse92 repos archived (2026-06-17 20:36 PDT)

`AgilePlus`, `dispatch-mcp`, `pheno`, `phenodocs`, `forgecode`, `PhenoCompose`, `PhenoPlugins`, `PhenoProc`, `HeliosCLI`, `Pyron`, `HexaKit`, `Tracera`, `Civis`, `OmniRoute`, `KWatch`, `phenotype-ops`, `phenotype-otel`, `Nanovms`, `PhenoContracts`, `phenotype-teamcomm` — all under `github.com/Dmouse92/`. Archive is the only available action (no `delete_repo` scope on Dmouse92 token).

### Substrate absorption matrix

| Dmouse92 content | Absorbed to | PR |
|---|---|---|
| `dispatch-mcp` W2-1 cost/budget/quota/audit/tiers (~2,000 LOC) | `pheno-mcp-router` substrate (ADR-013) | pheno-mcp-router#1 |
| `dispatch-mcp` W2-1 `llama_cpp.py` provider | `pheno-mcp-router` `LlamaAdapter` (LlmPort) | pheno-mcp-router#2 |
| `dispatch-mcp` W2-1 `openai_compat.py` provider (KP-authored) | `pheno-mcp-router` `OpenAICompatAdapter` (LlmPort) | pheno-mcp-router#3 |
| `dispatch-mcp` W2-1 `PROVIDER_GUIDE.md` | `pheno-mcp-router/docs/PROVIDER_GUIDE.md` | pheno-mcp-router#1 (squashed) |
| `dispatch-mcp` W2-1 `docker/Dockerfile.llama` + `llama-compose.yml` | `phenotype-ops/agent-devops-setups/llama-cpp/` (ADR-023 federated service) | phenotype-ops#2 |
| `dispatch-mcp` W1-1 `docs/CHEAP_LLM_MCP_DEPRECATION.md` | `dispatch-mcp` (consumer-side notice) | dispatch-mcp#1 |
| `pheno` ADR-012 `crates/phenotype-config-{loader,shared-config}/CANONICAL.md` | `phenotype-config` substrate (ADR-022) | phenotype-config#1 |
| `pheno` ADR-012 `docs/slsa.md` | `phenotype-config/docs/slsa.md` | phenotype-config#1 |

### Discarded (per plan §2.2)

- 5 of 7 Dmouse92 pheno ADR-012 commits (workflow consolidation, agileplus scaffolding, Cargo.lock skew) — KP/main already has the canonical version
- 1 Dmouse92 dispatch-mcp commit (`9486edb` mock backend duplicate)
- 1 Dmouse92 dispatch-mcp file (`providers/base.py` — provider protocol shape diverges from substrate LlmPort)

### L5-104 MIGRATION GUARANTEE

Verified 2026-06-17 22:15 PDT (orchestrator-level shell):

- **dispatch-mcp**: 6/6 unique W2-1 commits absorbed (100%) via 5 PR branches on 3 KP repos
- **pheno ADR-012**: 7/7 unique commits decisioned (2 cherry-picked, 5 correctly discarded)
- **14 bulk mirrors**: 0 unique commits vs KP main (archive verified correct)
- **forgecode**: 0 of 378 branches contain unique Phenotype work
- **Aggregate**: **0 net content loss**

## Consequence

- Dmouse92 token is REMOVED from keyring (L5-104 kill-switch, 2026-06-17 22:30 PDT)
- Dmouse92/* repos remain archived (read-only) for 90-day GitHub retention
- All future Phenotype work goes to KooshaPari/*; no Dmouse92 work permitted
- The 6 PRs (above) complete the substrate alignment per ADR-013/022/023

## Cross-references

- `AGENTS.md` "Active ADRs" table (row ADR-029)
- `AGENTS.md` "Dmouse92 → KooshaPari migration" section
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` § 4.5 (final guarantee)
