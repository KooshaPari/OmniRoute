//! `sharecli-fleet` — fleet registry and thermal governor.
//!
//! Provides the device registry (NATS-backed) and thermal-aware scheduling
//! primitives for sharecli's fleet runtime.

pub mod registry;
pub mod thermal;

pub use registry::{DeviceRecord, FleetRegistry, DEFAULT_SUBJECT_PREFIX};
pub use thermal::{ThermalGovernor, ThermalLevel};

use async_nats::Client;

/// Default NATS coordinator URL used when none is specified.
pub const DEFAULT_COORDINATOR: &str = "nats://localhost:4222";

/// NATS subject for fleet-wide device announcements.
pub const FLEET_SUBJECT: &str = "sharecli.fleet.devices";

/// Connect to the NATS coordinator and return a client.
pub async fn connect(coordinator: &str) -> anyhow::Result<Client> {
    let client = async_nats::connect(coordinator)
        .await
        .map_err(|e| anyhow::anyhow!("NATS connect to {coordinator} failed: {e}"))?;
    tracing::info!(coordinator, "sharecli-fleet: connected to NATS coordinator");
    Ok(client)
}

/// Publish this device's [`DeviceRecord`] to the fleet subject.
pub async fn announce(client: &Client, record: &DeviceRecord) -> anyhow::Result<()> {
    let payload = serde_json::to_vec(record)?;
    client.publish(FLEET_SUBJECT, payload.into()).await?;
    Ok(())
}

/// Subscribe to fleet device announcements and return a subscriber.
pub async fn subscribe(client: &Client) -> anyhow::Result<async_nats::Subscriber> {
    Ok(client.subscribe(FLEET_SUBJECT).await?)
}

/// Publish a DeviceRecord health-beat every `interval` until the token is cancelled.
///
/// Runs in the background — spawn with `tokio::spawn(health_beat(...))`.
/// Stops cleanly when the `async_nats::Client` is dropped or the interval is cancelled.
pub async fn health_beat(client: Client, record: DeviceRecord, interval: std::time::Duration) {
    let mut ticker = tokio::time::interval(interval);
    loop {
        ticker.tick().await;
        if let Err(e) = announce(&client, &record).await {
            tracing::warn!("health_beat: announce failed: {e}");
        }
    }
}
