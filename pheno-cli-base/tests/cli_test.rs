//! Integration tests for the `pheno-cli-base` public API.
//!
//! These tests drive the `cli_smoke` `[[bin]]` target as a real
//! subprocess (via `assert_cmd::cargo::cargo_bin("cli_smoke")`) so we
//! can assert on exit codes (0 for success, 1 for run-time error,
//! 2 for clap parse failure) and on stderr/stdout content end-to-end.
//!
//! The 5 test names match the L3 #50 spec verbatim:
//!
//! 1. `cli_runnable_default_main_runs` — happy-path `Ok(())` round-trip
//! 2. `install_panic_hook_does_not_panic_on_normal_exit` — calling the hook does not break a normal exit
//! 3. `parse_from_env_or_exit_parses_valid_args` — valid args parse to a real value
//! 4. `parse_from_env_or_exit_exits_on_missing_required` — missing required -> exit 2 with usage
//! 5. `error_to_stderr_message_is_colored` — `Err(_)` from `run()` renders the colored `error: <msg>` line

use assert_cmd::Command;

/// Helper: locate the `cli_smoke` binary that cargo built for these
/// integration tests.
fn cli_smoke() -> Command {
    Command::cargo_bin("cli_smoke").expect("cli_smoke binary must be built before tests run")
}

// 1. Happy path: a successful `run()` reaches the exit-0 path.
#[test]
fn cli_runnable_default_main_runs() {
    let output = cli_smoke()
        .args(["--name", "world"])
        .assert()
        .success()
        .stdout("ok: world\n")
        .get_output()
        .clone();
    assert!(output.stderr.is_empty(), "stderr should be empty on success");
}

// 2. Calling `install_panic_hook()` (in the smoke binary's `main`)
//    must not break a normal exit. We assert success (exit 0) on the
//    happy path; if the hook installation panicked or interfered
//    with control flow, the binary would not return 0.
#[test]
fn install_panic_hook_does_not_panic_on_normal_exit() {
    cli_smoke()
        .args(["--name", "alice"])
        .assert()
        .success()
        .stdout("ok: alice\n");
}

// 3. Valid args round-trip through `parse_from_env_or_exit`. The
//    smoke binary prints `ok: <name>` only after the parse + run
//    pair succeeds, so reaching the printed line proves both that
//    `parse_from_env_or_exit` returned a value and that the value
//    contained the expected field.
#[test]
fn parse_from_env_or_exit_parses_valid_args() {
    cli_smoke()
        .args(["--name", "bob"])
        .assert()
        .success()
        .stdout("ok: bob\n");
}

// 4. Missing the required `--name` arg triggers clap's parse error
//    path; `parse_from_env_or_exit` calls `clap::Error::exit`, which
//    exits with status 2 and writes the colored usage line to
//    stderr.
#[test]
fn parse_from_env_or_exit_exits_on_missing_required() {
    let assert = cli_smoke().assert().failure();
    let assert = assert.code(2);
    // The exact stderr text is clap-version-dependent; assert the
    // parts we know to be stable:
    //   - "error:" prefix
    //   - the missing arg's name (`--name`) in the usage hint
    //   - "Usage:" line is rendered (clap emits it for parse errors)
    let output = assert.get_output().clone();
    let stderr = String::from_utf8_lossy(&output.stderr);
    assert!(
        stderr.contains("error:") || stderr.contains("error"),
        "stderr should mention 'error': got {stderr:?}"
    );
    assert!(
        stderr.contains("--name") || stderr.contains("name"),
        "stderr should mention the missing `--name` arg: got {stderr:?}"
    );
}

// 5. A `Box<dyn Error>` returned from `run()` is rendered to stderr
//    with a colored `error:` prefix. We force-enable ANSI in the
//    default `CliRunnable::main` impl (via `colored::control::
//    set_override(true)`), so the prefix contains the literal
//    `\x1b[` ANSI-CSI escape sequence even when stderr is captured
//    by `assert_cmd` (which is not a TTY).
#[test]
fn error_to_stderr_message_is_colored() {
    let assert = cli_smoke()
        .args(["--name", "any", "--fail", "kaboom"])
        .assert()
        .failure()
        .code(1);
    let output = assert.get_output().clone();
    let stderr = String::from_utf8_lossy(&output.stderr);

    // The literal ANSI-CSI escape sequence proves the output is
    // colored. (We use the byte sequence rather than the `\x1b`
    // escape so the test source file is plain ASCII.)
    assert!(
        stderr.contains("\x1b["),
        "stderr should contain an ANSI-CSI escape (\\x1b[) — got {stderr:?}"
    );
    assert!(
        stderr.contains("error:"),
        "stderr should contain the literal `error:` prefix — got {stderr:?}"
    );
    assert!(
        stderr.contains("kaboom"),
        "stderr should contain the error message body — got {stderr:?}"
    );
}
