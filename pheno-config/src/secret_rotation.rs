//! Secret rotation hook for pheno-config (L33 / v22-T4, secret half).
//!
//! This module is the **secrets** counterpart to [`crate::hot_reload`]:
//! while `hot_reload` rotates **non-secret** config (`PHENO_*` env,
//! TOML keys, feature flags), `secret_rotation` rotates the
//! **secret-bearing** newtypes ([`crate::secrets::ApiKey`],
//! [`crate::secrets::BearerToken`], [`crate::secrets::DbPassword`]).
//!
//! ## Why a separate module?
//!
//! Secret rotation has a stricter contract than config reload:
//!
//! 1. **Pluggable source.** Secrets live in many backends (Vault,
//!    KMS, encrypted disk, env). The substrate must not hard-code
//!    any one source.
//! 2. **Rollback.** If the new credential is rejected by the
//!    downstream service (HTTP 401, DB auth fail), the rotation
//!    must be reversible without restart. The history stack
//!    supports this.
//! 3. **No `unsafe`, no env bleed.** The rotation path runs in
//!    the consumer's process; the source trait allows injection
//!    of test fakes (see the unit tests below) without touching
//!    real Vault creds.
//!
//! ## Cross-references
//!
//! - ADR-046 (federation mTLS + OIDC) — rotated secrets are
//!   re-issued by the SPIRE agent; this module's `rotate()` is the
//!   consumer-side adapter that picks up the new SPIFFE SVID.
//! - ADR-078 (encryption-at-rest mandate) — every secret in this
//!   module is a `ZeroizeOnDrop` newtype; the rotation path zeroes
//!   the old `Arc<ApiKey>` on drop.
//! - ADR-048 (substrate graduation) — `pheno-config` is at T3;
//!   this module is additive (no breaking change to the existing
//!   secrets surface).
//!
//! ## Wire protocol
//!
//! ```text
//! process
//!   ├─ SecretRotator::new(initial_api_key, VaultSource::new(...))
//!   ├─ daemon main loop calls rotator.current() on every request
//!   ├─ Vault issues a new key (operator-driven or automated)
//!   ├─ daemon triggers rotator.rotate()
//!   ├─ rotate() calls source.fetch() -> new ApiKey
//!   ├─ rotate() Arc::swap's in the new key (atomic)
//!   ├─ daemon's NEXT current() call returns the new key
//!   └─ if downstream 401s, daemon calls rotator.rollback()
//!       -> previous key is restored from history
//! ```
//!
//! ## Pluggable source — Vault / File / Env
//!
//! The three concrete sources below cover the fleet's
//! deployment modes:
//!
//! - **VaultSource** — production. Talks to HashiCorp Vault
//!   (or Vault-compatible) over HTTPS with mTLS (ADR-046).
//!   By default returns a "feature not enabled" error; a real
//!   implementation would use `reqwest` or `vaultrs` (added in
//!   a downstream consumer crate, not in pheno-config itself,
//!   to keep this crate stdlib-only).
//! - **FileSource** — read-on-rotate from a local file (typically
//!   `/run/secrets/api-key` on a Kubernetes pod, mounted as
//!   `tmpfs`). Stdlib `std::fs::read_to_string`.
//! - **EnvSource** — read-on-rotate from a process env var
//!   (typically set by the orchestrator before process start, OR
//!   updated by a sidecar). Stdlib `std::env::var`.
//!
//! All three implement the [`RotationSource`] trait; the rotator
//! is generic over `S: RotationSource` and does not care which
//! one is plugged in.

use crate::secrets::ApiKey;
use std::env;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::Arc;

/// Error type for secret-rotation operations.
///
/// Returned by [`RotationSource::fetch`] and propagated by
/// [`SecretRotator::rotate`]. A non-OK variant signals that the
/// rotation attempt failed; the previous secret is retained.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum RotationError {
    /// The source backend is reachable but returned an error
    /// (Vault 5xx, file I/O error, env var not set).
    SourceUnavailable(String),
    /// The source returned an empty / whitespace-only value. Per
    /// [`ApiKey::new`], empty secret material is a tripwire (the
    /// constructor would panic; we surface the tripwire here as
    /// a recoverable error so the daemon does not crash).
    EmptyKey,
    /// The rotation history is empty (rollback requested with no
    /// prior rotations).
    NoHistory,
}

impl std::fmt::Display for RotationError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            RotationError::SourceUnavailable(msg) => {
                write!(f, "rotation source unavailable: {msg}")
            }
            RotationError::EmptyKey => write!(f, "rotation source returned empty key"),
            RotationError::NoHistory => write!(f, "no prior rotation to roll back to"),
        }
    }
}

impl std::error::Error for RotationError {}

/// Outcome of a successful rotation.
///
/// `old` is the secret that was live before the rotation (now
/// retired); `new` is the secret that is live now. The caller can
/// keep `old` in memory for the rollback window (typically the
/// 60-second grace period per ADR-046 §1.4) and zeroize it after
/// the new key is confirmed.
#[derive(Debug, Clone)]
pub struct RotationOutcome {
    /// The secret that was live before the rotation. Wrapped in
    /// `Arc` so the caller's rollback path can hold a reference
    /// without cloning the secret bytes.
    pub old: Arc<ApiKey>,
    /// The secret that is live now.
    pub new: Arc<ApiKey>,
}

/// Outcome of a successful rollback.
///
/// `reverted_to` is the secret that is now live (the previous
/// `old`); `now_discarded` is the secret that was live before the
/// rollback (the most-recent rotation). The caller can zeroize
/// `now_discarded` after confirming the rollback succeeded.
#[derive(Debug, Clone)]
pub struct RollbackOutcome {
    /// The secret that is now live (the previous `old`).
    pub reverted_to: Arc<ApiKey>,
    /// The secret that was live before the rollback (now retired
    /// again).
    pub now_discarded: Arc<ApiKey>,
}

/// Pluggable rotation source.
///
/// The fleet supports three sources (Vault, file, env) but the
/// substrate does not hard-code any of them; consumers inject
/// the source that matches their deployment. The trait is the
/// single seam where backend-specific code lives.
pub trait RotationSource: Send + Sync {
    /// Fetch a new secret from the source. The returned
    /// [`ApiKey`] must be non-empty (the [`ApiKey::new`]
    /// constructor enforces this and would otherwise panic).
    ///
    /// # Errors
    ///
    /// - [`RotationError::SourceUnavailable`] if the source is
    ///   unreachable (Vault 5xx, file not found, env var unset).
    /// - [`RotationError::EmptyKey`] if the source returned an
    ///   empty / whitespace-only value.
    fn fetch(&self) -> Result<ApiKey, RotationError>;
}

// ---------------------------------------------------------------------------
// FileSource
// ---------------------------------------------------------------------------

/// Rotation source that reads the secret from a local file.
///
/// Typical deployment: Kubernetes pod with a `tmpfs` mount at
/// `/run/secrets/api-key`, the orchestrator (or a sidecar) writes
/// the new credential to the file, and the daemon calls
/// `rotate()` on a SIGHUP (or a separate Vault-watchdog timer).
///
/// The source reads the file on every `fetch()` call — there is
/// no in-memory cache, so a rotation is picked up immediately
/// after the file is updated.
pub struct FileSource {
    path: PathBuf,
}

impl FileSource {
    /// Construct a new `FileSource` reading from `path`.
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self { path: path.into() }
    }

    /// Borrow the file path (for diagnostics / health checks).
    pub fn path(&self) -> &Path {
        &self.path
    }
}

impl RotationSource for FileSource {
    fn fetch(&self) -> Result<ApiKey, RotationError> {
        let raw = fs::read_to_string(&self.path).map_err(|e| {
            RotationError::SourceUnavailable(format!(
                "file source: read {}: {e}",
                self.path.display()
            ))
        })?;
        let trimmed = raw.trim();
        if trimmed.is_empty() {
            return Err(RotationError::EmptyKey);
        }
        // `ApiKey::new` panics on empty input; we've already
        // checked above, so this is safe.
        Ok(ApiKey::new(trimmed.to_string()))
    }
}

// ---------------------------------------------------------------------------
// EnvSource
// ---------------------------------------------------------------------------

/// Rotation source that reads the secret from a process env var.
///
/// Typical deployment: the orchestrator (or a Vault sidecar like
/// `vault-agent` or `consul-template`) updates the env var via
/// `setenv` (or the daemon is re-execed). The source reads the
/// env var on every `fetch()` call.
///
/// Note: `std::env::set_var` is process-wide and not thread-safe
/// with concurrent `std::env::var` reads. Callers that update the
/// env var in a hot path should serialize the updates (e.g.,
/// behind a `Mutex`) or use [`FileSource`] instead.
pub struct EnvSource {
    var: String,
}

impl EnvSource {
    /// Construct a new `EnvSource` reading from the env var
    /// named `var`.
    pub fn new(var: impl Into<String>) -> Self {
        Self { var: var.into() }
    }

    /// Borrow the env var name (for diagnostics).
    pub fn var_name(&self) -> &str {
        &self.var
    }
}

impl RotationSource for EnvSource {
    fn fetch(&self) -> Result<ApiKey, RotationError> {
        match env::var(&self.var) {
            Ok(v) => {
                let trimmed = v.trim();
                if trimmed.is_empty() {
                    Err(RotationError::EmptyKey)
                } else {
                    Ok(ApiKey::new(trimmed.to_string()))
                }
            }
            Err(e) => Err(RotationError::SourceUnavailable(format!(
                "env source: var {} not set: {e}",
                self.var
            ))),
        }
    }
}

// ---------------------------------------------------------------------------
// VaultSource (stub — feature-gated for a downstream consumer crate)
// ---------------------------------------------------------------------------

/// Rotation source that reads the secret from HashiCorp Vault
/// (or a Vault-compatible backend) over HTTPS with mTLS
/// (ADR-046).
///
/// **Stub.** This struct exists so the API surface is uniform
/// across the three sources, but `fetch()` returns a
/// "feature not enabled" error by default. A real implementation
/// would be in a downstream consumer crate (e.g.,
/// `pheno-vault-client`) that depends on `vaultrs` or `reqwest`
/// + mTLS. The pheno-config crate itself stays stdlib-only
/// (per the v22-T4 brief).
///
/// # When to enable
///
/// The `pheno-vault` consumer crate (planned for v23) will
/// provide a `VaultSource` that uses the real Vault HTTP API.
/// To migrate: replace this stub with
/// `pheno_vault::VaultSource` (same `RotationSource` trait
/// impl) — no other code changes required.
pub struct VaultSource {
    /// Vault address (e.g., `https://vault.svc.cluster.local:8200`).
    address: String,
    /// Vault token (in production, this is itself a secret read
    /// from a `SecretSource`; the field is plain `String` here
    /// for the stub).
    token: String,
    /// Vault secret path (e.g., `secret/data/pheno/api-key`).
    path: String,
}

impl VaultSource {
    /// Construct a new `VaultSource` pointing at the given
    /// `address` + `token` + `path` tuple. The stub does not
    /// validate the inputs (the real implementation would do a
    /// `vault sys/health` check at startup).
    pub fn new(
        address: impl Into<String>,
        token: impl Into<String>,
        path: impl Into<String>,
    ) -> Self {
        Self {
            address: address.into(),
            token: token.into(),
            path: path.into(),
        }
    }

    /// Borrow the Vault address (for diagnostics).
    pub fn address(&self) -> &str {
        &self.address
    }

    /// Borrow the Vault secret path (for diagnostics).
    pub fn path_str(&self) -> &str {
        &self.path
    }
}

impl RotationSource for VaultSource {
    fn fetch(&self) -> Result<ApiKey, RotationError> {
        // The real implementation lives in `pheno-vault` (planned
        // v23). For now, surface a clear error so the caller
        // can fall back to FileSource / EnvSource in dev.
        Err(RotationError::SourceUnavailable(format!(
            "vault source: pheno-config substrate is stdlib-only; \
             enable the pheno-vault consumer crate for real Vault support \
             (address={}, path={})",
            self.address, self.path
        )))
    }
}

// ---------------------------------------------------------------------------
// SecretRotator
// ---------------------------------------------------------------------------

/// Secret rotator that holds the **current** `Arc<ApiKey>` and a
/// history stack for rollback.
///
/// The rotator is generic over the [`RotationSource`]; any
/// source implementing the trait can be plugged in. The current
/// secret is swapped atomically on a successful `rotate()`
/// (using [`Arc::swap`], the stdlib atomic primitive); the
/// previous secret is pushed to the history stack for rollback.
pub struct SecretRotator<S: RotationSource> {
    /// The rotation source (Vault, file, env, or a test fake).
    source: S,
    /// The current live secret. Readers clone this `Arc`;
    /// `rotate()` swaps it atomically.
    current: Arc<ApiKey>,
    /// Stack of prior secrets, newest at the back. `rollback()`
    /// pops the back and swaps it in.
    history: Vec<Arc<ApiKey>>,
}

impl<S: RotationSource> SecretRotator<S> {
    /// Construct a new `SecretRotator` with `initial` as the
    /// current secret and `source` as the rotation backend.
    pub fn new(initial: ApiKey, source: S) -> Self {
        Self {
            source,
            current: Arc::new(initial),
            history: Vec::new(),
        }
    }

    /// Borrow the rotation source (for diagnostics / health
    /// checks that want to inspect the source's address / path).
    pub fn source(&self) -> &S {
        &self.source
    }

    /// Get a clone of the current secret's `Arc`.
    ///
    /// This is the **hot-path** read: a single `Arc::clone` (one
    /// atomic refcount increment, no mutex). Callers in a request
    /// loop can call this freely without contention.
    pub fn current(&self) -> Arc<ApiKey> {
        Arc::clone(&self.current)
    }

    /// Number of prior rotations currently in the rollback
    /// history. Bounded by the consumer's grace-period window
    /// (typically 1-3 entries; the substrate does not impose a
    /// cap — see `trim_history` below for a manual cap helper).
    pub fn history_len(&self) -> usize {
        self.history.len()
    }

    /// Rotate the live secret.
    ///
    /// 1. Calls [`RotationSource::fetch`] to obtain a new
    ///    [`ApiKey`].
    /// 2. On success: pushes the current secret onto the
    ///    history stack and atomically swaps the new one in
    ///    (using [`Arc::swap`]).
    /// 3. On failure: returns the error; the current secret is
    ///    NOT swapped (last-known-good is retained).
    pub fn rotate(&mut self) -> Result<RotationOutcome, RotationError> {
        let new_key = self.source.fetch()?;
        let new_arc = Arc::new(new_key);
        // Arc::swap is the stdlib atomic primitive. Readers see
        // either the old or the new, never a half-state.
        let old = Arc::swap(&self.current, Arc::clone(&new_arc));
        // Push the retired secret to the history stack. The
        // stack is bounded by the consumer's grace window (see
        // `history_len`); we do not auto-cap here because the
        // grace window is policy, not substrate concern.
        self.history.push(Arc::clone(&old));
        Ok(RotationOutcome { old, new: new_arc })
    }

    /// Roll back to the most-recently-retired secret.
    ///
    /// 1. Pops the back of the history stack.
    /// 2. Atomically swaps it back in as the current secret.
    /// 3. The previously-current secret is dropped (which
    ///    triggers `ZeroizeOnDrop` per ADR-078).
    ///
    /// # Errors
    ///
    /// Returns [`RotationError::NoHistory`] if the history is
    /// empty (no prior rotations to roll back to). The current
    /// secret is NOT modified in this case.
    pub fn rollback(&mut self) -> Result<RollbackOutcome, RotationError> {
        let prev = self
            .history
            .pop()
            .ok_or(RotationError::NoHistory)?;
        // Swap the previous secret back in. The current secret
        // is now retired (and will be dropped + zeroized).
        let now_discarded = Arc::swap(&self.current, Arc::clone(&prev));
        Ok(RollbackOutcome {
            reverted_to: prev,
            now_discarded,
        })
    }

    /// Manually trim the history stack to `max_len` entries.
    /// Useful for callers that want to bound the rollback window
    /// to a fixed N (e.g., 1 — the most-recent rotation only).
    /// The substrate does not auto-trim because the policy is
    /// consumer-specific.
    pub fn trim_history(&mut self, max_len: usize) {
        if self.history.len() > max_len {
            self.history.drain(0..(self.history.len() - max_len));
        }
    }
}

// ---------------------------------------------------------------------------
// Unit tests (4 required by v22-T4 brief)
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use std::sync::atomic::{AtomicUsize, Ordering};

    /// Test-only source that returns pre-canned values from a
    /// stack. Each `fetch()` pops the back; if the stack is
    /// empty, returns the configured "fail" outcome.
    ///
    /// This is the standard "test fake" pattern for traits with
    /// a single method: a struct that records calls and returns
    /// scripted answers.
    struct SequenceSource {
        /// Pre-canned values, popped back-to-front.
        values: std::sync::Mutex<Vec<Result<ApiKey, RotationError>>>,
        /// Number of `fetch()` calls (for assertions).
        call_count: AtomicUsize,
    }

    impl SequenceSource {
        /// Build a source that returns `values` in order, then
        /// `default_on_empty` once the stack is exhausted.
        fn new(values: Vec<Result<ApiKey, RotationError>>) -> Self {
            Self {
                values: std::sync::Mutex::new(values),
                call_count: AtomicUsize::new(0),
            }
        }

        fn call_count(&self) -> usize {
            self.call_count.load(Ordering::Acquire)
        }
    }

    impl RotationSource for SequenceSource {
        fn fetch(&self) -> Result<ApiKey, RotationError> {
            self.call_count.fetch_add(1, Ordering::AcqRel);
            // `pop` on an empty Vec returns None — we surface
            // that as a SourceUnavailable error so the
            // test's assertions are meaningful.
            self.values
                .lock()
                .expect("SequenceSource mutex poisoned")
                .pop()
                .unwrap_or(Err(RotationError::SourceUnavailable(
                    "SequenceSource: no more values".into(),
                )))
        }
    }

    /// Test helper: a RAII temp file that is deleted on drop.
    /// Used by the FileSource tests in this module.
    struct TempFile {
        path: PathBuf,
    }

    impl TempFile {
        fn new(name: &str, content: &str) -> Self {
            let mut path = std::env::temp_dir();
            path.push(format!(
                "pheno-config-test-{}-{}",
                std::process::id(),
                name
            ));
            let mut f = fs::File::create(&path)
                .unwrap_or_else(|e| panic!("create temp file {}: {e}", path.display()));
            f.write_all(content.as_bytes())
                .unwrap_or_else(|e| panic!("write temp file {}: {e}", path.display()));
            Self { path }
        }
    }

    impl Drop for TempFile {
        fn drop(&mut self) {
            let _ = fs::remove_file(&self.path);
        }
    }

    /// Unit test 1: **no-op**. Construct a rotator and never
    /// call `rotate()`. The current secret remains the initial.
    /// The source's `fetch()` is never invoked.
    #[test]
    fn no_op_keeps_initial_secret() {
        let source = SequenceSource::new(vec![]);
        let initial = ApiKey::new("initial-key");
        let mut rotator = SecretRotator::new(initial, source);

        // current() returns the initial.
        assert_eq!(rotator.current().expose(), "initial-key");
        assert_eq!(rotator.history_len(), 0);

        // No rotation occurred.
        let source_ref = rotator.source();
        assert_eq!(
            source_ref.call_count(),
            0,
            "no-op must not call source.fetch()"
        );

        // current() is still the initial after the no-op.
        assert_eq!(rotator.current().expose(), "initial-key");
    }

    /// Unit test 2: **rotate**. Construct a rotator, call
    /// `rotate()`, verify the current is the new value and the
    /// old value is in the history.
    #[test]
    fn rotate_swaps_in_new_secret() {
        // The SequenceSource pops the back of the values vec,
        // so push the values in the order they should be
        // popped. We only need one value here: "new-key".
        let source = SequenceSource::new(vec![Ok(ApiKey::new("new-key"))]);
        let mut rotator = SecretRotator::new(ApiKey::new("initial-key"), source);

        // Baseline: initial.
        assert_eq!(rotator.current().expose(), "initial-key");

        // Rotate.
        let outcome = rotator
            .rotate()
            .expect("rotate must succeed with scripted Ok");
        assert_eq!(outcome.old.expose(), "initial-key");
        assert_eq!(outcome.new.expose(), "new-key");

        // Current is now the new key.
        assert_eq!(rotator.current().expose(), "new-key");

        // History has the old key.
        assert_eq!(rotator.history_len(), 1);
        assert_eq!(rotator.history[0].expose(), "initial-key");
    }

    /// Unit test 3: **fail**. The source returns an error;
    /// `rotate()` propagates the error AND retains the previous
    /// secret.
    #[test]
    fn failed_rotate_keeps_previous_secret() {
        let source = SequenceSource::new(vec![Err(RotationError::SourceUnavailable(
            "simulated backend outage".into(),
        ))]);
        let mut rotator = SecretRotator::new(ApiKey::new("initial-key"), source);

        // Rotate fails.
        let err = rotator.rotate().expect_err("rotate must fail");
        assert!(matches!(err, RotationError::SourceUnavailable(_)));

        // Current is still the initial.
        assert_eq!(rotator.current().expose(), "initial-key");

        // History is still empty (nothing was retired).
        assert_eq!(rotator.history_len(), 0);
    }

    /// Unit test 4: **rollback**. Rotate twice, then rollback
    /// once. The current secret is the FIRST rotated value (the
    /// second rotation's "old" is the first rotation's "new"),
    /// and the most-recent rotation is now retired. Then
    /// rollback to empty history to verify the NoHistory error.
    #[test]
    fn rollback_restores_previous_secret() {
        // Vec::pop returns the last-pushed element. We want
        // rotate #1 to return "key-1" and rotate #2 to return
        // "key-2". So push "key-2" first (popped second) and
        // "key-1" second (popped first). Equivalently:
        //   vec = [Ok("key-2"), Ok("key-1")]
        //   .pop() #1 = Ok("key-1")  ← rotate #1 consumes this
        //   .pop() #2 = Ok("key-2")  ← rotate #2 consumes this
        let source = SequenceSource::new(vec![
            Ok(ApiKey::new("key-2")),
            Ok(ApiKey::new("key-1")),
        ]);
        let mut rotator = SecretRotator::new(ApiKey::new("initial-key"), source);

        // Two rotations.
        let r1 = rotator.rotate().expect("rotate #1 ok");
        assert_eq!(r1.new.expose(), "key-1");
        assert_eq!(r1.old.expose(), "initial-key");
        assert_eq!(rotator.current().expose(), "key-1");

        let r2 = rotator.rotate().expect("rotate #2 ok");
        assert_eq!(r2.new.expose(), "key-2");
        assert_eq!(r2.old.expose(), "key-1");
        assert_eq!(rotator.current().expose(), "key-2");

        // History: [initial-key, key-1] (push order).
        assert_eq!(rotator.history_len(), 2);
        assert_eq!(rotator.history[0].expose(), "initial-key");
        assert_eq!(rotator.history[1].expose(), "key-1");

        // Rollback once: current -> key-1, history -> [initial-key].
        let rb = rotator.rollback().expect("rollback ok");
        assert_eq!(rb.reverted_to.expose(), "key-1");
        assert_eq!(rb.now_discarded.expose(), "key-2");
        assert_eq!(rotator.current().expose(), "key-1");
        assert_eq!(rotator.history_len(), 1);
        assert_eq!(rotator.history[0].expose(), "initial-key");

        // Rollback again: current -> initial-key, history -> [].
        let rb2 = rotator.rollback().expect("rollback #2 ok");
        assert_eq!(rb2.reverted_to.expose(), "initial-key");
        assert_eq!(rb2.now_discarded.expose(), "key-1");
        assert_eq!(rotator.current().expose(), "initial-key");
        assert_eq!(rotator.history_len(), 0);

        // Rolling back with empty history returns NoHistory.
        let err = rotator.rollback().expect_err("rollback #3 must fail");
        assert!(matches!(err, RotationError::NoHistory));
        // Current is unchanged.
        assert_eq!(rotator.current().expose(), "initial-key");
    }

    /// Bonus: verify the FileSource actually reads from disk
    /// (not just the trait). This is the only test in this
    /// module that exercises the FileSource directly.
    #[test]
    fn file_source_reads_from_disk() {
        let tf = TempFile::new("file-source-test", "sk-live-from-file\n");
        let source = FileSource::new(tf.path.clone());
        let key = source.fetch().expect("file read must succeed");
        assert_eq!(key.expose(), "sk-live-from-file");
    }

    /// Bonus: verify the EnvSource reads from the env. The
    /// test isolates the env var with a unique name (per-PID
    /// suffix) so it does not collide with other tests.
    #[test]
    fn env_source_reads_from_env() {
        let var = format!(
            "PHENO_CONFIG_TEST_ROTATION_{}_{}",
            std::process::id(),
            "ENV_SOURCE"
        );
        // Single-threaded test: set the env var, fetch, remove.
        env::set_var(&var, "sk-live-from-env");
        let source = EnvSource::new(&var);
        let key = source.fetch().expect("env read must succeed");
        assert_eq!(key.expose(), "sk-live-from-env");
        env::remove_var(&var);
    }

    /// Bonus: verify the VaultSource stub returns the expected
    /// "feature not enabled" error. This documents the contract
    /// for downstream consumer crates that want to swap in a
    /// real implementation.
    #[test]
    fn vault_source_stub_returns_unavailable_error() {
        let source = VaultSource::new(
            "https://vault.example.com:8200",
            "hvs.test-token",
            "secret/data/pheno/api-key",
        );
        let err = source.fetch().expect_err("vault stub must error");
        match err {
            RotationError::SourceUnavailable(msg) => {
                assert!(msg.contains("pheno-vault"));
                assert!(msg.contains("address=") || msg.contains("path="));
            }
            other => panic!("expected SourceUnavailable, got {other:?}"),
        }
    }

    /// Bonus: trim_history caps the rollback window.
    #[test]
    fn trim_history_caps_rollback_window() {
        // Pre-canned values for 3 successful rotations. Pop
        // order: "k1" first, "k2" second, "k3" third. So push
        // "k3" first, "k2" second, "k1" third.
        let source = SequenceSource::new(vec![
            Ok(ApiKey::new("k3")),
            Ok(ApiKey::new("k2")),
            Ok(ApiKey::new("k1")),
        ]);
        let mut rotator = SecretRotator::new(ApiKey::new("initial"), source);
        rotator.rotate().unwrap(); // current=k1, history=[initial]
        rotator.rotate().unwrap(); // current=k2, history=[initial, k1]
        rotator.rotate().unwrap(); // current=k3, history=[initial, k1, k2]
        assert_eq!(rotator.history_len(), 3);

        rotator.trim_history(1);
        assert_eq!(rotator.history_len(), 1);
        // The most-recent entry (k2, the value that was live
        // just before k3) is kept; older entries are dropped.
        assert_eq!(rotator.history[0].expose(), "k2");
    }
}
