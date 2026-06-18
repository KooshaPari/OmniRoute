# pheno-config

Canonical typed-config loader for the pheno-* fleet. One crate to load
your service's `Config { url, port, log_level, db_path, feature_flags }`
from env vars, JSON files, or TOML files — with a canonical
**12-factor `combine()`** that overlays env over TOML.

## Why one crate

Before v0.2.0, the pheno-* fleet had nine different ad-hoc config
loaders. Each rolled its own JSON/TOML parser, env-var reader, and
error type. Every consumer had to learn a different API. ADR-012
consolidates the canonical loader here, so all pheno-* services
share the same env-var names, same error type, and same
testable surface.

The full audit is in
[`docs/twelve-factor.md`](docs/twelve-factor.md).

## Quick start

```rust
use pheno_config::ConfigBuilder;

// Programmatic construction (tests, examples)
let cfg = ConfigBuilder::new()
    .url("https://api.example.com")
    .port(8080)
    .log_level("info")
    .db_path("/var/lib/mydb")
    .feature_flag("metrics")
    .feature_flag("tracing")
    .build()
    .expect("config is well-formed");

assert_eq!(cfg.port, 8080);
assert_eq!(cfg.feature_flags, vec!["metrics", "tracing"]);
```

## 12-factor path (the recommended one)

```rust
use pheno_config::combine;

// Production: load config.toml, then overlay env vars
// (e.g. PHENO_CONFIG_URL=https://prod.example.com).
let cfg = combine("config.toml", "PHENO_CONFIG")?;
```

`combine()` semantics:

| Source | Role |
|---|---|
| `config.toml` (file) | Source of truth for required fields, defaults |
| `PHENO_CONFIG_*` (env) | Runtime override layer (deploys, k8s, secrets) |

Required fields (`url`, `db_path`) can be set by either, but the
file is the canonical home for them. Env wins when both are set.

## API surface

| Function | Since | Purpose |
|---|---|---|
| `ConfigBuilder::new()` | v0.1.0 | Programmatic config construction |
| `load_from_env(prefix)` | v0.1.0 | Required-field env loader (fails if `URL` or `DB_PATH` missing) |
| `load_from_json_file(path)` | v0.1.0 | JSON file loader |
| `load_from_toml_file(path)` | v0.2.0 | TOML file loader (new in v0.2.0) |
| `Config::merge(&mut other)` | v0.2.0 | In-place overlay; non-empty/non-zero wins, flags dedup |
| `combine(file, env_prefix)` | v0.2.0 | 12-factor: file + env overlay |
| `load_from_env_full(prefix)` | v0.2.0 | Env loader that returns 0/empty for unset (combine's building block) |

## Environment variable names

The env prefix is whatever you pass to `load_from_env` or `combine`.
Common prefixes used in the fleet:

- `PHENO_CONFIG` — most services
- `PHENO_MCP` — pheno-mcp-router
- `PHENO_TRACING` — pheno-tracing (canonical tracing crate)
- `PHENO_PROFILING` — pheno-profiling (Profila-replacement)

The fields, always uppercase, suffixed to the prefix:

| Field | Env var | Type | Required? |
|---|---|---|---|
| `url` | `{PREFIX}_URL` | string | yes (in v0.1.0 `load_from_env`; optional in v0.2.0 `combine`) |
| `port` | `{PREFIX}_PORT` | u16 | no (default: 8080) |
| `log_level` | `{PREFIX}_LOG_LEVEL` | string | no (default: "info") |
| `db_path` | `{PREFIX}_DB_PATH` | string | yes (in v0.1.0 `load_from_env`; optional in v0.2.0 `combine`) |
| `feature_flags` | `{PREFIX}_FEATURE_FLAGS` | comma-separated list | no (default: `[]`) |

## Error type

```rust
pub enum ConfigError {
    MissingField(&'static str),
    IoError(std::io::Error),
    ParseError { field: String, message: String },
}
```

All loaders return this. No `unwrap()`, no `Box<dyn Error>`, no
stringly-typed errors. Use `match` to handle each case.

## Testing

The test suite (in `tests/`) is parallel-safe. It uses a process-wide
`Mutex<()>` to serialize env-var access across cargo test threads,
plus per-test unique prefix variables. Both are belt-and-suspenders
defenses against the env-var races that Rust 1.74+ has documented.

```bash
cargo test --offline    # 11 unit + 3 doc tests, ~0.05s
```

## Versioning

| Version | When | Notable |
|---|---|---|
| 0.1.0 | 2026-06-15 | Initial release. env, JSON, ConfigBuilder. |
| 0.2.0 | 2026-06-15 | TOML, Config::merge, combine(). ADR-012 consolidation. |
