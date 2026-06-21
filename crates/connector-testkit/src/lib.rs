// SPDX-License-Identifier: MIT OR Apache-2.0

//! Fixture replay + mock harness for connector authors.

use focus_connectors::Connector;
use focus_events::{DedupeKey, NormalizedEvent};
use std::collections::HashSet;

pub struct FixtureReplay;
pub struct MockSyncRunner;

pub struct ConnectorTestHarness<C: Connector> {
    pub connector: C,
}

impl<C: Connector> ConnectorTestHarness<C> {
    pub fn new(connector: C) -> Self {
        Self { connector }
    }
}

/// Minimal in-memory event store used by the dedupe contract test.
/// Rejects duplicate `dedupe_key` inserts silently (idempotent ingest).
/// Traces to: FR-CONN-003.
#[derive(Default)]
pub struct HelperEventStore {
    seen: HashSet<DedupeKey>,
    stored: Vec<NormalizedEvent>,
}

impl HelperEventStore {
    pub fn new() -> Self {
        Self::default()
    }

    /// Returns `true` if the event was newly persisted, `false` if deduped.
    pub fn ingest(&mut self, event: NormalizedEvent) -> bool {
        if self.seen.contains(&event.dedupe_key) {
            return false;
        }
        self.seen.insert(event.dedupe_key.clone());
        self.stored.push(event);
        true
    }

    pub fn len(&self) -> usize {
        self.stored.len()
    }

    pub fn is_empty(&self) -> bool {
        self.stored.is_empty()
    }
}
