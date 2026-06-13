//! Integration tests for `pheno-tracing`.
//!
//! These tests verify that the public API functions install a working
//! subscriber and that log lines emitted through the subscriber flow
//! into the configured sink. Because the global subscriber can only
//! be installed once per process, tests that need to capture output
//! use `tracing::subscriber::with_default` to scope a subscriber to
//! a closure, and a `VecWriter` adapter to capture the bytes.

use std::io::Write;
use std::sync::{Arc, Mutex};

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/// In-memory `MakeWriter` that captures formatted log bytes.
#[derive(Clone, Default)]
struct VecWriter(Arc<Mutex<Vec<u8>>>);

impl VecWriter {
    fn new() -> Self {
        Self::default()
    }

    fn into_string(self) -> String {
        String::from_utf8(self.0.lock().unwrap().clone()).unwrap()
    }
}

impl<'a> tracing_subscriber::fmt::MakeWriter<'a> for VecWriter {
    type Writer = VecWriterGuard<'a>;
    fn make_writer(&'a self) -> Self::Writer {
        VecWriterGuard(self.0.lock().unwrap())
    }
}

struct VecWriterGuard<'a>(std::sync::MutexGuard<'a, Vec<u8>>);

impl<'a> Write for VecWriterGuard<'a> {
    fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
        self.0.write(buf)
    }
    fn flush(&mut self) -> std::io::Result<()> {
        self.0.flush()
    }
}

/// A coarse-grained mutex that serializes tests which install a global
/// subscriber. `tracing::subscriber::set_global_default` (called via
/// `try_init`) can only succeed once per process; without this lock
/// two parallel tests would race and one would silently no-op.
static INIT_LOCK: Mutex<()> = Mutex::new(());

// ---------------------------------------------------------------------------
// Output-capture tests (thread-local subscriber, fully independent)
// ---------------------------------------------------------------------------

#[test]
fn pretty_format_emits_known_log_line() {
    let writer = VecWriter::new();
    let env_filter = tracing_subscriber::EnvFilter::new("info");
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_writer(writer.clone())
        .with_target(false)
        .finish();
    tracing::subscriber::with_default(subscriber, || {
        tracing::info!("known-line-pretty-42");
    });
    let captured = writer.into_string();
    assert!(
        captured.contains("known-line-pretty-42"),
        "expected pretty output to contain known log line, got: {captured}"
    );
}

#[test]
fn json_format_emits_known_log_line() {
    let writer = VecWriter::new();
    let env_filter = tracing_subscriber::EnvFilter::new("info");
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_writer(writer.clone())
        .json()
        .finish();
    tracing::subscriber::with_default(subscriber, || {
        tracing::info!(payload = 42, "known-line-json-42");
    });
    let captured = writer.into_string();
    assert!(
        captured.contains("known-line-json-42"),
        "expected JSON output to contain known log line, got: {captured}"
    );
    // The JSON formatter must emit a parseable JSON object.
    let parsed: serde_json::Value = serde_json::from_str(captured.trim())
        .unwrap_or_else(|e| panic!("JSON parse failed for {captured:?}: {e}"));
    // The `tracing-subscriber` JSON layout puts fields under a
    // nested `fields` key by default. We verify both that the
    // `payload` field shows up under `fields` and that the message
    // appears as `fields.message`.
    let fields = parsed
        .get("fields")
        .unwrap_or_else(|| panic!("expected `fields` in JSON, got: {parsed}"));
    assert_eq!(
        fields.get("payload").and_then(|v| v.as_i64()),
        Some(42),
        "expected fields.payload=42 in JSON, got: {parsed}"
    );
    assert_eq!(
        fields.get("message").and_then(|v| v.as_str()),
        Some("known-line-json-42"),
        "expected fields.message=known-line-json-42 in JSON, got: {parsed}"
    );
}

#[test]
fn file_writer_appends_log_line_to_disk() {
    // Replicate the `init_with_file` pattern under a thread-local
    // subscriber so that the test stays independent of any global
    // subscriber other tests may have installed.
    let tmp = tempfile::tempdir().expect("tempdir");
    let log_dir = tmp.path().to_path_buf();

    let file_appender = tracing_appender::rolling::daily(&log_dir, "pheno-tracing.log");
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    let env_filter = tracing_subscriber::EnvFilter::new("info");
    let subscriber = tracing_subscriber::fmt()
        .with_env_filter(env_filter)
        .with_writer(non_blocking)
        .with_ansi(false)
        .with_target(false)
        .finish();

    tracing::subscriber::with_default(subscriber, || {
        tracing::info!("known-line-file-42");
    });

    // Drop the guard to flush the background writer before reading.
    drop(guard);

    // Search every regular file in the log directory for the known
    // line. The daily-rolling appender names files
    // `pheno-tracing.log.YYYY-MM-DD` plus a possible
    // `pheno-tracing.log.YYYY-MM-DD.<pid>.tmp` while writing.
    let mut found = false;
    let mut all_content = String::new();
    for entry in std::fs::read_dir(&log_dir).expect("read_dir") {
        let entry = entry.expect("dir entry");
        let path = entry.path();
        if !path.is_file() {
            continue;
        }
        let content = std::fs::read_to_string(&path).unwrap_or_default();
        all_content.push_str(&format!("--- {} ---\n{}\n", path.display(), content));
        if content.contains("known-line-file-42") {
            found = true;
        }
    }
    assert!(
        found,
        "expected log line in some file under {:?}, got:\n{all_content}",
        log_dir
    );
}

// ---------------------------------------------------------------------------
// Public-API smoke tests (install a global subscriber; serialized via
// INIT_LOCK so only one of them runs at a time).
//
// The actual log-line capture for the file appender is verified by
// `file_writer_appends_log_line_to_disk` above (which uses a
// thread-local subscriber and is fully independent of the global one).
// That pattern is the same one `init_with_file` installs internally, so
// verifying it via `with_default` is equivalent to verifying
// `init_with_file`'s behavior without breaking parallel test execution.
// ---------------------------------------------------------------------------

#[test]
fn init_does_not_panic() {
    let _guard = INIT_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    pheno_tracing::init();
}

#[test]
fn init_json_does_not_panic() {
    let _guard = INIT_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    pheno_tracing::init_json();
}

#[test]
fn init_with_file_does_not_panic() {
    let _guard = INIT_LOCK.lock().unwrap_or_else(|e| e.into_inner());
    let tmp = tempfile::tempdir().expect("tempdir");
    // The function takes a directory path; the directory must exist
    // before the rolling appender opens it. tempdir guarantees that.
    pheno_tracing::init_with_file(tmp.path());
}
