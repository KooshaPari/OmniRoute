//! `EventEnvelope` — the canonical wire-level event carrier.
//!
//! See [`EventEnvelope`] for the field reference; this module just
//! owns the struct + its validation + its builder.

use chrono::{DateTime, Utc};
use proptest::prelude::*;
use proptest::strategy::Strategy;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use uuid::{NoContext, Timestamp, Uuid};

/// Canonical wire-level event envelope.
///
/// Every cross-service event in the `pheno-*` fleet is wrapped in
/// an `EventEnvelope`. The fields are:
///
/// - `id` — a UUIDv7 (time-ordered) identifier assigned at
///   construction time (NOT by the caller).
/// - `event_type` — short, machine-readable event name
///   (e.g. `"user.created"`). Must be non-empty (enforced by
///   [`EventEnvelope::validate`]).
/// - `source` — the publishing service's identifier
///   (e.g. `"accounts"`). Must be non-empty (enforced by
///   [`EventEnvelope::validate`]).
/// - `timestamp` — UTC timestamp set at construction time.
/// - `causation_id` / `correlation_id` — optional parent event ids
///   for distributed tracing through the event chain.
/// - `schema_version` — monotonically increasing per `event_type`,
///   used by the schema registry (lives in `phenoEvents/src/schema`)
///   to enforce additive-only evolution. Must be `>= 1`.
/// - `payload` — arbitrary JSON-shaped body, validated against the
///   registered schema (if any) by the registry.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct EventEnvelope {
    pub id: Uuid,
    pub event_type: String,
    pub source: String,
    pub timestamp: DateTime<Utc>,
    pub causation_id: Option<Uuid>,
    pub correlation_id: Option<Uuid>,
    pub schema_version: u32,
    pub payload: Value,
}

// ---------------------------------------------------------------------------
// proptest::Arbitrary impls (v20-T5 / L23)
// ---------------------------------------------------------------------------

/// Helper strategy: any [`Uuid`].
///
/// `Uuid` does not implement `Arbitrary` upstream, so we map from a
/// 128-bit unsigned integer via [`Uuid::from_u128`]. The bit pattern
/// is *not* required to be a valid v7 UUID — `EventEnvelope::validate`
/// only checks `event_type`, `source`, and `schema_version`, so the
/// `id` bit pattern is irrelevant for property tests.
fn arb_uuid() -> proptest::strategy::BoxedStrategy<Uuid> {
    any::<u128>().prop_map(Uuid::from_u128).boxed()
}

/// Helper strategy: any UTC [`DateTime`].
///
/// `DateTime<Utc>` does not implement `Arbitrary` upstream, so we map
/// from a `u64` Unix timestamp (seconds since epoch). The range is
/// 1970-01-01 .. 2100-01-01 — wide enough to exercise the timestamp
/// formatting path without going past `DateTime::from_timestamp`'s
/// documented range.
fn arb_timestamp() -> proptest::strategy::BoxedStrategy<DateTime<Utc>> {
    (0u64..=4_102_444_800u64)
        .prop_map(|secs| {
            DateTime::<Utc>::from_timestamp(secs, 0).expect("timestamp in range")
        })
        .boxed()
}

/// Helper strategy: a small bounded JSON [`Value`].
///
/// `Value` does not implement `Arbitrary` upstream, so we hand-roll a
/// recursive generator. Leaves are `null | bool | i64 | short-string`;
/// the recursion level is capped at 3 and per-branch size at 4 so the
/// generated value is small (single-digit KB) — wide enough to exercise
/// the JSON serialisation path but narrow enough to keep proptest
/// fast.
fn arb_json_value() -> proptest::strategy::BoxedStrategy<Value> {
    let leaf = prop_oneof![
        proptest::strategy::Just(Value::Null),
        any::<bool>().prop_map(Value::Bool),
        any::<i64>().prop_map(|n| Value::Number(n.into())),
        proptest::string::string_regex("[A-Za-z0-9_\\-\\.]{0,32}")
            .expect("json string regex")
            .prop_map(Value::String),
    ];

    leaf.prop_recursive(
        3,  // max depth
        64, // max size
        4,  // expected branch factor
        |inner| {
            proptest::collection::vec(inner, 0..=4)
                .prop_map(|items| Value::Array(items))
        },
    )
}

impl proptest::arbitrary::Arbitrary for EventEnvelope {
    type Parameters = ();
    type Strategy = proptest::strategy::BoxedStrategy<Self>;

    fn arbitrary_with((): Self::Parameters) -> Self::Strategy {
        (
            arb_uuid(),
            proptest::string::string_regex("[a-z][a-z0-9_.]{1,32}")
                .expect("event_type regex"),
            proptest::string::string_regex("[a-z][a-z0-9_.]{1,32}")
                .expect("source regex"),
            arb_timestamp(),
            proptest::option::of(arb_uuid()),
            proptest::option::of(arb_uuid()),
            1u32..=u32::MAX, // schema_version >= 1 (validate() rejects 0)
            arb_json_value(),
        )
            .prop_map(
                |(
                    id,
                    event_type,
                    source,
                    timestamp,
                    causation_id,
                    correlation_id,
                    schema_version,
                    payload,
                )| {
                    EventEnvelope {
                        id,
                        event_type,
                        source,
                        timestamp,
                        causation_id,
                        correlation_id,
                        schema_version,
                        payload,
                    }
                },
            )
            .boxed()
    }
}

/// Errors raised by [`EventEnvelope::validate`] and the builder.
#[derive(Debug, thiserror::Error, PartialEq, Eq)]
pub enum EnvelopeError {
    #[error("event_type must not be empty")]
    EmptyEventType,
    #[error("source must not be empty")]
    EmptySource,
    #[error("schema_version must be at least 1")]
    InvalidSchemaVersion,
}

impl EventEnvelope {
    pub fn new(
        event_type: impl Into<String>,
        source: impl Into<String>,
        schema_version: u32,
        payload: Value,
    ) -> Result<Self, EnvelopeError> {
        Self::builder(event_type, source, payload)
            .schema_version(schema_version)
            .build()
    }

    pub fn builder(
        event_type: impl Into<String>,
        source: impl Into<String>,
        payload: Value,
    ) -> EventEnvelopeBuilder {
        EventEnvelopeBuilder {
            event_type: event_type.into(),
            source: source.into(),
            payload,
            causation_id: None,
            correlation_id: None,
            schema_version: 1,
        }
    }

    pub fn validate(&self) -> Result<(), EnvelopeError> {
        validate_event_type(&self.event_type)?;
        validate_source(&self.source)?;
        validate_schema_version(self.schema_version)
    }
}

#[derive(Debug, Clone)]
pub struct EventEnvelopeBuilder {
    event_type: String,
    source: String,
    payload: Value,
    causation_id: Option<Uuid>,
    correlation_id: Option<Uuid>,
    schema_version: u32,
}

impl EventEnvelopeBuilder {
    pub fn causation_id(mut self, id: Uuid) -> Self {
        self.causation_id = Some(id);
        self
    }

    pub fn correlation_id(mut self, id: Uuid) -> Self {
        self.correlation_id = Some(id);
        self
    }

    pub fn schema_version(mut self, schema_version: u32) -> Self {
        self.schema_version = schema_version;
        self
    }

    pub fn build(self) -> Result<EventEnvelope, EnvelopeError> {
        validate_event_type(&self.event_type)?;
        validate_source(&self.source)?;
        validate_schema_version(self.schema_version)?;

        Ok(EventEnvelope {
            id: new_uuid_v7(),
            event_type: self.event_type,
            source: self.source,
            timestamp: Utc::now(),
            causation_id: self.causation_id,
            correlation_id: self.correlation_id,
            schema_version: self.schema_version,
            payload: self.payload,
        })
    }
}

fn validate_event_type(event_type: &str) -> Result<(), EnvelopeError> {
    if event_type.trim().is_empty() {
        return Err(EnvelopeError::EmptyEventType);
    }

    Ok(())
}

fn validate_source(source: &str) -> Result<(), EnvelopeError> {
    if source.trim().is_empty() {
        return Err(EnvelopeError::EmptySource);
    }

    Ok(())
}

fn validate_schema_version(schema_version: u32) -> Result<(), EnvelopeError> {
    if schema_version == 0 {
        return Err(EnvelopeError::InvalidSchemaVersion);
    }

    Ok(())
}

fn new_uuid_v7() -> Uuid {
    Uuid::new_v7(Timestamp::now(NoContext))
}

#[cfg(test)]
mod tests {
    use super::{EnvelopeError, EventEnvelope};
    use serde_json::json;
    use uuid::Version;

    #[test]
    fn builder_creates_valid_envelope_with_v7_id() {
        let causation_id = uuid::Uuid::now_v7();
        let correlation_id = uuid::Uuid::now_v7();

        let envelope = EventEnvelope::builder("user.created", "accounts", json!({"id": 1}))
            .causation_id(causation_id)
            .correlation_id(correlation_id)
            .schema_version(2)
            .build()
            .expect("valid envelope");

        assert_eq!(envelope.id.get_version(), Some(Version::SortRand));
        assert_eq!(envelope.event_type, "user.created");
        assert_eq!(envelope.source, "accounts");
        assert_eq!(envelope.causation_id, Some(causation_id));
        assert_eq!(envelope.correlation_id, Some(correlation_id));
        assert_eq!(envelope.schema_version, 2);
        assert_eq!(envelope.payload, json!({"id": 1}));
        assert!(envelope.validate().is_ok());
    }

    #[test]
    fn defaults_schema_version_to_one() {
        let envelope = EventEnvelope::builder("user.created", "accounts", json!({}))
            .build()
            .expect("valid envelope");

        assert_eq!(envelope.schema_version, 1);
    }

    #[test]
    fn rejects_empty_event_type() {
        let error = EventEnvelope::builder(" ", "accounts", json!({}))
            .build()
            .expect_err("empty event type should fail");

        assert_eq!(error, EnvelopeError::EmptyEventType);
    }

    #[test]
    fn rejects_empty_source() {
        let error = EventEnvelope::builder("user.created", "\t", json!({}))
            .build()
            .expect_err("empty source should fail");

        assert_eq!(error, EnvelopeError::EmptySource);
    }

    #[test]
    fn rejects_zero_schema_version() {
        let error = EventEnvelope::builder("user.created", "accounts", json!({}))
            .schema_version(0)
            .build()
            .expect_err("zero schema version should fail");

        assert_eq!(error, EnvelopeError::InvalidSchemaVersion);
    }
}