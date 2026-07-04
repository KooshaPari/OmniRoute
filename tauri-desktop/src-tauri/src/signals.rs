//! Process-signal kinds and a thread-safe shutdown flag.
//!
//! `SignalKind` enumerates the subset of libc/Windows signal semantics most
//! applications need to react to at shutdown. `signal_name` resolves a kind
//! to a stable human-readable name, useful for logging and diagnostics.
//!
//! `ShutdownFlag` is an `Arc<AtomicBool>` wrapper that any number of threads
//! can monitor (`is_set`) or trigger (`set`). The `Clone` impl shares the
//! same underlying atomic, so it can be handed off across threads cheaply.

use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;

/// The process-signal kinds this crate exposes.
///
/// We deliberately constrain the enum to the three signals that show up in
/// almost every CLI/server shutdown handler. Platform-specific extras can
/// be added later without breaking the `signal_name` contract.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum SignalKind {
    /// Polite "please terminate" — apps should flush state and exit.
    Terminate,
    /// Interactive interrupt (Ctrl-C) — usually treated as Terminate for
    /// foreground processes, but distinct for observability.
    Interrupt,
    /// Terminal / controlling-terminal hangup — typical for daemons.
    Hangup,
}

/// Return the stable, lowercase name of a `SignalKind`.
///
/// The returned string is one of `"terminate"`, `"interrupt"`, `"hangup"`.
/// We use lowercase / kebab-friendly identifiers so they can be embedded
/// in log lines without quoting.
pub fn signal_name(k: SignalKind) -> &'static str {
    match k {
        SignalKind::Terminate => "terminate",
        SignalKind::Interrupt => "interrupt",
        SignalKind::Hangup => "hangup",
    }
}

/// A clonable, thread-safe shutdown flag backed by `Arc<AtomicBool>`.
///
/// Cloning shares the same atomic — call `set` once and every clone's
/// `is_set` will observe it. Suitable for handing to worker threads,
/// signal handlers, or stored inside a long-lived struct.
#[derive(Debug, Clone)]
pub struct ShutdownFlag {
    inner: Arc<AtomicBool>,
}

impl ShutdownFlag {
    /// Construct a fresh, unset `ShutdownFlag`.
    pub fn new() -> Self {
        Self {
            inner: Arc::new(AtomicBool::new(false)),
        }
    }

    /// Returns `true` once `set` has been called on *any* clone.
    pub fn is_set(&self) -> bool {
        self.inner.load(Ordering::Acquire)
    }

    /// Flip the flag. All clones will observe the change.
    pub fn set(&self) {
        // Release ordering so any state the caller set just before
        // raising the flag is visible to threads that see is_set() == true.
        self.inner.store(true, Ordering::Release);
    }
}

impl Default for ShutdownFlag {
    fn default() -> Self {
        Self::new()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::thread;

    #[test]
    fn signal_name_returns_stable_lowercase_strings() {
        assert_eq!(signal_name(SignalKind::Terminate), "terminate");
        assert_eq!(signal_name(SignalKind::Interrupt), "interrupt");
        assert_eq!(signal_name(SignalKind::Hangup), "hangup");
    }

    #[test]
    fn signal_kind_equality_and_copy() {
        // Copy semantics — assigning doesn't move.
        let a = SignalKind::Terminate;
        let b = a;
        let c = SignalKind::Hangup;
        assert_eq!(a, b);
        assert_ne!(a, c);
    }

    #[test]
    fn shutdown_flag_starts_unset() {
        let flag = ShutdownFlag::new();
        assert!(!flag.is_set());
    }

    #[test]
    fn shutdown_flag_set_makes_is_set_true() {
        let flag = ShutdownFlag::new();
        flag.set();
        assert!(flag.is_set());
    }

    #[test]
    fn shutdown_flag_clone_shares_underlying_state() {
        let original = ShutdownFlag::new();
        let clone = original.clone();

        // Setting via the clone should be visible on the original, and
        // vice-versa — proving they share the same Arc<AtomicBool>.
        clone.set();
        assert!(original.is_set());
        assert!(clone.is_set());

        // Ensure cross-thread visibility works too.
        let worker = original.clone();
        let handle = thread::spawn(move || worker.is_set());
        assert!(handle.join().unwrap());
    }
}
