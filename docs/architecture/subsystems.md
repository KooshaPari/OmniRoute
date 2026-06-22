# Subsystems — focalpoint

ADR-038 cross-link: see [ADR-038: Hexagonal port-adapter L4 policy](https://github.com/KooshaPari/phenotype-apps/blob/main/docs/adr/2026-06-18/ADR-038-hexagonal-port-adapter-l4-policy.md) for the canonical input/output port contract.

> L7 subsystem decomposition. Bounded contexts, ports, owned data, external
> dependencies, and failure modes for the focalpoint Rust workspace (focus
> / rule / penalty / reward / sync engine). Companion to `ARCHITECTURE.md`.
> Initial decomposition 2026-06-21 (v16 cycle-6 T1). The workspace
> contains 60+ crates; this doc summarizes the 5 macro-subsystems, not
> each individual crate.

## Subsystem map

| Subsystem | Path | Responsibility | Owned data | Critical? |
|---|---|---|---|---|
| Domain & rules | `crates/focus-domain`, `crates/focus-ir`, `crates/focus-lang`, `crates/focus-rules`, `crates/focus-policy` | Pure domain logic: focus rules, IR, rule engine, policy gates | rule AST, IR nodes, policy decisions | yes |
| Time & scheduling | `crates/focus-time`, `crates/focus-scheduler`, `crates/focus-always-on`, `crates/focus-penalties`, `crates/focus-rewards`, `crates/focus-rituals` | Time math, scheduling, penalties/rewards, rituals, always-on enforcement | scheduled task queue, penalty ledger, reward ledger | yes |
| Storage & sync | `crates/focus-storage`, `crates/focus-sync`, `crates/focus-sync-store`, `crates/focus-backup`, `crates/focus-replay` | Persistence, sync (local ↔ cloud), backup, replay engine | SQLite WAL, sync log, replay journal | yes |
| Observability & audit | `crates/focus-events`, `crates/focus-observability`, `crates/focus-telemetry`, `crates/focus-audit`, `crates/pheno-tracing` | Event log, OTLP, telemetry, audit trail | event stream, audit log, OTel spans | yes |
| Connectors & adapters | `crates/focus-connectors`, `crates/connector-*`, `crates/focus-ffi`, `crates/focus-mcp-server` | External service connectors (GCal, GitHub, Notion, Linear, Strava, etc.), FFI surface, MCP server | connector auth tokens, MCP session table | no |
| (Substrate) | `crates/phenotype-error-core`, `crates/phenotype-config`, `crates/phenotype-contracts`, `crates/phenotype-crypto`, `crates/phenotype-event-sourcing`, `crates/phenotype-policy-engine`, `crates/phenotype-workflow`, `crates/phenotype-test-utils` | Reusable shared libs (path-deps from substrate) | n/a (libs only) | yes |
| (Tooling) | `tooling/agent-orchestrator`, `tooling/bench-guard`, `tooling/release-cut` | Release / CI / orchestration tooling | release artifacts | no |

## Port catalogue

### Input ports (consumed)

- `pheno-config::Config` (via `Configra`) — layered config.
- `pheno-errors::Error` envelope.
- `pheno-tracing::Tracer` — OTLP export.
- `phenotype-event-sourcing::EventStore` — append-only event log.
- `phenotype-policy-engine::Policy` — gating rules.
- OS: Linux `landlock`/`seccomp`, macOS `sandbox-exec` (via `eidolon-sandbox`).

### Output ports (produced)

- `crates/focus-ir::FocusRule` — public rule AST.
- `crates/focus-events::FocusEvent` — public event schema.
- `crates/focus-policy::PolicyDecision` — public policy verdict.
- `crates/focus-ffi::FocusFfi` — C-ABI surface for Swift/Kotlin bindings.
- `crates/focus-mcp-server::*` — MCP `tools/list`, `tools/call`.
- CLI: `crates/focus-cli` (binary).
- Telemetry events on every rule evaluation (via `pheno-tracing`).

## External dependencies

| Dependency | Kind | Used by |
|---|---|---|
| `pheno-config` | Cargo path (workspace) | config cascade |
| `pheno-errors` | Cargo path | error envelope |
| `pheno-tracing` | Cargo path | OTLP spans |
| `phenotype-event-sourcing` | Cargo path | event store |
| `phenotype-policy-engine` | Cargo path | policy gates |
| `phenotype-crypto` | Cargo path | signing / verification |
| `eidolon-sandbox` | Cargo path (cross-repo) | process isolation |
| `mobile-mcp`, `mobile-cli` | cross-repo (subprocess or TCP) | device automation (tests only) |
| SQLite | C lib (via `rusqlite`) | storage engine |
| OS syscalls | Linux: landlock, seccomp, inotify; macOS: FSEvents, sandbox-exec | file watching, isolation |

## Failure modes

| Subsystem | Failure | Detection | Recovery |
|---|---|---|---|
| Domain & rules | rule parse error | parser error | log + skip rule; emit `RuleInvalid` |
| Domain & rules | policy decision stale | `Policy::is_stale` flag | re-evaluate; surface `PolicyRefresh` |
| Time & scheduling | clock skew | NTP poll | clamp to system clock; log warn |
| Time & scheduling | ritual missed | `Ritual::overdue` | backfill if grace window; else emit `RitualMissed` |
| Storage & sync | SQLite WAL corruption | `rusqlite` I/O error | rebuild from event log; surface `StorageRebuild` |
| Storage & sync | sync conflict | vector-clock compare | last-write-wins; emit `SyncConflict` |
| Storage & sync | backup target unreachable | network error | retry with backoff; max 5; surface `BackupFailed` |
| Observability & audit | OTLP backpressure | exporter full | drop low-priority spans; keep audit log |
| Observability & audit | audit log append-only violation | hash mismatch | freeze audit log; alert |
| Connectors & adapters | OAuth token expired | 401 from provider | refresh; re-auth; surface `AuthRefresh` |
| Connectors & adapters | rate limit | 429 from provider | backoff per provider's `Retry-After` |
| FFI / MCP server | consumer crash | socket close | release session; no state held |

## Change log

- 2026-06-21 — initial decomposition (v16 cycle-6 T1, L7). 5 macro-subsystems + 2 substrate/tooling rows. ADR-038 cross-link added.
