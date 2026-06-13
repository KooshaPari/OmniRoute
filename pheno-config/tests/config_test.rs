//! Integration tests for the `pheno-config` crate.
//!
//! These tests exercise the public API surface of `pheno_config`
//! (`load_from_env`, `load_from_file`, and `ConfigBuilder`) and are
//! the canonical location for the six L3 #48 spec-named tests:
//!
//! 1. `load_from_env_with_prefix_filters_unrelated_vars`
//! 2. `load_from_env_defaults_port_8080`
//! 3. `load_from_file_valid_json`
//! 4. `load_from_file_missing_file_returns_io_error`
//! 5. `builder_sets_defaults`
//! 6. `missing_required_field_returns_missing_field_error`
//!
//! Plus four additional tests that round out the contract:
//! `load_from_file_missing_required_field_returns_missing_field_error`,
//! `load_from_env_invalid_port_returns_parse_error`,
//! `load_from_file_malformed_json_returns_parse_error`, and
//! `config_error_display_is_informative`.
//!
//! The env-var tests use a unique prefix per test plus an RAII
//! `EnvGuard` that restores prior env values on drop, so no env
//! bleed between parallel tests.

use std::env;

// Re-import the public API so the tests read like spec examples.
use pheno_config::{
    load_from_env, load_from_file, ConfigBuilder, ConfigError, FIELD_DB_PATH, FIELD_URL,
};

// ---------------------------------------------------------------------------
// Env-var test isolation
// ---------------------------------------------------------------------------

/// RAII helper: sets the given env vars for the lifetime of the
/// guard, then restores (or removes) them on drop. Avoids env bleed
/// between tests even when a test panics.
struct EnvGuard {
    saved: Vec<(String, Option<String>)>,
}

impl EnvGuard {
    fn set(pairs: &[(String, &str)]) -> Self {
        let mut saved = Vec::with_capacity(pairs.len());
        for (k, v) in pairs {
            let prev = env::var(k).ok();
            env::set_var(k.as_str(), v);
            saved.push((k.clone(), prev));
        }
        Self { saved }
    }
}

impl Drop for EnvGuard {
    fn drop(&mut self) {
        for (k, prev) in self.saved.drain(..) {
            match prev {
                Some(v) => env::set_var(k.as_str(), v),
                None => env::remove_var(k.as_str()),
            }
        }
    }
}

/// Shorthand to build the full env-var name `<PREFIX>_<FIELD>` used
/// in the L3 #48 spec.
fn k(prefix: &str, field: &str) -> String {
    format!("{prefix}_{field}")
}

// Unique prefixes so parallel tests don't collide.
const PREFIX_FILTER: &str = "PHENO_CONFIG_IT_FILTER";
const PREFIX_DEFAULTS: &str = "PHENO_CONFIG_IT_DEFAULTS";
const PREFIX_INVALID_PORT: &str = "PHENO_CONFIG_IT_INVALID_PORT";
const PREFIX_MISSING: &str = "PHENO_CONFIG_IT_MISSING";

// ---------------------------------------------------------------------------
// L3 #48 spec tests (six required names — verbatim)
// ---------------------------------------------------------------------------

/// Spec test 1: `load_from_env` must ignore env vars that do not
/// start with the supplied prefix, even if those vars happen to
/// have the same suffix (`_URL`, `_PORT`, etc.).
#[test]
fn load_from_env_with_prefix_filters_unrelated_vars() {
    // Unrelated env vars (no prefix match) must be ignored.
    let _unrelated = EnvGuard::set(&[
        ("UNRELATED_URL".to_owned(), "https://wrong.example.com"),
        ("UNRELATED_PORT".to_owned(), "1"),
        ("UNRELATED_DB_PATH".to_owned(), "/wrong/path.db"),
        ("UNRELATED_LOG_LEVEL".to_owned(), "trace"),
        ("UNRELATED_FEATURE_FLAGS".to_owned(), "rogue"),
    ]);
    let _guard = EnvGuard::set(&[
        (k(PREFIX_FILTER, "URL"), "https://right.example.com"),
        (k(PREFIX_FILTER, "PORT"), "9999"),
        (k(PREFIX_FILTER, "LOG_LEVEL"), "debug"),
        (k(PREFIX_FILTER, "DB_PATH"), "/right/path.db"),
        (k(PREFIX_FILTER, "FEATURE_FLAGS"), "alpha, beta ,gamma"),
    ]);

    let cfg = load_from_env(PREFIX_FILTER).expect("load");
    assert_eq!(cfg.url, "https://right.example.com");
    assert_eq!(cfg.port, 9999);
    assert_eq!(cfg.log_level, "debug");
    assert_eq!(cfg.db_path, "/right/path.db");
    assert_eq!(
        cfg.feature_flags,
        vec!["alpha".to_owned(), "beta".to_owned(), "gamma".to_owned(),]
    );
}

/// Spec test 2: when only the required env vars are set, the
/// optional fields fall back to their documented defaults
/// (`port = 8080`, `log_level = "info"`, `feature_flags = Vec::new()`).
#[test]
fn load_from_env_defaults_port_8080() {
    let _guard = EnvGuard::set(&[
        (k(PREFIX_DEFAULTS, "URL"), "https://default.example.com"),
        (k(PREFIX_DEFAULTS, "DB_PATH"), "/var/lib/default.db"),
    ]);

    let cfg = load_from_env(PREFIX_DEFAULTS).expect("load");
    assert_eq!(cfg.url, "https://default.example.com");
    assert_eq!(cfg.port, 8080, "port should default to 8080");
    assert_eq!(cfg.log_level, "info", "log_level should default to info");
    assert!(
        cfg.feature_flags.is_empty(),
        "feature_flags should default to empty"
    );
}

/// Spec test 3: a well-formed JSON file is deserialised into a
/// `Config` with all fields populated.
#[test]
fn load_from_file_valid_json() {
    let dir = env::temp_dir();
    let path = dir.join("pheno_config_it_valid.json");
    let json = r#"{
        "url": "https://file.example.com",
        "port": 4242,
        "log_level": "warn",
        "db_path": "/var/lib/file.db",
        "feature_flags": ["a", "b"]
    }"#;
    std::fs::write(&path, json).expect("write temp json");
    let cfg = load_from_file(&path).expect("load");
    assert_eq!(cfg.url, "https://file.example.com");
    assert_eq!(cfg.port, 4242);
    assert_eq!(cfg.log_level, "warn");
    assert_eq!(cfg.db_path, "/var/lib/file.db");
    assert_eq!(cfg.feature_flags, vec!["a".to_owned(), "b".to_owned()]);
    let _ = std::fs::remove_file(&path);
}

/// Spec test 4: a missing file path must surface as
/// `ConfigError::IoError` (not a `ParseError` and not a panic).
#[test]
fn load_from_file_missing_file_returns_io_error() {
    let path = env::temp_dir().join("pheno_config_it_definitely_does_not_exist_42.json");
    // Make absolutely sure the file does not exist.
    let _ = std::fs::remove_file(&path);
    let err = load_from_file(&path).expect_err("should fail");
    assert!(
        matches!(err, ConfigError::IoError(_)),
        "expected IoError, got {err:?}"
    );
}

/// Spec test 5: `ConfigBuilder::new()` exposes the documented
/// defaults — `port = 8080`, `log_level = "info"`,
/// `feature_flags = Vec::new()` — when only the required fields
/// are explicitly set.
#[test]
fn builder_sets_defaults() {
    let cfg = ConfigBuilder::new()
        .url("https://builder.example.com")
        .db_path("/var/lib/builder.db")
        .build()
        .expect("build");
    assert_eq!(cfg.url, "https://builder.example.com");
    assert_eq!(cfg.port, 8080, "default port");
    assert_eq!(cfg.log_level, "info", "default log_level");
    assert_eq!(cfg.db_path, "/var/lib/builder.db");
    assert!(cfg.feature_flags.is_empty(), "default feature_flags");
}

/// Spec test 6: building a `Config` without the required `URL` (or
/// `DB_PATH`) must yield `ConfigError::MissingField` with the
/// field name surfaced for the caller to act on.
#[test]
fn missing_required_field_returns_missing_field_error() {
    // No fields set: URL is checked first, so we expect MissingField
    // for URL.
    let err = ConfigBuilder::new().build().expect_err("should fail");
    assert!(
        matches!(err, ConfigError::MissingField(ref f) if f == FIELD_URL),
        "expected MissingField(URL), got {err:?}"
    );

    // url set, no db_path: missing field must be DB_PATH.
    let err = ConfigBuilder::new()
        .url("https://x.example.com")
        .build()
        .expect_err("should fail");
    assert!(
        matches!(err, ConfigError::MissingField(ref f) if f == FIELD_DB_PATH),
        "expected MissingField(DB_PATH), got {err:?}"
    );

    // Env-var path with no vars set: MissingField surfaces the full
    // env-var name (`<PREFIX>_URL`) so operators can grep their env
    // directly.
    let _guard = EnvGuard::set(&[]);
    let err = load_from_env(PREFIX_MISSING).expect_err("should fail");
    match err {
        ConfigError::MissingField(name) => {
            assert_eq!(name, k(PREFIX_MISSING, "URL"));
        }
        other => panic!("expected MissingField, got {other:?}"),
    }
}

// ---------------------------------------------------------------------------
// Additional contract tests
// ---------------------------------------------------------------------------

/// JSON missing a required key (`url`) must be reported as
/// `ConfigError::MissingField` with the field name extracted from
/// serde_json's diagnostic.
#[test]
fn load_from_file_missing_required_field_returns_missing_field_error() {
    let dir = env::temp_dir();
    let path = dir.join("pheno_config_it_missing_field.json");
    let json = r#"{
        "port": 4242,
        "log_level": "warn",
        "db_path": "/var/lib/x.db"
    }"#;
    std::fs::write(&path, json).expect("write temp json");
    let err = load_from_file(&path).expect_err("should fail");
    match err {
        ConfigError::MissingField(field) => assert_eq!(field, "url"),
        other => panic!("expected MissingField(url), got {other:?}"),
    }
    let _ = std::fs::remove_file(&path);
}

/// A non-numeric `<PREFIX>_PORT` must surface as
/// `ConfigError::ParseError` whose `field` is the full env-var name
/// (so operators can grep their env).
#[test]
fn load_from_env_invalid_port_returns_parse_error() {
    let _guard = EnvGuard::set(&[
        (k(PREFIX_INVALID_PORT, "URL"), "https://x.example.com"),
        (k(PREFIX_INVALID_PORT, "PORT"), "not-a-number"),
        (k(PREFIX_INVALID_PORT, "DB_PATH"), "/tmp/x.db"),
    ]);
    let err = load_from_env(PREFIX_INVALID_PORT).expect_err("should fail");
    assert!(
        matches!(err, ConfigError::ParseError { ref field, .. } if field == &k(PREFIX_INVALID_PORT, "PORT")),
        "expected ParseError on PORT, got {err:?}"
    );
}

/// A malformed JSON payload must surface as
/// `ConfigError::ParseError` (NOT `IoError` — we DID read the file
/// fine, the bytes just aren't valid JSON).
#[test]
fn load_from_file_malformed_json_returns_parse_error() {
    let dir = env::temp_dir();
    let path = dir.join("pheno_config_it_malformed.json");
    std::fs::write(&path, b"{ this is not json").expect("write");
    let err = load_from_file(&path).expect_err("should fail");
    assert!(
        matches!(err, ConfigError::ParseError { .. }),
        "expected ParseError, got {err:?}"
    );
    let _ = std::fs::remove_file(&path);
}

/// `ConfigError`'s `Display` impl must include the variant's
/// identifying information (the field name for `MissingField` and
/// `ParseError`, the wrapped detail for `ParseError`). This is the
/// contract that makes the error useful in log lines.
#[test]
fn config_error_display_is_informative() {
    let m = ConfigError::MissingField("URL".to_owned()).to_string();
    assert!(m.contains("URL"), "display was: {m}");
    let p = ConfigError::ParseError {
        field: "PORT".to_owned(),
        message: "not a number".to_owned(),
    }
    .to_string();
    assert!(p.contains("PORT"));
    assert!(p.contains("not a number"));
}
