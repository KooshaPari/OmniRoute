//! Device record types shared across the fleet registry.

use serde::{Deserialize, Serialize};

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
