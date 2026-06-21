//! Layered configuration cascade for `pheno-config`.
//!
//! Cascades providers in strict priority order (highest wins):
//!
//! 1. **`Jetbrains::default()`** — IntelliJ-style `.idea/runConfigurations/*.xml`
//!    files (developer-machine overrides; highest priority so a developer can
//!    shadow a checked-in value without touching env vars or TOML).
//! 2. **`Env::prefixed("PHENO_")`** — environment variables of the form
//!    `PHENO_<KEY>=value`. 12-factor style; CI / container runtime overrides.
//! 3. **`Toml::file("config.toml")`** — checked-in TOML defaults (loaded only
//!    if the file exists; missing file is non-fatal).
//! 4. **`Toml::string(DEFAULT_TOML)`** — embedded compile-time defaults
//!    (lowest priority; always present).
//!
//! The cascade order in [`build_cascade`] is **bottom-of-stack first**:
//! [`Figment::merge`] appends a provider on top of the previous, so the last
//! `merge` call has the highest priority.  Therefore the call order is:
//!
//! `defaults → toml-file → env → jetbrains`
//!
//! which produces the desired priority `jetbrains > env > toml > default`.

use figment::{
    providers::{Env, Format, Jetbrains, Toml},
    Figment,
};

/// Embedded default TOML payload — always available, lowest priority.
///
/// Values here are the `pheno-config` defaults that the rest of the Phenotype
/// fleet can rely on without reading any file or env var.
pub const DEFAULT_TOML: &str = r#"
# pheno-config defaults (lowest priority in cascade)
[server]
host = "127.0.0.1"
port = 8080

[logging]
level = "info"
format = "json"

[database]
path = "./pheno.db"
pool_size = 8
"#;

/// Build the standard `pheno-config` cascade.
///
/// Provider order (bottom-of-stack → top-of-stack, top wins):
///
/// 1. [`Toml::string(DEFAULT_TOML)`] — embedded defaults.
/// 2. [`Toml::file("config.toml")`] — checked-in TOML (if present).
/// 3. [`Env::prefixed("PHENO_")`] — environment variables.
/// 4. [`Jetbrains::default()`] — IntelliJ run-config overrides.
pub fn build_cascade() -> Figment {
    Figment::new()
        // 1. Embedded defaults (lowest priority).
        .merge(Toml::string(DEFAULT_TOML))
        // 2. Checked-in TOML — fails soft if `config.toml` is missing.
        .merge(Toml::file("config.toml"))
        // 3. Environment variables (`PHENO_*` prefix).
        .merge(Env::prefixed("PHENO_"))
        // 4. Jetbrains run-config overrides (highest priority).
        .merge(Jetbrains::default())
}

/// Build the cascade from an explicit TOML string instead of `config.toml`.
///
/// Useful for tests and for callers that want to inject TOML from a custom
/// source (e.g. a bundled config blob inside a binary).
pub fn build_cascade_from_str(toml: &str) -> Figment {
    Figment::new()
        .merge(Toml::string(DEFAULT_TOML))
        .merge(Toml::string(toml))
        .merge(Env::prefixed("PHENO_"))
        .merge(Jetbrains::default())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn default_toml_parses_as_valid_toml() {
        // The embedded defaults must always be valid TOML — a syntax error
        // here is a compile-time-equivalent bug.
        let cascade = build_cascade();
        let value: toml::Value = cascade
            .find_value("server.port")
            .expect("default server.port must be present");
        assert_eq!(value.as_integer(), Some(8080));
    }
}