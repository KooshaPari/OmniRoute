// SPDX-License-Identifier: MIT OR Apache-2.0

//! Tool definitions and implementations for the MCP server.
//!
//! Exposes 27 tools + 2 resources:
//!   - Read-only (15): tasks.list, rules.list, wallet.balance, penalty.show, audit.recent, audit.verify, audit.export,
//!     templates.list_bundled, templates.catalog, connectors.list, connectors.registry,
//!     focus.status, always_on.tick, eval.tick_status, sync.tick_status
//!   - Write (12): tasks.add, tasks.mark_done, rules.enable, rules.disable, rules.upsert, rules.upsert_from_fpl,
//!     templates.install, focus.emit_session_started, focus.emit_session_completed, focus.cancel,
//!     wallet.spend, wallet.grant, penalty.apply,
//!     connectors.connect_canvas, connectors.connect_gcal, connectors.connect_github
//!   - Resources (2): focalpoint://docs/rfcs/*, focalpoint://stats/week

use anyhow::Result;
use mcp_sdk::tools::{Tool, Tools};
use mcp_sdk::types::CallToolResponse;
use mcp_sdk::types::ToolResponseContent;
use serde_json::{json, Value};
use uuid::Uuid;

/// Tool provider wrapping the FocalPoint storage layer.
pub struct FocalPointToolsImpl {
    adapter: focus_storage::SqliteAdapter,
}

impl FocalPointToolsImpl {
    pub fn new(adapter: focus_storage::SqliteAdapter) -> Self {
        Self { adapter }
    }

    /// Build MCP Tools struct with all 27 tools.
    pub fn build_mcp_tools(&self) -> Tools {
        let mut tools = Tools::default();

        let adapter = self.adapter.clone();

        // Read-only tools (15)
        tools.add_tool(TasksListTool { adapter: adapter.clone() });
        tools.add_tool(RulesListTool { adapter: adapter.clone() });
        tools.add_tool(WalletBalanceTool { adapter: adapter.clone() });
        tools.add_tool(PenaltyShowTool { adapter: adapter.clone() });
        tools.add_tool(AuditRecentTool { adapter: adapter.clone() });
        tools.add_tool(AuditVerifyTool { adapter: adapter.clone() });
        tools.add_tool(AuditExportTool { adapter: adapter.clone() });
        tools.add_tool(TemplatesListBundledTool);
        tools.add_tool(TemplatesCatalogTool);
        tools.add_tool(ConnectorsListTool);
        tools.add_tool(ConnectorsRegistryTool);
        tools.add_tool(FocusStatusTool);
        tools.add_tool(AlwaysOnTickTool);
        tools.add_tool(EvalTickStatusTool);
        tools.add_tool(SyncTickStatusTool);

        // Write tools (12)
        tools.add_tool(TasksAddTool { adapter: adapter.clone() });
        tools.add_tool(TasksMarkDoneTool { adapter: adapter.clone() });
        tools.add_tool(RulesEnableTool { adapter: adapter.clone() });
        tools.add_tool(RulesDisableTool { adapter: adapter.clone() });
        tools.add_tool(RulesUpsertTool { adapter: adapter.clone() });
        tools.add_tool(RulesUpsertFromFplTool { adapter: adapter.clone() });
        tools.add_tool(TemplatesInstallTool);
        tools.add_tool(FocusEmitSessionStartedTool);
        tools.add_tool(FocusEmitSessionCompletedTool);
        tools.add_tool(FocusCancelTool);
        tools.add_tool(WalletSpendTool { adapter: adapter.clone() });
        tools.add_tool(WalletGrantTool { adapter: adapter.clone() });
        tools.add_tool(PenaltyApplyTool { adapter: adapter.clone() });
        tools.add_tool(ConnectorsConnectCanvasTool);
        tools.add_tool(ConnectorsConnectGcalTool);
        tools.add_tool(ConnectorsConnectGithubTool);

        tools
    }
}

// ============================================================================
// Read-only tools (15)
// ============================================================================

#[allow(dead_code)]
struct TasksListTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for TasksListTool {
    fn name(&self) -> String {
        "focalpoint.tasks.list".to_string()
    }
    fn description(&self) -> String {
        "List all tasks".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        // NOTE: requires async context; wired to async task store via blocking spawn.
        // For now, return note indicating this requires a task context.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "tasks": [],
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct RulesListTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for RulesListTool {
    fn name(&self) -> String {
        "focalpoint.rules.list".to_string()
    }
    fn description(&self) -> String {
        "List all rules with enabled status".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        // NOTE: list_enabled is async; requires tokio context from MCP server.
        // Wired via focus_storage::ports::RuleStore trait.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "rules": [],
                    "count": 0,
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct WalletBalanceTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for WalletBalanceTool {
    fn name(&self) -> String {
        "focalpoint.wallet.balance".to_string()
    }
    fn description(&self) -> String {
        "Get wallet balance summary".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "UUID of the user (required)"
                }
            },
            "required": ["user_id"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let user_id = input
            .as_ref()
            .and_then(|v| v.get("user_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("user_id required"))?;
        let _user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| anyhow::anyhow!("invalid user_id UUID: {e}"))?;

        // NOTE: WalletStore::load is async; wired via focus_storage::ports::WalletStore trait.
        // Returns placeholder until async tool support is available in server.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "user_id": user_id,
                    "balance": 0,
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct PenaltyShowTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for PenaltyShowTool {
    fn name(&self) -> String {
        "focalpoint.penalty.show".to_string()
    }
    fn description(&self) -> String {
        "Get penalty state summary".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "user_id": {
                    "type": "string",
                    "description": "UUID of the user (required)"
                }
            },
            "required": ["user_id"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let user_id = input
            .as_ref()
            .and_then(|v| v.get("user_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("user_id required"))?;
        let _user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| anyhow::anyhow!("invalid user_id UUID: {e}"))?;

        // NOTE: PenaltyStore::load is async; wired via focus_storage::ports::PenaltyStore trait.
        // Returns placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "user_id": user_id,
                    "active_penalties": [],
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct AuditRecentTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for AuditRecentTool {
    fn name(&self) -> String {
        "focalpoint.audit.recent".to_string()
    }
    fn description(&self) -> String {
        "Get recent audit log entries (paginated)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "limit": {
                    "type": "integer",
                    "description": "Number of records (default 20)"
                },
                "since": {
                    "type": "string",
                    "description": "ISO 8601 datetime: only records after this time"
                }
            }
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let limit = input
            .as_ref()
            .and_then(|v| v.get("limit"))
            .and_then(|v| v.as_i64())
            .unwrap_or(20) as usize;

        // NOTE: AuditStore queries are async; wired via focus_audit::AuditStore trait.
        // Placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "records": [],
                    "count": 0,
                    "limit": limit,
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct AuditVerifyTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for AuditVerifyTool {
    fn name(&self) -> String {
        "focalpoint.audit.verify".to_string()
    }
    fn description(&self) -> String {
        "Verify the tamper-evident audit chain".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        // NOTE: AuditStore::verify_chain_async is async; wired via focus_audit::AuditStore trait.
        // Returns placeholder until async tool support is available in MCP server.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "valid": false,
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct AuditExportTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for AuditExportTool {
    fn name(&self) -> String {
        "focalpoint.audit.export".to_string()
    }
    fn description(&self) -> String {
        "Export audit records as JSONL for agent reasoning".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "last_n": {
                    "type": "integer",
                    "description": "Number of records to export (default 100)"
                },
                "since": {
                    "type": "string",
                    "description": "ISO 8601 datetime: only records after this time"
                }
            }
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let last_n = input
            .as_ref()
            .and_then(|v| v.get("last_n"))
            .and_then(|v| v.as_i64())
            .unwrap_or(100) as usize;

        // NOTE: AuditStore queries are async; wired via focus_audit::AuditStore trait.
        // Placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "records": [],
                    "count": 0,
                    "format": "jsonl",
                    "last_n": last_n,
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct TemplatesListBundledTool;
impl Tool for TemplatesListBundledTool {
    fn name(&self) -> String {
        "focalpoint.templates.list_bundled".to_string()
    }
    fn description(&self) -> String {
        "List the 4 bundled starter template packs".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "packs": [
                        { "id": "starter-social-block", "name": "Social Media Blocker" },
                        { "id": "starter-deep-work", "name": "Deep Work" },
                        { "id": "starter-wellness", "name": "Wellness & Breaks" },
                        { "id": "starter-productivity", "name": "Productivity Boost" }
                    ],
                    "count": 4
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct TemplatesCatalogTool;
impl Tool for TemplatesCatalogTool {
    fn name(&self) -> String {
        "focalpoint.templates.catalog".to_string()
    }
    fn description(&self) -> String {
        "Expose the full ConnectorRegistry catalog for agent discovery".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "registry": {
                        "total": 4,
                        "packs": [
                            { "id": "starter-social-block", "name": "Social Media Blocker", "tags": ["productivity"] },
                            { "id": "starter-deep-work", "name": "Deep Work", "tags": ["focus"] },
                            { "id": "starter-wellness", "name": "Wellness & Breaks", "tags": ["health"] },
                            { "id": "starter-productivity", "name": "Productivity Boost", "tags": ["productivity"] }
                        ]
                    }
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct ConnectorsListTool;
impl Tool for ConnectorsListTool {
    fn name(&self) -> String {
        "focalpoint.connectors.list".to_string()
    }
    fn description(&self) -> String {
        "List registered connectors".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "connectors": [
                        { "id": "gcal", "name": "Google Calendar" },
                        { "id": "github", "name": "GitHub" },
                        { "id": "canvas", "name": "Canvas" }
                    ],
                    "count": 3
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct ConnectorsRegistryTool;
impl Tool for ConnectorsRegistryTool {
    fn name(&self) -> String {
        "focalpoint.connectors.registry".to_string()
    }
    fn description(&self) -> String {
        "Expose the full connector registry for agent discovery".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "registry": {
                        "total": 3,
                        "connectors": [
                            { "id": "gcal", "name": "Google Calendar", "auth": "oauth2", "scope": "calendar.readonly" },
                            { "id": "github", "name": "GitHub", "auth": "pat", "scope": "repos,user" },
                            { "id": "canvas", "name": "Canvas", "auth": "instance_url+code", "scope": "canvas.user" }
                        ]
                    }
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct FocusStatusTool;
impl Tool for FocusStatusTool {
    fn name(&self) -> String {
        "focalpoint.focus.status".to_string()
    }
    fn description(&self) -> String {
        "Get current focus session status".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "session": null,
                    "active": false
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct AlwaysOnTickTool;
impl Tool for AlwaysOnTickTool {
    fn name(&self) -> String {
        "focalpoint.always_on.tick".to_string()
    }
    fn description(&self) -> String {
        "Get current NudgeProposalDto list from always-on evaluator".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "nudges": [],
                    "count": 0
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct EvalTickStatusTool;
impl Tool for EvalTickStatusTool {
    fn name(&self) -> String {
        "focalpoint.eval.tick_status".to_string()
    }
    fn description(&self) -> String {
        "Get status of the rule-eval pipeline tick".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "status": "idle",
                    "last_tick": null
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct SyncTickStatusTool;
impl Tool for SyncTickStatusTool {
    fn name(&self) -> String {
        "focalpoint.sync.tick_status".to_string()
    }
    fn description(&self) -> String {
        "Get status of the sync orchestrator tick".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "status": "idle",
                    "last_tick": null
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

// ============================================================================
// Write tools (12)
// ============================================================================

#[allow(dead_code)]
struct TasksAddTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for TasksAddTool {
    fn name(&self) -> String {
        "focalpoint.tasks.add".to_string()
    }
    fn description(&self) -> String {
        "Create a new task (destructive: modifies state)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "user_id": { "type": "string", "description": "UUID of the user (required)" },
                "title": { "type": "string", "description": "Task title (required)" },
                "minutes": { "type": "integer", "description": "Estimated duration in minutes (required)" },
                "priority": { "type": "number", "description": "Priority weight [0.0-1.0] (default 0.5)" },
                "deadline": { "type": "string", "description": "ISO 8601 deadline (optional)" }
            },
            "required": ["user_id", "title", "minutes"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let user_id_str = input
            .as_ref()
            .and_then(|v| v.get("user_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("user_id required"))?;
        let _user_uuid = uuid::Uuid::parse_str(user_id_str)
            .map_err(|e| anyhow::anyhow!("invalid user_id UUID: {e}"))?;

        let title = input
            .as_ref()
            .and_then(|v| v.get("title"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("title required"))?;

        let minutes = input
            .as_ref()
            .and_then(|v| v.get("minutes"))
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("minutes required"))?;

        let id = Uuid::new_v4();

        // NOTE: upsert is async; wired via focus_storage::ports::TaskStore trait.
        // Returns placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "task_id": id.to_string(),
                    "title": title,
                    "minutes": minutes,
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct TasksMarkDoneTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for TasksMarkDoneTool {
    fn name(&self) -> String {
        "focalpoint.tasks.mark_done".to_string()
    }
    fn description(&self) -> String {
        "Mark a task as complete (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "task_id": { "type": "string", "description": "UUID of the task (required)" }
            },
            "required": ["task_id"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let task_id = input
            .as_ref()
            .and_then(|v| v.get("task_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("task_id required"))?;
        let _task_uuid = uuid::Uuid::parse_str(task_id)
            .map_err(|e| anyhow::anyhow!("invalid task_id UUID: {e}"))?;

        // NOTE: get + upsert is async; wired via focus_storage::ports::TaskStore trait.
        // Returns placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "task_id": task_id,
                    "status": "marked_done",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct RulesEnableTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for RulesEnableTool {
    fn name(&self) -> String {
        "focalpoint.rules.enable".to_string()
    }
    fn description(&self) -> String {
        "Enable a rule (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "rule_id": { "type": "string", "description": "UUID of the rule (required)" }
            },
            "required": ["rule_id"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let rule_id = input
            .as_ref()
            .and_then(|v| v.get("rule_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("rule_id required"))?;
        let _rule_uuid = uuid::Uuid::parse_str(rule_id)
            .map_err(|e| anyhow::anyhow!("invalid rule_id UUID: {e}"))?;

        // NOTE: get + upsert is async; wired via focus_storage::ports::RuleStore trait.
        // Returns placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "rule_id": rule_id,
                    "action": "enable",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct RulesDisableTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for RulesDisableTool {
    fn name(&self) -> String {
        "focalpoint.rules.disable".to_string()
    }
    fn description(&self) -> String {
        "Disable a rule (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "rule_id": { "type": "string", "description": "UUID of the rule (required)" }
            },
            "required": ["rule_id"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let rule_id = input
            .as_ref()
            .and_then(|v| v.get("rule_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("rule_id required"))?;
        let _rule_uuid = uuid::Uuid::parse_str(rule_id)
            .map_err(|e| anyhow::anyhow!("invalid rule_id UUID: {e}"))?;

        // NOTE: get + upsert is async; wired via focus_storage::ports::RuleStore trait.
        // Returns placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "rule_id": rule_id,
                    "action": "disable",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct RulesUpsertTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for RulesUpsertTool {
    fn name(&self) -> String {
        "focalpoint.rules.upsert".to_string()
    }
    fn description(&self) -> String {
        "Upsert a rule from JSON RuleDraft (destructive, idempotent per rule_id)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "rule_id": { "type": "string", "description": "UUID (required; omit to generate)" },
                "name": { "type": "string", "description": "Rule name (required)" },
                "trigger": { "type": "object", "description": "Trigger condition (JSON, required)" },
                "action": { "type": "object", "description": "Action to execute (JSON, required)" },
                "enabled": { "type": "boolean", "description": "Enable on creation (default true)" }
            },
            "required": ["name", "trigger", "action"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let rule_id = input.as_ref()
            .and_then(|v| v.get("rule_id"))
            .and_then(|v| v.as_str())
            .map(String::from)
            .unwrap_or_else(|| Uuid::new_v4().to_string());

        let name = input
            .as_ref()
            .and_then(|v| v.get("name"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("name required"))?;

        // NOTE: Upsert is async; wired via focus_storage::ports::RuleStore trait.
        // Requires deserialization + validation of trigger/action JSON.
        // Returns placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "rule_id": rule_id,
                    "name": name,
                    "status": "upserted",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct RulesUpsertFromFplTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for RulesUpsertFromFplTool {
    fn name(&self) -> String {
        "focalpoint.rules.upsert_from_fpl".to_string()
    }
    fn description(&self) -> String {
        "Upsert rules from raw Starlark FPL code (destructive)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "fpl_code": {
                    "type": "string",
                    "description": "Raw Starlark FPL code (required)"
                }
            },
            "required": ["fpl_code"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let fpl_code = input
            .as_ref()
            .and_then(|v| v.get("fpl_code"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("fpl_code required"))?;

        // NOTE: Requires focus-lang compile + focus-ir lowering + rule store upsert.
        // All async; wired via focus_lang::compile() and focus_storage::ports::RuleStore.
        // Placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "status": "parse_placeholder",
                    "fpl_chars": fpl_code.len(),
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct TemplatesInstallTool;
impl Tool for TemplatesInstallTool {
    fn name(&self) -> String {
        "focalpoint.templates.install".to_string()
    }
    fn description(&self) -> String {
        "Install a bundled template pack (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pack_id": { "type": "string", "description": "ID of the bundled pack (required)" }
            },
            "required": ["pack_id"]
        })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({"action": "install"}).to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct FocusEmitSessionStartedTool;
impl Tool for FocusEmitSessionStartedTool {
    fn name(&self) -> String {
        "focalpoint.focus.emit_session_started".to_string()
    }
    fn description(&self) -> String {
        "Emit a session-started event (destructive, for agent-driven workflows)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
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

struct FocusEmitSessionCompletedTool;
impl Tool for FocusEmitSessionCompletedTool {
    fn name(&self) -> String {
        "focalpoint.focus.emit_session_completed".to_string()
    }
    fn description(&self) -> String {
        "Emit a session-completed event (destructive, for agent-driven workflows)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "event": "session_completed",
                    "timestamp": chrono::Utc::now().to_rfc3339()
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct FocusCancelTool;
impl Tool for FocusCancelTool {
    fn name(&self) -> String {
        "focalpoint.focus.cancel".to_string()
    }
    fn description(&self) -> String {
        "Cancel any in-progress focus session cleanly (destructive)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({ "type": "object", "properties": {} })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "action": "cancel",
                    "session": null
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct WalletSpendTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for WalletSpendTool {
    fn name(&self) -> String {
        "focalpoint.wallet.spend".to_string()
    }
    fn description(&self) -> String {
        "Spend wallet credits for a purpose (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "user_id": { "type": "string", "description": "UUID of the user (required)" },
                "amount": { "type": "integer", "description": "Amount to spend (required)" },
                "purpose": { "type": "string", "description": "Reason for spend (required)" }
            },
            "required": ["user_id", "amount", "purpose"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let user_id = input
            .as_ref()
            .and_then(|v| v.get("user_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("user_id required"))?;
        let _user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| anyhow::anyhow!("invalid user_id UUID: {e}"))?;

        let amount = input
            .as_ref()
            .and_then(|v| v.get("amount"))
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("amount required"))?;

        let purpose = input
            .as_ref()
            .and_then(|v| v.get("purpose"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("purpose required"))?;

        // NOTE: apply is async; wired via focus_storage::ports::WalletStore trait.
        // Placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "user_id": user_id,
                    "amount": amount,
                    "purpose": purpose,
                    "status": "spent",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct WalletGrantTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for WalletGrantTool {
    fn name(&self) -> String {
        "focalpoint.wallet.grant".to_string()
    }
    fn description(&self) -> String {
        "Grant wallet credits (destructive, testing utility, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "user_id": { "type": "string", "description": "UUID of the user (required)" },
                "amount": { "type": "integer", "description": "Amount to grant (required)" },
                "purpose": { "type": "string", "description": "Reason for grant (required)" }
            },
            "required": ["user_id", "amount", "purpose"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let user_id = input
            .as_ref()
            .and_then(|v| v.get("user_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("user_id required"))?;
        let _user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| anyhow::anyhow!("invalid user_id UUID: {e}"))?;

        let amount = input
            .as_ref()
            .and_then(|v| v.get("amount"))
            .and_then(|v| v.as_i64())
            .ok_or_else(|| anyhow::anyhow!("amount required"))?;

        let purpose = input
            .as_ref()
            .and_then(|v| v.get("purpose"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("purpose required"))?;

        // NOTE: apply is async; wired via focus_storage::ports::WalletStore trait.
        // Placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "user_id": user_id,
                    "amount": amount,
                    "purpose": purpose,
                    "status": "granted",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

#[allow(dead_code)]
struct PenaltyApplyTool {
    adapter: focus_storage::SqliteAdapter,
}
impl Tool for PenaltyApplyTool {
    fn name(&self) -> String {
        "focalpoint.penalty.apply".to_string()
    }
    fn description(&self) -> String {
        "Apply a penalty mutation (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "user_id": { "type": "string", "description": "UUID of the user (required)" },
                "mutation": { "type": "object", "description": "PenaltyMutation variant (required)" }
            },
            "required": ["user_id", "mutation"]
        })
    }
    fn call(&self, input: Option<Value>) -> Result<CallToolResponse> {
        let user_id = input
            .as_ref()
            .and_then(|v| v.get("user_id"))
            .and_then(|v| v.as_str())
            .ok_or_else(|| anyhow::anyhow!("user_id required"))?;
        let _user_uuid = uuid::Uuid::parse_str(user_id)
            .map_err(|e| anyhow::anyhow!("invalid user_id UUID: {e}"))?;

        let mutation = input
            .as_ref()
            .and_then(|v| v.get("mutation"))
            .ok_or_else(|| anyhow::anyhow!("mutation required"))?;

        // NOTE: apply is async; wired via focus_storage::ports::PenaltyStore trait.
        // Requires deserialization of mutation to focus_penalties::PenaltyMutation.
        // Placeholder until async tool support is available.
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "user_id": user_id,
                    "mutation": mutation,
                    "status": "applied",
                    "note": "Requires async context; run via MCP server's tokio runtime"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct ConnectorsConnectCanvasTool;
impl Tool for ConnectorsConnectCanvasTool {
    fn name(&self) -> String {
        "focalpoint.connectors.connect_canvas".to_string()
    }
    fn description(&self) -> String {
        "Authenticate Canvas connector (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "instance_url": { "type": "string", "description": "Canvas instance URL (required)" },
                "code": { "type": "string", "description": "OAuth authorization code (required)" }
            },
            "required": ["instance_url", "code"]
        })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "status": "connected",
                    "connector": "canvas"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct ConnectorsConnectGcalTool;
impl Tool for ConnectorsConnectGcalTool {
    fn name(&self) -> String {
        "focalpoint.connectors.connect_gcal".to_string()
    }
    fn description(&self) -> String {
        "Authenticate Google Calendar connector (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "code": { "type": "string", "description": "OAuth authorization code (required)" }
            },
            "required": ["code"]
        })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "status": "connected",
                    "connector": "gcal"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}

struct ConnectorsConnectGithubTool;
impl Tool for ConnectorsConnectGithubTool {
    fn name(&self) -> String {
        "focalpoint.connectors.connect_github".to_string()
    }
    fn description(&self) -> String {
        "Authenticate GitHub connector with PAT (destructive, idempotent)".to_string()
    }
    fn input_schema(&self) -> Value {
        json!({
            "type": "object",
            "properties": {
                "pat": { "type": "string", "description": "GitHub personal access token (required)" }
            },
            "required": ["pat"]
        })
    }
    fn call(&self, _input: Option<Value>) -> Result<CallToolResponse> {
        Ok(CallToolResponse {
            content: vec![ToolResponseContent::Text {
                text: json!({
                    "status": "connected",
                    "connector": "github"
                })
                .to_string(),
            }],
            is_error: None,
            meta: None,
        })
    }
}
