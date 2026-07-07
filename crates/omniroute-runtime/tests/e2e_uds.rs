//! End-to-end integration test: spin up the `routed` server on an
//! ephemeral UDS, dial it over UDS with `reqwest`, then hit `/healthz`,
//! `/readyz`, `/metrics`, `/v1/chat/completions`, and a bogus path to
//! verify the full request pipeline. This is the canonical happy-path
//! test for the whole data plane and the reference that `byteport-engine`'s
//! UDSProxy mirrors in Go.
//!
//! Run: `cargo test -p omniroute-runtime --test e2e_uds -- --nocapture`

use std::path::PathBuf;
use std::sync::Arc;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;

use omniroute_core::provider::ProviderRegistry;
use omniroute_runtime::metrics::SharedMetrics;
use omniroute_runtime::server::Server;
use serde_json::json;

/// Monotonic counter for unique UDS paths across parallel tests.
static NEXT_SOCK_NONCE: AtomicU64 = AtomicU64::new(0);

/// Start the server on a unique UDS path in `/tmp` and return it.
async fn start_test_server() -> (PathBuf, Arc<ProviderRegistry>) {
    let pid = std::process::id();
    let nonce = NEXT_SOCK_NONCE.fetch_add(1, Ordering::Relaxed);
    let sock = std::env::temp_dir().join(format!("omniroute-test-{pid}-{nonce}.sock"));
    let _ = std::fs::remove_file(&sock);

    let registry = Arc::new(ProviderRegistry::default());

    let server = Server::with_metrics(sock.clone(), registry.clone(), SharedMetrics::new());
    tokio::spawn(async move {
        let _ = server.run().await;
    });
    // Give hyper a beat to bind before asserts run.
    tokio::time::sleep(Duration::from_millis(150)).await;
    (sock, registry)
}

fn uds_client(sock: &PathBuf) -> reqwest::Client {
    reqwest::Client::builder()
        .unix_socket(sock.to_string_lossy().into_owned())
        .timeout(Duration::from_secs(5))
        .build()
        .expect("reqwest builder")
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn healthz_returns_200_over_uds() {
    let (sock, _reg) = start_test_server().await;
    let client = uds_client(&sock);

    let resp = client.get("http://routed/healthz").send().await.unwrap();
    assert_eq!(resp.status(), 200, "healthz must return 200");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn readyz_returns_503_for_empty_registry() {
    let (sock, _reg) = start_test_server().await;
    let client = uds_client(&sock);

    let resp = client.get("http://routed/readyz").send().await.unwrap();
    let status = resp.status().as_u16();
    // Empty registry means /readyz returns 503 (no providers to ping
    // is the same as "all providers are down").
    assert_eq!(status, 503, "empty-registry readyz got {status}");
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn chat_completions_without_provider_returns_4xx() {
    let (sock, _reg) = start_test_server().await;
    let client = uds_client(&sock);

    let req = json!({
        "model": "gpt-4o-mini",
        "messages": [{"role": "user", "content": "ping"}],
    });
    let resp = client
        .post("http://routed/v1/chat/completions")
        .json(&req)
        .send()
        .await
        .unwrap();
    let status = resp.status().as_u16();
    assert!(
        (400..=499).contains(&status),
        "expected 4xx for unknown provider, got {status}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn metrics_endpoint_renders_prometheus_text() {
    let (sock, _reg) = start_test_server().await;
    let client = uds_client(&sock);

    let resp = client.get("http://routed/metrics").send().await.unwrap();
    assert_eq!(resp.status(), 200, "metrics must return 200");
    let body = resp.text().await.unwrap();
    // Empty registry: all counters at 0 should still be emitted.
    assert!(
        body.contains("# TYPE") || body.contains("requests_total"),
        "metrics body looked like Prometheus text:\n{body}"
    );
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
async fn unknown_route_returns_404() {
    let (sock, _reg) = start_test_server().await;
    let client = uds_client(&sock);

    let resp = client.get("http://routed/does-not-exist").send().await.unwrap();
    assert_eq!(resp.status(), 404, "unknown route must return 404");
}
