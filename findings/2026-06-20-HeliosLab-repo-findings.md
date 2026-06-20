# HeliosLab — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `HeliosLab/` (also known as phenotype-config — local-first configuration SDK)
**Status:** STABLE — ~80% progress

---

## 1. Overview

HeliosLab is a **Rust workspace** providing a local-first configuration SDK for the Phenotype organization. It manages app/runtime configuration, feature flag lifecycles, encrypted secrets, and version tracking with auditable change history and CLI-first workflows. The workspace contains 6 core crates unified around the `phenoctl` CLI binary.

**Core Mission:** Provide a consistent way to manage local and team configuration with auditable change history.

## 2. Repository Structure

```
HeliosLab/
├── pheno-core/                     # Pure types, traits, error definitions (~631 lines in lib.rs)
├── pheno-db/                       # SQLite persistence layer (~736 lines in lib.rs)
├── pheno-crypto/                   # AES-256-GCM encryption (~164 lines in lib.rs)
├── pheno-cli/                      # phenoctl binary
│   └── src/
│       ├── main.rs                 # CLI entry (~495 lines)
│       └── tui.rs                  # ratatui TUI (~175 lines)
├── crates/
│   ├── pheno-ffi-python/           # Python FFI bindings (planned)
│   └── pheno-ffi-go/               # Go FFI bindings (planned)
├── src/                            # Workspace root sources
│   ├── config/                     # Configuration templates
│   ├── docs/                       # VitePress documentation
│   ├── hooks/                      # Git hooks
│   ├── i18n/                       # Internationalization
│   ├── main/                       # Main workspace logic
│   ├── pty/                        # PTY handling
│   ├── renderers/                  # Output renderers
│   ├── shared/                     # Shared utilities
│   └── styles/                     # Styling
├── apps/                           # Optional companion apps (under agileplus-specs)
├── docs/                           # VitePress documentation site
├── fuzz/                           # Fuzz testing
├── scripts/                        # Build and CI scripts
├── tests/                          # Integration tests
├── e2e/                            # End-to-end tests
├── Cargo.toml                      # Workspace manifest (resolver 2, 6 members)
├── Cargo.lock                      # 47,409 lines
├── ARCHITECTURE.md                 # System design (~48 lines, skeleton)
├── ADR.md                          # Architecture Decision Records
├── PRD.md                          # Product Requirements
├── SPEC.md                         # Specification
├── SSOT.md                         # Single Source of Truth authority table
├── README.md                       # Project overview (~80 lines)
└── CHANGELOG.md
```

## 3. Core Architecture

### 3.1 Design Pattern

Layered architecture with pure-core design:

```
consumer (CLI / TUI / FFI) → pheno-core types
                          → pheno-db (SQLite WAL)
                          → pheno-crypto (AES-256-GCM)
                          → <repo>/.phenotype/config.db
```

### 3.2 pheno-core — Pure Types & Traits (`pheno-core/src/lib.rs`)

I/O-free crate with no filesystem dependencies. Contains:

**Error types:**
```rust
pub enum Error {
    NotFound(String),
    Database(String),
    Crypto(String),
    InvalidTransition(String),
    Other(String),
}
```

**16 lifecycle stages (ordered from SP → Eol):**
`SP → Poc → IP → A → FP → B → EP → CN → RC → GA → Lts → HF → SS → Dep → AR → Eol`

Key stage methods:
- `is_pre_release()` — true before GA
- `is_production()` — true for GA/Lts/HF
- `allows_flag_gated()` — true up to RC
- `allows_compile_gated()` — true up to B
- `ordinal()` — position in ordered sequence (0-15)
- Implemented: Display, FromStr, PartialOrd (monotonic ordering verified by property test)

**TransienceClass — Feature flag lifecycle classification:**
```rust
pub enum TransienceClass {
    F, // Flag-gatable: runtime toggle, removed at GA
    C, // Compile-gatable: compile-time toggle, removed at beta exit
    X, // Channel-exclusive: only in specific build channels
}
```

**Domain types:**
| Type | Fields | Purpose |
|------|--------|---------|
| `ConfigEntry` | key, value, value_type, namespace, updated_at/by | Config key-value |
| `FeatureFlag` | name, enabled, namespace, description, stage, transience_class, channel, retire_at_stage | Feature toggle |
| `SecretEntry` | key, encrypted_value, nonce, updated_at | Encrypted secret |
| `VersionInfo` | repo, our_version, upstream_version, synced_at | Version tracking |
| `AuditRecord` | id, key, namespace, old/new_value, changed_by/at | Change history |
| `StageTransition` | id, flag_name, from/to_stage, transitioned_at/by | Stage change log |

**Store traits (all implemented by pheno-db):**
- `ConfigStore` — get/set/list/delete/audit/restore config entries
- `FlagStore` — get/list/set/delete/promote/audit feature flags
- `SecretStore` — get/set/list/delete secrets
- `VersionStore` — get/set/list version info

**Build info:**
- Compile-time constants: `HELIOS_STAGE`, `HELIOS_CHANNEL`, `HELIOS_BUILD_FLAGS`
- Set via environment variables at build time

### 3.3 pheno-db — SQLite Persistence (`pheno-db/src/lib.rs`)

- SQLite with WAL mode (`PRAGMA journal_mode=WAL`)
- Auto-migration: 6 tables created on first open
  - `config_entries` — namespace-key-value store with types
  - `config_audit` — change history for config entries
  - `feature_flags` — flag state with stage/class/channel metadata
  - `stage_transitions` — promotion history log
  - `secrets` — encrypted blob store
  - `version_info` — version tracking per repo
- Schema migration support: `ALTER TABLE IF NOT EXISTS` for forward-compatible column additions
- In-memory mode: `Database::open(Path::new(":memory:"))` for testing
- Auto-creates parent directories on open

### 3.4 pheno-crypto — Encryption (`pheno-crypto/src/lib.rs`)

- **Algorithm:** AES-256-GCM (authenticated encryption)
- Key management: 32-byte key from `PHENO_SECRET_KEY` env var (hex-encoded)
- Functions:
  - `generate_key()` — 32 random bytes via OsRng
  - `load_key_from_env()` — reads `PHENO_SECRET_KEY` env var, hex-decodes
  - `encrypt(plaintext, key) → (ciphertext, nonce)` — random nonce per encryption
  - `decrypt(ciphertext, nonce, key) → plaintext` — authenticated decryption
- Security properties:
  - Tampered ciphertext → decryption failure
  - Wrong key → decryption failure
  - Wrong nonce → decryption failure
  - Different ciphertext each encryption (randomized nonce)

### 3.5 pheno-cli — CLI + TUI (`pheno-cli/src/main.rs` + `tui.rs`)

**CLI Commands (clap-derived):**

| Command | Subcommands | Purpose |
|---------|------------|---------|
| `flags` | list, enable, disable, create, audit | Feature flag management |
| `config` | get, set, list, audit, restore | Config entry management |
| `secrets` | set, get, list, delete | Encrypted secret management |
| `version` | show, bump, sync | Version tracking |
| `stage` | show | Build stage info |
| `promote` | `<name> <stage>` | Promote flag to new stage |
| `status` | — | Overview of all stores |
| `tui` | — | Interactive terminal UI |

Uses `clap-ext` for `Verbosity`, `ConfigArg` flattening — consistent with other Phenotype CLIs.

**TUI (ratatui):**
- 4 tabs: Config, Flags, Secrets, Versions
- Interactive browsing with keyboard navigation
- Terminal raw-mode + alternate screen via crossterm

### 3.6 Data Flow

```
cli input → main.rs dispatch → pheno-db::{ConfigStore, FlagStore, SecretStore, VersionStore}
                              → pheno-crypto::{encrypt, decrypt}
                              → SQLite file
                              → audit trail recorded automatically
```

## 4. Workspace Dependencies

| Package | Key Dependencies |
|---------|-----------------|
| `pheno-core` | chrono, serde, serde_json, thiserror |
| `pheno-db` | rusqlite (bundled), chrono, pheno-core |
| `pheno-crypto` | aes-gcm, rand, hex, pheno-core |
| `pheno-cli` | clap, clap-ext, ratatui, crossterm, rpassword, pheno-core, pheno-db, pheno-crypto |

## 5. Test Coverage

### pheno-core (22 tests)

| Test Group | Count | Coverage Focus |
|-----------|-------|----------------|
| Stage tests | 12 tests | Ordinal ordering, 16 entries, pre-release/production detection, flag/compile-gate permissions, display/parse, ordering, monotonicity |
| ValueType tests | 5 tests | Display/parse for 5 types, invalid input |
| TransienceClass tests | 8 tests | Display/parse, valid-at-stage for F/C/X across all stages |
| Error tests | 5 tests | Display for all 5 variants |
| Build info test | 1 test | Default values |
| Property tests | 3 tests | Roundtrip for Stage/ValueType/TransienceClass via proptest (64 cases each) |

### pheno-db (13 tests)

| Test Group | Count | Coverage Focus |
|-----------|-------|----------------|
| ConfigStore | 5 tests | Set/get, not-found, update, list by namespace, delete, audit logging |
| FlagStore | 5 tests | Set/get, not-found, list, delete |
| SecretStore | 4 tests | Set/get, list, delete |
| VersionStore | 4 tests | Set/get, list, not-found |

### pheno-crypto (9 tests)

| Test Group | Count | Coverage Focus |
|-----------|-------|----------------|
| Key generation | 2 tests | 32-byte length, uniqueness across calls |
| Encrypt/decrypt | 4 tests | Roundtrip, different ciphertext each time, empty plaintext, wrong-key failure, tampered-ciphertext failure, wrong-nonce failure |
| Env loading | 3 tests | Missing env var, invalid hex, valid hex |

### pheno-cli (2 tests)

| Test Group | Count | Coverage Focus |
|-----------|-------|----------------|
| CLI parsing | 2 tests | clap-ext flatten parsing, default verbosity |

## 6. Key Observations

1. **Pure-core design**: `pheno-core` has zero I/O dependencies — no filesystem, no database, no network. This enables FFI bindings (Python, Go) to depend on it without pulling in SQLite or crypto stacks.

2. **Comprehensive stage model**: The 16-stage lifecycle (SP→Eol) with ordinal-based comparisons is a sophisticated model for tracking feature maturity. It's more granular than most orgs need but provides clear semantic meaning for gating decisions.

3. **FFI crates are planned but empty**: `pheno-ffi-python` and `pheno-ffi-go` directories exist but have no code. The ARCHITECTURE.md confirms these are planned, not implemented.

4. **CLI is the primary interface**: Unlike Configra (which focuses on the library), HeliosLab's `phenoctl` CLI is the primary surface for interacting with configuration — reflecting its local-first, developer-tool orientation.

5. **clap-ext integration**: Uses `clap-ext` for `Verbosity` and `ConfigArg` flattening — consistent with the fleet-wide CLI standardization effort. This was verified in clap-ext's findings.

6. **Audit trail is automatic**: Every `set_config()` call generates an audit record automatically. This makes the system self-documenting for change history.

7. **Stage promotion is forward-only**: The `promote_flag()` function enforces strictly forward stage transitions (ordinal must increase). This prevents accidental rollbacks but means there's no demotion path — flags can't be moved backward.

8. **Build-time stage injection**: `HELIOS_STAGE`, `HELIOS_CHANNEL` are compile-time constants, not runtime configuration. This makes binary introspection possible but requires rebuilds to change stage.

9. **In-memory DB for testing**: `Database::open(Path::new(":memory:"))` uses SQLite's in-memory mode — excellent for fast unit tests without cleanup.

## 7. Architecture Invariants (from ARCHITECTURE.md)

1. `pheno-core` MUST stay I/O-free so FFI crates and unit tests can depend on it without filesystem setup.
2. FFI crates MUST depend only on `pheno-core` + `pheno-db`, not on `pheno-cli` (clap, ratatui).
3. DB writes go through the `pheno-db` layer; do not bypass it from `pheno-cli` or FFI.
4. Secrets MUST be stored encrypted; never persisted in plaintext.

## 8. Recommendations

1. **Implement FFI crates**: `pheno-ffi-python` and `pheno-ffi-go` are empty stubs. If Python/Go consumers exist, these should be populated with thin wrappers around `pheno-core` + `pheno-db`.

2. **Add flag demotion mechanism**: The forward-only promotion is safe but operational. Consider adding a `demote_flag()` that requires an explicit reason/approval flag for rollbacks.

3. **Increase pheno-cli test coverage**: Only 2 CLI parsing tests exist. Add integration tests for each command path using in-memory databases.

4. **Document the stage model**: The 16-stage lifecycle is rich but undocumented outside code comments. Add a user-facing document explaining when to use each stage and how stage gates work.

5. **Consider runtime stage override**: Build-time stage constants prevent dynamic stage configuration. For CI/CD pipelines, consider allowing `HELIOS_STAGE` env var override at startup.

6. **Add `config_audit` cleanup**: The audit table grows unboundedly with no retention policy. Add TTL-based cleanup or archival.

7. **Fill ARCHITECTURE.md**: Currently a skeleton with 48 lines. Expand with crate-level ownership, data flow diagrams, and cross-cutting concerns as the workspace evolves.
