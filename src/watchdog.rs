//! Process watchdog with per-name restart cap.
//!
//! Tracks child process lifecycle: a process exits, the supervisor asks the
//! watchdog whether another restart is allowed, and the watchdog enforces a
//! per-name cap (`max_restarts`). After the cap is exceeded the entry
//! transitions to [`WatchdogState::MaxRestartsExceeded`] and stays there
//! (no further restarts permitted).
//!
//! Pure state machine — no I/O, no async, no clock. Callers supply the
//! "exit happened" signal via [`Watchdog::on_exit`] and read the result.

use std::collections::HashMap;

/// Coarse lifecycle state of a single watched entry.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum WatchdogState {
    /// Process is alive (or about to be restarted after an exit).
    Running,
    /// Process has exited but the restart cap has not been reached yet.
    /// Equivalent to "ready to be restarted" — kept distinct from
    /// `Running` so callers can distinguish "never started" from
    /// "exited once and is allowed to come back".
    Stopped,
    /// Restart cap has been hit. No more restarts permitted for this
    /// entry; state is sticky and will not transition out without a
    /// manual reset (out of scope for this module).
    MaxRestartsExceeded,
}

impl WatchdogState {
    /// `true` when this state still allows another restart.
    pub fn can_restart(self) -> bool {
        matches!(self, WatchdogState::Running | WatchdogState::Stopped)
    }
}

/// Per-process watchdog bookkeeping.
#[derive(Debug, Clone)]
pub struct WatchdogEntry {
    /// Stable identifier for the watched process. Used as the
    /// `HashMap` key on the parent [`Watchdog`].
    pub name: String,
    /// How many exits we have already absorbed.
    pub restart_count: u32,
    /// Hard cap on `restart_count`. When `restart_count >= max_restarts`
    /// the next call to [`WatchdogEntry::on_exit`] trips the gate.
    pub max_restarts: u32,
    /// Current lifecycle state. Updated by [`WatchdogEntry::on_exit`].
    pub state: WatchdogState,
}

impl WatchdogEntry {
    /// Create a fresh entry in the [`WatchdogState::Running`] state with
    /// `restart_count = 0`.
    pub fn new(name: impl Into<String>, max_restarts: u32) -> Self {
        Self {
            name: name.into(),
            restart_count: 0,
            max_restarts,
            state: WatchdogState::Running,
        }
    }

    /// Record an exit for this single entry and return the new state.
    ///
    /// Semantics:
    /// - If `restart_count >= max_restarts` → state becomes
    ///   [`WatchdogState::MaxRestartsExceeded`] (sticky, counter unchanged).
    /// - Otherwise → `restart_count` is incremented and state becomes
    ///   [`WatchdogState::Running`] (the caller is now expected to spawn a
    ///   replacement process).
    pub fn on_exit(&mut self) -> WatchdogState {
        if self.restart_count >= self.max_restarts {
            self.state = WatchdogState::MaxRestartsExceeded;
            WatchdogState::MaxRestartsExceeded
        } else {
            self.restart_count = self.restart_count.saturating_add(1);
            self.state = WatchdogState::Running;
            WatchdogState::Running
        }
    }

    /// Convenience wrapper around [`WatchdogState::can_restart`].
    pub fn can_restart(&self) -> bool {
        self.state.can_restart()
    }
}

/// Registry of watched processes keyed by name.
#[derive(Debug, Default)]
pub struct Watchdog {
    entries: HashMap<String, WatchdogEntry>,
}

impl Watchdog {
    /// Empty registry.
    pub fn new() -> Self {
        Self::default()
    }

    /// Register a fresh [`WatchdogEntry`] under `name`, overwriting any
    /// existing entry with that name. Returns a reference to the inserted
    /// entry (useful for tests and for call sites that want to read the
    /// initial state).
    pub fn register(&mut self, name: impl Into<String>, max_restarts: u32) -> &WatchdogEntry {
        let name = name.into();
        self.entries
            .insert(name.clone(), WatchdogEntry::new(name, max_restarts));
        self.entries
            .get(&name)
            .expect("entry was just inserted and must be present")
    }

    /// Record an exit for the named entry. Returns:
    /// - `Some(new_state)` if the entry exists,
    /// - `None` if no entry is registered under `name`.
    pub fn on_exit(&mut self, name: &str) -> Option<WatchdogState> {
        self.entries.get_mut(name).map(WatchdogEntry::on_exit)
    }

    /// Look up the current state of the named entry.
    pub fn state(&self, name: &str) -> Option<&WatchdogState> {
        self.entries.get(name).map(|e| &e.state)
    }

    /// Borrow the named entry by reference (state + counters).
    pub fn entry(&self, name: &str) -> Option<&WatchdogEntry> {
        self.entries.get(name)
    }

    /// Number of registered entries.
    pub fn len(&self) -> usize {
        self.entries.len()
    }

    /// `true` when no entries are registered.
    pub fn is_empty(&self) -> bool {
        self.entries.is_empty()
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn register_inserts_entry_in_running_state() {
        let mut wd = Watchdog::new();
        assert_eq!(wd.len(), 0);
        assert!(wd.is_empty());

        wd.register("alpha", 3);
        assert_eq!(wd.len(), 1);
        assert!(!wd.is_empty());
        assert_eq!(wd.state("alpha"), Some(&WatchdogState::Running));
        assert_eq!(wd.entry("alpha").unwrap().restart_count, 0);
        assert_eq!(wd.entry("alpha").unwrap().max_restarts, 3);
    }

    #[test]
    fn on_exit_increments_and_keeps_running_below_cap() {
        let mut wd = Watchdog::new();
        // max_restarts = 2 → 2 exits are allowed; the third trips the gate.
        wd.register("svc", 2);

        assert_eq!(wd.on_exit("svc"), Some(WatchdogState::Running));
        assert_eq!(wd.entry("svc").unwrap().restart_count, 1);
        assert_eq!(wd.state("svc"), Some(&WatchdogState::Running));
        assert!(wd.entry("svc").unwrap().can_restart());

        assert_eq!(wd.on_exit("svc"), Some(WatchdogState::Running));
        assert_eq!(wd.entry("svc").unwrap().restart_count, 2);
        assert_eq!(wd.state("svc"), Some(&WatchdogState::Running));
        assert!(wd.entry("svc").unwrap().can_restart());
    }

    #[test]
    fn on_exit_trips_max_restarts_exceeded_at_cap() {
        let mut wd = Watchdog::new();
        wd.register("svc", 2);

        // First two exits → Running.
        assert_eq!(wd.on_exit("svc"), Some(WatchdogState::Running));
        assert_eq!(wd.on_exit("svc"), Some(WatchdogState::Running));

        // Third exit → restart_count (2) >= max_restarts (2) → gate trips.
        assert_eq!(
            wd.on_exit("svc"),
            Some(WatchdogState::MaxRestartsExceeded)
        );
        assert_eq!(
            wd.state("svc"),
            Some(&WatchdogState::MaxRestartsExceeded)
        );
        assert!(!wd.entry("svc").unwrap().can_restart());
        // Counter must NOT advance once the gate has tripped.
        let count_after_trip = wd.entry("svc").unwrap().restart_count;
        assert_eq!(wd.on_exit("svc"), Some(WatchdogState::MaxRestartsExceeded));
        assert_eq!(wd.entry("svc").unwrap().restart_count, count_after_trip);
    }

    #[test]
    fn on_exit_for_unknown_name_returns_none() {
        let mut wd = Watchdog::new();
        wd.register("known", 1);

        assert_eq!(wd.on_exit("ghost"), None);
        assert_eq!(wd.on_exit("known"), Some(WatchdogState::Running));
    }

    #[test]
    fn independent_entries_track_restarts_separately() {
        let mut wd = Watchdog::new();
        wd.register("a", 1);
        wd.register("b", 5);

        // "a" exhausts its cap on the first exit.
        assert_eq!(wd.on_exit("a"), Some(WatchdogState::Running));
        assert_eq!(
            wd.on_exit("a"),
            Some(WatchdogState::MaxRestartsExceeded)
        );

        // "b" still has plenty of headroom.
        for _ in 0..3 {
            assert_eq!(wd.on_exit("b"), Some(WatchdogState::Running));
        }
        assert_eq!(wd.entry("b").unwrap().restart_count, 3);
        assert!(wd.entry("b").unwrap().can_restart());
        assert!(!wd.entry("a").unwrap().can_restart());
    }
}
