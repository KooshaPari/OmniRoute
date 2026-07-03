//! Pane address schema for `cast`.
//!
//! Format: `machine:host?[:window][:pane]`
//!
//!   - `machine`  : friendly name (e.g. `mbp`, `winTerm`).
//!     Allowed: ASCII alphanumeric, `-`, `_`, `.`.
//!   - `host`     : `local` | `tailscale` | `ssh:user@host`
//!   - `window`   : terminal window index (default 0)
//!   - `pane`     : pane index within window (default 0)
//!
//! Display always emits `machine:host:window:pane` (or `machine:ssh:user@host:window:pane`)
//! so the display form round-trips through `parse`.
//!
//! FR: FR-CAST-001

use std::fmt;
use std::str::FromStr;

use serde::{Deserialize, Serialize};

/// A registered remote terminal pane.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
pub struct PaneAddress {
    pub machine: String,
    pub host: Host,
    #[serde(default)]
    pub window: u32,
    #[serde(default)]
    pub pane: u32,
}

/// Host scheme — how to reach the remote machine.
#[derive(Debug, Clone, PartialEq, Eq, Hash, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum Host {
    Local,
    Tailscale,
    Ssh { user: String, host: String },
}

impl PaneAddress {
    /// Parse a `machine:host[:window[:pane]]` address.
    pub fn parse(s: &str) -> anyhow::Result<Self> {
        if s.is_empty() {
            anyhow::bail!("empty pane address");
        }

        let (machine, rest) = split_once(s, ':')
            .ok_or_else(|| anyhow::anyhow!("missing host: '{}'", s))?;

        if machine.is_empty() {
            anyhow::bail!("empty machine name");
        }
        if !is_valid_machine(machine) {
            anyhow::bail!(
                "invalid machine name '{}' (allowed: a-zA-Z0-9._-)",
                machine
            );
        }

        // Peel pane (last) and window (second-to-last) — only if they are u32.
        let (pane, window, host_str) = peel_pane_window(rest)?;

        let host = parse_host(&host_str)?;

        Ok(PaneAddress {
            machine: machine.to_string(),
            host,
            window,
            pane,
        })
    }
}

impl fmt::Display for PaneAddress {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "{}:{}:{}:{}", self.machine, self.host, self.window, self.pane)
    }
}

impl fmt::Display for Host {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Host::Local => f.write_str("local"),
            Host::Tailscale => f.write_str("tailscale"),
            Host::Ssh { user, host } => write!(f, "ssh:{}@{}", user, host),
        }
    }
}

impl FromStr for PaneAddress {
    type Err = anyhow::Error;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        Self::parse(s)
    }
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn split_once(s: &str, delim: char) -> Option<(&str, &str)> {
    s.find(delim).map(|idx| (&s[..idx], &s[idx + delim.len_utf8()..]))
}

/// Peel trailing `:pane` and `:window` segments from `s` if they are u32.
/// Returns (pane, window, host_remainder).
fn peel_pane_window(s: &str) -> anyhow::Result<(u32, u32, String)> {
    // Try to peel pane.
    if let Some((left, right)) = split_once_rev(s, ':') {
        match parse_index(right, "pane")? {
            Some(p) => {
                // Pane peeled. Try to peel window.
                if let Some((left2, right2)) = split_once_rev(left, ':') {
                    match parse_index(right2, "window")? {
                        Some(w) => return Ok((p, w, left2.to_string())),
                        None => return Ok((p, 0, left.to_string())),
                    }
                }
                return Ok((p, 0, left.to_string()));
            }
            None => {}
        }
    }
    Ok((0, 0, s.to_string()))
}

/// Try to interpret `s` as a non-negative u32 index. Returns:
///   - `Ok(Some(n))` if `s` is a valid u32
///   - `Ok(None)`     if `s` is not numeric (allow fall-through to host parsing)
///   - `Err(_)`       if `s` looks numeric but is negative or out-of-range
fn parse_index(s: &str, label: &'static str) -> anyhow::Result<Option<u32>> {
    if s.is_empty() {
        return Ok(None);
    }
    if !s.chars().all(|c| c.is_ascii_digit()) {
        // Not numeric at all (could be `local`, `tailscale`, `ssh:...`). Let
        // the caller treat this as a non-index and fall through.
        if s.starts_with('-') {
            anyhow::bail!(
                "{} index must be non-negative, got '{}'",
                label,
                s
            );
        }
        return Ok(None);
    }
    if s.starts_with('-') {
        anyhow::bail!("{} index must be non-negative, got '{}'", label, s);
    }
    let n: u32 = s
        .parse()
        .map_err(|_| anyhow::anyhow!("{} index out of range: '{}'", label, s))?;
    Ok(Some(n))
}

/// `rsplit_once` is unstable; this is the local equivalent.
fn split_once_rev(s: &str, delim: char) -> Option<(&str, &str)> {
    s.rfind(delim).map(|idx| (&s[..idx], &s[idx + delim.len_utf8()..]))
}

fn parse_host(s: &str) -> anyhow::Result<Host> {
    if s.is_empty() {
        anyhow::bail!("empty host specifier");
    }
    match s {
        "local" => Ok(Host::Local),
        "tailscale" => Ok(Host::Tailscale),
        _ if s.starts_with("ssh:") => {
            let rest = &s[4..];
            let at = rest
                .find('@')
                .ok_or_else(|| anyhow::anyhow!("ssh host must be 'ssh:user@host', got '{}'", s))?;
            let user = &rest[..at];
            let host = &rest[at + 1..];
            if user.is_empty() {
                anyhow::bail!("empty ssh user in '{}'", s);
            }
            if host.is_empty() {
                anyhow::bail!("empty ssh host in '{}'", s);
            }
            Ok(Host::Ssh {
                user: user.to_string(),
                host: host.to_string(),
            })
        }
        other => anyhow::bail!(
            "unknown host '{}' (expected 'local', 'tailscale', or 'ssh:user@host')",
            other
        ),
    }
}

fn is_valid_machine(s: &str) -> bool {
    !s.is_empty()
        && s.chars()
            .all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.')
}

// ---------------------------------------------------------------------------
// unit tests (whitebox, complement the blackbox tests in tests/cast_address.rs)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_valid_machine_accepts_typical_names() {
        assert!(is_valid_machine("mbp"));
        assert!(is_valid_machine("winTerm"));
        assert!(is_valid_machine("workstation-01"));
        assert!(is_valid_machine("ws.local"));
    }

    #[test]
    fn is_valid_machine_rejects_bad_chars() {
        assert!(!is_valid_machine(""));
        assert!(!is_valid_machine("foo bar"));
        assert!(!is_valid_machine("foo/bar"));
        assert!(!is_valid_machine("foo:bar"));
    }

    #[test]
    fn peel_pane_window_no_indices() {
        let (p, w, host) = peel_pane_window("local").expect("ok");
        assert_eq!((p, w), (0, 0));
        assert_eq!(host, "local");
    }

    #[test]
    fn peel_pane_window_with_window_only() {
        let (p, w, host) = peel_pane_window("local:0").expect("ok");
        assert_eq!((p, w), (0, 0));
        assert_eq!(host, "local");
    }

    #[test]
    fn peel_pane_window_with_both() {
        let (p, w, host) = peel_pane_window("local:3:7").expect("ok");
        assert_eq!((p, w), (7, 3));
        assert_eq!(host, "local");
    }

    #[test]
    fn peel_pane_window_keeps_ssh_form_intact() {
        // `ssh:koosha@10.0.0.5:0:3` — host part is `ssh:koosha@10.0.0.5`
        let (p, w, host) = peel_pane_window("ssh:koosha@10.0.0.5:0:3").expect("ok");
        assert_eq!((p, w), (3, 0));
        assert_eq!(host, "ssh:koosha@10.0.0.5");
    }
}
