//! Integration tests for the Ghostty caster.
//!
//! Each test constructs a `MockProcessRunner` with expected command sequences
//! and verifies that `GhosttyCaster` dispatches the correct `ghostty +action`
//! invocations. The caster uses a pbcopy → goto_window → paste-from-clipboard
//! flow.
//!
//! FR: FR-CAST-003

use std::io::{self, Error, ErrorKind};
use std::process::Output;

use sharecli::cast::{
    caster::{GhosttyCaster, MockProcessRunner, SendOutcome},
    Caster, PaneAddress,
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn exit_ok() -> std::process::ExitStatus {
    std::process::Command::new("true").status().unwrap()
}

// ---------------------------------------------------------------------------
// send()
// ---------------------------------------------------------------------------

#[test]
fn send_delivers_when_ghostty_ok() {
    let cmds = vec![
        ("pbcopy", &[] as &[&str]),
        ("ghostty", &["+action", "goto_window", "1"] as &[&str]),
        ("ghostty", &["+action", "paste-from-clipboard"] as &[&str]),
    ];
    let runner = MockProcessRunner::from_ok(&cmds);
    let caster = GhosttyCaster::new(runner);
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    assert_eq!(caster.send(&addr, "hello"), SendOutcome::Delivered);
}

#[test]
fn send_reports_failed_when_ghostty_missing() {
    // pbcopy succeeds but ghostty goto_window fails
    let cmds =
        vec![("pbcopy", &[] as &[&str]), ("ghostty", &["+action", "goto_window", "1"] as &[&str])];
    let outputs: Vec<io::Result<Output>> = vec![
        Ok(Output { status: exit_ok(), stdout: vec![], stderr: vec![] }),
        Err(Error::new(ErrorKind::NotFound, "ghostty not found")),
    ];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = GhosttyCaster::new(runner);
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    let outcome = caster.send(&addr, "hello");
    assert!(matches!(outcome, SendOutcome::Failed(_)));
}

#[test]
fn send_delivers_on_macos_with_pbcopy() {
    // Full flow: pbcopy, ghostty goto, ghostty paste
    let cmds = vec![
        ("pbcopy", &[] as &[&str]),
        ("ghostty", &["+action", "goto_window", "1"] as &[&str]),
        ("ghostty", &["+action", "paste-from-clipboard"] as &[&str]),
    ];
    let runner = MockProcessRunner::from_ok(&cmds);
    let caster = GhosttyCaster::new(runner);
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    assert_eq!(caster.send(&addr, "hello"), SendOutcome::Delivered);
}

#[test]
fn send_with_various_windows() {
    for window in [1u32, 5, 99] {
        let win_str = window.to_string();
        let pbcopy_args: &[&str] = &[];
        let goto_args: &[&str] = &["+action", "goto_window", &win_str];
        let paste_args: &[&str] = &["+action", "paste-from-clipboard"];
        let cmds = vec![("pbcopy", pbcopy_args), ("ghostty", goto_args), ("ghostty", paste_args)];
        let runner = MockProcessRunner::from_ok(&cmds);
        let caster = GhosttyCaster::new(runner);
        let addr = PaneAddress::parse(&format!("mbp:local:{}:0", window)).unwrap();
        assert_eq!(caster.send(&addr, &format!("text-{window}")), SendOutcome::Delivered);
    }
}

#[test]
fn send_goto_window_failure_propagates() {
    let cmds =
        vec![("pbcopy", &[] as &[&str]), ("ghostty", &["+action", "goto_window", "1"] as &[&str])];
    let outputs: Vec<io::Result<Output>> = vec![
        Ok(Output { status: exit_ok(), stdout: vec![], stderr: vec![] }),
        Err(Error::other("window not found")),
    ];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = GhosttyCaster::new(runner);
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    let outcome = caster.send(&addr, "hi");
    assert!(matches!(outcome, SendOutcome::Failed(ref m) if m.contains("window not found")));
}

#[test]
fn send_paste_failure_propagates() {
    let cmds = vec![
        ("pbcopy", &[] as &[&str]),
        ("ghostty", &["+action", "goto_window", "1"] as &[&str]),
        ("ghostty", &["+action", "paste-from-clipboard"] as &[&str]),
    ];
    let outputs: Vec<io::Result<Output>> = vec![
        Ok(Output { status: exit_ok(), stdout: vec![], stderr: vec![] }),
        Ok(Output { status: exit_ok(), stdout: vec![], stderr: vec![] }),
        Err(Error::other("paste failed")),
    ];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = GhosttyCaster::new(runner);
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    let outcome = caster.send(&addr, "hi");
    assert!(matches!(outcome, SendOutcome::Failed(ref m) if m.contains("paste failed")));
}

#[test]
fn send_pbcopy_failure_fails_early() {
    let cmds = vec![("pbcopy", &[] as &[&str])];
    let outputs: Vec<io::Result<Output>> =
        vec![Err(Error::new(ErrorKind::NotFound, "pbcopy not found"))];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = GhosttyCaster::new(runner);
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    let outcome = caster.send(&addr, "hi");
    assert!(matches!(outcome, SendOutcome::Failed(ref m) if m.contains("pbcopy failed")));
}
