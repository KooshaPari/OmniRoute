# Settly — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `Settly/` (standalone — now **DEPRECATED**)
**Status:** ARCHIVED — absorbed into Configra as `crates/settly/`

---

## 1. Overview

Settly was a **universal configuration management framework** for Rust, following hexagonal architecture principles. It provided layered configs, validation, environment support, and idempotent submission services. The repo was **archived on 2026-06-20** after its source code was copied verbatim into the Configra workspace at `crates/settly/`.

## 2. Repository Structure

```
Settly/
├── src/
│   ├── lib.rs                      # Crate root + re-exports
│   ├── domain/                     # Pure business logic (hexagonal core)
│   │   ├── mod.rs                  # Module declarations
│   │   ├── config.rs               # ConfigPath, ConfigValue, Config (~309 lines)
│   │   ├── layers.rs               # LayerPriority, Layer, LayerStack, MergeStrategy (~187 lines)
│   │   ├── settings.rs             # SettlySettings (framework-level config, ~130 lines)
│   │   ├── sources.rs              # Source trait, WatchableSource, NullSource (~43 lines)
│   │   ├── validation.rs           # Validator trait + implementations (~235 lines)
│   │   ├── ports.rs                # LoaderPort, WatcherPort (hexagonal ports, ~19 lines)
│   │   ├── errors.rs               # ConfigError enum (7 variants, ~42 lines)
│   │   └── idempotency.rs          # IdempotencyKey, SubmissionResult, DeadLetterEntry (~115 lines)
│   ├── application/                # Use cases
│   │   ├── mod.rs
│   │   ├── builder.rs              # ConfigBuilder (~113 lines)
│   │   ├── submission.rs           # SubmissionService (idempotency + retry + DLQ, ~121 lines)
│   │   └── submission_tests.rs     # Tests for submission service
│   ├── adapters/                   # I/O adapters
│   │   ├── mod.rs
│   │   ├── sources.rs              # FileSource, EnvSource, CliSource
│   │   ├── formats.rs              # TomlFormat, YamlFormat, JsonFormat (flatten parsers)
│   │   └── idempotency.rs          # InMemoryIdempotencyStore, InMemoryDlq
│   └── infrastructure/             # Cross-cutting
│       ├── mod.rs
│       └── error.rs                # ConfigKitError
├── benches/
│   └── perf.rs                     # Benchmarks (criterion)
├── docs/
├── config/                         # Example config files (TOML, YAML, JSON)
├── fuzz/                           # Fuzz testing targets
├── Cargo.toml                      # Package manifest
├── README.md                       # Project overview
├── SPEC.md                         # Specification
├── PRD.md                          # Product requirements
├── CONFIG.md                       # Framework configuration docs
├── FUNCTIONAL_REQUIREMENTS.md      # Traceable FRs
├── STANDARDS.md                    # Development standards
├── QA_MATRIX.md                    # Quality assurance matrix
├── TEST_COVERAGE_MATRIX.md         # Test coverage tracking
├── VERIFICATION_POLICY.md          # Verification policies
├── DEPRECATED.md                   # Deprecation notice
├── CHANGELOG.md
├── PLAN.md
├── ADR.md
├── AGENTS.md
├── CLAUDE.md
└── Taskfile.yml                    # Build/test/lint automation
```

## 3. Architecture — Hexagonal (Ports & Adapters)

```
┌──────────────────────────────────────────────────┐
│                   Application                     │
│  ┌────────────────┐  ┌────────────────────────┐  │
│  │  ConfigBuilder  │  │  SubmissionService     │  │
│  │  (builder.rs)  │  │  (submission.rs)       │  │
│  └────────┬───────┘  └───────────┬────────────┘  │
└───────────┼──────────────────────┼────────────────┘
            │ uses                 │ uses
            ▼                      ▼
┌──────────────────────────────────────────────────┐
│                    Domain                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌──────┐ ┌───────┐  │
│  │Config│ │Layer │ │Valid │ │Source│ │Idempo │  │
│  │      │ │Stack │ │      │ │  T   │ │tency  │  │
│  └──┬───┘ └──────┘ └──┬───┘ └──┬───┘ └───┬───┘  │
└─────┼─────────────────┼────────┼──────────┼──────┘
      │                 │        │          │
      ▼                 ▼        ▼          ▼
┌──────────────────────────────────────────────────┐
│                  Adapters                         │
│  ┌──────┐ ┌──────┐ ┌──────┐ ┌────────────────┐  │
│  │File  │ │Env   │ │Cli   │ │InMemoryIdempo  │  │
│  │Source│ │Source│ │Source│ │tencyStore/DLQ  │  │
│  └──────┘ └──────┘ └──────┘ └────────────────┘  │
└──────────────────────────────────────────────────┘
```

## 4. Key Features

| Feature | Status | Location |
|---------|--------|----------|
| Layered configuration with merge strategies | ✅ Done | `src/domain/layers.rs` |
| Multiple file format support (TOML, YAML, JSON) | ✅ Done | `src/adapters/formats.rs` |
| Environment variable interpolation | ✅ Done | `src/adapters/sources.rs` |
| CLI argument overrides | ✅ Done | `src/adapters/sources.rs` |
| Schema-based validation | ✅ Done | `src/domain/validation.rs` |
| Hot reload support | ✅ Done | `src/domain/sources.rs` (WatchableSource trait) |
| Type-safe configuration access | ✅ Done | `src/domain/config.rs` |
| Idempotent submission with retry + DLQ | ✅ Done | `src/application/submission.rs` |
| Secret management integration | ❌ Not done | — |
| Remote configuration support | ❌ Not done | — |
| Configuration versioning | ❌ Not done | — |

## 5. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| tokio | 1 (full) | Async runtime |
| async-trait | 0.1 | Async trait support |
| serde | 1.0 (derive) | Serialization |
| serde_json | 1.0 | JSON parsing |
| serde_yaml | 0.9 | YAML parsing |
| toml | 0.8 | TOML parsing |
| thiserror | 1.0 | Error derivation |
| anyhow | 1.0 | Flexible error handling |
| uuid | 1 (v4, serde) | ID generation |
| chrono | 0.4 (serde) | Timestamps |
| validator | 0.20 (derive) | Schema validation |
| tokio-postgres | 0.7 | PostgreSQL adapter |
| sqlx | 0.7 (postgres) | SQL toolkit |
| redis | 1.2 | Redis cache adapter |
| tracing | 0.1 | Logging/diagnostics |

## 6. Layer Priority System

| Priority | Layer Name | Value | Source |
|----------|-----------|-------|--------|
| Lowest | Default | 10 | Built-in defaults |
| | Env | 30 | Environment-specific files |
| | Home | 40 | User home directory configs |
| | Local | 50 | Project/local configs |
| | EnvVars | 60 | Environment variables |
| Highest | Cli | 100 | CLI arguments |

## 7. Merge Strategies

- **Override** (default): Higher priority overrides lower priority
- **Underride**: Lower priority overrides higher priority
- **DeepMerge**: Deep-merge objects, override primitives
- **AppendArrays**: Append arrays from all layers

## 8. Functional Requirements (from `FUNCTIONAL_REQUIREMENTS.md`)

| FR ID | Description | Status | Code Location |
|-------|-------------|--------|---------------|
| FR-CFG-001 | Load config from TOML, YAML, JSON | ✅ | `src/adapters/formats.rs` |
| FR-CFG-002 | Read env vars with SETTLY_ prefix | ✅ | `src/adapters/sources.rs` |
| FR-CFG-003 | Accept CLI args with highest priority | ✅ | `src/adapters/sources.rs` |
| FR-LAYER-001 | Define layer priority (default < file < env < CLI) | ✅ | `src/domain/layers.rs` |
| FR-LAYER-002 | Deep merge layered configs | ✅ | `src/domain/layers.rs` |
| FR-LAYER-003 | Detect and report conflicting values | ✅ | `src/application/builder.rs` |
| FR-VAL-001 | Validate configs against JSON Schema | ✅ | `src/domain/validation.rs` |
| FR-VAL-002 | Support custom validator functions | ✅ | `src/domain/validation.rs` |
| FR-VAL-003 | Detailed error messages with field paths | ✅ | `src/infrastructure/error.rs` |
| FR-INT-001 | Serde Serialize/Deserialize for all config types | ✅ | `src/domain/` |
| FR-INT-002 | Type-safe getters for config values | ✅ | `src/domain/config.rs` |
| FR-INT-003 | Watch config files and reload on change | ✅ | `src/domain/sources.rs` |

## 9. Idempotency Submission Service

The `SubmissionService` is a notable feature that goes beyond config management:

1. **Cache check**: If an idempotency key exists and hasn't expired, return cached result
2. **Execute with retries**: Call the executor function up to `max_retries` times
3. **DLQ fallback**: On exhausted retries, push a `DeadLetterEntry` to the dead-letter queue

This is a production-grade pattern for ensuring exactly-once execution guarantees.

## 10. Deprecation Status

Per `DEPRECATED.md`:
- **2026-06-18**: Source code copied verbatim into Configra workspace
- **2026-06-20**: Standalone repo archived
- **Migration path**: Depend on Configra's `crates/settly/` instead
- **Snapshot preserved**: In `Configra/ABSORBED-FROM/Settly/`

## 11. Code Quality Metrics

| Metric | Score |
|--------|-------|
| Source files | ~21 `.rs` files |
| Total LOC (source) | ~1,500+ lines of Rust |
| Test files | `submission_tests.rs` + inline tests |
| Benchmark files | `benches/perf.rs` |
| Fuzz targets | `fuzz/` directory present |
| Config examples | TOML/YAML/JSON in `config/` |
| Documentation | README, SPEC, PRD, CONFIG, STANDARDS, QA_MATRIX, FRs |

## 12. Key Observations

1. **Well-structured hexagonal architecture**: Clear domain/application/adapter/infrastructure separation — a model implementation of the ports-and-adapters pattern in Rust.
2. **Production-grade idempotency**: The SubmissionService with its retry/DLQ pattern indicates this was more than a toy project — it was designed for real distributed systems use.
3. **Heavy dependency footprint**: SQLx, tokio-postgres, Redis — the persistence adapters suggest intended use in serious server-side applications, not just local config files.
4. **Comprehensive documentation**: Multiple spec/standard/requirement files, QA matrix, test coverage matrix, verification policy — very thorough for a pre-1.0 crate.
5. **No `Cargo.lock` in standalone**: The standalone Settly repo doesn't have a Cargo.lock (it's gitignored), but the absorbed version in Configra does.
6. **Code duplication note**: The domain modules (`config.rs`, `layers.rs`, `validation.rs`, `sources.rs`, `ports.rs`, `errors.rs`) are identical copies between the standalone Settly repo and Configra's `crates/settly/` — by design as absorption was a verbatim copy.

## 13. Recommendations (Historical — repo is archived)

1. **Consolidate duplicate code**: The `ConfigPath`, `ConfigValue`, `Config` types exist in both `config-schema` and `settly` — these should be unified now that they're in the same workspace.
2. **Remove unused dependencies**: `tokio-postgres` and `sqlx` are declared but not actually used in the standalone source — these may have been forward-looking additions.
3. **Fill in unimplemented features**: Secret management, remote config, and versioning were planned but never built.
4. **Re-evaluate MergeStrategy::AppendArrays**: Its current implementation is identical to MergeStrategy::Override, which means it doesn't actually append arrays.
