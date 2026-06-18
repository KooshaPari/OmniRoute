# pheno-cli-base

Shared CLI building blocks for the Phenotype fleet of command-line tools.

This crate is intentionally small. It bundles the three pieces of
boilerplate that every Phenotype CLI re-implements, so each binary can
depend on one crate and inherit the canonical behavior:

| Symbol | Purpose |
| --- | --- |
| [`ConfigArg`](src/config_arg.rs) | `-c, --config <path>` (also reads `PHENOTYPE_CONFIG`). |
| [`Verbosity`](src/verbosity.rs) | `-v, --verbose` (count) and `-q, --quiet` flags, mutually exclusive. |
| [`setup_tracing`](src/tracing.rs) | `tracing-subscriber` init that honors `RUST_LOG`. |
| [`setup_tracing_from_count`](src/tracing.rs) | `setup_tracing` driven by a verbose count and quiet bool. |
| [`prelude`](src/lib.rs) | `use pheno_cli_base::prelude::*;` for the common-import set. |

## Quick Start

Add to your CLI's `Cargo.toml`:

```toml
[dependencies]
pheno-cli-base = { path = "../pheno-cli-base" }
clap = { version = "4.5", features = ["derive", "env"] }
tracing = "0.1"
```

In your `main.rs`:

```rust,no_run
use clap::Parser;
use pheno_cli_base::{ConfigArg, Verbosity, setup_tracing};

#[derive(Debug, Parser)]
struct Cli {
    #[command(flatten)]
    config: ConfigArg,

    #[command(flatten)]
    verbosity: Verbosity,
}

fn main() {
    let cli = Cli::parse();
    setup_tracing(cli.verbosity.to_filter());

    if let Some(path) = cli.config.path() {
        tracing::info!(?path, "using config");
    }
    // ... rest of your CLI ...
}
```

## API

### `ConfigArg`

```rust,no_run
use clap::Parser;
use pheno_cli_base::ConfigArg;

#[derive(Debug, Parser)]
struct Cli {
    #[command(flatten)]
    config: ConfigArg,
}
```

Field-level details:

- Short flag: `-c <PATH>`
- Long flag: `--config <PATH>`
- Env fallback: `PHENOTYPE_CONFIG`
- Help: `Path to the config file (YAML/TOML/JSON).`

er methods on `ConfigArg`:

- `ConfigArg::path() -> Option<&Path>` — the configured path.
- `ConfigArg::is_set() -> bool` — true if flag or env supplied a path.

### `Verbosity`

```rust,no_run
use clap::Parser;
use pheno_cli_base::Verbosity;

#[derive(Debug, Parser)]
struct Cli {
    #[command(flatten)]
    verbosity: Verbosity,
}
```

Flag-level details:

- `-v` (count, repeatable): `-v`, `-vv`, `-vvv`
- `--verbose` (count, repeatable): `--verbose --verbose`
- `-q`, `--quiet`: boolean
- The two are mutually exclusive (clap's `group(multiple = false)`).

Conversion to a `tracing-subscriber` filter (`Verbosity::to_filter()`):

| Flags | `LevelFilter` |
| --- | --- |
| `--quiet` / `-q` | `ERROR` |
| (default) | `INFO` |
| `-v` × 1 | `DEBUG` |
| `-v` ≥ 2 | `TRACE` |

er methods on `Verbosity`:

- `Verbosity::to_filter() -> LevelFilter` — see the table above.
- `Verbosity::is_quiet() -> bool`
- `Verbosity::verbose_count() -> u8`

### `setup_tracing`

```rust,no_run
use pheno_cli_base::setup_tracing;

setup_tracing(tracing_subscriber::filter::LevelFilter::INFO);
```

Behavior:

- If `RUST_LOG` is set, the resulting `EnvFilter` honors it.
- Otherwise, the supplied `LevelFilter` is used as a single directive.
- Idempotent: a second call does not panic if a global subscriber is
  already installed (the `SetGlobalDefaultError` is swallowed).

### `setup_tracing_from_count`

```rust,no_run
use pheno_cli_base::setup_tracing_from_count;

setup_tracing_from_count(/* verbose_count = */ 0, /* quiet = */ false);
```

Same as `setup_tracing`, but the filter is derived from a
verbose-count and quiet bool using the same mapping shown above.

### `prelude`

```rust,no_run
use pheno_cli_base::prelude::*;
// Now: ConfigArg, Verbosity, setup_tracing, setup_tracing_from_count
```

## Why these three?

Every Phenotype CLI implements (a) a config-file flag, (b) a
verbosity/quiet pair, and (c) a `tracing-subscriber` bootstrap. They
are small on their own, but they:

- have to agree across the fleet (e.g. the `PHENOTYPE_CONFIG` env
  name),
- are easy to drift on (e.g. `-v` should map to `DEBUG`, `-vv` to
  `TRACE`),
- and the `setup_tracing` function has a non-obvious correctness
  contract (it must be idempotent so tests can call it freely).

Centralizing them in one place means every CLI gets them right by
default and can be re-skinned (e.g. a future `OutputFormat`) without
re-plumbing all the binaries.

## Layout

```
pheno-cli-base/
├── Cargo.toml
├── README.md
├── src/
│   ├── lib.rs          # crate root, prelude, re-exports
│   ├── config_arg.rs   # ConfigArg struct
│   ├── verbosity.rs    # Verbosity struct
│   └── tracing.rs      # setup_tracing, setup_tracing_from_count
└── tests/
    └── public_api.rs   # integration tests
```

## Commands

| Command | Purpose |
| --- | --- |
| `cargo build` | Compile the library. |
| `cargo test` | Run all unit and integration tests. |
| `cargo test -- --test-threads=1` | Run tests serially (avoids env-var races in unusual CI setups). |
| `cargo clippy --all-targets -- -D warnings` | Lint with warnings denied. |
| `cargo doc --no-deps` | Build rustdoc locally. |

## License

MIT OR Apache-2.0.
