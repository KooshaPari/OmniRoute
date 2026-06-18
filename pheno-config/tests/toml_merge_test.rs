//! v0.2.0 tests — TOML loading, Config::merge, and combine().
//!
//! Companion to `config_test.rs` (which covers the v0.1.0 surface
//! — env, JSON, builder). These tests exercise the new v0.2.0 API:
//! TOML file loading, in-place Config merging, and the canonical
//! 12-factor `combine()` (TOML + env overlay).
//!
//! Pattern matches `config_test.rs`: temp-dir fixtures, RAII
//! env-var guard, no env bleed between parallel tests.

use std::env;
use std::sync::Mutex;

use pheno_config::{
    combine, load_from_env, load_from_toml_file, ConfigBuilder, ConfigError,
};

// Process-wide lock that serializes env-var access. The default
// cargo test harness runs tests in parallel worker threads, but
// process-wide env vars are inherently shared state. Even with
// per-test unique prefixes, reads from a different worker thread
// can race with writes from the test's main thread. The
// recommended Rust pattern (per the std::env docs since 1.74) is
// to use a Mutex<()>: tests acquire it before touching env vars.
static ENV_LOCK: Mutex<()> = Mutex::new(());

// ---------------------------------------------------------------------------
// Env-var test isolation (mirror of config_test.rs)
// ---------------------------------------------------------------------------

struct EnvGuard {
    _lock: std::sync::MutexGuard<'static, ()>,
    saved: Vec<(String, Option<String>)>,
}

impl EnvGuard {
    /// Set the listed env vars to the listed values for the
    /// lifetime of this guard. The previous values (or absence)
    /// are saved and restored on drop. KNOWN_V020_VARS are all
    /// cleared on entry to defend against env-var bleed between
    /// parallel cargo tests (the real defense is per-test unique
    /// prefixes, this is belt-and-suspenders).
    fn set(pairs: &[(String, &str)]) -> Self {
        // Acquire the process-wide env-var lock. This blocks
        // other env-var tests until we drop the guard, so
        // process-wide env-var reads from `combine()` see the
        // values we set here (and not some other parallel test's
        // values, or the empty default).
        let lock = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let mut saved = Vec::with_capacity(pairs.len() + KNOWN_V020_VARS.len());
        for k in KNOWN_V020_VARS {
            if pairs.iter().any(|(kk, _)| kk == k) {
                continue;
            }
            let prev = env::var(k).ok();
            env::remove_var(k);
            saved.push((k.to_string(), prev));
        }
        for (k, v) in pairs {
            let prev = env::var(k).ok();
            env::set_var(k.as_str(), v);
            saved.push((k.clone(), prev));
        }
        Self { _lock: lock, saved }
    }
}

/// Each test uses a UNIQUE prefix to prevent env-var bleed when
/// tests run in parallel (cargo's default). The cargo tests
/// use a single global env var namespace, so two tests that
/// use the same prefix will race. Per-test unique prefixes
/// make the tests trivially parallel-safe.
const PREFIX_TFV: &str = "PHENO_CONFIG_V020_TFV";
const PREFIX_TFM: &str = "PHENO_CONFIG_V020_TFM";
const PREFIX_TFMA: &str = "PHENO_CONFIG_V020_TFMA";
const PREFIX_TFMR: &str = "PHENO_CONFIG_V020_TFMR";
const PREFIX_CFP: &str = "PHENO_CONFIG_V020_CFP";
const PREFIX_CEO: &str = "PHENO_CONFIG_V020_CEO";
const PREFIX_CNE: &str = "PHENO_CONFIG_V020_CNE";
const PREFIX_CRE: &str = "PHENO_CONFIG_V020_CRE";

/// All env var names any test in this file might set. Listed
/// explicitly so EnvGuard::set() can clear all of them on entry
/// as a defense-in-depth (covers any test that uses a non-prefix
/// var like combine()'s file-parse-error case).
const KNOWN_V020_VARS: &[&str] = &[
    "PHENO_CONFIG_V020_TFV_URL", "PHENO_CONFIG_V020_TFV_PORT",
    "PHENO_CONFIG_V020_TFM_URL", "PHENO_CONFIG_V020_TFM_PORT",
    "PHENO_CONFIG_V020_TFMA_URL", "PHENO_CONFIG_V020_TFMA_PORT",
    "PHENO_CONFIG_V020_TFMR_URL", "PHENO_CONFIG_V020_TFMR_PORT",
    "PHENO_CONFIG_V020_CFP_URL", "PHENO_CONFIG_V020_CFP_PORT",
    "PHENO_CONFIG_V020_CEO_URL", "PHENO_CONFIG_V020_CEO_PORT",
    "PHENO_CONFIG_V020_CEO_LOG_LEVEL", "PHENO_CONFIG_V020_CEO_DB_PATH",
    "PHENO_CONFIG_V020_CEO_FEATURE_FLAGS",
    "PHENO_CONFIG_V020_CNE_URL", "PHENO_CONFIG_V020_CNE_PORT",
    "PHENO_CONFIG_V020_CNE_LOG_LEVEL", "PHENO_CONFIG_V020_CNE_DB_PATH",
    "PHENO_CONFIG_V020_CNE_FEATURE_FLAGS",
    "PHENO_CONFIG_V020_CRE_URL", "PHENO_CONFIG_V020_CRE_PORT",
    "PHENO_CONFIG_V020_CRE_DB_PATH",
];

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

// PREFIX_COMBINE was the old shared prefix; now each combine-test
// uses its own prefix above (PREFIX_CEO, PREFIX_CNE, PREFIX_CRE, PREFIX_CFP)
// to prevent env-var bleed.

// ---------------------------------------------------------------------------
// load_from_toml_file
// ---------------------------------------------------------------------------

#[test]
fn load_from_toml_file_valid_toml() {
    let path = env::temp_dir().join("pheno_config_v020_valid.toml");
    let toml_src = r#"
url = "https://toml.example.com"
port = 7070
log_level = "info"
db_path = "/var/lib/toml.db"
feature_flags = ["alpha", "beta"]
"#;
    std::fs::write(&path, toml_src).expect("write temp toml");
    let cfg = load_from_toml_file(&path).expect("load");
    assert_eq!(cfg.url, "https://toml.example.com");
    assert_eq!(cfg.port, 7070);
    assert_eq!(cfg.log_level, "info");
    assert_eq!(cfg.db_path, "/var/lib/toml.db");
    assert_eq!(
        cfg.feature_flags,
        vec!["alpha".to_owned(), "beta".to_owned()]
    );
    let _ = std::fs::remove_file(&path);
}

#[test]
fn load_from_toml_file_missing_required_field_returns_missing_field_error() {
    let path = env::temp_dir().join("pheno_config_v020_missing.toml");
    let toml_src = r#"
port = 7070
log_level = "info"
db_path = "/var/lib/x.db"
"#;
    std::fs::write(&path, toml_src).expect("write");
    let err = load_from_toml_file(&path).expect_err("should fail");
    match err {
        ConfigError::MissingField(field) => assert_eq!(field, "url"),
        other => panic!("expected MissingField(url), got {other:?}"),
    }
    let _ = std::fs::remove_file(&path);
}

#[test]
fn load_from_toml_file_malformed_toml_returns_parse_error() {
    let path = env::temp_dir().join("pheno_config_v020_malformed.toml");
    std::fs::write(&path, b"this is = not valid toml [[[").expect("write");
    let err = load_from_toml_file(&path).expect_err("should fail");
    assert!(
        matches!(err, ConfigError::ParseError { ref field, .. } if field == "<toml>"),
        "expected ParseError on <toml>, got {err:?}"
    );
    let _ = std::fs::remove_file(&path);
}

#[test]
fn load_from_toml_file_missing_file_returns_io_error() {
    let path = env::temp_dir().join("pheno_config_v020_definitely_missing_42.toml");
    let _ = std::fs::remove_file(&path);
    let err = load_from_toml_file(&path).expect_err("should fail");
    assert!(
        matches!(err, ConfigError::IoError(_)),
        "expected IoError, got {err:?}"
    );
}

// ---------------------------------------------------------------------------
// Config::merge
// ---------------------------------------------------------------------------

#[test]
fn merge_overwrites_non_default_scalars() {
    let mut base = ConfigBuilder::new()
        .url("https://base.example.com")
        .db_path("/var/lib/base.db")
        .build()
        .expect("base");
    let overlay = ConfigBuilder::new()
        .url("https://overlay.example.com")
        .port(9090)
        .log_level("debug")
        .db_path("/var/lib/overlay.db")
        .feature_flag("beta")
        .build()
        .expect("overlay");

    base.merge(&overlay);

    assert_eq!(base.url, "https://overlay.example.com");
    assert_eq!(base.port, 9090);
    assert_eq!(base.log_level, "debug");
    assert_eq!(base.db_path, "/var/lib/overlay.db");
    assert_eq!(base.feature_flags, vec!["beta".to_owned()]);
}

#[test]
fn merge_concatenates_feature_flags_deduped() {
    let mut base = ConfigBuilder::new()
        .url("https://x.example.com")
        .db_path("/var/lib/x.db")
        .feature_flag("alpha")
        .feature_flag("shared")
        .build()
        .expect("base");
    let overlay = ConfigBuilder::new()
        .url("https://x.example.com")
        .db_path("/var/lib/x.db")
        .feature_flag("beta")
        .feature_flag("shared")
        .build()
        .expect("overlay");

    base.merge(&overlay);

    assert_eq!(
        base.feature_flags,
        vec!["alpha".to_owned(), "shared".to_owned(), "beta".to_owned()]
    );
}

#[test]
fn merge_does_not_overwrite_with_empty_strings() {
    // An "empty" overlay (built without optional fields) should
    // not clobber base values.
    let mut base = ConfigBuilder::new()
        .url("https://base.example.com")
        .db_path("/var/lib/base.db")
        .build()
        .expect("base");
    let empty = ConfigBuilder::new()
        .url("https://empty.example.com")
        .db_path("/var/lib/empty.db")
        .build()
        .expect("empty");

    base.merge(&empty);

    assert_eq!(base.url, "https://empty.example.com");
    assert_eq!(base.db_path, "/var/lib/empty.db");
    // (Required fields are required — there's no "default empty"
    //  way to construct an overlay that doesn't clobber them,
    //  because the builder requires them. The merge function
    //  guards against ZERO port and EMPTY flag list, which are
    //  the realistic cases for env-vars-not-set.)
}

// ---------------------------------------------------------------------------
// combine (TOML + env overlay)
// ---------------------------------------------------------------------------

#[test]
fn combine_env_overrides_toml() {
    let path = env::temp_dir().join("pheno_config_v020_combine.toml");
    let toml_src = r#"
url = "https://file.example.com"
port = 4040
log_level = "info"
db_path = "/var/lib/file.db"
feature_flags = ["from_file"]
"#;
    std::fs::write(&path, toml_src).expect("write");

    // Env overlay: change port, add a flag, keep the rest.
    // Uses unique prefix PREFIX_CEO so it doesn't race with other
    // combine tests running in parallel.
    let _guard = EnvGuard::set(&[
        (format!("{PREFIX_CEO}_PORT"), "9999"),
        (format!("{PREFIX_CEO}_FEATURE_FLAGS"), "from_env,shared"),
    ]);

    let cfg = combine(&path, PREFIX_CEO).expect("combine");

    // url + db_path from file (env didn't set them, so the file
    // value passes through)
    assert_eq!(cfg.url, "https://file.example.com");
    assert_eq!(cfg.db_path, "/var/lib/file.db");
    // port from env (overrides file)
    assert_eq!(cfg.port, 9999);
    // log_level: env didn't set, file had "info" (non-default),
    // so file wins
    assert_eq!(cfg.log_level, "info");
    // feature_flags: file's "from_file" comes first, env's
    // ["from_env", "shared"] are appended (deduped).
    assert_eq!(
        cfg.feature_flags,
        vec!["from_file".to_owned(), "from_env".to_owned(), "shared".to_owned()]
    );
    let _ = std::fs::remove_file(&path);
}

#[test]
fn combine_with_no_env_overrides_uses_file_values() {
    let path = env::temp_dir().join("pheno_config_v020_combine_no_env.toml");
    let toml_src = r#"
url = "https://pure.example.com"
port = 1234
log_level = "warn"
db_path = "/var/lib/pure.db"
feature_flags = ["alpha"]
"#;
    std::fs::write(&path, toml_src).expect("write");

    // No env vars set for this prefix; load_from_env_full returns
    // empty strings / 0 / []. The file values pass through
    // unchanged (env is the override layer, not the required-field
    // source). combine() therefore succeeds with file values.
    // Uses unique prefix PREFIX_CNE to prevent parallel race.
    let _guard = EnvGuard::set(&[]);
    let cfg = combine(&path, PREFIX_CNE).expect("combine should succeed");
    assert_eq!(cfg.url, "https://pure.example.com");
    assert_eq!(cfg.port, 1234);
    assert_eq!(cfg.log_level, "warn");
    assert_eq!(cfg.db_path, "/var/lib/pure.db");
    assert_eq!(cfg.feature_flags, vec!["alpha".to_owned()]);
    let _ = std::fs::remove_file(&path);
}

#[test]
fn combine_handles_file_parse_error_first() {
    let path = env::temp_dir().join("pheno_config_v020_combine_bad.toml");
    std::fs::write(&path, b"not = valid = toml [[[").expect("write");
    // Uses unique prefix PREFIX_CFP to prevent parallel race.
    let _guard = EnvGuard::set(&[]);
    let err = combine(&path, PREFIX_CFP).expect_err("should fail");
    assert!(
        matches!(err, ConfigError::ParseError { ref field, .. } if field == "<toml>"),
        "expected ParseError on <toml>, got {err:?}"
    );
    let _ = std::fs::remove_file(&path);
}

#[test]
fn load_from_env_v020_unchanged() {
    // Sanity: the v0.1.0 env API still works (regression guard).
    let prefix = "PHENO_CONFIG_V020_ENV_REGR";
    let _guard = EnvGuard::set(&[
        (format!("{prefix}_URL"), "https://reg.example.com"),
        (format!("{prefix}_DB_PATH"), "/var/lib/reg.db"),
    ]);
    let cfg = load_from_env(prefix).expect("load");
    assert_eq!(cfg.url, "https://reg.example.com");
    assert_eq!(cfg.db_path, "/var/lib/reg.db");
    assert_eq!(cfg.port, 8080);
}
