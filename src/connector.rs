#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectorKind {
    Plane,
    GitHub,
    Import,
}

/// Configuration for connecting to a phenotype data source.
///
/// # Example
///
/// ```
/// use phenotype_registry::connector::{ConnectorConfig, ConnectorKind};
///
/// let config = ConnectorConfig {
///     kind: ConnectorKind::Plane,
///     endpoint: "local://phenotype-data",
/// };
/// assert_eq!(config.kind, ConnectorKind::Plane);
/// assert_eq!(config.endpoint, "local://phenotype-data");
/// ```
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConnectorConfig {
    pub kind: ConnectorKind,
    pub endpoint: String,
}

impl ConnectorConfig {
    /// Create a new `ConnectorConfig`.
    ///
    /// This is a convenience constructor.
    ///
    /// # Example
    ///
    /// ```
    /// use phenotype_registry::connector::{ConnectorConfig, ConnectorKind};
    ///
    /// let config = ConnectorConfig::new(ConnectorKind::GitHub, "https://api.github.com");
    /// assert_eq!(config.kind, ConnectorKind::GitHub);
    /// ```
    pub fn new(kind: ConnectorKind, endpoint: impl Into<String>) -> Self {
        ConnectorConfig {
            kind,
            endpoint: endpoint.into(),
        }
    }
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Connection {
    pub kind: ConnectorKind,
    pub endpoint: String,
    pub connected: bool,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Change {
    pub id: String,
    pub source: ConnectorKind,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub enum ConnectorError {
    KindMismatch {
        expected: ConnectorKind,
        actual: ConnectorKind,
    },
}

#[allow(async_fn_in_trait)]
pub trait Connector {
    async fn connect(config: ConnectorConfig) -> Result<Connection, ConnectorError>;
    async fn fetch_changes(&self) -> Result<Vec<Change>, ConnectorError>;
}

#[derive(Debug, Default, Clone, Copy)]
pub struct PlaneConnector;

#[derive(Debug, Default, Clone, Copy)]
pub struct GitHubConnector;

#[derive(Debug, Default, Clone, Copy)]
pub struct ImportConnector;

fn connection_for(
    expected: ConnectorKind,
    config: ConnectorConfig,
) -> Result<Connection, ConnectorError> {
    if config.kind != expected {
        return Err(ConnectorError::KindMismatch {
            expected,
            actual: config.kind,
        });
    }

    Ok(Connection {
        kind: config.kind,
        endpoint: config.endpoint,
        connected: true,
    })
}

fn stub_changes(source: ConnectorKind) -> Vec<Change> {
    vec![Change {
        id: format!("{source:?}:stub-change"),
        source,
    }]
}

impl Connector for PlaneConnector {
    async fn connect(config: ConnectorConfig) -> Result<Connection, ConnectorError> {
        connection_for(ConnectorKind::Plane, config)
    }

    async fn fetch_changes(&self) -> Result<Vec<Change>, ConnectorError> {
        Ok(stub_changes(ConnectorKind::Plane))
    }
}

impl Connector for GitHubConnector {
    async fn connect(config: ConnectorConfig) -> Result<Connection, ConnectorError> {
        connection_for(ConnectorKind::GitHub, config)
    }

    async fn fetch_changes(&self) -> Result<Vec<Change>, ConnectorError> {
        Ok(stub_changes(ConnectorKind::GitHub))
    }
}

impl Connector for ImportConnector {
    async fn connect(config: ConnectorConfig) -> Result<Connection, ConnectorError> {
        connection_for(ConnectorKind::Import, config)
    }

    async fn fetch_changes(&self) -> Result<Vec<Change>, ConnectorError> {
        Ok(stub_changes(ConnectorKind::Import))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::future::Future;
    use std::pin::pin;
    use std::sync::Arc;
    use std::task::{Context, Poll, Wake, Waker};

    struct NoopWake;

    impl Wake for NoopWake {
        fn wake(self: Arc<Self>) {}
    }

    fn block_on<T>(future: impl Future<Output = T>) -> T {
        let waker = Waker::from(Arc::new(NoopWake));
        let mut context = Context::from_waker(&waker);
        let mut future = pin!(future);

        loop {
            match future.as_mut().poll(&mut context) {
                Poll::Ready(output) => return output,
                Poll::Pending => std::thread::yield_now(),
            }
        }
    }

    fn config(kind: ConnectorKind) -> ConnectorConfig {
        ConnectorConfig {
            kind,
            endpoint: format!("local://{kind:?}"),
        }
    }

    fn config_with_endpoint(kind: ConnectorKind, endpoint: &str) -> ConnectorConfig {
        ConnectorConfig {
            kind,
            endpoint: endpoint.to_owned(),
        }
    }

    #[test]
    fn connector_kind_covers_requested_adapters() {
        assert_eq!(ConnectorKind::Plane, ConnectorKind::Plane);
        assert_eq!(ConnectorKind::GitHub, ConnectorKind::GitHub);
        assert_eq!(ConnectorKind::Import, ConnectorKind::Import);
    }

    #[test]
    fn plane_connector_connects_and_fetches_stub_change() {
        let connection = block_on(PlaneConnector::connect(config(ConnectorKind::Plane))).unwrap();
        let changes = block_on(PlaneConnector.fetch_changes()).unwrap();

        assert_eq!(connection.kind, ConnectorKind::Plane);
        assert!(connection.connected);
        assert_eq!(changes[0].source, ConnectorKind::Plane);
    }

    #[test]
    fn github_connector_connects_and_fetches_stub_change() {
        let connection = block_on(GitHubConnector::connect(config(ConnectorKind::GitHub))).unwrap();
        let changes = block_on(GitHubConnector.fetch_changes()).unwrap();

        assert_eq!(connection.kind, ConnectorKind::GitHub);
        assert!(connection.connected);
        assert_eq!(changes[0].source, ConnectorKind::GitHub);
    }

    #[test]
    fn import_connector_rejects_mismatched_config() {
        let error = block_on(ImportConnector::connect(config(ConnectorKind::Plane))).unwrap_err();

        assert_eq!(
            error,
            ConnectorError::KindMismatch {
                expected: ConnectorKind::Import,
                actual: ConnectorKind::Plane,
            }
        );
    }

    // ── Unit tests for primary business logic (connection_for) ──────────────

    #[test]
    fn connection_for_matching_kind_succeeds() {
        let cfg = config(ConnectorKind::Plane);
        let conn = connection_for(ConnectorKind::Plane, cfg).unwrap();
        assert_eq!(conn.kind, ConnectorKind::Plane);
        assert!(conn.connected);
    }

    #[test]
    fn connection_for_non_matching_kind_fails() {
        let cfg = config(ConnectorKind::GitHub);
        let err = connection_for(ConnectorKind::Plane, cfg).unwrap_err();
        assert_eq!(
            err,
            ConnectorError::KindMismatch {
                expected: ConnectorKind::Plane,
                actual: ConnectorKind::GitHub,
            }
        );
    }

    #[test]
    fn stub_changes_produces_deterministic_output() {
        let changes = stub_changes(ConnectorKind::Import);
        assert_eq!(changes.len(), 1);
        assert_eq!(changes[0].id, "Import:stub-change");
        assert_eq!(changes[0].source, ConnectorKind::Import);
    }
}

// ── Proptest for roundtrip behavior ─────────────────────────────────────────

#[cfg(test)]
mod proptests {
    use super::*;
    use proptest::prelude::*;

    /// For every combination of `ConnectorKind` and endpoint string,
    /// `connection_for` with the matching kind always succeeds and preserves
    /// the endpoint.
    proptest! {
        #[test]
        fn connection_for_matching_kind_always_succeeds(
            kind in prop_oneof![Just(ConnectorKind::Plane), Just(ConnectorKind::GitHub), Just(ConnectorKind::Import)],
            endpoint in ".*",
        ) {
            let cfg = ConnectorConfig { kind, endpoint: endpoint.clone() };
            let conn = connection_for(kind, cfg).unwrap();
            assert_eq!(conn.kind, kind);
            assert_eq!(conn.endpoint, endpoint);
            assert!(conn.connected);
        }
    }

    /// For every combination of two different `ConnectorKind` values,
    /// `connection_for` always fails with `KindMismatch`.
    proptest! {
        #[test]
        fn connection_for_non_matching_kind_always_fails(
            expected in prop_oneof![Just(ConnectorKind::Plane), Just(ConnectorKind::GitHub), Just(ConnectorKind::Import)],
            actual in prop_oneof![Just(ConnectorKind::Plane), Just(ConnectorKind::GitHub), Just(ConnectorKind::Import)],
        ) {
            prop_assume!(expected != actual);
            let cfg = ConnectorConfig { kind: actual, endpoint: "test".to_owned() };
            let err = connection_for(expected, cfg).unwrap_err();
            assert_eq!(
                err,
                ConnectorError::KindMismatch { expected, actual }
            );
        }
    }
}
