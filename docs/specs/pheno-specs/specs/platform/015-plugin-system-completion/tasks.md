# Work Packages: Plugin System Completion — Complete Architecture Across 4 Repositories

**Inputs**: Design documents from `kitty-specs/015-plugin-system-completion/`
**Prerequisites**: spec.md, Rust toolchain, Go toolchain (for thegent-plugin-host)
**Scope**: Cross-repo (4 repositories): agileplus-plugin-core, agileplus-plugin-git, agileplus-plugin-sqlite, thegent-plugin-host

---

## WP-001: agileplus-plugin-core — Define Plugin Interface Traits and Registry

- **State:** planned
- **Sequence:** 1
- **File Scope:** agileplus-plugin-core repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Stable plugin interface contract with versioning guarantees (semver)
  - Plugin lifecycle states defined: unloaded, loading, loaded, starting, running, stopping, stopped, error
  - Plugin registry with discovery, loading, and version compatibility checking
  - Comprehensive rustdoc with plugin development examples
  - ≥80% test coverage on interface and registry
  - All quality checks passing
- **Estimated Effort:** M

Define the stable plugin interface contract that all plugin backends must implement. This includes lifecycle management, versioning guarantees, and a plugin registry for discovery and loading. This is the foundation that WP-002, WP-003, and WP-004 build upon.

### Subtasks
- [ ] T001 Audit existing plugin interfaces in agileplus-plugin-core
- [ ] T002 Design stable plugin interface contract: Plugin trait with lifecycle methods
- [ ] T003 Define plugin lifecycle state machine: unloaded → loading → loaded → running → stopping → stopped
- [ ] T004 Implement versioning system: plugin declares supported API version, registry checks compatibility
- [ ] T005 Implement PluginRegistry: register, discover, load, unload, version compatibility check
- [ ] T006 Define plugin configuration schema: TOML-based config with validation
- [ ] T007 Implement plugin error types with thiserror (PluginError, LoadError, LifecycleError)
- [ ] T008 Write unit tests for lifecycle state machine (target: ≥80% coverage)
- [ ] T009 Write unit tests for registry operations and version compatibility
- [ ] T010 Write integration tests: load mock plugin, verify lifecycle transitions
- [ ] T011 Add comprehensive rustdoc with plugin development guide
- [ ] T012 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- None (starting WP for this spec)

### Risks & Mitigations
- Interface instability: Careful design review, version compatibility checking prevents breaking changes
- Plugin loading security: Sandboxing design documented, signature verification planned for future

---

## WP-002: agileplus-plugin-git — Implement Git VCS Adapter Plugin

- **State:** planned
- **Sequence:** 2
- **File Scope:** agileplus-plugin-git repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Complete git backend implementing all plugin-core interface traits
  - Git operations: clone, fetch, commit, push, branch management, worktree operations
  - Comprehensive error handling for all git operations (network errors, conflicts, auth failures)
  - Integration tests with real git repositories (temp repos)
  - ≥80% test coverage
  - All quality checks passing
- **Estimated Effort:** M

Complete the git VCS adapter plugin that implements the plugin-core interface for git-based storage and version control. This plugin enables AgilePlus to use git repositories as a storage backend for specs, plans, and audit chains.

### Subtasks
- [ ] T013 Audit current agileplus-plugin-git state: existing code, gaps, dependencies
- [ ] T014 Implement Plugin trait for git backend: init, load, save, query operations
- [ ] T015 Implement git clone operation with auth support (SSH keys, HTTPS tokens)
- [ ] T016 Implement git fetch, pull, and push operations with error handling
- [ ] T017 Implement commit operations: create commits with structured messages
- [ ] T018 Implement branch management: create, checkout, merge, detect conflicts
- [ ] T019 Implement worktree operations: create, list, cleanup
- [ ] T020 Add comprehensive error handling: network errors, auth failures, merge conflicts
- [ ] T021 Write unit tests for git operations (target: ≥80% coverage)
- [ ] T022 Write integration tests with real git repositories (temp repos via git2::Repository::init)
- [ ] T023 Add rustdoc with git plugin configuration examples
- [ ] T024 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-001 (plugin-core interface stable)

### Risks & Mitigations
- git2 API complexity: Reference existing git2 usage in codebase, test edge cases thoroughly
- Network operation failures: Implement retry with exponential backoff, configurable timeouts

---

## WP-003: agileplus-plugin-sqlite — Implement SQLite Storage Adapter Plugin

- **State:** planned
- **Sequence:** 3
- **File Scope:** agileplus-plugin-sqlite repository (src/, tests/, docs/)
- **Acceptance Criteria:**
  - Complete SQLite backend implementing all plugin-core interface traits
  - Migration support for schema changes (up/down migrations)
  - SQLite operations: query, transaction, backup, CRUD for all domain types
  - Integration tests with real SQLite databases
  - ≥80% test coverage
  - All quality checks passing
- **Estimated Effort:** M

Complete the SQLite storage adapter plugin that implements the plugin-core interface for SQLite-based persistence. This plugin provides local storage with migration support, enabling AgilePlus to store specs, WPs, and audit data in SQLite databases.

### Subtasks
- [ ] T025 Audit current agileplus-plugin-sqlite state: existing code, gaps, dependencies
- [ ] T026 Implement Plugin trait for SQLite backend: init, load, save, query operations
- [ ] T027 Implement migration system: embedded SQL migrations with up/down support
- [ ] T028 Implement CRUD operations for all domain types: features, WPs, audit entries, evidence
- [ ] T029 Implement transaction support: begin, commit, rollback with proper error handling
- [ ] T030 Implement backup operation: SQLite backup to file with integrity verification
- [ ] T031 Implement query operations: filtered queries, pagination, sorting
- [ ] T032 Write unit tests for SQLite operations (target: ≥80% coverage)
- [ ] T033 Write integration tests with real SQLite databases (temp files)
- [ ] T034 Write migration tests: apply up/down migrations, verify schema changes
- [ ] T035 Add rustdoc with SQLite plugin configuration and migration examples
- [ ] T036 Run quality checks: `cargo test`, `cargo clippy -- -D warnings`, `cargo fmt`

### Dependencies
- WP-001 (plugin-core interface stable)

### Risks & Mitigations
- Migration safety: Test migrations on copy of database, support rollback on failure
- Concurrency: Use WAL mode, document single-writer limitation

---

## WP-004: thegent-plugin-host — Integrate Plugin Host with thegent

- **State:** planned
- **Sequence:** 4
- **File Scope:** thegent-plugin-host repository (src/, tests/, docs/), thegent main repository
- **Acceptance Criteria:**
  - thegent-plugin-host integrated with plugin-core interfaces (Rust/Go FFI boundary)
  - Plugin discovery mechanism: scan plugin directories, load compatible plugins
  - Plugin lifecycle management: load, start, stop, unload with proper error handling
  - Plugin configuration management: load config, validate, apply
  - Integration with thegent: plugins available as thegent subcommands
  - Comprehensive integration testing across all components
  - All quality checks passing
- **Estimated Effort:** L

Integrate thegent-plugin-host with the plugin-core interfaces, enabling thegent to discover, load, and manage plugins. This involves cross-language integration (Rust plugin interfaces with Go plugin host), plugin discovery, lifecycle management, and configuration.

### Subtasks
- [ ] T037 Audit thegent-plugin-host: current prototype state, Go/Rust FFI approach
- [ ] T038 Design Rust/Go FFI boundary: cgo with Rust C ABI, or shared protobuf service
- [ ] T039 Implement plugin discovery: scan configured directories, load plugin manifests
- [ ] T040 Implement plugin loading: load plugin binary/shared library, initialize
- [ ] T041 Implement plugin lifecycle management: start, stop, unload with state tracking
- [ ] T042 Implement plugin configuration management: load, validate, apply config
- [ ] T043 Integrate plugin host with thegent: register plugins as thegent subcommands
- [ ] T044 Implement plugin error handling: graceful degradation when plugins fail
- [ ] T045 Write unit tests for plugin host operations
- [ ] T046 Write integration tests: discover, load, and execute git and SQLite plugins
- [ ] T047 Write cross-language integration tests: Go host calling Rust plugin via FFI
- [ ] T048 Add documentation: plugin host configuration, plugin development guide
- [ ] T049 Run quality checks across all components

### Dependencies
- WP-001 (plugin-core interface stable)
- WP-002 (git plugin available for integration testing)
- WP-003 (SQLite plugin available for integration testing)

### Risks & Mitigations
- Cross-language FFI complexity: Start with simple cgo, benchmark, consider gRPC alternative
- Plugin loading security: Document sandboxing requirements, plan signature verification for future
- Performance overhead: Benchmark plugin loading, optimize hot paths, support lazy loading

---

## Dependency & Execution Summary

```
WP-001 (plugin-core interface) ──────── first, no deps
WP-002 (git plugin) ────────────────── depends on WP-001
WP-003 (SQLite plugin) ─────────────── depends on WP-001 (parallel with WP-002)
WP-004 (thegent plugin host) ───────── depends on WP-001, WP-002, WP-003
```

**Parallelization**: WP-002 and WP-003 can run in parallel (independent plugins). WP-004 requires both plugins for integration testing.

**MVP Scope**: WP-001 + WP-002 provides a working git plugin. WP-003 adds SQLite storage. WP-004 integrates with thegent.
