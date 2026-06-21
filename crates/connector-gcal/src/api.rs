// SPDX-License-Identifier: MIT OR Apache-2.0

//! Google Calendar v3 REST client.

use focus_connectors::ConnectorError;
use phenotype_observably_macros::async_instrumented;
use reqwest::header::{HeaderMap, AUTHORIZATION, RETRY_AFTER};
use reqwest::StatusCode;
use serde::de::DeserializeOwned;
use tracing::warn;

use crate::models::{CalendarList, CalendarListEntry, EventList, GCalEvent, GCalUser, WatchResponse};

pub const GOOGLE_API_BASE: &str = "https://www.googleapis.com";

/// Minimal Google Calendar v3 REST client.
#[derive(Debug, Clone)]
pub struct GCalClient {
    pub base_url: String,
    pub access_token: String,
    http: reqwest::Client,
}

/// Result of a paginated listing. Google uses `pageToken` (an opaque string)
/// rather than `Link` headers — we expose it as `next_cursor`.
#[derive(Debug, Clone)]
pub struct Page<T> {
    pub items: Vec<T>,
    pub next_cursor: Option<String>,
}

impl GCalClient {
    pub fn new(access_token: impl Into<String>) -> Self {
        Self::with_http(GOOGLE_API_BASE, access_token, reqwest::Client::new())
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

    #[async_instrumented]
    async fn get_json<T: DeserializeOwned>(&self, url: &str) -> Result<T, ConnectorError> {
        let resp = self
            .http
            .get(url)
            .headers(self.auth_headers())
            .send()
            .await
            .map_err(|e| ConnectorError::Network(e.to_string()))?;

        let status = resp.status();
        let headers = resp.headers().clone();

        match status {
            s if s.is_success() => {
                resp.json::<T>().await.map_err(|e| ConnectorError::Schema(e.to_string()))
            }
            StatusCode::UNAUTHORIZED => Err(ConnectorError::Auth("401 from Google".into())),
            StatusCode::FORBIDDEN => {
                // Google's 403 is either:
                //   * `rateLimitExceeded` / `userRateLimitExceeded` — throttle
                //   * `forbidden` / `insufficientPermissions` — real denial
                // The discriminator is in the JSON body: `error.errors[].reason`.
                let body_text = resp.text().await.unwrap_or_default();
                if looks_like_rate_limit(&body_text) {
                    let retry = parse_retry_after(&headers).unwrap_or(30);
                    warn!(
                        target: "gcal::api",
                        retry_after = retry,
                        "gcal 403 rate-limit"
                    );
                    Err(ConnectorError::RateLimited(retry))
                } else {
                    Err(ConnectorError::Auth(format!(
                        "403 from Google (permission denied): {}",
                        truncate(&body_text, 256)
                    )))
                }
            }
            StatusCode::TOO_MANY_REQUESTS => {
                let retry = parse_retry_after(&headers).unwrap_or(30);
                warn!(target: "gcal::api", retry_after = retry, "gcal 429 rate-limit");
                Err(ConnectorError::RateLimited(retry))
            }
            other => Err(ConnectorError::Network(format!("HTTP {other}"))),
        }
    }

    #[async_instrumented]
    async fn post_json<T: serde::Serialize, R: DeserializeOwned>(
        &self,
        url: &str,
        body: &T,
    ) -> Result<R, ConnectorError> {
        let resp = self
            .http
            .post(url)
            .headers(self.auth_headers())
            .json(body)
            .send()
            .await
            .map_err(|e| ConnectorError::Network(e.to_string()))?;

        let status = resp.status();
        let headers = resp.headers().clone();

        match status {
            s if s.is_success() => {
                resp.json::<R>().await.map_err(|e| ConnectorError::Schema(e.to_string()))
            }
            StatusCode::UNAUTHORIZED => Err(ConnectorError::Auth("401 from Google".into())),
            StatusCode::FORBIDDEN => {
                let body_text = resp.text().await.unwrap_or_default();
                if looks_like_rate_limit(&body_text) {
                    let retry = parse_retry_after(&headers).unwrap_or(30);
                    Err(ConnectorError::RateLimited(retry))
                } else {
                    Err(ConnectorError::Auth(format!(
                        "403 from Google (permission denied): {}",
                        truncate(&body_text, 256)
                    )))
                }
            }
            StatusCode::TOO_MANY_REQUESTS => {
                let retry = parse_retry_after(&headers).unwrap_or(30);
                Err(ConnectorError::RateLimited(retry))
            }
            other => {
                let body_text = resp.text().await.unwrap_or_default();
                Err(ConnectorError::Network(format!("HTTP {other}: {}", truncate(&body_text, 128))))
            }
        }
    }

    /// List all calendars on the user's calendar list.
    ///
    /// `cursor` is Google's `pageToken` from a previous call.
    #[async_instrumented]
    pub async fn list_calendar_list(
        &self,
        cursor: Option<String>,
    ) -> Result<Page<CalendarListEntry>, ConnectorError> {
        let mut url = format!("{}/calendar/v3/users/me/calendarList?maxResults=250", self.base_url);
        if let Some(tok) = cursor {
            url.push_str("&pageToken=");
            url.push_str(&urlencode(&tok));
        }
        let body: CalendarList = self.get_json(&url).await?;
        Ok(Page { items: body.items, next_cursor: body.next_page_token })
    }

    /// List events on a single calendar, expanded as single instances and
    /// ordered by start time within the `[time_min, time_max]` window.
    ///
    /// `time_min` / `time_max` are RFC3339 strings (callers build these from
    /// chrono). Both are required to be present by Google when `orderBy` is
    /// `startTime` with `singleEvents=true`.
    #[async_instrumented]
    pub async fn list_events(
        &self,
        calendar_id: &str,
        time_min: &str,
        time_max: &str,
        cursor: Option<String>,
    ) -> Result<Page<GCalEvent>, ConnectorError> {
        let mut url = format!(
            "{}/calendar/v3/calendars/{cal}/events?singleEvents=true&orderBy=startTime&timeMin={tmin}&timeMax={tmax}&maxResults=250",
            self.base_url,
            cal = urlencode(calendar_id),
            tmin = urlencode(time_min),
            tmax = urlencode(time_max),
        );
        if let Some(tok) = cursor {
            url.push_str("&pageToken=");
            url.push_str(&urlencode(&tok));
        }
        let body: EventList = self.get_json(&url).await?;
        Ok(Page { items: body.items, next_cursor: body.next_page_token })
    }

    /// Fetch the user's identity for health-check purposes.
    #[async_instrumented]
    pub async fn get_self(&self) -> Result<GCalUser, ConnectorError> {
        let url = format!("{}/oauth2/v2/userinfo", self.base_url);
        self.get_json::<GCalUser>(&url).await
    }

    /// Get a single event by ID, including full details (attendees, conference, reminders).
    #[async_instrumented]
    pub async fn get_event(
        &self,
        calendar_id: &str,
        event_id: &str,
    ) -> Result<GCalEvent, ConnectorError> {
        let url = format!(
            "{}/calendar/v3/calendars/{}/events/{}",
            self.base_url,
            urlencode(calendar_id),
            urlencode(event_id)
        );
        self.get_json::<GCalEvent>(&url).await
    }

    /// Fetch multiple events by ID in a single batch request.
    /// Returns events in the order requested; missing IDs are skipped.
    #[async_instrumented]
    pub async fn batch_get_events(
        &self,
        calendar_id: &str,
        event_ids: &[&str],
    ) -> Result<Vec<GCalEvent>, ConnectorError> {
        if event_ids.is_empty() {
            return Ok(Vec::new());
        }

        // Batch endpoint: POST /calendar/v3/calendars/{calendarId}/events/batchGet
        // with JSON body: {"ids": ["e1", "e2", ...]}
        let url = format!(
            "{}/calendar/v3/calendars/{}/events/batchGet",
            self.base_url,
            urlencode(calendar_id)
        );

        let req_body = serde_json::json!({
            "ids": event_ids.iter().collect::<Vec<_>>()
        });

        let resp: serde_json::Value = self.post_json(&url, &req_body).await?;

        // Extract events from the response's "events" array
        let events = resp
            .get("events")
            .and_then(|v| v.as_array())
            .map(|arr| {
                arr.iter()
                    .filter_map(|v| serde_json::from_value::<GCalEvent>(v.clone()).ok())
                    .collect()
            })
            .unwrap_or_default();

        Ok(events)
    }

    /// Set up push notifications for a calendar via the `/watch` API.
    /// Returns the watch resource ID and token.
    ///
    /// Requires `FOCALPOINT_GCAL_WEBHOOK_URL` environment variable to be set.
    /// Returns `ConnectorError::Auth` if unset.
    #[async_instrumented]
    pub async fn watch_channel_create(
        &self,
        calendar_id: &str,
    ) -> Result<WatchResponse, ConnectorError> {
        let webhook_url = std::env::var("FOCALPOINT_GCAL_WEBHOOK_URL")
            .map_err(|_| {
                ConnectorError::Auth(
                    "FOCALPOINT_GCAL_WEBHOOK_URL not set; cannot enable watch notifications"
                        .into(),
                )
            })?;

        let url = format!(
            "{}/calendar/v3/calendars/{}/events/watch",
            self.base_url,
            urlencode(calendar_id)
        );

        let req = serde_json::json!({
            "id": uuid::Uuid::new_v4().to_string(),
            "type": "web_hook",
            "address": webhook_url,
        });

        self.post_json::<serde_json::Value, WatchResponse>(&url, &req).await
    }

    /// Stop push notifications for a watch channel.
    pub async fn watch_channel_stop(
        &self,
        calendar_id: &str,
        watch_id: &str,
        resource_id: &str,
    ) -> Result<(), ConnectorError> {
        let url = format!(
            "{}/calendar/v3/calendars/{}/events/stop",
            self.base_url,
            urlencode(calendar_id)
        );

        let req = serde_json::json!({
            "id": watch_id,
            "resourceId": resource_id,
        });

        self.post_json::<serde_json::Value, serde_json::Value>(&url, &req).await?;
        Ok(())
    }

    /// Expand recurring events into concrete instances within a date range.
    /// Fetches the recurring event and queries for instances using `recurringEventId`.
    pub async fn expand_recurring_events(
        &self,
        calendar_id: &str,
        recurring_event_id: &str,
        time_min: &str,
        time_max: &str,
    ) -> Result<Page<GCalEvent>, ConnectorError> {
        let url = format!(
            "{}/calendar/v3/calendars/{}/events?singleEvents=true&orderBy=startTime&timeMin={}&timeMax={}&maxResults=250&recurringEventId={}",
            self.base_url,
            urlencode(calendar_id),
            urlencode(time_min),
            urlencode(time_max),
            urlencode(recurring_event_id),
        );

        let body: EventList = self.get_json(&url).await?;
        Ok(Page { items: body.items, next_cursor: body.next_page_token })
    }
}

fn looks_like_rate_limit(body: &str) -> bool {
    let lower = body.to_lowercase();
    lower.contains("ratelimitexceeded")
        || lower.contains("userratelimitexceeded")
        || lower.contains("rate limit exceeded")
}

fn parse_retry_after(headers: &HeaderMap) -> Option<u64> {
    headers
        .get(RETRY_AFTER)
        .and_then(|v| v.to_str().ok())
        .and_then(|s| s.trim().parse::<u64>().ok())
}

fn urlencode(s: &str) -> String {
    // Minimal percent-encoder — Google accepts the lenient subset.
    // Using `url::form_urlencoded` would also work but pulls a slightly
    // different contract for path segments.
    const HEX: &[u8; 16] = b"0123456789ABCDEF";
    let mut out = String::with_capacity(s.len());
    for &b in s.as_bytes() {
        let safe = b.is_ascii_alphanumeric() || matches!(b, b'-' | b'_' | b'.' | b'~');
        if safe {
            out.push(b as char);
        } else {
            out.push('%');
            out.push(HEX[(b >> 4) as usize] as char);
            out.push(HEX[(b & 0x0f) as usize] as char);
        }
    }
    out
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
    use wiremock::matchers::{header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    #[tokio::test]
    async fn lists_calendar_list() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/calendar/v3/users/me/calendarList"))
            .and(header("authorization", "Bearer TOK"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "items": [{"id":"primary","summary":"Me","primary":true}],
                "nextPageToken": "pg2"
            })))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let page = client.list_calendar_list(None).await.unwrap();
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].id, "primary");
        assert_eq!(page.next_cursor.as_deref(), Some("pg2"));
    }

    #[tokio::test]
    async fn lists_events_with_single_events_and_order() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/calendar/v3/calendars/primary/events"))
            .and(query_param("singleEvents", "true"))
            .and(query_param("orderBy", "startTime"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "items": [{"id":"e1","summary":"A","start":{"dateTime":"2026-05-01T09:00:00Z"},"end":{"dateTime":"2026-05-01T10:00:00Z"}}]
            })))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let page = client
            .list_events("primary", "2026-05-01T00:00:00Z", "2026-05-08T00:00:00Z", None)
            .await
            .unwrap();
        assert_eq!(page.items.len(), 1);
        assert_eq!(page.items[0].id, "e1");
        assert!(page.next_cursor.is_none());
    }

    #[tokio::test]
    async fn unauthorized_maps_to_auth_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/oauth2/v2/userinfo"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "bad", reqwest::Client::new());
        let err = client.get_self().await.unwrap_err();
        assert!(matches!(err, ConnectorError::Auth(_)));
    }

    #[tokio::test]
    async fn forbidden_with_rate_limit_body_maps_to_rate_limit() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/oauth2/v2/userinfo"))
            .respond_with(
                ResponseTemplate::new(403).insert_header("Retry-After", "42").set_body_json(
                    serde_json::json!({
                        "error": {
                            "code": 403,
                            "errors": [{"reason": "rateLimitExceeded"}]
                        }
                    }),
                ),
            )
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "t", reqwest::Client::new());
        let err = client.get_self().await.unwrap_err();
        match err {
            ConnectorError::RateLimited(secs) => assert_eq!(secs, 42),
            other => panic!("expected RateLimited, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn forbidden_permission_denied_maps_to_auth() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/oauth2/v2/userinfo"))
            .respond_with(ResponseTemplate::new(403).set_body_json(serde_json::json!({
                "error": {"code": 403, "message":"insufficient permissions"}
            })))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "t", reqwest::Client::new());
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
            .and(path("/oauth2/v2/userinfo"))
            .respond_with(ResponseTemplate::new(429).insert_header("Retry-After", "17"))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "t", reqwest::Client::new());
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
            .and(path("/oauth2/v2/userinfo"))
            .respond_with(ResponseTemplate::new(429))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "t", reqwest::Client::new());
        let err = client.get_self().await.unwrap_err();
        assert!(matches!(err, ConnectorError::RateLimited(30)));
    }

    #[test]
    fn urlencode_escapes_nonalpha() {
        assert_eq!(urlencode("a@b.com"), "a%40b.com");
        assert_eq!(urlencode("2026-05-01T00:00:00Z"), "2026-05-01T00%3A00%3A00Z");
        assert_eq!(urlencode("primary"), "primary");
    }

    #[tokio::test]
    async fn get_event_single_detail() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/calendar/v3/calendars/primary/events/e1"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "id": "e1",
                "summary": "Team Meeting",
                "start": {"dateTime": "2026-05-01T09:00:00Z"},
                "end": {"dateTime": "2026-05-01T10:00:00Z"},
                "attendees": [
                    {"email": "alice@example.com", "responseStatus": "accepted"}
                ],
                "conferenceData": {
                    "entryPoints": [
                        {"entryPointType": "video", "uri": "https://meet.google.com/abc"}
                    ]
                }
            })))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let event = client.get_event("primary", "e1").await.unwrap();
        assert_eq!(event.id, "e1");
        assert_eq!(event.summary, "Team Meeting");
        assert!(event.attendees.is_some());
        assert!(event.conference_data.is_some());
    }

    #[tokio::test]
    async fn batch_get_events_multiple() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/calendar/v3/calendars/primary/events/batchGet"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "events": [
                    {"id": "e1", "summary": "Event 1", "start": {"dateTime": "2026-05-01T09:00:00Z"}, "end": {"dateTime": "2026-05-01T10:00:00Z"}},
                    {"id": "e2", "summary": "Event 2", "start": {"dateTime": "2026-05-02T09:00:00Z"}, "end": {"dateTime": "2026-05-02T10:00:00Z"}}
                ]
            })))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let events = client.batch_get_events("primary", &["e1", "e2"]).await.unwrap();
        assert_eq!(events.len(), 2);
        assert_eq!(events[0].id, "e1");
        assert_eq!(events[1].id, "e2");
    }

    // Serialize these tests to avoid env var conflicts
    static WATCH_LOCK: std::sync::LazyLock<tokio::sync::Mutex<()>> =
        std::sync::LazyLock::new(|| tokio::sync::Mutex::new(()));

    #[tokio::test]
    async fn watch_channel_create_succeeds() {
        let _guard = WATCH_LOCK.lock().await;
        let saved = std::env::var("FOCALPOINT_GCAL_WEBHOOK_URL").ok();
        std::env::set_var("FOCALPOINT_GCAL_WEBHOOK_URL", "https://webhook.local/gcal");
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/calendar/v3/calendars/primary/events/watch"))
            .and(header("authorization", "Bearer TOK"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "kind": "calendar#channel",
                "id": "ch1",
                "resource_id": "rsrc1",
                "resource_uri": "https://www.googleapis.com/calendar/v3/calendars/primary/events",
                "token": "tok123"
            })))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let resp = client.watch_channel_create("primary").await.unwrap();
        assert_eq!(resp.id, "ch1");
        assert_eq!(resp.resource_id, "rsrc1");

        // Restore the saved value
        if let Some(val) = saved {
            std::env::set_var("FOCALPOINT_GCAL_WEBHOOK_URL", val);
        } else {
            std::env::remove_var("FOCALPOINT_GCAL_WEBHOOK_URL");
        }
    }

    #[tokio::test]
    async fn watch_channel_create_missing_env_returns_auth_error() {
        let _guard = WATCH_LOCK.lock().await;
        // Save the current value if it exists
        let saved = std::env::var("FOCALPOINT_GCAL_WEBHOOK_URL").ok();
        std::env::remove_var("FOCALPOINT_GCAL_WEBHOOK_URL");
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/calendar/v3/calendars/primary/events/watch"))
            .respond_with(ResponseTemplate::new(404))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let err = client.watch_channel_create("primary").await.unwrap_err();
        match err {
            ConnectorError::Auth(msg) => assert!(msg.contains("FOCALPOINT_GCAL_WEBHOOK_URL")),
            other => panic!("expected Auth error, got {other:?}"),
        }
        // Restore the saved value
        if let Some(val) = saved {
            std::env::set_var("FOCALPOINT_GCAL_WEBHOOK_URL", val);
        }
    }

    #[tokio::test]
    async fn watch_channel_stop_succeeds() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/calendar/v3/calendars/primary/events/stop"))
            .and(header("authorization", "Bearer TOK"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({})))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let res = client.watch_channel_stop("primary", "ch1", "rsrc1").await;
        assert!(res.is_ok());
    }

    #[tokio::test]
    async fn expand_recurring_events_queries_instances() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/calendar/v3/calendars/primary/events"))
            .and(query_param("recurringEventId", "recurring1"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "items": [
                    {"id": "rec1_0", "summary": "Weekly", "recurringEventId": "recurring1", "start": {"dateTime": "2026-05-01T09:00:00Z"}, "end": {"dateTime": "2026-05-01T10:00:00Z"}},
                    {"id": "rec1_1", "summary": "Weekly", "recurringEventId": "recurring1", "start": {"dateTime": "2026-05-08T09:00:00Z"}, "end": {"dateTime": "2026-05-08T10:00:00Z"}}
                ]
            })))
            .mount(&server)
            .await;

        let client = GCalClient::with_http(server.uri(), "TOK", reqwest::Client::new());
        let page = client
            .expand_recurring_events("primary", "recurring1", "2026-05-01T00:00:00Z", "2026-05-31T23:59:59Z")
            .await
            .unwrap();
        assert_eq!(page.items.len(), 2);
        assert!(page.items.iter().all(|e| e.recurring_event_id.as_deref() == Some("recurring1")));
    }

    #[tokio::test]
    async fn get_event_unauthorized() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/calendar/v3/calendars/primary/events/e1"))
            .respond_with(ResponseTemplate::new(401))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "bad", reqwest::Client::new());
        let err = client.get_event("primary", "e1").await.unwrap_err();
        assert!(matches!(err, ConnectorError::Auth(_)));
    }

    #[tokio::test]
    async fn batch_get_events_forbidden() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/calendar/v3/calendars/primary/events/batchGet"))
            .respond_with(ResponseTemplate::new(403).set_body_json(serde_json::json!({
                "error": {"code": 403, "message": "forbidden"}
            })))
            .mount(&server)
            .await;
        let client = GCalClient::with_http(server.uri(), "t", reqwest::Client::new());
        let err = client.batch_get_events("primary", &["e1"]).await.unwrap_err();
        assert!(matches!(err, ConnectorError::Auth(_)));
    }

    #[tokio::test]
    async fn batch_get_events_empty_ids() {
        let client = GCalClient::new("fake_token");
        let events = client.batch_get_events("primary", &[]).await.unwrap();
        assert!(events.is_empty());
    }
}
