//! Tests for the wezterm caster (Task 4 of the cast backlog).
//!
//! The wezterm caster shells out to `wezterm cli` twice:
//!   1. `wezterm cli list --format json` to resolve `(window, pane) -> pane_id`
//!   2. `wezterm cli send-text --pane-id <id> --no-paste <text>` to deliver
//!
//! To test this without actually invoking `wezterm`, the caster accepts an
//! injectable `ProcessRunner`. Tests use a `MockProcessRunner` that records
//! invocations and returns canned outputs.

use std::collections::VecDeque;
use std::io;
use std::process::Output;
use std::sync::{Arc, Mutex};

use sharecli::cast::{Caster, PaneAddress, ProcessRunner, WeztermCaster};

#[derive(Clone, Debug)]
struct Invocation {
    bin: String,
    args: Vec<String>,
}

#[derive(Clone, Default)]
struct MockProcessRunner {
    invocations: Arc<Mutex<Vec<Invocation>>>,
    /// Returned verbatim in order — one per invocation. If exhausted, returns
    /// a generic failure result.
    responses: Arc<Mutex<VecDeque<io::Result<Output>>>>,
}

impl MockProcessRunner {
    fn new(responses: Vec<io::Result<Output>>) -> Self {
        Self {
            invocations: Arc::default(),
            responses: Arc::new(Mutex::new(responses.into_iter().collect())),
        }
    }
    fn invocations(&self) -> Vec<Invocation> {
        self.invocations.lock().unwrap().clone()
    }
}

impl ProcessRunner for MockProcessRunner {
    fn run(&self, bin: &str, args: &[&str]) -> io::Result<Output> {
        self.invocations.lock().unwrap().push(Invocation {
            bin: bin.to_string(),
            args: args.iter().map(|s| s.to_string()).collect(),
        });
        // Pop the next queued response or return a sentinel failure.
        self.responses
            .lock()
            .unwrap()
            .pop_front()
            .unwrap_or_else(|| {
                Err(io::Error::new(
                    io::ErrorKind::UnexpectedEof,
                    "MockProcessRunner out of queued responses",
                ))
            })
    }

    fn run_with_stdin(&self, bin: &str, args: &[&str], _stdin: &[u8]) -> io::Result<Output> {
        // Delegate to run — stdin content is not inspected in mock tests.
        self.run(bin, args)
    }
}

fn ok_output(stdout: &str) -> io::Result<Output> {
    Ok(Output {
        status: exit_status(0),
        stdout: stdout.as_bytes().to_vec(),
        stderr: Vec::new(),
    })
}

#[cfg(unix)]
fn exit_status(code: i32) -> std::process::ExitStatus {
    use std::os::unix::process::ExitStatusExt;
    std::process::ExitStatus::from_raw(code)
}

#[cfg(not(unix))]
fn exit_status(code: i32) -> std::process::ExitStatus {
    // On non-unix platforms we cannot fabricate an arbitrary exit code via the
    // std API. The wezterm caster is unix-only in practice (it shells out to
    // `wezterm cli`); these tests still need to compile and pass on windows so
    // we degrade to a process that simply did not succeed.
    let _ = code;
    // Best-effort: build via std::process::Command so the exit code is real,
    // but the surrounding test only cares about success()/failure().
    std::process::Command::new("cmd")
        .args(["/C", "exit", &code.to_string()])
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .status()
        .unwrap_or_else(|_| std::process::ExitStatus::default())
}

fn ok_output_with_status(status: i32, stdout: &str, stderr: &str) -> io::Result<Output> {
    Ok(Output {
        status: exit_status(status),
        stdout: stdout.as_bytes().to_vec(),
        stderr: stderr.as_bytes().to_vec(),
    })
}

/// `wezterm cli list --format json` returns one JSON object per pane.
/// Fixture: 3 panes across 2 windows.
const SAMPLE_LIST: &str = r#"
[
  {"window_id": 1, "tab_id": 11, "pane_id": 101, "title": "build"},
  {"window_id": 1, "tab_id": 12, "pane_id": 102, "title": "test"},
  {"window_id": 2, "tab_id": 21, "pane_id": 201, "title": "shell"}
]
"#;

// -------------------------------------------------------------------------
// resolve_pane_id
// -------------------------------------------------------------------------

#[test]
fn fr_cast_004_resolves_pane_id_from_json_list() {
    // Arrange: a mock that returns the 3-pane sample on first call.
    let runner = MockProcessRunner::new(vec![ok_output(SAMPLE_LIST)]);
    let caster = WeztermCaster::new(runner.clone());

    // Act: resolve window=1 pane=1 → pane_id 102.
    let addr = PaneAddress::parse("mbp:local:1:1").expect("addr");
    let resolved = caster.resolve_pane_id(&addr).expect("ok");

    // Assert.
    assert_eq!(resolved, Some(102));
    let calls = runner.invocations();
    assert_eq!(calls.len(), 1);
    assert_eq!(calls[0].bin, "wezterm");
    assert_eq!(calls[0].args, vec!["cli", "list", "--format", "json"]);
}

#[test]
fn fr_cast_004_returns_none_when_window_pane_not_found() {
    // Arrange: list returns 2 panes, address asks for window=99 pane=99.
    let runner = MockProcessRunner::new(vec![ok_output(SAMPLE_LIST)]);
    let caster = WeztermCaster::new(runner);

    // Act.
    let addr = PaneAddress::parse("mbp:local:99:99").expect("addr");
    let resolved = caster.resolve_pane_id(&addr).expect("ok");

    // Assert.
    assert_eq!(resolved, None);
}

#[test]
fn fr_cast_004_returns_none_when_window_matches_but_pane_does_not() {
    // Arrange.
    let runner = MockProcessRunner::new(vec![ok_output(SAMPLE_LIST)]);
    let caster = WeztermCaster::new(runner);

    // Act: window=1 exists, pane=42 doesn't.
    let addr = PaneAddress::parse("mbp:local:1:42").expect("addr");
    let resolved = caster.resolve_pane_id(&addr).expect("ok");

    // Assert.
    assert_eq!(resolved, None);
}

#[test]
fn fr_cast_004_propagates_when_list_exits_non_zero() {
    // Arrange: wezterm cli list fails (e.g. daemon not running).
    let runner = MockProcessRunner::new(vec![ok_output_with_status(
        1, "", "no wezterm running",
    )]);
    let caster = WeztermCaster::new(runner);

    // Act.
    let addr = PaneAddress::parse("mbp:local:0:0").expect("addr");
    let result = caster.resolve_pane_id(&addr);

    // Assert: error propagates rather than silently returning None.
    assert!(result.is_err(), "expected error, got {:?}", result);
}

#[test]
fn fr_cast_004_handles_non_json_stdout_gracefully() {
    // Arrange: stdout is not valid JSON.
    let runner = MockProcessRunner::new(vec![ok_output("not-json-at-all")]);
    let caster = WeztermCaster::new(runner);

    // Act.
    let addr = PaneAddress::parse("mbp:local:0:0").expect("addr");
    let result = caster.resolve_pane_id(&addr);

    // Assert: returns Ok(None) so callers can fall through to next caster.
    assert!(matches!(result, Ok(None)));
}

// -------------------------------------------------------------------------
// send
// -------------------------------------------------------------------------

#[test]
fn fr_cast_004_send_delivers_when_pane_resolves() {
    // Arrange: 2 responses — list returns sample, send returns success.
    let runner = MockProcessRunner::new(vec![
        ok_output(SAMPLE_LIST),
        ok_output_with_status(0, "", ""),
    ]);
    let caster = WeztermCaster::new(runner.clone());

    // Act.
    let addr = PaneAddress::parse("mbp:local:2:0").expect("addr");
    let outcome = caster.send(&addr, "echo hi\n");

    // Assert: Delivered, and both calls were recorded correctly.
    assert!(matches!(outcome, sharecli::cast::SendOutcome::Delivered));
    let calls = runner.invocations();
    assert_eq!(calls.len(), 2);
    assert_eq!(calls[0].args, vec!["cli", "list", "--format", "json"]);
    // send-text + --pane-id + numeric id + --no-paste + text
    assert_eq!(calls[1].args[0], "cli");
    assert_eq!(calls[1].args[1], "send-text");
    assert_eq!(calls[1].args[2], "--pane-id");
    assert_eq!(calls[1].args[3], "201"); // window 2, pane 0 → pane_id 201
    assert_eq!(calls[1].args[4], "--no-paste");
    assert_eq!(calls[1].args[5], "echo hi\n");
}

#[test]
fn fr_cast_004_send_returns_failed_when_send_text_exits_non_zero() {
    // Arrange.
    let runner = MockProcessRunner::new(vec![
        ok_output(SAMPLE_LIST),
        ok_output_with_status(1, "", "pane not found"),
    ]);
    let caster = WeztermCaster::new(runner);

    // Act.
    let addr = PaneAddress::parse("mbp:local:1:0").expect("addr");
    let outcome = caster.send(&addr, "ls");

    // Assert.
    match outcome {
        sharecli::cast::SendOutcome::Failed(msg) => {
            assert!(msg.contains("pane not found"), "msg = {msg}");
        }
        other => panic!("expected Failed, got {:?}", other),
    }
}

#[test]
fn fr_cast_004_send_returns_failed_when_pane_not_resolved() {
    // Arrange: list returns sample but address doesn't match.
    let runner = MockProcessRunner::new(vec![ok_output(SAMPLE_LIST)]);
    let caster = WeztermCaster::new(runner);

    // Act.
    let addr = PaneAddress::parse("mbp:local:99:99").expect("addr");
    let outcome = caster.send(&addr, "ls");

    // Assert: no send-text call happens; Failed with explanatory message.
    assert!(matches!(outcome, sharecli::cast::SendOutcome::Failed(_)));
}

#[test]
fn fr_cast_004_caster_name_is_wezterm() {
    // Arrange.
    let runner = MockProcessRunner::new(Vec::new());
    let caster = WeztermCaster::new(runner);

    // Act + Assert.
    assert_eq!(caster.name(), "wezterm");
}
