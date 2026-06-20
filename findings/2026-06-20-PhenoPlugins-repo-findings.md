# PhenoPlugins — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `PhenoPlugins/` (unified plugin system for the Phenotype ecosystem)
**Status:** MAINTENANCE — AI-DD metaproject, ~50% progress

---

## 1. Overview

PhenoPlugins is the **unified plugin system and extension architecture** for the Phenotype ecosystem. It provides trait-based plugin interfaces, a dynamic thread-safe registry, lifecycle management, and built-in adapters for Git VCS, SQLite storage, and container/vessel abstractions. It was consolidated from AgilePlus-specific plugin crates into a standalone workspace.

**Core Mission:** Enable plug-and-play extensibility across the Phenotype platform without coupling application logic to specific implementations.

## 2. Repository Structure

```
PhenoPlugins/
├── crates/
│   ├── pheno-plugin-core/          # Core trait & registry (~795 lines registry.rs, 582 lines traits.rs, 299 lines error.rs, 56 lines lib.rs)
│   │   └── src/
│   │       ├── lib.rs              # Crate root — re-exports PluginError, PluginRegistry, traits
│   │       ├── error.rs            # PluginError enum (10 variants) + PluginResult<T>
│   │       ├── registry.rs         # PluginRegistry (thread-safe via RwLock<HashMap>)
│   │       └── traits.rs           # AdapterPlugin, VcsPlugin, StoragePlugin traits
│   ├── pheno-plugin-git/           # Git VCS adapter (~44KB lib.rs)
│   │   └── src/
│   │       └── lib.rs              # Git implementation of VcsPlugin (gitoxide-backed)
│   ├── pheno-plugin-sqlite/        # SQLite storage adapter (~58KB lib.rs + 16KB error.rs)
│   │   └── src/
│   │       ├── lib.rs              # SQLite implementation of StoragePlugin (rusqlite-backed)
│   │       └── error.rs            # SQLite-specific error types
│   └── pheno-plugin-vessel/        # Container/storage abstraction (~160KB total across 6 files)
│       └── src/
│           ├── lib.rs              # Vessel library root (Docker/Podman/containerd abstraction)
│           ├── client.rs           # ContainerClient (~31KB)
│           ├── compose.rs          # Docker Compose support (~35KB)
│           ├── container.rs        # Container lifecycle (~25KB)
│           ├── image.rs            # Image management (~14KB)
│           └── runtime.rs          # Runtime abstraction (~33KB)
├── docs/
├── tests/
├── ports/                          # Port definitions
├── Cargo.toml                      # Workspace manifest (4 members, resolver 2)
├── Cargo.lock                      # 24,236 lines
├── README.md                       # Comprehensive overview (~268 lines)
├── CHANGELOG.md
├── CLAUDE.md / AGENTS.md           # Governance & agent contract
├── SPEC.md                         # Specification
├── PLAN.md                         # Implementation plan
└── LICENSE                         # MIT
```

## 3. Core Architecture

### 3.1 Design Pattern

Hexagonal Architecture with trait-based plugin abstraction:

```
Application Host (AgilePlus, etc.)
        ↓
┌─────────────────────────────────┐
│   pheno-plugin-core (Traits)    │
│  • AdapterPlugin (base trait)   │
│  • VcsPlugin (git operations)   │
│  • StoragePlugin (db ops)       │
│  • PluginRegistry (thread-safe) │
└─────────────────────────────────┘
        ↓       ↓           ↓
    [Git]   [SQLite]   [Vessel]
    (gitox) (rusqlite) (Docker/Podman)
```

### 3.2 PluginRegistry (`registry.rs`)

Thread-safe registry using `RwLock<HashMap<String, Arc<dyn Plugin>>>`:

```rust
pub struct PluginRegistry {
    vcs: RwLock<HashMap<String, Arc<dyn VcsPlugin>>>,
    storage: RwLock<HashMap<String, Arc<dyn StoragePlugin>>>,
    initialized: RwLock<bool>,
}
```

Key behaviors:
- **Finalization lock**: After `finalize()` is called, no new plugins can be registered
- **Duplicate prevention**: Returns `PluginError::AlreadyRegistered` on duplicate names
- **Poison safety**: All lock accesses handle poisoned mutexes
- **O(1) lookup**: HashMap-based with Arc for shared ownership
- Two plugin categories: VCS (git) and Storage (persistence)

### 3.3 Plugin Traits (`traits.rs`)

**AdapterPlugin** — Base trait for all plugins:
```rust
pub trait AdapterPlugin: Send + Sync {
    fn name(&self) -> &str;
    fn version(&self) -> &str;
    fn initialize(&self, config: PluginConfig) -> PluginResult<()>;
    fn health_check(&self) -> PluginResult<()>;
}
```

**VcsPlugin** — Version control operations (async via `#[async_trait]`):
- Worktree: `create_worktree()`, `list_worktrees()`, `cleanup_worktree()`
- Branch: `create_branch()`, `checkout_branch()`
- Merge: `merge_to_target()`, `detect_conflicts()`
- Artifacts: `read_artifact()`, `write_artifact()`, `artifact_exists()`, `scan_feature_artifacts()`
- Domain types: `WorktreeInfo`, `MergeResult`, `ConflictInfo`, `FeatureArtifacts`

**StoragePlugin** — Database operations (async via `#[async_trait]`):
- Feature CRUD: `create_feature()`, `get_feature_by_slug/id()`, `update_feature_state()`, `list_all_features()`
- Work package CRUD: `create_work_package()`, `get_work_package()`, `update_wp_state()`
- Audit: `append_audit_entry()`, `get_audit_trail()`

### 3.4 Error Handling (`error.rs`)

```rust
pub enum PluginError {
    Initialization(String),    NotFound(String),
    AlreadyRegistered(String), AlreadyExists(String),
    Operation(String),         Config(String),
    Io(#[from] std::io::Error), Serialization(#[from] serde_json::Error),
    Execution(String),         Validation(String),
}
```

- `PluginResult<T>` = `Result<T, PluginError>`
- Uses `thiserror` for Display and Error derives
- `#[from]` conversions for `std::io::Error` and `serde_json::Error`

### 3.5 pheno-plugin-vessel — Container Runtime Abstraction

Multi-runtime support via unified async client:

| Module | Purpose |
|--------|---------|
| `DockerRuntime` | Docker daemon connector |
| `PodmanRuntime` | Podman daemon connector |
| `ContainerClient` | Unified async client |
| `Image` / `ImagePullProgress` | Image management |
| `Container` / `ContainerConfig` / `ContainerStatus` | Container lifecycle |
| `ComposeFile` / `ComposeService` | Docker Compose orchestration |

Error type (`VesselError`): Container / ImagePullFailed / Runtime / Network / Io variants.

## 4. Cargo Dependencies

| Crate | Key Dependencies |
|-------|-----------------|
| `pheno-plugin-core` | tokio, async-trait, serde, serde_json, thiserror |
| `pheno-plugin-git` | git2/gitoxide, pheno-plugin-core |
| `pheno-plugin-sqlite` | rusqlite, pheno-plugin-core |
| `pheno-plugin-vessel` | tokio, bollard, podman-api, serde, thiserror |

## 5. Migration History

Consolidated from AgilePlus-specific crates:
- `agileplus-plugin-core` → `pheno-plugin-core`
- `agileplus-plugin-git` → `pheno-plugin-git`
- `agileplus-plugin-sqlite` → `pheno-plugin-sqlite`
- `phenoVessel` → `pheno-plugin-vessel`

This follows the standard Phenotype absorption pattern: extract from monolith, promote to standalone workspace, archive original.

## 6. Test Coverage

### pheno-plugin-core

| Module | Test Count | Coverage Focus |
|--------|-----------|----------------|
| `error.rs` | 14 tests | Display/Debug for all 10 variants, `#[from]` conversions, source chains, Send+Sync, uniqueness across variants |
| `traits.rs` | 14 tests | PluginConfig construction/serde roundtrip/defaults, WorktreeInfo/MergeResult/FeatureArtifacts construction/display/clone/field accessors |
| `registry.rs` | ~8 tests | Registration, lookup, duplicate prevention, finalization lock, concurrent access |

### pheno-plugin-vessel

| Module | Test Count | Coverage Focus |
|--------|-----------|----------------|
| `lib.rs` | ~10+ tests | DockerRuntime creation, VesselError display/debug, error variant distinctness |

### Test Style

- All tests are inline `#[cfg(test)] mod tests { ... }` in source files
- Tests tagged with FR traceability where applicable
- Comprehensive edge-case coverage including empty/enum/error roundtrips

## 7. Key Observations

1. **Clean hexagonal design**: The `AdapterPlugin` base + specialized `VcsPlugin`/`StoragePlugin` traits follow Interface Segregation — consumers only depend on what they need.

2. **Thread-safe by design**: All registry operations use `RwLock` for interior mutability, plugins must be `Send + Sync`. The finalization pattern prevents runtime race conditions.

3. **Disproportionate crate sizes**: Vessel dominates the workspace (~160KB across 6 files). Git plugin is 44KB, SQLite 75KB. Core is modest at ~1,700 lines.

4. **Mixed responsibility levels in VcsPlugin**: The trait includes both low-level operations (worktree, branch) and higher-level feature-artifact operations — consider splitting into `VcsCore` and `VcsArtifact` sub-traits.

5. **Untyped plugin config**: `PluginConfig.adapter_config` is `serde_json::Value` — type checking deferred to runtime. A generic or trait-based approach would provide compile-time safety.

6. **No WASM runtime**: Despite references in platform documentation, there's no WASM/WebAssembly plugin target integration in this workspace.

7. **No inter-plugin communication**: No event bus or messaging layer exists for plugins to coordinate. Each plugin is isolated to its own interface.

8. **Single-file implementations**: The git and SQLite crates have monolithic `lib.rs` files with no modularization — at 44KB+ each, this is a maintenance risk.

## 8. Recommendations

1. **Split large crate files**: The SQLite adapter's `lib.rs` at 58KB is a maintenance risk. Modularize into sub-modules (feature ops, WP ops, audit ops).

2. **Add typed plugin config**: Replace `serde_json::Value` with a generic or trait-based approach so plugins define their own config schema at compile time.

3. **Consider plugin hot-reload**: The finalization pattern prevents dynamic loading. For long-running hosts, add a `reload()` method that atomically swaps plugin instances.

4. **Document WASM roadmap**: If WASM plugins are planned, add a tracking crate or RFC. Current `Arc<dyn Plugin>` requires native compilation.

5. **Add inter-plugin event bus**: Consider an event bus for plugin coordination — especially relevant for the vessel crate's multi-container orchestration use case.

6. **Add `PluginConfig` validation**: Currently the config struct accepts any JSON. Add a `validate()` method or builder pattern with required fields.
