# pheno-config: 12-factor configuration

**Audience:** pheno-* service authors. Read this before rolling your
own config loader.

**TL;DR:** Use `pheno_config::combine("config.toml", "PHENO_SERVICE")`
for production. Required fields live in the file; env is the
override layer. Don't roll a new loader.

---

## The 12-factor contract

[12-factor config](https://12factor.net/config) says: configuration
that varies between deploys belongs in **environment variables**.
The corollary: configuration that *doesn't* vary between deploys
(sensible defaults, schema, feature-flag enumerations) belongs in
**the code or a file shipped with the code**.

`combine()` implements this contract:

```
final config = file ⊕ env       (env wins when both set)
```

Where `file` is `config.toml` and `env` is `PHENO_SERVICE_*`. The
file is committed to git; the env is per-deploy. The file gives you
required fields and defaults; the env gives you runtime overrides.

## Why not just env vars?

Pure-env-var loading has three problems that `combine()` solves:

1. **Where do defaults live?** If `PHENO_SERVICE_URL` is unset
   at startup, your service crashes. The file is the natural home
   for defaults — committed to git, reviewable, environment-agnostic.

2. **How do you set complex values?** Feature flag lists, log
   filters, retry policies. TOML handles these cleanly; env-var
   quoting (comma-separated, JSON-in-string) does not.

3. **How do you document the schema?** A TOML file with
   well-named keys is self-documenting. Env-var names are not.

`combine()` lets you have it both ways: file for shape and
defaults, env for secrets and runtime overrides.

## When to use which loader

| Loader | When |
|---|---|
| `ConfigBuilder::new()` | Tests, examples, programmatic config |
| `load_from_env(prefix)` | Pure-env deploys (no config file in container) |
| `load_from_json_file(path)` | Legacy JSON configs (pheno-errors, pheno-otel v0.1) |
| `load_from_toml_file(path)` | Pure-file deploys (no env overrides needed) |
| **`combine(file, prefix)`** | **Production. Always prefer this.** |
| `load_from_env_full(prefix)` | Internal: combine()'s env-layer building block |

If you're starting a new pheno-* service, use `combine()`. The
other loaders are kept for backward compatibility with v0.1.0
consumers.

## How `combine()` resolves conflicts

For each field, in order:

1. If `env.PORT` is set, use that. Otherwise use `file.port`.
2. If `env.URL` is set, use that. Otherwise use `file.url`.
3. If `env.FEATURE_FLAGS` is set, append (dedup) onto `file.feature_flags`.

This means a deploy that sets `PHENO_SERVICE_PORT=9090` will override
the file's `port = 8080`, but the file's `feature_flags` still
contribute. The order of flags is: file's first, env's appended.

## What goes in the file vs env

| Concern | File | Env |
|---|---|---|
| Database schema | yes | no |
| Default port | yes | no |
| Default log level | yes | no |
| Feature flag enumerations | yes | no |
| API URL | both | deploy-specific (env wins) |
| DB credentials | no | yes (secrets) |
| Per-instance overrides | no | yes (port, log level) |

If the same value appears in both, env wins. The file is the
"floor"; the env is the "ceiling".

## Examples

### `config.toml` (committed to git)

```toml
url = "https://api.example.com"
port = 8080
log_level = "info"
db_path = "/var/lib/myservice/myservice.db"
feature_flags = ["metrics", "tracing"]
```

### Production env (set per-deploy)

```bash
export PHENO_SERVICE_URL=https://prod.api.example.com
export PHENO_SERVICE_PORT=443
export PHENO_SERVICE_LOG_LEVEL=warn
export PHENO_SERVICE_FEATURE_FLAGS=metrics,tracing,prod_only
export PHENO_SERVICE_DB_PATH=/var/secrets/prod.db
```

### Service code (one line)

```rust
let cfg = pheno_config::combine("config.toml", "PHENO_SERVICE")?;
```

That's it. The file supplies defaults and a schema; the env
overrides for the deploy. No re-parsing, no surprises.

## Migrating from v0.1.0 to v0.2.0

If your service uses `load_from_env(prefix)`, the migration is:

1. Add `toml = "0.8"` to your dev-deps (already in pheno-config).
2. Create `config.toml` with the same fields you had in env
   defaults.
3. Change `load_from_env(prefix)` to
   `combine("config.toml", prefix)`.
4. Update tests to use unique prefix constants
   (or the `Mutex<()>` pattern from
   `tests/toml_merge_test.rs:25`).

The error type is unchanged (`ConfigError` is the same).
The `Config` struct is unchanged. The `ConfigBuilder` is unchanged.
Only the loader API gets a new method.

## Why not Figment / Config-rs / dotenvy?

These are good crates, but adding a dependency for what is now
~150 lines of focused code is overkill. `pheno-config` is small
because it does one thing: load a 5-field `Config` struct. It
doesn't handle nested config, config merging across files,
or runtime config reload. If you need those, you can replace
`pheno-config` with Figment or similar — but the 9 deleted
config loaders didn't need any of that.
