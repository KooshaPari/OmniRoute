//! HTTP client builder. The client is cheap to clone (Arc-shared reqwest
//! client); store it once and reuse across calls.

use std::sync::Arc;
use std::time::Duration;

use reqwest::header::{HeaderMap, HeaderName, HeaderValue, AUTHORIZATION};
use url::Url;

use crate::chat::ChatRequests;
use crate::embeddings::EmbedRequests;
use crate::error::{SdkError, SdkResult};
use crate::models::ModelRequests;

/// Top-level client. Cloning is cheap.
#[derive(Debug, Clone)]
pub struct Client {
    inner: Arc<Inner>,
}

#[derive(Debug)]
struct Inner {
    base_url: Url,
    http: reqwest::Client,
    default_headers: HeaderMap,
}

impl Client {
    pub fn builder(base_url: impl AsRef<str>) -> ClientBuilder {
        ClientBuilder::new(base_url)
    }

    pub fn base_url(&self) -> &Url { &self.inner.base_url }

    /// Begin a chat completion request. Builder pattern.
    pub fn chat(&self) -> ChatRequests<'_> { ChatRequests::new(self) }

    /// Begin an embeddings request. Builder pattern.
    pub fn embed(&self) -> EmbedRequests<'_> { EmbedRequests::new(self) }

    /// Begin a model list/get request.
    pub fn models(&self) -> ModelRequests<'_> { ModelRequests::new(self) }

    pub(crate) fn http(&self) -> &reqwest::Client { &self.inner.http }
    pub(crate) fn default_headers(&self) -> &HeaderMap { &self.inner.default_headers }
    pub(crate) fn base(&self) -> &Url { &self.inner.base_url }
}

/// Build a `Client`. Use `Client::builder(url)` to start.
#[derive(Debug)]
pub struct ClientBuilder {
    base_url: String,
    api_key: Option<String>,
    headers: HeaderMap,
    timeout: Option<Duration>,
    connect_timeout: Option<Duration>,
}

impl ClientBuilder {
    pub fn new(base_url: impl AsRef<str>) -> Self {
        Self {
            base_url: base_url.as_ref().to_string(),
            api_key: None,
            headers: HeaderMap::new(),
            timeout: None,
            connect_timeout: None,
        }
    }

    /// Set the bearer token (sent as `Authorization: Bearer <key>`).
    pub fn api_key(mut self, key: impl Into<String>) -> Self {
        self.api_key = Some(key.into());
        self
    }

    /// Add a custom default header. Errors on invalid name/value.
    pub fn header(mut self, name: impl AsRef<str>, value: impl AsRef<str>) -> Self {
        let n = name.as_ref();
        let v = value.as_ref();
        let hname = HeaderName::try_from(n).expect("invalid header name");
        let hval = HeaderValue::from_str(v).expect("invalid header value");
        self.headers.insert(hname, hval);
        self
    }

    pub fn timeout(mut self, d: Duration) -> Self { self.timeout = Some(d); self }
    pub fn connect_timeout(mut self, d: Duration) -> Self { self.connect_timeout = Some(d); self }

    pub fn build(self) -> SdkResult<Client> {
        let mut base = Url::parse(&self.base_url)
            .map_err(|e| SdkError::InvalidUrl(format!("{}: {e}", self.base_url)))?;
        // Strip trailing slash for clean join.
        if base.path().ends_with('/') {
            let p = base.path().trim_end_matches('/').to_string();
            base.set_path(&p);
        }
        let mut http = reqwest::Client::builder();
        if let Some(d) = self.timeout { http = http.timeout(d); }
        if let Some(d) = self.connect_timeout { http = http.connect_timeout(d); }
        let http = http.build()?;
        let mut default_headers = self.headers;
        if let Some(k) = self.api_key {
            let val = format!("Bearer {k}");
            default_headers.insert(AUTHORIZATION, HeaderValue::from_str(&val)
                .map_err(|_| SdkError::InvalidHeader { name: "Authorization".into(), value: val })?);
        }
        Ok(Client { inner: Arc::new(Inner { base_url: base, http, default_headers }) })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn build_minimal() {
        let c = Client::builder("http://localhost:8080").build().unwrap();
        assert!(c.base_url().as_str().starts_with("http://localhost:8080"));
    }



    #[test]
    fn build_with_api_key_sets_auth_header() {
        let c = Client::builder("http://x").api_key("sk-test").build().unwrap();
        let h = c.default_headers().get(AUTHORIZATION).unwrap();
        assert_eq!(h.to_str().unwrap(), "Bearer sk-test");
    }

    #[test]
    fn build_invalid_url_errors() {
        let r = Client::builder("not a url").build();
        assert!(matches!(r, Err(SdkError::InvalidUrl(_))));
    }

    #[test]
    fn client_clone_is_cheap() {
        let c = Client::builder("http://x").build().unwrap();
        let c2 = c.clone();
        assert_eq!(c.base_url().as_str(), c2.base_url().as_str());
    }
}
