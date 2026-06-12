//! JSON output tests for `focus` CLI
//! Tests verify that --json flag produces valid JSON with expected schema for all subcommands.

use assert_cmd::Command;
use serde_json::{json, Value};
use std::fs;
use std::path::PathBuf;

fn test_db_path() -> PathBuf {
    // Use a test database; in real tests, create temporary DB with fixtures.
    std::env::var("FOCALPOINT_DB").map(PathBuf::from).unwrap_or_else(|_| {
        PathBuf::from(std::env::home_dir().unwrap_or_default())
            .join("Library/Application Support/focalpoint/core.db")
    })
}

fn setup_test_db() -> PathBuf {
    // For testing, we'll use the default DB if it exists, or skip if not.
    test_db_path()
}

#[test]
fn test_audit_verify_json() {
    let db = setup_test_db();
    if !db.exists() {
        eprintln!("Skipping test: DB not found at {:?}", db);
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("audit").arg("verify");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["verified"].is_boolean());
    assert!(result["chain_length"].is_number());
}

#[test]
fn test_audit_tail_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("audit").arg("tail").arg("--limit").arg("5");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_array());
    // Each array element should have ts, kind, payload
    if let Some(records) = result.as_array() {
        for record in records {
            assert!(record["ts"].is_string());
            assert!(record["kind"].is_string());
        }
    }
}

#[test]
fn test_audit_head_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("audit").arg("head");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    // hash can be string or null
    assert!(result["hash"].is_string() || result["hash"].is_null());
}

#[test]
fn test_tasks_list_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("tasks").arg("list");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_array());

    // Check schema of each task
    if let Some(tasks) = result.as_array() {
        for task in tasks {
            assert!(task["id"].is_string());
            assert!(task["title"].is_string());
            assert!(task["priority"].is_number());
            assert!(task["status"].is_string());
            assert!(task["created_at"].is_string());
            assert!(task["updated_at"].is_string());
        }
    }
}

#[test]
fn test_tasks_add_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db")
        .arg(&db)
        .arg("--json")
        .arg("tasks")
        .arg("add")
        .arg("--title")
        .arg("Test Task")
        .arg("--minutes")
        .arg("30")
        .arg("--priority")
        .arg("h");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["id"].is_string());
    assert_eq!(result["title"].as_str(), Some("Test Task"));
    assert!(result["priority"].as_f64().unwrap() > 0.5); // h priority should be >= 0.8
    assert_eq!(result["status"].as_str(), Some("Active"));
}

#[test]
fn test_rules_list_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("rules").arg("list");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_array());

    // Check schema of each rule
    if let Some(rules) = result.as_array() {
        for rule in rules {
            assert!(rule["id"].is_string());
            assert!(rule["name"].is_string());
            assert!(rule["priority"].is_number());
            assert!(rule["enabled"].is_boolean());
            assert!(rule["trigger"].is_string());
        }
    }
}

#[test]
fn test_wallet_balance_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("wallet").arg("balance");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["user_id"].is_string());
    assert!(result["earned_credits"].is_number());
    assert!(result["spent_credits"].is_number());
    assert!(result["balance"].is_number());
    assert!(result["multiplier"].is_number());
}

#[test]
fn test_wallet_grant_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db")
        .arg(&db)
        .arg("--json")
        .arg("wallet")
        .arg("grant")
        .arg("100")
        .arg("--purpose")
        .arg("test_grant");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["balance_before"].is_number());
    assert!(result["balance_after"].is_number());
    assert!(result["delta"].is_number());
    assert!(result["reason"].is_string());
}

#[test]
fn test_wallet_spend_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db")
        .arg(&db)
        .arg("--json")
        .arg("wallet")
        .arg("spend")
        .arg("50")
        .arg("--purpose")
        .arg("test_spend");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["balance_before"].is_number());
    assert!(result["balance_after"].is_number());
    assert!(result["delta"].is_number());
    assert!(result["reason"].is_string());
}

#[test]
fn test_penalty_show_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("penalty").arg("show");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["user_id"].is_string());
    assert!(result["escalation_tier"].is_string());
    assert!(result["bypass_budget"].is_number());
    assert!(result["debt_balance"].is_number());
    assert!(result["lockout_windows"].is_array());
}

#[test]
fn test_focus_start_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("focus").arg("start").arg("45");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert_eq!(result["event_type"].as_str(), Some("focus:session_started"));
    assert_eq!(result["minutes"].as_i64(), Some(45));
    assert!(result["timestamp"].is_string());
}

#[test]
fn test_focus_complete_json() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("--json").arg("focus").arg("complete").arg("45");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert_eq!(result["event_type"].as_str(), Some("focus:session_completed"));
    assert_eq!(result["minutes"].as_i64(), Some(45));
    assert!(result["timestamp"].is_string());
}

#[test]
#[ignore = "TBD: see test fixture in tests/fixtures/templates/"]
fn test_templates_list_json() {
    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--json").arg("templates").arg("list");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_array());

    // Check schema of each template
    if let Some(templates) = result.as_array() {
        for template in templates {
            assert!(template["id"].is_string());
            assert!(template["version"].is_string());
            assert!(template["name"].is_string());
            assert!(template["rules"].is_number());
            assert!(template["description"].is_string());
        }
    }
}

#[test]
#[ignore = "TBD: see test fixture in tests/fixtures/release-notes/"]
fn test_release_notes_json() {
    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--json").arg("release-notes").arg("generate").arg("--since").arg("v0.0.3");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
    assert!(result["sections"].is_array());

    // Check schema of each section
    if let Some(sections) = result["sections"].as_array() {
        for section in sections {
            assert!(section["category"].is_string());
            assert!(section["items"].is_array());
        }
    }
}

#[test]
fn test_json_output_not_default() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("wallet").arg("balance");

    let output = cmd.output().expect("command ran");
    let text = String::from_utf8(output.stdout).expect("valid utf8");

    // Without --json, output should be human-readable (lines with colons)
    assert!(text.contains("user_id:") || text.is_empty()); // Allow empty if no wallet

    // Should not be valid JSON (unless by chance)
    assert!(serde_json::from_str::<Value>(&text).is_err());
}

#[test]
fn test_json_flag_short_form() {
    let db = setup_test_db();
    if !db.exists() {
        return;
    }

    let mut cmd = Command::cargo_bin("focus").expect("bin exists");
    cmd.arg("--db").arg(&db).arg("-j").arg("wallet").arg("balance");

    let output = cmd.output().expect("command ran");
    let json_str = String::from_utf8(output.stdout).expect("valid utf8");

    // Should produce valid JSON with -j shorthand
    let result: Value = serde_json::from_str(&json_str).expect("valid json");
    assert!(result.is_object());
}
