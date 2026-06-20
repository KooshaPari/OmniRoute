# pheno-port-adapter — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `pheno-port-adapter/` — Hexagonal L4 Port/Adapter reference implementation (Rust)
**Status:** ACTIVE — ADR-038 reference impl, v0.1.0, Factory AI Agent Level 0 (functional)

---

## 1. Overview

`pheno-port-adapter` is the **minimal reference implementation** of ADR-038 (Hexagonal L4 Port/Adapter strategy) in the Phenotype ecosystem. It provides a single `PortAdapter` trait with `TcpAdapter` (cross-platform) and `UnixAdapter` (Unix-only) transport implementations. Intentionally the smallest Rust substrate — 489 lines of production code, 1 runtime dependency, 4 source files, 18 tests.

This crate serves as the canonical example that 19 other `pheno-*` Rust substrates are migrating to.

**Language:** Rust (edition 2021)
**Target:** Standalone library crate
**License:** MIT
**MSRV:** 1.82
**Total files:** 31 (4 `.rs` source, the rest are governance/CI/docs)

---

## 2. Repository Structure

```
pheno-port-adapter/
├── src/
│   ├── lib.rs               # PortAdapter trait + AdapterError + Connection + MockAdapter tests (125 lines)
│   └── adapters/
│       ├── mod.rs           # Module root + interior mutability doc (22 lines)
│       ├── tcp.rs           # TcpAdapter impl + 7 tests (169 lines)
│       └── unix.rs          # UnixAdapter impl + 6 tests, cfg(unix) (173 lines)
├── .github/
│   ├── CODEOWNERS           # @KooshaPari
│   ├── dependabot.yml       # Daily cargo, weekly GHA
│   ├── PULL_REQUEST_TEMPLATE.md
│   ├── ISSUE_TEMPLATE/      # Bug, feature, config
│   └── workflows/
│       ├── ci.yml           # Test + clippy + fmt + coverage
│       ├── lint.yml         # yamllint
│       ├── audit.yml        # cargo-deny + cargo-audit + TruffleHog
│       └── scorecard.yml    # OpenSSF Scorecard + CodeQL
├── Cargo.toml               # v0.1.0, 1 dep (thiserror)
├── deny.toml                # cargo-deny config
├── justfile                 # Task runner
├── llvm-cov.toml            # 80% line / 75% branch / 80% function gate
├── llms.txt                 # LLM-friendly content index
├── SPEC.md                  # 1-page canonical spec
├── STATUS.md                # Weekly status + 71-pillar scorecard
├── AGENTS.md, CHANGELOG.md, CONTRIBUTING.md, SECURITY.md, WORKLOG.md
└── README.md                # Placeholder (pillar L64 = 0/3)
```

---

## 3. Core Types

### 3.1 PortAdapter Trait (`src/lib.rs:24-29`)

```rust
pub trait PortAdapter: Send + Sync {
    fn name(&self) -> &str;
    fn health(&self) -> Result<(), AdapterError>;
    fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError>;
    fn disconnect(&self) -> Result<(), AdapterError>;
}
```

### 3.2 AdapterError (`src/lib.rs:5-14`)

```rust
pub enum AdapterError {
    ConnectFailed(String),
    DisconnectFailed(String),
    HealthCheckFailed(String),
    Timeout,
}
```
Derives `std::error::Error` + `Display` via `thiserror`.

### 3.3 Connection (`src/lib.rs:18-21`)

```rust
pub struct Connection {
    pub(crate) id: String,  // crate-visible only
}
```
**Opaque handle** — consumer sees only `id`, cannot influence internal state.

---

## 4. Adapter Implementations

### 4.1 TcpAdapter (`src/adapters/tcp.rs`)

| Aspect | Detail |
|---|---|
| Backend | `std::net::TcpStream` |
| Endpoint format | `host:port` (e.g., `127.0.0.1:8080`) |
| `name()` | `"tcp"` |
| `health()` | `stream.peer_addr()` as cheapest liveness probe |
| `connect()` | Validates non-empty, calls `TcpStream::connect`, replaces prior stream |
| `disconnect()` | `stream = None` (drops inner, sends FIN) |

**Tests (7):** name, health-when-disconnected, disconnect-when-disconnected, empty-endpoint, unroutable-endpoint, connect-to-listener (real `TcpListener`), reconnect-replaces-previous

### 4.2 UnixAdapter (`src/adapters/unix.rs`)

| Aspect | Detail |
|---|---|
| Backend | `std::os::unix::net::UnixStream` |
| `cfg` gating | `#[cfg(unix)]` — entire module |
| Endpoint format | Absolute path (e.g., `/tmp/sock`) |
| `name()` | `"unix"` |
| Patterns | Mirrors TcpAdapter exactly |

**Tests (6):** name, health-when-disconnected, disconnect-when-disconnected, empty-endpoint, missing-socket, connect-to-listener (real `UnixListener`)

### 4.3 MockAdapter (`src/lib.rs` — inline, test-only)

In-memory mock with configurable health/validity. Proves the trait is implementable.

**Tests (5):** connect-returns-connection, disconnect-returns-ok, health-check-passes, connect-to-invalid-endpoint-fails, adapter-name-is-non-empty

---

## 5. Key Design Patterns

### 5.1 Interior Mutability

Both adapters hold their stream in `Mutex<Option<T>>` because trait methods take `&self` (not `&mut self`):
- `TcpAdapter`: `Mutex<TcpState { stream: Option<TcpStream>, endpoint: Option<String> }>`
- `UnixAdapter`: `Mutex<UnixState { stream: Option<UnixStream>, endpoint: Option<String> }>`

### 5.2 Connection Semantics

- Opaque handle — real stream stays inside adapter
- **Replace on reconnect**: Calling `connect()` on an already-connected adapter drops the prior stream
- **No-op disconnect**: Calling `disconnect()` on a never-connected adapter returns `Ok(())`
- **Health via `peer_addr()`**: Cheapest liveness probe — returns `NotConnected` if peer closes

---

## 6. Dependencies

### Runtime

| Dependency | Version | Role |
|---|---|---|
| `thiserror` | 2.0 | **Only runtime dep** — derives `Error` + `Display` for `AdapterError` |

**Zero additional runtime dependencies** — TCP and Unix adapters use only `std`.

### CI Tooling

| Tool | Purpose |
|---|---|
| `cargo-llvm-cov` | Code coverage (80% line threshold) |
| `cargo-deny` | License + vulnerability + ban checks |
| `cargo-audit` | RustSec advisory database scan |
| `trufflehog` | Secret detection |
| `yamllint` | YAML linting |
| `ossf/scorecard-action` | OpenSSF security scorecard |
| `github/codeql-action` | CodeQL SARIF upload |

---

## 7. Test Coverage

| Test Location | Count | Pattern |
|---|---|---|
| `lib.rs` (MockAdapter) | 5 | Inline unit, configurable mock |
| `tcp.rs` | 7 | Real `TcpListener` echo server on thread |
| `unix.rs` | 6 | Real `UnixListener` in temp dir |
| **Total** | **18** | All use real OS sockets (no mocking) |

**Coverage gates** (from `llvm-cov.toml`): Line 80% / Branch 75% / Function 80%

Detailed test matrix:

| Test | Adapter | What it verifies |
|---|---|---|
| `name_is_tcp` / `name_is_unix` | Both | name() returns correct string |
| `health_when_disconnected_returns_error` | Both | Health fails when not connected |
| `disconnect_when_disconnected_is_ok` | Both | No-op disconnect is safe |
| `connect_to_empty_endpoint_fails` | Both | Empty string rejected |
| `connect_to_unroutable_endpoint_fails` | TCP | Unreachable host fails |
| `connect_to_missing_socket_fails` | Unix | Nonexistent path fails |
| `connect_to_listener_succeeds_and_health_passes` | Both | Full E2E: connect → health → disconnect |
| `reconnect_replaces_previous_connection` | TCP | Second connect replaces first |

---

## 8. Quality & Status

### 71-Pillar Scorecard: 60/213 (28.2%, Tier 0)

| Domain | Score | % |
|---|---|---|
| Architecture (L1-L12) | 24/36 | 67% |
| Performance (L13-L19) | 5/21 | 24% |
| Quality/Correctness (L20-L27) | 11/24 | 46% |
| Developer Experience (L28-L37) | 4/30 | 13% |
| User Experience (L38-L45) | 11/24 | 46% |
| Security (L46-L55) | 2/30 | 7% |
| Observability (L56-L63) | 2/24 | 8% |
| Documentation (L64-L68) | 4/15 | 27% |
| Governance (L69-L71) | 0/9 | 0% |

### Factory AI Agent Readiness: Level 0 (Functional)

---

## 9. What's Explicitly Deferred (v0.2.0+)

Per `SPEC.md:121-128`:

| Feature | Status |
|---|---|
| **Async on trait** | v0.1.x sync only |
| **TLS termination** | Caller responsibility |
| **Connection pooling** | Use `deadpool` |
| **Load balancing** | Caller responsibility |
| **HTTP/WebSocket/gRPC adapters** | Higher level in Go/Python SDKs |
| **More transports** (inproc, pipe) | Open extension point |

---

## 10. Key Observations

1. **Tiny, focused crate**: 489 lines across 4 files, 1 runtime dep. The smallest `pheno-*` substrate.

2. **ADR-038 reference implementation**: THIS crate is referred to by 19 other Rust substrates as the canonical example of Port/Adapter pattern.

3. **Real OS-level tests**: No mocking frameworks — tests use real `TcpListener` and `UnixListener` on background threads.

4. **Zero runtime deps beyond `thiserror`**: TCP and Unix adapters use only `std::net` and `std::os::unix`.

5. **No `README.md` content**: Pillar L64 = 0/3 — README.md exists but is a placeholder.

6. **CI on `wip` branch**: CI pipeline is defined but workflows are on `wip` branch, not merged to `main`.

7. **No `tracing` feature flag**: Unlike most `pheno-*` substrates, no observability integration.

8. **28.2% pillar score**: Heavy non-code infrastructure lift needed to reach Tier 1.

---

## 11. ADR Coverage

| ADR | Topic | Application |
|---|---|---|
| ADR-014 | Hexagonal L4 pattern | `PortAdapter` trait shape |
| ADR-023 | Agent work governance | Substrate placement, 80% coverage gate |
| ADR-038 | **Port/Adapter strategy** | This crate is the **reference implementation** |
| ADR-042 | Substrate quality bar | SPEC.md is element 1 |
| ADR-040 | Coverage gates | Line 80% / Branch 75% / Function 80% |
| ADR-025 | Worklog v2.1 schema | 11-column format |

---

## 12. Recommendations

1. **Fill README.md with real content** — current placeholder is pillar L64 gap
2. **Merge CI workflow to `main`** — currently on `wip` branch
3. **Add `tracing` feature flag** — align with other `pheno-*` substrates
4. **Add HTTP adapter** — most requested transport for Go/Python SDK consumers
5. **Address security pillar (7%)** — add threat model, security docs
6. **Improve governance pillar (0%)** — add charter, intent docs
7. **Add integration test directory** with cross-adapter scenarios
8. **Bump to v0.2.0** once deferred features (async, TLS, pooling) start landing
