//! Anthropic Messages executor.
//!
//! Speaks the Anthropic `/v1/messages` wire format directly. Body translation
//! from OpenAI to Anthropic is handled by `omni-translator` before this
//! executor is called, so the executor only deals with native Anthropic
//! shape: `messages[]` (each with content blocks), `system`, `max_tokens`,
//! `model`, optional `tools`, `stream`.

use std::collections::BTreeMap;
use std::time::Duration;

use async_trait::async_trait;
use reqwest::Client;
use serde_json::Value;
use tracing::debug;

use omni_core::executor::{
    CompleteResponse, ExecutorCapabilities, ExecutorRequest, ExecutorResponse, UsageMetrics,
};
use omni_core::provider::ProviderId;
use omni_core::Executor;

use crate::executors::map_reqwest_error;

const ANTHROPIC_MODELS: &[&str] = &[
    "claude-opus-4",
    "claude-sonnet-4-5",
    "claude-3-7-sonnet",
    "claude-3-5-sonnet",
    "claude-3-5-haiku",
];

#[derive(Debug, Default, Clone)]
pub struct AnthropicExecutor {
    client: Client,
}

impl AnthropicExecutor {
    pub fn new() -> Self {
        let client = Client::builder()
            .timeout(Duration::from_secs(120))
            .connect_timeout(Duration::from_secs(10))
            .build()
            .unwrap_or_else(|_| Client::new());
        Self { client }
    }
}

#[async_trait]
impl Executor for AnthropicExecutor {
    fn provider_id(&self) -> ProviderId {
        ProviderId::from("anthropic")
    }

    fn capabilities(&self) -> ExecutorCapabilities {
        ExecutorCapabilities {
            supports_streaming: true,
            supports_tools: true,
            supports_vision: true,
            supports_reasoning: true,
            supports_system_role: true,
        }
    }

    fn models(&self) -> &[String] {
        thread_local! {
            static CACHE: Vec<String> = ANTHROPIC_MODELS.iter().map(|s| s.to_string()).collect();
        }
        CACHE.with(|v| {
            let leaked: &'static Vec<String> = Box::leak(Box::new(v.clone()));
            leaked.as_slice()
        })
    }

    async fn execute(&self, req: ExecutorRequest) -> omni_core::error::Result<ExecutorResponse> {
        let base_url = req
            .headers
            .get("x-omni-base-url")
            .cloned()
            .unwrap_or_else(|| "https://api.anthropic.com".to_string());
        let credential = req
            .headers
            .get("x-omni-credential")
            .cloned()
            .unwrap_or_default();
        let url = format!("{}/v1/messages", base_url.trim_end_matches('/'));
        debug!(%url, model = %req.model, "anthropic dispatch");

        let mut upstream = self
            .client
            .post(&url)
            .header("content-type", "application/json")
            .header("anthropic-version", "2023-06-01")
            .timeout(req.timeout.unwrap_or(Duration::from_secs(120)));
        if !credential.is_empty() {
            upstream = upstream.header("x-api-key", &credential);
        }
        // Pass through `anthropic-beta` if the client supplied it.
        if let Some(beta) = req.headers.get("anthropic-beta") {
            upstream = upstream.header("anthropic-beta", beta);
        }
        // Drop our internal headers from the body — they were stamped by the
        // router for the executor's benefit, not for the upstream.
        let mut body = req.body.clone();
        if let Some(obj) = body.as_object_mut() {
            obj.remove("x-omni-base-url");
            obj.remove("x-omni-credential");
        }
        let resp = upstream.json(&body).send().await.map_err(map_reqwest_error)?;
        let status = resp.status();
        let headers: BTreeMap<String, String> = resp
            .headers()
            .iter()
            .filter_map(|(k, v)| v.to_str().ok().map(|s| (k.to_string(), s.to_string())))
            .collect();
        let body: Value = resp.json().await.map_err(map_reqwest_error)?;
        if !status.is_success() {
            return Err(omni_core::Error::with_kind(
                omni_core::ErrorKind::UpstreamStatus(status.as_u16()),
                format!("anthropic {status}: {body}"),
            ));
        }
        let usage = body.get("usage").map(|u| UsageMetrics {
            prompt_tokens: u.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            completion_tokens: u.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
            total_tokens: (u.get("input_tokens").and_then(|v| v.as_u64()).unwrap_or(0)
                + u.get("output_tokens").and_then(|v| v.as_u64()).unwrap_or(0)) as u32,
            cost_usd: None,
        });
        Ok(ExecutorResponse::Complete(CompleteResponse {
            status: status.as_u16(),
            headers,
            body,
            usage,
        }))
    }
}
