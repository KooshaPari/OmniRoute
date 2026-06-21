// SPDX-License-Identifier: MIT OR Apache-2.0

//! Canvas LMS connector — OAuth2 auth, REST client, event mapping, `Connector` impl.

pub mod api;
pub mod auth;
pub mod events;
pub mod models;

use std::sync::Arc;

use async_trait::async_trait;
use chrono::Utc;
use tokio::sync::Mutex;
use tracing::warn;
use uuid::Uuid;

use focus_connectors::{
    AuthStrategy, Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode,
    SyncOutcome, VerificationTier,
};

use phenotype_observably_macros::async_instrumented;

use crate::api::CanvasClient;
use crate::auth::{CanvasOAuth2, InMemoryTokenStore, TokenStore};
use crate::events::CanvasEventMapper;

/// Defensive cap on per-course assignment/submission/announcement pagination.
/// Canvas doesn't bound page counts; this prevents runaway sync loops if a
/// Link header points back at us or a course has an absurd assignment count.
pub const MAX_PAGES_PER_COURSE: usize = 10;

/// Canvas connector.
pub struct CanvasConnector {
    manifest: ConnectorManifest,
    account_id: Uuid,
    token_store: Arc<dyn TokenStore>,
    oauth: Option<Arc<CanvasOAuth2>>,
    client: Mutex<CanvasClient>,
}

pub struct CanvasConnectorBuilder {
    base_url: String,
    account_id: Uuid,
    token_store: Option<Arc<dyn TokenStore>>,
    oauth: Option<Arc<CanvasOAuth2>>,
    http: Option<reqwest::Client>,
    scopes: Option<Vec<String>>,
}

impl CanvasConnectorBuilder {
    pub fn new(base_url: impl Into<String>) -> Self {
        Self {
            base_url: base_url.into(),
            account_id: Uuid::nil(),
            token_store: None,
            oauth: None,
            http: None,
            scopes: None,
        }
    }

    pub fn account_id(mut self, id: Uuid) -> Self {
        self.account_id = id;
        self
    }

    pub fn token_store(mut self, s: Arc<dyn TokenStore>) -> Self {
        self.token_store = Some(s);
        self
    }

    pub fn oauth(mut self, o: Arc<CanvasOAuth2>) -> Self {
        self.oauth = Some(o);
        self
    }

    pub fn http(mut self, h: reqwest::Client) -> Self {
        self.http = Some(h);
        self
    }

    /// Override OAuth scopes. Default is an empty `Vec`, meaning the user's
    /// Developer Key / account defaults apply — Canvas instances that haven't
    /// enabled the specific `url:GET|...` scopes will 400 `invalid_scope` if
    /// we hard-code them, so opt-in is the safer default.
    pub fn scopes(mut self, scopes: Vec<String>) -> Self {
        self.scopes = Some(scopes);
        self
    }

    pub fn build(self) -> CanvasConnector {
        let http = self.http.unwrap_or_default();
        let store = self.token_store.unwrap_or_else(|| Arc::new(InMemoryTokenStore::new()));
        let client = CanvasClient::with_http(&self.base_url, "", http);
        CanvasConnector {
            manifest: default_manifest(self.scopes.unwrap_or_default()),
            account_id: self.account_id,
            token_store: store,
            oauth: self.oauth,
            client: Mutex::new(client),
        }
    }
}

fn default_manifest(scopes: Vec<String>) -> ConnectorManifest {
    ConnectorManifest {
        id: "canvas".into(),
        version: "0.1.0".into(),
        display_name: "Canvas LMS".into(),
        // Empty scopes vec = "use user's default permissions". Canvas's
        // Developer Key + OAuth flow handles this correctly; hard-coded
        // `url:GET|...` scopes 400 on instances that haven't enabled them.
        auth_strategy: AuthStrategy::OAuth2 { scopes },
        sync_mode: SyncMode::Polling { cadence_seconds: 900 },
        capabilities: vec![],
        entity_types: vec![
            "course".into(),
            "assignment".into(),
            "submission".into(),
            "announcement".into(),
            "user_profile".into(),
            "course_progress".into(),
            "enrollment".into(),
            "calendar_event".into(),
            "user_grade".into(),
            "discussion_topic".into(),
            "discussion_entry".into(),
            "quiz".into(),
            "quiz_submission".into(),
            "module".into(),
            "module_item".into(),
            "page".into(),
            "conversation".into(),
            "planner_item".into(),
            "planner_note".into(),
            "todo_item".into(),
            "group".into(),
            "group_membership".into(),
            "file".into(),
            "rubric".into(),
            "rubric_assessment".into(),
            "outcome".into(),
            "outcome_result".into(),
        ],
        event_types: vec![
            "assignment_due".into(),
            "assignment_due_soon".into(),
            "assignment_overdue".into(),
            "assignment_graded".into(),
            "grade_posted".into(),
            "course_enrolled".into(),
            "announcement_posted".into(),
            "canvas:course_progress_updated".into(),
            "canvas:event_started".into(),
            "canvas:event_started_assignment".into(),
            "canvas:discussion_topic_created".into(),
            "canvas:discussion_reply_created".into(),
            "canvas:quiz_created".into(),
            "canvas:quiz_attempted".into(),
            "canvas:module_item_completed".into(),
            "canvas:planner_item_created".into(),
            "canvas:planner_note_created".into(),
            "canvas:todo_item_added".into(),
            "canvas:group_joined".into(),
            "canvas:file_created".into(),
            "canvas:rubric_score_updated".into(),
            "canvas:outcome_mastered".into(),
        ],
        tier: VerificationTier::Official,
        health_indicators: vec!["oauth_token_valid".into(), "last_sync_ok".into()],
    }
}

impl CanvasConnector {
    pub fn builder(base_url: impl Into<String>) -> CanvasConnectorBuilder {
        CanvasConnectorBuilder::new(base_url)
    }

    /// Load token from store and push into the HTTP client.
    #[async_instrumented]
    async fn refresh_client_token(&self) -> Result<()> {
        let tok = self
            .token_store
            .load()
            .await?
            .ok_or_else(|| ConnectorError::Auth("no token".into()))?;
        let mut c = self.client.lock().await;
        c.set_access_token(tok.access_token);
        Ok(())
    }

    /// Try to refresh via OAuth if we have the machinery, else surface auth error.
    #[async_instrumented]
    async fn try_token_refresh(&self) -> Result<()> {
        let oauth = self
            .oauth
            .as_ref()
            .ok_or_else(|| ConnectorError::Auth("no oauth configured".into()))?;
        let existing = self
            .token_store
            .load()
            .await?
            .ok_or_else(|| ConnectorError::Auth("no token to refresh".into()))?;
        let refresh = existing
            .refresh_token
            .clone()
            .ok_or_else(|| ConnectorError::Auth("no refresh token".into()))?;
        let http = reqwest::Client::new();
        let new = oauth.refresh(&refresh, &http).await?;
        self.token_store.save(&new).await?;
        self.refresh_client_token().await
    }
}

impl Default for CanvasConnector {
    fn default() -> Self {
        CanvasConnector::builder("https://canvas.instructure.com").build()
    }
}

/// Fully-paginate a per-course listing up to [`MAX_PAGES_PER_COURSE`].
/// Logs a warning (but does not fail) if the cap is hit.
async fn drain_paginated<T, F, Fut>(
    label: &'static str,
    course_id: u64,
    mut fetch: F,
) -> std::result::Result<Vec<T>, ConnectorError>
where
    F: FnMut(Option<String>) -> Fut,
    Fut: std::future::Future<Output = std::result::Result<api::Page<T>, ConnectorError>>,
{
    let mut all = Vec::new();
    let mut cursor: Option<String> = None;
    for page_ix in 0..MAX_PAGES_PER_COURSE {
        let page = fetch(cursor.clone()).await?;
        all.extend(page.items);
        match page.next_cursor {
            Some(next) => cursor = Some(next),
            None => return Ok(all),
        }
        if page_ix + 1 == MAX_PAGES_PER_COURSE {
            warn!(
                target: "connector_canvas::sync",
                course_id,
                label,
                max_pages = MAX_PAGES_PER_COURSE,
                "hit per-course pagination cap; truncating"
            );
        }
    }
    Ok(all)
}

#[async_trait]
impl Connector for CanvasConnector {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        if self.refresh_client_token().await.is_err() {
            return HealthState::Unauthenticated;
        }
        let client = self.client.lock().await.clone();
        match client.get_self().await {
            Ok(_) => HealthState::Healthy,
            Err(ConnectorError::Auth(_)) => HealthState::Unauthenticated,
            Err(e) => HealthState::Failing(e.to_string()),
        }
    }

    async fn sync(&self, cursor: Option<String>) -> Result<SyncOutcome> {
        // Ensure token is loaded.
        self.refresh_client_token().await?;
        let client = { self.client.lock().await.clone() };

        // Courses page. Cursor here is a course-listing cursor. Once courses are
        // exhausted we don't paginate assignments within a single sync; we emit
        // what we have and hand back next_cursor so the driver can continue.
        let course_page = match client.list_courses(None, cursor.clone()).await {
            Ok(p) => p,
            Err(ConnectorError::Auth(_)) => {
                // Try a refresh and a single retry.
                self.try_token_refresh().await?;
                let client = self.client.lock().await.clone();
                client.list_courses(None, cursor).await?
            }
            Err(e) => return Err(e),
        };

        let now = Utc::now();
        let mut events = Vec::new();
        for course in &course_page.items {
            events.push(CanvasEventMapper::map_course_enrolled(course, self.account_id));

            // Fully paginate assignments for this course.
            let assignments = {
                let c = client.clone();
                let course_id = course.id;
                drain_paginated("assignments", course_id, move |cur| {
                    let c = c.clone();
                    async move { c.list_assignments(course_id, cur).await }
                })
                .await
            };
            let assignments = match assignments {
                Ok(a) => a,
                Err(e) => {
                    warn!(course_id = course.id, error = %e, "skipping assignments");
                    continue;
                }
            };

            for a in &assignments {
                events.push(CanvasEventMapper::map_assignment(a, self.account_id, Some(course.id)));

                // Fully paginate submissions for this assignment. Collect
                // them so we can compute due-soon/overdue with accurate
                // submission presence.
                let submissions = {
                    let c = client.clone();
                    let assignment_id = a.id;
                    let course_id = course.id;
                    drain_paginated("submissions", course_id, move |cur| {
                        let c = c.clone();
                        async move { c.list_submissions(assignment_id, course_id, cur).await }
                    })
                    .await
                };
                let submissions = submissions.unwrap_or_else(|e| {
                    warn!(
                        course_id = course.id,
                        assignment_id = a.id,
                        error = %e,
                        "skipping submissions"
                    );
                    Vec::new()
                });

                let has_submission =
                    submissions.iter().any(|s| s.submitted_at.is_some() || s.score.is_some());

                for s in &submissions {
                    events.push(CanvasEventMapper::map_submission(s, self.account_id));
                    if let Some(ev) = CanvasEventMapper::map_grade_posted(s, self.account_id) {
                        events.push(ev);
                    }
                }

                if let Some(ev) = CanvasEventMapper::map_assignment_due_soon(
                    a,
                    self.account_id,
                    now,
                    Some(course.id),
                ) {
                    events.push(ev);
                }
                if let Some(ev) = CanvasEventMapper::map_assignment_overdue(
                    a,
                    self.account_id,
                    now,
                    has_submission,
                    Some(course.id),
                ) {
                    events.push(ev);
                }
            }

            // Announcements. Best-effort: failure here shouldn't sink the sync.
            let announcements = {
                let c = client.clone();
                let course_id = course.id;
                drain_paginated("announcements", course_id, move |cur| {
                    let c = c.clone();
                    async move { c.list_announcements(course_id, cur).await }
                })
                .await
            };
            match announcements {
                Ok(anns) => {
                    for ann in &anns {
                        events.push(CanvasEventMapper::map_announcement_posted(
                            ann,
                            self.account_id,
                            course.id,
                        ));
                    }
                }
                Err(e) => {
                    warn!(course_id = course.id, error = %e, "skipping announcements");
                }
            }
        }

        Ok(SyncOutcome { events, next_cursor: course_page.next_cursor, partial: false })
    }
}

// Legacy re-exports preserved for callers of the old stub API.
pub struct CanvasEntity;

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    #[test]
    fn default_manifest_scopes_are_empty() {
        let m = default_manifest(vec![]);
        if let AuthStrategy::OAuth2 { scopes } = &m.auth_strategy {
            assert!(scopes.is_empty(), "default scopes must be empty to avoid invalid_scope 400");
        } else {
            panic!("expected OAuth2 strategy");
        }
    }

    #[test]
    fn builder_scopes_override_applies() {
        let conn = CanvasConnector::builder("https://x")
            .scopes(vec!["url:GET|/api/v1/courses".into()])
            .build();
        if let AuthStrategy::OAuth2 { scopes } = &conn.manifest().auth_strategy {
            assert_eq!(scopes.len(), 1);
        } else {
            panic!("expected OAuth2 strategy");
        }
    }

    #[test]
    fn manifest_declares_new_event_types() {
        let m = default_manifest(vec![]);
        for want in
            ["assignment_due_soon", "assignment_overdue", "grade_posted", "announcement_posted"]
        {
            assert!(m.event_types.iter().any(|e| e == want), "missing event: {want}");
        }
    }
}
