//! Command-surface tests, kept out of `commands.rs` so the module stays
//! within the repository file-size mandate.

use super::*;
use crate::{lifecycle::RuntimeState, origin::DEFAULT_RUNTIME_ORIGIN};

#[test]
fn state_starts_stopped_at_the_default_origin() {
    let state = AppState::default();
    let runtime = runtime_lock(&state);
    assert_eq!(runtime.status.state, RuntimeState::Stopped);
    assert_eq!(runtime.status.origin, DEFAULT_RUNTIME_ORIGIN);
    assert_eq!(runtime.status.port, origin::DEFAULT_RUNTIME_PORT);
}

#[test]
fn failed_start_does_not_remain_starting() {
    let mut status = RuntimeStatus::stopped(DEFAULT_RUNTIME_ORIGIN);
    status.mark_starting(Some(10));
    status.mark_stopped(Some("no server entry".to_string()));
    assert_eq!(status.state, RuntimeState::Stopped);
    assert_eq!(status.detail.as_deref(), Some("no server entry"));
}

#[test]
fn only_http_schemes_are_openable() {
    for rejected in [
        "file:///etc/passwd",
        "javascript:alert(1)",
        "mailto:someone@example.com",
        "/etc/passwd",
        "",
    ] {
        assert!(!is_openable_url(rejected), "{rejected} must be refused");
    }
    for accepted in [
        "http://localhost:20128",
        "HTTPS://omniroute.online/dashboard",
    ] {
        assert!(is_openable_url(accepted), "{accepted} must be allowed");
    }
}

#[test]
fn explicit_memory_override_is_appended_to_inherited_options() {
    assert_eq!(
        node_options_from(
            Some("--trace-warnings".to_string()),
            Some("2048".to_string())
        )
        .as_deref(),
        Some("--trace-warnings --max-old-space-size=2048")
    );
    assert_eq!(
        node_options_from(None, Some("2048".to_string())).as_deref(),
        Some("--max-old-space-size=2048")
    );
}

#[test]
fn an_existing_heap_ceiling_wins_over_the_override() {
    assert_eq!(
        node_options_from(
            Some("--max-old-space-size=1024".to_string()),
            Some("4096".to_string())
        )
        .as_deref(),
        Some("--max-old-space-size=1024")
    );
}

#[test]
fn out_of_range_and_absent_overrides_leave_options_alone() {
    assert_eq!(node_options_from(None, Some("8".to_string())), None);
    assert_eq!(node_options_from(None, Some("999999".to_string())), None);
    assert_eq!(
        node_options_from(Some("  ".to_string()), None),
        None,
        "a blank inherited value must not become an empty env var"
    );
}
