# OmniRoute Backend Rewrite — Deep Audit + Plan

**Session:** 20260705-omniroute-backend-rewrite
**Date:** 2026-07-05 03:20Z
**Author:** root (manager) + 4 dispatched sub-agents
**Mode:** Sponsor-facing. Top bracket first, then evidence.

## Top bracket

```
[omniroute wip | 4 audits wip | 0 blocked | rust+go+ts+zig split pending |
 mojo not-yet | strangler-fig queued | phenodag byteport auth archives done x4]
```

## Objective

Produce the canonical deep audit + plan/spec/requirements for the non-frontend
rewrite of the OmniRoute fork to the optimal/mature/enterprise/prod-grade bar.
Scope: backend, API, SDK, CLI. Excluded: Electron/PWA/web frontend.

## Lane layout

| #   | Lane                  | Subdir                   | Mission                                                                                                  | Status |
| --- | --------------------- | ------------------------ | -------------------------------------------------------------------------------------------------------- | ------ |
| 01  | Inventory             | 01-inventory             | Enumerate every endpoint, provider, MCP tool, CLI cmd, SDK export in the fork                            | wip    |
| 02  | Language eval         | 02-language-eval         | Web research: rust/go/zig/mojo for LLM-gateway workloads (mid-2026)                                      | wip    |
| 03  | Architecture research | 03-architecture-research | SOTA LLM gateway patterns: Bifrost, Portkey, Helicone, LiteLLM, OpenRouter, Cloudflare/Vercel AI Gateway | wip    |
| 04  | Migration strategy    | 04-migration-strategy    | Strangler-fig / parallel-run patterns; case studies; feature flag strategy                               | wip    |
| 05  | Requirements          | 05-requirements          | Spec-level functional + non-functional requirements (FRs/NFRs/ARUs)                                      | queued |
| 06  | Plan                  | 06-plan                  | Sequenced PRs, dependencies, risk gates, kill switches                                                   | queued |

## Pre-decided (sponsor-stated, awaiting verification)

- **D7** Language split: Rust hot-path + Go orchestration + TS SDK glue + Zig FFI; Mojo not used (no production HTTP stack 2026-07). Lanes 02-03 will re-verify with mid-2026 evidence.
- **D8** Migration pattern: Strangler-fig, parallel-run 1 quarter behind feature flag. Lane 04 will produce the runtime topology.
- **Out of scope:** Frontend (Electron, PWA, web UI). Owner of frontend is downstream.
- **Inherits from prior session:** AuthKit is canonical auth boundary; Authvault deleted.
- **Predecessor repos to absorb:** Phenodag -> Tracera/AgilePlus (thin redirector 1 release, then archive).

## Subagent brief constraints

- All sub-agents MUST verify every claim against on-disk evidence (file:line) or against cited URLs.
- All sub-agents MUST write findings to their assigned subdir before reporting back.
- All sub-agents MUST surface open questions, not silently paper over them.
- Cross-lane dependencies go in 06-plan/00-OPEN-QUESTIONS.md, not back-channel.
