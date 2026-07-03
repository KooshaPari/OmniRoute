//! Caster abstraction — sends text to a registered pane.
//!
//! A `Caster` is the runtime side of a `PaneAddress` lookup. Given a
//! resolved `PaneAddress`, it knows how to ship text to the right
//! terminal pane on the right machine.
//!
//! FR: FR-CAST-003, FR-CAST-004, FR-CAST-005, FR-CAST-007

use std::io;
use std::process::{Command, Output};
use std::time::Duration;

use anyhow::{anyhow, Result};
use serde::Deserialize;

use super::address::PaneAddress;

/// Outcome of a send — distinguishes the failure modes the caller cares about.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum SendOutcome {
    /// Text was delivered to the pane.
    Delivered,
    /// Cast is supported but the pane is not focusable (e.g. occluded).
    NeedsFocus,
    /// Cast is not supported in this environment; user must copy manually.
    Unsupported(String),
    /// Cast failed for an unexpected reason (network, race, etc.).
    Failed(String),
}

/// Pluggable transport — `wezterm`, `ghostty`, `wt`, or `clipboard`.
pub trait Caster: Send + Sync {
    /// Human-readable name (used in error messages and `--caster` flag).
    fn name(&self) -> &'static str;

    /// Resolve the pane ID for a `PaneAddress` on the current host.
    /// Returns `None` if the pane is not visible to this caster.
    fn resolve_pane_id(&self, addr: &PaneAddress) -> Result<Option<u32>>;

    /// Ship `text` to the pane.
    fn send(&self, addr: &PaneAddress, text: &str) -> SendOutcome;
}

/// Probe for an executable on `PATH`. Returns the resolved path or `None`.
pub fn which(bin: &str) -> Option<std::path::PathBuf> {
    let exts: &[&str] = if cfg!(windows) { &["", ".exe", ".cmd", ".bat"] } else { &[""] };
    let paths = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&paths) {
        for ext in exts {
            let candidate = dir.join(format!("{}{}", bin, ext));
            if candidate.is_file() {
                return Some(candidate);
            }
        }
    }
    None
}

/// Pluggable process-spawning strategy. Real production uses `SystemRunner`;
/// tests inject `MockProcessRunner` to assert command shape without actually
/// shelling out.
pub trait ProcessRunner: Send + Sync {
    fn run(&self, bin: &str, args: &[&str]) -> io::Result<Output>;
}

/// Default `ProcessRunner` — invokes a real subprocess.
#[derive(Clone, Copy, Debug, Default)]
pub struct SystemRunner;

impl ProcessRunner for SystemRunner {
    fn run(&self, bin: &str, args: &[&str]) -> io::Result<Output> {
        Command::new(bin).args(args).output()
    }
}

/// Caster that uses Ghostty's `+action` subcommands.
///
/// Ghostty does not expose a rich IPC API like wezterm. This caster works by:
///
/// 1. Focusing the target window via `ghostty +action goto_window <n>`.
/// 2. Sending text via `ghostty +action text "..."` (types into the focused surface).
///
/// Window index comes from `PaneAddress.window` (1-indexed).
///
/// Limitations:
/// - Cannot target a split by index (Ghostty only supports directional `goto_split`).
/// - Changes focus — the user sees the window jump to foreground briefly.
/// - Only works on macOS (Ghostty is macOS-first; Linux support is partial).
#[derive(Clone, Debug)]
pub struct GhosttyCaster<R: ProcessRunner = SystemRunner> {
    runner: R,
}

impl GhosttyCaster<SystemRunner> {
    /// Default constructor — uses real subprocess execution.
    pub fn system() -> Self {
        Self { runner: SystemRunner }
    }
}

impl<R: ProcessRunner> GhosttyCaster<R> {
    pub fn new(runner: R) -> Self {
        Self { runner }
    }
}

impl<R: ProcessRunner> Caster for GhosttyCaster<R> {
    fn name(&self) -> &'static str {
        "ghostty"
    }

    fn resolve_pane_id(&self, _addr: &PaneAddress) -> Result<Option<u32>> {
        // Ghostty doesn't expose pane IDs. We can't resolve; the send path
        // focuses by window index directly.
        Ok(None)
    }

    fn send(&self, addr: &PaneAddress, text: &str) -> SendOutcome {
        // Ghostty is only available on macOS (and partially on Linux).
        // If the `ghostty` binary is not on PATH, report unsupported
        // so the fallback chain can continue.
        if which("ghostty").is_none() {
            return SendOutcome::Unsupported("ghostty binary not on PATH".into());
        }

        // Step 1: focus the target window (1-indexed).
        let win_idx = addr.window.to_string();
        if let Err(e) = self.runner.run("ghostty", &["+action", "goto_window", &win_idx]) {
            return SendOutcome::Failed(format!("ghostty goto_window failed: {}", e));
        }

        // Step 2: send the text (types into the now-focused surface).
        // `text` may contain newlines; `ghostty +action text` accepts them.
        match self.runner.run("ghostty", &["+action", "text", text]) {
            Ok(o) if o.status.success() => SendOutcome::Delivered,
            Ok(o) => SendOutcome::Failed(format!(
                "ghostty text exited {}: {}",
                o.status,
                String::from_utf8_lossy(&o.stderr)
            )),
            Err(e) => SendOutcome::Failed(format!("ghostty text spawn failed: {}", e)),
        }
    }
}

/// Retry wrapper — wraps any [`Caster`] and automatically retries on
/// [`SendOutcome::Failed`] with exponential backoff.
///
/// Does NOT retry on [`SendOutcome::NeedsFocus`] or [`SendOutcome::Unsupported`] —
/// those outcomes represent situations where retrying will not help.
pub struct RetryCaster<C: Caster> {
    inner: C,
    max_attempts: usize,
    base_delay_ms: u64,
}

impl<C: Caster> RetryCaster<C> {
    pub fn new(inner: C, max_attempts: usize, base_delay_ms: u64) -> Self {
        Self { inner, max_attempts, base_delay_ms }
    }
}

impl<C: Caster> Caster for RetryCaster<C> {
    fn name(&self) -> &'static str {
        // Reuse the inner caster's name, prefixed.
        self.inner.name()
    }

    fn resolve_pane_id(&self, addr: &PaneAddress) -> Result<Option<u32>> {
        // No retry logic for resolution — it's read-only and fast.
        self.inner.resolve_pane_id(addr)
    }

    fn send(&self, addr: &PaneAddress, text: &str) -> SendOutcome {
        let mut last_err = None;
        for attempt in 1..=self.max_attempts {
            let outcome = self.inner.send(addr, text);
            match &outcome {
                SendOutcome::Delivered | SendOutcome::NeedsFocus => return outcome,
                SendOutcome::Unsupported(_) => return outcome,
                SendOutcome::Failed(_e) => {
                    last_err = Some(outcome);
                    if attempt < self.max_attempts {
                        let delay = self.base_delay_ms * (1u64 << (attempt - 1)); // exponential
                        std::thread::sleep(Duration::from_millis(delay));
                    }
                }
            }
        }
        last_err.unwrap_or_else(|| {
            SendOutcome::Failed("retry exhausted without recorded error".into())
        })
    }
}

/// One row of `wezterm cli list --format json` output. The CLI emits more
/// fields than this; we deserialize only the ones we need.
#[derive(Debug, Deserialize)]
struct WeztermPane {
    window_id: u32,
    pane_id: u32,
}

/// Cast through the `wezterm` CLI (`wezterm cli send-text`).
///
/// The wezterm command line is the only terminal that ships a real
/// inter-process control surface today. This caster shells out to
/// `wezterm cli list` to resolve window:pane → numeric pane id, then
/// `wezterm cli send-text --pane-id <id> <text>` to deliver.
///
/// Parameterised over [`ProcessRunner`] so unit tests can swap in a mock
/// and assert against the exact argv constructed — no wezterm binary
/// required in CI.
pub struct WeztermCaster<R: ProcessRunner = SystemRunner> {
    runner: R,
}

impl WeztermCaster<SystemRunner> {
    /// Default constructor — uses real subprocess execution.
    pub fn system() -> Self {
        Self { runner: SystemRunner }
    }
}

impl<R: ProcessRunner> WeztermCaster<R> {
    /// Construct with a custom process runner (used by tests).
    pub fn new(runner: R) -> Self {
        Self { runner }
    }
}

impl<R: ProcessRunner> Caster for WeztermCaster<R> {
    fn name(&self) -> &'static str {
        "wezterm"
    }

    fn resolve_pane_id(&self, addr: &PaneAddress) -> Result<Option<u32>> {
        let output = self
            .runner
            .run("wezterm", &["cli", "list", "--format", "json"])
            .map_err(|e| anyhow!("wezterm cli list failed to spawn: {}", e))?;
        if !output.status.success() {
            return Err(anyhow!(
                "wezterm cli list exited {}: {}",
                output.status,
                String::from_utf8_lossy(&output.stderr)
            ));
        }
        let body = String::from_utf8_lossy(&output.stdout);
        // `window` in PaneAddress is 1-indexed and maps directly to wezterm's
        // window_id.  `pane` is 0-indexed — the Nth pane within that window.
        let want_window = addr.window;
        let want_pane_idx = addr.pane as usize;
        let panes: Vec<WeztermPane> = match serde_json::from_str(&body) {
            Ok(v) => v,
            Err(_) => return Ok(None), // non-JSON or empty: degrade
        };
        let mut matching: Vec<WeztermPane> = panes
            .into_iter()
            .filter(|p| p.window_id == want_window)
            .collect();
        matching.sort_by_key(|p| p.pane_id);
        Ok(matching.into_iter().nth(want_pane_idx).map(|p| p.pane_id))
    }

    fn send(&self, addr: &PaneAddress, text: &str) -> SendOutcome {
        let pane_id = match self.resolve_pane_id(addr) {
            Ok(Some(id)) => id,
            Ok(None) => {
                return SendOutcome::Failed(format!(
                    "no wezterm pane matching window:{} pane:{}",
                    addr.window, addr.pane
                ));
            }
            Err(e) => return SendOutcome::Failed(e.to_string()),
        };
        let id_str = pane_id.to_string();
        match self.runner.run(
            "wezterm",
            &[
                "cli",
                "send-text",
                "--pane-id",
                &id_str,
                "--no-paste",
                text,
            ],
        ) {
            Ok(o) if o.status.success() => SendOutcome::Delivered,
            Ok(o) => SendOutcome::Failed(format!(
                "wezterm cli send-text exited {}: {}",
                o.status,
                String::from_utf8_lossy(&o.stderr)
            )),
            Err(e) => SendOutcome::Failed(e.to_string()),
        }
    }
}

/// Cast via the system clipboard (last-resort fallback). Always works,
/// but the user has to paste manually.
pub struct ClipboardCaster;

impl Caster for ClipboardCaster {
    fn name(&self) -> &'static str {
        "clipboard"
    }

    fn resolve_pane_id(&self, _addr: &PaneAddress) -> Result<Option<u32>> {
        Ok(None)
    }

    fn send(&self, _addr: &PaneAddress, text: &str) -> SendOutcome {
        let (bin, args): (&str, Vec<&str>) = if cfg!(target_os = "macos") {
            ("pbcopy", vec![])
        } else if cfg!(target_os = "windows") {
            ("clip", vec![])
        } else {
            match which("wl-copy") {
                Some(_) => ("wl-copy", vec![]),
                None => match which("xclip") {
                    Some(_) => ("xclip", vec!["-selection", "clipboard"]),
                    None => {
                        return SendOutcome::Unsupported(
                            "no clipboard binary (pbcopy/clip/wl-copy/xclip) on PATH".into(),
                        );
                    }
                },
            }
        };
        use std::io::Write;
        use std::process::Stdio;
        let mut child = match Command::new(bin)
            .args(&args)
            .stdin(Stdio::piped())
            .stdout(Stdio::null())
            .stderr(Stdio::piped())
            .spawn()
        {
            Ok(c) => c,
            Err(e) => return SendOutcome::Failed(e.to_string()),
        };
        if let Some(mut stdin) = child.stdin.take() {
            if let Err(e) = stdin.write_all(text.as_bytes()) {
                return SendOutcome::Failed(format!("clipboard write failed: {}", e));
            }
        }
        match child.wait_with_output() {
            Ok(o) if o.status.success() => SendOutcome::Delivered,
            Ok(o) => SendOutcome::Failed(format!(
                "{} exited {}: {}",
                bin,
                o.status,
                String::from_utf8_lossy(&o.stderr)
            )),
            Err(e) => SendOutcome::Failed(e.to_string()),
        }
    }
}

/// Caster chain — try each in order; return the first non-`Unsupported` outcome.
/// Fallback chain — try each caster in order; return the first non-`Unsupported` outcome.
pub fn send_with_fallback(
    addrs: &[(std::sync::Arc<dyn Caster>, String)],
    addr: &PaneAddress,
    text: &str,
) -> SendOutcome {
    let mut last_unsupported = None;
    for (caster, label) in addrs {
        let outcome = caster.send(addr, text);
        match &outcome {
            SendOutcome::Unsupported(msg) => {
                last_unsupported = Some(format!("{}: {}", label, msg));
                continue;
            }
            _ => return outcome,
        }
    }
    SendOutcome::Unsupported(last_unsupported.unwrap_or_else(|| "no casters configured".into()))
}

// ---------------------------------------------------------------------------
// unit tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn which_finds_common_bins() {
        // `sh` is on every unix PATH; skip on windows where it isn't.
        if !cfg!(windows) {
            assert!(which("sh").is_some(), "sh should be on PATH");
        }
    }

    #[test]
    fn which_returns_none_for_missing() {
        assert!(which("definitely-not-a-binary-12345").is_none());
    }

    #[test]
    fn send_with_fallback_returns_first_non_unsupported() {
        let a: std::sync::Arc<dyn Caster> = std::sync::Arc::new(ClipboardCaster);
        let addr = PaneAddress::parse("mbp:local:0:0").expect("addr");
        let outcome = send_with_fallback(&[(a, "clipboard".to_string())], &addr, "hello");
        // The clipboard caster either delivers (real env) or reports unsupported
        // (no clipboard binary). Either is acceptable here.
        assert!(matches!(
            outcome,
            SendOutcome::Delivered | SendOutcome::Unsupported(_)
        ));
    }

    #[test]
    fn send_with_fallback_uses_last_unsupported_when_all_unsupported() {
        struct AlwaysUnsupported;
        impl Caster for AlwaysUnsupported {
            fn name(&self) -> &'static str {
                "noop"
            }
            fn resolve_pane_id(&self, _: &PaneAddress) -> Result<Option<u32>> {
                Ok(None)
            }
            fn send(&self, _: &PaneAddress, _: &str) -> SendOutcome {
                SendOutcome::Unsupported("nope".into())
            }
        }
        let a: std::sync::Arc<dyn Caster> = std::sync::Arc::new(AlwaysUnsupported);
        let addr = PaneAddress::parse("mbp:local:0:0").expect("addr");
        let outcome = send_with_fallback(&[(a, "noop".to_string())], &addr, "x");
        assert!(matches!(outcome, SendOutcome::Unsupported(ref m) if m == "noop: nope"));
    }
}
