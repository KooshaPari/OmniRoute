//! OmniRoute core: error types, config, executor trait, ids, model, provider.
//!
//! Every other crate in the workspace depends on this one. Keep the surface
//! small and the types stable.
//!
//! PR-1 (2026-07-05) polish:
//! - `Config::validate`, `Config::load`, env-driven sub-defaults,
//!   `ChaosConfig` (D-omni-05) and `OpenCodeConfig` (D-omni-08).
//! - Typed `ids::ModelId`, `ids::TenantId`, `ids::ApiKeySlug`,
//!   `ids::ApiCallId`, `ids::ComboId`.
//! - `model::Model::validate`, `model::Model::estimate_cost`,
//!   `model::ModelRef::split`.
//! - `provider::ProviderMetadata::validate`, `provider::ProviderKind::as_str`,
//!   `provider::Provider::retry_policy`.
//! - `executor::RetryPolicy` + 100% doctest coverage on the executor module.
//!
//! PR-3 (2026-07-05) — error taxonomy:
//! - `Error::forbidden` / `rate_limited` / `upstream_status` constructors.
//! - `Error::is_client_fault` / `is_upstream_fault` / `stable_code` helpers.
//! - `From<ErrorKind> for Error`. Round-trip-stable Display+serde for every
//!   `ErrorKind` variant.
//!
//! PR-4 (2026-07-05) — storage layout:
//! - `storage::RequestStore` trait + `storage::CallLogStore` trait.
//! - `storage::InMemoryRequestStore` / `storage::InMemoryCallLogStore`
//!   canonical reference implementations.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod config;
pub mod contracts;
pub mod error;
pub mod executor;
pub mod ids;
pub mod model;
pub mod provider;
pub mod storage;
pub mod sqlite_storage;

pub use config::{
    A2aConfig, BindConfig, ChaosConfig, CompressionConfig, Config, ConfigBuilder, DataDir,
    LogConfig, LogFormat, LogLevel, McpConfig, OpenCodeConfig, ProvidersConfig, TelemetryConfig,
};
pub use error::{Error, ErrorKind, Result};
pub use executor::{
    CompleteResponse, Executor, ExecutorCapabilities, ExecutorRequest, ExecutorResponse,
    RetryPolicy, StreamEvent, UsageMetrics,
};
pub use ids::{
    ApiCallId, ApiKeySlug, ComboId, ModelId, RequestId, SessionId, TenantId, TraceId,
};
pub use model::{Model, ModelCapabilities, ModelRef, Modality};
pub use provider::{Provider, ProviderId, ProviderKind, ProviderMetadata};