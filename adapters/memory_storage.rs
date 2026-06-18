//! In-memory [`StoragePort`] adapter.
//!
//! Implements chunk-oriented storage backed by an in-memory
//! `HashMap<ChunkId, ChunkData>`, guarded by a `std::sync::Mutex` for safe
//! concurrent access. Intended for tests, ephemeral callers, and any code
//! path that needs a `StoragePort` without touching disk. A real deployment
//! would swap this for a SQLite- or S3-backed adapter that also implements
//! [`StoragePort`].
//!
//! Traces to: FR-DATA-001 (port surface).

use std::collections::HashMap;
use std::sync::{Mutex, MutexGuard};

use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use thiserror::Error;
use uuid::Uuid;

// ---------------------------------------------------------------------------
// Domain types
// ---------------------------------------------------------------------------

/// Opaque, globally-unique identifier for a stored chunk.
///
/// Wraps a [`uuid::Uuid`] for content-agnostic lookups; the chunking layer
/// is free to assign ids deterministically (e.g. SHA-256 of the payload)
/// or randomly — this newtype doesn't care.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, PartialOrd, Ord, Serialize, Deserialize)]
#[serde(transparent)]
pub struct ChunkId(pub Uuid);

impl ChunkId {
    /// Generate a fresh random chunk id (UUID v4).
    pub fn new() -> Self {
        Self(Uuid::new_v4())
    }
}

impl Default for ChunkId {
    fn default() -> Self {
        Self::new()
    }
}

impl std::fmt::Display for ChunkId {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        self.0.fmt(f)
    }
}

impl From<Uuid> for ChunkId {
    fn from(id: Uuid) -> Self {
        Self(id)
    }
}

impl From<ChunkId> for Uuid {
    fn from(id: ChunkId) -> Self {
        id.0
    }
}

/// A single chunk's payload: opaque bytes plus an arbitrary metadata map.
///
/// Callers are free to interpret `bytes` however they like (JSON, protobuf,
/// raw blobs, encrypted ciphertext, …). `metadata` is a `String -> String`
/// map for small, serializable annotations (MIME type, content hash, origin
/// uri, retention hint, …).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct ChunkData {
    /// Raw chunk bytes.
    pub bytes: Vec<u8>,
    /// Free-form metadata.
    pub metadata: HashMap<String, String>,
}

impl ChunkData {
    /// Construct a chunk from raw bytes with empty metadata.
    pub fn new(bytes: impl Into<Vec<u8>>) -> Self {
        Self { bytes: bytes.into(), metadata: HashMap::new() }
    }

    /// Construct a chunk with metadata attached.
    pub fn with_metadata(
        bytes: impl Into<Vec<u8>>,
        metadata: HashMap<String, String>,
    ) -> Self {
        Self { bytes: bytes.into(), metadata }
    }

    /// Length of the byte payload in bytes.
    pub fn len(&self) -> usize {
        self.bytes.len()
    }

    /// `true` if the byte payload is empty.
    pub fn is_empty(&self) -> bool {
        self.bytes.is_empty()
    }
}

// ---------------------------------------------------------------------------
// Port + error
// ---------------------------------------------------------------------------

/// Errors a [`StoragePort`] can return.
///
/// Concrete adapters are free to surface backend-specific failures as
/// [`StorageError::Backend`]; the in-memory adapter only emits [`Poisoned`]
/// and (prophylactically) [`Backend`].
#[derive(Debug, Error)]
pub enum StorageError {
    /// The requested chunk was not present in the store.
    #[error("chunk {0} not found")]
    NotFound(ChunkId),
    /// Caller supplied a malformed chunk id (currently unused, but reserved
    /// for adapters that accept string-typed ids from the wire).
    #[error("invalid chunk id: {0}")]
    InvalidId(String),
    /// A concurrency primitive was poisoned. Indicates a panic in another
    /// thread held the lock; the adapter cannot make progress.
    #[error("storage mutex poisoned: {0}")]
    Poisoned(String),
    /// Backend-specific failure escape hatch (I/O, network, decoding, …).
    #[error("backend error: {0}")]
    Backend(String),
}

impl From<StorageError> for anyhow::Error {
    fn from(e: StorageError) -> Self {
        anyhow::anyhow!(e)
    }
}

/// Chunk-oriented async storage port.
///
/// Implementations must be safe to share across threads (`Send + Sync`),
/// since callers typically hold them as `Arc<dyn StoragePort>`. They are
/// also expected to be cheap to clone or share — no per-call setup cost
/// beyond the lock/IO the backend actually needs.
///
/// Traces to: FR-DATA-001.
#[async_trait]
pub trait StoragePort: Send + Sync {
    /// Insert or replace the chunk addressed by `id`. Returns the previous
    /// value if one existed, or `None` on a fresh insert.
    async fn put(
        &self,
        id: ChunkId,
        chunk: ChunkData,
    ) -> anyhow::Result<Option<ChunkData>>;

    /// Fetch the chunk at `id`, or `None` if absent.
    async fn get(&self, id: ChunkId) -> anyhow::Result<Option<ChunkData>>;

    /// Remove the chunk at `id`. Returns `true` if a chunk was removed,
    /// `false` if it was already absent.
    async fn delete(&self, id: ChunkId) -> anyhow::Result<bool>;

    /// Cheap membership check.
    async fn contains(&self, id: ChunkId) -> anyhow::Result<bool>;

    /// Number of chunks currently held by the store.
    async fn len(&self) -> anyhow::Result<usize>;

    /// Convenience: `len() == 0`.
    async fn is_empty(&self) -> anyhow::Result<bool> {
        Ok(self.len().await? == 0)
    }

    /// Snapshot of all chunk ids currently in the store. Order is
    /// unspecified; callers that need a stable order should sort.
    async fn list_ids(&self) -> anyhow::Result<Vec<ChunkId>>;
}

// ---------------------------------------------------------------------------
// In-memory adapter
// ---------------------------------------------------------------------------

/// In-memory [`StoragePort`] backed by a `HashMap<ChunkId, ChunkData>`.
///
/// The map is wrapped in a `std::sync::Mutex`. Expected contention is low
/// (tests, ephemeral state), so we deliberately avoid pulling in
/// `tokio::sync::Mutex` — the lock is held only for cheap `HashMap` ops and
/// is never held across an `.await` point.
#[derive(Debug, Default)]
pub struct MemoryStorage {
    inner: Mutex<HashMap<ChunkId, ChunkData>>,
}

impl MemoryStorage {
    /// Construct an empty store.
    pub fn new() -> Self {
        Self::default()
    }

    /// Construct a store pre-populated with the supplied chunks.
    pub fn with_chunks<I>(chunks: I) -> Self
    where
        I: IntoIterator<Item = (ChunkId, ChunkData)>,
    {
        Self { inner: Mutex::new(chunks.into_iter().collect()) }
    }

    /// Convenience: insert a chunk and return `self` for chaining.
    pub fn insert(self, id: ChunkId, chunk: ChunkData) -> Self {
        if let Ok(mut g) = self.inner.lock() {
            g.insert(id, chunk);
        }
        self
    }

    /// Lock the inner map. Returns [`StorageError::Poisoned`] if the mutex
    /// was poisoned by a prior panic on another thread.
    fn lock(&self) -> Result<MutexGuard<'_, HashMap<ChunkId, ChunkData>>, StorageError> {
        self.inner.lock().map_err(|e| StorageError::Poisoned(e.to_string()))
    }
}

#[async_trait]
impl StoragePort for MemoryStorage {
    async fn put(
        &self,
        id: ChunkId,
        chunk: ChunkData,
    ) -> anyhow::Result<Option<ChunkData>> {
        let mut g = self.lock()?;
        Ok(g.insert(id, chunk))
    }

    async fn get(&self, id: ChunkId) -> anyhow::Result<Option<ChunkData>> {
        let g = self.lock()?;
        Ok(g.get(&id).cloned())
    }

    async fn delete(&self, id: ChunkId) -> anyhow::Result<bool> {
        let mut g = self.lock()?;
        Ok(g.remove(&id).is_some())
    }

    async fn contains(&self, id: ChunkId) -> anyhow::Result<bool> {
        let g = self.lock()?;
        Ok(g.contains_key(&id))
    }

    async fn len(&self) -> anyhow::Result<usize> {
        let g = self.lock()?;
        Ok(g.len())
    }

    async fn list_ids(&self) -> anyhow::Result<Vec<ChunkId>> {
        let g = self.lock()?;
        Ok(g.keys().copied().collect())
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
#[allow(clippy::disallowed_methods)]
mod tests {
    use super::*;

    fn chunk(payload: &[u8]) -> ChunkData {
        ChunkData::new(payload.to_vec())
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn new_store_is_empty() {
        let store = MemoryStorage::new();
        assert_eq!(store.len().await.unwrap(), 0);
        assert!(store.is_empty().await.unwrap());
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn put_then_get_round_trip() {
        let store = MemoryStorage::new();
        let id = ChunkId::new();
        let data = chunk(b"hello, world");

        assert!(store.put(id, data.clone()).await.unwrap().is_none());
        let back = store.get(id).await.unwrap().expect("present");
        assert_eq!(back, data);
        assert!(store.contains(id).await.unwrap());
        assert_eq!(store.len().await.unwrap(), 1);
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn put_returns_previous_value_on_replace() {
        let store = MemoryStorage::new();
        let id = ChunkId::new();

        store.put(id, chunk(b"v1")).await.unwrap();
        let prev = store.put(id, chunk(b"v2")).await.unwrap();
        assert_eq!(prev, Some(chunk(b"v1")));
        assert_eq!(store.get(id).await.unwrap(), Some(chunk(b"v2")));
        assert_eq!(store.len().await.unwrap(), 1);
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn get_missing_returns_none() {
        let store = MemoryStorage::new();
        let id = ChunkId::new();
        assert!(store.get(id).await.unwrap().is_none());
        assert!(!store.contains(id).await.unwrap());
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn delete_returns_true_once_then_false() {
        let store = MemoryStorage::new();
        let id = ChunkId::new();
        store.put(id, chunk(b"x")).await.unwrap();

        assert!(store.delete(id).await.unwrap());
        assert!(!store.delete(id).await.unwrap());
        assert!(store.get(id).await.unwrap().is_none());
        assert_eq!(store.len().await.unwrap(), 0);
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn list_ids_returns_all_inserted() {
        let store = MemoryStorage::new();
        let ids: Vec<ChunkId> = (0..5).map(|_| ChunkId::new()).collect();
        for id in &ids {
            store.put(*id, chunk(b"x")).await.unwrap();
        }
        let mut listed = store.list_ids().await.unwrap();
        listed.sort();
        let mut expected = ids.clone();
        expected.sort();
        assert_eq!(listed, expected);
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn with_chunks_prepopulates() {
        let a = ChunkId::new();
        let b = ChunkId::new();
        let store = MemoryStorage::with_chunks([
            (a, chunk(b"alpha")),
            (b, chunk(b"beta")),
        ]);
        assert_eq!(store.len().await.unwrap(), 2);
        assert_eq!(store.get(a).await.unwrap(), Some(chunk(b"alpha")));
        assert_eq!(store.get(b).await.unwrap(), Some(chunk(b"beta")));
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn chunk_data_with_metadata_round_trips() {
        let mut meta = HashMap::new();
        meta.insert("mime".to_string(), "application/json".to_string());
        meta.insert("hash".to_string(), "deadbeef".to_string());
        let data = ChunkData::with_metadata(br#"{"k":1}"#.to_vec(), meta.clone());

        let store = MemoryStorage::new();
        let id = ChunkId::new();
        store.put(id, data.clone()).await.unwrap();
        assert_eq!(store.get(id).await.unwrap(), Some(data));
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn chunk_id_display_matches_uuid() {
        let id = ChunkId::new();
        assert_eq!(id.to_string(), id.0.to_string());
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn chunk_id_serde_round_trip() {
        let id = ChunkId::new();
        let json = serde_json::to_string(&id).unwrap();
        let back: ChunkId = serde_json::from_str(&json).unwrap();
        assert_eq!(id, back);
    }

    // Traces to: FR-DATA-001
    #[tokio::test]
    async fn insert_helper_seeds_store() {
        let id = ChunkId::new();
        let store = MemoryStorage::new().insert(id, chunk(b"seeded"));
        assert_eq!(store.len().await.unwrap(), 1);
        assert_eq!(store.get(id).await.unwrap(), Some(chunk(b"seeded")));
    }
}
