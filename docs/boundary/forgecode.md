# forgecode — Boundary

> Stub boundary file generated on 2026-06-18 by `scripts/render-stubs.py`
> for canonical repos with no curated prompts yet.

## In Scope

- Hexagonal TypeScript layout: `src/domain` (eval models, scoring, bounty rules), `src/ports` (provider, storage, notifier traits), `src/adapters` (GitHub API, CSV, CLI), `src/app` (composition root)
- `forge_*` workspace of 25 Rust+TS member crates: `forge_api`, `forge_app`, `forge_ci`, `forge_domain`, `forge_embed`, `forge_eventsource`, `forge_infra`, `forge_main`, `forge_repo`, `forge_services`, `forge_tool_macros`, etc.
- Bounty CLI: `just eval` runs the evaluation suite; `just test` runs bounty tests; `just lint` runs the lint/format chain
- AWS Bedrock + GCP Auth provider adapters (`aws-sdk-bedrockruntime`, `google-cloud-auth`) with auto token refresh
- OpenAI-compatible types via `async-openai` (types only, not the API client — reduces dependency surface)
- MCP client support via `rmcp` (transport-child-process, transport-streamable-http-client-reqwest, auth)
- In-memory event sourcing, JSON repair, markdown streaming, and a snapshot/replay system (`forge_snaps`)

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| Subagent dispatch / agent runtime | `substrate` / `Agentora` / `thegent` | forgecode is the eval/bounty plane; dispatch is owned by the agent runtimes |
| LLM router / cost tracking | `Tokn` `tokenledger::routing` / `OmniRoute` | forgecode emits traces; routing decisions are upstream |
| LLM provider credentials / auth | per-vendor (AWS / GCP / OpenAI) | forgecode consumes tokens; it does not own the auth surface |
| IDE integration (LSP, editor plugin) | N/A | forgecode is a CLI + library; IDE integration is a separate fork/extension |
| Bounty marketplace UI / payments | N/A (planned) | forgecode is the engine; the marketplace UI is a future workstream |

## Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| Agent traces consumed by | this-repo→`substrate` / `Agentora` | EventStream / MCP | green |
| Provider auth | this-repo→AWS / GCP / OpenAI | SDK | green |
| Eval results published to | this-repo→GitHub | GitHub API adapter | green |
| Bounty events | this-repo→`phenotype-journeys` (planned) | Event bus | amber — integration pending |
| `forge_*` crate reuse | this-repo→`phenotype-tooling` | Crate publish | amber — extraction per § 4 row 6 under review |

## Review cadence

Weekly per ADR-024. Refresh by `scripts/render-per-repo.py --force`
once any prompt binds to this repo.

## Source-of-Truth

- ECOSYSTEM_MAP.md § 6 (role classification)
- docs/intent/forgecode.md (intent statement)
- docs/registries.md (Capability & Intent SSOT layer)
