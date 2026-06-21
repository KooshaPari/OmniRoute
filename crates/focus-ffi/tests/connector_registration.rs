// SPDX-License-Identifier: MIT OR Apache-2.0

//! Integration test for the connect→register flow.
//!
//! Proves that `ConnectorApi::connect_canvas` does more than persist a token:
//! once it returns `Ok`, the `SyncOrchestrator` backing `SyncApi` has a live
//! handle for the Canvas connector, so `SyncApi::tick` will actually poll.
//!
//! Traces to: FR-CONN-003.

use focus_ffi::FocalPointCore;
use wiremock::matchers::{method, path};
use wiremock::{Mock, MockServer, ResponseTemplate};

fn mk_core() -> (tempfile::TempDir, FocalPointCore) {
    let dir = tempfile::tempdir().expect("tempdir");
    let path = dir.path().join("focal.db");
    let core = FocalPointCore::new(path.to_string_lossy().into_owned()).expect("core");
    (dir, core)
}

#[tokio::test(flavor = "multi_thread")]
async fn connect_canvas_registers_connector_with_orchestrator() {
    // 1. Spin up a wiremock sandbox that answers Canvas's token endpoint.
    let server = MockServer::start().await;
    Mock::given(method("POST"))
        .and(path("/login/oauth2/token"))
        .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
            "access_token": "AAA",
            "refresh_token": "RRR",
            "token_type": "Bearer",
            "expires_in": 3600
        })))
        .mount(&server)
        .await;

    // 2. Configure env so connect_canvas doesn't short-circuit on Config,
    //    and force the in-memory secret store so we don't touch the real
    //    OS keychain (which would prompt for an unlock on macOS CI).
    //    These vars are process-global; keep the test serialised by living
    //    in its own integration target.
    std::env::set_var("FOCALPOINT_CANVAS_CLIENT_ID", "test-cid");
    std::env::set_var("FOCALPOINT_CANVAS_CLIENT_SECRET", "test-csecret");
    std::env::set_var("FOCALPOINT_SECRET_STORE", "memory");

    // 3. Drive the connect flow on a blocking thread (FocalPointCore owns its
    //    own tokio runtime and block_ons internally).
    let instance_url = server.uri(); // `http://127.0.0.1:<port>` — scheme preserved by connect_canvas.
    let (_d, core) = tokio::task::spawn_blocking(mk_core).await.unwrap();

    tokio::task::spawn_blocking(move || {
        core.connector()
            .connect_canvas(instance_url, "the-code".into())
            .expect("connect_canvas ok");

        // 4. Orchestrator now holds a live handle for the canvas connector.
        let handles = core.sync().connectors();
        assert_eq!(handles.len(), 1, "expected exactly one registered connector");
        assert_eq!(
            handles[0].connector_id, "canvas",
            "registered id must match CanvasConnector::manifest().id"
        );
    })
    .await
    .unwrap();

    // 5. Clean up env vars to minimise cross-test interference.
    std::env::remove_var("FOCALPOINT_CANVAS_CLIENT_ID");
    std::env::remove_var("FOCALPOINT_CANVAS_CLIENT_SECRET");
    std::env::remove_var("FOCALPOINT_SECRET_STORE");
}
