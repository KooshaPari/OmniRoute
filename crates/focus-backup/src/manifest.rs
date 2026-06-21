// SPDX-License-Identifier: MIT OR Apache-2.0

//! Backup manifest: versioned, tamper-evident structure.

use chrono::Utc;
use serde::{Deserialize, Serialize};

/// Top-level backup structure.
///
/// - `version`: semver string (e.g. "0.0.1")
/// - `created_at`: ISO 8601 timestamp
/// - `device_id`: unique device identifier for cross-device restore context
/// - `contents`: ordered list of data sections
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BackupManifest {
    pub version: String,
    pub created_at: String,
    pub device_id: String,
    pub contents: Vec<ContentSection>,
}

impl BackupManifest {
    pub fn new(version: String, device_id: String, contents: Vec<ContentSection>) -> Self {
        Self { version, created_at: Utc::now().to_rfc3339(), device_id, contents }
    }
}

/// Data section within a backup.
///
/// Each variant represents a logical domain (wallet, audit, rules, etc.)
/// Restore can selectively merge or overwrite by section.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "type", content = "data")]
pub enum ContentSection {
    /// Audit trail records (append-only, tamper-evident chain)
    Audit(Vec<String>),

    /// Event stream (normalized events for sync)
    Events(Vec<String>),

    /// Rule definitions
    Rules(Vec<String>),

    /// Wallet state (credit balances)
    Wallets(Vec<String>),

    /// Penalty state (lockout windows, escalation)
    Penalties(Vec<String>),

    /// Tasks (planning domain)
    Tasks(Vec<String>),

    /// Templates (task templates, ritual templates)
    Templates(Vec<String>),
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_manifest_new() {
        let manifest = BackupManifest::new(
            "0.0.1".to_string(),
            "device-abc".to_string(),
            vec![ContentSection::Audit(vec!["record1".to_string()])],
        );
        assert_eq!(manifest.version, "0.0.1");
        assert_eq!(manifest.device_id, "device-abc");
        assert!(!manifest.created_at.is_empty());
    }

    #[test]
    fn test_content_section_serialization() {
        let section = ContentSection::Rules(vec!["rule1".to_string(), "rule2".to_string()]);
        let json = serde_json::to_string(&section).unwrap();
        assert!(json.contains("Rules"));
        assert!(json.contains("rule1"));
    }
}
