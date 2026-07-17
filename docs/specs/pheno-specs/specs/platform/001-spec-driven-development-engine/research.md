# Research: AgilePlus — Spec-Driven Development Engine

**Date**: 2026-02-27
**Feature**: [spec.md](spec.md)

## R1: Rust SQLite Bindings

**Decision**: rusqlite with WAL mode
**Rationale**: rusqlite is the most mature Rust SQLite binding (7k+ GitHub stars, active maintenance). WAL mode enables concurrent reads while maintaining single-writer semantics — perfect for CLI reads + API reads + single writer pattern.
**Alternatives considered**:
- sqlx (async, but SQLite support is secondary to PostgreSQL; WAL handling less documented)
- diesel (ORM overhead unnecessary; raw SQL with typed queries via rusqlite is simpler for our schema)

## R2: Rust Git Bindings

**Decision**: git2 (libgit2 bindings)
**Rationale**: git2-rs is the standard Rust binding for libgit2. Supports worktree operations (create, list, prune), branch management, and commit inspection. Used by cargo itself. Covers all our needs: worktree creation (FR-010), artifact read/write (FR-014), branch merging (FR-006).
**Alternatives considered**:
- gitoxide (pure Rust, faster for some operations, but worktree API is still maturing)
- shelling out to `git` CLI (works but loses type safety, error handling is fragile)

## R3: gRPC for Rust↔Python IPC

**Decision**: tonic (Rust) + grpcio (Python) with Protobuf
**Rationale**: tonic is the de facto Rust gRPC library (tokio-native, high performance). grpcio is the official Google gRPC Python binding. Protobuf provides strongly typed contracts with code generation for both languages. Bidirectional streaming enables real-time agent event forwarding from core to MCP.
**Alternatives considered**:
- JSON-RPC over Unix sockets (simpler but no codegen, no streaming, weaker types)
- NATS (used in bifrost-extensions, but adds broker dependency for local-only communication)
- Cap'n Proto (faster serialization but smaller ecosystem, fewer Python tools)

## R4: Hash-Chained Audit Log

**Decision**: SHA-256 chain in SQLite, compatible with thegent's ADR-015 pattern
**Rationale**: thegent already uses SHA-256 hash-chained JSONL audit logs (see `crates/thegent-router/src/audit.rs`). We adopt the same pattern for interoperability but store in SQLite instead of JSONL for queryability. Each entry hashes: `id + timestamp + actor + transition + evidence_refs + prev_hash`. Chain integrity verifiable via sequential scan.
**Alternatives considered**:
- Blake3 (faster, used in thegent-jsonl, but SHA-256 is more widely auditable/verifiable)
- Merkle tree (more complex, unnecessary for append-only linear log)
- JSONL like thegent (loses queryability; we need SQLite for state tracking anyway)

## R5: Agent Dispatch Mechanism

**Decision**: Shell-based dispatch via Claude Code CLI (`claude`) and Codex CLI (`codex`)
**Rationale**: Both agents support non-interactive/headless modes. Claude Code supports `--print` mode and can be invoked with system prompts. Codex supports similar batch execution. AgilePlus constructs the prompt (WP goal, FR references, governance rules) and invokes the agent CLI in a worktree directory. Agent output (commits, PRs) is observed via GitHub API polling.
**Alternatives considered**:
- Agent SDK (Claude Agent SDK) — more programmatic control but tighter coupling to specific agent version
- MCP tool invocation — agents would call AgilePlus MCP tools, but we need AgilePlus to invoke agents, not the reverse

## R6: Plane.so Integration

**Decision**: Plane.so Community Edition via REST API
**Rationale**: Plane.so CE is self-hosted, open-source (Apache 2.0), supports Docker Compose deployment. Its API covers: work items (→ WPs), cycles (→ features), modules (→ governance), views (→ dashboards). AgilePlus API layer proxies SQLite state to Plane.so format, keeping Plane.so as a read-mostly view layer with selective write-back for user-initiated status changes.
**Alternatives considered**:
- Building custom web UI (explicitly out of scope — user requirement)
- Linear/Jira integration (not self-hosted, not OSS)
- Taiga (OSS but less active, weaker API)

## R7: OpenTelemetry Integration

**Decision**: opentelemetry-rust (traces + metrics) + opentelemetry-python, OTLP export
**Rationale**: OpenTelemetry is the CNCF standard. Rust SDK supports traces and metrics with OTLP exporter. Python SDK identical. Both export to any OTel-compatible backend (Jaeger, Grafana, Datadog). Traces span command execution; metrics track durations, agent runs, review cycles.
**Alternatives considered**:
- Prometheus only (metrics but no traces)
- Custom metrics in SQLite only (no external dashboard integration)

## R8: Credential Encryption

**Decision**: OS keychain integration (macOS Keychain, Linux secret-service) via `keyring` crate
**Rationale**: Avoids storing secrets in plaintext files. The `keyring` crate provides cross-platform credential storage using OS-native secure storage. Falls back to encrypted file with user-provided passphrase on systems without keychain support.
**Alternatives considered**:
- age encryption (simpler but requires manual key management)
- .env files (insecure, explicitly rejected)
- SOPS (overkill for local single-user credentials)

## R9: BDD Framework Selection

**Decision**: cucumber-rs (Rust) + behave (Python) with shared .feature files
**Rationale**: Cucumber/Gherkin is the standard BDD language. cucumber-rs integrates with cargo test. behave is the Python equivalent. Both can parse the same `.feature` files, enabling shared acceptance test definitions that map directly to spec FRs. Pact for contract tests at gRPC boundaries ensures Rust↔Python protocol compliance.
**Alternatives considered**:
- Just unit + integration tests (insufficient for FR-to-evidence tracing requirement)
- Playwright/Selenium (no web UI to test in core; only relevant for Plane.so integration later)
