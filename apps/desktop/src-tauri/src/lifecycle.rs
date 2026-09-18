//! Lifecycle types shared with the web layer.
//!
//! `RuntimeStatus` is the JSON shape every `runtime_*` command returns. It is
//! backwards compatible with the pre-lifecycle shape (`state` + `origin` were
//! the only fields) and only ever gained fields.

use serde::Serialize;

use crate::origin;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeState {
    /// Nothing is listening and no child is supervised.
    Stopped,
    /// A child was spawned (or a start was requested) but the port does not
    /// answer yet.
    Starting,
    /// The port answers.
    Running,
}

/// Serialised as `{ state, origin, port, pid, supervised, detail }`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeStatus {
    pub state: RuntimeState,
    /// Base URL the web layer should talk to.
    pub origin: String,
    /// Port parsed from `origin` (the port the supervised child is given).
    pub port: u16,
    /// PID of the supervised child, when this shell owns one that is alive.
    pub pid: Option<u32>,
    /// Whether the shell owns (and will stop) a child process.
    pub supervised: bool,
    /// Human-readable detail for the current state: the spawn error, or how the
    /// child exited. `None` when there is nothing to report.
    pub detail: Option<String>,
}

impl RuntimeStatus {
    pub fn stopped(origin: impl Into<String>) -> Self {
        let origin = origin.into();
        Self {
            state: RuntimeState::Stopped,
            port: origin::port_from_origin(&origin),
            origin,
            pid: None,
            supervised: false,
            detail: None,
        }
    }

    /// The port answers; `pid` is `Some` only when we own the answering child.
    pub fn mark_running(&mut self, pid: Option<u32>) {
        self.state = RuntimeState::Running;
        self.pid = pid;
        self.supervised = pid.is_some();
        self.detail = None;
    }

    /// A child is alive but the port is not answering yet.
    pub fn mark_starting(&mut self, pid: Option<u32>) {
        self.state = RuntimeState::Starting;
        self.pid = pid;
        self.supervised = pid.is_some();
    }

    /// Nothing is running (or was stopped). `detail` explains why.
    pub fn mark_stopped(&mut self, detail: Option<String>) {
        self.state = RuntimeState::Stopped;
        self.pid = None;
        self.supervised = false;
        self.detail = detail;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn starts_stopped() {
        let status = RuntimeStatus::stopped("http://localhost:20128");
        assert_eq!(status.state, RuntimeState::Stopped);
        assert_eq!(status.port, 20128);
        assert_eq!(status.pid, None);
        assert!(!status.supervised);
    }

    #[test]
    fn running_with_a_child_is_supervised() {
        let mut status = RuntimeStatus::stopped("http://localhost:20128");
        status.mark_running(Some(4242));
        assert_eq!(status.state, RuntimeState::Running);
        assert_eq!(status.pid, Some(4242));
        assert!(status.supervised);
    }

    #[test]
    fn running_without_a_child_is_not_supervised() {
        let mut status = RuntimeStatus::stopped("http://localhost:20128");
        status.mark_running(None);
        assert_eq!(status.state, RuntimeState::Running);
        assert!(!status.supervised);
    }

    #[test]
    fn stopping_clears_the_child_and_records_the_reason() {
        let mut status = RuntimeStatus::stopped("http://localhost:20128");
        status.mark_starting(Some(7));
        status.mark_stopped(Some("server exited with exit status: 1".to_string()));
        assert_eq!(status.state, RuntimeState::Stopped);
        assert_eq!(status.pid, None);
        assert!(!status.supervised);
        assert_eq!(
            status.detail.as_deref(),
            Some("server exited with exit status: 1")
        );
    }

    #[test]
    fn serialises_the_documented_field_names() {
        let mut status = RuntimeStatus::stopped("http://localhost:20128");
        status.mark_running(Some(11));
        let json = serde_json::to_value(&status).expect("serialise");
        assert_eq!(json["state"], "running");
        assert_eq!(json["origin"], "http://localhost:20128");
        assert_eq!(json["port"], 20128);
        assert_eq!(json["pid"], 11);
        assert_eq!(json["supervised"], true);
        assert_eq!(json["detail"], serde_json::Value::Null);
    }
}
