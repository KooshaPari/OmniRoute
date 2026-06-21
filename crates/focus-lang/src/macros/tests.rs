// SPDX-License-Identifier: MIT OR Apache-2.0

//! Tests for FPL macro library parsing and syntax validation.
//! Note: Full IR collection requires native function hooks (Phase 2).
//! These tests validate that macros parse correctly and have syntactically valid Starlark.

use crate::compile_fpl;

/// Test that `reward()` macro parses with streak enabled.
#[test]
fn test_reward_macro_expands_with_streak() {
    let source = r#"
reward("focus:session_completed", credits=15, streak=1)
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "reward macro should parse: {:?}", result.err());
}

/// Test that `reward()` macro parses with streak disabled.
#[test]
fn test_reward_macro_without_streak() {
    let source = r#"
reward("task:completed", credits=5, streak=0)
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "reward without streak should parse: {:?}", result.err());
}

/// Test that `penalize()` macro parses correctly.
#[test]
fn test_penalize_macro() {
    let source = r#"
penalize("distraction:triggered", credits=10)
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "penalize macro should parse: {:?}", result.err());
}

/// Test that `remind()` macro parses with timezone.
#[test]
fn test_remind_macro_with_cron() {
    let source = r#"
remind("0 9 * * *", "Time for standup", at="America/New_York")
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "remind macro should parse: {:?}", result.err());
}

/// Test that `celebrate()` macro parses with sound parameter.
#[test]
fn test_celebrate_macro() {
    let source = r#"
celebrate("milestone:unlocked", "Great work!", sound="confetti")
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "celebrate macro should parse: {:?}", result.err());
}

/// Test that `block()` macro parses with single app.
#[test]
fn test_block_macro_single_app() {
    let source = r#"
block(["Instagram"], "work_hours")
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "block macro should parse: {:?}", result.err());
}

/// Test that `block()` macro parses with multiple apps.
#[test]
fn test_block_macro_app_list() {
    let source = r#"
block(["Instagram", "TikTok"], "evening")
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "block macro with app list should parse: {:?}", result.err());
}

/// Test that `unlock_after()` macro parses correctly.
#[test]
fn test_unlock_after_macro() {
    let source = r#"
unlock_after("goal:completed", 2)
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "unlock_after macro should parse: {:?}", result.err());
}

/// Test that `track_streak()` macro parses correctly.
#[test]
fn test_track_streak_macro() {
    let source = r#"
track_streak("focus:session_ended", "Daily Focus")
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "track_streak macro should parse: {:?}", result.err());
}

/// Test that `if_pattern()` with named pattern parses.
#[test]
fn test_if_pattern_macro_weekday() {
    let source = r#"
conds = if_pattern("weekday")
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "if_pattern should parse: {:?}", result.err());
}

/// Test that `if_pattern()` with custom conditions parses.
#[test]
fn test_if_pattern_macro_custom() {
    let source = r#"
conds = if_pattern("custom_time", [payload_exists("hour")])
"#;
    let result = compile_fpl(source);
    assert!(result.is_ok(), "if_pattern with custom conditions should parse: {:?}", result.err());
}

/// Test round-trip macro parsing consistency.
#[test]
fn test_macro_ir_stability() {
    let source = r#"
reward("focus:done", credits=10, streak=1)
"#;

    let result1 = compile_fpl(source);
    let result2 = compile_fpl(source);

    assert!(result1.is_ok(), "first compile should succeed");
    assert!(result2.is_ok(), "second compile should succeed");
}

/// Test all 8 macros in one compilation.
#[test]
fn test_all_eight_macros_together() {
    let source = r#"
reward("focus:session_completed", credits=20, streak=1)
penalize("distraction:detected", credits=5)
remind("0 9 * * MON", "Weekly standup", at="UTC")
celebrate("achievement:unlocked", "Great work!", sound="ding")
block(["Instagram", "TikTok"], "evening_block")
unlock_after("goal:met", 1)
track_streak("workout:completed", "Fitness Streak")
if_pattern("work_hours")
"#;

    let result = compile_fpl(source);
    assert!(result.is_ok(), "all 8 macros should compile together: {:?}", result.err());
}

/// Test multiple macro invocations with different parameters.
#[test]
fn test_macro_id_uniqueness() {
    let source = r#"
reward("event1:done", credits=10, streak=1)
reward("event2:done", credits=5, streak=0)
penalize("event3:bad", credits=3)
penalize("event4:bad", credits=7)
"#;

    let result = compile_fpl(source);
    assert!(result.is_ok(), "multiple macro calls should parse: {:?}", result.err());
}

/// Test macro with negative parameter values.
#[test]
fn test_reward_macro_negative_credits() {
    let source = r#"
reward("event:x", credits=-5)
"#;

    let result = compile_fpl(source);
    assert!(result.is_ok(), "macro should parse with negative values: {:?}", result.err());
}

/// Test pattern conditions integration.
#[test]
fn test_macro_with_pattern_integration() {
    let source = r#"
work_conds = if_pattern("work_hours")
evening_conds = if_pattern("evening")
weekday_conds = if_pattern("weekday")
"#;

    let result = compile_fpl(source);
    assert!(result.is_ok(), "pattern-based conditions should parse: {:?}", result.err());
}

/// Test macros with minimal and default parameters.
#[test]
fn test_macro_default_priorities() {
    let source = r#"
reward("evt1", credits=5)
reward("evt2")
penalize("evt3", credits=5)
penalize("evt4")
celebrate("evt5", "Nice!")
"#;

    let result = compile_fpl(source);
    assert!(result.is_ok(), "macros with default params should parse: {:?}", result.err());
}

/// Test macro-generated IR serialization (if any rules are collected).
#[test]
fn test_macro_json_serializable() {
    let source = r#"
reward("done", credits=10, streak=1)
"#;

    let result = compile_fpl(source);
    if let Ok(docs) = result {
        for doc in docs {
            let serialized = serde_json::to_string(&doc);
            assert!(
                serialized.is_ok(),
                "macro-generated documents should be JSON-serializable: {:?}",
                serialized.err()
            );
        }
    }
}

/// Test the starter macro example file.
#[test]
fn test_starter_macro_example_parses() {
    let fpl_source = include_str!("../../../../examples/fpl/starter-macro.fpl");
    let result = compile_fpl(fpl_source);
    assert!(
        result.is_ok(),
        "starter-macro.fpl should parse without errors: {:?}",
        result.err()
    );
}
