//! HTTP client helpers for talking to a running `omni-server`.
//!
//! The CLI defaults to `http://127.0.0.1:9090` and reads `OMNI_URL` and
//! `OMNI_API_KEY` from the environment. `OMNI_API_KEY` is sent as
//! `Authorization: Bearer <key>` on every request.

use std::time::Duration;

use anyhow::{Context, Result};
use reqwest::blocking::Client;
use serde::de::DeserializeOwned;

/// Server URL with the `OMNI_URL` env override applied. Returns the
/// default `http://127.0.0.1:9090` if the env var is unset.
pub fn server_url() -> String {
    std::env::var("OMNI_URL").unwrap_or_else(|_| "http://127.0.0.1:9090".to_string())
}

/// API key for outbound auth. Empty string if unset.
pub fn api_key() -> String {
    std::env::var("OMNI_API_KEY").unwrap_or_default()
}

/// Construct a blocking reqwest client with the standard timeouts and an
/// `Authorization` header if `OMNI_API_KEY` is set.
pub fn client() -> Result<Client> {
    let mut builder = Client::builder()
        .timeout(Duration::from_secs(30))
        .connect_timeout(Duration::from_secs(5))
        .pool_idle_timeout(Duration::from_secs(60));
    if !api_key().is_empty() {
        let mut headers = reqwest::header::HeaderMap::new();
        headers.insert(
            reqwest::header::AUTHORIZATION,
            format!("Bearer {}", api_key()).parse().unwrap(),
        );
        builder = builder.default_headers(headers);
    }
    builder.build().context("build reqwest client")
}

/// GET a JSON endpoint, deserializing the response.
pub fn get_json<T: DeserializeOwned>(path: &str) -> Result<T> {
    let url = format!("{}{}", server_url(), path);
    let client = client()?;
    let resp = client.get(&url).send().with_context(|| format!("GET {url}"))?;
    let status = resp.status();
    let text = resp.text().with_context(|| format!("read body of {url}"))?;
    if !status.is_success() {
        anyhow::bail!("GET {url} returned {}: {}", status, text);
    }
    serde_json::from_str(&text).with_context(|| format!("parse JSON from {url}: {text}"))
}

/// POST a JSON body, returning the raw response body as `String` (so
/// callers can decide whether to parse or display).
pub fn post_json_raw(path: &str, body: &serde_json::Value) -> Result<(u16, String)> {
    let url = format!("{}{}", server_url(), path);
    let client = client()?;
    let resp = client
        .post(&url)
        .json(body)
        .send()
        .with_context(|| format!("POST {url}"))?;
    let status = resp.status();
    let text = resp.text().with_context(|| format!("read body of {url}"))?;
    Ok((status.as_u16(), text))
}

/// POST a JSON body and parse the response as JSON.
pub fn post_json<T: DeserializeOwned>(path: &str, body: &serde_json::Value) -> Result<T> {
    let (status, text) = post_json_raw(path, body)?;
    if !(200..300).contains(&status) {
        anyhow::bail!("POST {path} returned {status}: {text}");
    }
    serde_json::from_str(&text).with_context(|| format!("parse JSON from {path}: {text}"))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn server_url_default() {
        // SAFETY: tests in this module run in a single thread; env mutation is scoped.
        // SAFETY: we restore the env var immediately after.
        let saved = std::env::var("OMNI_URL").ok();
        std::env::remove_var("OMNI_URL");
        assert_eq!(server_url(), "http://127.0.0.1:9090");
        if let Some(v) = saved {
            std::env::set_var("OMNI_URL", v);
        }
    }

    #[test]
    fn server_url_env_override() {
        let saved = std::env::var("OMNI_URL").ok();
        std::env::set_var("OMNI_URL", "http://example.test:9000");
        assert_eq!(server_url(), "http://example.test:9000");
        if let Some(v) = saved {
            std::env::set_var("OMNI_URL", v);
        } else {
            std::env::remove_var("OMNI_URL");
        }
    }

    #[test]
    fn api_key_env() {
        let saved = std::env::var("OMNI_API_KEY").ok();
        std::env::set_var("OMNI_API_KEY", "secret-token");
        assert_eq!(api_key(), "secret-token");
        if let Some(v) = saved {
            std::env::set_var("OMNI_API_KEY", v);
        } else {
            std::env::remove_var("OMNI_API_KEY");
        }
    }
}
