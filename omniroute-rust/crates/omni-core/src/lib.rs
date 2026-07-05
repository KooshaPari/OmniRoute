//! OmniRoute core: error types, config, executor trait.
//!
//! Every other crate in the workspace depends on this one. Keep the surface
//! small and the types stable.

#![forbid(unsafe_code)]
#![warn(clippy::all, clippy::pedantic)]
#![allow(clippy::module_name_repetitions)]

pub mod config;
pub mod error;
pub mod executor;
pub mod ids;
pub mod model;
pub mod provider;

pub use config::{Config, ConfigBuilder, DataDir, LogFormat, LogLevel};
pub use error::{Error, ErrorKind, Result};
pub use executor::{Executor, ExecutorCapabilities, ExecutorRequest, ExecutorResponse, StreamEvent};
pub use ids::{RequestId, SessionId, TraceId};
pub use model::{Model, ModelCapabilities, ModelRef};
pub use provider::{Provider, ProviderId, ProviderKind, ProviderMetadata};
