# clap-ext — Repository Findings

**Date:** 2026-06-20
**Device:** macbook
**Layer:** L5 (substrate-level audit)
**Repo:** `clap-ext/` (shared Rust CLI extension library)
**Status:** ACTIVE — being adopted across 60+ Rust CLIs in Phenotype org

---

## 1. Overview

`clap-ext` is a **shared Rust CLI extension library** for [`clap`](https://docs.rs/clap)-based CLIs. It consolidates the boilerplate that 60+ Rust CLIs in the Phenotype org re-implement on day one: config flags, common subcommands, unified error type, tracing setup, and macros. It is being rolled out in waves starting June 2026 across the Phenotype CLI fleet.

## 2. Repository Structure

```
clap-ext/
├── crates/
│   ├── clap-ext/                    # Main library crate
│   │   ├── src/
│   │   │   ├── lib.rs               # Crate root + prelude + unit tests (~175 lines)
│   │   │   ├── common_args.rs       # ConfigArg, Verbosity, OutputFormat (~63 lines)
│   │   │   ├── common_subcommands.rs # InitCmd, ValidateCmd, VersionCmd (~83 lines)
│   │   │   ├── error.rs             # CliError enum + CliResult alias (~56 lines)
│   │   │   ├── logging.rs           # setup_tracing(), setup_tracing_from_count() (~37 lines)
│   │   │   └── clap_based_cli.rs    # CliPort trait + ClapBasedCli adapter (~488 lines)
│   │   └── tests/
│   │       ├── common_args.rs       # Integration tests for args
│   │       ├── common_subcommands.rs # Integration tests for subcommands
│   │       ├── error.rs             # Integration tests for error type
│   │       └── integration.rs       # General integration tests
│   ├── clap-ext-macros/             # Proc-macro crate
│   │   └── src/
│   │       └── lib.rs               # `#[clap_ext_common_subcommands]` attribute (~30 lines)
│   └── examples/
│       └── basic/
│           └── src/
│               └── main.rs          # Runnable example CLI (~59 lines)
├── docs/
├── Cargo.toml                       # Workspace manifest (resolver 2)
├── Cargo.lock
├── README.md                        # Comprehensive usage guide (~215 lines)
├── CHANGELOG.md                     # Rollout timeline
├── LICENSE / LICENSE-APACHE / LICENSE-MIT
├── CONTRIBUTING.md
├── CODE_OF_CONDUCT.md
└── SECURITY.md
```

## 3. Public API

### 3.1 Prelude (`crate::prelude`)

One-line import for the common case:

```rust
use clap_ext::prelude::*;
```

Re-exports:
- `ConfigArg`, `Verbosity`, `OutputFormat` (common args)
- `InitCmd`, `ValidateCmd`, `VersionCmd` (common subcommands)
- `CliError`, `CliResult` (error types)
- `setup_tracing` (logging setup)
- `ClapBasedCli`, `CliPort`, `GlobalOptions`, `ParsedCli`, `ParsedInvocation` (CLI port abstraction)

### 3.2 Common Args (`common_args.rs`)

| Struct | Flags | Purpose |
|--------|-------|---------|
| `ConfigArg` | `-c, --config <PATH>`, env: `PHENOTYPE_CONFIG` | Config file path |
| `Verbosity` | `-v` (count), `-q` (quiet) | Log verbosity control |
| `OutputFormat` | `--output [human\|json\|yaml]` | Output format selection |

**Verbosity mapping:**

| Flags | LevelFilter |
|-------|------------|
| `--quiet` | `ERROR` |
| (default) | `INFO` |
| `-v` | `DEBUG` |
| `-vv` or more | `TRACE` |

`RUST_LOG` env var is honored when set (overrides the filter).

### 3.3 Common Subcommands (`common_subcommands.rs`)

| Subcommand | Args | Purpose |
|-----------|------|---------|
| `init` | `[path]` (default: `.`), `-f, --force`, `-t, --template` (default: "default") | Scaffold a new project |
| `validate` | `<path>`, `--strict` | Validate a config or project |
| `version` | (none) | Print version + build info |

Two usage patterns:
1. **Derive pattern**: Use `InitCmd`, `ValidateCmd`, `VersionCmd` as enum variants in a `#[derive(Subcommand)]` enum
2. **Builder pattern**: Use `add_common_subcommands(cmd)` on an imperative `clap::Command`

Convenience enum `CommonCommands` bundles all 3 variants.

### 3.4 Error Type (`error.rs`)

```rust
pub enum CliError {
    Io(#[from] std::io::Error),
    Config(String),
    Parse(String),
    Validation(String),
    NotFound(String),
    PermissionDenied(String),
    Network(String),
    Other(#[from] anyhow::Error),
}
```

Features:
- `From<std::io::Error>` via `#[from]`
- `From<anyhow::Error>` via `#[from]`
- `From<&str>` and `From<String>` for quick string errors
- `exit_with(err)` helper function for `process::exit(1)` + error message
- `CliResult<T>` type alias for `Result<T, CliError>`

### 3.5 Logging (`logging.rs`)

```rust
pub fn setup_tracing(filter: LevelFilter);
pub fn setup_tracing_from_count(verbose_count: u8, quiet: bool);
```

Features:
- Honors `RUST_LOG` env var when set
- Uses `EnvFilter` for runtime filtering
- Idempotent — safe to call from tests (swallows `SetGlobalDefaultError`)
- `with_target(false)` for cleaner output

### 3.6 CLI Port Abstraction (`clap_based_cli.rs`)

The `CliPort` trait provides a **hexagonal port** for CLI parsing:

```rust
pub trait CliPort: Send + Sync {
    fn parse(&self, args: &[&str]) -> Result<ParsedInvocation, CliError>;
    fn help(&self) -> String;
    fn version(&self) -> &str;
    fn name(&self) -> &str;
}
```

Domain types:
- `GlobalOptions` — parsed global flags (config, verbose, quiet, output)
- `ParsedCli` — parsed subcommand (Init, Validate, Version, or Other)
- `ParsedInvocation` — complete parsed invocation (globals + command)

`ClapBasedCli` is the canonical `clap`-backed adapter:
- Builder-style construction: `ClapBasedCli::new("name", "about", "version")`
- `with_author()` and `with_subcommand()` for customization
- App-specific subcommands land in `ParsedCli::Other { name, args }`
- Compile-time help text generation via `render_help()`
- Object-safe: works behind `Arc<dyn CliPort>`

### 3.7 Macros (`clap-ext-macros`)

`#[clap_ext_common_subcommands]` — marker attribute for `clap::Subcommand` enums that carry the 3 common subcommands. Currently a documentation passthrough; the user adds variants manually.

## 4. Dependencies

| Dependency | Version | Purpose |
|------------|---------|---------|
| clap | 4.3.x (derive, wrap_help, env, string) | CLI argument parsing |
| anyhow | 1.0 | Flexible error handling |
| thiserror | 2.0 | Error derivation |
| tracing | 0.1 | Logging framework |
| tracing-subscriber | 0.3 (env-filter, json) | Log subscriber |
| syn | 2.0 (full) | Proc-macro parsing |
| quote | 1.0 | Proc-macro token generation |
| proc-macro2 | 1.0 | Proc-macro support |

## 5. Test Coverage

### Unit Tests (in `lib.rs` — 6 tests)

| Test ID | Description |
|---------|-------------|
| `prelude_smoke_test` | FR-001/002/003/005: Each prelude type compiles and constructs |
| `fr001_verbosity_to_filter_quiet_overrides_verbose` | FR-001: Quiet overrides verbose |
| `fr002_common_commands_enum_parses_three_variants` | FR-002: init/validate/version parsing |
| `fr003_question_mark_propagates_io_error_via_from` | FR-003: `?` → CliError::Io |
| `fr004_setup_tracing_idempotent` | FR-004: Double call doesn't panic |
| `fr005_cli_port_parse_init_round_trips_globals` | FR-005: Global flags round-trip |

### Integration Tests (4 test files)

- `tests/common_args.rs` — Args parsing tests
- `tests/common_subcommands.rs` — Subcommand integration tests
- `tests/error.rs` — Error type integration tests
- `tests/integration.rs` — General integration tests

### ClapBasedCli Unit Tests (12 tests)

In `clap_based_cli.rs` — covers init with/without overrides, validate strict/path-required, version, custom subcommands, global flags, quiet/verbose conflict, missing subcommand, help content, metadata accessors, and trait object safety.

## 6. Example Usage

The `examples/basic` workspace member demonstrates full usage:

```rust
use clap::Parser;
use clap_ext::prelude::*;

#[derive(Debug, Parser)]
#[command(name = "basic", version, about = "Example CLI using clap-ext")]
struct Cli {
    #[command(flatten)]
    verbosity: Verbosity,
    #[command(flatten)]
    config: ConfigArg,
    #[arg(long, value_enum, default_value_t)]
    output: OutputFormat,
    #[command(subcommand)]
    cmd: Cmd,
}

fn main() -> CliResult<()> {
    let cli = Cli::parse();
    setup_tracing(cli.verbosity.to_filter());
    // ... dispatch on cli.cmd
    Ok(())
}
```

## 7. Rollout Plan (from README)

First wave (June 2026):
- `kmobile` — `--config`/`--verbose` + `Init` subcommand
- `PhenoVCS` (worktree-manager) — tracing-subscriber setup
- `PhenoProc` — Args struct + subcommand boilerplate
- `Tokn` (tokenledger) — multi-subcommand CLI
- `HeliosCLI` (codex-rs) — Args struct

## 8. Code Quality Metrics

| Metric | Value |
|--------|-------|
| Source files (excluding tests) | 6 `.rs` files |
| Total LOC (source) | ~850 lines of Rust |
| Test files | 5 (1 unit in lib.rs + 4 integration + inline in clap_based_cli.rs) |
| Total tests | ~18+ |
| Example app | 1 (`examples/basic`) |
| Documentation | README (215 lines) + CHANGELOG + CONTRIBUTING + CODE_OF_CONDUCT |
| MSRV | Rust 1.82+ |
| License | MIT OR Apache-2.0 (dual) |

## 9. Key Observations

1. **Solves a real problem**: 60+ CLIs re-implementing the same boilerplate is a concrete pain point — this library directly addresses it with minimal abstraction overhead.
2. **Hexagonal port pattern**: The `CliPort` trait is a clean hexagonal port that decouples CLI definition from CLI parsing, allowing test doubles and alternative parser backends (pico-args, lexopt) to be swapped in.
3. **FR-tagged tests**: Every unit test is annotated with its FR ID (`FR-001`, `FR-002`, etc.) — excellent traceability between spec and tests.
4. **Object-safe design**: `CliPort` is `Send + Sync` and works behind `Arc<dyn CliPort>` — important for long-running processes (REPLs, daemons, MCP servers).
5. **clap version constraint**: Pins `clap >=4.3, <4.4` — tight range that may cause issues if adopters are on clap 4.4+ (which was released). However, `README.md` example shows `clap = "4.5"` — the workspace uses one version but docs suggest another.
6. **`CommonCommands` lacks extensibility**: The enum only has the 3 standard variants; adopters with app-specific subcommands need to define their own enum and can't use `CommonCommands` directly. The `ParsedCli::Other` variant in `clap_based_cli.rs` solves this for the builder API but the derive path requires manual enum definition.
7. **Proc-macro is a passthrough**: `#[clap_ext_common_subcommands]` currently does nothing functional — it's a documentation marker. Real macro support (auto-adding variants) would be valuable v2 work.
8. **No `get_one::<OutputFormat>` safety**: In `clap_based_cli.rs:276`, `unwrap_or(&OutputFormat::Human)` assumes the default is always present — this is correct with clap's `default_value` but could panic if the arg definition changes.

## 10. Recommendations

1. **Widen clap version constraint**: Change workspace dependency to `>=4.3, <5` to avoid conflicts as adopters upgrade to clap 4.4+.
2. **Implement full proc-macro**: Make `#[clap_ext_common_subcommands]` auto-generate the 3 variant arms so adopters only write app-specific ones.
3. **Add docs.rs documentation**: The library has rich inline docs but no `docs.rs` configuration — add `#![doc(document_platform_docs_url)]` and publish to crates.io.
4. **Add `Verbosity` parsing from env var**: Many CLIs want `LOG_LEVEL` or `VERBOSE` env vars — `Verbosity` should support env overrides like `ConfigArg` does.
5. **Consider `OutputFormat::Auto`**: A variant that auto-detects JSON/YAML from output pipe status (like `--color=auto`), useful for CI vs interactive use.
