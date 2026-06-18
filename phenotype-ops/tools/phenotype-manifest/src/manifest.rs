//! Manifest data structures and serialization

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

/// Schema version for forward compatibility
pub const MANIFEST_SCHEMA_VERSION: u32 = 1;

/// Top-level manifest structure
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Manifest {
    /// Schema version for validation
    pub schema_version: u32,

    /// ISO 8601 timestamp when manifest was generated
    pub generated_at: DateTime<Utc>,

    /// Git commit SHA this manifest attests to
    pub commit_sha: String,

    /// Git tree SHA (covers all tracked files)
    pub tree_sha: String,

    /// Per-pillar results
    pub pillars: Pillars,

    /// Aggregated health score 0.0-1.0
    pub health_score: f64,

    /// Manifest expiration (24h default)
    pub expires_at: DateTime<Utc>,

    /// Ed25519 signature over canonical JSON (base64)
    pub signature: String,

    /// Public key used for verification (base64 Ed25519)
    pub public_key: String,

    /// Generator metadata
    #[serde(skip_serializing_if = "Option::is_none")]
    pub generator: Option<GeneratorInfo>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GeneratorInfo {
    pub name: String,
    pub version: String,
    pub rustc_version: String,
    pub platform: String,
}

/// Container for all five pillar results
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Pillars {
    pub quality: PillarResult,
    pub security: PillarResult,
    pub perf: PillarResult,
    pub compliance: PillarResult,
    pub docs: PillarResult,
}

/// Result of a single pillar
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PillarResult {
    /// Whether pillar passed overall
    pub passed: bool,

    /// Individual check results
    pub checks: HashMap<String, CheckResult>,

    /// Total duration in milliseconds
    pub duration_ms: u64,

    /// Optional: skip reason if pillar was skipped
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

/// Result of an individual check within a pillar
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CheckResult {
    pub name: String,
    pub passed: bool,
    pub duration_ms: u64,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skipped: Option<bool>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub skip_reason: Option<String>,
}

impl Manifest {
    /// Create canonical JSON for signing (deterministic ordering)
    pub fn canonical_json(&self) -> anyhow::Result<Vec<u8>> {
        // Use a deterministic serializer
        let mut serializer = serde_json::Serializer::new(Vec::new());
        self.serialize(&mut serializer)?;
        Ok(serializer.into_inner())
    }

    /// Human-readable formatting
    pub fn format_human(&self) -> String {
        let mut out = String::new();
        out.push_str(&format!("📋 Manifest v{} @ {}\n", self.schema_version, self.generated_at.format("%Y-%m-%d %H:%M:%S UTC")));
        out.push_str(&format!("   Commit: {}\n", &self.commit_sha[..12]));
        out.push_str(&format!("   Tree:   {}\n", &self.tree_sha[..12]));
        out.push_str(&format!("   Expires: {}\n", self.expires_at.format("%Y-%m-%d %H:%M:%S UTC")));
        out.push_str(&format!("   Health: {:.1}%\n", self.health_score * 100.0));
        out.push_str("\n");

        let pillars = [
            ("Quality", &self.pillars.quality),
            ("Security", &self.pillars.security),
            ("Perf", &self.pillars.perf),
            ("Compliance", &self.pillars.compliance),
            ("Docs", &self.pillars.docs),
        ];

        for (name, pillar) in pillars {
            let status = if pillar.passed { "✅" } else { "❌" };
            let skip = pillar.skip_reason.as_ref().map(|s| format!(" (skipped: {})", s)).unwrap_or_default();
            out.push_str(&format!("   {} {}: {} checks, {}ms{}\n", status, name, pillar.checks.len(), pillar.duration_ms, skip));
            for (check_name, check) in &pillar.checks {
                let check_status = if check.passed { "  ✓" } else if check.skipped.unwrap_or(false) { "  ⊘" } else { "  ✗" };
                out.push_str(&format!("     {} {} ({}ms)\n", check_status, check_name, check.duration_ms));
            }
        }

        out.push_str(&format!("\n   Signature: {}...", &self.signature[..16]));
        out
    }

    /// Validate manifest structure
    pub fn validate(&self) -> anyhow::Result<()> {
        if self.schema_version != MANIFEST_SCHEMA_VERSION {
            anyhow::bail!("Unsupported schema version: {}", self.schema_version);
        }

        if self.health_score < 0.0 || self.health_score > 1.0 {
            anyhow::bail!("Invalid health score: {}", self.health_score);
        }

        if Utc::now() > self.expires_at {
            anyhow::bail!("Manifest expired at {}", self.expires_at);
        }

        // Validate each pillar
        self.pillars.quality.validate("quality")?;
        self.pillars.security.validate("security")?;
        self.pillars.perf.validate("perf")?;
        self.pillars.compliance.validate("compliance")?;
        self.pillars.docs.validate("docs")?;

        Ok(())
    }
}

impl PillarResult {
    fn validate(&self, name: &str) -> anyhow::Result<()> {
        if self.checks.is_empty() && self.skip_reason.is_none() {
            anyhow::bail!("Pillar '{}' has no checks and no skip reason", name);
        }
        for (check_name, check) in &self.checks {
            if check.name != *check_name {
                anyhow::bail!("Check name mismatch in pillar '{}': key='{}' vs name='{}'", name, check_name, check.name);
            }
        }
        Ok(())
    }
}

/// Manifest verification result
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResult {
    pub valid: bool,
    pub manifest: Option<Manifest>,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
    pub health_score: Option<f64>,
    pub pillars_passed: usize,
    pub pillars_total: usize,
    pub checks_passed: usize,
    pub checks_total: usize,
}

impl VerificationResult {
    pub fn success(manifest: Manifest) -> Self {
        let pillars_passed = [
            manifest.pillars.quality.passed,
            manifest.pillars.security.passed,
            manifest.pillars.perf.passed,
            manifest.pillars.compliance.passed,
            manifest.pillars.docs.passed,
        ].iter().filter(|&&p| p).count();

        let checks_total: usize = [
            &manifest.pillars.quality.checks,
            &manifest.pillars.security.checks,
            &manifest.pillars.perf.checks,
            &manifest.pillars.compliance.checks,
            &manifest.pillars.docs.checks,
        ].iter().map(|c| c.len()).sum();

        let checks_passed: usize = [
            &manifest.pillars.quality.checks,
            &manifest.pillars.security.checks,
            &manifest.pillars.perf.checks,
            &manifest.pillars.compliance.checks,
            &manifest.pillars.docs.checks,
        ].iter().flat_map(|c| c.values()).filter(|c| c.passed).count();

        Self {
            valid: true,
            manifest: Some(manifest.clone()),
            errors: vec![],
            warnings: vec![],
            health_score: Some(manifest.health_score),
            pillars_passed,
            pillars_total: 5,
            checks_passed,
            checks_total,
        }
    }

    pub fn failure(errors: Vec<String>) -> Self {
        Self {
            valid: false,
            manifest: None,
            errors,
            warnings: vec![],
            health_score: None,
            pillars_passed: 0,
            pillars_total: 5,
            checks_passed: 0,
            checks_total: 0,
        }
    }
}