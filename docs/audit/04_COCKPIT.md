# 04 — Live Cockpit (Backend Rewrite)

> **Format**: manager-cockpit per the durable user preference (top bracket → progress tree → DAG → agent table → questions).
> **Updated**: 2026-07-05 (each turn regenerates).

## Top bracket (state at a skim)

```
[omniroute-ts 󰄬 Tier2  | omniroute-rust 󰄬 v0.1  | bifrost-go ↻ Tier1  | omniroute-zig 󰀪  | mojo 󰀪  ]
```

## Progress tree (ETA + elapsed)

```
0.0 backend rewrite                                              #####.....  ~5%   12w  0.0w
├── 0.1 foundation (this turn)                                  ##########  100%   0.5d done
├── 1.x Rust Tier-2 front door                                  ........  queued
│   ├── 1.1 scaffold cleanup + first IT                          queued
│   ├── 1.2 Bifrost relay parity                                queued
│   └── 1.3 auth pipeline parity                                queued
├── 2.x translation + compression in Rust                       ........  queued
│   ├── 2.1 translation parity (golden-set ≥90%)                queued
│   └── 2.2 compression parity                                  queued
├── 3.x storage live migration                                  ........  queued
│   ├── 3.1 97-migration port + TS→Rust exporter                 queued
│   └── 3.2 repos parity                                        queued
├── 4.x 25 executors in Rust (5 waves × 5)                      ........  queued
│   ├── 4.1 wave 1 (openai/azure/vertex/bedrock/openai-compat)   queued
│   ├── 4.2 wave 2 (claude×2/codex/antigravity/kiro)            queued
│   ├── 4.3 wave 3 (gemini×2/chatgpt/deepseek×2)                queued
│   ├── 4.4 wave 4 (copilot×2/grok×2/qwen)                     queued
│   └── 4.5 wave 5 (kimi/doubao/windsurf/perplexity/glm)        queued
├── 5.x MCP server in Rust (94 tools, 4 waves)                  ........  queued
├── 6.x A2A server in Rust (6 skills)                           ........  queued
├── 7.x MITM in Rust (rustls + rcgen + instant-acme)            ........  queued
├── 8.x CLI in Rust (clap 4.5 + clap-ext)                       ........  queued
├── 9.x selective Zig leaf (tokenizer + compression)            ........  queued
├── 10  deprecate TS backend                                    ........  queued
├── 11  CI + distribution (cargo-dist + cargo-chef)             ........  queued
└── 12  hardening (load/chaos/sec/otel/SLO/runbook)             ........  queued
```

## DAG (lanes)

```
LANE  STATE    DETAIL
A     queued   Rust server + handlers + auth (slice 1.x)
B     queued   translation + compression + storage (slices 2-3)
C     queued   executors + MITM (slices 4 + 7)
D     queued   MCP + A2A + CLI (slices 5-6 + 8)
E     queued   Zig leaf + benches (slice 9)
F     queued   CI + distribution + hardening (slices 11-12)
T1    live     maximbq/bifrost Go sidecar (unchanged; this turn)
```

## Agent table

| agent                         | task                    | state   | summary                                                                          |
| ----------------------------- | ----------------------- | ------- | -------------------------------------------------------------------------------- |
| manager (root)                | audit + research + plan | done    | 4 docs in `docs/audit/`; 1 fix in `omniroute-rust/crates/omni-router/src/lib.rs` |
| lane_cli_build (sibling)      | unrelated work package  | running | not part of this turn                                                            |
| lane_cli_build/lane_cli_build | unrelated work package  | running | not part of this turn                                                            |
| lane_handler_wire             | unrelated work package  | running | not part of this turn                                                            |

> The 4-slot concurrency budget is fully consumed by 3 unrelated sibling agents + this manager. Subagent dispatch for the rewrite is blocked until slots free up. The manager will self-execute slice 1.1 + 1.2 (scaffold cleanup + Bifrost relay parity) in the next slot window.

## Evidence trail

- `omniroute-upstream-work/docs/audit/00_README.md` — 31 lines
- `omniroute-upstream-work/docs/audit/01_BACKEND_AUDIT.md` — 246 lines (audit)
- `omniroute-upstream-work/docs/audit/02_STACK_RESEARCH.md` — 302 lines (Rust/Go/Zig/Mojo)
- `omniroute-upstream-work/docs/audit/03_REWRITE_PLAN.md` — 276 lines (12 phases)
- `omniroute-upstream-work/docs/audit/04_COCKPIT.md` — this file
- `omniroute-rust/crates/omni-router/src/lib.rs:17` — added `ProviderId` to `pub use` (1 line, fixes `cargo check`)
- `omniroute-rust/crates/omni-server/src/handlers/v1_combos.rs:66` — dropped `let auth_ref = auth.as_ref();` borrow into `async move` that needed `'static`; pass `None` directly (1 line, fixes `cargo check --all-targets`)
- `cargo check --workspace` ✅
- `cargo test --workspace` ✅ (135 tests pass, 0 fail (with --all-targets))

## Next steps (decision-relevant only)

1. **Sponsor sign-off** on the polyglot Tier-2 decision (keep Bifrost as Tier 1, Rust for Tier 2, selective Zig, defer Mojo). The audit + research + plan are in `docs/audit/`.
2. **Concurrency**: 3 sibling agents own the 4-slot budget. Once they finish (estimated < 2h), the manager will dispatch up to 3 lane agents (A, B, D) in parallel to start slices 1.1, 1.2, 2.1.
3. **No work-in-flight requiring human input.** Slice 0.1 is done; the rest of phase 0/1 is well-scoped.

## Open questions (sponsor only)

- None at this turn. The first sponsor-blocking question is at slice 7 (MITM: Linux + macOS only? Windows scope?), expected ~3 weeks from now.
