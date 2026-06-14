//! Smoke binary used by `tests/cli_test.rs` to exercise the
//! `pheno-cli-base` public API end-to-end. Built as the `cli_smoke`
//! `[[bin]]` target and discovered at test time via
//! `assert_cmd::cargo::cargo_bin("cli_smoke")`.
//!
//! The binary intentionally exposes one flag per behavior we want
//! to drive from the integration tests:
//!
//! | Flag | Effect | Exit code |
//! |---|---|---|
//! | `--name <NAME>` (required) | print `ok: <NAME>` and exit 0 | 0 |
//! | `--fail <MSG>` | return `Err(MSG)` from `run()`; the default `main` maps this to a colored stderr line and exit 1 | 1 |
//! | `--panic` | `panic!()` to trigger the panic hook | 101 (Rust's default panic exit) |
//!
//! `--name` is intentionally **required** so clap's "missing required"
//! path is distinct from the "valid args" path; that is what the
//! `parse_from_env_or_exit_exits_on_missing_required` test asserts
//! on. The `--fail` flag lets the run-time error path be exercised
//! in `error_to_stderr_message_is_colored`; the `--panic` flag lets
//! `install_panic_hook_does_not_panic_on_normal_exit` be exercised
//! without coupling the test to a specific panic-exit code (we
//! only assert "the panic-hook call did not panic on its own").

use clap::Parser;
use pheno_cli_base::{install_panic_hook, parse_from_env_or_exit, CliRunnable};

#[derive(Debug, Parser)]
#[command(
    name = "cli_smoke",
    version,
    about = "Smoke binary for pheno-cli-base integration tests. \
             Exposes flags for each CliRunnable / parse_from_env_or_exit / \
             install_panic_hook behavior we want to assert on."
)]
struct Args {
    /// Required positional-style name. Used to drive both the
    /// "valid args" test and the "missing required" test.
    #[arg(long)]
    name: String,

    /// If set, return `Err(<msg>)` from `run()`. The default
    /// `CliRunnable::main` will map this to a colored stderr line
    /// and exit code 1.
    #[arg(long)]
    fail: Option<String>,

    /// If set, panic with a fixed message. Used to verify the
    /// panic hook fires and writes the 4-line panic block to
    /// stderr.
    #[arg(long)]
    panic_now: bool,
}

impl CliRunnable for Args {
    fn run(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        if self.panic_now {
            panic!("cli_smoke: intentional panic for panic-hook test");
        }
        if let Some(msg) = &self.fail {
            return Err(msg.clone().into());
        }
        println!("ok: {}", self.name);
        Ok(())
    }
}

fn main() -> std::process::ExitCode {
    install_panic_hook();
    parse_from_env_or_exit::<Args>().main();
    std::process::ExitCode::SUCCESS
}
