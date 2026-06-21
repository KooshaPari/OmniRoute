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
    /// A call to [`PortAdapter::connect`] failed. The wrapped string
    /// is a human-readable description of why (e.g. `"connection
    /// refused"`, `"invalid endpoint: ..."`).
    #[error("connect failed: {0}")]
    ConnectFailed(String),
    /// A call to [`PortAdapter::disconnect`] failed. Rare — most
    /// adapters treat disconnect as infallible.
    #[error("disconnect failed: {0}")]
    DisconnectFailed(String),
    /// A call to [`PortAdapter::health`] reported the adapter as
    /// unhealthy. Subsequent connects are likely to fail.
    #[error("health check failed: {0}")]
    HealthCheckFailed(String),
    /// A transport-level operation exceeded its deadline. Surfaced by
    /// adapters that wrap their I/O in a timeout.
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
    /// Stable, human-readable adapter name (e.g. `"tcp"`, `"unix"`).
    /// Used in logs, metrics labels, and error messages.
    fn name(&self) -> &str;

    /// Cheap liveness check that does not perform I/O. Returns
    /// [`AdapterError::HealthCheckFailed`] if the adapter is in a state
    /// where a subsequent [`Self::connect`] is likely to fail.
    fn health(&self) -> Result<(), AdapterError>;

    /// Open a connection to `endpoint` (URI scheme chosen by the
    /// adapter — e.g. `"tcp://host:port"` for [`adapters::TcpAdapter`]).
    /// Returns a [`Connection`] handle that the caller passes to
    /// [`Self::disconnect`].
    fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError>;

    /// Close the active connection. Idempotent: a second call on an
    /// already-disconnected adapter returns `Ok(())`.
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
pub use ports::{CacheError, HexCachePort, HexTimePort};

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
