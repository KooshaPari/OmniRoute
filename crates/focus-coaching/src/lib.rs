//! focus-coaching — LLM provider trait + thin OpenAI-compatible client.
//!
//! Shape mirrors `cheap-llm-mcp/providers/openai_compat.py`: POST
//! `{base_url}/chat/completions` with a Bearer token and a simple messages
//! array. No streaming, no retries beyond what reqwest does by default.
//!
//! All LLM calls are gated behind the [`CoachingProvider`] trait so
//! `focus-mascot` and `focus-rules` never import reqwest directly.
//!
//! Kill switch: set `FOCALPOINT_DISABLE_COACHING=1` to short-circuit every
//! provider call back to `Ok(None)`. Checked at the *trait call site*, not
//! inside impls, so tests can still exercise the Stub provider directly.
//!
//! Rate limit: built-in token bucket — max 10 calls / 60s per
//! [`RateLimitedProvider`] wrapper. Excess calls return `Ok(None)` and emit a
//! `coaching.fallback` tracing event.

use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use async_trait::async_trait;
use secrecy::{ExposeSecret, SecretString};
use serde::{Deserialize, Serialize};
use thiserror::Error;
use tracing::{debug, info, warn};

pub mod prompts;

/// Environment variable that short-circuits every coaching call when `=1`.
pub const KILL_SWITCH_ENV: &str = "FOCALPOINT_DISABLE_COACHING";

#[derive(Debug, Error)]
pub enum CoachingError {
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("invalid response: {0}")]
    InvalidResponse(String),
}

/// The one thing a cheap-LLM client must do: take a prompt, return text
/// (or `None` if coaching is disabled / rate-limited / best-effort fails).
#[async_trait]
pub trait CoachingProvider: Send + Sync {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        max_tokens: u32,
    ) -> anyhow::Result<Option<String>>;
}

// --------------------------------------------------------------------------
// HTTP provider — OpenAI-compat, shaped like cheap-llm-mcp/openai_compat.py
// --------------------------------------------------------------------------

/// HTTP provider calling an OpenAI-compatible `/chat/completions` endpoint.
///
/// `endpoint` is the **base URL** (e.g. `https://api.minimax.chat/v1`). The
/// client appends `/chat/completions`.
pub struct HttpCoachingProvider {
    endpoint: String,
    api_key: SecretString,
    model: String,
    client: reqwest::Client,
}

impl HttpCoachingProvider {
    pub fn new(
        endpoint: impl Into<String>,
        api_key: SecretString,
        model: impl Into<String>,
    ) -> Self {
        Self {
            endpoint: endpoint.into(),
            api_key,
            model: model.into(),
            client: reqwest::Client::builder()
                .timeout(Duration::from_secs(30))
                .build()
                .expect("reqwest client"),
        }
    }

    /// Convenience: default Minimax model.
    pub fn minimax(endpoint: impl Into<String>, api_key: SecretString) -> Self {
        Self::new(endpoint, api_key, "MiniMax-M2.7")
    }
    /// Convenience: default Kimi Turbo.
    pub fn kimi(endpoint: impl Into<String>, api_key: SecretString) -> Self {
        Self::new(endpoint, api_key, "kimi-k2.5-turbo")
    }
}

#[derive(Serialize)]
struct ChatMessage<'a> {
    role: &'a str,
    content: &'a str,
}

#[derive(Serialize)]
struct ChatRequest<'a> {
    model: &'a str,
    messages: Vec<ChatMessage<'a>>,
    max_tokens: u32,
    temperature: f32,
}

#[derive(Deserialize)]
struct ChatResponse {
    choices: Vec<ChatChoice>,
}
#[derive(Deserialize)]
struct ChatChoice {
    message: ChatChoiceMessage,
}
#[derive(Deserialize)]
struct ChatChoiceMessage {
    content: Option<String>,
}

#[async_trait]
impl CoachingProvider for HttpCoachingProvider {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        max_tokens: u32,
    ) -> anyhow::Result<Option<String>> {
        if kill_switch_on() {
            info!(target: "coaching.fallback", reason = "kill_switch", "coaching disabled via env");
            return Ok(None);
        }
        let mut messages = Vec::with_capacity(2);
        if let Some(sys) = system {
            messages.push(ChatMessage { role: "system", content: sys });
        }
        messages.push(ChatMessage { role: "user", content: prompt });
        let req = ChatRequest { model: &self.model, messages, max_tokens, temperature: 0.3 };
        let url = format!("{}/chat/completions", self.endpoint.trim_end_matches('/'));
        info!(
            target: "coaching.request",
            model = %self.model,
            prompt_chars = prompt.len(),
            max_tokens,
            "coaching request"
        );
        let resp = self
            .client
            .post(&url)
            .bearer_auth(self.api_key.expose_secret())
            .json(&req)
            .send()
            .await
            .map_err(CoachingError::Http)?;
        let status = resp.status();
        if !status.is_success() {
            let body = resp.text().await.unwrap_or_default();
            warn!(
                target: "coaching.fallback",
                %status,
                reason = "http_status",
                "coaching http error — falling back"
            );
            debug!(target: "coaching.response", %status, body_chars = body.len(), "error body");
            return Ok(None);
        }
        let parsed: ChatResponse = resp.json().await.map_err(CoachingError::Http)?;
        let text = parsed
            .choices
            .into_iter()
            .next()
            .and_then(|c| c.message.content)
            .unwrap_or_default()
            .trim()
            .to_string();
        if text.is_empty() {
            warn!(target: "coaching.fallback", reason = "empty_content", "empty LLM content");
            return Ok(None);
        }
        info!(
            target: "coaching.response",
            chars = text.len(),
            "coaching response"
        );
        Ok(Some(text))
    }
}

// --------------------------------------------------------------------------
// Noop + Stub providers
// --------------------------------------------------------------------------

/// Always returns `Ok(None)`. Use when no API key is configured.
#[derive(Debug, Default, Clone)]
pub struct NoopCoachingProvider;

#[async_trait]
impl CoachingProvider for NoopCoachingProvider {
    async fn complete(
        &self,
        _prompt: &str,
        _system: Option<&str>,
        _max_tokens: u32,
    ) -> anyhow::Result<Option<String>> {
        Ok(None)
    }
}

/// Test double — returns canned responses in order. Wraps around when
/// exhausted so long-running tests don't panic.
#[derive(Debug, Clone)]
pub struct StubCoachingProvider {
    responses: Arc<Vec<String>>,
    cursor: Arc<Mutex<usize>>,
}

impl StubCoachingProvider {
    pub fn new(responses: Vec<String>) -> Self {
        Self { responses: Arc::new(responses), cursor: Arc::new(Mutex::new(0)) }
    }
    pub fn single(resp: impl Into<String>) -> Self {
        Self::new(vec![resp.into()])
    }
}

#[async_trait]
impl CoachingProvider for StubCoachingProvider {
    async fn complete(
        &self,
        _prompt: &str,
        _system: Option<&str>,
        _max_tokens: u32,
    ) -> anyhow::Result<Option<String>> {
        if self.responses.is_empty() {
            return Ok(None);
        }
        let mut idx = self.cursor.lock().expect("stub cursor");
        let out = self.responses[*idx % self.responses.len()].clone();
        *idx += 1;
        Ok(Some(out))
    }
}

// --------------------------------------------------------------------------
// Rate-limiting wrapper
// --------------------------------------------------------------------------

/// Token bucket: `capacity` calls per `window`.
struct Bucket {
    capacity: u32,
    window: Duration,
    calls: Vec<Instant>,
}

impl Bucket {
    fn take(&mut self) -> bool {
        let now = Instant::now();
        self.calls.retain(|t| now.duration_since(*t) < self.window);
        if (self.calls.len() as u32) < self.capacity {
            self.calls.push(now);
            true
        } else {
            false
        }
    }
}

/// Wraps any [`CoachingProvider`] and throttles to `capacity`/`window`.
pub struct RateLimitedProvider {
    inner: Arc<dyn CoachingProvider>,
    bucket: Arc<Mutex<Bucket>>,
}

impl RateLimitedProvider {
    pub fn new(inner: Arc<dyn CoachingProvider>, capacity: u32, window: Duration) -> Self {
        Self { inner, bucket: Arc::new(Mutex::new(Bucket { capacity, window, calls: Vec::new() })) }
    }
    /// Default: 10 calls per 60s.
    pub fn default_limits(inner: Arc<dyn CoachingProvider>) -> Self {
        Self::new(inner, 10, Duration::from_secs(60))
    }
}

#[async_trait]
impl CoachingProvider for RateLimitedProvider {
    async fn complete(
        &self,
        prompt: &str,
        system: Option<&str>,
        max_tokens: u32,
    ) -> anyhow::Result<Option<String>> {
        let allowed = {
            let mut b = self.bucket.lock().expect("bucket");
            b.take()
        };
        if !allowed {
            warn!(target: "coaching.fallback", reason = "rate_limit", "coaching rate limited");
            return Ok(None);
        }
        self.inner.complete(prompt, system, max_tokens).await
    }
}

// --------------------------------------------------------------------------
// Helpers
// --------------------------------------------------------------------------

fn kill_switch_on() -> bool {
    std::env::var(KILL_SWITCH_ENV).map(|v| v == "1").unwrap_or(false)
}

/// Convenience: check-and-maybe-call. Respects the env kill switch even for
/// Stub providers, so hosts can globally disable coaching regardless of impl.
pub async fn complete_guarded(
    provider: &dyn CoachingProvider,
    prompt: &str,
    system: Option<&str>,
    max_tokens: u32,
) -> anyhow::Result<Option<String>> {
    if kill_switch_on() {
        info!(target: "coaching.fallback", reason = "kill_switch", "coaching disabled via env");
        return Ok(None);
    }
    provider.complete(prompt, system, max_tokens).await
}

// --------------------------------------------------------------------------
// Tests
// --------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn noop_provider_returns_none() {
        let p = NoopCoachingProvider;
        let r = p.complete("hi", None, 32).await.unwrap();
        assert!(r.is_none());
    }

    #[tokio::test]
    async fn stub_returns_canned_then_wraps() {
        let p = StubCoachingProvider::new(vec!["a".into(), "b".into()]);
        assert_eq!(p.complete("x", None, 8).await.unwrap().as_deref(), Some("a"));
        assert_eq!(p.complete("x", None, 8).await.unwrap().as_deref(), Some("b"));
        assert_eq!(p.complete("x", None, 8).await.unwrap().as_deref(), Some("a"));
    }

    #[tokio::test]
    async fn stub_single_helper() {
        let p = StubCoachingProvider::single("one");
        assert_eq!(p.complete("x", None, 8).await.unwrap().as_deref(), Some("one"));
    }

    #[tokio::test]
    async fn rate_limit_caps_calls() {
        let inner: Arc<dyn CoachingProvider> = Arc::new(StubCoachingProvider::single("ok"));
        let rl = RateLimitedProvider::new(inner, 2, Duration::from_secs(60));
        assert!(rl.complete("x", None, 4).await.unwrap().is_some());
        assert!(rl.complete("x", None, 4).await.unwrap().is_some());
        assert!(rl.complete("x", None, 4).await.unwrap().is_none());
    }

    // env-var tests share process state. We block-lock before entering the
    // async runtime, then drop the guard before awaiting; this keeps the
    // clippy `await_holding_lock` check happy while still serializing
    // env-mutating tests.
    static ENV_LOCK: std::sync::Mutex<()> = std::sync::Mutex::new(());

    #[test]
    fn kill_switch_forces_none_via_guard() {
        let _g = ENV_LOCK.lock().expect("env lock");
        std::env::set_var(KILL_SWITCH_ENV, "1");
        let p = StubCoachingProvider::single("nope");
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("rt");
        let r = rt.block_on(complete_guarded(&p, "x", None, 8)).expect("ok");
        std::env::remove_var(KILL_SWITCH_ENV);
        assert!(r.is_none());
    }

    #[test]
    fn guard_passes_through_when_unset() {
        let _g = ENV_LOCK.lock().expect("env lock");
        std::env::remove_var(KILL_SWITCH_ENV);
        let p = StubCoachingProvider::single("yes");
        let rt = tokio::runtime::Builder::new_current_thread().enable_all().build().expect("rt");
        let r = rt.block_on(complete_guarded(&p, "x", None, 8)).expect("ok");
        assert_eq!(r.as_deref(), Some("yes"));
    }

    #[test]
    fn rule_authoring_prompt_substitutes_schema() {
        let p = prompts::rule_authoring_prompt();
        assert!(p.contains("\"trigger\""));
        assert!(!p.contains("{schema}"));
    }

    #[test]
    fn bubble_prompt_mentions_voice_constraints() {
        assert!(prompts::BUBBLE_SYSTEM_PROMPT.contains("Coachy"));
        assert!(prompts::BUBBLE_SYSTEM_PROMPT.contains("Celebratory"));
    }

    // Traces to: FR-UX-001
    #[test]
    #[ignore = "TBD: feature spec not yet implemented"]
    fn test_fr_ux_001_rule_firing_explanation() {
        unimplemented!("Rule firing shows explanation inline")
    }

    // Traces to: FR-UX-002
    #[test]
    #[ignore = "TBD: feature spec not yet implemented"]
    fn test_fr_ux_002_connector_auth_platform_native() {
        unimplemented!("Connector auth flow is platform-native (SFSafariViewController / Custom Tabs)")
    }

    // Traces to: FR-UX-003
    #[test]
    #[ignore = "TBD: feature spec not yet implemented"]
    fn test_fr_ux_003_penalty_escalation_visibility() {
        unimplemented!("Penalty escalation shows tier + bypass cost before commit")
    }

    // Traces to: FR-UX-004
    #[test]
    #[ignore = "TBD: feature spec not yet implemented"]
    fn test_fr_ux_004_streak_state_home_surface() {
        unimplemented!("Streak state is visible on home surface")
    }
}
