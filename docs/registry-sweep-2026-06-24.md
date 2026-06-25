# Registry Accuracy Sweep — T-SP.2

**Date:** 2026-06-24
**Scope:** All `KooshaPari/*` repositories on GitHub (128 total)

## Method

1. `gh repo list KooshaPari --limit 300 --json ...` → raw repo metadata
2. Strip ANSI escape codes from gh CLI output
3. Compare GitHub repo names against `phenotype-registry/ECOSYSTEM_MAP.md` mentions + known org aliases
4. Diff = unknown repos (live on GitHub but not in the canonical ecosystem map)

## Results

| Metric | Value |
|---|---|
| Total KooshaPari repos on GitHub | **128** |
| Already mapped in ECOSYSTEM_MAP.md (direct + aliases) | **40** |
| **Unknown / not yet classified** | **88** |

## Unknown Repo Classification (88 total)

### Compute / Infra / Sandbox (8) — high-priority audit candidates
| Repo | Language | Description |
|---|---|---|
| Pine | Rust | Wine-equivalent for Phenotype — Windows compatibility layer |
| KDesktopVirt | Rust | AI Agent Desktop Automation with container orchestration |
| KVirtualStage | Go | Desktop automation platform for AI agents (archived, do-not-delete) |
| agentapi | Go | AgentAPI - Unified API gateway for AI agent orchestration (archived) |
| agentapi-plusplus | Go | HTTP API for Claude Code; Goose; Aider; Gemini; Amp; and Codex |
| argisexec | — | Argis exec runtime (archived) |
| KWatch | Go | Kubernetes cluster monitoring and alerting system |
| bifrost | Go | Fastest enterprise AI gateway (50x faster than LiteLLM) |

### Event / State / Runtime (4)
| Repo | Language | Description |
|---|---|---|
| Eventra | Rust | Event-driven architecture framework with CQRS + Event Sourcing |
| PhenoEvents | Rust | PhenoEvents - EventBus port with hexagonal architecture |
| PhenoRuntime | Rust | ARCHIVED placeholder |
| nexus | Rust | Service registry and discovery for microservices (Wave H) (archived) |

### VCS / Worktree / Tooling (5)
| Repo | Language | Description |
|---|---|---|
| PhenoVCS | Rust | Version control primitives + Git worktree management |
| Phenokits | — | (already in registry) |
| focalPoint | Svelte | Phenotype-org dependency management |
| rich-cli-kit | Rust | Rich CLI toolkit for terminal UX |
| sharecli | Rust | Shared CLI process manager for multi-project agent orchestration |

### Plugin / Framework (4)
| Repo | Language | Description |
|---|---|---|
| PhenoPlugins | Rust | Phenotype-org plugin framework |
| pheno-forge-plugins | Shell | Sidecar bundle for antinomyhq/forgecode (6 plugins) |
| pheno-forge-smoke | Rust | E2E smoke for the 4-PR forgecode stack (ADR-096) |
| pheno-cdylib-bridge | Rust | C-ABI shared library exposing pheno-* to Go |

### Core Library / SDK (6)
| Repo | Language | Description |
|---|---|---|
| phenoUtils | Rust | Foundational Rust utility crates for Phenotype |
| phenoAI | Rust | Phenotype AI agent workspace + tooling |
| pheno-context | Rust | Execution context propagation library (archived) |
| pheno-agents-md | Rust | AGENTS.md parse + validate (archived) |
| HeliosLab | TypeScript | Phenotype-org research lab |
| HeliosApp | TypeScript | An internal tool (archived) |

### SDKs (3)
| Repo | Language | Description |
|---|---|---|
| phenotype-go-sdk | Go | Phenotype-org Go SDK |
| phenotype-python-sdk | Python | Phenotype-org Python SDK |
| helios-cli | HTML | Phenotype-org multi-runtime CLI |

### Eye-Tracking / ML / Vision (2)
| Repo | Language | Description |
|---|---|---|
| eyetracker | Rust | Phenotype eye-tracking framework + UniFFI bindings |
| Melosviz | Python | Music-to-visual generation toolkit |

### Routing / Gateway / Routing layer (3)
| Repo | Language | Description |
|---|---|---|
| phenotype-router | Rust | Phenotype-owned router decision layer (ADR-050/051) |
| phenotype-gateway | Rust | Phenotype gateway (H10 absorption archive) |
| argis-extensions | Go | Argis gateway extensions |

### Ops / PM (4)
| Repo | Language | Description |
|---|---|---|
| phenotype-pm-core | Rust | Phenotype PM core (archived) |
| phenotype-ops | Rust | Phenotype ops |
| phenoEvents | Rust | (listed above) |
| Parpoura | HTML | Spec-first planning and architecture workspace |

### Form / Contract / Verification (2)
| Repo | Language | Description |
|---|---|---|
| PhenoContracts | HTML | Phenotype contract verification + Prusti/Kani adapters |
| KodeVibe | Go | The Ultimate Code Quality Guardian |
| KodeVibeGo | Go | Phenotype ecosystem component (deprecated, consolidated into HexaKit) |

### Landing / Web / Design (4)
| Repo | Language | Description |
|---|---|---|
| phenotype-landing | Astro | All Phenotype org landing pages (monorepo) |
| phenodocs | Vue | Phenotype documentation system with VitePress |
| phenoDesign | TypeScript | Design tokens + VitePress theme package |
| localbase3 | HTML | Localhost development environment bootstrap |

### Apps (3)
| Repo | Language | Description |
|---|---|---|
| phenotype-apps | HTML | iOS + web shell assets |
| AppGen | TypeScript | STRICTLY DO NOT DELETE — Personal project template |
| PlayCua | Rust | Bare-metal computer-use agent |

### Hardware / Mobile / Testing (3)
| Repo | Language | Description |
|---|---|---|
| hwLedger | — | Phenotype-org hardware ledger |
| kmobile | Rust | KMobile - mobile development CLI/API/MCP server |
| eyetracker | Rust | (listed above) |

### Legacy / Archived (25) — DO NOT TOUCH
- agentapi (archived)
- atoms.tech (archived)
- agslag, agslag-dash, agslag-docs (archived)
- canvasApp (archived)
- Compound-Spaces-3D + Backup (archived — WSM3D fork)
- Dino, Dino-fork (archived — DINOForge mod platform)
- heliosApp (archived)
- KDesktopVirt (active but personal)
- KlipDot (archived — DO NOT DELETE)
- KVirtualStage (archived — DO NOT DELETE)
- mobile-cli, mobile-mcp (archived)
- netweave-final2 (archived)
- P2, 472-P2-Flame-War (archived — Python tooling)
- PhenoProject (archived)
- phenotype-hub (archived — governance scaffold)
- phenotype-teamcomm (archived)
- QuadSGM (archived — Python orchestration)
- RIP-Fitness-App (archived — Android fitness)
- tehgent (archived — code review)
- MCPForge (archived — mcp-language-server)

### Personal / Templates / Misc (5)
| Repo | Language | Description |
|---|---|---|
| AppGen | TypeScript | Personal project template (DO NOT DELETE) |
| KaskMan | JavaScript | KaskManager R&D Platform |
| AtomsBot | HTML | — |
| foqos-private | Swift | Private mirror of awaseem/foqos for FocalPoint donor use |
| cliproxyapi-plusplus | HTML | The Plus version of CLIProxyAPI |

### Misc / Stubs (3)
| Repo | Language | Description |
|---|---|---|
| GDK | Rust | General Development Kit (Rust monorepo) |
| MCPForge | Go | (archived) |
| Project-Spyn | MATLAB | ASU FSE100 Project (archived) |
| agent-user-status | Python | An internal tool or component |

## Next Actions

1. **T-SP.2.1** — Add 8 "Compute/Infra" unknown repos to the registry's compute-infra subtree
2. **T-SP.2.2** — Add the 4 active framework libs (Eventra, PhenoEvents, PhenoVCS, PhenoUtils) to a new `frameworks` subtree
3. **T-SP.2.3** — Add the 3 SDKs to the existing `sdks` subtree
4. **T-SP.2.4** — Add the 3 routing/gateway repos to the existing `routing` subtree
5. **T-SP.2.5** — Mark the 25 archived/legacy repos explicitly in the registry with `[ARCHIVED]` tags
6. **T-SP.2.6** — Schedule periodic weekly `gh repo list` sweep as new DAG unit T-SP-099 (continuous registry accuracy)
