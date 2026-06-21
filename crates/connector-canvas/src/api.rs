// SPDX-License-Identifier: MIT OR Apache-2.0

//! Canvas REST client.

use phenotype_observably_macros::async_instrumented;
use focus_connectors::ConnectorError;
use reqwest::header::{HeaderMap, AUTHORIZATION, LINK, RETRY_AFTER};
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use tracing::{debug, warn};

use crate::models::{
    Announcement, Assignment, CalendarEvent, CanvasUser, Conversation, Course, CourseProgress,
    DiscussionEntry, DiscussionTopic, Enrollment, File, Group, GroupMembership, Module, ModuleItem,
    Outcome, OutcomeResult, PlannerItem, PlannerNote, Quiz, QuizSubmission, Rubric,
    RubricAssessment, Submission, TodoItem, UserGrade, WikiPage,
};

/// Minimal Canvas REST client.
#[derive(Debug, Clone)]
pub struct CanvasClient {
    pub base_url: String,
    pub access_token: String,
    http: reqwest::Client,
}

/// Result of a paginated listing.
#[derive(Debug, Clone)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
}

impl CanvasClient {
    pub fn new(base_url: impl Into<String>, access_token: impl Into<String>) -> Self {
        Self::with_http(base_url, access_token, reqwest::Client::new())
    }

    pub fn with_http(
        base_url: impl Into<String>,
        access_token: impl Into<String>,
        http: reqwest::Client,
    ) -> Self {
        Self {
            base_url: base_url.into().trim_end_matches('/').to_string(),
            access_token: access_token.into(),
            http,
        }
    }

    pub fn set_access_token(&mut self, token: impl Into<String>) {
        self.access_token = token.into();
    }

    fn auth_headers(&self) -> HeaderMap {
        let mut h = HeaderMap::new();
        if let Ok(v) = format!("Bearer {}", self.access_token).parse() {
            h.insert(AUTHORIZATION, v);
        }
        h
    }

    async fn get_json<T: DeserializeOwned>(
        &self,
        url: &str,
    ) -> Result<(T, HeaderMap), ConnectorError> {
        let resp = self
            .http
            .get(url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| ConnectorError::Network(e.to_string()))?;

        let status = resp.status();
        let headers = resp.headers().clone();

        // Log the X-Request-Cost for future budget-aware throttling. Canvas
        // emits this on essentially every response (successful or not).
        if let Some(cost) = headers.get("X-Request-Cost").and_then(|v| v.to_str().ok()) {
            debug!(target: "canvas::api", url = %url, request_cost = cost, "canvas request cost");
        }

        match status {
            s if s.is_success() => {
                let body: T =
                    resp.json().await.map_err(|e| ConnectorError::Schema(e.to_string()))?;
                Ok((body, headers))
            }
            StatusCode::UNAUTHORIZED => Err(ConnectorError::Auth("401 from Canvas".into())),
            StatusCode::FORBIDDEN => {
                // Canvas reuses 403 for two distinct conditions:
                //   1. throttle / rate-limit — body contains "Rate Limit Exceeded"
                //   2. genuine permission denied
                // Preserve the body text for debugging then classify.
                let body_text = resp.text().await.unwrap_or_default();
                if body_text.to_lowercase().contains("rate limit exceeded") {
                    let retry = parse_retry_after(&headers).unwrap_or(30);
                    warn!(target: "canvas::api", retry_after = retry, "canvas 403 rate-limit");
                    Err(ConnectorError::RateLimited(retry))
                } else {
                    Err(ConnectorError::Auth(format!(
                        "403 from Canvas (permission denied): {}",
                        truncate(&body_text, 256)
                    )))
                }
            }
            StatusCode::TOO_MANY_REQUESTS => {
                // 429 is unambiguous — honor Retry-After if present.
                let retry = parse_retry_after(&headers).unwrap_or(30);
                warn!(target: "canvas::api", retry_after = retry, "canvas 429 rate-limit");
                Err(ConnectorError::RateLimited(retry))
            }
            other => Err(ConnectorError::Network(format!("HTTP {other}"))),
        }
    }

    async fn list_paginated<T: DeserializeOwned>(
        &self,
        initial_url: String,
        cursor: Option<String>,
    ) -> Result<Page<T>, ConnectorError> {
        let url = cursor.unwrap_or(initial_url);
        let (items, headers) = self.get_json::<Vec<T>>(&url).await?;
        let next_cursor = parse_next_link(headers.get(LINK).and_then(|v| v.to_str().ok()));
        Ok(Page { items, next_cursor })
    }

    /// List courses. If `user_id` is None uses `self`.
    #[async_instrumented]
    pub async fn list_courses(
        &self,
        user_id: Option<u64>,
        cursor: Option<String>,
    ) -> Result<Page<Course>, ConnectorError> {
        let who = user_id.map(|i| i.to_string()).unwrap_or_else(|| "self".into());
        let url = format!(
            "{}/api/v1/users/{}/courses?per_page=50&enrollment_state=active",
            self.base_url, who
        );
        self.list_paginated(url, cursor).await
    }

    #[async_instrumented]
    pub async fn list_assignments(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Assignment>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/assignments?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    #[async_instrumented]
    pub async fn list_submissions(
        &self,
        assignment_id: u64,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Submission>, ConnectorError> {
        let url = format!(
            "{}/api/v1/courses/{}/assignments/{}/submissions?per_page=50",
            self.base_url, course_id, assignment_id
        );
        self.list_paginated(url, cursor).await
    }

    /// List announcements for a given course via Canvas's
    /// `/api/v1/announcements?context_codes[]=course_<id>` endpoint.
    pub async fn list_announcements(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Announcement>, ConnectorError> {
        let url = format!(
            "{}/api/v1/announcements?context_codes[]=course_{}&per_page=50",
            self.base_url, course_id
        );
        self.list_paginated(url, cursor).await
    }

    pub async fn get_self(&self) -> Result<CanvasUser, ConnectorError> {
        let url = format!("{}/api/v1/users/self", self.base_url);
        let (u, _) = self.get_json::<CanvasUser>(&url).await?;
        Ok(u)
    }

    /// Get current user's profile (name, email, avatar_url, locale).
    ///
    /// See: <https://canvas.instructure.com/doc/api/users.html#method.users.show>
    pub async fn get_user_profile(&self) -> Result<CanvasUser, ConnectorError> {
        self.get_self().await
    }

    /// Get course progress % for a user in a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/courses.html#method.courses.progress>
    pub async fn get_course_progress(
        &self,
        course_id: u64,
        user_id: Option<u64>,
    ) -> Result<CourseProgress, ConnectorError> {
        let who = user_id.map(|i| i.to_string()).unwrap_or_else(|| "self".into());
        let url = format!("{}/api/v1/users/{}/courses/{}/progress", self.base_url, who, course_id);
        let (p, _) = self.get_json::<CourseProgress>(&url).await?;
        Ok(p)
    }

    /// List enrolled students in a course (requires teacher/admin permission).
    ///
    /// See: <https://canvas.instructure.com/doc/api/enrollments.html#method.enrollments.index>
    pub async fn list_students(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Enrollment>, ConnectorError> {
        let url = format!(
            "{}/api/v1/courses/{}/users?enrollment_type[]=student&per_page=50&include[]=email&include[]=avatar_url",
            self.base_url, course_id
        );
        self.list_paginated(url, cursor).await
    }

    /// Get a single assignment with full details (due dates, points, etc).
    ///
    /// See: <https://canvas.instructure.com/doc/api/assignments.html#method.assignments.show>
    pub async fn get_assignment(
        &self,
        course_id: u64,
        assignment_id: u64,
    ) -> Result<Assignment, ConnectorError> {
        let url =
            format!("{}/api/v1/courses/{}/assignments/{}", self.base_url, course_id, assignment_id);
        let (a, _) = self.get_json::<Assignment>(&url).await?;
        Ok(a)
    }

    /// Get user's aggregate grades across all enrollments.
    ///
    /// See: <https://canvas.instructure.com/doc/api/enrollments.html#method.enrollments.index>
    pub async fn get_user_grades(&self) -> Result<Vec<UserGrade>, ConnectorError> {
        let url = format!(
            "{}/api/v1/users/self/enrollments?include[]=current_score&include[]=final_score&include[]=grades&per_page=100",
            self.base_url
        );
        let (grades, _) = self.get_json::<Vec<UserGrade>>(&url).await?;
        Ok(grades)
    }

    /// Get calendar events for a course (distinct from assignments).
    ///
    /// See: <https://canvas.instructure.com/doc/api/calendar_events.html#method.calendar_events.list>
    pub async fn list_calendar_events(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<CalendarEvent>, ConnectorError> {
        let url = format!(
            "{}/api/v1/calendar_events?context_codes[]=course_{}&per_page=50",
            self.base_url, course_id
        );
        self.list_paginated(url, cursor).await
    }

    /// List discussion topics for a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/discussion_topics.html#method.discussion_topics.index>
    pub async fn list_discussion_topics(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<DiscussionTopic>, ConnectorError> {
        let url =
            format!("{}/api/v1/courses/{}/discussion_topics?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// List discussion entries (replies) for a topic.
    ///
    /// See: <https://canvas.instructure.com/doc/api/discussion_topics.html#method.discussion_entries.index>
    pub async fn list_discussion_entries(
        &self,
        course_id: u64,
        topic_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<DiscussionEntry>, ConnectorError> {
        let url = format!(
            "{}/api/v1/courses/{}/discussion_topics/{}/entries?per_page=50",
            self.base_url, course_id, topic_id
        );
        self.list_paginated(url, cursor).await
    }

    /// List quizzes for a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/quizzes.html#method.quizzes.index>
    pub async fn list_quizzes(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Quiz>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/quizzes?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// Get quiz submissions (user attempts) for a quiz.
    ///
    /// See: <https://canvas.instructure.com/doc/api/quiz_submissions.html#method.quiz_submissions.index>
    pub async fn get_quiz_submissions(
        &self,
        course_id: u64,
        quiz_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<QuizSubmission>, ConnectorError> {
        let url = format!(
            "{}/api/v1/courses/{}/quizzes/{}/submissions?per_page=50",
            self.base_url, course_id, quiz_id
        );
        self.list_paginated(url, cursor).await
    }

    /// List modules for a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/modules.html#method.context_modules.index>
    pub async fn list_modules(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Module>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/modules?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// List module items for a specific module.
    ///
    /// See: <https://canvas.instructure.com/doc/api/modules.html#method.module_items.index>
    pub async fn list_module_items(
        &self,
        course_id: u64,
        module_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<ModuleItem>, ConnectorError> {
        let url = format!(
            "{}/api/v1/courses/{}/modules/{}/items?per_page=50",
            self.base_url, course_id, module_id
        );
        self.list_paginated(url, cursor).await
    }

    /// List wiki pages for a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/pages.html#method.wiki_pages.index>
    pub async fn list_pages(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<WikiPage>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/pages?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// List conversations (messages) for the current user.
    ///
    /// See: <https://canvas.instructure.com/doc/api/conversations.html#method.conversations.index>
    pub async fn list_conversations(
        &self,
        cursor: Option<String>,
    ) -> Result<Page<Conversation>, ConnectorError> {
        let url = format!("{}/api/v1/conversations?per_page=50", self.base_url);
        self.list_paginated(url, cursor).await
    }

    /// Get a specific conversation.
    ///
    /// See: <https://canvas.instructure.com/doc/api/conversations.html#method.conversations.show>
    pub async fn get_conversation(
        &self,
        conversation_id: u64,
    ) -> Result<Conversation, ConnectorError> {
        let url = format!("{}/api/v1/conversations/{}", self.base_url, conversation_id);
        let (c, _) = self.get_json::<Conversation>(&url).await?;
        Ok(c)
    }

    /// List planner items for the current user.
    ///
    /// See: <https://canvas.instructure.com/doc/api/planner.html#method.planner.index>
    pub async fn list_planner_items(
        &self,
        cursor: Option<String>,
    ) -> Result<Page<PlannerItem>, ConnectorError> {
        let url = format!("{}/api/v1/planner/items?per_page=50", self.base_url);
        self.list_paginated(url, cursor).await
    }

    /// List planner notes for the current user.
    ///
    /// See: <https://canvas.instructure.com/doc/api/planner_notes.html#method.planner_notes.index>
    pub async fn list_planner_notes(
        &self,
        cursor: Option<String>,
    ) -> Result<Page<PlannerNote>, ConnectorError> {
        let url = format!("{}/api/v1/planner_notes?per_page=50", self.base_url);
        self.list_paginated(url, cursor).await
    }

    /// List to-do items for the current user.
    ///
    /// See: <https://canvas.instructure.com/doc/api/users.html#method.users.todo>
    pub async fn list_todo(
        &self,
        cursor: Option<String>,
    ) -> Result<Page<TodoItem>, ConnectorError> {
        let url = format!("{}/api/v1/users/self/todo?per_page=50", self.base_url);
        self.list_paginated(url, cursor).await
    }

    /// List groups for the current user.
    ///
    /// See: <https://canvas.instructure.com/doc/api/groups.html#method.groups.index>
    pub async fn list_groups(&self, cursor: Option<String>) -> Result<Page<Group>, ConnectorError> {
        let url = format!("{}/api/v1/groups?per_page=50", self.base_url);
        self.list_paginated(url, cursor).await
    }

    /// List group memberships for a specific group (requires teacher/admin).
    ///
    /// See: <https://canvas.instructure.com/doc/api/groups.html#method.memberships.index>
    pub async fn list_group_memberships(
        &self,
        group_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<GroupMembership>, ConnectorError> {
        let url = format!("{}/api/v1/groups/{}/memberships?per_page=50", self.base_url, group_id);
        self.list_paginated(url, cursor).await
    }

    /// List files for a course (metadata only; does NOT fetch content).
    ///
    /// See: <https://canvas.instructure.com/doc/api/files.html#method.files.index>
    pub async fn list_files(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<File>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/files?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// List rubrics for a course (requires teacher/admin).
    ///
    /// See: <https://canvas.instructure.com/doc/api/rubrics.html#method.rubrics.index>
    pub async fn list_rubrics(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Rubric>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/rubrics?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// Get rubric assessments for a submission (requires teacher/admin).
    ///
    /// See: <https://canvas.instructure.com/doc/api/rubrics.html#method.rubric_assessments.index>
    pub async fn list_rubric_assessments(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<RubricAssessment>, ConnectorError> {
        let url = format!(
            "{}/api/v1/courses/{}/rubric_assessments?per_page=50",
            self.base_url, course_id
        );
        self.list_paginated(url, cursor).await
    }

    /// List learning outcomes for a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/outcomes.html#method.outcomes.index>
    pub async fn list_outcomes(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<Outcome>, ConnectorError> {
        let url = format!("{}/api/v1/courses/{}/outcomes?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }

    /// Get outcome results (mastery data) for a course.
    ///
    /// See: <https://canvas.instructure.com/doc/api/outcomes.html#method.outcome_results.index>
    pub async fn list_outcome_results(
        &self,
        course_id: u64,
        cursor: Option<String>,
    ) -> Result<Page<OutcomeResult>, ConnectorError> {
        let url =
            format!("{}/api/v1/courses/{}/outcome_results?per_page=50", self.base_url, course_id);
        self.list_paginated(url, cursor).await
    }
}

/// Parse a Canvas `Link` header and return the URL with `rel="next"`, if present.
pub fn parse_next_link(link: Option<&str>) -> Option<String> {
    let link = link?;
    for part in link.split(',') {
        let seg = part.trim();
        // Example: <https://canvas/.../?page=2>; rel="next"
        let (url_part, rel_part) = seg.split_once(';')?;
        let url = url_part.trim().trim_start_matches('<').trim_end_matches('>');
        if rel_part.contains("rel=\"next\"") {
            return Some(url.to_string());
        }
    }
    None
}

/// Parse `Retry-After` as integer seconds. Canvas sends seconds, not HTTP-date,
/// in practice; we only support the seconds form.
fn parse_retry_after(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<u64>().ok())
}

fn truncate(s: &str, max: usize) -> String {
    if s.len() <= max {
        s.to_string()
    } else {
        format!("{}…", &s[..max])
    }
}

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;
    use wiremock::matchers::{header, method, path, path_regex, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[test]
    fn parse_next_link_finds_next() {
        let header = "<https://c.example/api/v1/x?page=1>; rel=\"current\", <https://c.example/api/v1/x?page=2>; rel=\"next\", <https://c.example/api/v1/x?page=5>; rel=\"last\"";
        let next = parse_next_link(Some(header));
        assert_eq!(next.as_deref(), Some("https://c.example/api/v1/x?page=2"));
    }

    #[test]
    fn parse_next_link_absent() {
        assert!(parse_next_link(None).is_none());
        assert!(parse_next_link(Some("<x>; rel=\"last\"")).is_none());
    }

    #[tokio::test]
    async fn lists_courses_and_follows_pagination() {
        let server = MockServer::start().await;
        let base = server.uri();
        let next_url = format!("{base}/api/v1/users/self/courses?page=2");
        let link_hdr = format!("<{next_url}>; rel=\"next\"");

        Mock::given(method("GET"))
            .and(path_regex(r"^/api/v1/users/self/courses$"))
            .and(header("authorization", "Bearer TOK"))
            .respond_with(
                ResponseTemplate::new(200).insert_header("Link", link_hdr.as_str()).set_body_json(
                    serde_json::json!([{"id":1,"name":"A","workflow_state":"available"}]),
                ),
            )
            .mount(&server)
            .await;

        let client = CanvasClient::new(&base, "TOK");
        let page = client.list_courses(None, None).await.unwrap();
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].id, 1);
        assert_eq!(page.next_cursor.as_deref(), Some(next_url.as_str()));
    }

    #[tokio::test]
    async fn unauthorized_maps_to_auth_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path_regex(r"^/api/v1/users/self$"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&server)
            .await;
        let client = CanvasClient::new(server.uri(), "bad");
        let err = client.get_self().await.unwrap_err();
        assert!(matches!(err, ConnectorError::Auth(_)));
    }

    #[tokio::test]
    async fn forbidden_with_rate_limit_body_maps_to_rate_limit() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path_regex(r"^/api/v1/users/self$"))
            .respond_with(
                ResponseTemplate::new(403)
                    .insert_header("X-Request-Cost", "100.0")
                    .insert_header("Retry-After", "42")
                    .set_body_string("403 Forbidden (Rate Limit Exceeded)"),
            )
            .mount(&server)
            .await;
        let client = CanvasClient::new(server.uri(), "t");
        let err = client.get_self().await.unwrap_err();
        match err {
            ConnectorError::RateLimited(secs) => assert_eq!(secs, 42),
            other => panic!("expected RateLimited, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn forbidden_without_rate_limit_body_maps_to_auth() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path_regex(r"^/api/v1/users/self$"))
            .respond_with(
                ResponseTemplate::new(403).set_body_string("user lacks permission to view self"),
            )
            .mount(&server)
            .await;
        let client = CanvasClient::new(server.uri(), "t");
        let err = client.get_self().await.unwrap_err();
        match err {
            ConnectorError::Auth(msg) => assert!(msg.contains("permission denied"), "got: {msg}"),
            other => panic!("expected Auth error, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn too_many_requests_honors_retry_after() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path_regex(r"^/api/v1/users/self$"))
            .respond_with(ResponseTemplate::new(429).insert_header("Retry-After", "17"))
            .mount(&server)
            .await;
        let client = CanvasClient::new(server.uri(), "t");
        let err = client.get_self().await.unwrap_err();
        match err {
            ConnectorError::RateLimited(secs) => assert_eq!(secs, 17),
            other => panic!("expected RateLimited, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn too_many_requests_defaults_when_retry_after_missing() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path_regex(r"^/api/v1/users/self$"))
            .respond_with(ResponseTemplate::new(429))
            .mount(&server)
            .await;
        let client = CanvasClient::new(server.uri(), "t");
        let err = client.get_self().await.unwrap_err();
        assert!(matches!(err, ConnectorError::RateLimited(30)));
    }

    #[tokio::test]
    async fn list_announcements_hits_expected_endpoint() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/v1/announcements"))
            .and(query_param("context_codes[]", "course_101"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!([
                {"id": 5, "title": "Welcome", "message": "<p>hi</p>", "posted_at": "2026-04-01T12:00:00Z"}
            ])))
            .mount(&server)
            .await;
        let client = CanvasClient::new(server.uri(), "t");
        let page = client.list_announcements(101, None).await.unwrap();
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].id, 5);
    }
}
