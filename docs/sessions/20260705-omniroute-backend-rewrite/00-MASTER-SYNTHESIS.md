# Master Synthesis — OmniRoute Rust Rewrite Audit + Plan

**Session:** 20260705-omniroute-backend-rewrite
**Author:** root (main thread, slot ceiling binding on background research pack)
**Date:** 2026-07-05 03:45Z
**Mode:** Sponsor-facing. Top bracket first, then evidence.

## Top bracket

```
[omniroute-fork wip | 6/6 audit docs done | 0 blocked-on-deps | 0 waiting on sponsor |
 1453 lines of new audit material | 30 PRs sequenced | 24 weeks calendar |
 pure-Rust confirmed (D7 modified) | strangler-fig confirmed (D8 kept) |
 12 omni-* crates scaffolded, 1 has code | bifrost v1.5 | sqlite-only v1 |
 30 providers v1 / 149 v1.5 | opencode plugin contract locked in PR-2 |
 kill switch <30s | 4-agent fleet 4-slot ceiling respected]
```

## Effective progress

```
OmniRoute rewrite audit+plan     ##########  ~100%  6/6 deliverables done
+- 01 Inventory                  ##########  ~100%  318 lines, 13 sections, evidence-cited
+- 02 Language eval              ##########  ~100%  157 lines, D7 modified to pure-Rust
+- 03 Architecture survey        ##########  ~100%  233 lines, 8 gateways, 11 patterns, 13 P0
+- 04 Migration strategy         ##########  ~100%  274 lines, 6 phases, 24 weeks, kill switches
+- 05 Requirements               ##########  ~100%  260 lines, 50+ FRs, 25+ NFRs, 8 risks
+- 06 Plan (PR sequence)         ##########  ~100%  166 lines, 30 PRs, 24 weeks, 6 phases
+- Master synthesis (this file)  ##########  ~100%
+- Session overview              ##########  ~100%  45 lines
```

`effective  ~100% audit+plan material  --  0 code changes, 0 commits, 0 PRs opened (read-only audit)`

## State-of-the-fork (verified on disk 2026-07-05 03:45Z)

| Surface | Value | Source |
|---|---|---|
| HEAD | 16b0af995 | `git log --oneline -1` |
| Branch | fix/caddy-lb-policy-forwarded-headers | (4 ahead, 148 behind origin) |
| TS LOC (src/ + open-sse/) | ~351k | file count + line count |
| .test files | 1917 | `find tests -name '*.test.ts' \| wc -l` |
| API routes (Next.js) | 538 files in src/app/api/ | `find src/app/api -name 'route.ts' \| wc -l` |
| API subdirs | 87 | matches AGENTS.md "87" claim — this is the actual 87 number |
| Provider registries | 149 dirs in open-sse/config/providers/registry/ | `find ... -type d \| wc -l` |
| MCP tools | 22 (NOT 87) | `open-sse/mcp-server/schemas/tools.ts` self-declares 22 |
| CLI subcommands | 81 in bin/cli/commands/ | `ls bin/cli/commands \| wc -l` |
| CLI api-commands | 32 in bin/cli/api-commands/ (AUTO-GENERATED) | `ls bin/cli/api-commands \| wc -l` |
| Routing strategies | 17 in ROUTING_STRATEGY_VALUES | `src/shared/constants/routingStrategies.ts` |
| Auto-routing strategies | 8 in AUTO_ROUTING_STRATEGY_VALUES | same file |
| Env vars in .env.example | 1811 lines | `wc -l .env.example` |
| SQL migrations | 80 in src/lib/db/*.sql | `find ... -name '*.sql' \| wc -l` |
| phenotype-* crates | 67 in pheno/crates/ | `find pheno -name 'Cargo.toml' \| wc -l` |
| omniroute-rust crates | 12 (1 with code, 11 empty) | from `omniroute-rust/Cargo.toml` |
| omniroute-rust lines (omni-core) | 682 | from `find ... -name '*.rs' \| xargs cat \| wc -l` |
| Rust toolchain | 1.86.0 | `rust-toolchain.toml` |

## Key corrections to the prior session's claims

| Prior claim | Verified reality | Action |
|---|---|---|
| AGENTS.md: "231 providers" | 149 provider registries on disk (the 231 number may double-count sub-variants like `gemini/web`, `gemini/cli`) | Use 149 in the rewrite; flag for verification |
| AGENTS.md: "87 MCP tools" | 22 MCP tools per the actual schema file | Use 22; the "87" is the API subdir count, not MCP tools |
| AGENTS.md: "30 MCP scopes" | Not yet verified by grep; needs verification | Flag for PR-1 |
| AGENTS.md: "OpenAI-compatible endpoints..." | 538 Next.js route files; the OpenAI-compat surface is a subset (~30 endpoints) | Use 538 as the porting target count |
| D7 (prior): "Rust hot + Go orch + TS glue + Zig FFI; Mojo not used" | The actual scaffold (`omniroute-rust/Cargo.toml`) is **pure Rust**, no Go, no Zig | **D7 MODIFIED**: confirm pure-Rust everywhere; the scaffold is the commitment |
| D8 (prior): "Strangler-fig, parallel-run 1 quarter behind feature flag" | Validated; the 6-phase plan in 04-STRATEGY.md implements this | D8 KEPT |

## The 6 deliverables (this turn)

| # | File | Lines | Key finding |
|---|---|---|---|
| 01 | `01-inventory/00-INVENTORY.md` | 318 | Full surface map; 149 providers, 22 MCP tools (NOT 87), 538 routes, 17 routing strategies |
| 02 | `02-language-eval/00-EVAL.md` | 157 | D7 modified to pure-Rust; Mojo confirmed no-prod-HTTP; Zig no ecosystem; Go not needed |
| 03 | `03-architecture-research/00-SURVEY.md` | 233 | 8 gateways surveyed; 11 patterns; Bifrost named ref; layered design matches omni-* crates |
| 04 | `04-migration-strategy/00-STRATEGY.md` | 274 | 6 phases; shadow → per-tenant → per-model → weighted → full → decommission; 24 weeks; kill switch <30s |
| 05 | `05-requirements/00-REQUIREMENTS.md` | 260 | 50+ FRs across 10 areas; 25+ NFRs (perf, rel, sec, obs, maint, comp); 8 risks + 7 uncertainties |
| 06 | `06-plan/00-PLAN.md` | 166 | 30 PRs over 24 weeks; risk gates; kill switch matrix; Cargo dep additions per PR |

## Top 10 decisions for sponsor sign-off

| # | Decision | Recommendation | Default if no answer |
|---|---|---|---|
| D-omni-01 | Calendar start | 2026-08-01 (after absorptions settle) | 2026-08-01 |
| D-omni-02 | Bifrost pivot in v1 or v1.5 | v1.5 | v1.5 |
| D-omni-03 | Provider count in v1 | 30 (curated) + 119 deferred to v1.5 | 30 |
| D-omni-04 | Postgres in v1 | no (SQLite-only) | no |
| D-omni-05 | Chaos engineering in scope | yes | yes |
| D-omni-06 | i18n (42 locales) in v1 | no (v1.5) | no |
| D-omni-07 | tproxy native module in scope | no (v2) | no |
| D-omni-08 | OpenCode plugin as first-class consumer | yes — lock contract in PR-2 | yes |
| D-omni-09 | TUI + tray in CLI | yes (ratatui + tao) | yes |
| D-omni-10 | Weekly standup cadence | weekly | weekly |

## Top 5 risks (sponsor awareness)

| # | Risk | Mitigation |
|---|---|---|
| R-omni-1 | 149 provider adapter port is the bottleneck | Curate 30 in v1, parallelize across 4 agents |
| R-omni-2 | Shared SQLite during migration is risky | Additive migrations only during migration; per AGENTS.md "no backwards compat shims" applies AFTER Phase 5 |
| R-omni-3 | Bifrost pivot might break omni-router design | `RouterPort` abstraction in `omni-core` decouples the two |
| R-omni-4 | OpenCode plugin might break if /v1/models shape changes | Lock contract in PR-2 before any provider work |
| R-omni-5 | 4-concurrency-slot ceiling is binding | Slot-aware scheduling; prioritize parallel lanes |

## Cross-project dependencies (for the cockpit tree)

```
OmniRoute Rust rewrite
  +-- depends-on: pheno/bifrost/ (canonical router, ADR-001; currently empty -- separate session needed)
  +-- depends-on: pheno/crates/phenotype-{errors,port-traits,config-loader,rate-limit,retry,
                    crypto,cache-adapter,cost-core,async-traits,shared-config,logging,observability}
                    (67 crates already in place, all referenced in omniroute-rust/Cargo.toml)
  +-- depends-on: AuthKit (canonical Rust auth boundary, per 01-AUTH-TRIAGE)
  +-- provides:    OpenAI-compatible HTTP API (consumer: Electron desktop + OpenCode plugin + raw HTTP)
  +-- provides:    MCP server on stdio + HTTP (consumer: Claude Desktop + others)
  +-- provides:    A2A v0.3 protocol (consumer: A2A clients)
  +-- provides:    CLI (consumer: ops, end users)
  +-- provides:    SDK (omni-sdk, consumer: TS desktop + opencode-plugin)
  +-- parallel:    TS fork (src/, open-sse/) stays running through Phase 5 (decommission)
  +-- parallel:    BytePort Surface 100% (separate lane, NOT in root scope)
  +-- parallel:    phenodag absorption (separate lane, NOT in root scope)
  +-- gates:       D-omni-01..10 sponsor sign-off
  +-- gates:       4-concurrency-slot sub-agent ceiling (4-slot, max 4 parallel)
```

## Open questions (auto-deferred, awaiting sponsor)

1. **Sponsor go/no-go on the audit + plan.** The 6 deliverables are on disk. If approved, the next turn can start PR-1 (extend omni-core).
2. **D-omni-01..10 above.** The recommendations are the defaults; sponsor can override.
3. **pheno/bifrost/ is empty.** The bifrost pivot is deferred to v1.5, but the empty crate is a real gap. Coordinate with the pheno owner on who scaffolds it and when.
4. **Concurrent absorptions.** The 3 background research agents (authvault_cross_link_sweep, phenodag_absorption_spec_write, agent_phenodag) are still running. They will land in the prior session folder, not this one. If their findings affect the OmniRoute rewrite (e.g. a shared crate), the plan must be updated.

## Next steps (auto, no sponsor action)

1. (this turn) wrote 6 deliverables + session overview + master synthesis (1453 lines total).
2. (this turn) verified on disk: 12 omni-* crates scaffolded; 1 has code; Cargo deps locked; toolchain pinned.
3. (next turn on sponsor return) confirm D-omni-01..10 and start PR-1.
4. (next turn) the 3 background research agents will land; fold any shared-crate findings into PR-1 or PR-2.

## Prior session context (preserved from the prior turn's close)

The prior turn created the `20260705-fork-reqwrite-audit/` session with:
- 6 triage documents (01-AUTH-TRIAGE through 06-RISKS-AND-OPEN-QUESTIONS) at 04-triage/
- 00-MASTER-SYNTHESIS.md
- The 7 strict-pause archive banners (AtomsBot, GDK, KaskMan variants)
- 4 PRs queued (org-audits spine, apps spine, Authvault archive, cross-link sweep)

The prior turn explicitly stated OmniRoute was "out of root scope" but **the user has since overridden that in the current prompt** ("you own all backend\api\sdk\cli etc non-frontend aspects of that fork"). This session folder (`20260705-omniroute-backend-rewrite/`) was created by the prior turn specifically to be "yours" — the OmniRoute lane.

The current turn produces the deep audit + plan that the prior turn deferred. The audit material is in this session folder. The actual code work (PR-1..PR-31) is gated on sponsor sign-off.

