#![no_main]

use libfuzzer_sys::fuzz_target;
use phenotype_registry::connector::{
    Connector, ConnectorConfig, ConnectorKind, GitHubConnector, ImportConnector, PlaneConnector,
};
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
    let mut fut = pin!(future);
    loop {
        match fut.as_mut().poll(&mut context) {
            Poll::Ready(output) => return output,
            Poll::Pending => std::thread::yield_now(),
        }
    }
}

fuzz_target!(|data: &[u8]| {
    // Fuzz the public Connector trait boundary using the three concrete
    // connector types.  Each byte-slice selects a kind (via data[0] % 3)
    // and uses the remainder as the endpoint string.  We exercise both the
    // matching config path (→ Ok) and a deliberately mismatched path (→ Err).
    if data.is_empty() {
        return;
    }

    let kind_index = data[0] % 3;
    let endpoint = String::from_utf8_lossy(&data[1..]).to_string();

    // Exercise each concrete connector in turn, varying the config kind so
    // the fuzzer explores both the Ok and Err error arms of connection_for.
    match kind_index {
        0 => {
            // PlaneConnector with matching config
            let matching = ConnectorConfig { kind: ConnectorKind::Plane, endpoint: endpoint.clone() };
            let _conn = block_on(PlaneConnector::connect(matching));
            // PlaneConnector with non-matching config
            let mismatched = ConnectorConfig { kind: ConnectorKind::GitHub, endpoint };
            let _err = block_on(PlaneConnector::connect(mismatched));
        }
        1 => {
            let matching = ConnectorConfig { kind: ConnectorKind::GitHub, endpoint: endpoint.clone() };
            let _conn = block_on(GitHubConnector::connect(matching));
            let mismatched = ConnectorConfig { kind: ConnectorKind::Import, endpoint };
            let _err = block_on(GitHubConnector::connect(mismatched));
        }
        _ => {
            let matching = ConnectorConfig { kind: ConnectorKind::Import, endpoint: endpoint.clone() };
            let _conn = block_on(ImportConnector::connect(matching));
            let mismatched = ConnectorConfig { kind: ConnectorKind::Plane, endpoint };
            let _err = block_on(ImportConnector::connect(mismatched));
        }
    }
});
