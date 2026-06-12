#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ConnectorKind {
    Plane,
    GitHub,
    Import,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ConnectorConfig {
    pub kind: ConnectorKind,
    pub endpoint: String,
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
}
