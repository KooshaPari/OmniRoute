//! Supervising the OmniRoute server process.
//!
//! The shell owns the server: it spawns the child with the packs' `NODE_PATH`,
//! reports readiness from the outside (a TCP probe of the origin) and stops the
//! child on request and on app exit.
//!
//! Plain `std` on purpose — no Tauri types — so process handling can be
//! unit-tested without an app handle.

use std::{
    fs::OpenOptions,
    path::{Path, PathBuf},
    process::{Child, Command, Stdio},
    time::{Duration, Instant},
};

use crate::{origin, server_paths::ResolvedNode};

/// How long `terminate` waits after the graceful signal before escalating.
pub const STOP_GRACE: Duration = Duration::from_millis(2500);
/// Upper bound on waiting for the child to disappear after the kill signal.
const REAP_TIMEOUT: Duration = Duration::from_secs(5);
/// Poll interval while waiting for a child to exit.
const POLL_INTERVAL: Duration = Duration::from_millis(50);

/// Everything needed to start one supervised server process.
#[derive(Debug, Clone)]
pub struct LaunchPlan {
    pub node: ResolvedNode,
    pub server_entry: PathBuf,
    pub working_dir: PathBuf,
    pub data_dir: PathBuf,
    pub origin: String,
    pub node_path: String,
    pub node_options: Option<String>,
    pub log_file: PathBuf,
}

/// Owns the supervised server process.
#[derive(Default)]
pub struct Supervisor {
    child: Option<Child>,
    pid: Option<u32>,
}

impl Supervisor {
    pub fn is_running(&self) -> bool {
        self.child.is_some()
    }

    pub fn pid(&self) -> Option<u32> {
        self.pid
    }

    /// Start the server described by `plan`.
    ///
    /// Output goes to `plan.log_file` rather than a pipe: an unread pipe would
    /// block the child once the 64 KiB buffer fills, and the log is what support
    /// asks for when the server will not come up.
    pub fn spawn(&mut self, plan: &LaunchPlan) -> Result<u32, String> {
        if self.child.is_some() {
            return Err("the OmniRoute server is already supervised".to_string());
        }

        let port = origin::port_from_origin(&plan.origin);
        let mut command = Command::new(&plan.node.program);
        command
            .arg(&plan.server_entry)
            .current_dir(&plan.working_dir)
            .env("DATA_DIR", &plan.data_dir)
            .env("PORT", port.to_string())
            // Next's standalone entry binds `process.env.HOSTNAME || 0.0.0.0`;
            // Windows always exports HOSTNAME as the machine name, which would
            // make the server unreachable on loopback. Pin it.
            .env("HOSTNAME", "127.0.0.1")
            .env("NODE_ENV", "production")
            .env("NODE_PATH", &plan.node_path)
            .stdin(Stdio::null());

        if let Some(node_options) = &plan.node_options {
            command.env("NODE_OPTIONS", node_options);
        }

        let (stdout, stderr) = redirect_to_log(&plan.log_file);
        command.stdout(stdout).stderr(stderr);

        // Own process group, so the whole server tree (the wrapper may spawn
        // helpers) can be signalled as one unit on stop.
        #[cfg(unix)]
        {
            use std::os::unix::process::CommandExt;
            command.process_group(0);
        }
        #[cfg(windows)]
        {
            use std::os::windows::process::CommandExt;
            const CREATE_NO_WINDOW: u32 = 0x0800_0000;
            command.creation_flags(CREATE_NO_WINDOW);
        }

        let child = command.spawn().map_err(|error| {
            format!(
                "failed to start the OmniRoute server: `{}` ({}): {error}",
                plan.node.program.display(),
                plan.node.source.label()
            )
        })?;
        let pid = child.id();
        self.child = Some(child);
        self.pid = Some(pid);
        Ok(pid)
    }

    /// Reap the child if it exited on its own.
    ///
    /// Returns a description of how it ended, or `None` while it is still alive
    /// (or when no child is supervised).
    pub fn reap(&mut self) -> Option<String> {
        let outcome = self.child.as_mut()?.try_wait();
        match outcome {
            Ok(None) => None,
            Ok(Some(status)) => {
                self.child = None;
                self.pid = None;
                Some(format!("server process exited with {status}"))
            }
            Err(error) => {
                self.child = None;
                self.pid = None;
                Some(format!("could not query the server process: {error}"))
            }
        }
    }

    /// Stop the child: graceful signal first, escalate after `grace`.
    ///
    /// Idempotent — with no child supervised it reports success and does nothing.
    /// A failed termination still clears the handle, rather than leaving the
    /// shell believing it supervises something it cannot reach.
    pub fn terminate(&mut self, grace: Duration) -> Result<Option<String>, String> {
        let Some(mut child) = self.child.take() else {
            self.pid = None;
            return Ok(None);
        };
        let pid = child.id();

        signal_terminate(&mut child, pid);

        match wait_for_exit(&mut child, grace) {
            Ok(Some(status)) => {
                self.pid = None;
                return Ok(Some(format!("server stopped (exited with {status})")));
            }
            Ok(None) => {}
            Err(error) => {
                self.pid = None;
                return Err(format!("could not query the server process: {error}"));
            }
        }

        signal_kill(&mut child, pid);

        match wait_for_exit(&mut child, REAP_TIMEOUT) {
            Ok(Some(status)) => {
                self.pid = None;
                Ok(Some(format!(
                    "server did not stop within {grace:?}; killed it (exited with {status})"
                )))
            }
            Ok(None) => {
                self.pid = None;
                Err(format!(
                    "server process {pid} is still alive {REAP_TIMEOUT:?} after being killed"
                ))
            }
            Err(error) => {
                self.pid = None;
                Err(format!("could not query the server process: {error}"))
            }
        }
    }
}

/// `Ok(Some(status))` when the child exited, `Ok(None)` when it is still running.
type ExitOutcome = Result<Option<std::process::ExitStatus>, String>;

/// Wait up to `timeout` for the child to exit; `Ok(None)` means still running.
fn wait_for_exit(child: &mut Child, timeout: Duration) -> ExitOutcome {
    let deadline = Instant::now() + timeout;
    loop {
        match child.try_wait() {
            Ok(Some(status)) => return Ok(Some(status)),
            Ok(None) => {}
            Err(error) => return Err(error.to_string()),
        }
        if Instant::now() >= deadline {
            return Ok(None);
        }
        std::thread::sleep(POLL_INTERVAL);
    }
}

fn redirect_to_log(log_file: &Path) -> (Stdio, Stdio) {
    if let Some(parent) = log_file.parent() {
        let _ = std::fs::create_dir_all(parent);
    }
    match OpenOptions::new().create(true).append(true).open(log_file) {
        Ok(file) => match file.try_clone() {
            Ok(clone) => (Stdio::from(file), Stdio::from(clone)),
            Err(_) => (Stdio::null(), Stdio::null()),
        },
        Err(_) => (Stdio::null(), Stdio::null()),
    }
}

/// Ask the child (and its process group, on unix) to shut down gracefully.
#[cfg(unix)]
fn signal_terminate(_child: &mut Child, pid: u32) {
    signal_group(pid, libc::SIGTERM);
}

#[cfg(windows)]
fn signal_terminate(child: &mut Child, _pid: u32) {
    // Windows has no SIGTERM; `Child::kill` is the termination path there, and
    // there is no process-group equivalent to signal instead.
    let _ = child.kill();
}

/// Insist on termination.
#[cfg(unix)]
fn signal_kill(child: &mut Child, pid: u32) {
    signal_group(pid, libc::SIGKILL);
    // No-op when the group signal already landed; covers a child that left its
    // process group.
    let _ = child.kill();
}

#[cfg(windows)]
fn signal_kill(child: &mut Child, _pid: u32) {
    let _ = child.kill();
}

/// Send `signal` to the child's process group — the group `spawn` created with
/// `process_group(0)`, so descendants are signalled too.
#[cfg(unix)]
fn signal_group(pid: u32, signal: i32) {
    // SAFETY: `kill(2)` with a negated pid addresses the process group whose id
    // equals the child pid this shell spawned. No memory is read or written, and
    // an error (process already gone) is intentionally ignored.
    unsafe {
        libc::kill(-(pid as i32), signal);
    }
}

#[cfg(test)]
mod tests;
