# Configra — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `Configra/` (canonical Rust configuration substrate)
**Status:** ACTIVE — AI-DD metaproject (pre-1.0)

---

## 1. Overview

Configra is the **canonical Rust configuration substrate** for the Phenotype organization. It provides local-first configuration management, feature flags, secrets, and version tracking with auditable change history and CLI-first workflows. The repository is planned, maintained, and managed exclusively by AI Agents as part of the AI-DD metaproject.

## 2. Repository Structure

```
Configra/
├── crates/
│   ├── config-schema/          # Schema validation layer (~214 lines, pure validation)
│   ├── configra-config/        # Meta-configuration for Configra itself (~627 lines)
│   ├── pheno-config/           # Canonical typed-config loader (~647 lines, env/file/builder)
│   └── settly/                 # Legacy config crate (absorbed, hexagonal design, ~full framework)
├── docs/
│   ├── ARCHITECTURE.md         # System design
│   ├── CONFIG.md               # Framework configuration reference
│   ├── migrations/             # Migration records from absorbed repos
│   └── phenotype-config-absorbed/ # Original source artifacts
├── ABSORBED-FROM/              # Absorbed repository snapshots
├── AGENTS.md                   # Agent instructions
├── SPEC.md                     # Specification
├── Cargo.toml                  # Workspace manifest (resolver 2)
├── Cargo.lock                  # 2,986 lines
├── README.md                   # Project overview
└── CHANGELOG.md
```

## 3. Crates in Detail

### 3.1 `pheno-config` — Canonical Typed-Config Loader

**Path:** `crates/pheno-config/src/lib.rs`
**Lines:** 647
**Purpose:** Single source of truth for runtime configuration across the `pheno-*` fleet.

Three loading strategies:
1. **`load_from_env(prefix)`** — Reads `<PREFIX>_*` environment variables. Required fields (`URL`, `DB_PATH`) yield `ConfigError::MissingField` when unset.
2. **`load_from_file(path)`** — Reads JSON files via `serde_json`, with TOML support via `load_from_toml_file()`.
3. **`ConfigBuilder`** — Programmatic construction with sensible defaults (port=8080, log_level="info").

Key design:
- `Config` struct derives `Serialize`/`Deserialize` for env/file/builder round-trips
- `Config::merge()` implements deep-merge (scalar overwrite + list concatenation dedup)
- `combine(file, prefix)` implements 12-factor pattern: file fills gaps, env vars override
- `ConfigError` is a closed 3-variant enum (MissingField, ParseError, IoError)
- Sensible defaults sourced from `configra_config::ConfigraConfig`
- Tests at `tests/config_test.rs`, `tests/tracing_test.rs`, `tests/toml_merge_test.rs`
- Examples at `examples/cascade.rs`, `examples/quickstart.rs`, `examples/validation.rs`

### 3.2 `config-schema` — Schema Validation Layer

**Path:** `crates/config-schema/src/lib.rs`
**Lines:** 214
**Purpose:** Pure schema validation for JSON Value configurations.

- `ConfigSchema` with builder pattern (`field()`, `validate()`)
- `SchemaField` struct with name, required flag, type_hint
- `SchemaError` enum (MissingField, WrongType)
- Type checking for: string, integer, boolean, number, array, object
- 7 unit tests covering required/optional fields, type validation, non-object input
- **Observation:** Uses its own minimal validation rather than JSON Schema standard — this is intentional per the spec to keep dependency surface tiny

### 3.3 `configra-config` — Meta-Configuration

**Path:** `crates/configra-config/src/lib.rs`
**Lines:** 627
**Purpose:** Extract hardcoded defaults from across the workspace into a single documented struct.

Sub-configs:
- `ServiceConfig` — default_port (8080), default_log_level ("info"), db_path_template
- `IdempotencyConfig` — default_ttl_secs (86400), default_max_retries (3)
- `WatcherConfig` — poll_interval_ms (1000), enabled (true)

Loading paths:
1. `ConfigraConfig::default()` — documented defaults
2. `ConfigraConfig::from_env()` — `CONFIGRA_*` env vars
3. `ConfigraConfig::from_file()` — TOML or JSON (partial files via `#[serde(default)]`)
4. `ConfigraConfigBuilder` — programmatic builder

All values match previously hardcoded originals documented in comments with line references. 7 unit tests for default matching, builder overrides, partial builder, JSON round-trip, TOML partial load, env override, and extension rejection.

### 3.4 `settly` — Absorbed Legacy Config Framework (within Configra)

**Path:** `crates/settly/`
**Purpose:** Absorbed from standalone `Settly` repo into Configra workspace member.

#### Architecture (Hexagonal):

- **Domain** (`domain/`): Pure business logic
  - `config.rs` — `ConfigPath`, `ConfigValue` (6-variant enum), `Config` entity with `merge()`
  - `layers.rs` — `LayerPriority` (Default=10 → Env=30 → Home=40 → Local=50 → EnvVars=60 → Cli=100), `Layer`, `LayerStack`, `MergeStrategy`
  - `validation.rs` — `Validator` trait, `RequiredKeys`, `TypeValidator`, `RangeValidator`, `CompositeValidator`
  - `sources.rs` — `Source` trait, `WatchableSource` trait, `NullSource`
  - `ports.rs` — `LoaderPort`, `WatcherPort` (hexagonal port definitions)
  - `errors.rs` — `ConfigError` (7 variants: KeyNotFound, TypeMismatch, ValidationFailed, ParseError, IoError, SerializationError, SourceNotAvailable)
  - `idempotency.rs` — `IdempotencyKey`, `SubmissionResult`, `DeadLetterEntry`, `CacheEntry`, `IdempotencyStore` trait, `DeadLetterQueue` trait

- **Application** (`application/`): Use cases
  - `builder.rs` — `ConfigBuilder` with source/layer/validator chaining
  - `submission.rs` — `SubmissionService` with idempotency-token deduplication (cache → execute with retries → DLQ fallback)

- **Adapters** (`adapters/`): I/O
  - `sources.rs` — `FileSource` (TOML/YAML/JSON), `EnvSource` (prefix-filtered), `CliSource`
  - `formats.rs` — `TomlFormat`, `YamlFormat`, `JsonFormat` (flatten JSON to dot-notation)
  - `idempotency.rs` — `InMemoryIdempotencyStore` (HashMap + Mutex, lazy TTL eviction), `InMemoryDlq`

- **Infrastructure** (`infrastructure/`): Cross-cutting
  - `error.rs` — `ConfigKitError` (Config/Init/Runtime/Shutdown variants)

#### Key Design Patterns:
- Flatten JSON/YAML/TOML nested objects into dot-notation keys (e.g., `database.host`)
- Layer stack sorts by priority, merges with configurable strategy
- Idempotency service with retry + DLQ pattern — port-based so Redis/Postgres can be swapped in

## 4. Dependency Chain

```
configra-config
├── serde, serde_json, toml, thiserror

pheno-config
├── serde, serde_json, toml, thiserror
└── configra-config (for defaults)

config-schema
├── serde_json, thiserror

settly (workspace member)
├── tokio, async-trait, serde, serde_json
├── toml, serde_yaml
├── thiserror, anyhow, uuid, chrono
├── tokio-postgres, sqlx (postgres)
├── redis
├── tracing, tempfile
└── configra-config (for idempotency defaults)
```

## 5. Test Coverage

| Crate | Test Count | Coverage Focus |
|-------|-----------|----------------|
| `config-schema` | 7 | Field validation, type checking, edge cases |
| `configra-config` | 7 | Defaults, builder, file loading, env loading |
| `pheno-config` | 6+ integration | Env loading, file loading, builder, merge |
| `settly` | ~12+ unit | Path, config, layers, validation, idempotency, settings |

## 6. ADR Coverage

- **ADR-022** — Config consolidation (Rust/TS edge split)
- **ADR-031** — Configra is the canonical config substrate
- **ADR-035** — Configra migration gates
- **ADR-036** — Tracing substrate (opt-in)

## 7. Key Observations

1. **Self-hosting pattern**: `configra-config` manages Configra's own configuration, demonstrating dogfooding of the framework being built.
2. **Absorption pattern**: The `settly` standalone repo was absorbed as a workspace member crate (verbatim copy), with the standalone repo archived. This is the recommended pattern within Phenotype org.
3. **12-factor compliance**: `pheno-config::combine()` implements the 12-factor config pattern (file + env overlay), which aligns with cloud-native deployment practices.
4. **Minimal dependency philosophy**: Each crate pulls only what it needs. `config-schema` depends only on `serde_json` and `thiserror`. No async runtime needed for simple validation.
5. **No distributed coordination**: Per SPEC.md, distributed config pushing is explicitly a non-goal. Poll-based refresh only.
6. **CLI not yet implemented**: The README references `phenoctl` CLI and `ratatui` TUI, but no CLI crate exists in the workspace yet. The `crates/pheno-cli/` directory mentioned in README is absent from the filesystem.
7. **TypeScript bindings via Conft**: Referenced in AGENTS.md but not in this repo — exists as a separate `Conft/` repo.

## 8. Recommendations

1. **Create the `pheno-cli` crate** to match the documented CLI surface area (`phenoctl config/flags/secrets/version/tui`).
2. **Add integration tests** for the combine(file, env_prefix) path with real temp files.
3. **Consider publishing** `config-schema` and `configra-config` to crates.io as standalone utility crates.
4. **Fill `CHANGELOG.md`** — currently has minimal content for a workspace with 4 crates.
