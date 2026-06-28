//! `pheno-port-adapter` — substrate-canonical hexagonal port traits and
//! their concrete adapter implementations (ADR-038).
//!
//! Two surfaces live in this crate:
//!
//! 1. **Transport adapter trait** ([`PortAdapter`], [`Connection`],
//!    [`AdapterError`]) — sync interface for pluggable transports
//!    (TCP, Unix-domain, ...). Existing pre-hex-port adapters
//!    ([`adapters::TcpAdapter`], [`adapters::UnixAdapter`]) implement
//!    this.
//! 2. **Hex-port traits** (under [`ports`]) — async-capability traits
//!    defined per application/service boundary, with concrete adapters
//!    under [`adapters`]. Currently shipped:
//!    - [`ports::HexCachePort`] + [`adapters::InMemoryCache`] +
//!      [`adapters::RedisAdapter`].
//!
//! See ADR-038 for the policy governing when a new hex-port trait lands
//! in this crate vs. a polyglot `phenotype-*-sdk` package.
//!
//! ## Observability
//!
//! Per ADR-023 Rule 3.1 every substrate ships observability. Connection
//! lifecycle (connect / disconnect / error) is exported via
//! [`pheno_otel`] (ADR-037 canonical OTLP wire substrate). The hex-port
//! adapters do not yet emit per-operation spans — that is a tracked
//! follow-up (v13+) so we don't blanket-spam traces for high-QPS cache
//! paths.

//! #![doc = "Promote to deny once cycle-3 doc audit confirms 0 missing-doc warnings."]

#![deny(missing_docs)]
#![deny(unsafe_code)]
#![deny(rust_2018_idioms)]

use thiserror::Error;

/// Error type for transport-level [`PortAdapter`] operations.
#[derive(Debug, Error)]
pub enum AdapterError {
    /// The adapter could not establish a connection to the requested endpoint.
    #[error("connect failed: {0}")]
    ConnectFailed(String),
    /// The adapter could not cleanly disconnect an active connection.
    #[error("disconnect failed: {0}")]
    DisconnectFailed(String),
    /// The adapter health probe failed with the provided diagnostic message.
    #[error("health check failed: {0}")]
    HealthCheckFailed(String),
    /// The adapter operation exceeded its configured deadline.
    #[error("timeout")]
    Timeout,
}

/// Opaque handle representing an active connection.
#[derive(Debug)]
#[allow(dead_code)]
pub struct Connection {
    pub(crate) id: String,
}

/// Trait for pluggable transport adapters (TCP, Unix-domain, ...).
///
/// Synchronous by design — the adapter itself owns its async runtime
/// story. Async work belongs in the hex-port traits under [`ports`].
pub trait PortAdapter: Send + Sync {
    /// Return the stable adapter name used in logs, diagnostics, and registries.
    fn name(&self) -> &str;
    /// Verify that the adapter is configured and reachable.
    fn health(&self) -> Result<(), AdapterError>;
    /// Establish a connection to the provided endpoint.
    fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError>;
    /// Disconnect the adapter from its active endpoint or session.
    fn disconnect(&self) -> Result<(), AdapterError>;
}

/// Hex-port traits (cache, time, ...). Each trait lives in its own
/// submodule and is paired with one or more adapters under [`adapters`].
pub mod ports;

/// Concrete adapter implementations.
pub mod adapters;

// Re-exports for the most common entry points so downstream crates can
// `use pheno_port_adapter::HexCachePort` instead of
// `pheno_port_adapter::ports::HexCachePort`. Re-exports are kept flat
// (not nested) so adding a new port doesn't break import paths.
pub use ports::{CacheError, HexCachePort};

#[cfg(test)]
mod tests {
    use super::*;

    struct MockAdapter {
        name: String,
        healthy: bool,
        valid_endpoint: String,
    }

    impl PortAdapter for MockAdapter {
        fn name(&self) -> &str {
            &self.name
        }

        fn health(&self) -> Result<(), AdapterError> {
            if self.healthy {
                Ok(())
            } else {
                Err(AdapterError::HealthCheckFailed("unhealthy".to_string()))
            }
        }

        fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError> {
            if endpoint == self.valid_endpoint {
                Ok(Connection {
                    id: endpoint.to_string(),
                })
            } else {
                Err(AdapterError::ConnectFailed(format!(
                    "invalid endpoint: {endpoint}"
                )))
            }
        }

        fn disconnect(&self) -> Result<(), AdapterError> {
            Ok(())
        }
    }

    #[test]
    fn connect_returns_connection() {
        let adapter = MockAdapter {
            name: "mock".to_string(),
            healthy: true,
            valid_endpoint: "tcp://localhost:8080".to_string(),
        };
        let conn = adapter.connect("tcp://localhost:8080").unwrap();
        assert_eq!(conn.id, "tcp://localhost:8080");
    }

    #[test]
    fn disconnect_returns_ok() {
        let adapter = MockAdapter {
            name: "mock".to_string(),
            healthy: true,
            valid_endpoint: "tcp://localhost:8080".to_string(),
        };
        assert!(adapter.disconnect().is_ok());
    }

    #[test]
    fn health_check_passes() {
        let adapter = MockAdapter {
            name: "mock".to_string(),
            healthy: true,
            valid_endpoint: "tcp://localhost:8080".to_string(),
        };
        assert!(adapter.health().is_ok());
    }

    #[test]
    fn connect_to_invalid_endpoint_fails() {
        let adapter = MockAdapter {
            name: "mock".to_string(),
            healthy: true,
            valid_endpoint: "tcp://localhost:8080".to_string(),
        };
        let result = adapter.connect("invalid://nope");
        assert!(matches!(result, Err(AdapterError::ConnectFailed(_))));
    }

    #[test]
    fn adapter_name_is_non_empty() {
        let adapter = MockAdapter {
            name: "mock-adapter".to_string(),
            healthy: true,
            valid_endpoint: "tcp://localhost:8080".to_string(),
        };
        assert!(!adapter.name().is_empty());
    }
}
