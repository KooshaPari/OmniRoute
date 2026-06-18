# ADR-ECO-007: Gateway merge superset boundaries

## Status
Accepted (2026-06-17, Wave 14 gateway rationalization)

## Context
Remote audit (2026-06-17) found **34 branches** on `agentapi-plusplus`, registry contradictions (PLAN archived OmniRoute and agentapi++ while ECOSYSTEM_MAP Cluster A keeps OmniRoute canonical), and overlapping gateway/inference/engine layers without explicit `DOMAIN_ROLES` entries.

## Decision

### Route / API gateway layer

| Repo | Role ID | Verdict |
|------|---------|---------|
| **OmniRoute** | `route` | **CANONICAL** TypeScript LLM router — never archive; never merge into agentapi++ or bifrost |
| **Tokn** | `route` | **CANONICAL** Rust routing substrate (`tokenledger::routing`) |
| **agentapi-plusplus** | `cli_proxy` | **CANONICAL** CLI agent HTTP proxy — merge superset of archived `agentapi` + org branches; **not** an archive candidate |
| **cliproxyapi-plusplus** | `cli_proxy` (peer) | **AFFIRM** peer repo; initial policy = git submodule / `third_party/` pin in agentapi++ (Option B); re-evaluate monorepo after main is clean |
| **bifrost** | vendor fork | **DYNAMIC-KEEP** — quarterly upstream sync from `maximhq/bifrost:dev`; **never** merge into OmniRoute or Tokn |
| **substrate** | `connect` | MCP/dispatch runtime (ADR-017/019); routes to gateways, not a router SSOT |

### Inference runtime layer

| Repo | Role ID | Verdict |
|------|---------|---------|
| **phenotype-omlx** | `inference` | **ARCHIVED** pending product decision (FINISH vs DROP); engine stays upstream `jundot/omlx` / mlx-lm |
| **phenoAI** | consumer | Skeleton workspace; consumes OmniRoute/Tokn — not canonical router |

### Engine / isolation layer (keep separate)

| Repo | Role ID | Verdict |
|------|---------|---------|
| **PhenoCompose** | `platform` | **AFFIRM** NVMS + process-compose isolation owner |
| **nanovms** | `platform` | **AFFIRM** in `phenotype-tooling` (archived standalone repo) |

### Retire / skip

| Repo | Verdict |
|------|---------|
| **vibeproxy** | Deprecated client; README redirect → cliproxyapi-plusplus only |
| **vibeproxy-monitoring-unified** | Governance stub — retire row; no reconciliation |
| **vibeproxy-\*** | **Out of scope** for this program |

## Rationale
Three-layer topology prevents gateway repos from absorbing inference engines (omlx/mlx-lm) or isolation runtimes (nanovms/PhenoCompose). agentapi-plusplus org work supersedes stale "archive upstream fork" guidance.

## Consequences
- `RATIONALIZATION_PLAN.md` Step 1 archive list corrected for OmniRoute and agentapi-plusplus
- Wave 15 executes branch merge on agentapi-plusplus; disposition `fsm` → `done` when branches ≤ 5
- cliproxy boundary appendix lives in this ADR; implementation in Wave 16
- bifrost: `docs/VENDOR_PATCHES.md` in fork; no manual prune of upstream-style branches

## Appendix A — cliproxy boundary options

| Option | When | Outcome |
|--------|------|---------|
| **A: Monorepo** | Shared CI/release with agentapi++ | cliproxy becomes directory or workspace member |
| **B: Peer + submodule** (initial) | Independent Plus upstream sync | Keep repo; pin in agentapi++ `third_party/` |
| **C: phenotype-go-sdk** | go-auth vendoring is sole canonical | Align ECOSYSTEM_MAP edge only |

## Appendix B — omlx FINISH vs DROP (Wave 17 gate)

| Path | Criteria |
|------|----------|
| **FINISH** | Org needs macOS menu-bar MLX product → unarchive, upstream sync lane, branding layer only |
| **DROP** | phenoAI + OmniRoute + upstream omlx sufficient → stay archived with pointer to omlx.ai |
