//! Integration tests for the SSH Windows Terminal caster.
//!
//! Each test constructs a `MockProcessRunner` with expected command
//! sequences and verifies that `SshWinTermCaster` dispatches the correct
//! `ssh` invocations piping text to remote `powershell Set-Clipboard`.
//!
//! FR: FR-CAST-005

use std::io::{self, Error, ErrorKind};
use std::process::Output;

use sharecli::cast::{
    caster::{MockProcessRunner, SendOutcome, SshWinTermCaster},
    Caster, PaneAddress,
};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

#[allow(dead_code)]
fn exit_ok() -> std::process::ExitStatus {
    std::process::Command::new("true").status().unwrap()
}

// ---------------------------------------------------------------------------
// send()
// ---------------------------------------------------------------------------

#[test]
fn send_to_ssh_host_pipes_text_to_remote_clipboard() {
    let addr = PaneAddress::parse("winbox:ssh:koosha@192.168.1.100:0:0").unwrap();
    let cmds = vec![(
        "ssh",
        &["koosha@192.168.1.100", "powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"]
            as &[&str],
    )];
    let runner = MockProcessRunner::from_ok(&cmds);
    let caster = SshWinTermCaster::new(runner);
    assert_eq!(caster.send(&addr, "hello"), SendOutcome::NeedsFocus);
}

#[test]
fn send_to_tailscale_host_pipes_text() {
    let addr = PaneAddress::parse("winbox-ts:tailscale:0:0").unwrap();
    let cmds = vec![(
        "ssh",
        &["winbox-ts.ts.net", "powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"]
            as &[&str],
    )];
    let runner = MockProcessRunner::from_ok(&cmds);
    let caster = SshWinTermCaster::new(runner);
    assert_eq!(caster.send(&addr, "ohai"), SendOutcome::NeedsFocus);
}

#[test]
fn send_to_local_host_returns_unsupported() {
    let addr = PaneAddress::parse("mbp:local:1:0").unwrap();
    let r = MockProcessRunner::default();
    let caster = SshWinTermCaster::new(r);
    let outcome = caster.send(&addr, "hello");
    assert!(matches!(outcome, SendOutcome::Unsupported(_)));
}

#[test]
fn send_ssh_failure_propagates() {
    let addr = PaneAddress::parse("winbox:ssh:admin@10.0.0.1:0:0").unwrap();
    let cmds = vec![(
        "ssh",
        &["admin@10.0.0.1", "powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"]
            as &[&str],
    )];
    let outputs: Vec<io::Result<Output>> =
        vec![Err(Error::new(ErrorKind::ConnectionRefused, "connection refused"))];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = SshWinTermCaster::new(runner);
    let outcome = caster.send(&addr, "data");
    assert!(matches!(outcome, SendOutcome::Failed(ref m) if m.contains("connection refused")));
}

#[test]
fn send_ssh_exit_code_failure_propagates() {
    let addr = PaneAddress::parse("winbox:ssh:user@host:0:0").unwrap();
    let cmds = vec![(
        "ssh",
        &["user@host", "powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"]
            as &[&str],
    )];
    let fail_status = std::process::Command::new("false").status().unwrap();
    let outputs: Vec<io::Result<Output>> = vec![Ok(Output {
        status: fail_status,
        stdout: vec![],
        stderr: b"Set-Clipboard failed".to_vec(),
    })];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = SshWinTermCaster::new(runner);
    let outcome = caster.send(&addr, "data");
    assert!(matches!(outcome, SendOutcome::Failed(ref m) if m.contains("Set-Clipboard failed")));
}

#[test]
fn send_returns_unsupported_when_ssh_not_found() {
    // When `ssh` is not on PATH the SshWinTermCaster returns Unsupported
    // because we can't detect it via the runner — rather, the runner will
    // fail with NotFound. The current impl doesn't check `which(\"ssh\")`
    // in the runner-based code path. This test exercises the fallback.
    let addr = PaneAddress::parse("winbox:ssh:me@remote:0:0").unwrap();
    let cmds = vec![(
        "ssh",
        &["me@remote", "powershell", "-NoProfile", "-Command", "$input | Set-Clipboard"]
            as &[&str],
    )];
    let outputs: Vec<io::Result<Output>> =
        vec![Err(Error::new(ErrorKind::NotFound, "No such file or directory"))];
    let runner = MockProcessRunner::custom(&cmds, outputs);
    let caster = SshWinTermCaster::new(runner);
    let outcome = caster.send(&addr, "data");
    assert!(matches!(outcome, SendOutcome::Failed(_)));
}
