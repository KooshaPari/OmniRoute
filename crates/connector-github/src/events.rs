// SPDX-License-Identifier: MIT OR Apache-2.0

//! GitHub event → `NormalizedEvent` mapping.
//!
//! We only surface contribution-signals: pushes, PRs opened/merged, issues
//! closed, and issue comments. Anything else (watches, forks, gollum, etc.)
//! is dropped — they don't correspond to "focus work" in a way that feeds
//! the rewards / streak engine.

use chrono::{DateTime, Utc};
use focus_events::{DedupeKey, EventType, NormalizedEvent, TraceRef};
use serde_json::{json, Value};
use uuid::Uuid;

use crate::models::GitHubEvent;

pub const CONNECTOR_ID: &str = "github";

/// Compute a stable dedupe key for a GitHub event. GitHub event ids are
/// already globally unique; we just namespace them.
pub fn dedupe_key(event_id: &str) -> DedupeKey {
    DedupeKey(format!("github:event:{event_id}"))
}

pub struct GitHubEventMapper;

impl GitHubEventMapper {
    /// Map a raw GitHub event into zero-or-more `NormalizedEvent`s.
    ///
    /// A single GitHub event can fan out: e.g. a `PullRequestEvent` with
    /// `action=closed, merged=true` becomes both `github.pr.closed` (implicit
    /// — we skip it) and `github.pr.merged`. For clarity we emit exactly one
    /// focus-event per GitHub event today; callers that want finer-grained
    /// signals can extend this without touching the connector loop.
    pub fn map(ev: &GitHubEvent, account_id: Uuid) -> Option<NormalizedEvent> {
        let custom_type = classify(ev)?;
        let event_id = Uuid::new_v4();
        let occurred = ev.created_at;
        Some(NormalizedEvent {
            event_id,
            connector_id: CONNECTOR_ID.into(),
            account_id,
            event_type: EventType::Custom(custom_type.into()),
            occurred_at: occurred,
            effective_at: occurred,
            dedupe_key: dedupe_key(&ev.id),
            confidence: 1.0,
            payload: build_payload(ev),
            raw_ref: Some(TraceRef { source: CONNECTOR_ID.into(), id: format!("event:{}", ev.id) }),
        })
    }
}

/// Classify a GitHub event into our custom event-type vocabulary.
///
/// Returns `None` for events we don't surface (e.g. `WatchEvent`).
fn classify(ev: &GitHubEvent) -> Option<&'static str> {
    match ev.event_type.as_str() {
        "PushEvent" => Some("github.push"),
        "PullRequestEvent" => match pr_action(&ev.payload) {
            Some(PrOutcome::Opened) => Some("github.pr.opened"),
            Some(PrOutcome::Merged) => Some("github.pr.merged"),
            Some(PrOutcome::Closed) => Some("github.pr.closed"),
            None => None,
        },
        "PullRequestReviewEvent" => match pr_review_action(&ev.payload) {
            Some("submitted") => Some("github.pr.review_submitted"),
            Some("requested") => Some("github.pr.review_requested"),
            _ => None,
        },
        "IssuesEvent" => match issue_action(&ev.payload) {
            Some("opened") => Some("github.issue.opened"),
            Some("closed") => Some("github.issue.closed"),
            _ => None,
        },
        "IssueCommentEvent" => Some("github.issue.commented"),
        "CreateEvent" => Some("github.create"),
        _ => None,
    }
}

enum PrOutcome {
    Opened,
    Merged,
    Closed,
}

fn pr_action(payload: &Value) -> Option<PrOutcome> {
    let action = payload.get("action").and_then(|v| v.as_str())?;
    match action {
        "opened" => Some(PrOutcome::Opened),
        "closed" => {
            // `closed` with `pull_request.merged == true` → merged, else closed.
            let merged = payload
                .get("pull_request")
                .and_then(|p| p.get("merged"))
                .and_then(|v| v.as_bool())
                .unwrap_or(false);
            if merged {
                Some(PrOutcome::Merged)
            } else {
                Some(PrOutcome::Closed)
            }
        }
        _ => None,
    }
}

fn issue_action(payload: &Value) -> Option<&str> {
    payload.get("action").and_then(|v| v.as_str())
}

fn pr_review_action(payload: &Value) -> Option<&str> {
    payload.get("action").and_then(|v| v.as_str())
}

fn build_payload(ev: &GitHubEvent) -> Value {
    json!({
        "github_event_id": ev.id,
        "github_type": ev.event_type,
        "repo": ev.repo.name,
        "repo_id": ev.repo.id,
        "actor": ev.actor.login,
        "public": ev.public,
        "raw_payload": ev.payload,
    })
}

/// Non-secret helper: timestamp of a synthetic "connector connected" event.
/// Not part of the focus-events stream — used by the FFI audit trail only.
pub fn now() -> DateTime<Utc> {
    Utc::now()
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use crate::models::{GitHubActor, GitHubRepo};
    use chrono::TimeZone;
    use serde_json::json;

    fn ev(ty: &str, payload: Value) -> GitHubEvent {
        GitHubEvent {
            id: "12345".into(),
            event_type: ty.into(),
            actor: GitHubActor { id: 1, login: "octocat".into() },
            repo: GitHubRepo { id: 42, name: "octo/repo".into() },
            created_at: Utc.with_ymd_and_hms(2026, 4, 1, 12, 0, 0).unwrap(),
            public: true,
            payload,
        }
    }

    #[test]
    fn maps_push_event() {
        let e = ev("PushEvent", json!({"size": 2}));
        let ne = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        assert_eq!(ne.event_type, EventType::Custom("github.push".into()));
        assert_eq!(ne.dedupe_key.0, "github:event:12345");
        assert_eq!(ne.payload["repo"], "octo/repo");
    }

    #[test]
    fn maps_pr_opened() {
        let e =
            ev("PullRequestEvent", json!({"action": "opened", "pull_request": {"merged": false}}));
        let ne = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        assert_eq!(ne.event_type, EventType::Custom("github.pr.opened".into()));
    }

    #[test]
    fn maps_pr_merged_vs_closed() {
        let merged =
            ev("PullRequestEvent", json!({"action": "closed", "pull_request": {"merged": true}}));
        let ne = GitHubEventMapper::map(&merged, Uuid::nil()).unwrap();
        assert_eq!(ne.event_type, EventType::Custom("github.pr.merged".into()));

        let closed =
            ev("PullRequestEvent", json!({"action": "closed", "pull_request": {"merged": false}}));
        let ne2 = GitHubEventMapper::map(&closed, Uuid::nil()).unwrap();
        assert_eq!(ne2.event_type, EventType::Custom("github.pr.closed".into()));
    }

    #[test]
    fn maps_issue_closed() {
        let e = ev("IssuesEvent", json!({"action": "closed"}));
        let ne = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        assert_eq!(ne.event_type, EventType::Custom("github.issue.closed".into()));
    }

    #[test]
    fn maps_issue_comment_and_create() {
        let c = ev("IssueCommentEvent", json!({"action": "created"}));
        assert_eq!(
            GitHubEventMapper::map(&c, Uuid::nil()).unwrap().event_type,
            EventType::Custom("github.issue.commented".into())
        );
        let cr = ev("CreateEvent", json!({"ref_type": "branch"}));
        assert_eq!(
            GitHubEventMapper::map(&cr, Uuid::nil()).unwrap().event_type,
            EventType::Custom("github.create".into())
        );
    }

    #[test]
    fn drops_unsupported_event_types() {
        let w = ev("WatchEvent", json!({"action": "started"}));
        assert!(GitHubEventMapper::map(&w, Uuid::nil()).is_none());
        let f = ev("ForkEvent", json!({}));
        assert!(GitHubEventMapper::map(&f, Uuid::nil()).is_none());
    }

    #[test]
    fn dedupe_key_is_stable_and_namespaced() {
        let e = ev("PushEvent", json!({}));
        let a = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        let b = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        assert_eq!(a.dedupe_key, b.dedupe_key);
        assert!(a.dedupe_key.0.starts_with("github:event:"));
    }

    #[test]
    fn trace_ref_points_at_github() {
        let e = ev("PushEvent", json!({}));
        let ne = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        let tr = ne.raw_ref.unwrap();
        assert_eq!(tr.source, "github");
        assert_eq!(tr.id, "event:12345");
    }

    #[test]
    fn maps_pr_review_submitted() {
        let e = ev("PullRequestReviewEvent", json!({"action": "submitted"}));
        let ne = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        assert_eq!(ne.event_type, EventType::Custom("github.pr.review_submitted".into()));
    }

    #[test]
    fn maps_pr_review_requested() {
        let e = ev("PullRequestReviewEvent", json!({"action": "requested"}));
        let ne = GitHubEventMapper::map(&e, Uuid::nil()).unwrap();
        assert_eq!(ne.event_type, EventType::Custom("github.pr.review_requested".into()));
    }

    #[test]
    fn drops_unsupported_pr_review_actions() {
        let e = ev("PullRequestReviewEvent", json!({"action": "dismissed"}));
        assert!(GitHubEventMapper::map(&e, Uuid::nil()).is_none());
    }
}
