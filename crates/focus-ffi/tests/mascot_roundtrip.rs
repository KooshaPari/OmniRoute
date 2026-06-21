// SPDX-License-Identifier: MIT OR Apache-2.0

//! Integration test: drives FocalPointCore through a sequence of events and
//! verifies the FFI-facing state reflects the core mascot machine.

use focus_ffi::{Emotion, FocalPointCore, MascotEvent, Pose};

fn mk_core() -> (tempfile::TempDir, FocalPointCore) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("focal.db");
    let core = FocalPointCore::new(path.to_string_lossy().into_owned()).expect("core");
    (dir, core)
}

#[test]
fn focus_session_completion_celebrates() {
    let (_d, core) = mk_core();
    let s = core.push_mascot_event(MascotEvent::FocusSessionCompleted { minutes: 50 });
    assert!(matches!(s.pose, Pose::Celebratory));
    assert!(matches!(s.emotion, Emotion::Excited));
    assert!(s.bubble_text.is_some());
    assert!(!s.since_iso.is_empty());
}

#[test]
fn event_sequence_updates_state_in_place() {
    let (_d, core) = mk_core();

    let _ = core.push_mascot_event(MascotEvent::DailyCheckIn);
    let cur = core.mascot_state();
    assert!(matches!(cur.pose, Pose::Confident));

    let s = core.push_mascot_event(MascotEvent::SleepDebtReported { hours: 4.0 });
    assert!(matches!(s.pose, Pose::SleepyDisappointed));
    assert!(matches!(s.emotion, Emotion::Tired));

    let latest = core.mascot_state();
    assert!(matches!(latest.pose, Pose::SleepyDisappointed));
}
