// SPDX-License-Identifier: MIT OR Apache-2.0

//! Append-side port for normalized events produced by connectors.
//!
//! `SyncOrchestrator` calls [`EventSink::append`] for every event returned
//! by a successful `Connector::sync`. A [`NoopEventSink`] exists so callers
//! that don't wire a real store (tests, CLI dry-runs) still compile; the
//! FFI / iOS path wires an adapter around `focus_storage::EventStore`.
//!
//! Kept in `focus-sync` (not `focus-storage`) to avoid a cross-crate
//! dependency cycle: `focus-ffi` already depends on both.

use async_trait::async_trait;
use focus_events::NormalizedEvent;

#[async_trait]
pub trait EventSink: Send + Sync {
    async fn append(&self, event: NormalizedEvent) -> anyhow::Result<()>;
}

/// Default sink — discards the event. Callers that want durability wire a
/// real implementation (e.g. an adapter over `focus_storage::EventStore`).
#[derive(Debug, Default)]
pub struct NoopEventSink;

impl NoopEventSink {
    pub fn new() -> Self {
        Self
    }
}

#[async_trait]
impl EventSink for NoopEventSink {
    async fn append(&self, _event: NormalizedEvent) -> anyhow::Result<()> {
        Ok(())
    }
}
