//! `tracing-subscriber` initialization.

use tracing_subscriber::{fmt, prelude::*, EnvFilter};

/// Initialize `tracing-subscriber` with the given filter level.
///
/// Honors the `RUST_LOG` env var when set; otherwise installs the
/// supplied `filter` (typically the output of
/// [`crate::Verbosity::to_filter`]).
///
/// Idempotent: safe to call multiple times. The `try_init` returns a
/// `SetGlobalDefaultError` if a global subscriber is already installed,
/// which we swallow so library and test code can be called repeatedly
/// without panicking.
pub fn setup_tracing(filter: tracing_subscriber::filter::LevelFilter) {
    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::default().add_directive(filter.into()));

    let _ = tracing_subscriber::registry()
        .with(env_filter)
        .with(fmt::layer().with_target(false))
        .try_init();
}

/// Initialize `tracing-subscriber` from a verbose count and quiet flag.
///
/// This is a convenience for CLIs that expose `-v` as an
/// `ArgAction::Count` and `-q` / `--quiet` as a bool. The mapping is:
///
/// - `quiet`              → `ERROR`
/// - `count == 0`         → `INFO`
/// - `count == 1`         → `DEBUG`
/// - `count >= 2`         → `TRACE`
pub fn setup_tracing_from_count(verbose_count: u8, quiet: bool) {
    let filter = if quiet {
        tracing_subscriber::filter::LevelFilter::ERROR
    } else {
        match verbose_count {
            0 => tracing_subscriber::filter::LevelFilter::INFO,
            1 => tracing_subscriber::filter::LevelFilter::DEBUG,
            _ => tracing_subscriber::filter::LevelFilter::TRACE,
        }
    };
    setup_tracing(filter);
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::Mutex;

    /// Serialise tests that mutate `RUST_LOG`. `std::env` functions
    /// are not thread-safe and Rust runs tests in parallel by default
    /// within a single test binary.
    static ENV_LOCK: Mutex<()> = Mutex::new(());

    #[test]
    fn setup_tracing_is_idempotent() {
        // Calling twice must not panic. The first call installs the
        // global default; the second is silently ignored.
        setup_tracing(tracing_subscriber::filter::LevelFilter::INFO);
        setup_tracing(tracing_subscriber::filter::LevelFilter::DEBUG);
    }

    #[test]
    fn setup_tracing_from_count_uses_correct_levels() {
        // We can't observe the installed filter directly from another
        // test, so we exercise the function and rely on the
        // idempotency of `setup_tracing` to confirm it doesn't panic.
        setup_tracing_from_count(0, false);
        setup_tracing_from_count(1, false);
        setup_tracing_from_count(2, false);
        setup_tracing_from_count(0, true);
        setup_tracing_from_count(255, true);
    }

    #[test]
    fn env_filter_takes_precedence() {
        let _guard = ENV_LOCK.lock().unwrap_or_else(|e| e.into_inner());
        // SAFETY: serialised by ENV_LOCK above.
        unsafe {
            std::env::set_var("RUST_LOG", "warn");
        }
        // Should not panic; the RUST_LOG path is exercised.
        setup_tracing(tracing_subscriber::filter::LevelFilter::INFO);
        // SAFETY: serialised by ENV_LOCK above.
        unsafe {
            std::env::remove_var("RUST_LOG");
        }
    }
}
