// SPDX-License-Identifier: MIT OR Apache-2.0

//! Bulk import/export for rules and tasks via CSV and YAML formats.
//!

use csv::Reader;
use serde::{Deserialize, Serialize};
use serde_yaml;
use std::path::Path;
use thiserror::Error;

/// Result type for bulk operations.
pub type BulkResult<T> = Result<T, BulkError>;

/// Errors that can occur during bulk operations.
#[derive(Debug, Error)]
pub enum BulkError {
    #[error("CSV error: {0}")]
    CsvError(String),
    #[error("YAML error: {0}")]
    YamlError(String),
    #[error("IO error: {0}")]
    IoError(#[from] std::io::Error),
    #[error("Validation error: {0}")]
    ValidationError(String),
    #[error("Schema drift: {0}")]
    SchemaDrift(String),
}

/// Rule tuple for CSV export: (name, trigger_kind, event_type, action_kind, amount, cooldown, priority, enabled)
type RuleCsvRow<T> = (T, T, T, T, Option<i32>, Option<String>, i32, bool);

/// Raw CSV record for a rule.
#[derive(Debug, Clone, Deserialize)]
pub struct RuleCsvRecord {
    pub name: String,
    pub trigger_kind: String,
    pub event_type: Option<String>,
    pub action_kind: String,
    pub amount: Option<i32>,
    pub cooldown: Option<String>,
    #[serde(default)]
    pub priority: i32,
    #[serde(default = "default_true")]
    pub enabled: bool,
}

fn default_true() -> bool {
    true
}

/// Raw CSV record for a task.
#[derive(Debug, Clone, Deserialize)]
pub struct TaskCsvRecord {
    pub title: String,
    pub priority: Option<f32>,
    pub deadline: Option<String>,
    pub duration_min: Option<i32>,
    pub tags: Option<String>,
}

/// YAML-structured rule for richer nesting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuleYamlRecord {
    pub name: String,
    pub trigger_kind: String,
    pub event_type: Option<String>,
    pub action_kind: String,
    pub amount: Option<i32>,
    pub cooldown: Option<String>,
    #[serde(default)]
    pub priority: i32,
    #[serde(default = "default_true")]
    pub enabled: bool,
    #[serde(default)]
    pub version: Option<String>,
}

/// YAML-structured task for richer nesting.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TaskYamlRecord {
    pub title: String,
    pub priority: Option<f32>,
    pub deadline: Option<String>,
    pub duration_min: Option<i32>,
    pub tags: Option<Vec<String>>,
    #[serde(default)]
    pub version: Option<String>,
}

/// Parsed rules with validation reports.
#[derive(Debug, Clone, Serialize)]
pub struct BulkRuleImport {
    pub rules: Vec<RuleYamlRecord>,
    pub validation_report: ValidationReport,
}

/// Parsed tasks with validation reports.
#[derive(Debug, Clone, Serialize)]
pub struct BulkTaskImport {
    pub tasks: Vec<TaskYamlRecord>,
    pub validation_report: ValidationReport,
}

/// Validation report for bulk imports.
#[derive(Debug, Clone, Default, Serialize)]
pub struct ValidationReport {
    pub valid_count: usize,
    pub skipped_count: usize,
    pub errors: Vec<ValidationError>,
}

/// Individual validation error.
#[derive(Debug, Clone, Serialize)]
pub struct ValidationError {
    pub row_index: usize,
    pub field: String,
    pub reason: String,
}

/// Known trigger kinds for rules.
const VALID_TRIGGERS: &[&str] = &["Event", "Schedule", "StateChange"];

/// Known action kinds for rules.
const VALID_ACTIONS: &[&str] = &[
    "GrantCredit",
    "DeductCredit",
    "Block",
    "Unblock",
    "StreakIncrement",
    "StreakReset",
    "Notify",
    "EmergencyExit",
    "Intervention",
    "ScheduledUnlockWindow",
];

/// Parse CSV file of rules.
pub fn parse_rules_csv(path: &Path) -> BulkResult<BulkRuleImport> {
    let mut reader = Reader::from_path(path).map_err(|e| BulkError::CsvError(e.to_string()))?;
    let mut rules = Vec::new();
    let mut validation_report = ValidationReport::default();

    for (row_idx, result) in reader.deserialize().enumerate() {
        match result {
            Ok(record) => {
                let csv_rec: RuleCsvRecord = record;
                match validate_rule_record(&csv_rec, row_idx) {
                    Ok(yaml_rec) => {
                        rules.push(yaml_rec);
                        validation_report.valid_count += 1;
                    }
                    Err(err) => {
                        validation_report.errors.push(err);
                        validation_report.skipped_count += 1;
                    }
                }
            }
            Err(e) => {
                validation_report.errors.push(ValidationError {
                    row_index: row_idx,
                    field: "record".to_string(),
                    reason: format!("Malformed CSV row: {}", e),
                });
                validation_report.skipped_count += 1;
            }
        }
    }

    Ok(BulkRuleImport { rules, validation_report })
}

/// Parse YAML file of rules.
pub fn parse_rules_yaml(path: &Path) -> BulkResult<BulkRuleImport> {
    let content = std::fs::read_to_string(path)?;
    let records: Vec<RuleYamlRecord> = serde_yaml::from_str(&content)
        .map_err(|e| BulkError::YamlError(format!("YAML parse error: {}", e)))?;

    let mut validation_report = ValidationReport::default();
    let mut validated_rules = Vec::new();

    for (idx, record) in records.into_iter().enumerate() {
        match validate_rule_yaml(&record, idx) {
            Ok(rec) => {
                validated_rules.push(rec);
                validation_report.valid_count += 1;
            }
            Err(err) => {
                validation_report.errors.push(err);
                validation_report.skipped_count += 1;
            }
        }
    }

    Ok(BulkRuleImport {
        rules: validated_rules,
        validation_report,
    })
}

/// Parse CSV file of tasks.
pub fn parse_tasks_csv(path: &Path) -> BulkResult<BulkTaskImport> {
    let mut reader = Reader::from_path(path).map_err(|e| BulkError::CsvError(e.to_string()))?;
    let mut tasks = Vec::new();
    let mut validation_report = ValidationReport::default();

    for (row_idx, result) in reader.deserialize().enumerate() {
        match result {
            Ok(record) => {
                let csv_rec: TaskCsvRecord = record;
                match validate_task_record(&csv_rec, row_idx) {
                    Ok(yaml_rec) => {
                        tasks.push(yaml_rec);
                        validation_report.valid_count += 1;
                    }
                    Err(err) => {
                        validation_report.errors.push(err);
                        validation_report.skipped_count += 1;
                    }
                }
            }
            Err(e) => {
                validation_report.errors.push(ValidationError {
                    row_index: row_idx,
                    field: "record".to_string(),
                    reason: format!("Malformed CSV row: {}", e),
                });
                validation_report.skipped_count += 1;
            }
        }
    }

    Ok(BulkTaskImport { tasks, validation_report })
}

/// Parse YAML file of tasks.
pub fn parse_tasks_yaml(path: &Path) -> BulkResult<BulkTaskImport> {
    let content = std::fs::read_to_string(path)?;
    let records: Vec<TaskYamlRecord> = serde_yaml::from_str(&content)
        .map_err(|e| BulkError::YamlError(format!("YAML parse error: {}", e)))?;

    let mut validation_report = ValidationReport::default();
    let mut validated_tasks = Vec::new();

    for (idx, record) in records.into_iter().enumerate() {
        match validate_task_yaml(&record, idx) {
            Ok(rec) => {
                validated_tasks.push(rec);
                validation_report.valid_count += 1;
            }
            Err(err) => {
                validation_report.errors.push(err);
                validation_report.skipped_count += 1;
            }
        }
    }

    Ok(BulkTaskImport {
        tasks: validated_tasks,
        validation_report,
    })
}

/// Validate a CSV rule record and convert to YAML format.
fn validate_rule_record(rec: &RuleCsvRecord, row_idx: usize) -> Result<RuleYamlRecord, ValidationError> {
    if rec.name.is_empty() {
        return Err(ValidationError {
            row_index: row_idx,
            field: "name".to_string(),
            reason: "name cannot be empty".to_string(),
        });
    }

    if !VALID_TRIGGERS.contains(&rec.trigger_kind.as_str()) {
        return Err(ValidationError {
            row_index: row_idx,
            field: "trigger_kind".to_string(),
            reason: format!("unknown trigger: {} (valid: {:?})", rec.trigger_kind, VALID_TRIGGERS),
        });
    }

    if !VALID_ACTIONS.contains(&rec.action_kind.as_str()) {
        return Err(ValidationError {
            row_index: row_idx,
            field: "action_kind".to_string(),
            reason: format!("unknown action: {} (valid: {:?})", rec.action_kind, VALID_ACTIONS),
        });
    }

    Ok(RuleYamlRecord {
        name: rec.name.clone(),
        trigger_kind: rec.trigger_kind.clone(),
        event_type: rec.event_type.clone(),
        action_kind: rec.action_kind.clone(),
        amount: rec.amount,
        cooldown: rec.cooldown.clone(),
        priority: rec.priority,
        enabled: rec.enabled,
        version: None,
    })
}

/// Validate a YAML rule record.
fn validate_rule_yaml(rec: &RuleYamlRecord, row_idx: usize) -> Result<RuleYamlRecord, ValidationError> {
    if rec.name.is_empty() {
        return Err(ValidationError {
            row_index: row_idx,
            field: "name".to_string(),
            reason: "name cannot be empty".to_string(),
        });
    }

    if !VALID_TRIGGERS.contains(&rec.trigger_kind.as_str()) {
        return Err(ValidationError {
            row_index: row_idx,
            field: "trigger_kind".to_string(),
            reason: format!("unknown trigger: {} (valid: {:?})", rec.trigger_kind, VALID_TRIGGERS),
        });
    }

    if !VALID_ACTIONS.contains(&rec.action_kind.as_str()) {
        return Err(ValidationError {
            row_index: row_idx,
            field: "action_kind".to_string(),
            reason: format!("unknown action: {} (valid: {:?})", rec.action_kind, VALID_ACTIONS),
        });
    }

    Ok(rec.clone())
}

/// Validate a CSV task record and convert to YAML format.
fn validate_task_record(rec: &TaskCsvRecord, row_idx: usize) -> Result<TaskYamlRecord, ValidationError> {
    if rec.title.is_empty() {
        return Err(ValidationError {
            row_index: row_idx,
            field: "title".to_string(),
            reason: "title cannot be empty".to_string(),
        });
    }

    if let Some(p) = rec.priority {
        if !(0.0..=1.0).contains(&p) {
            return Err(ValidationError {
                row_index: row_idx,
                field: "priority".to_string(),
                reason: "priority must be in range [0.0, 1.0]".to_string(),
            });
        }
    }

    let tags = rec.tags.as_ref().map(|t| {
        t.split(',')
            .map(|s| s.trim().to_string())
            .filter(|s| !s.is_empty())
            .collect()
    });

    Ok(TaskYamlRecord {
        title: rec.title.clone(),
        priority: rec.priority,
        deadline: rec.deadline.clone(),
        duration_min: rec.duration_min,
        tags,
        version: None,
    })
}

/// Validate a YAML task record.
fn validate_task_yaml(rec: &TaskYamlRecord, row_idx: usize) -> Result<TaskYamlRecord, ValidationError> {
    if rec.title.is_empty() {
        return Err(ValidationError {
            row_index: row_idx,
            field: "title".to_string(),
            reason: "title cannot be empty".to_string(),
        });
    }

    if let Some(p) = rec.priority {
        if !(0.0..=1.0).contains(&p) {
            return Err(ValidationError {
                row_index: row_idx,
                field: "priority".to_string(),
                reason: "priority must be in range [0.0, 1.0]".to_string(),
            });
        }
    }

    Ok(rec.clone())
}

/// Export rules to CSV format.
pub fn export_rules_csv<T: Into<String> + Clone>(
    rules: Vec<RuleCsvRow<T>>,
) -> BulkResult<String> {
    let mut wtr = csv::Writer::from_writer(vec![]);

    wtr.write_record([
        "name",
        "trigger_kind",
        "event_type",
        "action_kind",
        "amount",
        "cooldown",
        "priority",
        "enabled",
    ])
    .map_err(|e| BulkError::CsvError(e.to_string()))?;

    for (name, trigger, event_type, action, amount, cooldown, priority, enabled) in rules {
        wtr.write_record(&[
            name.into(),
            trigger.into(),
            event_type.into(),
            action.into(),
            amount.map(|a| a.to_string()).unwrap_or_default(),
            cooldown.unwrap_or_default(),
            priority.to_string(),
            enabled.to_string(),
        ])
        .map_err(|e| BulkError::CsvError(e.to_string()))?;
    }

    let data = wtr.into_inner().map_err(|e| BulkError::CsvError(e.to_string()))?;
    String::from_utf8(data).map_err(|e| BulkError::CsvError(e.to_string()))
}

/// Task export tuple: (title, priority, deadline_str, duration_min, tags)
type TaskTuple<T> = (T, Option<f32>, Option<String>, Option<i32>, Option<Vec<String>>);

/// Export tasks to CSV format.
pub fn export_tasks_csv<T: Into<String> + Clone>(
    tasks: Vec<TaskTuple<T>>,
) -> BulkResult<String> {
    let mut wtr = csv::Writer::from_writer(vec![]);

    wtr.write_record(["title", "priority", "deadline", "duration_min", "tags"])
        .map_err(|e| BulkError::CsvError(e.to_string()))?;

    for (title, priority, deadline, duration, tags) in tasks {
        wtr.write_record(&[
            title.into(),
            priority.map(|p| p.to_string()).unwrap_or_default(),
            deadline.unwrap_or_default(),
            duration.map(|d| d.to_string()).unwrap_or_default(),
            tags.map(|t| t.join(",")).unwrap_or_default(),
        ])
        .map_err(|e| BulkError::CsvError(e.to_string()))?;
    }

    let data = wtr.into_inner().map_err(|e| BulkError::CsvError(e.to_string()))?;
    String::from_utf8(data).map_err(|e| BulkError::CsvError(e.to_string()))
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use tempfile::tempdir;

    #[test]
    fn test_validate_rule_csv_record() {
        let rec = RuleCsvRecord {
            name: "test-rule".to_string(),
            trigger_kind: "Event".to_string(),
            event_type: Some("app_launch".to_string()),
            action_kind: "GrantCredit".to_string(),
            amount: Some(100),
            cooldown: Some("5m".to_string()),
            priority: 1,
            enabled: true,
        };

        let result = validate_rule_record(&rec, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_rule_unknown_trigger() {
        let rec = RuleCsvRecord {
            name: "test-rule".to_string(),
            trigger_kind: "InvalidTrigger".to_string(),
            event_type: Some("app_launch".to_string()),
            action_kind: "GrantCredit".to_string(),
            amount: Some(100),
            cooldown: None,
            priority: 1,
            enabled: true,
        };

        let result = validate_rule_record(&rec, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_validate_task_csv_record() {
        let rec = TaskCsvRecord {
            title: "Complete report".to_string(),
            priority: Some(0.8),
            deadline: Some("2026-04-30T15:00:00Z".to_string()),
            duration_min: Some(60),
            tags: Some("work,urgent".to_string()),
        };

        let result = validate_task_record(&rec, 0);
        assert!(result.is_ok());
    }

    #[test]
    fn test_validate_task_priority_bounds() {
        let rec = TaskCsvRecord {
            title: "Task".to_string(),
            priority: Some(1.5),
            deadline: None,
            duration_min: None,
            tags: None,
        };

        let result = validate_task_record(&rec, 0);
        assert!(result.is_err());
    }

    #[test]
    fn test_parse_rules_csv_with_malformed_rows() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("rules.csv");
        let csv_content = "name,trigger_kind,event_type,action_kind,amount,cooldown,priority,enabled\n\
                           rule1,Event,app_launch,GrantCredit,100,5m,1,true\n\
                           rule2,InvalidTrigger,event,Block,50,,1,false\n\
                           rule3,Schedule,,Notify,,,0,true";
        fs::write(&file_path, csv_content).unwrap();

        let result = parse_rules_csv(&file_path).unwrap();
        assert_eq!(result.validation_report.valid_count, 2); // rule1, rule3
        assert_eq!(result.validation_report.skipped_count, 1); // rule2
        assert!(!result.validation_report.errors.is_empty());
    }

    #[test]
    fn test_parse_tasks_csv_with_validation() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("tasks.csv");
        let csv_content = "title,priority,deadline,duration_min,tags\n\
                           Task 1,0.8,2026-04-30,60,work\n\
                           Task 2,0.5,,45,personal\n\
                           Task 3,1.5,,30,invalid";
        fs::write(&file_path, csv_content).unwrap();

        let result = parse_tasks_csv(&file_path).unwrap();
        assert_eq!(result.validation_report.valid_count, 2); // Task 1, Task 2
        assert_eq!(result.validation_report.skipped_count, 1); // Task 3
    }

    #[test]
    fn test_parse_rules_yaml() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("rules.yaml");
        let yaml_content = r#"
- name: "Enable focus"
  trigger_kind: "Event"
  event_type: "app_launch"
  action_kind: "GrantCredit"
  amount: 100
  cooldown: "5m"
  priority: 1
  enabled: true
  version: "1.0"
- name: "Block distraction"
  trigger_kind: "Schedule"
  event_type: null
  action_kind: "Block"
  amount: null
  cooldown: null
  priority: 0
  enabled: true
"#;
        fs::write(&file_path, yaml_content).unwrap();

        let result = parse_rules_yaml(&file_path).unwrap();
        assert_eq!(result.validation_report.valid_count, 2);
        assert_eq!(result.rules.len(), 2);
    }

    #[test]
    fn test_parse_tasks_yaml() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("tasks.yaml");
        let yaml_content = r#"
- title: "Write proposal"
  priority: 0.9
  deadline: "2026-04-30T15:00:00Z"
  duration_min: 120
  tags: ["work", "proposal"]
  version: "1.0"
- title: "Review feedback"
  priority: 0.7
  deadline: null
  duration_min: 45
  tags: ["review"]
"#;
        fs::write(&file_path, yaml_content).unwrap();

        let result = parse_tasks_yaml(&file_path).unwrap();
        assert_eq!(result.validation_report.valid_count, 2);
        assert_eq!(result.tasks.len(), 2);
    }

    #[test]
    fn test_schema_drift_tolerance() {
        let dir = tempdir().unwrap();
        let file_path = dir.path().join("rules.yaml");
        // Extra field "description" should be ignored
        let yaml_content = r#"
- name: "rule1"
  trigger_kind: "Event"
  event_type: "app_launch"
  action_kind: "GrantCredit"
  amount: 100
  cooldown: "5m"
  priority: 1
  enabled: true
  description: "This field is extra"
  version: "1.0"
"#;
        fs::write(&file_path, yaml_content).unwrap();

        let result = parse_rules_yaml(&file_path);
        // serde_yaml is tolerant of extra fields with default struct
        assert!(result.is_ok());
    }
}
