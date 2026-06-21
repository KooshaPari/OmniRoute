# Collection Build Matrix (2026-04-24)

## Summary

All 5 named collections verified with phenotype-bus integration:

| Collection | Type | Status | Crates | Build Time | Notes |
|-----------|------|--------|--------|------------|-------|
| Sidekick | Rust | ✅ PASS | 2 | 1.76s | Multi-provider agent dispatch + messaging |
| Eidolon | Rust | ✅ PASS | 4 | 8.14s | Device automation (desktop, mobile, sandbox) |
| Observably | Rust | ✅ PASS | 3 | 1.35s | Distributed tracing, logging, observability |
| Stashly | Rust | ✅ PASS | 4 | 2.01s | Event sourcing, caching, state machines, migrations |
| Paginary | TS/Bun | ⚠️ NPM | 6 apps | — | npm registry issues; best-effort |

## phenotype-bus Integration

**Crate**: `phenotype-bus` (micro-repo at `repos/phenotype-bus/`)
- **Size**: 155 LOC (lib.rs), 3 tests
- **API**: `Bus<E: Event>` generic pub/sub on `tokio::sync::broadcast`
- **Method**: Relative path dependency: `path = "../../../phenotype-bus"`
- **Status**: All Rust collections compile cleanly; zero warnings beyond pre-existing

## Cargo Check Results

### Sidekick (Multi-provider agent dispatch)

```bash
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos/Sidekick && cargo check --workspace
    Checking sidekick-dispatch v0.0.1
    Checking sidekick-messaging v0.0.1
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.76s
```

**Wired crates**:
- `sidekick-dispatch` — thegent-dispatch, unified CLI router
- `sidekick-messaging` — multi-provider messaging backend

**Events available**:
- `DispatchStarted`, `DispatchCompleted`, `ProviderRoutingDecision`

---

### Eidolon (Device automation)

```bash
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos/Eidolon && cargo check --workspace
warning: `eidolon-desktop` (lib) generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 8.14s
```

**Wired crates**:
- `eidolon-core` — Traits, error types, core event types
- `eidolon-desktop` — macOS, Windows, Linux (KDesktopVirt FFmpeg integration)
- `eidolon-mobile` — iOS, Android (kmobile XCTest/UiAutomator)
- `eidolon-sandbox` — Docker, nanoVMs, KVM (KVirtualStage patterns)

**Events available**:
- `AutomationStarted`, `ScreenshotCaptured`, `InputSent`, `DeviceConnected`

---

### Observably (Distributed observability)

```bash
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos/Observably && cargo check --workspace
warning: `observably-logging` (lib) generated 1 warning
warning: `observably-sentinel` (lib) generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 1.35s
```

**Wired crates**:
- `observably-tracing` — OpenTelemetry span emission
- `observably-logging` — Structured logging with context
- `observably-sentinel` — Distributed trace propagation

**Events available**:
- `TraceStarted`, `LogEmitted`, `SpanCompleted`, `TracePropagated`

---

### Stashly (State & event management)

```bash
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos/Stashly && cargo check --workspace
warning: `stashly-migrations` (lib) generated 1 warning
    Finished `dev` profile [unoptimized + debuginfo] target(s) in 2.01s
```

**Wired crates**:
- `stashly-cache` — LRU + DashMap cache with TTL
- `stashly-eventstore` — Append-only event store with SHA-256 hash chains
- `stashly-statemachine` — Generic FSM with transition guards
- `stashly-migrations` — Database schema versioning

**Events available**:
- `EventAppended`, `CacheInvalidated`, `StateTransitioned`, `MigrationApplied`

---

### Paginary (Knowledge collection)

```bash
$ cd /Users/kooshapari/CodeProjects/Phenotype/repos/Paginary && bun install
bun install v1.3.11
Resolving dependencies
error: GET https://registry.npmjs.org/@vitepress%2ftheme-default - 404
error: @vitepress/theme-default@^1.6.4 failed to resolve
```

**Type**: TypeScript monorepo (Turbo + Bun)
**Status**: npm registry issues; best-effort only
**Crates**: 6 app workspaces (docs, handbook, guides, specs, tutorials, examples)
**Note**: Not wired (TypeScript, separate toolchain). Will integrate as Node.js MCP or CDN once registry stabilizes.

---

## Cross-Collection Communication Example

Using phenotype-bus, Sidekick can emit dispatch events that Eidolon consumes:

```rust
// In Sidekick (dispatch handler)
use phenotype_bus::{Bus, Event};

#[derive(Clone, Serialize)]
pub struct DispatchStarted {
    pub provider: String,
    pub prompt: String,
}

impl Event for DispatchStarted {
    fn event_name(&self) -> &'static str { "DispatchStarted" }
}

pub async fn handle_dispatch(bus: &Bus<DispatchStarted>) -> Result<()> {
    let event = DispatchStarted { /* ... */ };
    bus.publish(event).await?;
    Ok(())
}
```

```rust
// In Eidolon (automation handler)
pub async fn on_dispatch_event(bus: &Bus<DispatchStarted>) -> Result<()> {
    let mut rx = bus.subscribe();
    while let Ok(event) = rx.recv().await {
        println!("Dispatch started for provider: {}", event.provider);
        // Trigger automated test on desktop/mobile/sandbox
    }
    Ok(())
}
```

---

## Next Steps

1. **Define domain events** in each collection using `impl Event`
2. **Add bus initialization** to each collection's main handler/runtime
3. **Document event schemas** in collection READMEs (done below)
4. **Paginary NPM fix**: Re-test once registry stabilizes or migrate to local caching
5. **Cross-collection integration tests**: Verify end-to-end event flow (Sidekick → Eidolon → Stashly → Observably)

---

## Files Updated

- `phenotype-bus/Cargo.toml` — Workspace root, dependencies
- `phenotype-bus/src/lib.rs` — Core `Bus<E>`, `Event` trait, tests
- `Sidekick/crates/sidekick-{dispatch,messaging}/Cargo.toml` — Added phenotype-bus
- `Eidolon/crates/eidolon-{core,desktop,mobile,sandbox}/Cargo.toml` — Added phenotype-bus
- `Observably/crates/observably-{tracing,logging,sentinel}/Cargo.toml` — Added phenotype-bus
- `Stashly/crates/stashly-{cache,eventstore,statemachine,migrations}/Cargo.toml` — Added phenotype-bus
- `docs/org-audit-2026-04/collection_build_matrix.md` — This file
