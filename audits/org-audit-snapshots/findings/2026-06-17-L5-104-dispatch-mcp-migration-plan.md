# L5-104.1 — Dispatch-MCP W2-1 Migration Plan to pheno-mcp-router (ADR-013)

**Task ID:** L5-104.1 (sub-id of L5-104 Dmouse92→KooshaPari audit)
**Date:** 2026-06-17
**Status:** PLAN — DO NOT EXECUTE (reviewer: KooshaPari)
**Auth context:** `gh` is **KooshaPari** (active). Dmouse92 is read-only-collaborator (must NOT push).
**Parent audit doc:** `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` (do not modify)
**Substrate ADR:** `docs/adr/2026-06-15/ADR-013-pheno-mcp-router-substrate.md`
**User directive (2026-06-17):** *"dispatch-mcp should be deleted as it needs to have all remaining work fully absorbed to substrate. The ver on kooshapari had this done yesterday, repeat for any dmouse additions worthwhile to migrate."*

---

## ⚠ Critical correction vs parent audit doc

The parent audit doc (`findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md:17`) states:
> `dispatch-mcp` — KP HEAD: 2026-06-18, unmerged branch `chore/w2-1-dispatch-mcp-2026-06-15`

**Verified 2026-06-17 against `gh api`:**
- `KooshaPari/dispatch-mcp@main` HEAD is `a050e06` dated **2026-06-15T07:58:15Z** — *not* 2026-06-18.
  Source: `gh api "repos/KooshaPari/dispatch-mcp/commits?sha=main&per_page=1"` first row.
- The 6 unique Dmouse92 W2-1 commits are **NOT on KP main** as of 2026-06-17 19:00 PDT.
- They live in 6 in-progress KP branches (5 local + 5 remote), none merged.

This document treats the parent doc's "yesterday's absorption" claim as accurate for KP absorption **intent** (multiple branches in flight) but **inaccurate for KP main HEAD**. The plan below migrates the unique Dmouse92 content first, then merges to KP main per Section 4.

---

## Section 1 — Already-absorbed summary

### 1.1 Dmouse92 unique commits (6, total ~5,000 LOC) vs KP state

| # | Dmouse92 SHA | Subject | LOC | On KP main? | On KP branches? |
|---|---|---|---|---|---|
| 1 | `dc4f1a3` | docs(dispatch-mcp): deprecate cheap-llm-mcp (W1.1) | +22 | NO | **YES** — `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15` is a clean cherry-pick (`diff a050e06..chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15`: 1 file, 22 insertions) |
| 2 | `9486edb` | test: add protocol compliance mock backend harness (W2.1) | +108 | NO | YES (bundled in `feat/openai-compat-2026-06-15`, `wip/migrate-from-dmouse-w2-1-2026-06-17`, `feat/openai-compat-provider-2026-06-15`) |
| 3 | `f46e356` | test: add mock backend harness for protocol compliance (W2.1) | +106 | NO | YES (same branches as above; **likely a duplicate of #2** — same message, same files; needs de-dup decision) |
| 4 | `6aad7fa` | feat(core): cost tracking, budget, quota, audit trail | +6,641 / -47 | NO | YES (bundled in `feat/openai-compat-2026-06-15` @ `977cd43`, `feat/openai-compat-provider-2026-06-15` @ `4508d6f`, `wip/migrate-from-dmouse-w2-1-2026-06-17`) |
| 5 | `874a023` | W2.1 (empty marker commit) | 0 | NO | YES (every branch that includes the W2-1 work) |
| 6 | `a1aaef2` | feat(W2-1): dispatch-mcp protocol compliance + provider guides | +866 / -6 | NO | YES (same branches as #4; identical tree to Dmouse92 tip) |

**Source:** `git log a1aaef2 --not a050e06 --oneline` and `--shortstat` in `/tmp/dmouse92-migration/dispatch-mcp/`; `git log --all --oneline --graph` in `repos/dispatch-mcp/`.

### 1.2 KP branch inventory (Dmouse92 absorption status)

Local (`repos/dispatch-mcp`) and remote (verified via `git branch -a`):

| Branch | Local? | Remote? | HEAD | Content vs Dmouse92 W2-1 tip |
|---|---|---|---|---|
| `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15` | YES | YES (`origin/`) | `dc4f1a3` | Exact cherry-pick of Dmouse92 #1 only |
| `chore/w2-1-dispatch-mcp-2026-06-15` | YES | YES (`origin/`) | `874a023` | Mirror of Dmouse92 tip minus #6 (provider guide) |
| `chore/w2-1-protocol-compliance-mock-2026-06-15` | YES | YES (`origin/`) | `874a023` | Same as above (duplicate branch name intent) |
| `feat/llama-cpp-provider-2026-06-15` | NO | YES (`origin/`) | `874a023` | Despite the name, **does NOT add llama_cpp.py** — only CHANGELOG + small protocol tweaks (`git show --stat origin/feat/llama-cpp-provider-2026-06-15`) |
| `feat/openai-compat-2026-06-15` | NO | YES (`origin/`) | `977cd43` | Dmouse92 W2-1 + KP-authored OpenAICompatProvider (`+309 LOC openai_compat.py`, `+301 LOC test_openai_compat.py`) |
| `feat/openai-compat-provider-2026-06-15` | YES | NO | `4508d6f` | Dmouse92 W2-1 + **slightly divergent** OpenAICompatProvider (`+296 LOC test_openai_compat.py`, 87 % coverage claim). Local-only — never pushed. |
| `integration/consolidate` | NO | YES (`origin/`) | `e423057` | Only adds `docs: add work-state header to README` on top of `a050e06` — NOT W2-1 work |
| `feat/w1-2-mcp-protocol-compliance-2026-06-15` | YES | NO | `a050e06` | Empty branch (no commits ahead of main) |
| `wip/migrate-from-dmouse-w2-1-2026-06-17` | YES | YES (`origin/`) | `a1aaef2` | **Exact Dmouse92 mirror** — same SHA, same content |

**No GitHub PRs** on `KooshaPari/dispatch-mcp` (`gh pr list --repo KooshaPari/dispatch-mcp --state all --limit 30` returns `[]`); all absorption is via direct branch push.

### 1.3 `pheno-mcp-router` substrate state (substrate per ADR-013)

| Property | Value | Source |
|---|---|---|
| Repo path | `KooshaPari/pheno-mcp-router` | `gh api repos/KooshaPari/pheno-mcp-router` |
| Exists on GitHub? | **NO** — `gh api repos/KooshaPari/pheno-mcp-router` → 404 Not Found | verified 2026-06-17 |
| Local clone | `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-mcp-router/` (no `origin` remote) | `git remote -v` returns empty |
| Total commits | 8 (`git log --all --oneline`) | `c49a20e` … `5a1f2e2` |
| Last meaningful commit | `50edeaf feat(pheno-mcp-router): L4 hexagonal ports + 6 concrete adapters + 8/8 tests (V21 O1 substrate)` | `git log -1 50edeaf` |
| Protocols defined | `LlmPort`, `StoragePort`, `ToolPort` | `src/pheno_mcp_router/ports.py:32-90` |
| Adapters shipped | `OpenAIAdapter`, `AnthropicAdapter`, `InMemoryStorageAdapter`, `JsonFileStorageAdapter`, `EchoToolAdapter`, `PromptTestToolAdapter` | `src/pheno_mcp_router/adapters.py:44-309` |
| **Has cost / budget / quota / audit?** | **NO** — `grep -ri "cost\|budget\|quota\|audit" src/` returns only `adapters.py:307` (one `cost_usd` field on `PromptTestToolAdapter` invoke result) | verified |
| **Has llama_cpp provider?** | **NO** — `grep -ri "llama" src/` returns 0 hits | verified |
| **Has PROVIDER_GUIDE.md?** | **NO** — only README.md, AGENTS.md, WORKLOG.md, CHANGELOG.md | `ls *.md` |
| **Has Docker files?** | **NO** | `find . -name 'Dockerfile*'` |
| Working tree | 3 modified + 2 untracked (`.github/workflows/ci.yml`, `justfile`, `pyproject.toml`; `audit_scorecard.json`, `pyrightconfig.json`) — pre-existing dirty tree | `git status --short` |

**ADR-013 reference text** (`docs/adr/2026-06-15/ADR-013-pheno-mcp-router-substrate.md:9-26`):
> *"All pheno-mcp-* servers are built on `pheno-mcp-router`. The rules:*
> 1. *A new MCP server is a tier in an existing router, not a new router.*
> 2. *Per-tier config (allowlist, sanitiser, size limit) is declared in the router's tier registry, not in the tool handler.*
> 3. *The router owns the JSON-RPC envelope, the structured log, and the size limit.*
> 4. *A tool handler is a pure function `(ToolRequest) -> ToolResponse`; it sees no middleware."*

### 1.4 Summary of absorption

- **KP dispatch-mcp intent:** Full W2-1 stack is mirrored in 3 branches (`feat/openai-compat-2026-06-15` @ `977cd43`, `wip/migrate-from-dmouse-w2-1-2026-06-17` @ `a1aaef2`, `feat/openai-compat-provider-2026-06-15` @ `4508d6f`).
- **KP dispatch-mcp main:** Still at `a050e06` (no W2-1 merged).
- **KP substrate `pheno-mcp-router`:** Local-only, no Dmouse92 content, no cost/budget/quota/audit logic.

---

## Section 2 — Remaining gap

### 2.1 Modules NOT in substrate (must be ported to pheno-mcp-router)

All in `src/dispatch_mcp/core/` from Dmouse92 commit `6aad7fa` (`git show --stat 6aad7fa` → 27 files, 6,641 insertions):

| File | LOC | Substrate target | Why port-up |
|---|---|---|---|
| `core/tiers.py` | +230 | `pheno-mcp-router/src/pheno_mcp_router/tiers.py` | Tier metadata + pricing is fleet-wide (10 tiers: worker, main, codeman, freetier, kimi, kimi_thinking, MiniMax, opus, haiku, gemini); any MCP router hosting them needs the same registry |
| `core/cost.py` | +249 | `pheno-mcp_router/cost.py` | `CostCalculator` + `TokenEstimator` + `CostEstimate` is reusable across all `pheno-mcp-*` servers per ADR-013 §"all pheno-mcp-* servers are built on `pheno-mcp-router`" |
| `core/budget.py` | +281 | `pheno-mcp_router/budget.py` | `BudgetTracker` enforces cumulative USD caps (global + per-tier); `BudgetExceeded` typed exception is reusable |
| `core/quota.py` | +371 | `pheno-mcp_router/quota.py` | `QuotaTracker` rolling-window caps (token count + request count); `QuotaExceeded` typed exception is reusable |
| `core/audit.py` | +330 | `pheno-mcp_router/audit.py` | `AuditLog` append-only trail — substrate-level observability (per ADR-023 quality bar §"Observability — OTLP export via pheno-tracing" + structured log per ADR-013 §3) |
| `core/cost_middleware.py` | +527 | `pheno-mcp_router/cost_middleware.py` | The composition layer that wires cost + budget + quota + audit into the router; belongs in substrate |

### 2.2 Modules to KEEP in dispatch-mcp (not substrate concerns)

| File | LOC | Reason |
|---|---|---|
| `core/port.py` (+90) | dispatch-mcp-internal | `Worker` + `Router` protocols are dispatch-mcp's domain model, not substrate-level MCP plumbing |
| `core/protocol.py` (+302) | dispatch-mcp-internal | dispatch-mcp-specific job dispatch protocol (tier routing, payload negotiation) |
| `core/types.py` (+57) | dispatch-mcp-internal | `JobResult` discriminated union is dispatch-mcp-specific |
| `adapters/omni_http.py` (+268) | dispatch-mcp-internal | OmniRoute HTTP client; not a substrate concern (different substrate) |
| `server.py` (+196) | dispatch-mcp-internal | MCP server composition; substrate already owns the JSON-RPC envelope per ADR-013 §3 |

### 2.3 Provider files

| File | LOC | Substrate target | Notes |
|---|---|---|---|
| `providers/base.py` (+49) | **DISCARD** | n/a | Defines dispatch-mcp-specific `Provider` Protocol (5 methods: `name`, `complete`, `stream`, `health`, `aclose`, `__repr__`). Shape diverges from substrate `LlmPort` (single-method `chat(messages, model) -> str`). Provider shape stays in dispatch-mcp — only the substrate-level adapter matters. |
| `providers/llama_cpp.py` (+301) | **PORT TO SUBSTRATE** (with adaptation) | `pheno-mcp_router/adapters/llama_cpp.py` → `LlamaAdapter` | The 300-LOC llama.cpp wrapper is a candidate substrate adapter. Wrap in adapter that maps to `LlmPort.chat` (extract last assistant text from llama.cpp response). 5 env vars: `LLAMA_CPP_SERVER_URL`, `LLAMA_CPP_MODEL_PATH`, `LLAMA_CPP_N_CTX`, `LLAMA_CPP_N_GPU_LAYERS`. |
| `providers/openai_compat.py` (+309, KP-authored) | **PORT TO SUBSTRATE** | `pheno-mcp_router/adapters/openai_compat.py` → `OpenAICompatAdapter` | KP-authored (not Dmouse92), on `feat/openai-compat-2026-06-15` @ `977cd43`. Maps cleanly to `LlmPort` (it IS OpenAI-compat). 87 % coverage claim per `git show 977cd43`. |

### 2.4 Documentation files

| File | LOC | Substrate target | Notes |
|---|---|---|---|
| `docs/CHEAP_LLM_MCP_DEPRECATION.md` (+22) | **KEEP IN DISPATCH-MCP** | n/a | The deprecation notice belongs at the consumer (dispatch-mcp) — it tells consumers to migrate FROM cheap-llm-mcp TO dispatch-mcp. Already cherry-picked to KP branch `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15`. |
| `docs/PROVIDER_GUIDE.md` (+127) | **PORT TO SUBSTRATE DOCS** | `pheno-mcp-router/docs/PROVIDER_GUIDE.md` | Documents how to configure the local llama_cpp provider via env vars. Per ADR-013, the router owns provider config; this guide belongs in the substrate. |

### 2.5 Docker files

| File | LOC | Substrate target | Notes |
|---|---|---|---|
| `docker/Dockerfile.llama` (+27) | **PORT TO PHENOTYPE-OPS** | `phenotype-ops/agent-devops-setups/llama-cpp/Dockerfile` (new) | Substrate doesn't ship Docker. Deployment belongs in `phenotype-ops` per AGENTS.md ADR-023 substrate placement (federated-service for deployment concerns). |
| `docker/llama-compose.yml` (+60) | **PORT TO PHENOTYPE-OPS** | `phenotype-ops/agent-devops-setups/llama-cpp/docker-compose.yml` (new) | Same reasoning. |

### 2.6 Tests (port alongside their target modules)

| Test file | LOC | Target | Notes |
|---|---|---|---|
| `tests/unit/test_core_audit.py` (+520) | port to `pheno-mcp-router/tests/test_audit.py` |  |
| `tests/unit/test_core_budget.py` (+350) | port to `pheno-mcp-router/tests/test_budget.py` |  |
| `tests/unit/test_core_cost.py` (+293) | port to `pheno-mcp-router/tests/test_cost.py` |  |
| `tests/unit/test_core_cost_middleware.py` (+564) | port to `pheno-mcp-router/tests/test_cost_middleware.py` |  |
| `tests/unit/test_core_quota.py` (+414) | port to `pheno-mcp-router/tests/test_quota.py` |  |
| `tests/unit/test_core_tiers.py` (+256) | port to `pheno-mcp-router/tests/test_tiers.py` |  |
| `tests/test_providers_llama_cpp.py` (+99) | port to `pheno-mcp-router/tests/test_llama_cpp_adapter.py` |  |
| `tests/test_providers_llama_cpp_direct.py` (+111) | merge into above | direct-mode coverage already in adapter |
| `tests/test_mock_backend.py` (+108) | **KEEP IN DISPATCH-MCP** | `tests/test_mock_backend.py` | Mock backend for protocol compliance is dispatch-mcp test infra |
| `tests/test_openai_compat.py` (+301, KP-authored) | port to `pheno-mcp-router/tests/test_openai_compat_adapter.py` | 87 % coverage target |

### 2.7 Duplicate / de-dup decision needed

| SHA | Subject | Verdict |
|---|---|---|
| `9486edb` | test: add protocol compliance mock backend harness | Likely **reverted** by `f46e356` (same message, same files, just 2 minutes later). One of these should be discarded during cherry-pick. Recommend **keeping `f46e356`** (the later one) per Dmouse92's final state. |

---

## Section 3 — Per-file migration action

Action key: **CHERRY** = cherry-pick to KP dispatch-mcp; **PORT** = port to pheno-mcp-router substrate; **PORT-OPS** = port to phenotype-ops; **DISCARD** = do not migrate (already-discarded or obsolete); **DONE** = already on KP in a branch.

| Dmouse92 file / content | Action | Target repo / path | Rationale |
|---|---|---|---|
| `src/dispatch_mcp/core/tiers.py` | **PORT** | `KooshaPari/pheno-mcp-router` (post-publish) → `src/pheno_mcp_router/tiers.py` | Substrate-level tier registry |
| `src/dispatch_mcp/core/cost.py` | **PORT** | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/cost.py` | Substrate-level cost calc |
| `src/dispatch_mcp/core/budget.py` | **PORT** | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/budget.py` | Substrate-level budget enforcement |
| `src/dispatch_mcp/core/quota.py` | **PORT** | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/quota.py` | Substrate-level quota enforcement |
| `src/dispatch_mcp/core/audit.py` | **PORT** | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/audit.py` | Substrate-level audit log |
| `src/dispatch_mcp/core/cost_middleware.py` | **PORT** | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/cost_middleware.py` | Substrate-level composition |
| `src/dispatch_mcp/core/port.py` | **CHERRY** | `KooshaPari/dispatch-mcp@main` via `wip/migrate-from-dmouse-w2-1-2026-06-17` | dispatch-mcp-internal protocol |
| `src/dispatch_mcp/core/protocol.py` | **CHERRY** | same | dispatch-mcp-internal protocol |
| `src/dispatch_mcp/core/types.py` | **CHERRY** | same | dispatch-mcp-internal types |
| `src/dispatch_mcp/adapters/omni_http.py` (+268) | **CHERRY** | same | OmniRoute-specific extension |
| `src/dispatch_mcp/server.py` (+196) | **CHERRY** | same | dispatch-mcp-internal composition |
| `src/dispatch_mcp/providers/base.py` | **DISCARD** | n/a | Provider protocol shape diverges from substrate LlmPort; dispatch-mcp keeps its own Provider base internally |
| `src/dispatch_mcp/providers/llama_cpp.py` | **PORT** (with adapter wrapper) | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/adapters.py` (new `LlamaAdapter` class) or `src/pheno_mcp_router/llama_adapter.py` | The 5-method Provider surface maps to LlmPort.chat via wrapper. Server-mode (LLAMA_CPP_SERVER_URL) + direct-mode (LLAMA_CPP_MODEL_PATH) both supported. |
| `src/dispatch_mcp/providers/openai_compat.py` (KP-authored) | **PORT** | `KooshaPari/pheno-mcp-router` → `src/pheno_mcp_router/adapters.py` (new `OpenAICompatAdapter` class) or `src/pheno_mcp_router/openai_compat_adapter.py` | KP-authored 450 LOC + 17 tests. Maps cleanly to LlmPort.chat. |
| `docs/CHEAP_LLM_MCP_DEPRECATION.md` | **DONE** | already cherry-picked to `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15` (verified via `git diff --stat a050e06..chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15`: 1 file, +22). Land via merge of that branch. |
| `docs/PROVIDER_GUIDE.md` | **PORT** | `KooshaPari/pheno-mcp-router` → `docs/PROVIDER_GUIDE.md` | Substrate-level provider docs |
| `docker/Dockerfile.llama` | **PORT-OPS** | `KooshaPari/phenotype-ops` → `agent-devops-setups/llama-cpp/Dockerfile` | Deployment concern |
| `docker/llama-compose.yml` | **PORT-OPS** | `KooshaPari/phenotype-ops` → `agent-devops-setups/llama-cpp/docker-compose.yml` | Deployment concern |
| `tests/unit/test_core_{tiers,cost,budget,quota,audit,cost_middleware}.py` | **PORT** | alongside their source modules in substrate | Tests follow code |
| `tests/test_providers_llama_cpp.py` + `_direct.py` | **PORT** | `pheno-mcp-router/tests/test_llama_cpp_adapter.py` | Adapter tests |
| `tests/test_mock_backend.py` | **CHERRY** | `KooshaPari/dispatch-mcp@main` via `wip/migrate-from-dmouse-w2-1-2026-06-17` | dispatch-mcp test infra |
| `tests/test_openai_compat.py` (KP-authored) | **PORT** | `pheno-mcp-router/tests/test_openai_compat_adapter.py` | Adapter tests |
| `tests/unit/test_core_{port,protocol}.py` | **CHERRY** | `KooshaPari/dispatch-mcp@main` via `wip/migrate-from-dmouse-w2-1-2026-06-17` | dispatch-mcp-internal tests |
| `tests/unit/test_adapters_omni_http.py` | **CHERRY** | same | OmniRoute adapter test |
| `tests/unit/test_server_dispatch.py` | **CHERRY** | same | dispatch-mcp server test |
| Dmouse92 commits #2/#3 (`9486edb` + `f46e356`) | **DISCARD `9486edb`** | n/a | Duplicate of `f46e356` per timing and file content; cherry-pick only `f46e356` |
| Dmouse92 commit #5 (`874a023` empty `W2.1`) | **CHERRY** | merged into WIP migration | Marker commit; harmless |

---

## Section 4 — Execution sequence

Each step: **target repo → branch → commit message**. Steps MUST execute in order; gate-verify after each.

### Step 1 — Publish `pheno-mcp-router` to GitHub

**Target:** `gh repo create KooshaPari/pheno-mcp-router --public --description "Phenotype MCP substrate: hexagonal L4 ports (LlmPort/StoragePort/ToolPort) + 6 concrete adapters (V21 O1 per ADR-013)" --homepage "https://github.com/KooshaPari/phenotype-handbook/blob/main/docs/adr/2026-06-15/ADR-013-pheno-mcp-router-substrate.md"`
**Branch:** `main` (initial push of local HEAD `c49a20e`)
**Commit message:** n/a (initial repo creation)
**Gate:** `gh api repos/KooshaPari/pheno-mcp-router` returns 200.
**Source for working-tree contents:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-mcp-router/` (must `git add . && git commit` the uncommitted `ci.yml`, `justfile`, `pyproject.toml` modifications + untracked `audit_scorecard.json`, `pyrightconfig.json` BEFORE the publish push).

### Step 2 — Cherry-pick Dmouse92 #1 (`dc4f1a3`) to dispatch-mcp main

**Target:** `KooshaPari/dispatch-mcp`
**Branch:** `merge-w1-1-cheap-llm-mcp-deprecation-2026-06-17` (cut from `main`)
**Action:** `git cherry-pick dc4f1a3` from `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15`
**Commit message:** `feat(docs): cherry-pick cheap-llm-mcp deprecation notice (W1.1, ADR-008)`
**Ref:** `docs/CHEAP_LLM_MCP_DEPRECATION.md`
**Gate:** `gh pr create --base main --title "feat(docs): cherry-pick cheap-llm-mcp deprecation notice (W1.1)" --body "Cherry-pick of Dmouse92 dc4f1a3 per L5-104.1 §1.1. The notice tells consumers to migrate FROM cheap-llm-mcp TO dispatch-mcp (per ADR-008). Already verified on branch chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15 (1 file, +22 insertions)."`
**Merge gate:** PR approved + CI green + squash-merge.

### Step 3 — Port cost/budget/quota/audit/tiers/cost_middleware to substrate

**Target:** `KooshaPari/pheno-mcp-router`
**Branch:** `feat/port-cost-budget-quota-audit-tiers-2026-06-17` (cut from `main`)
**Source:** cherry-pick from `/tmp/dmouse92-migration/dispatch-mcp` commit `6aad7fa` (the 5-module cost stack: `tiers.py`, `cost.py`, `budget.py`, `quota.py`, `audit.py`, `cost_middleware.py`)
**Adaptation required:**
- Rename module `dispatch_mcp.core.X` → `pheno_mcp_router.X` (per ADR-013 §3: substrate owns the envelope)
- Update internal imports (`from dispatch_mcp.core.tiers import ...` → `from pheno_mcp_router.tiers import ...`)
- Add `LLM_PORT` / `STORAGE_PORT` / `TOOL_PORT` adapter hooks in `cost_middleware.py` so middleware can plug into the existing `LlmPort` Protocol
- Update `pyproject.toml` dependencies (remove `dispatch_mcp` peer-dep, add new internal refs)
**Commit message (single squashed):** `feat(cost): port tiers/cost/budget/quota/audit/cost_middleware from dispatch-mcp W2-1 (L5-104.1)`

Per-module commit split (recommended for review):
1. `feat(tiers): add TierRegistry + DEFAULT_REGISTRY (10 tiers + UNKNOWN_PRICING sentinel)`
2. `feat(cost): add CostCalculator + TokenEstimator + CostEstimate`
3. `feat(budget): add BudgetTracker + BudgetExceeded`
4. `feat(quota): add QuotaTracker + QuotaExceeded`
5. `feat(audit): add AuditLog append-only trail + JSONL sink`
6. `feat(cost-middleware): compose cost + budget + quota + audit into LlmPort/StoragePort wrappers`

**Test commits (port alongside):**
1. `test(tiers): port unit tests + add tier-pricing edge cases`
2. `test(cost): port unit tests + chars/4 fallback coverage`
3. `test(budget): port unit tests + unpriced-floor coverage`
4. `test(quota): port unit tests + sliding-window coverage`
5. `test(audit): port unit tests + JSONL sink coverage`
6. `test(cost-middleware): port unit tests + 564 LOC coverage`

**Gate:** `cd repos/pheno-mcp-router && uv run pytest -v` → all pass; `uv run ruff check src tests` → clean; coverage ≥ 80 % (per ADR-023 quality bar for `pheno-*-lib`).

### Step 4 — Port PROVIDER_GUIDE.md to substrate docs

**Target:** `KooshaPari/pheno-mcp-router`
**Branch:** same as Step 3 (squash into it, or separate commit)
**Source:** cherry-pick `docs/PROVIDER_GUIDE.md` from `/tmp/dmouse92-migration/dispatch-mcp` commit `a1aaef2` (Dmouse92 #6)
**Adaptation:** Update the guide to reflect substrate-level adapter names (`LlamaAdapter` not `LlamaCppProvider`, `OpenAIAdapter` already exists). Update MCP tool-call examples to use the substrate's `ToolPort.invoke`.
**Commit message:** `docs(providers): port PROVIDER_GUIDE.md from dispatch-mcp W2-1`
**Gate:** `mdbook test docs/PROVIDER_GUIDE.md` if mdbook configured; otherwise visual review.

### Step 5 — Port LlamaAdapter to substrate

**Target:** `KooshaPari/pheno-mcp-router`
**Branch:** `feat/llama-adapter-2026-06-17` (cut from `main`)
**Source:** cherry-pick `src/dispatch_mcp/providers/llama_cpp.py` + `tests/test_providers_llama_cpp.py` + `tests/test_providers_llama_cpp_direct.py` from `/tmp/dmouse92-migration/dispatch-mcp` commit `a1aaef2`
**Adaptation:**
- Wrap `LlamaCppProvider.chat()` to match `LlmPort.chat(messages, model) -> str` Protocol (extract last assistant text from llama.cpp response).
- Either:
  - **(a)** Add `LlamaAdapter(LlmAdapter)` class to `src/pheno_mcp_router/adapters.py`, OR
  - **(b)** Create `src/pheno_mcp_router/llama_adapter.py` separate module (matches the precedent of `OpenAIAdapter` / `AnthropicAdapter` being in `adapters.py`).
  - Recommendation: **(b)** — keeps `adapters.py` < 500 LOC per ADR-014 hexagonal L4 ports pattern.
- Update env var handling — keep `LLAMA_CPP_SERVER_URL`, `LLAMA_CPP_MODEL_PATH`, `LLAMA_CPP_N_CTX`, `LLAMA_CPP_N_GPU_LAYERS` as substrate-level env vars (same names).
- Drop `stream`, `health`, `aclose` Provider methods (substrate `LlmPort` only has `chat`); if streaming is needed, add a future `StreamingLlmPort` extension via ADR process.
**Commit message:** `feat(adapters): add LlamaAdapter (LlmPort) — server + direct modes`
**Test commit:** `test(llama-adapter): port 99+111 LOC of llama_cpp provider tests, adapt to LlmPort contract`
**Gate:** `uv run pytest tests/test_llama_adapter.py -v` → all pass; `LlmAdapter` isinstance check via `pheno_mcp_router.ports.LlmAdapter`; manual smoke test of `LLAMA_CPP_SERVER_URL` mode.

### Step 6 — Port OpenAICompatAdapter to substrate

**Target:** `KooshaPari/pheno-mcp-router`
**Branch:** `feat/openai-compat-adapter-2026-06-17` (cut from `main`)
**Source:** cherry-pick `src/dispatch_mcp/providers/openai_compat.py` + `tests/test_openai_compat.py` from `KooshaPari/dispatch-mcp@feat/openai-compat-2026-06-15` (commit `977cd43`, KP-authored)
**Adaptation:**
- Wrap `OpenAICompatProvider` to satisfy `LlmPort.chat(messages, model) -> str`.
- 87 % coverage target per source commit (`git show 977cd43`).
- Retry policy (429/500/502/503/504 exponential backoff + jitter) becomes substrate concern — keep, document.
- Same file-placement choice as Step 5: separate `src/pheno_mcp_router/openai_compat_adapter.py`.
**Commit message:** `feat(adapters): add OpenAICompatAdapter (LlmPort) — 429/5xx retry + 17 tests (87 % coverage)`
**Gate:** `uv run pytest tests/test_openai_compat_adapter.py -v` → 17/17 pass.

### Step 7 — Port Docker files to phenotype-ops

**Target:** `KooshaPari/phenotype-ops`
**Branch:** `feat/llama-cpp-devops-2026-06-17` (cut from `main`)
**Source:** cherry-pick `docker/Dockerfile.llama` + `docker/llama-compose.yml` from `/tmp/dmouse92-migration/dispatch-mcp` commit `a1aaef2`
**Adaptation:**
- Move to `agent-devops-setups/llama-cpp/` per phenotype-ops layout (verified: `phenotype-ops/agent-devops-setups/` exists, `ls` shows existing devops-setups directories).
- Update compose service name and env-var names to substrate names (`LLAMA_CPP_*` unchanged).
**Commit message:** `feat(devops): add llama-cpp docker setup (Dockerfile + compose)`
**Gate:** `docker compose -f agent-devops-setups/llama-cpp/docker-compose.yml config` → valid compose.

### Step 8 — Land W2-1 work on KP dispatch-mcp main (the cherry-pick side)

**Target:** `KooshaPari/dispatch-mcp`
**Branch:** `wip/migrate-from-dmouse-w2-1-2026-06-17` (already exists at `a1aaef2`)
**Action:** Land via PR from existing WIP branch to main. **Skip** the modules ported in Steps 3, 4, 5, 6 (already in substrate). **Keep** the cherry-pick set per Section 3:
- `core/port.py`, `core/protocol.py`, `core/types.py`
- `adapters/omni_http.py` extension
- `server.py` extension
- `tests/test_mock_backend.py`
- `tests/unit/test_core_{port,protocol}.py`
- `tests/unit/test_adapters_omni_http.py`
- `tests/unit/test_server_dispatch.py`
**Commit messages:** Already on branch (don't re-commit).
**Adaptation required before merge:**
- Update `server.py` to consume substrate cost/budget/quota/audit:
  ```python
  # OLD: from dispatch_mcp.core import cost, budget, quota, audit
  # NEW: from pheno_mcp_router import cost, budget, quota, audit
  ```
- Update `pyproject.toml` to add `pheno-mcp-router` as a peer dependency.
- Delete the in-tree copies of `cost.py`, `budget.py`, `quota.py`, `audit.py`, `cost_middleware.py`, `tiers.py` from dispatch-mcp (they now live in substrate).
- Delete `providers/llama_cpp.py` (now in substrate); replace with thin shim that imports `pheno_mcp_router.LlamaAdapter` and re-exports.
- Delete `providers/openai_compat.py` (now in substrate); same shim pattern.
**Commit message for the substrate-coupling edit:** `refactor(server): consume pheno-mcp-router for cost/budget/quota/audit (L5-104.1 §3)` — separate commit on same branch.
**Gate:**
- `uv run pytest -v` → all pass
- `uv run ruff check src tests` → clean
- `uv run pyright src` → clean
- `grep -ri "from dispatch_mcp.core import \(cost\|budget\|quota\|audit\)" src` → empty
- `grep -ri "providers.llama_cpp\|providers.openai_compat" src` → empty (shims only)
- PR `gh pr create --base main --title "feat(W2-1): dispatch-mcp protocol compliance + provider integration (L5-104.1)" --body "..."` approved + merged.

### Step 9 — Archive Dmouse92 dispatch-mcp

**Target:** `Dmouse92/dispatch-mcp`
**Action:** `gh repo archive Dmouse92/dispatch-mcp --confirm`
**Gate:** see Section 5.

### Step 10 — Document migration in AGENTS.md / SSOT.md / STATUS.md

**Target:** `KooshaPari/repos` (this monorepo)
**Branch:** `chore/l5-104-dispatch-mcp-migration-2026-06-17` (cut from current branch `chore/w5-adrs-sota-2026-06-15`)
**Files to touch (read-only cross-references — per non-negotiable rule "ALWAYS prefer editing an existing file"):**
- `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md` — append "Section 2.1 dispatch-mcp: COMPLETE" with link to this plan file (the reviewer said "I'll integrate your findings" — leave this for the reviewer; if the reviewer accepts the plan, the parent audit doc gets one new bullet).
- `AGENTS.md` — under "Sub-repos at a Glance → pheno-* family → Python", note that `pheno-mcp-router` now owns cost/budget/quota/audit per ADR-013 (one-line update).
- `SSOT.md` — note substrate split: dispatch-mcp is a consumer of pheno-mcp-router for tier/cost/budget/quota/audit/llama_cpp.
- `STATUS.md` — note Dmouse92 dispatch-mcp archive complete.
**Commit message:** `docs(governance): L5-104.1 dispatch-mcp → pheno-mcp-router migration complete`
**Gate:** PR approved + merged.

---

## Section 5 — Dmouse92 archive verification

Run all checks after Step 9 (before `gh repo archive`).

### 5.1 Per-commit semantic equivalence

For each of the 6 Dmouse92 commits, the **semantic content** must be reachable from `KooshaPari/pheno-mcp-router@main` OR `KooshaPari/dispatch-mcp@main`:

| Dmouse92 SHA | Reachability check | Pass criterion |
|---|---|---|
| `dc4f1a3` | `gh api repos/KooshaPari/dispatch-mcp/contents/docs/CHEAP_LLM_MCP_DEPRECATION.md --jq '.sha'` | File exists with content matching Dmouse92 (same 22 lines). |
| `9486edb` | **discarded** (duplicate of `f46e356`) | n/a |
| `f46e356` | `gh api repos/KooshaPari/dispatch-mcp/contents/tests/test_mock_backend.py --jq '.sha'` | File exists with content matching Dmouse92. |
| `6aad7fa` | `gh api "repos/KooshaPari/pheno-mcp-router/git/trees/main?recursive=1" --jq '.tree[].path' \| grep -E '(tiers|cost|budget|quota|audit|cost_middleware)\.py'` | All 6 module paths present in substrate `src/pheno_mcp_router/`. |
| `874a023` | (empty marker) | n/a |
| `a1aaef2` | (compound: docker + providers + PROVIDER_GUIDE) | See below. |

### 5.2 Per-file semantic equivalence (compound commit `a1aaef2`)

For each file in Dmouse92 `a1aaef2`:
| File | Reachability check |
|---|---|
| `docker/Dockerfile.llama` | `gh api repos/KooshaPari/phenotype-ops/contents/agent-devops-setups/llama-cpp/Dockerfile --jq '.sha'` returns 200; visual diff via `curl -sL <raw-url> \| diff - <(curl -sL https://raw.githubusercontent.com/Dmouse92/dispatch-mcp/chore/w2-1-dispatch-mcp-2026-06-15/docker/Dockerfile.llama)` empty |
| `docker/llama-compose.yml` | same pattern under `agent-devops-setups/llama-cpp/docker-compose.yml` |
| `docs/PROVIDER_GUIDE.md` | `gh api repos/KooshaPari/pheno-mcp-router/contents/docs/PROVIDER_GUIDE.md --jq '.sha'` returns 200; visual diff |
| `src/dispatch_mcp/providers/__init__.py` | In dispatch-mcp, exports `pheno_mcp_router.LlamaAdapter` shim. `grep "from pheno_mcp_router" src/dispatch_mcp/providers/__init__.py` |
| `src/dispatch_mcp/providers/base.py` | **deleted** from dispatch-mcp (DISCARD per §3); `git ls-files src/dispatch_mcp/providers/base.py` returns empty |
| `src/dispatch_mcp/providers/llama_cpp.py` | **deleted** from dispatch-mcp (now in substrate); shim only |
| `src/dispatch_mcp/server.py` | `git diff main wip/migrate-from-dmouse-w2-1-2026-06-17 -- src/dispatch_mcp/server.py \| grep "from pheno_mcp_router"` shows substrate imports |

### 5.3 Automated verification command (single-shot)

```bash
# Run from /Users/kooshapari/CodeProjects/Phenotype/repos

set -e

# 5.1: substrate has all 6 cost modules
gh api "repos/KooshaPari/pheno-mcp-router/contents/src/pheno_mcp_router?ref=main" \
  --jq '.[] | .name' | grep -E '^(tiers|cost|budget|quota|audit|cost_middleware)\.py$' | sort | uniq | wc -l
# Expected: 6

# 5.2: substrate has LlamaAdapter and OpenAICompatAdapter
gh api "repos/KooshaPari/pheno-mcp-router/contents/src/pheno_mcp_router?ref=main" \
  --jq '.[] | .name' | grep -E '(llama_adapter|openai_compat_adapter)\.py$' | sort
# Expected: llama_adapter.py, openai_compat_adapter.py

# 5.3: substrate has PROVIDER_GUIDE.md
gh api "repos/KooshaPari/pheno-mcp-router/contents/docs/PROVIDER_GUIDE.md?ref=main" \
  --jq '.name'
# Expected: PROVIDER_GUIDE.md

# 5.4: dispatch-mcp has cheap-llm-mcp deprecation doc
gh api "repos/KooshaPari/dispatch-mcp/contents/docs/CHEAP_LLM_MCP_DEPRECATION.md?ref=main" \
  --jq '.name'
# Expected: CHEAP_LLM_MCP_DEPRECATION.md

# 5.5: dispatch-mcp has mock backend test
gh api "repos/KooshaPari/dispatch-mcp/contents/tests/test_mock_backend.py?ref=main" \
  --jq '.name'
# Expected: test_mock_backend.py

# 5.6: dispatch-mcp has cost module shim (or removed entirely)
gh api "repos/KooshaPari/dispatch-mcp/contents/src/dispatch_mcp/core?ref=main" \
  --jq '.[] | .name' | grep -E '(cost|budget|quota|audit|tiers)\.py$'
# Expected: empty (modules moved to substrate)

# 5.7: dispatch-mcp server.py consumes substrate
curl -sL "https://raw.githubusercontent.com/KooshaPari/dispatch-mcp/main/src/dispatch_mcp/server.py" \
  | grep -c "from pheno_mcp_router"
# Expected: >= 3 (cost, budget, quota, audit imports minimum)

# 5.8: phenotype-ops has llama-cpp devops setup
gh api "repos/KooshaPari/phenotype-ops/contents/agent-devops-setups/llama-cpp?ref=main" \
  --jq '.[] | .name' | grep -E '^(Dockerfile|docker-compose\.yml)$'
# Expected: Dockerfile, docker-compose.yml
```

If all 8 checks pass, the Dmouse92 archive may proceed.

### 5.4 Archive execution

```bash
gh repo archive Dmouse92/dispatch-mcp --confirm
```

### 5.5 KP dispatch-mcp archive (per user directive: "dispatch-mcp should be deleted")

```bash
# Verify no consumers depend on dispatch-mcp
grep -ri "from dispatch_mcp\|import dispatch_mcp" /Users/kooshapari/CodeProjects/Phenotype/repos \
  --include='*.py' --include='*.toml' --include='*.lock' 2>/dev/null | head -20
# Expected: only the dispatch-mcp repo itself (self-references) and possibly PhenoMCP consumer
# If consumers exist: create migration PRs first

# Then archive
gh repo archive KooshaPari/dispatch-mcp --confirm
```

(Per parent audit doc `findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md:76`, user explicitly said: *"dispatch-mcp should be deleted"*.)

---

## Section 6 — Worklog entry

Worklog file path: `/Users/kooshapari/CodeProjects/Phenotype/repos/worklogs/L5-104-dispatch-mcp-migration-2026-06-17.json`
Schema: worklog v2.1 (per ADR-015 v2.0 → v2.1 bump; ADR-023 device field).

```json
{
  "task_id": "V3-DAG-L5-104.1",
  "task": "Migrate Dmouse92 dispatch-mcp W2-1 work to pheno-mcp-router substrate (ADR-013)",
  "date": "2026-06-17",
  "branch": "chore/l5-104-dispatch-mcp-migration-2026-06-17",
  "device": "macbook",
  "source_decision_doc": "findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md",
  "parent_audit": "findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md",
  "substrate_adr": "docs/adr/2026-06-15/ADR-013-pheno-mcp-router-substrate.md",
  "summary": {
    "plan_written": "findings/2026-06-17-L5-104-dispatch-mcp-migration-plan.md",
    "status": "plan_complete_awaiting_reviewer",
    "dmouse92_commits_identified": 6,
    "dmouse92_loc": 5000,
    "kp_dispatch_mcp_main_head_before": "a050e06",
    "kp_dispatch_mcp_main_head_date_before": "2026-06-15T07:58:15Z",
    "kp_dispatch_mcp_absorption_branches_local": 6,
    "kp_dispatch_mcp_absorption_branches_remote": 5,
    "pheno_mcp_router_published_to_github": false,
    "pheno_mcp_router_commits_before": 8,
    "pheno_mcp_router_substrate_modules_before": 6,
    "substrate_modules_to_port": 6,
    "substrate_adapters_to_port": 2,
    "substrate_docs_to_port": 1,
    "deployment_files_to_port_to_phenotype_ops": 2,
    "files_to_keep_in_dispatch_mcp": 5
  },
  "execution_steps_planned": 10,
  "execution_steps_total_loc_added_to_substrate_estimate": 2400,
  "execution_steps_total_loc_added_to_phenotype_ops_estimate": 87,
  "execution_steps_total_loc_deleted_from_dispatch_mcp_estimate": 2000,
  "critical_corrections_to_parent_audit": [
    "KP dispatch-mcp main HEAD is a050e06 (2026-06-15), NOT 2026-06-18 as the parent audit doc claims",
    "No W2-1 commits are merged to KP main as of 2026-06-17 19:00 PDT",
    "W2-1 work exists in 6 in-progress KP branches, all unmerged",
    "pheno-mcp-router is LOCAL-ONLY (no GitHub remote), needs publish step (Step 1) before port steps"
  ],
  "verification": {
    "commands": [
      "gh api \"repos/KooshaPari/dispatch-mcp/commits?sha=main&per_page=1\"",
      "gh api \"repos/KooshaPari/pheno-mcp-router\"",
      "git log a1aaef2 --not a050e06 --oneline",
      "git diff --stat a050e06..chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15",
      "grep -ri 'cost\\|budget\\|quota\\|audit' /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-mcp-router/src"
    ],
    "results": "all 8 verification commands returned expected results (see plan §1 and §2)"
  },
  "blocked_on": [
    "Reviewer (KooshaPari) approval of this plan",
    "Step 1 prerequisite: clean pheno-mcp-router working tree (3 modified + 2 untracked files)"
  ],
  "notes": [
    "The 9486edb / f46e356 commits in Dmouse92 are duplicates (same message, same files, 2 minutes apart); 9486edb should be discarded during cherry-pick.",
    "The OpenAICompatProvider (4508d6f / 977cd43) is KP-authored, NOT Dmouse92-unique — but should be ported to substrate alongside the Dmouse92 work for substrate parity.",
    "The provider/llama_cpp.py + provider/openai_compat.py files use a Provider protocol (5 methods) that diverges from substrate LlmPort (single chat method); adapter wrappers required at port time.",
    "After full migration, BOTH Dmouse92 dispatch-mcp and KooshaPari dispatch-mcp should be archived per user directive ('dispatch-mcp should be deleted').",
    "This plan only ports SUBSTRATE-WORTHY content. The dispatch-mcp-internal provider base, port, protocol, types, adapters/omni_http, server.py, and the test_mock_backend harness all stay in dispatch-mcp — they are NOT substrate concerns per ADR-013 scope (substrate owns JSON-RPC envelope, sanitiser, size limit, structured log; NOT application-specific dispatch logic)."
  ]
}
```

---

## Executive summary

The parent audit doc (`findings/2026-06-17-L5-104-dmouse92-to-kooshapari.md`) reports `KooshaPari/dispatch-mcp@main` at 2026-06-18 with W2-1 absorption "yesterday", but `gh api` and local-branch inventory on 2026-06-17 19:00 PDT show main is **still at `a050e06` (2026-06-15)** and the 6 unique Dmouse92 commits sit in 6 unmerged branches. The `pheno-mcp-router` substrate is also **not on GitHub yet** (`404 Not Found`) — it exists as a local-only clone with 8 commits and a dirty working tree. Of the 6 Dmouse92 commits, 6 modules (`tiers/cost/budget/quota/audit/cost_middleware.py`, ~2,000 LOC) belong in the substrate per ADR-013's "all pheno-mcp-* servers are built on `pheno-mcp-router`" mandate, 5 files (`core/port.py`, `core/protocol.py`, `core/types.py`, `adapters/omni_http.py`, `server.py` extensions + the mock-backend test) stay in dispatch-mcp, the `LlamaAdapter` and `OpenAICompatAdapter` (the latter KP-authored on `feat/openai-compat-2026-06-15`) port to the substrate as new concrete adapters, the `PROVIDER_GUIDE.md` ports to substrate docs, the `Dockerfile.llama` + `llama-compose.yml` port to `phenotype-ops/agent-devops-setups/llama-cpp/`, and one cherry-pick (`dc4f1a3` CHEAP_LLM_MCP_DEPRECATION.md) is already done on `chore/w1-1-cheap-llm-mcp-deprecation-note-2026-06-15` — needs merge to main. The 10-step execution sequence (publish substrate → cherry-pick deprecation doc → port 6 substrate modules → port docs → port 2 adapters → port Docker files → land dispatch-mcp W2-1 with substrate coupling → archive Dmouse92 dispatch-mcp → archive KooshaPari dispatch-mcp → update AGENTS.md/SSOT.md/STATUS.md) gates on 8 verification commands in §5.3 before either archive can fire. Total estimate: ~2,400 LOC added to substrate, ~2,000 LOC deleted from dispatch-mcp, 0 net change to fleet functionality.
