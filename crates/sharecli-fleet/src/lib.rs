//! `sharecli-fleet` — fleet registry and thermal governor.
//!
//! Provides the device registry (NATS-backed) and thermal-aware scheduling
//! primitives for sharecli's fleet runtime.

pub mod registry;
pub mod thermal;

pub use registry::{DeviceRecord, FleetRegistry, DEFAULT_SUBJECT_PREFIX};
pub use thermal::{ThermalGovernor, ThermalLevel};
