#![deny(missing_docs)]
//! Port adapter abstractions for the `pheno-*` fleet.
//! Provides the [`PortAdapter`] trait and concrete transport adapters (TCP, Unix-domain socket).
use thiserror::Error;

/// Error type for port adapter operations.
#[derive(Debug, Error)]
pub enum AdapterError {
    /// Connecting to the endpoint failed (e.g. unreachable, refused, timeout).
    #[error("connect failed: {0}")]
    ConnectFailed(String),
    /// Disconnecting from the endpoint failed.
    #[error("disconnect failed: {0}")]
    DisconnectFailed(String),
    /// Health check against the connected endpoint failed.
    #[error("health check failed: {0}")]
    HealthCheckFailed(String),
    /// The operation timed out before completing.
    #[error("timeout")]
    Timeout,
}

/// Opaque handle representing an active connection.
#[derive(Debug)]
#[allow(dead_code)]
pub struct Connection {
    pub(crate) id: String,
}

/// Trait for port adapters.
pub trait PortAdapter: Send + Sync {
    /// Returns the stable, human-readable adapter name (e.g. `tcp`, `unix`).
    fn name(&self) -> &str;
    /// Lightweight liveness check; returns `Ok(())` when the adapter
    /// is connected and the underlying transport is healthy.
    fn health(&self) -> Result<(), AdapterError>;
    /// Open a connection to the given endpoint.
    ///
    /// Returns a [`Connection`] handle on success, or an [`AdapterError`]
    /// describing the failure (e.g. unreachable, malformed endpoint).
    fn connect(&self, endpoint: &str) -> Result<Connection, AdapterError>;
    /// Close the current connection. A no-op when already disconnected.
    fn disconnect(&self) -> Result<(), AdapterError>;
}

/// Concrete transport adapters (TCP, Unix-domain socket).
pub mod adapters;

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
