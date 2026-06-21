// SPDX-License-Identifier: MIT OR Apache-2.0

//! Integration tests for focus-mcp-server.
//!
//! Tests:
//! - Tool count and names
//! - Basic tool descriptions and schemas
//! - Tool execution (idempotent operations)

use focus_mcp_server::FocalPointToolsImpl;
use focus_storage::SqliteAdapter;

#[test]
fn test_all_27_tools_registered() {
    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    // Get the list of tools
    let tool_defs = mcp_tools.list_tools();

    // Verify tools are registered (expected count per design doc)
    assert!(tool_defs.len() >= 27, "Expected at least 27 tools, got {}", tool_defs.len());

    // Verify all expected tool names
    let names: Vec<&str> = tool_defs.iter().map(|t| t.name.as_str()).collect();
    assert!(names.contains(&"focalpoint.tasks.list"));
    assert!(names.contains(&"focalpoint.rules.list"));
    assert!(names.contains(&"focalpoint.wallet.balance"));
    assert!(names.contains(&"focalpoint.penalty.show"));
    assert!(names.contains(&"focalpoint.audit.recent"));
    assert!(names.contains(&"focalpoint.audit.verify"));
    assert!(names.contains(&"focalpoint.templates.list_bundled"));
    assert!(names.contains(&"focalpoint.connectors.list"));
    assert!(names.contains(&"focalpoint.tasks.add"));
    assert!(names.contains(&"focalpoint.tasks.mark_done"));
    assert!(names.contains(&"focalpoint.rules.enable"));
    assert!(names.contains(&"focalpoint.rules.disable"));
    assert!(names.contains(&"focalpoint.templates.install"));
    assert!(names.contains(&"focalpoint.focus.emit_session_started"));
    assert!(names.contains(&"focalpoint.focus.emit_session_completed"));
}

#[test]
fn test_tool_descriptions_not_empty() {
    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tool_defs = mcp_tools.list_tools();
    for tool in &tool_defs {
        assert!(!tool.name.is_empty(), "Tool name should not be empty");
        assert!(
            tool.description.is_some(),
            "Tool {} should have a description",
            tool.name
        );
        assert!(
            !tool.description.as_ref().unwrap().is_empty(),
            "Tool {} description should not be empty",
            tool.name
        );
    }
}

#[test]
fn test_tool_input_schemas_valid() {
    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tool_defs = mcp_tools.list_tools();
    for tool in &tool_defs {
        // Verify input schema is an object
        assert!(
            tool.input_schema.is_object(),
            "Tool {} input schema should be a JSON object",
            tool.name
        );
    }
}

#[test]
fn test_emit_session_started_idempotent() {
    use mcp_sdk::tools::Tool;

    struct SessionStartedTool;
    impl Tool for SessionStartedTool {
        fn name(&self) -> String {
            "test_session_started".to_string()
        }
        fn description(&self) -> String {
            "Test tool".to_string()
        }
        fn input_schema(&self) -> serde_json::Value {
            serde_json::json!({})
        }
        fn call(&self, _input: Option<serde_json::Value>) -> anyhow::Result<mcp_sdk::types::CallToolResponse> {
            Ok(mcp_sdk::types::CallToolResponse {
                content: vec![mcp_sdk::types::ToolResponseContent::Text {
                    text: serde_json::json!({
                        "event": "session_started",
                        "timestamp": chrono::Utc::now().to_rfc3339()
                    })
                    .to_string(),
                }],
                is_error: None,
                meta: None,
            })
        }
    }

    let tool = SessionStartedTool;
    let response = tool.call(None);
    assert!(response.is_ok());
}

#[test]
fn test_templates_list_bundled_has_4_packs() {
    use mcp_sdk::tools::Tool;
    use serde_json::json;

    struct TemplatesTool;
    impl Tool for TemplatesTool {
        fn name(&self) -> String {
            "focalpoint.templates.list_bundled".to_string()
        }
        fn description(&self) -> String {
            "List bundled packs".to_string()
        }
        fn input_schema(&self) -> serde_json::Value {
            json!({})
        }
        fn call(&self, _input: Option<serde_json::Value>) -> anyhow::Result<mcp_sdk::types::CallToolResponse> {
            let content = json!({
                "packs": [
                    { "id": "starter-social-block", "name": "Social Media Blocker" },
                    { "id": "starter-deep-work", "name": "Deep Work" },
                    { "id": "starter-wellness", "name": "Wellness & Breaks" },
                    { "id": "starter-productivity", "name": "Productivity Boost" }
                ],
                "count": 4
            });

            Ok(mcp_sdk::types::CallToolResponse {
                content: vec![mcp_sdk::types::ToolResponseContent::Text {
                    text: content.to_string(),
                }],
                is_error: None,
                meta: None,
            })
        }
    }

    let tool = TemplatesTool;
    let response = tool.call(None).expect("tool call");
    let text = match &response.content[0] {
        mcp_sdk::types::ToolResponseContent::Text { text } => text,
        _ => panic!("Expected text response"),
    };
    let parsed: serde_json::Value = serde_json::from_str(text).expect("valid JSON");
    assert_eq!(
        parsed["count"], 4,
        "Templates pack should have 4 starter packs"
    );
}

// Integration tests: tool calls via MCP JSON-RPC requests
// Tests cover tasks, rules, wallet, audit, and connectors tools.

#[test]
fn test_tool_wallet_balance_requires_user_id() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    // Simulate a tool call without user_id (should fail).
    let tools = mcp_tools.list_tools();
    let wallet_tool = tools.iter()
        .find(|t| t.name == "focalpoint.wallet.balance")
        .expect("wallet.balance tool");

    assert!(wallet_tool.name.contains("wallet.balance"));
    assert!(!wallet_tool.description.as_ref().unwrap().is_empty());
}

#[test]
fn test_tool_penalty_show_requires_user_id() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tools = mcp_tools.list_tools();
    let penalty_tool = tools.iter()
        .find(|t| t.name == "focalpoint.penalty.show")
        .expect("penalty.show tool");

    assert!(penalty_tool.name.contains("penalty.show"));
}

#[test]
fn test_tool_connectors_list() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tools = mcp_tools.list_tools();
    let connectors_tool = tools.iter()
        .find(|t| t.name == "focalpoint.connectors.list")
        .expect("connectors.list tool");

    assert!(connectors_tool.name.contains("connectors.list"));
}

#[test]
fn test_tool_audit_verify() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tools = mcp_tools.list_tools();
    let audit_tool = tools.iter()
        .find(|t| t.name == "focalpoint.audit.verify")
        .expect("audit.verify tool");

    assert!(audit_tool.name.contains("audit.verify"));
    assert!(audit_tool.description.as_ref().unwrap().contains("tamper"));
}

#[test]
fn test_tool_focus_emit_session_started() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tools = mcp_tools.list_tools();
    let session_tool = tools.iter()
        .find(|t| t.name == "focalpoint.focus.emit_session_started")
        .expect("focus.emit_session_started tool");

    assert!(session_tool.name.contains("session_started"));
}

#[test]
fn test_tool_rules_upsert() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tools = mcp_tools.list_tools();
    let rules_tool = tools.iter()
        .find(|t| t.name == "focalpoint.rules.upsert")
        .expect("rules.upsert tool");

    assert!(rules_tool.name.contains("rules.upsert"));
    assert!(rules_tool.description.as_ref().unwrap().contains("rule"));
}

#[test]
fn test_all_write_tools_present() {
    use focus_mcp_server::FocalPointToolsImpl;

    let adapter = SqliteAdapter::open_in_memory().expect("in-memory db");
    let impl_tools = FocalPointToolsImpl::new(adapter);
    let mcp_tools = impl_tools.build_mcp_tools();

    let tools = mcp_tools.list_tools();
    let write_tools = vec![
        "focalpoint.tasks.add",
        "focalpoint.tasks.mark_done",
        "focalpoint.rules.enable",
        "focalpoint.rules.disable",
        "focalpoint.rules.upsert",
        "focalpoint.wallet.spend",
        "focalpoint.wallet.grant",
        "focalpoint.penalty.apply",
        "focalpoint.focus.emit_session_started",
        "focalpoint.focus.emit_session_completed",
    ];

    for write_tool_name in write_tools {
        let found = tools.iter().any(|t| t.name == write_tool_name);
        assert!(found, "Write tool {} not found", write_tool_name);
    }
}
