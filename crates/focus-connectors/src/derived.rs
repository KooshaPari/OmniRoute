// SPDX-License-Identifier: MIT OR Apache-2.0

//! Derived / meta connectors.
//!
//! A [`DerivedConnector`] wraps N base [`Connector`]s and a transformation
//! function. On [`Connector::sync`] it syncs every base, collects their
//! events, pipes the combined stream through the transform, and returns
//! the transform's output. Useful for composite signals like a focus
//! score that fuses calendar + commits.
//!
//! Traces to: FR-CONN-DERIVED-001.

use crate::{
    Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode, SyncOutcome,
    VerificationTier,
};
use async_trait::async_trait;
use focus_events::NormalizedEvent;
use std::sync::Arc;

/// Transform trait — consumes the combined event stream and emits derived
/// events. Implemented automatically for any `Fn(&[NormalizedEvent]) -> Vec<NormalizedEvent>`.
pub trait DerivedTransform: Send + Sync {
    fn transform(&self, input: &[NormalizedEvent]) -> Vec<NormalizedEvent>;
}

impl<F> DerivedTransform for F
where
    F: Fn(&[NormalizedEvent]) -> Vec<NormalizedEvent> + Send + Sync,
{
    fn transform(&self, input: &[NormalizedEvent]) -> Vec<NormalizedEvent> {
        (self)(input)
    }
}

/// Wraps a set of base connectors + a transform. `sync` fans out to every
/// base (with the shared incoming cursor — callers aggregating per-base
/// cursors must compose externally), merges their events in base order,
/// pipes them through the transform, and returns the derived output.
///
/// `next_cursor` is the lexicographically largest non-empty cursor reported
/// by any base, so a caller that persists it sees progress even though the
/// derived connector itself has no native cursor. `partial` propagates if
/// any base reported partial.
pub struct DerivedConnector<T: DerivedTransform> {
    bases: Vec<Arc<dyn Connector>>,
    transform: T,
    manifest: ConnectorManifest,
}

impl<T: DerivedTransform> DerivedConnector<T> {
    /// Build a derived connector. `event_types` declares the event types
    /// the transform emits — surfaced in the manifest for UI filtering.
    pub fn new(
        display_name: impl Into<String>,
        bases: Vec<Arc<dyn Connector>>,
        transform: T,
        event_types: Vec<String>,
    ) -> Self {
        // Id is the sorted join of base ids with `+`; deterministic across
        // reorderings of `bases`.
        let mut ids: Vec<String> = bases.iter().map(|c| c.manifest().id.clone()).collect();
        ids.sort();
        let id = format!("derived:{}", ids.join("+"));
        let manifest = ConnectorManifest {
            id,
            version: "0.1.0".into(),
            display_name: display_name.into(),
            auth_strategy: crate::AuthStrategy::None,
            sync_mode: SyncMode::Polling { cadence_seconds: 60 },
            capabilities: vec![],
            entity_types: vec![],
            event_types,
            tier: VerificationTier::Verified,
            health_indicators: vec!["base_bases_healthy".into()],
        };
        Self { bases, transform, manifest }
    }
}

#[async_trait]
impl<T: DerivedTransform + 'static> Connector for DerivedConnector<T> {
    fn manifest(&self) -> &ConnectorManifest {
        &self.manifest
    }

    async fn health(&self) -> HealthState {
        for base in &self.bases {
            match base.health().await {
                HealthState::Healthy => continue,
                other => return other,
            }
        }
        HealthState::Healthy
    }

    async fn sync(&self, cursor: Option<String>) -> Result<SyncOutcome> {
        let mut combined: Vec<NormalizedEvent> = Vec::new();
        let mut max_cursor: Option<String> = None;
        let mut partial = false;
        for base in &self.bases {
            match base.sync(cursor.clone()).await {
                Ok(out) => {
                    combined.extend(out.events);
                    if out.partial {
                        partial = true;
                    }
                    if let Some(c) = out.next_cursor {
                        max_cursor = Some(match max_cursor {
                            Some(existing) if existing >= c => existing,
                            _ => c,
                        });
                    }
                }
                Err(ConnectorError::RateLimited(secs)) => {
                    // Fail-fast on rate-limits — propagating the tightest
                    // deadline lets the orchestrator back off uniformly.
                    return Err(ConnectorError::RateLimited(secs));
                }
                Err(e) => return Err(e),
            }
        }
        let derived = self.transform.transform(&combined);
        Ok(SyncOutcome { events: derived, next_cursor: max_cursor, partial })
    }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{AuthStrategy, SyncMode, VerificationTier};
    use async_trait::async_trait;
    use chrono::Utc;
    use focus_events::{DedupeKey, EventType, NormalizedEvent};
    use uuid::Uuid;

    struct StaticBase {
        manifest: ConnectorManifest,
        events: Vec<NormalizedEvent>,
        cursor: Option<String>,
    }

    impl StaticBase {
        fn new(id: &str, events: Vec<NormalizedEvent>, cursor: Option<String>) -> Self {
            Self {
                manifest: ConnectorManifest {
                    id: id.into(),
                    version: "0.0.1".into(),
                    display_name: id.into(),
                    auth_strategy: AuthStrategy::None,
                    sync_mode: SyncMode::Polling { cadence_seconds: 60 },
                    capabilities: vec![],
                    entity_types: vec![],
                    event_types: vec![],
                    tier: VerificationTier::Official,
                    health_indicators: vec![],
                },
                events,
                cursor,
            }
        }
    }

    #[async_trait]
    impl Connector for StaticBase {
        fn manifest(&self) -> &ConnectorManifest {
            &self.manifest
        }
        async fn health(&self) -> HealthState {
            HealthState::Healthy
        }
        async fn sync(&self, _cursor: Option<String>) -> Result<SyncOutcome> {
            Ok(SyncOutcome {
                events: self.events.clone(),
                next_cursor: self.cursor.clone(),
                partial: false,
            })
        }
    }

    fn mk_event(connector: &str, kind: &str) -> NormalizedEvent {
        NormalizedEvent {
            event_id: Uuid::new_v4(),
            connector_id: connector.into(),
            account_id: Uuid::nil(),
            event_type: EventType::Custom(kind.into()),
            occurred_at: Utc::now(),
            effective_at: Utc::now(),
            dedupe_key: DedupeKey(format!("{connector}:{kind}")),
            confidence: 1.0,
            payload: serde_json::json!({"source": connector}),
            raw_ref: None,
        }
    }

    #[tokio::test]
    async fn derived_transforms_combined_base_events_and_picks_max_cursor() {
        let gcal = Arc::new(StaticBase::new(
            "gcal",
            vec![mk_event("gcal", "event_started")],
            Some("cursor-005".into()),
        ));
        let github = Arc::new(StaticBase::new(
            "github",
            vec![mk_event("github", "push")],
            Some("cursor-020".into()),
        ));

        // Transform: emit one `focus.session.score` event if both bases
        // produced at least one event.
        let transform = |inputs: &[NormalizedEvent]| -> Vec<NormalizedEvent> {
            let has_gcal = inputs.iter().any(|e| e.connector_id == "gcal");
            let has_gh = inputs.iter().any(|e| e.connector_id == "github");
            if has_gcal && has_gh {
                vec![NormalizedEvent {
                    event_id: Uuid::new_v4(),
                    connector_id: "derived:gcal+github".into(),
                    account_id: Uuid::nil(),
                    event_type: EventType::Custom("focus.session.score".into()),
                    occurred_at: Utc::now(),
                    effective_at: Utc::now(),
                    dedupe_key: DedupeKey("derived-score".into()),
                    confidence: 1.0,
                    payload: serde_json::json!({"score": inputs.len()}),
                    raw_ref: None,
                }]
            } else {
                vec![]
            }
        };

        let derived = DerivedConnector::new(
            "Focus Score",
            vec![gcal, github],
            transform,
            vec!["focus.session.score".into()],
        );

        assert_eq!(derived.manifest().id, "derived:gcal+github");
        assert_eq!(derived.manifest().tier, VerificationTier::Verified);

        let out = derived.sync(None).await.expect("sync");
        assert_eq!(out.events.len(), 1);
        assert!(matches!(
            &out.events[0].event_type,
            EventType::Custom(s) if s == "focus.session.score"
        ));
        assert_eq!(out.next_cursor.as_deref(), Some("cursor-020"));
        assert!(!out.partial);
    }
}
