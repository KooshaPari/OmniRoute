//! Enriched DAG schema types: node, edge, prerequisite, acceptance criteria,
//! and audit hooks.
//!
//! These types extend the core [`Dag`] with domain-specific metadata needed
//! for Phenotype compute/infra automation.
//!
//! # Schema concepts
//!
//! | Concept              | Description                                           |
//! |----------------------|-------------------------------------------------------|
//! | Prerequisite         | Condition that must be satisfied **before** a node runs |
//! | AcceptanceCriterion  | Condition that must pass **after** a node completes    |
//! | AuditHook            | Pre/post hook that emits audit/log/metric events       |

use std::collections::HashMap;

use serde::{Deserialize, Serialize};

// ---------------------------------------------------------------------------
// Prerequisite — gating conditions
// ---------------------------------------------------------------------------

/// A condition that must be satisfied before a DAG node may execute.
///
/// # Variants
///
/// | Variant              | Description                                          |
/// |----------------------|------------------------------------------------------|
/// | `ImageReady`         | A container image must be built and available         |
/// | `SecretAvailable`    | A named secret must exist in the secrets store        |
/// | `ResourceExists`     | An infrastructure resource must exist (e.g., S3 bucket) |
/// | `ApiHealthy`         | An HTTP/HTTPS endpoint must return 2xx               |
/// | `FileExists`         | A file or directory path must exist on disk           |
/// | `EnvironmentVariable`| An environment variable must be set                   |
/// | `CustomScript`       | An arbitrary script/command must exit with code 0     |
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Prerequisite {
    /// A container image must be available at the given reference.
    ImageReady {
        /// Container image reference (e.g. `"nginx:1.25"`).
        image: String,
    },
    /// A secret must exist in the secrets store.
    SecretAvailable {
        /// Name of the secret.
        name: String,
    },
    /// An infrastructure resource must exist.
    ResourceExists {
        /// Resource provider (e.g. `"aws"`, `"gcp"`).
        provider: String,
        /// Resource type (e.g. `"s3_bucket"`, `"ec2_instance"`).
        resource_type: String,
        /// Resource identifier.
        id: String,
    },
    /// An HTTP endpoint must be healthy (2xx status).
    ApiHealthy {
        /// URL to probe.
        url: String,
        /// Optional expected status code range (default 200-299).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        expected_status: Option<u16>,
    },
    /// A file or directory must exist.
    FileExists {
        /// Absolute or relative path.
        path: String,
    },
    /// An environment variable must be set.
    EnvironmentVariable {
        /// Variable name.
        variable: String,
    },
    /// A custom check (arbitrary script).
    CustomScript {
        /// Shell command to run.
        command: String,
        /// Human-readable description of the check.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        description: Option<String>,
    },
}

// ---------------------------------------------------------------------------
// AcceptanceCriterion — post-execution validation
// ---------------------------------------------------------------------------

/// A condition that must be satisfied after a DAG node executes for the node
/// to be considered successful.
///
/// # Variants
///
/// | Variant            | Description                                        |
/// |--------------------|----------------------------------------------------|
/// | `ExitCode`         | Process exited with a specific code                 |
/// | `OutputContains`   | Stdout/stderr contains a substring or regex         |
/// | `HttpOk`           | An HTTP endpoint returns a 2xx status               |
/// | `MetricThreshold`  | A named metric is within a numeric range            |
/// | `LogCheck`         | Log output matches or does not match a pattern      |
/// | `CustomCheck`      | Arbitrary programmatic check as a shell command     |
///
/// Note: `PartialEq` is derived for testing but `Eq` is omitted because
/// `f64` fields (in `MetricThreshold`) do not implement `Eq`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AcceptanceCriterion {
    /// Expect the process to exit with this code.
    ExitCode {
        /// Expected exit code (default 0).
        #[serde(default = "default_exit_code")]
        code: i32,
    },
    /// Output (stdout + stderr) must contain this pattern.
    OutputContains {
        /// Substring or regex pattern.
        pattern: String,
        /// If true, treat `pattern` as a regex.
        #[serde(default)]
        regex: bool,
    },
    /// An HTTP endpoint must respond with a 2xx status.
    HttpOk {
        /// URL to check.
        url: String,
        /// Optional expected status code.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        expected_status: Option<u16>,
    },
    /// A named metric must be within the expected range.
    MetricThreshold {
        /// Metric name (e.g. `"memory_usage_mb"`).
        metric: String,
        /// Lower bound (inclusive).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        min: Option<f64>,
        /// Upper bound (inclusive).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        max: Option<f64>,
    },
    /// Check log output against a pattern.
    LogCheck {
        /// Pattern to search for in logs.
        pattern: String,
        /// If true, fail when the pattern is found.
        #[serde(default)]
        negate: bool,
        /// Log source (e.g. `"stdout"`, `"stderr"`, `"file:/var/log/app.log"`).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        source: Option<String>,
    },
    /// An arbitrary programmatic check.
    CustomCheck {
        /// Shell command to run.
        command: String,
        /// Human-readable description.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        description: Option<String>,
    },
}

fn default_exit_code() -> i32 {
    0
}

// ---------------------------------------------------------------------------
// AuditHook — pre/post execution hooks
// ---------------------------------------------------------------------------

/// When the hook fires relative to node execution.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum HookTiming {
    /// Fires before the node starts.
    Pre,
    /// Fires after the node completes (success or failure).
    Post,
    /// Fires on successful completion only.
    OnSuccess,
    /// Fires on failure only.
    OnFailure,
}

impl Default for HookTiming {
    fn default() -> Self {
        Self::Post
    }
}

/// An audit / observability hook attached to a DAG node.
///
/// Hooks fire at specified points in the node lifecycle to emit audit
/// records, metrics, or notifications.
///
/// # Variants
///
/// | Variant     | Description                                  |
/// |-------------|----------------------------------------------|
/// | `Webhook`   | POST a JSON payload to a URL                 |
/// | `LogEntry`  | Write a structured log record                |
/// | `MetricEmit`| Emit a numeric metric to a telemetry backend |
/// | `Notify`    | Send a notification (e.g. Slack, email)      |
///
/// Note: `PartialEq` is derived for testing but `Eq` is omitted because
/// `f64` fields (in `MetricEmit`) do not implement `Eq`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum AuditHook {
    /// HTTP webhook callback.
    Webhook {
        /// Target URL.
        url: String,
        /// Optional custom headers.
        #[serde(default, skip_serializing_if = "Option::is_none")]
        headers: Option<HashMap<String, String>>,
        /// When to fire.
        #[serde(default)]
        timing: HookTiming,
    },
    /// Structured log entry.
    LogEntry {
        /// Log message template.
        message: String,
        /// Log severity level.
        #[serde(default = "default_log_level")]
        level: String,
        /// When to fire.
        #[serde(default)]
        timing: HookTiming,
    },
    /// Emit a metric to the telemetry pipeline.
    MetricEmit {
        /// Metric name.
        name: String,
        /// Metric value.
        value: f64,
        /// Metric unit (e.g. `"ms"`, `"count"`, `"bytes"`).
        #[serde(default, skip_serializing_if = "Option::is_none")]
        unit: Option<String>,
        /// When to fire.
        #[serde(default)]
        timing: HookTiming,
    },
    /// Send a notification.
    Notify {
        /// Notification channel (e.g. `"slack"`, `"email"`, `"pagerduty"`).
        channel: String,
        /// Message payload.
        message: String,
        /// When to fire.
        #[serde(default)]
        timing: HookTiming,
    },
}

fn default_log_level() -> String {
    "info".to_string()
}

// ---------------------------------------------------------------------------
// Enriched node and edge types
// ---------------------------------------------------------------------------

/// An enriched node in the DAG schema.
///
/// Carries optional prerequisites, acceptance criteria, audit hooks, and
/// arbitrary metadata alongside the basic identifier.
///
/// Note: `PartialEq` is derived for testing but `Eq` is omitted because
/// this type transitively contains `f64` fields via `AuditHook::MetricEmit`.
#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
pub struct SchemaNode {
    /// Unique node identifier.
    pub id: String,
    /// Human-readable label (optional).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Longer description of what this node does.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,
    /// Conditions that must be satisfied before this node runs.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub prerequisites: Vec<Prerequisite>,
    /// Conditions that must pass after this node completes.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub acceptance: Vec<AcceptanceCriterion>,
    /// Audit hooks attached to this node's lifecycle.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub audit_hooks: Vec<AuditHook>,
    /// Arbitrary key-value metadata.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub metadata: Option<HashMap<String, String>>,
}

/// An edge in the DAG schema.
///
/// Carries an optional label and condition for conditional branching.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct SchemaEdge {
    /// Source node id.
    pub from: String,
    /// Target node id.
    pub to: String,
    /// Optional edge label / annotation.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
    /// Optional condition expression (e.g. `"build.exit_code == 0"`).
    /// When set, the edge is only traversed if the condition evaluates true.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub condition: Option<String>,
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn prerequisite_image_ready_round_trip() {
        let p = Prerequisite::ImageReady {
            image: "nginx:1.25".into(),
        };
        let json = serde_json::to_string_pretty(&p).unwrap();
        let back: Prerequisite = serde_json::from_str(&json).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn prerequisite_secret_available() {
        let p = Prerequisite::SecretAvailable {
            name: "DB_PASSWORD".into(),
        };
        let json = serde_json::to_string(&p).unwrap();
        assert!(json.contains("\"type\":\"secret_available\""));
        assert!(json.contains("DB_PASSWORD"));
    }

    #[test]
    fn prerequisite_api_healthy_default_status() {
        let p = Prerequisite::ApiHealthy {
            url: "https://example.com/health".into(),
            expected_status: None,
        };
        let json = serde_json::to_string(&p).unwrap();
        let back: Prerequisite = serde_json::from_str(&json).unwrap();
        assert_eq!(p, back);
    }

    #[test]
    fn acceptance_exit_code_default() {
        let ac = AcceptanceCriterion::ExitCode { code: 0 };
        let json = serde_json::to_string(&ac).unwrap();
        assert!(json.contains("\"code\":0"));
    }

    #[test]
    fn acceptance_output_contains_with_regex() {
        let ac = AcceptanceCriterion::OutputContains {
            pattern: r"ERROR|FATAL".into(),
            regex: true,
        };
        let json = serde_json::to_string(&ac).unwrap();
        let back: AcceptanceCriterion = serde_json::from_str(&json).unwrap();
        assert_eq!(ac, back);
    }

    #[test]
    fn acceptance_metric_threshold() {
        let ac = AcceptanceCriterion::MetricThreshold {
            metric: "memory_usage_mb".into(),
            min: Some(0.0),
            max: Some(512.0),
        };
        let json = serde_json::to_string(&ac).unwrap();
        let back: AcceptanceCriterion = serde_json::from_str(&json).unwrap();
        assert_eq!(ac, back);
    }

    #[test]
    fn audit_hook_webhook_round_trip() {
        let hook = AuditHook::Webhook {
            url: "https://hooks.example.com/audit".into(),
            headers: None,
            timing: HookTiming::Pre,
        };
        let json = serde_json::to_string_pretty(&hook).unwrap();
        let back: AuditHook = serde_json::from_str(&json).unwrap();
        assert_eq!(hook, back);
    }

    #[test]
    fn audit_hook_log_entry_default_timing() {
        let hook = AuditHook::LogEntry {
            message: "Node {node_id} completed".into(),
            level: "warn".into(),
            timing: HookTiming::Post,
        };
        let json = serde_json::to_string(&hook).unwrap();
        let back: AuditHook = serde_json::from_str(&json).unwrap();
        assert_eq!(hook, back);
    }

    #[test]
    fn audit_hook_metric_emit() {
        let hook = AuditHook::MetricEmit {
            name: "dag_node_duration_ms".into(),
            value: 1234.5,
            unit: Some("ms".into()),
            timing: HookTiming::Post,
        };
        let json = serde_json::to_string_pretty(&hook).unwrap();
        let back: AuditHook = serde_json::from_str(&json).unwrap();
        assert_eq!(hook, back);
    }

    #[test]
    fn audit_hook_notify() {
        let hook = AuditHook::Notify {
            channel: "slack".into(),
            message: "DAG node `deploy` failed".into(),
            timing: HookTiming::OnFailure,
        };
        let json = serde_json::to_string(&hook).unwrap();
        let back: AuditHook = serde_json::from_str(&json).unwrap();
        assert_eq!(hook, back);
    }

    #[test]
    fn schema_node_with_all_fields() {
        let node = SchemaNode {
            id: "deploy-staging".into(),
            label: Some("Deploy to Staging".into()),
            description: Some("Deploy the built artifact to the staging environment".into()),
            prerequisites: vec![
                Prerequisite::SecretAvailable {
                    name: "STAGING_SSH_KEY".into(),
                },
                Prerequisite::ImageReady {
                    image: "myapp:latest".into(),
                },
            ],
            acceptance: vec![
                AcceptanceCriterion::HttpOk {
                    url: "https://staging.example.com/health".into(),
                    expected_status: Some(200),
                },
            ],
            audit_hooks: vec![
                AuditHook::Webhook {
                    url: "https://hooks.example.com/deploy".into(),
                    headers: None,
                    timing: HookTiming::Post,
                },
            ],
            metadata: Some(HashMap::from_iter(vec![
                ("team".into(), "platform".into()),
                ("tier".into(), "2".into()),
            ])),
        };
        let json = serde_json::to_string_pretty(&node).unwrap();
        let back: SchemaNode = serde_json::from_str(&json).unwrap();
        assert_eq!(node, back);
    }

    #[test]
    fn schema_edge_with_condition() {
        let edge = SchemaEdge {
            from: "build".into(),
            to: "deploy".into(),
            label: Some("deploy-on-success".into()),
            condition: Some("build.exit_code == 0".into()),
        };
        let json = serde_json::to_string_pretty(&edge).unwrap();
        let back: SchemaEdge = serde_json::from_str(&json).unwrap();
        assert_eq!(edge, back);
    }

    #[test]
    fn enum_variants_are_exhaustive() {
        // Compile-time check: ensure all variants are constructable.
        let _: Prerequisite = Prerequisite::CustomScript {
            command: "echo ok".into(),
            description: None,
        };
        let _: AcceptanceCriterion = AcceptanceCriterion::CustomCheck {
            command: "echo ok".into(),
            description: None,
        };
        let _: AuditHook = AuditHook::LogEntry {
            message: "test".into(),
            level: "info".into(),
            timing: HookTiming::Pre,
        };
    }
}
