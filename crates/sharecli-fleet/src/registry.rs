//! Device registry backed by NATS.io.
//!
//! The registry connects to a NATS broker and publishes [`DeviceRecord`]s to
//! subject `{prefix}.devices.{device_id}`. Listing is a stub until the
//! subscribe-and-merge implementation lands in a follow-up.

use anyhow::Context;
use async_nats::Client;
use serde::{Deserialize, Serialize};

/// Default subject prefix used by [`FleetRegistry::connect`].
pub const DEFAULT_SUBJECT_PREFIX: &str = "sharecli.fleet";

/// A device participating in the fleet.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct DeviceRecord {
    /// Stable device identifier (e.g., UUID).
    pub device_id: String,
    /// Hostname reported by the device.
    pub hostname: String,
    /// Operating system identifier (e.g., "darwin", "linux").
    pub os: String,
    /// Number of free execution slots the device can accept.
    pub available_slots: u32,
}

/// Fleet registry — publishes device records to a NATS subject.
#[derive(Debug, Clone)]
pub struct FleetRegistry {
    nats_client: Option<Client>,
    subject_prefix: String,
}

impl FleetRegistry {
    /// Connect to a NATS broker and return a registry ready to `register`
    /// devices. Uses [`DEFAULT_SUBJECT_PREFIX`] for the subject namespace.
    pub async fn connect(url: &str) -> anyhow::Result<Self> {
        let client = async_nats::connect(url)
            .await
            .with_context(|| format!("failed to connect to NATS at {url}"))?;
        Ok(Self { nats_client: Some(client), subject_prefix: DEFAULT_SUBJECT_PREFIX.to_string() })
    }

    /// Return a registry without a NATS connection (useful for tests and for
    /// callers that want to attach a client manually later).
    pub fn disconnected() -> Self {
        Self { nats_client: None, subject_prefix: DEFAULT_SUBJECT_PREFIX.to_string() }
    }

    /// Override the subject prefix on a builder-style chain.
    pub fn with_subject_prefix(mut self, prefix: impl Into<String>) -> Self {
        self.subject_prefix = prefix.into();
        self
    }

    /// Publish `record` to NATS subject `{prefix}.devices.{device_id}` as
    /// JSON. Errors if the registry was never connected.
    pub async fn register(&self, record: DeviceRecord) -> anyhow::Result<()> {
        let client = self
            .nats_client
            .as_ref()
            .ok_or_else(|| anyhow::anyhow!("FleetRegistry not connected to NATS"))?;
        let subject = format!("{}.devices.{}", self.subject_prefix, record.device_id);
        let payload = serde_json::to_vec(&record).context("failed to serialize DeviceRecord")?;
        client
            .publish(subject, payload.into())
            .await
            .with_context(|| format!("NATS publish failed for device {}", record.device_id))?;
        Ok(())
    }

    /// Return all known devices.
    ///
    /// Stub: returns an empty list until subscribe-and-merge lands.
    pub async fn list_devices(&self) -> anyhow::Result<Vec<DeviceRecord>> {
        Ok(Vec::new())
    }

    /// Subject that `register` would publish to for a given device id.
    pub fn subject_for(&self, device_id: &str) -> String {
        format!("{}.devices.{}", self.subject_prefix, device_id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn device_record_serializes_to_expected_json_keys() {
        let rec = DeviceRecord {
            device_id: "dev-001".into(),
            hostname: "host-a".into(),
            os: "darwin".into(),
            available_slots: 4,
        };
        let json = serde_json::to_string(&rec).expect("serialize");
        for key in ["device_id", "hostname", "os", "available_slots"] {
            assert!(json.contains(&format!("\"{key}\"")), "missing {key} in {json}");
        }
        assert!(json.contains("\"device_id\":\"dev-001\""));
        assert!(json.contains("\"available_slots\":4"));
    }

    #[test]
    fn device_record_json_roundtrips() {
        let rec = DeviceRecord {
            device_id: "dev-002".into(),
            hostname: "host-b".into(),
            os: "linux".into(),
            available_slots: 0,
        };
        let json = serde_json::to_string(&rec).expect("serialize");
        let parsed: DeviceRecord = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(parsed, rec);
    }

    #[test]
    fn device_record_equality_and_clone() {
        let a = DeviceRecord {
            device_id: "x".into(),
            hostname: "h".into(),
            os: "linux".into(),
            available_slots: 1,
        };
        let b = a.clone();
        assert_eq!(a, b);
        let c = DeviceRecord { device_id: "y".into(), ..a.clone() };
        assert_ne!(a, c);
    }

    #[tokio::test]
    async fn register_errors_when_disconnected() {
        let reg = FleetRegistry::disconnected().with_subject_prefix("sharecli.fleet");
        let rec = DeviceRecord {
            device_id: "dev-003".into(),
            hostname: "host-c".into(),
            os: "linux".into(),
            available_slots: 2,
        };
        let err =
            reg.register(rec).await.expect_err("register must error without a NATS connection");
        assert!(err.to_string().contains("not connected"), "unexpected error message: {err}");
    }

    #[tokio::test]
    async fn list_devices_stub_returns_empty() {
        let reg = FleetRegistry::disconnected();
        let devices = reg.list_devices().await.expect("list_devices stub should be Ok");
        assert!(devices.is_empty());
    }

    #[test]
    fn subject_for_uses_prefix_and_device_id() {
        let reg = FleetRegistry::disconnected().with_subject_prefix("sharecli.fleet");
        assert_eq!(reg.subject_for("abc-123"), "sharecli.fleet.devices.abc-123");
        let custom = FleetRegistry::disconnected().with_subject_prefix("acme");
        assert_eq!(custom.subject_for("z9"), "acme.devices.z9");
    }
}
