//! FR-001 — Managed Process Lifecycle
//!
//! Covers AC-001.1, AC-001.2, AC-001.3.
//!
//! These are integration tests that exercise the public API of the
//! `sharecli` library crate (not the binary) so they can be run in CI
//! without a real CLI driver.

use sharecli::runtime::{ProcessFilter, ProcessInfo, ProcessPool, SharedRuntime};

/// FR-001 / AC-001.1 — `start` records a non-zero PID in the in-memory pool.
#[tokio::test]
async fn fr001_start_records_pid_in_pool() {
    let pool = ProcessPool::new();

    // Long-lived enough that sysinfo can observe it.
    #[cfg(unix)]
    let info: ProcessInfo = pool
        .spawn("sleep", &["1".to_string()], None, None, None)
        .await
        .expect("spawn should succeed on unix");

    #[cfg(windows)]
    let info: ProcessInfo = pool
        .spawn(
            "cmd",
            &[
                "/C".to_string(),
                "ping".to_string(),
                "127.0.0.1".to_string(),
                "-n".to_string(),
                "2".to_string(),
            ],
            None,
            None,
            None,
        )
        .await
        .expect("spawn should succeed on windows");

    assert!(info.pid > 0, "spawned process MUST have a non-zero PID");

    pool.kill_all().await.unwrap();
}

/// FR-001 / AC-001.2 — `ps` table renders the expected columns.
/// We assert the underlying pool shape (PID + name) here; the table
/// formatting is verified in the binary smoke tests.
#[tokio::test]
async fn fr001_ps_table_columns_present() {
    let pool = ProcessPool::new();

    #[cfg(unix)]
    let info = pool
        .spawn("sleep", &["1".to_string()], None, None, None)
        .await
        .expect("spawn ok");
    #[cfg(windows)]
    let info = pool
        .spawn(
            "cmd",
            &[
                "/C".to_string(),
                "ping".to_string(),
                "127.0.0.1".to_string(),
                "-n".to_string(),
                "2".to_string(),
            ],
            None,
            None,
            None,
        )
        .await
        .expect("spawn ok");

    let processes = pool.list().await;
    assert!(!processes.is_empty(), "pool MUST list the spawned process");
    assert_eq!(processes[0].pid, info.pid);
    assert!(!processes[0].name.is_empty(), "name column MUST be populated");

    pool.kill_all().await.unwrap();
}

/// FR-001 / AC-001.3 — `ps --project <p>` filters by project.
#[tokio::test]
async fn fr001_ps_filter_by_project() {
    let pool = ProcessPool::new();

    #[cfg(unix)]
    let _ = pool
        .spawn(
            "sleep",
            &["1".to_string()],
            None,
            Some("alpha".to_string()),
            Some("claude".to_string()),
        )
        .await
        .expect("spawn ok");
    #[cfg(windows)]
    let _ = pool
        .spawn(
            "cmd",
            &[
                "/C".to_string(),
                "ping".to_string(),
                "127.0.0.1".to_string(),
                "-n".to_string(),
                "2".to_string(),
            ],
            None,
            Some("alpha".to_string()),
            Some("claude".to_string()),
        )
        .await
        .expect("spawn ok");

    let alpha = pool.find(ProcessFilter::ByProject("alpha".to_string())).await;
    let beta = pool.find(ProcessFilter::ByProject("beta".to_string())).await;
    assert!(!alpha.is_empty(), "alpha project MUST match the spawned process");
    assert!(beta.is_empty(), "beta project MUST NOT match a different project");

    pool.kill_all().await.unwrap();
}

/// Sanity: SharedRuntime is exported so the CLI can wire it in.
#[test]
fn fr001_shared_runtime_constructs() {
    let _rt = SharedRuntime::new(2);
}
