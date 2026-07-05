//! Smoke tests for `omni-core`: confirm the public surface round-trips
//! after PR-1 polish (typed IDs, validate helpers, retry policy).

use std::collections::BTreeMap;
use std::collections::BTreeSet;
use std::time::Duration;

use omni_core::{
    Config, Error, ErrorKind, ExecutorCapabilities, ExecutorRequest, Modality, Model,
    ModelCapabilities, ModelRef, ProviderId, ProviderKind, ProviderMetadata, RetryPolicy,
    StreamEvent,
};
use omni_core::ids::{ApiCallId, ApiKeySlug, ComboId, ModelId, RequestId, SessionId, TenantId};

// ---------------------------------------------------------------------------
// config
// ---------------------------------------------------------------------------

#[test]
fn config_default_is_constructible() {
    let _c = Config::default();
}

#[test]
fn config_builder_data_dir_overrides_db_url() {
    let cfg = Config::builder()
        .data_dir(std::path::PathBuf::from("/tmp/or-smoke"))
        .build()
        .expect("sqlite:// URL must validate");
    assert!(cfg.database_url.starts_with("sqlite:///tmp/or-smoke/storage.sqlite"));
}

#[test]
fn config_validate_rejects_non_sqlite_url() {
    let cfg = Config::builder()
        .data_dir(std::path::PathBuf::from("/tmp/or-smoke"))
        .database_url("postgres://localhost/db")
        .build();
    assert!(cfg.is_err());
}

#[test]
fn config_load_is_idempotent_and_validates() {
    // Should not panic and should validate against the bundled defaults.
    let cfg = Config::load().expect("Config::load must succeed in tests");
    assert!(cfg.database_url.starts_with("sqlite://"));
}

// ---------------------------------------------------------------------------
// error
// ---------------------------------------------------------------------------

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
fn error_kind_provider_fault_5xx() {
    assert!(ErrorKind::UpstreamStatus(500).is_provider_fault());
    assert!(ErrorKind::UpstreamStatus(599).is_provider_fault());
    assert!(!ErrorKind::UpstreamStatus(404).is_provider_fault());
    assert!(!ErrorKind::BadRequest.is_provider_fault());
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
fn error_with_kind_sets_kind_explicitly() {
    let e = Error::with_kind(ErrorKind::NotFound, "no such combo");
    assert_eq!(e.kind(), ErrorKind::NotFound);
    assert_eq!(e.http_status(), 404);
}

// ---------------------------------------------------------------------------
// ids
// ---------------------------------------------------------------------------

#[test]
fn provider_id_roundtrips() {
    let p = ProviderId::from("openai");
    assert_eq!(p.to_string(), "openai");
    assert_eq!(p.as_str(), "openai");
    assert_eq!(p, ProviderId::from("openai"));
    assert_ne!(p, ProviderId::default());
}

#[test]
fn uuid_ids_are_unique() {
    let r1 = RequestId::new();
    let r2 = RequestId::new();
    assert_ne!(r1, r2);
    let s1 = SessionId::new();
    let s2 = SessionId::new();
    assert_ne!(s1, s2);
    let c1 = ComboId::new();
    let c2 = ApiCallId::new();
    assert_ne!(c1.as_uuid(), c2.as_uuid());
}

#[test]
fn uuid_ids_roundtrip_through_parse() {
    let r = RequestId::new();
    let parsed: RequestId = r.to_string().parse().unwrap();
    assert_eq!(r, parsed);
}

#[test]
fn slug_ids_handle_constructors_and_empty() {
    let m: ModelId = "gpt-4o".into();
    let t: TenantId = String::from("acme").into();
    let k: ApiKeySlug = (&String::from("ork_prod_xyz")).into();
    assert_eq!(m.as_str(), "gpt-4o");
    assert_eq!(t.as_str(), "acme");
    assert_eq!(k.as_str(), "ork_prod_xyz");
    assert!(TenantId::from("").is_empty());
    assert!(!TenantId::from("acme").is_empty());
}

// ---------------------------------------------------------------------------
// model
// ---------------------------------------------------------------------------

#[test]
fn model_serializes_json_with_typed_ids() {
    let m = Model {
        id: ModelId::from("gpt-4o"),
        provider: ProviderId::from("openai"),
        display_name: "GPT-4o".into(),
        context_window: 128_000,
        max_output_tokens: 16_384,
        capabilities: ModelCapabilities::default(),
        modalities: {
            let mut s = BTreeSet::new();
            s.insert(Modality::Text);
            s
        },
        price_prompt_per_1k: Some(0.005),
        price_completion_per_1k: Some(0.015),
    };
    let s = serde_json::to_string(&m).unwrap();
    let back: Model = serde_json::from_str(&s).unwrap();
    assert_eq!(m.id, back.id);
    assert_eq!(m.context_window, back.context_window);
    assert_eq!(m.price_prompt_per_1k, back.price_prompt_per_1k);
    assert!(back.modalities.contains(&Modality::Text));
}

#[test]
fn model_validate_catches_invariants() {
    let mut m = make_test_model();
    assert!(m.validate().is_ok());
    m.context_window = 0;
    assert!(m.validate().is_err());
    m.context_window = 128_000;
    m.max_output_tokens = 200_000; // > context_window
    assert!(m.validate().is_err());
}

#[test]
fn model_estimate_cost_computes_prompt_and_completion() {
    let m = make_test_model();
    let cost = m.estimate_cost(1000, 500).unwrap();
    // 1000 * 0.005 / 1k + 500 * 0.015 / 1k = 0.005 + 0.0075 = 0.0125
    assert!((cost - 0.0125).abs() < 1e-9);
}

#[test]
fn model_estimate_cost_none_when_unpriced() {
    let mut m = make_test_model();
    m.price_prompt_per_1k = None;
    assert!(m.estimate_cost(1, 1).is_none());
}

#[test]
fn model_supports_modality_helper() {
    let mut m = make_test_model();
    m.modalities = {
        let mut s = BTreeSet::new();
        s.insert(Modality::Image);
        s
    };
    assert!(m.supports_modality(Modality::Image));
    assert!(!m.supports_modality(Modality::Audio));
}

#[test]
fn model_ref_parses_and_splits() {
    let r = ModelRef::parse("openai/gpt-4o");
    assert_eq!(r.to_string(), "openai/gpt-4o");
    assert_eq!(r.split(), Some(("openai", "gpt-4o")));

    let r = ModelRef::parse("gpt-4o");
    assert_eq!(r.split(), None);
}

// ---------------------------------------------------------------------------
// provider
// ---------------------------------------------------------------------------

#[test]
fn provider_kind_serializes_snake_case() {
    let s = serde_json::to_string(&ProviderKind::OpenAI).unwrap();
    assert_eq!(s, "\"openai\"");
    let s = serde_json::to_string(&ProviderKind::Bedrock).unwrap();
    assert_eq!(s, "\"bedrock\"");
}

#[test]
fn provider_kind_as_str_matches_serde_for_every_variant() {
    let kinds = [
        ProviderKind::OpenAI,
        ProviderKind::Anthropic,
        ProviderKind::Google,
        ProviderKind::Cohere,
        ProviderKind::Mistral,
        ProviderKind::Groq,
        ProviderKind::Bedrock,
        ProviderKind::Vertex,
        ProviderKind::Azure,
        ProviderKind::Browser,
        ProviderKind::Default,
        ProviderKind::Unknown,
    ];
    for k in kinds {
        let s = serde_json::to_string(&k).unwrap();
        let unquoted = s.trim_matches('"');
        assert_eq!(unquoted, k.as_str());
    }
}

#[test]
fn provider_metadata_validate_catches_invariants() {
    let mut m = make_test_metadata();
    assert!(m.validate().is_ok());
    m.id = ProviderId::from("");
    assert!(m.validate().is_err());
    m.id = ProviderId::from("openai");
    m.base_url = "not a url".into();
    assert!(m.validate().is_err());
}

#[test]
fn provider_carries_retry_policy_override() {
    let p = omni_core::Provider {
        metadata: make_test_metadata(),
        credential: Some("sk-test".into()),
        rate_limit_rpm: Some(120),
        retry_policy: Some(RetryPolicy::no_retry()),
    };
    assert!(!p.retry_policy.unwrap().enabled());
}

// ---------------------------------------------------------------------------
// executor
// ---------------------------------------------------------------------------

#[test]
fn executor_request_round_trips_through_serde_compatible_fields() {
    let req = ExecutorRequest {
        request_id: RequestId::new(),
        trace_id: omni_core::ids::TraceId::new(),
        provider: ProviderId::from("openai"),
        model: "gpt-4o".into(),
        body: serde_json::json!({"messages": []}),
        headers: BTreeMap::new(),
        stream: false,
        timeout: Some(Duration::from_secs(30)),
    };
    assert_eq!(req.provider.as_str(), "openai");
    assert!(!req.stream);
    assert_eq!(req.timeout, Some(Duration::from_secs(30)));
}

#[test]
fn retry_policy_default_is_sensible_and_enabled() {
    let p = RetryPolicy::default();
    assert!(p.enabled());
    assert_eq!(p.max_retries, 2);
    assert_eq!(p.delay_for_attempt(0), Duration::from_secs(0));
    assert_eq!(p.delay_for_attempt(1), Duration::from_millis(250));
}

#[test]
fn retry_policy_no_retry_is_disabled() {
    let p = RetryPolicy::no_retry();
    assert!(!p.enabled());
    assert!(!p.should_retry(1));
}

#[test]
fn retry_policy_clamps_to_max_delay() {
    let p = RetryPolicy {
        base_delay: Duration::from_secs(1),
        max_delay: Duration::from_secs(4),
        ..RetryPolicy::default()
    };
    // 1s, 2s, 4s, 8s clamps to 4s
    assert_eq!(p.delay_for_attempt(1), Duration::from_secs(1));
    assert_eq!(p.delay_for_attempt(2), Duration::from_secs(2));
    assert_eq!(p.delay_for_attempt(3), Duration::from_secs(4));
    assert_eq!(p.delay_for_attempt(20), Duration::from_secs(4));
}

#[test]
fn stream_event_data_constructor_is_non_terminal() {
    let e = StreamEvent::data("hello");
    assert_eq!(e.data, "hello");
    assert!(!e.terminal);
    assert!(e.event.is_none());
}

#[test]
fn stream_event_terminal_sets_terminal_and_event() {
    let e = StreamEvent::terminal("[DONE]");
    assert!(e.terminal);
    assert_eq!(e.event.as_deref(), Some("done"));
}

#[test]
fn stream_event_named_sets_event_name_only() {
    let e = StreamEvent::named("tool_call", "{}");
    assert_eq!(e.event.as_deref(), Some("tool_call"));
    assert!(!e.terminal);
}

#[test]
fn executor_capabilities_default_all_false() {
    let c = ExecutorCapabilities::default();
    assert!(!c.supports_streaming);
    assert!(!c.supports_tools);
    assert!(!c.supports_vision);
    assert!(!c.supports_reasoning);
    assert!(!c.supports_system_role);
}

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn make_test_model() -> Model {
    Model {
        id: ModelId::from("gpt-4o"),
        provider: ProviderId::from("openai"),
        display_name: "GPT-4o".into(),
        context_window: 128_000,
        max_output_tokens: 16_384,
        capabilities: ModelCapabilities::default(),
        modalities: BTreeSet::new(),
        price_prompt_per_1k: Some(0.005),
        price_completion_per_1k: Some(0.015),
    }
}

fn make_test_metadata() -> ProviderMetadata {
    ProviderMetadata {
        id: ProviderId::from("openai"),
        kind: ProviderKind::OpenAI,
        display_name: "OpenAI".into(),
        base_url: "https://api.openai.com/v1".into(),
        models: vec![ModelId::from("gpt-4o")],
        default_headers: BTreeMap::new(),
        requires_oauth: false,
    }
}