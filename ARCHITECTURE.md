# Architecture — omniroute-rust

Single-page navigation index. Canonical architecture lives in `docs/SPEC.md`; this is a pointer doc so newcomers find the right file fast.

## High-level

```
┌──────────────────────────────────────────────────────┐
│                  omniroute-rust                       │
│                                                       │
│  ┌─────────────┐   ┌─────────────┐   ┌──────────────┐ │
│  │ open-sse/   │   │ crates/     │   │ omniroute-rt/ │ │
│  │ SSE engine  │◄─►│ Bifrost +   │◄─►│ runtime       │ │
│  │             │   │ adapters    │   │              │ │
│  └─────────────┘   └─────────────┘   └──────────────┘ │
│         │                │                  │         │
│         ▼                ▼                  ▼         │
│  ┌──────────────────────────────────────────────────┐│
│  │   observability + MCP + A2A + skill registry     ││
│  └──────────────────────────────────────────────────┘│
└──────────────────────────────────────────────────────┘
```

## Crate map (13 members)

| Crate | Purpose |
|---|---|
| `crates/bifrost` | Tier-1 router — Rust port of `maximhq/bifrost` |
| `crates/adapters` | Provider adapter registry (231 entries) |
| `crates/combo` | Tier-2 routing engine |
| `crates/router` | HTTP routing primitives |
| `crates/observability` | OTel + Prometheus + structured logs |
| `crates/mcp-server` | Model Context Protocol server |
| `crates/a2a-server` | Agent-to-Agent JSON-RPC |
| `crates/skills` | Skills registry |
| `crates/memory` | Cross-session memory store |
| `crates/friction` | User-journey friction detector |
| `crates/self-aware` | Self-aware metrics |
| `omniroute-rt/` | Runtime: config, secrets, lifecycle |
| `open-sse/` | Streaming SSE engine |

## Boundaries

- **Tier-1 (Bifrost)** — providers come and go; this layer is stable
- **Tier-2 (combo + adapters)** — routing decisions, scoring, retry
- **API surface** — handlers (`/chat/completions`, `/embeddings`, etc.)
- **Persistence** — SQLite via `better-sqlite3`, schema migrations

## Cross-cutting concerns

- **Auth** — Bearer tokens via `authn/` module, scoped ACLs
- **Rate limiting** — IP + token-bucket sliding window
- **Audit logging** — JSONL to `$OMNIROUTE_DATA_DIR/audit/*.jsonl`
- **Tracing** — OpenTelemetry OTLP/HTTP; W3C `traceparent` propagation
- **Metrics** — Prometheus `/metrics` endpoint
- **Secrets** — env-driven, never in repo

## Key invariants

1. **No silent failure** — every error path is typed and tested
2. **Zero-cost abstractions** — Rust hot paths stay allocation-free where measured
3. **Spec-first** — every behavior change lands with a SPEC.md edit
4. **Bifrost fallback** — if Bifrost errors, falls through to legacy `chatCore` path (kill switch via env)
5. **No panics in production** — `#[no_panic]` audit enforced in CI

## Where to read next

- [`docs/SPEC.md`](docs/SPEC.md) — full specification
- [`docs/adr/`](docs/adr/) — architecture decision records
- [`docs/operations/`](docs/operations/) — runbooks
- [`AGENTS.md`](AGENTS.md) — agent operating manual

## Build / run

```bash
cargo build --release
./target/release/omniroute --port 20128
```
