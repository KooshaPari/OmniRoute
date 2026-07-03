//! `sharecli-fleet` — fleet registry and thermal governor stubs.
//!
//! This crate will provide the device registry and thermal-aware scheduling
//! primitives for sharecli's fleet runtime. The current scaffold is a stub:
//! shapes and connection entry-point only.

pub mod registry;
pub mod thermal;

pub use registry::DeviceRecord;
pub use thermal::ThermalGovernor;

/// Stub registry — tracks devices available to a fleet.
#[derive(Debug, Default, Clone)]
pub struct FleetRegistry {
    _private: (),
}

impl FleetRegistry {
    /// Create a new, empty registry.
    pub fn new() -> Self {
        Self { _private: () }
    }
}

/// Connect to the fleet backend (NATS).
///
/// Stub: returns `Ok(())` until NATS wiring lands in a follow-up PR.
pub async fn connect() -> anyhow::Result<()> {
    tracing::debug!("sharecli-fleet::connect() — stub, no backend attached");
    Ok(())
}
