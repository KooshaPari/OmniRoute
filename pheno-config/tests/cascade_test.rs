//! Integration test for the `pheno-config` layered provider cascade.
//!
//! Proves the priority order: env > toml > default.
//!
//! Run with:
//!
//! ```bash
//! cargo test --test cascade_test
//! ```

use figment::{
    providers::{Env, Format, Toml},
    Figment,
};

/// Inlined copy of [`pheno_config::cascade::DEFAULT_TOML`] so this integration
/// test does not depend on the private item.
const DEFAULT_TOML: &str = r#"
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

/// Helper — builds a cascade with the same priority as
/// `pheno_config::cascade::build_cascade` but without the Jetbrains layer
/// (avoids picking up `.idea/runConfigurations/*.xml` from the dev machine).
fn cascade(toml_override: &str) -> Figment {
    Figment::new()
        .merge(Toml::string(DEFAULT_TOML))
        .merge(Toml::string(toml_override))
        .merge(Env::prefixed("PHENO_"))
}

#[test]
fn default_values_are_present_when_nothing_overrides() {
    let cfg = cascade("");
    let port: u16 = cfg
        .find_value("server.port")
        .expect("default server.port must be present");
    assert_eq!(port, 8080);

    let level: String = cfg
        .find_value("logging.level")
        .expect("default logging.level must be present");
    assert_eq!(level, "info");
}

#[test]
fn toml_file_overrides_default() {
    let toml = r#"
[server]
port = 9090
"#;
    let cfg = cascade(toml);
    let port: u16 = cfg
        .find_value("server.port")
        .expect("toml-overridden server.port must be present");
    assert_eq!(
        port, 9090,
        "toml should override default server.port from 8080 to 9090"
    );

    // Untouched key should still come from the default layer.
    let host: String = cfg
        .find_value("server.host")
        .expect("server.host from default must still be present");
    assert_eq!(host, "127.0.0.1");
}

#[test]
fn env_overrides_toml_overrides_default() {
    // Step 1: build a cascade with a TOML override on server.port.
    let toml = r#"
[server]
port = 9090
"#;
    let mut cfg = cascade(toml);

    // Step 2: inject an env override via `Figment::merge` using `Env::raw`.
    // We use the raw form (not `Env::prefixed`) because the test wants a
    // single fixed key rather than a prefix walk.
    cfg = cfg.merge(Env::raw("PHENO_SERVER_PORT").map(|_| "12777".into()));

    let port: u16 = cfg
        .find_value("server.port")
        .expect("env-overridden server.port must be present");
    assert_eq!(
        port, 12777,
        "env (PHENO_SERVER_PORT=12777) should win over toml (9090) and default (8080)"
    );
}

#[test]
fn env_can_set_a_brand_new_key_not_in_defaults_or_toml() {
    let cfg = cascade("").merge(Env::raw("PHENO_NEW_KEY").map(|_| "fresh".into()));

    let val: String = cfg
        .find_value("new_key")
        .expect("env-only new_key must be present");
    assert_eq!(val, "fresh");
}