// SPDX-License-Identifier: MIT OR Apache-2.0

//! Live Canvas API integration test.
//!
//! Gated by `#[ignore]` and the `live-canvas` cargo feature (if declared).
//! Not expected to pass in CI — this is for dev-Mac manual runs against a
//! real Canvas sandbox.
//!
//! Run with:
//!   CANVAS_TEST_BASE_URL=https://canvas.instructure.com \
//!   CANVAS_TEST_TOKEN=... \
//!   cargo test -p connector-canvas --test integration_live -- --ignored --nocapture
//!
//! Skips gracefully if either env var is unset.
#![allow(clippy::disallowed_methods)]
#![cfg(feature = "live-canvas")]

use connector_canvas::api::CanvasClient;

fn env_or_skip() -> Option<(String, String)> {
    let base = std::env::var("CANVAS_TEST_BASE_URL").ok()?;
    let tok = std::env::var("CANVAS_TEST_TOKEN").ok()?;
    if base.is_empty() || tok.is_empty() {
        return None;
    }
    Some((base, tok))
}

#[tokio::test]
#[ignore = "requires real Canvas sandbox creds in CANVAS_TEST_BASE_URL + CANVAS_TEST_TOKEN"]
async fn live_lists_courses_assignments_submissions_announcements() {
    let Some((base, tok)) = env_or_skip() else {
        eprintln!("skipping: CANVAS_TEST_BASE_URL / CANVAS_TEST_TOKEN not set");
        return;
    };

    let client = CanvasClient::new(&base, &tok);

    let courses = client.list_courses(None, None).await.expect("list_courses");
    eprintln!("got {} courses", courses.items.len());
    assert!(!courses.items.is_empty(), "expected at least one enrolled course in sandbox");

    let first = &courses.items[0];
    eprintln!("course[0] id={} name={}", first.id, first.name);

    let assignments = client.list_assignments(first.id, None).await.expect("list_assignments");
    eprintln!("got {} assignments in course {}", assignments.items.len(), first.id);

    if let Some(a) = assignments.items.first() {
        let subs = client.list_submissions(a.id, first.id, None).await;
        match subs {
            Ok(p) => eprintln!("got {} submissions for assignment {}", p.items.len(), a.id),
            Err(e) => eprintln!("submissions err (common — student-only view): {e}"),
        }
    }

    let announcements = client.list_announcements(first.id, None).await;
    match announcements {
        Ok(p) => eprintln!("got {} announcements in course {}", p.items.len(), first.id),
        Err(e) => eprintln!("announcements err: {e}"),
    }
}
