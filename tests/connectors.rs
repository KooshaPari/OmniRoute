use phenotype_registry::connector::*;
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
fn import_connector_connects_and_fetches_stub_change() {
    let connection = block_on(ImportConnector::connect(config(ConnectorKind::Import))).unwrap();
    let changes = block_on(ImportConnector.fetch_changes()).unwrap();

    assert_eq!(connection.kind, ConnectorKind::Import);
    assert!(connection.connected);
    assert_eq!(changes[0].source, ConnectorKind::Import);
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
