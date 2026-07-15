# OmniRoute Backend Polyglot Rewrite — Session Overview

**Session ID:** `2026-07-05-omniroute-rewrite`
**Date opened:** 2026-07-05
**Owner:** root agent (manager mode)
**Sponsor:** Koosha
**Status:** PHASE 0 IN FLIGHT (toolchain skeleton)

---

## Goal

Rewrite the OmniRoute fork's backend (api/sdk/cli/server/middleware/db/providers) into a polyglot stack — **Rust + Go + Zig + Mojo (deferred)** — to ship the optimal, mature, enterprise, production-grade version. The Next.js dashboard, the Electron desktop shell, and the React UI are out of scope; they continue to run on Node 22+/24+.

## Success criteria

1. A single `dist/omniroute` binary per platform (macOS, Linux x86_64, Linux aarch64, Windows) that replaces `bin/omniroute.mjs` plus the Next.js server.
2. Performance: p50 overhead on `/v1/chat/completions` < 50ms; streaming > 5k tok/s/connection sustained.
3. Functional: the OpenAI-compatible HTTP surface is byte-for-byte (non-streaming) or semantically-equivalent (streaming) identical to the current TS server; the 1917 TS tests stay green throughout the migration.
4. Operational: a single `just release` produces the artifact; cross-compiles from macOS; goreleaser for the SDK.
5. FFI: the only cross-language boundary in v1 is the Rust `cdylib` (C-ABI) consumed by Go via cgo and by Zig via `extern "C"`.

## In scope

- All routes under `src/app/api/` (543 handlers)
- All of `src/lib/` (the domain layer)
- `bin/` (CLI, TUI, tray, ops scripts) — CLI to Go, TUI/tray deferred
- `open-sse/` (the 160+ provider catalog) — codegen'd into `omniroute-providers`
- `src/mitm/tproxy/native/` (C tproxy) — ported to Zig
- `electron/` (desktop shell) — retargeted, not rewritten
- `tests/` — 1917 TS tests stay green; new `cargo test` and `go test` suites in parallel

## Out of scope

- `src/app/(dashboard)/dashboard/*` (Next.js pages)
- `src/components/`, `src/hooks/` (React UI)
- `src/i18n/` (UI strings)
- `src/lib/tailscaleTunnel.ts` + `cloudflaredTunnel.ts` + `ngrokTunnel.ts` until Phase 4
- Mojo (deferred to v2)

## Key decisions

| Decision                              | Rationale                                                             |
| ------------------------------------- | --------------------------------------------------------------------- |
| Rust for the request path             | Lowest per-request overhead, first-class SSE, mature ecosystem        |
| Go for the CLI and SDK                | Cross-compiles to every Node target, fast startup, easy distribution  |
| Zig for the SSE parser and the tproxy | Zero-copy, simd-json, ports the existing C 1:1                        |
| Mojo deferred                         | 2026 production-readiness uncertain; ONNX via `ort` covers embeddings |
| `capnproto` for internal IPC          | Zero-copy, schema-stable, mature in both Rust and Go                  |
| Single binary via `omniroute-xtask`   | One artifact, one `PATH` entry, same UX as today                      |
| Side branch for Phase 0               | Avoids colliding with active PR286 / process-safety-rule work         |

## Active branches

| Branch                                  | Owner           | Purpose                    |
| --------------------------------------- | --------------- | -------------------------- |
| `fix/caddy-lb-policy-forwarded-headers` | current (PR286) | active work — DO NOT TOUCH |
| `chore/polyglot-rewrite-foundation`     | this session    | Phase 0 toolchain skeleton |

## Constraints

- The 1917 TS tests must stay green throughout the migration.
- The DB schema is the contract. 116 SQL files in `src/lib/db/migrations/` are the source of truth.
- The OpenAI-compatible HTTP surface is the contract. `/v1/chat/completions`, `/v1/embeddings`, `/v1/models`, etc. must continue to work with the same request/response shapes.
- Node runtime remains `>=22.0.0 <23 || >=24.0.0 <27` for the dashboard and Electron shell.
- The existing 543 route handlers are not deleted until the Rust replacement is in production with golden-set parity.

## Phases

1. **Phase 0 — Toolchain** (1 week): `rust/`, `go/`, `zig/`, `justfile`, `POLYREPO.md`, `omniroute-xtask` bundler. **Status: in flight (this session).**
2. **Phase 1 — Data plane** (4-6 weeks): `omniroute-db`, `omniroute-bridge`, Go CLI parity for data commands.
3. **Phase 2 — Request plane** (8-12 weeks): `omniroute-router`, `omniroute-providers`, `omniroute-auth`, `omniroute-compression`. Hot path.
4. **Phase 3 — Streaming, MITM, MCP/A2A, embeddings** (6-8 weeks): Zig SSE parser, Zig tproxy, `rmcp`, `jsonrpsee`, `ort`.
5. **Phase 4 — Retire the Next.js server** (4-6 weeks): single binary, frontend embedded.

Total: ~6-9 months for a single senior engineer; 3-4 months with a 3-person team.

## Open questions for sponsor

1. **Mojo in v1 vs v2?** Recommendation: defer to v2; ONNX via `ort` covers embeddings. Confirm?
2. **TUI in Go (bubbletea) or keep in TS?** Recommendation: keep in TS for v1; the TUI is small and out of the user's directive scope. Confirm?
3. **The 1917 TS tests — port or keep?** Recommendation: keep green throughout; port to `cargo test` only as we delete the corresponding TS code. Confirm?
4. **Electron shell retargeting — IPC contract change OK?** Recommendation: change the Electron IPC to talk to the new binary over HTTP. Confirm?
5. **Sponsor sign-off needed for each Phase's go/no-go gate.** Will pause for sign-off at the end of each phase.

## Subagent slots

- 3 of 4 concurrency slots are in use by the in-flight `recover_l5_122_wip` work (L5-122 execute cache, PR286). I will NOT interrupt that work.
- Phase 0 audit was done by the root agent in this turn (this session folder) because the slots were full.
- Once L5-122 work frees a slot, the Phase 1 audit/research fleet will be dispatched.

## Files in this session

| File                          | Lines  | Status                                  |
| ----------------------------- | ------ | --------------------------------------- |
| `00_SESSION_OVERVIEW.md`      | this   | written                                 |
| `01_TS_BACKEND_INVENTORY.md`  | 327    | written                                 |
| `02_POLYGLOT_ARCHITECTURE.md` | 323    | written                                 |
| `03_BOUNDARY_IPC_FFI.md`      | 321    | written                                 |
| `04_PHASE_0_SKELETON.md`      | (next) | will summarize what landed in this turn |

## Cockpit policy

- One-line repo-state bracket first: `[omniroute ↻, audit ✓, rust+go+zig 󰆧, ts 󰄬]`
- Progress bars with elapsed + ETA
- DAG of phases
- Agent table (`agent | task | state | summary`)
- Next-steps/questions (only decision-relevant)
- Nerd Font / unix-style symbols preferred
