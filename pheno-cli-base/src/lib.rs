//! # pheno-cli-base — canonical CLI base for the pheno-* fleet
//!
//! `pheno-cli-base` is the single dependency that every pheno-* CLI binary
//! should pull in to get the canonical 4-symbol CLI bootstrap. It
//! consolidates the boilerplate previously duplicated across every
//! fleet binary (a `clap::Parser` derive, a panic hook that prints a
//! uniform log-scrapable format, an error-to-stderr mapper, and a
//! `parse_from_env_or_exit` wrapper) into one small facade with no
//! cross-crate coupling — `Box<dyn std::error::Error + Send + Sync>`
//! is used as the run-error type so the facade does not depend on
//! the (as-yet-unmerged) `pheno-errors` crate.
//!
//! ## Quick start
//!
//! ```no_run
//! use clap::Parser;
//! use pheno_cli_base::{CliRunnable, install_panic_hook, parse_from_env_or_exit};
//!
//! #[derive(Parser, Debug)]
//! #[command(name = "my-tool", version, about = "Tiny example")]
//! struct Args {
//!     /// Optional name to greet
//!     #[arg(long, default_value = "world")]
//!     name: String,
//! }
//!
//! impl CliRunnable for Args {
//!     fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
//!         println!("hello, {}!", self.name);
//!         Ok(())
//!     }
//! }
//!
//! fn main() -> std::process::ExitCode {
//!     install_panic_hook();
//!     parse_from_env_or_exit::<Args>().main();
//!     std::process::ExitCode::SUCCESS
//! }
//! ```
//!
//! ## Symbols
//!
//! | Symbol | Purpose |
//! |---|---|
//! | [`pub use clap`] | Re-export of the `clap` crate so downstream `Cargo.toml`s only need a single `pheno-cli-base` dep to pick up the clap derive macros. |
//! | [`CliRunnable`] | Trait for the `parse -> run -> exit-code` flow. The default [`CliRunnable::main`] handles the success/failure split. |
//! | [`install_panic_hook`] | One-line panic hook installation. Prints a uniform 4-line block (prefix, location, payload, backtrace) to stderr. |
//! | [`parse_from_env_or_exit`] | Wrapper around `T::try_parse_from(env::args_os())` that prints a colored usage message and `exit(2)`s on parse failure. |
//!
//! ## Exit code contract
//!
//! | Situation | Exit code |
//! |---|---|
//! | `run()` returns `Ok(())` | `0` |
//! | `run()` returns `Err(_)` (run-time error) | `1` |
//! | `T::try_parse_from` fails (parse error) | `2` (clap convention) |
//! | panic in the process | `1` (after our panic hook prints the 4-line block) |

pub use clap;

use std::process;

use clap::Parser;
use colored::*;

/// A trait for CLI commands that follow the `parse -> run -> exit-code`
/// flow.
///
/// Implementors define a single `run` method. The default `main` method
/// provided by this trait handles the success/failure split: on
/// `Ok(())` it returns to the caller (which usually exits 0), and on
/// `Err(e)` it writes a colored `error: <e>` line to stderr and exits
/// the process with status 1.
///
/// The error type is `Box<dyn std::error::Error + Send + Sync>` so the
/// facade has no cross-crate coupling — any error that satisfies the
/// standard library's `Error` trait works. This mirrors the run-time
/// error contract that the rest of the pheno-* fleet uses.
pub trait CliRunnable {
    /// Execute the CLI. Return `Ok(())` on success, or an `Err` to
    /// signal a run-time error to the user.
    fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>>;

    /// Default driver: run, then on `Err(_)` print a colored
    /// `error: <msg>` line to stderr and exit 1. On `Ok(())` it
    /// returns to the caller (the caller is expected to exit 0, e.g.
    /// `std::process::ExitCode::SUCCESS`).
    fn main(&self) {
        // Force-enable ANSI escapes on the error stream even if stderr
        // is not a TTY (CI log scrapers prefer ANSI codes for the
        // grep-ability of `error:` / `panic:` prefix lines).
        colored::control::set_override(true);

        if let Err(e) = self.run() {
            eprintln!("{} {}", "error:".red().bold(), e);
            process::exit(1);
        }
    }
}

/// Install a panic hook that prints a uniform 4-line block to stderr:
///
/// ```text
/// panic: thread '<name>' panicked at <file>:<line>:<col>:
///   <payload>
/// stack backtrace:
///   ...
/// ```
///
/// On return, the process exits with status 1 via the default panic
/// behavior (we do not call `process::exit(1)` ourselves, so the
/// standard "abort on panic" unwind still works).
///
/// Idempotent: subsequent calls are no-ops (gated by a `Once`). This
/// lets tests call `install_panic_hook()` and then `catch_unwind`
/// around code that has already had the hook installed.
pub fn install_panic_hook() {
    use std::sync::Once;
    static INIT: Once = Once::new();
    INIT.call_once(|| {
        std::panic::set_hook(Box::new(|info| {
            // Force-enable colored output for the panic block too —
            // the same CI scraper rationale as CliRunnable::main.
            colored::control::set_override(true);

            let thread = std::thread::current()
                .name()
                .unwrap_or("<unnamed>")
                .to_string();
            let location = info
                .location()
                .map(|l| format!("{}:{}:{}", l.file(), l.line(), l.column()))
                .unwrap_or_else(|| "<unknown location>".to_string());

            let payload = if let Some(s) = info.payload().downcast_ref::<&'static str>() {
                (*s).to_string()
            } else if let Some(s) = info.payload().downcast_ref::<String>() {
                s.clone()
            } else {
                "<non-string panic payload>".to_string()
            };

            eprintln!(
                "{} thread '{}' panicked at {}:",
                "panic:".red().bold(),
                thread,
                location,
            );
            eprintln!("  {}", payload);
            eprintln!("stack backtrace:");
            eprintln!("{}", std::backtrace::Backtrace::force_capture());
        }));
    });
}

/// Parse `T` from `std::env::args_os()`, or print a colored usage
/// line to stderr and `exit(2)` on parse failure.
///
/// This is a thin wrapper around `T::try_parse_from` that delegates
/// the exit behavior to `clap::Error::exit` (which uses exit code 2
/// for parse errors and renders the colored usage line — the latter
/// is enabled via the `color` feature on `clap` in `Cargo.toml`).
///
/// # Panics
///
/// This function never returns on the error path (it terminates the
/// process). The signature is `-> T` (not `Result<T, _>`) so the
/// happy path is a single line in `main`:
///
/// ```no_run
/// # use clap::Parser;
/// # use pheno_cli_base::parse_from_env_or_exit;
/// # #[derive(Parser)] struct Args;
/// let _args: Args = parse_from_env_or_exit();
/// ```
pub fn parse_from_env_or_exit<T: Parser>() -> T {
    match T::try_parse_from(std::env::args_os()) {
        Ok(t) => t,
        Err(e) => {
            // clap's `Error::exit` writes a colored usage line to
            // stderr and calls `process::exit(2)`. This is the
            // standard "exit code 2 on parse error" behavior.
            e.exit()
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    /// `CliRunnable::main` returns to the caller on `Ok(())` (does not
    /// call `process::exit`). The caller is expected to translate
    /// "returned to me" into exit 0.
    #[test]
    fn cli_runnable_main_returns_on_ok_unit() {
        struct OkCmd;
        impl CliRunnable for OkCmd {
            fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
                Ok(())
            }
        }
        let cmd = OkCmd;
        // No panic / no exit: control returns here.
        cmd.main();
    }

    /// `error_to_stderr_message_is_colored`-shaped unit test: the
    /// rendered prefix contains the literal `error:` token. The
    /// color-Escape character (`\x1b[`) is hard to assert on
    /// portably (depends on whether `colored` decides to emit
    /// escapes when the test stdout/stderr is not a TTY), so we
    /// only assert the message body. The `tests/cli_test.rs`
    /// integration test asserts the colored binary stream end-to-end.
    #[test]
    fn error_render_includes_message_body() {
        // Construct a render using the same `colored::*` builders the
        // default `main` impl uses. We do not invoke `main` itself
        // because that would call `process::exit(1)` and tear down
        // the test process.
        let prefix = format!("{} {}", "error:".red().bold(), "boom");
        assert!(prefix.contains("error:"));
        assert!(prefix.contains("boom"));
    }

    /// `parse_from_env_or_exit` does not exist as a unit test in
    /// `lib.rs` because it either returns a `T` or calls
    /// `process::exit` — both of which are awkward to assert on
    /// in-process. The integration tests in `tests/cli_test.rs`
    /// cover the happy path (subprocess returns 0) and the parse-
    /// failure path (subprocess returns 2 with colored usage on
    /// stderr) by driving a real binary.
    #[test]
    fn install_panic_hook_is_idempotent() {
        // Calling twice must not panic or double-install the hook.
        install_panic_hook();
        install_panic_hook();
    }
}
