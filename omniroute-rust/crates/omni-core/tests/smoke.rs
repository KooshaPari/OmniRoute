//! Smoke tests for `omni-core`: confirm the public surface round-trips.

use omni_core::{
    Config, Error, ErrorKind, Model, ModelCapabilities, ModelRef, ProviderId, ProviderKind,
    RequestId, SessionId,
};

#[test]
fn config_default_is_constructible() {
    let _c = Config::default();
}

#[test]
fn error_kind_http_status_mapping() {
    assert_eq!(ErrorKind::BadRequest.http_status(), 400);
    assert_eq!(ErrorKind::Unauthorized.http_status(), 401);
    assert_eq!(ErrorKind::Forbidden.http_status(), 403);
    assert_eq!(ErrorKind::NotFound.http_status(), 404);
    assert_eq!(ErrorKind::RateLimited.http_status(), 429);
    assert_eq!(ErrorKind::UpstreamUnavailable.http_status(), 502);
    assert_eq!(ErrorKind::UpstreamTimeout.http_status(), 502);
    assert_eq!(ErrorKind::Internal.http_status(), 500);
    assert_eq!(ErrorKind::NotImplemented.http_status(), 501);
    assert_eq!(ErrorKind::UpstreamStatus(503).http_status(), 503);
    assert_eq!(ErrorKind::UpstreamStatus(404).http_status(), 502);
}

#[test]
fn error_kind_retryable() {
    assert!(ErrorKind::UpstreamUnavailable.is_retryable());
    assert!(ErrorKind::UpstreamTimeout.is_retryable());
    assert!(ErrorKind::UpstreamStatus(429).is_retryable());
    assert!(ErrorKind::UpstreamStatus(503).is_retryable());
    assert!(!ErrorKind::BadRequest.is_retryable());
    assert!(!ErrorKind::Unauthorized.is_retryable());
}

#[test]
fn error_constructors_map_to_kind() {
    let e = Error::bad_request("nope");
    assert_eq!(e.kind(), ErrorKind::BadRequest);
    assert_eq!(e.http_status(), 400);

    let e = Error::unauthorized("nope");
    assert_eq!(e.kind(), ErrorKind::Unauthorized);

    let e = Error::upstream("down");
    assert_eq!(e.kind(), ErrorKind::UpstreamUnavailable);
    assert!(e.kind().is_retryable());
}

#[test]
fn provider_id_roundtrips() {
    let p = ProviderId::from("openai");
    assert_eq!(p.to_string(), "openai");
    assert_eq!(p, ProviderId::from("openai"));
    assert_ne!(p, ProviderId::default());
}

#[test]
fn ids_are_unique() {
    let r1 = RequestId::new();
    let r2 = RequestId::new();
    assert_ne!(r1, r2);
    let s1 = SessionId::new();
    let s2 = SessionId::new();
    assert_ne!(s1, s2);
}

#[test]
fn model_serializes_json() {
    let m = Model {
        id: "gpt-4o".into(),
        provider: "openai".into(),
        display_name: "GPT-4o".into(),
        context_window: 128_000,
        max_output_tokens: 16_384,
        capabilities: ModelCapabilities::default(),
        modalities: Default::default(),
        price_prompt_per_1k: Some(0.005),
        price_completion_per_1k: Some(0.015),
    };
    let s = serde_json::to_string(&m).unwrap();
    let back: Model = serde_json::from_str(&s).unwrap();
    assert_eq!(m.id, back.id);
    assert_eq!(m.context_window, back.context_window);
    assert_eq!(m.price_prompt_per_1k, back.price_prompt_per_1k);
}

#[test]
fn model_ref_parses() {
    let r = ModelRef::parse("openai/gpt-4o");
    assert_eq!(r.to_string(), "openai/gpt-4o");
}

#[test]
fn provider_kind_serializes_snake_case() {
    let s = serde_json::to_string(&ProviderKind::OpenAI).unwrap();
    assert_eq!(s, "\"openai\"");
    let s = serde_json::to_string(&ProviderKind::Bedrock).unwrap();
    assert_eq!(s, "\"bedrock\"");
}
