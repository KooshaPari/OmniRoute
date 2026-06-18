//! `-c, --config <path>` shared arg.

use clap::Args;
use std::path::PathBuf;

/// `-c, --config <path>` arg, used by every Phenotype CLI.
///
/// The path is also read from the `PHENOTYPE_CONFIG` environment
/// variable when the flag is omitted.
///
/// Use as `#[command(flatten)] config: ConfigArg` on the top-level
/// CLI struct.
#[derive(Debug, Args, Clone, Default)]
pub struct ConfigArg {
    /// Path to the config file (YAML/TOML/JSON).
    #[arg(short, long, env = "PHENOTYPE_CONFIG", value_name = "PATH")]
    pub config: Option<PathBuf>,
}

impl ConfigArg {
    /// Returns the configured config path, if any.
    pub fn path(&self) -> Option<&Path> {
        self.config.as_deref()
    }

    /// Returns `true` if a config path was supplied (flag or env).
    pub fn is_set(&self) -> bool {
        self.config.is_some()
    }
}

// Re-export `Path` so users don't need an extra import.
pub use std::path::Path;

#[cfg(test)]
mod tests {
    use super::*;
    use clap::Parser;
    use std::sync::Mutex;

    /// Serialise tests that mutate `PHENOTYPE_CONFIG`. `std::env`
    /// functions are not thread-safe and Rust runs tests in parallel
    /// by default, so we must take this lock before touching the env.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[derive(Debug, Parser)]
    struct Wrap {
        #[command(flatten)]
        cfg: ConfigArg,
    }

    #[test]
    fn default_is_unset() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        // Best-effort cleanup so a leaked env var from a sibling
        // test does not poison this one.
        // SAFETY: serialised by ENV_LOCK above.
        unsafe {
            std::env::remove_var("PHENOTYPE_CONFIG");
        }
        let w = Wrap::parse_from(["test"]).cfg;
        assert!(!w.is_set());
        assert!(w.path().is_none());
    }

    #[test]
    fn long_flag_sets_path() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let w = Wrap::parse_from(["test", "--config", "/tmp/cfg.yaml"]).cfg;
        assert!(w.is_set());
        assert_eq!(w.path().unwrap(), std::path::Path::new("/tmp/cfg.yaml"));
    }

    #[test]
    fn short_flag_sets_path() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        let w = Wrap::parse_from(["test", "-c", "/etc/phenotype.toml"]).cfg;
        assert!(w.is_set());
        assert_eq!(w.path().unwrap(), std::path::Path::new("/etc/phenotype.toml"));
    }

    #[test]
    fn env_var_sets_path() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        // SAFETY: serialised by ENV_LOCK above.
        unsafe {
            std::env::set_var("PHENOTYPE_CONFIG", "/env/cfg.toml");
        }
        let w = Wrap::parse_from(["test"]).cfg;
        assert!(w.is_set());
        assert_eq!(w.path().unwrap(), std::path::Path::new("/env/cfg.toml"));
        // SAFETY: serialised by ENV_LOCK above.
        unsafe {
            std::env::remove_var("PHENOTYPE_CONFIG");
        }
    }
}
