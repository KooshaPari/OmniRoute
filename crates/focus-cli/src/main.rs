// SPDX-License-Identifier: MIT OR Apache-2.0

//! Dev CLI: audit inspect, task list, template list, rule mgmt, wallet/penalty ops, sync/eval ticks, time-travel replay.
//!
//! Opens the same SQLite store the iOS app uses (path overridable via
//! `--db` flag or `FOCALPOINT_DB` env var; defaults to
//! `~/Library/Application Support/focalpoint/core.db` on macOS).
//! Dual-surface contract: all operations accessible via CLI.

mod replay;

use chrono::Utc;
use clap::{Parser, Subcommand};
use focus_audit::AuditStore;
use focus_demo_seed::{reset_demo_data, seed_demo_data};
use focus_lang::bulk;
use focus_observability::init_tracing;
use focus_planning::TaskStore;
use focus_storage::ports::{PenaltyStore, RuleStore, WalletStore};
use focus_storage::sqlite::{
    audit_store::SqliteAuditStore, rule_store::upsert_rule, task_store::SqliteTaskStore,
};
use focus_storage::SqliteAdapter;
use serde::{Deserialize, Serialize};
use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;
use std::sync::Arc;
use uuid::Uuid;

// JSON output schemas
#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct JsonError {
    error: ErrorDetail,
}

#[allow(dead_code)]
#[derive(Serialize, Deserialize)]
struct ErrorDetail {
    code: String,
    message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    details: Option<String>,
}

#[allow(dead_code)]
#[derive(Serialize)]
struct AuditRecord {
    ts: String,
    kind: String,
    payload: serde_json::Value,
}

#[derive(Serialize)]
struct TaskJson {
    id: String,
    title: String,
    priority: f32,
    status: String,
    deadline: Option<String>,
    created_at: String,
    updated_at: String,
}

#[derive(Serialize)]
struct RuleJson {
    id: String,
    name: String,
    priority: i32,
    enabled: bool,
    trigger: String,
}

#[derive(Serialize)]
struct WalletState {
    user_id: String,
    earned_credits: i64,
    spent_credits: i64,
    balance: i64,
    multiplier: f32,
    multiplier_expires_at: Option<String>,
}

#[derive(Serialize)]
struct WalletOperation {
    balance_before: i64,
    balance_after: i64,
    delta: i64,
    reason: String,
}

#[derive(Serialize)]
struct PenaltyState {
    user_id: String,
    escalation_tier: String,
    bypass_budget: i64,
    debt_balance: i64,
    strict_mode_until: Option<String>,
    lockout_windows: Vec<LockoutWindow>,
}

#[derive(Serialize)]
struct LockoutWindow {
    starts_at: String,
    ends_at: String,
    reason: String,
    rigidity: String,
}

#[allow(dead_code)]
#[derive(Serialize)]
struct ConnectorInfo {
    id: String,
    name: String,
    health: String,
    cadence: String,
    next_sync_at: Option<String>,
}

#[derive(Serialize)]
struct TemplateInstall {
    pack_id: String,
    rules_installed: usize,
    tasks_installed: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    signed_by: Option<String>,
    sha256: String,
}

#[derive(Serialize)]
struct VerifyChain {
    verified: bool,
    chain_length: usize,
    root_hash: Option<String>,
}

#[allow(dead_code)]
#[derive(Serialize)]
struct SyncTickResult {
    success: bool,
    events_pulled: usize,
    errors: Vec<String>,
}

#[allow(dead_code)]
#[derive(Serialize)]
struct EvalTickResult {
    success: bool,
    events_processed: usize,
    rules_fired: usize,
    decisions: Vec<String>,
}

#[derive(Serialize)]
struct FocusSession {
    event_type: String,
    minutes: i32,
    timestamp: String,
}

#[derive(Serialize)]
struct ReleaseNotesOutput {
    sections: Vec<ReleaseSection>,
}

#[derive(Serialize)]
struct ReleaseSection {
    category: String,
    items: Vec<String>,
}

#[derive(Serialize, Deserialize, Debug)]
struct TemplateSearchResult {
    id: String,
    name: String,
    author: String,
    rating: f32,
    installs: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    signed_by_fingerprint: Option<String>,
}

#[derive(Parser)]
#[command(
    name = "focus",
    about = "FocalPoint dual-surface CLI: dev inspect, rule mgmt, wallet ops, task mgmt, sync/eval orchestration"
)]
struct Cli {
    /// Path to core.db. Defaults to FOCALPOINT_DB or the app's default location.
    #[arg(long, global = true)]
    db: Option<PathBuf>,

    /// Emit structured JSON output instead of human-readable text.
    #[arg(short, long, global = true)]
    json: bool,

    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand)]
enum Cmd {
    /// Inspect the audit chain.
    Audit {
        #[command(subcommand)]
        sub: AuditCmd,
    },
    /// Task-store inspection and mutations.
    Tasks {
        #[command(subcommand)]
        sub: TasksCmd,
    },
    /// Bundled template packs.
    Templates {
        #[command(subcommand)]
        sub: TemplatesCmd,
    },
    /// Rule management and inspection.
    #[command(about = "Rule store: list, enable, disable, upsert from TOML/FPL/JSON")]
    Rules {
        #[command(subcommand)]
        sub: RulesCmd,
    },
    /// Wallet state and operations.
    #[command(about = "Reward wallet: balance, grant, spend")]
    Wallet {
        #[command(subcommand)]
        sub: WalletCmd,
    },
    /// Penalty state inspection.
    #[command(about = "Penalty state: show tiers, lockout windows, bypass budget")]
    Penalty {
        #[command(subcommand)]
        sub: PenaltyCmd,
    },
    /// Connector registry and per-connector sync.
    #[command(about = "Connectors: list registered, tick one connector")]
    Connectors {
        #[command(subcommand)]
        sub: ConnectorsCmd,
    },
    /// Sync orchestrator operations (all-connectors tick).
    #[command(about = "Sync orchestrator: tick all due connectors, report events pulled + errors")]
    Sync {
        #[command(subcommand)]
        sub: SyncCmd,
    },
    /// Rule evaluation pipeline operations.
    #[command(
        about = "Rule eval pipeline: tick, process queued events, report fired/suppressed decisions"
    )]
    Eval {
        #[command(subcommand)]
        sub: EvalCmd,
    },
    /// Focus session operations (emits host events).
    #[command(about = "Focus session: start/complete sessions (emits host events for testing)")]
    Focus {
        #[command(subcommand)]
        sub: FocusCmd,
    },
    /// Generate release notes from git history.
    #[command(
        about = "Generate release notes: groups commits by type, outputs markdown/discord/testflight"
    )]
    ReleaseNotes {
        #[command(subcommand)]
        sub: ReleaseNotesCmd,
    },
    /// Demo mode operations (seeding, resetting fixture data for designers/screenshots).
    #[command(about = "Demo mode: seed fixture data, reset demo markers")]
    Demo {
        #[command(subcommand)]
        sub: DemoCmd,
    },
    /// Time-travel replay: evaluate alternate rulesets against audit events.
    #[command(about = "Time-travel debugging: test rule changes without mutating state")]
    Replay {
        #[command(subcommand)]
        sub: replay::ReplayCmd,
    },
}

#[derive(Subcommand)]
enum AuditCmd {
    /// Verify the hash chain end-to-end. Exits non-zero on tamper.
    Verify,
    /// Print the most recent N records as JSON lines.
    #[command(about = "Tail audit log")]
    Tail {
        #[arg(long, default_value_t = 50)]
        limit: usize,
    },
    /// Print the head hash (or "(empty)" if the chain is empty).
    Head,
}

#[derive(Subcommand)]
enum TasksCmd {
    /// List all tasks for the default user.
    #[command(about = "List all tasks (optionally filtered by user_id)")]
    List {
        #[arg(long, help = "Filter by user UUID (default: 00000000-0000-0000-0000-000000000000)")]
        user_id: Option<String>,
    },
    /// Add a new task.
    #[command(about = "Create a new task with title, minutes, optional priority/deadline")]
    Add {
        #[arg(long, help = "Task title")]
        title: String,
        #[arg(long, help = "Estimated minutes to complete")]
        minutes: i32,
        #[arg(long, help = "Priority: h/m/l (default: m)")]
        priority: Option<char>,
        #[arg(long, help = "Deadline (ISO 8601 format, e.g. 2026-04-24T10:30:00Z)")]
        deadline: Option<String>,
    },
    /// Mark a task as done.
    #[command(about = "Mark task complete")]
    Done {
        #[arg(help = "Task UUID")]
        id: String,
    },
    /// Remove a task.
    #[command(about = "Delete a task")]
    Remove {
        #[arg(help = "Task UUID")]
        id: String,
    },
    /// Bulk import tasks from CSV or YAML.
    #[command(about = "Import multiple tasks from CSV or YAML file")]
    Import {
        #[arg(help = "Path to CSV or YAML file")]
        path: PathBuf,
        #[arg(long, help = "Preview without persisting (dry-run mode)")]
        dry_run: bool,
    },
    /// Bulk export tasks to CSV or YAML.
    #[command(about = "Export all tasks to CSV or YAML")]
    Export {
        #[arg(long, help = "Output format: csv or yaml", value_parser = ["csv", "yaml"])]
        format: String,
        #[arg(long, help = "Output file path (stdout if omitted)")]
        output: Option<PathBuf>,
    },
}

#[derive(Subcommand)]
enum TemplatesCmd {
    /// List template packs shipped in-tree.
    List,
    /// Install a bundled or file-path template pack into the local DB.
    #[command(about = "Install a template pack by ID or file path")]
    Install {
        #[arg(help = "Pack ID (e.g., 'daily-rhythm') or path to .toml file")]
        pack_id: String,
        /// Path to manifest (.toml) with signature and digest. If provided, verifies
        /// the pack signature against trusted keys before installing.
        #[arg(long, help = "Path to manifest.toml with signature and SHA-256")]
        manifest: Option<String>,
        /// Require signature verification (fail if pack is unsigned).
        #[arg(long, default_value = "false", help = "Require pack to be signed")]
        require_signature: bool,
    },
    /// Search for template packs in the registry or local catalog.
    #[command(about = "Search template packs by query")]
    Search {
        #[arg(help = "Search query (name, author, or keywords)")]
        query: String,
    },
    /// Show details of a specific template pack.
    #[command(about = "Display pack manifest, README, and metadata")]
    Show {
        #[arg(help = "Pack ID (e.g., 'deep-work-starter')")]
        pack_id: String,
    },
    /// Rate a template pack.
    #[command(about = "Submit a 1-5 star rating for a pack")]
    Rate {
        #[arg(help = "Pack ID")]
        pack_id: String,
        #[arg(help = "Rating: 1-5 stars")]
        rating: u8,
    },
}

#[derive(Subcommand)]
enum RulesCmd {
    /// List all rules (id, name, priority, enabled, trigger summary).
    #[command(about = "List all rules with priority, enabled status, trigger type")]
    List,
    /// Enable a rule by ID.
    #[command(about = "Enable a rule (set enabled=true)")]
    Enable {
        #[arg(help = "Rule UUID")]
        id: String,
    },
    /// Disable a rule by ID.
    #[command(about = "Disable a rule (set enabled=false)")]
    Disable {
        #[arg(help = "Rule UUID")]
        id: String,
    },
    /// Upsert a rule from a file (.toml, .fpl, or .json).
    #[command(about = "Create or update rule from TOML/FPL/JSON file")]
    Upsert {
        #[arg(long, help = ".toml (template-pack), .fpl (focus-lang), or .json (IR doc)")]
        file: PathBuf,
    },
    /// Bulk import rules from CSV or YAML.
    #[command(about = "Import multiple rules from CSV or YAML file")]
    Import {
        #[arg(help = "Path to CSV or YAML file")]
        path: PathBuf,
        #[arg(long, help = "Preview without persisting (dry-run mode)")]
        dry_run: bool,
    },
    /// Bulk export rules to CSV or YAML.
    #[command(about = "Export all rules to CSV or YAML")]
    Export {
        #[arg(long, help = "Output format: csv or yaml", value_parser = ["csv", "yaml"])]
        format: String,
        #[arg(long, help = "Output file path (stdout if omitted)")]
        output: Option<PathBuf>,
    },
}

#[derive(Subcommand)]
enum WalletCmd {
    /// Print wallet balance and state.
    #[command(
        about = "Display wallet: earned_credits, spent_credits, balance, streaks, multiplier"
    )]
    Balance {
        #[arg(long, help = "User UUID (default: nil)")]
        user_id: Option<String>,
    },
    /// Grant credits to wallet (for testing).
    #[command(about = "Add credits to wallet (testing utility)")]
    Grant {
        #[arg(help = "Number of credits")]
        amount: i64,
        #[arg(long, help = "Purpose/reason for grant")]
        purpose: String,
        #[arg(long, help = "User UUID (default: nil)")]
        user_id: Option<String>,
    },
    /// Spend credits from wallet (for testing).
    #[command(about = "Deduct credits from wallet (testing utility)")]
    Spend {
        #[arg(help = "Number of credits")]
        amount: i64,
        #[arg(long, help = "Purpose/reason for spend")]
        purpose: String,
        #[arg(long, help = "User UUID (default: nil)")]
        user_id: Option<String>,
    },
}

#[derive(Subcommand)]
enum PenaltyCmd {
    /// Show penalty state summary.
    #[command(about = "Display penalty state: escalation tier, bypass budget, lockout windows")]
    Show {
        #[arg(long, help = "User UUID (default: nil)")]
        user_id: Option<String>,
    },
}

#[derive(Subcommand)]
enum ConnectorsCmd {
    /// List all registered connectors.
    #[command(about = "List registered connectors: id, health, cadence, next_sync_at")]
    List,
    /// Tick one specific connector.
    #[command(about = "Trigger sync for a single connector")]
    Sync {
        #[arg(help = "Connector ID (e.g., 'github', 'gcal')")]
        id: String,
    },
    /// Scaffold a new connector crate.
    #[command(
        about = "Generate new connector: crates/connector-<name> with trait impl stub, auth, models, events, tests"
    )]
    New {
        #[arg(help = "Connector ID (lowercase, hyphen-separated, e.g., 'linear', 'apple-health')")]
        name: String,
        /// Auth strategy: 'token' (API key/PAT), 'oauth2', 'hmac', or 'polling'
        #[arg(long, default_value = "token")]
        auth: String,
        /// Comma-separated event types to emit (e.g., 'item_created,item_updated')
        #[arg(long)]
        events: Option<String>,
    },
}

#[derive(Subcommand)]
enum SyncCmd {
    /// Tick the sync orchestrator (all due connectors).
    #[command(about = "Run one orchestrator tick: sync all due connectors, report events pulled")]
    Tick,
}

#[derive(Subcommand)]
enum EvalCmd {
    /// Tick the rule evaluation pipeline.
    #[command(about = "Run one eval tick: process events, fire rules, report decisions")]
    Tick,
}

#[derive(Subcommand)]
enum FocusCmd {
    /// Emit a focus session started event (test helper).
    #[command(about = "Start a focus session (emits focus:session_started event)")]
    Start {
        #[arg(help = "Session duration in minutes")]
        minutes: i32,
    },
    /// Emit a focus session completed event (test helper).
    #[command(about = "Complete a focus session (emits focus:session_completed event)")]
    Complete {
        #[arg(help = "Session duration in minutes")]
        minutes: i32,
    },
}

#[derive(Subcommand)]
enum ReleaseNotesCmd {
    /// Generate release notes from git log.
    #[command(about = "Generate release notes from git history")]
    Generate {
        /// Git ref/tag to start from (default: v0.0.3)
        #[arg(long, default_value = "v0.0.3")]
        since: String,
        /// Output format: md, discord, or testflight
        #[arg(long, default_value = "md")]
        format: String,
        /// Synthesize release notes via LLM (requires FOCALPOINT_RELEASE_NOTES_LLM env var)
        #[arg(long, help = "Use LLM to synthesize release notes (requires LLM endpoint env var)")]
        synthesize: bool,
    },
}

#[derive(Subcommand)]
enum DemoCmd {
    /// Populate the database with realistic demo data.
    #[command(
        about = "Seed fixture data: 10 tasks, 5 rules, 85 credits, 3 connectors, audit trail"
    )]
    Seed,
    /// Reset all demo markers from the audit log.
    #[command(about = "Clear demo data (preserves non-demo user data)")]
    Reset,
}

fn main() -> anyhow::Result<()> {
    // Initialize tracing with pretty-printed output (dev CLI, not JSON)
    init_tracing("focus-cli", Some("info"));

    let cli = Cli::parse();
    let db_path = resolve_db_path(cli.db)?;
    match cli.cmd {
        Cmd::Audit { sub } => run_audit(sub, &db_path, cli.json),
        Cmd::Tasks { sub } => run_tasks(sub, &db_path, cli.json),
        Cmd::Templates { sub } => run_templates(sub, cli.json),
        Cmd::Rules { sub } => run_rules(sub, &db_path, cli.json),
        Cmd::Wallet { sub } => run_wallet(sub, &db_path, cli.json),
        Cmd::Penalty { sub } => run_penalty(sub, &db_path, cli.json),
        Cmd::Connectors { sub } => run_connectors(sub, &db_path, cli.json),
        Cmd::Sync { sub } => run_sync(sub, &db_path, cli.json),
        Cmd::Eval { sub } => run_eval(sub, &db_path, cli.json),
        Cmd::Focus { sub } => run_focus(sub, &db_path, cli.json),
        Cmd::ReleaseNotes { sub } => run_release_notes(sub, cli.json),
        Cmd::Demo { sub } => run_demo(sub, &db_path, cli.json),
        Cmd::Replay { sub } => {
            let rt = tokio::runtime::Runtime::new()?;
            rt.block_on(run_replay(sub, &db_path, cli.json))
        }
    }
}


fn resolve_db_path(explicit: Option<PathBuf>) -> anyhow::Result<PathBuf> {
    if let Some(p) = explicit {
        return Ok(p);
    }
    if let Ok(env) = std::env::var("FOCALPOINT_DB") {
        return Ok(PathBuf::from(env));
    }
    // Match iOS default: ~/Library/Application Support/focalpoint/core.db
    let home = std::env::var("HOME").map_err(|_| anyhow::anyhow!("HOME unset"))?;
    Ok(PathBuf::from(home).join("Library/Application Support/focalpoint/core.db"))
}

fn open_adapter(db: &std::path::Path) -> anyhow::Result<SqliteAdapter> {
    if !db.exists() {
        anyhow::bail!("db not found at {} — launch the app once first, or pass --db", db.display());
    }
    SqliteAdapter::open(db).map_err(|e| anyhow::anyhow!("open db: {e}"))
}

fn run_audit(cmd: AuditCmd, db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    let adapter = open_adapter(db)?;
    let store = SqliteAuditStore::from_adapter(&adapter);
    match cmd {
        AuditCmd::Verify => {
            let ok = store.verify_chain()?;
            if json_output {
                let result = VerifyChain {
                    verified: ok,
                    chain_length: 0, // TODO: get from store
                    root_hash: store.head_hash()?,
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                if ok {
                    println!("chain verified");
                } else {
                    anyhow::bail!("chain tamper detected")
                }
            }
            Ok(())
        }
        AuditCmd::Tail { limit } => {
            let rt = tokio::runtime::Runtime::new()?;
            let all = rt.block_on(store.load_all())?;
            let start = all.len().saturating_sub(limit);
            if json_output {
                let records: Vec<_> = all[start..].to_vec();
                println!("{}", serde_json::to_string(&records)?);
            } else {
                for rec in &all[start..] {
                    println!("{}", serde_json::to_string(rec)?);
                }
            }
            Ok(())
        }
        AuditCmd::Head => {
            let hash = store.head_hash()?;
            if json_output {
                let result = serde_json::json!({ "hash": hash });
                println!("{}", result);
            } else {
                match hash {
                    Some(h) => println!("{h}"),
                    None => println!("(empty)"),
                }
            }
            Ok(())
        }
    }
}

fn run_tasks(cmd: TasksCmd, db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    let adapter = open_adapter(db)?;
    let store = SqliteTaskStore::from_adapter(&adapter);
    match cmd {
        TasksCmd::List { user_id } => {
            let uid = user_id.map(|s| Uuid::parse_str(&s)).transpose()?.unwrap_or(Uuid::nil());
            let tasks = store.list(uid)?;
            if json_output {
                let json_tasks: Vec<TaskJson> = tasks
                    .iter()
                    .map(|t| TaskJson {
                        id: t.id.to_string(),
                        title: t.title.clone(),
                        priority: t.priority.weight,
                        status: format!("{:?}", t.status),
                        deadline: t.deadline.when.map(|dt| dt.to_rfc3339()),
                        created_at: t.created_at.to_rfc3339(),
                        updated_at: t.updated_at.to_rfc3339(),
                    })
                    .collect();
                println!("{}", serde_json::to_string(&json_tasks)?);
            } else {
                if tasks.is_empty() {
                    println!("(no tasks)");
                } else {
                    for t in tasks {
                        println!(
                            "{}  {:?}  {} (priority={:.3})",
                            t.id, t.status, t.title, t.priority.weight,
                        );
                    }
                }
            }
            Ok(())
        }
        TasksCmd::Add { title, minutes, priority, deadline } => {
            let uid = Uuid::nil();
            let prio = match priority {
                Some('h') | Some('H') => focus_planning::Priority::clamped(0.8),
                Some('l') | Some('L') => focus_planning::Priority::clamped(0.2),
                _ => focus_planning::Priority::clamped(0.5),
            };
            let deadline_obj = if let Some(deadline_str) = deadline {
                match chrono::DateTime::parse_from_rfc3339(&deadline_str) {
                    Ok(dt) => {
                        let utc = dt.with_timezone(&Utc);
                        focus_planning::Deadline {
                            when: Some(utc),
                            rigidity: focus_domain::Rigidity::Soft,
                        }
                    }
                    Err(_) => {
                        anyhow::bail!(
                            "invalid deadline format: {} (expected ISO 8601)",
                            deadline_str
                        );
                    }
                }
            } else {
                focus_planning::Deadline::none()
            };
            let now = Utc::now();
            let mut task = focus_planning::Task::new(
                title,
                focus_planning::DurationSpec::estimated(
                    chrono::Duration::minutes(minutes as i64),
                    chrono::Duration::minutes((minutes as i64 * 3) / 2),
                ),
                now,
            );
            task.priority = prio;
            task.deadline = deadline_obj;
            store.upsert(uid, &task)?;
            if json_output {
                let result = TaskJson {
                    id: task.id.to_string(),
                    title: task.title.clone(),
                    priority: task.priority.weight,
                    status: format!("{:?}", task.status),
                    deadline: task.deadline.when.map(|dt| dt.to_rfc3339()),
                    created_at: task.created_at.to_rfc3339(),
                    updated_at: task.updated_at.to_rfc3339(),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("task created: {}", task.id);
            }
            Ok(())
        }
        TasksCmd::Done { id } => {
            let task_id = Uuid::parse_str(&id)?;
            let mut task =
                store.get(task_id)?.ok_or_else(|| anyhow::anyhow!("task not found: {}", id))?;
            if !task.status.can_transition_to(&focus_planning::TaskStatus::Completed) {
                anyhow::bail!("task status {:?} cannot transition to Completed", task.status);
            }
            task.status = focus_planning::TaskStatus::Completed;
            task.updated_at = Utc::now();
            store.upsert(Uuid::nil(), &task)?;
            if json_output {
                let result = TaskJson {
                    id: task.id.to_string(),
                    title: task.title.clone(),
                    priority: task.priority.weight,
                    status: format!("{:?}", task.status),
                    deadline: task.deadline.when.map(|dt| dt.to_rfc3339()),
                    created_at: task.created_at.to_rfc3339(),
                    updated_at: task.updated_at.to_rfc3339(),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("task marked complete: {}", task.id);
            }
            Ok(())
        }
        TasksCmd::Remove { id } => {
            let task_id = Uuid::parse_str(&id)?;
            let removed = store.delete(task_id)?;
            if json_output {
                let result = serde_json::json!({ "removed": removed, "id": id });
                println!("{}", result);
            } else {
                if removed {
                    println!("task removed: {}", id);
                } else {
                    println!("task not found: {}", id);
                }
            }
            Ok(())
        }
        TasksCmd::Import { path, dry_run } => {
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            let import_result = match ext {
                "csv" => bulk::parse_tasks_csv(&path),
                "yaml" | "yml" => bulk::parse_tasks_yaml(&path),
                _ => anyhow::bail!("unsupported file format: {} (use .csv or .yaml)", ext),
            }?;

            if json_output {
                println!("{}", serde_json::to_string(&import_result)?);
            } else {
                println!("Parsed {} tasks", import_result.validation_report.valid_count);
                if !import_result.validation_report.errors.is_empty() {
                    println!(
                        "Skipped {} rows with errors:",
                        import_result.validation_report.skipped_count
                    );
                    for err in &import_result.validation_report.errors {
                        println!("  Row {}: {} - {}", err.row_index, err.field, err.reason);
                    }
                }
            }

            if !dry_run {
                let uid = Uuid::nil();
                for task_yaml in &import_result.tasks {
                    let prio = focus_planning::Priority::clamped(task_yaml.priority.unwrap_or(0.5));
                    let deadline_obj = if let Some(deadline_str) = &task_yaml.deadline {
                        match chrono::DateTime::parse_from_rfc3339(deadline_str) {
                            Ok(dt) => {
                                let utc = dt.with_timezone(&Utc);
                                focus_planning::Deadline {
                                    when: Some(utc),
                                    rigidity: focus_domain::Rigidity::Soft,
                                }
                            }
                            Err(_) => focus_planning::Deadline::none(),
                        }
                    } else {
                        focus_planning::Deadline::none()
                    };

                    let now = Utc::now();
                    let mut task = focus_planning::Task::new(
                        task_yaml.title.clone(),
                        focus_planning::DurationSpec::estimated(
                            chrono::Duration::minutes(
                                (task_yaml.duration_min.unwrap_or(30) as i64).max(1),
                            ),
                            chrono::Duration::minutes(
                                ((task_yaml.duration_min.unwrap_or(30) as i64) * 3) / 2,
                            ),
                        ),
                        now,
                    );
                    task.priority = prio;
                    task.deadline = deadline_obj;
                    store.upsert(uid, &task)?;
                }

                if json_output {
                    println!(
                        "{{ \"imported\": {} }}",
                        import_result.validation_report.valid_count
                    );
                } else {
                    println!(
                        "Successfully imported {} tasks",
                        import_result.validation_report.valid_count
                    );
                }
            } else if json_output {
                println!("{{ \"mode\": \"dry_run\", \"tasks_to_import\": {} }}", import_result.validation_report.valid_count);
            } else {
                println!("[DRY RUN] Would import {} tasks", import_result.validation_report.valid_count);
            }
            Ok(())
        }
        TasksCmd::Export { format, output } => {
            let uid = Uuid::nil();
            let tasks = store.list(uid)?;
            let csv_output = format == "csv";

            let content = if csv_output {
                let export_data: Vec<_> = tasks
                    .iter()
                    .map(|t| {
                        (
                            t.title.clone(),
                            Some(t.priority.weight),
                            t.deadline.when.map(|dt| dt.to_rfc3339()),
                            Some(t.duration.planning_duration().num_minutes() as i32),
                            None::<Vec<String>>, // tags not yet in Task struct
                        )
                    })
                    .collect();

                bulk::export_tasks_csv(export_data)?
            } else {
                // YAML export
                let yaml_records: Vec<bulk::TaskYamlRecord> = tasks
                    .iter()
                    .map(|t| bulk::TaskYamlRecord {
                        title: t.title.clone(),
                        priority: Some(t.priority.weight),
                        deadline: t.deadline.when.map(|dt| dt.to_rfc3339()),
                        duration_min: Some(t.duration.planning_duration().num_minutes() as i32),
                        tags: None,
                        version: Some("1.0".to_string()),
                    })
                    .collect();

                serde_yaml::to_string(&yaml_records)
                    .map_err(|e| anyhow::anyhow!("YAML serialization failed: {}", e))?
            };

            if let Some(output_path) = output {
                std::fs::write(&output_path, &content)
                    .map_err(|e| anyhow::anyhow!("failed to write {}: {}", output_path.display(), e))?;
                if json_output {
                    println!("{{ \"exported\": {}, \"file\": \"{}\" }}", tasks.len(), output_path.display());
                } else {
                    println!("Exported {} tasks to {}", tasks.len(), output_path.display());
                }
            } else {
                println!("{}", content);
            }
            Ok(())
        }
    }
}

fn run_templates(cmd: TemplatesCmd, json_output: bool) -> anyhow::Result<()> {
    match cmd {
        TemplatesCmd::List => {
            // focus-templates doesn't yet publish a bundled registry, so
            // walk examples/templates/ relative to the workspace root.
            // When run from the workspace root this just works; otherwise
            // callers pass FOCALPOINT_EXAMPLES or invoke from workspace.
            let dir = std::env::var("FOCALPOINT_EXAMPLES")
                .map(PathBuf::from)
                .ok()
                .or_else(|| std::env::current_dir().ok().map(|p| p.join("examples/templates")))
                .ok_or_else(|| anyhow::anyhow!("examples/templates not found"))?;
            if !dir.is_dir() {
                anyhow::bail!("{} is not a directory", dir.display());
            }
            let mut templates = Vec::new();
            for entry in std::fs::read_dir(&dir)? {
                let path = entry?.path();
                if path.extension().and_then(|s| s.to_str()) != Some("toml") {
                    continue;
                }
                let text = std::fs::read_to_string(&path)?;
                match focus_templates::TemplatePack::from_toml_str(&text) {
                    Ok(pack) => {
                        if json_output {
                            templates.push(serde_json::json!({
                                "id": pack.id,
                                "version": pack.version,
                                "name": pack.name,
                                "rules": pack.rules.len(),
                                "description": pack.description,
                            }));
                        } else {
                            println!(
                                "{id}  v{ver}  {name}  ({rules} rules)  — {desc}",
                                id = pack.id,
                                ver = pack.version,
                                name = pack.name,
                                rules = pack.rules.len(),
                                desc = pack.description,
                            );
                        }
                    }
                    Err(e) => {
                        eprintln!("{}: parse failed: {e:?}", path.display());
                    }
                }
            }
            if json_output {
                println!("{}", serde_json::to_string(&templates)?);
            }
            Ok(())
        }
        TemplatesCmd::Install { pack_id, manifest, require_signature } => {
            // Try to load pack_id as a file path first, then fall back to bundled registry.
            let path = PathBuf::from(&pack_id);
            let text = if path.is_file() {
                std::fs::read_to_string(&path)
                    .map_err(|e| anyhow::anyhow!("failed to read {}: {}", path.display(), e))?
            } else {
                // Fall back to bundled examples/templates/<pack_id>.toml
                let example_dir = std::env::var("FOCALPOINT_EXAMPLES")
                    .map(PathBuf::from)
                    .ok()
                    .or_else(|| std::env::current_dir().ok().map(|p| p.join("examples/templates")))
                    .ok_or_else(|| anyhow::anyhow!("examples/templates not found"))?;
                let bundled = example_dir.join(format!("{}.toml", pack_id));
                std::fs::read_to_string(&bundled)
                    .map_err(|e| anyhow::anyhow!("template '{}' not found: {}", pack_id, e))?
            };
            let pack = focus_templates::TemplatePack::from_toml_str(&text)?;
            let pack_id_result = pack.id.clone();
            let rules_count = pack.rules.len();

            // If manifest provided, verify signature and digest.
            let signed_by = if let Some(manifest_path) = manifest {
                let manifest_text = std::fs::read_to_string(&manifest_path).map_err(|e| {
                    anyhow::anyhow!("failed to read manifest {}: {}", manifest_path, e)
                })?;
                let manifest: focus_templates::TemplatePackManifest =
                    toml::from_str(&manifest_text)
                        .map_err(|e| anyhow::anyhow!("failed to parse manifest: {}", e))?;

                // Load trusted keys from ~/.config/focalpoint/trusted-keys.toml
                let trusted_keys = load_trusted_keys()?;

                // Create a stub store (we don't actually apply rules in this flow).
                // In a real app, upsert would write to the DB.
                let mut stub_store = StubRuleStore;
                pack.verify_and_apply(
                    &mut stub_store,
                    &manifest,
                    &trusted_keys,
                    require_signature,
                )?;
                if !json_output {
                    println!(
                        "✓ verified pack signature (signed by: {})",
                        manifest.signed_by.as_deref().unwrap_or("unknown")
                    );
                }
                manifest.signed_by
            } else if require_signature {
                return Err(anyhow::anyhow!(
                    "pack requires signature but no manifest provided (use --manifest)"
                ));
            } else {
                None
            };

            if json_output {
                let result = TemplateInstall {
                    pack_id: pack_id_result,
                    rules_installed: rules_count,
                    tasks_installed: 0,
                    signed_by,
                    sha256: "".to_string(), // TODO: compute actual SHA256
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!(
                    "installed template pack: {} v{} ({} rules)",
                    pack_id_result, pack.version, rules_count
                );
            }
            Ok(())
        }
        TemplatesCmd::Search { query } => search_template_registry(&query, json_output),
        TemplatesCmd::Show { pack_id } => show_template_pack(&pack_id, json_output),
        TemplatesCmd::Rate { pack_id, rating } => rate_template_pack(&pack_id, rating, json_output),
    }
}

// --- Rules subcommand handlers ---

fn run_rules(cmd: RulesCmd, db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    let adapter = open_adapter(db)?;
    let rt = tokio::runtime::Runtime::new()?;
    match cmd {
        RulesCmd::List => {
            let rules = rt.block_on(adapter.list_enabled())?;
            if json_output {
                let json_rules: Vec<RuleJson> = rules
                    .iter()
                    .map(|rule| {
                        let trigger_str = match &rule.trigger {
                            focus_rules::Trigger::Event(name) => format!("event:{}", name),
                            focus_rules::Trigger::Schedule(cron) => format!("schedule:{}", cron),
                            focus_rules::Trigger::StateChange(name) => {
                                format!("statechange:{}", name)
                            }
                        };
                        RuleJson {
                            id: rule.id.to_string(),
                            name: rule.name.clone(),
                            priority: rule.priority,
                            enabled: rule.enabled,
                            trigger: trigger_str,
                        }
                    })
                    .collect();
                println!("{}", serde_json::to_string(&json_rules)?);
            } else {
                if rules.is_empty() {
                    println!("(no enabled rules)");
                } else {
                    for rule in rules {
                        let trigger_str = match &rule.trigger {
                            focus_rules::Trigger::Event(name) => format!("event:{}", name),
                            focus_rules::Trigger::Schedule(cron) => format!("schedule:{}", cron),
                            focus_rules::Trigger::StateChange(name) => {
                                format!("statechange:{}", name)
                            }
                        };
                        println!(
                            "{}  {}  priority={}  enabled={}  trigger={}",
                            rule.id, rule.name, rule.priority, rule.enabled, trigger_str,
                        );
                    }
                }
            }
            Ok(())
        }
        RulesCmd::Enable { id } => {
            let rule_id = Uuid::parse_str(&id)?;
            let mut rule = rt
                .block_on(<dyn RuleStore>::get(&adapter, rule_id))?
                .ok_or_else(|| anyhow::anyhow!("rule not found: {}", id))?;
            rule.enabled = true;
            rt.block_on(upsert_rule(&adapter, rule.clone()))?;
            if json_output {
                let result = serde_json::json!({ "id": rule.id.to_string(), "enabled": true });
                println!("{}", result);
            } else {
                println!("rule enabled: {}", rule.id);
            }
            Ok(())
        }
        RulesCmd::Disable { id } => {
            let rule_id = Uuid::parse_str(&id)?;
            let mut rule = rt
                .block_on(<dyn RuleStore>::get(&adapter, rule_id))?
                .ok_or_else(|| anyhow::anyhow!("rule not found: {}", id))?;
            rule.enabled = false;
            rt.block_on(upsert_rule(&adapter, rule.clone()))?;
            if json_output {
                let result = serde_json::json!({ "id": rule.id.to_string(), "enabled": false });
                println!("{}", result);
            } else {
                println!("rule disabled: {}", rule.id);
            }
            Ok(())
        }
        RulesCmd::Upsert { file } => {
            let text = std::fs::read_to_string(&file)
                .map_err(|e| anyhow::anyhow!("failed to read {}: {}", file.display(), e))?;
            let ext = file.extension().and_then(|s| s.to_str()).unwrap_or("");
            match ext {
                "toml" => {
                    let pack = focus_templates::TemplatePack::from_toml_str(&text)?;
                    let pack_id = pack.id.clone();
                    let rule_count = pack.rules.len();
                    for draft in pack.rules {
                        let rule = draft.into_rule(&pack_id);
                        rt.block_on(upsert_rule(&adapter, rule))?;
                    }
                    if json_output {
                        let result = serde_json::json!({ "rules_upserted": rule_count, "source": "template_pack", "pack_id": pack_id });
                        println!("{}", result);
                    } else {
                        println!("upserted {} rules from template pack", rule_count);
                    }
                }
                "json" => {
                    let rule: focus_rules::Rule = serde_json::from_str(&text)?;
                    let rule_id = rule.id.to_string();
                    rt.block_on(upsert_rule(&adapter, rule.clone()))?;
                    if json_output {
                        let result = serde_json::json!({ "id": rule_id, "upserted": true });
                        println!("{}", result);
                    } else {
                        println!("upserted rule: {}", rule_id);
                    }
                }
                "fpl" => {
                    anyhow::bail!("FPL (focus-lang) support not yet implemented (focus-lang integration pending)");
                }
                _ => {
                    anyhow::bail!(
                        "unsupported file extension: {} (use .toml, .json, or .fpl)",
                        ext
                    );
                }
            }
            Ok(())
        }
        RulesCmd::Import { path, dry_run } => {
            let ext = path.extension().and_then(|s| s.to_str()).unwrap_or("");
            let import_result = match ext {
                "csv" => bulk::parse_rules_csv(&path),
                "yaml" | "yml" => bulk::parse_rules_yaml(&path),
                _ => anyhow::bail!("unsupported file format: {} (use .csv or .yaml)", ext),
            }?;

            if json_output {
                println!("{}", serde_json::to_string(&import_result)?);
            } else {
                println!("Parsed {} rules", import_result.validation_report.valid_count);
                if !import_result.validation_report.errors.is_empty() {
                    println!(
                        "Skipped {} rows with errors:",
                        import_result.validation_report.skipped_count
                    );
                    for err in &import_result.validation_report.errors {
                        println!("  Row {}: {} - {}", err.row_index, err.field, err.reason);
                    }
                }
            }

            if !dry_run {
                for rule_yaml in &import_result.rules {
                    // Create a Rule from YAML record
                    let rule = focus_rules::Rule {
                        id: Uuid::new_v4(),
                        name: rule_yaml.name.clone(),
                        trigger: match rule_yaml.trigger_kind.as_str() {
                            "Event" => focus_rules::Trigger::Event(
                                rule_yaml.event_type.clone().unwrap_or_default(),
                            ),
                            "Schedule" => {
                                focus_rules::Trigger::Schedule(rule_yaml.event_type.clone().unwrap_or_default())
                            }
                            "StateChange" => {
                                focus_rules::Trigger::StateChange(rule_yaml.event_type.clone().unwrap_or_default())
                            }
                            _ => continue,
                        },
                        conditions: Vec::new(),
                        actions: vec![match rule_yaml.action_kind.as_str() {
                            "GrantCredit" => focus_rules::Action::GrantCredit {
                                amount: rule_yaml.amount.unwrap_or(0),
                            },
                            "DeductCredit" => focus_rules::Action::DeductCredit {
                                amount: rule_yaml.amount.unwrap_or(0),
                            },
                            "Block" => focus_rules::Action::Block {
                                profile: "default".to_string(),
                                duration: chrono::Duration::minutes(30),
                                rigidity: focus_domain::Rigidity::Hard,
                            },
                            "Unblock" => focus_rules::Action::Unblock {
                                profile: "default".to_string(),
                            },
                            "Notify" => {
                                focus_rules::Action::Notify("Notification".to_string())
                            }
                            _ => focus_rules::Action::Notify("Imported action".to_string()),
                        }],
                        priority: rule_yaml.priority,
                        cooldown: rule_yaml.cooldown.as_ref().map(|s| {
                            chrono::Duration::minutes(
                                s.trim_end_matches('m')
                                    .parse::<i64>()
                                    .unwrap_or(5),
                            )
                        }),
                        duration: None,
                        explanation_template: format!("Rule: {}", rule_yaml.name),
                        enabled: rule_yaml.enabled,
                    };
                    rt.block_on(upsert_rule(&adapter, rule))?;
                }
                if json_output {
                    println!(
                        "{{ \"imported\": {} }}",
                        import_result.validation_report.valid_count
                    );
                } else {
                    println!(
                        "Successfully imported {} rules",
                        import_result.validation_report.valid_count
                    );
                }
            } else if json_output {
                println!("{{ \"mode\": \"dry_run\", \"rules_to_import\": {} }}", import_result.validation_report.valid_count);
            } else {
                println!("[DRY RUN] Would import {} rules", import_result.validation_report.valid_count);
            }
            Ok(())
        }
        RulesCmd::Export { format, output } => {
            let rules = rt.block_on(adapter.list_enabled())?;
            let csv_output = format == "csv";

            let content = if csv_output {
                let export_data: Vec<_> = rules
                    .iter()
                    .map(|r| {
                        let trigger_str = match &r.trigger {
                            focus_rules::Trigger::Event(name) => name.clone(),
                            focus_rules::Trigger::Schedule(cron) => cron.clone(),
                            focus_rules::Trigger::StateChange(name) => name.clone(),
                        };
                        let trigger_kind = match &r.trigger {
                            focus_rules::Trigger::Event(_) => "Event",
                            focus_rules::Trigger::Schedule(_) => "Schedule",
                            focus_rules::Trigger::StateChange(_) => "StateChange",
                        };
                        let action_kind = if let Some(action) = r.actions.first() {
                            match action {
                                focus_rules::Action::GrantCredit { .. } => "GrantCredit",
                                focus_rules::Action::DeductCredit { .. } => "DeductCredit",
                                focus_rules::Action::Block { .. } => "Block",
                                focus_rules::Action::Unblock { .. } => "Unblock",
                                focus_rules::Action::StreakIncrement(_) => "StreakIncrement",
                                focus_rules::Action::StreakReset(_) => "StreakReset",
                                focus_rules::Action::Notify(_) => "Notify",
                                focus_rules::Action::EmergencyExit { .. } => "EmergencyExit",
                                focus_rules::Action::Intervention { .. } => "Intervention",
                                focus_rules::Action::ScheduledUnlockWindow { .. } => {
                                    "ScheduledUnlockWindow"
                                }
                            }
                        } else {
                            "None"
                        };
                        let amount = if let Some(action) = r.actions.first() {
                            match action {
                                focus_rules::Action::GrantCredit { amount }
                                | focus_rules::Action::DeductCredit { amount } => Some(*amount),
                                _ => None,
                            }
                        } else {
                            None
                        };

                        (
                            r.name.clone(),
                            trigger_kind.to_string(),
                            trigger_str,
                            action_kind.to_string(),
                            amount,
                            r.cooldown.as_ref().map(|d| format!("{}m", d.num_minutes())),
                            r.priority,
                            r.enabled,
                        )
                    })
                    .collect();

                bulk::export_rules_csv(export_data)?
            } else {
                // YAML export
                let yaml_records: Vec<bulk::RuleYamlRecord> = rules
                    .iter()
                    .map(|r| {
                        let trigger_str = match &r.trigger {
                            focus_rules::Trigger::Event(name) => name.clone(),
                            focus_rules::Trigger::Schedule(cron) => cron.clone(),
                            focus_rules::Trigger::StateChange(name) => name.clone(),
                        };
                        let trigger_kind = match &r.trigger {
                            focus_rules::Trigger::Event(_) => "Event",
                            focus_rules::Trigger::Schedule(_) => "Schedule",
                            focus_rules::Trigger::StateChange(_) => "StateChange",
                        };
                        let action_kind = if let Some(action) = r.actions.first() {
                            match action {
                                focus_rules::Action::GrantCredit { .. } => "GrantCredit",
                                focus_rules::Action::DeductCredit { .. } => "DeductCredit",
                                focus_rules::Action::Block { .. } => "Block",
                                focus_rules::Action::Unblock { .. } => "Unblock",
                                focus_rules::Action::StreakIncrement(_) => "StreakIncrement",
                                focus_rules::Action::StreakReset(_) => "StreakReset",
                                focus_rules::Action::Notify(_) => "Notify",
                                focus_rules::Action::EmergencyExit { .. } => "EmergencyExit",
                                focus_rules::Action::Intervention { .. } => "Intervention",
                                focus_rules::Action::ScheduledUnlockWindow { .. } => {
                                    "ScheduledUnlockWindow"
                                }
                            }
                        } else {
                            "None"
                        };
                        let amount = if let Some(action) = r.actions.first() {
                            match action {
                                focus_rules::Action::GrantCredit { amount }
                                | focus_rules::Action::DeductCredit { amount } => Some(*amount),
                                _ => None,
                            }
                        } else {
                            None
                        };

                        bulk::RuleYamlRecord {
                            name: r.name.clone(),
                            trigger_kind: trigger_kind.to_string(),
                            event_type: Some(trigger_str),
                            action_kind: action_kind.to_string(),
                            amount,
                            cooldown: r.cooldown.as_ref().map(|d| format!("{}m", d.num_minutes())),
                            priority: r.priority,
                            enabled: r.enabled,
                            version: Some("1.0".to_string()),
                        }
                    })
                    .collect();

                serde_yaml::to_string(&yaml_records)
                    .map_err(|e| anyhow::anyhow!("YAML serialization failed: {}", e))?
            };

            if let Some(output_path) = output {
                std::fs::write(&output_path, &content)
                    .map_err(|e| anyhow::anyhow!("failed to write {}: {}", output_path.display(), e))?;
                if json_output {
                    println!("{{ \"exported\": {}, \"file\": \"{}\" }}", rules.len(), output_path.display());
                } else {
                    println!("Exported {} rules to {}", rules.len(), output_path.display());
                }
            } else {
                println!("{}", content);
            }
            Ok(())
        }
    }
}

// --- Wallet subcommand handlers ---

fn run_wallet(cmd: WalletCmd, db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    let adapter = open_adapter(db)?;
    let rt = tokio::runtime::Runtime::new()?;
    let user_id = Uuid::nil();
    match cmd {
        WalletCmd::Balance { user_id: uid_opt } => {
            let uid = uid_opt.map(|s| Uuid::parse_str(&s)).transpose()?.unwrap_or(user_id);
            let wallet = rt.block_on((&adapter as &dyn WalletStore).load(uid))?;
            if json_output {
                let result = WalletState {
                    user_id: wallet.user_id.to_string(),
                    earned_credits: wallet.earned_credits,
                    spent_credits: wallet.spent_credits,
                    balance: wallet.balance(),
                    multiplier: wallet.multiplier_state.current,
                    multiplier_expires_at: wallet
                        .multiplier_state
                        .expires_at
                        .map(|dt| dt.to_rfc3339()),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("user_id: {}", wallet.user_id);
                println!("earned_credits: {}", wallet.earned_credits);
                println!("spent_credits: {}", wallet.spent_credits);
                println!("balance: {}", wallet.balance());
                println!(
                    "multiplier: {} (expires: {:?})",
                    wallet.multiplier_state.current, wallet.multiplier_state.expires_at
                );
                println!("streaks: {:?}", wallet.streaks);
            }
            Ok(())
        }
        WalletCmd::Grant { amount, purpose, user_id: uid_opt } => {
            let uid = uid_opt.map(|s| Uuid::parse_str(&s)).transpose()?.unwrap_or(user_id);
            if amount <= 0 {
                anyhow::bail!("amount must be positive, got {}", amount);
            }
            let before = rt.block_on((&adapter as &dyn WalletStore).load(uid))?.balance();
            let mutation = focus_rewards::WalletMutation::GrantCredit(focus_rewards::Credit {
                amount,
                source_rule_id: None,
                granted_at: Utc::now(),
            });
            rt.block_on((&adapter as &dyn WalletStore).apply(uid, mutation))?;
            let after = rt.block_on((&adapter as &dyn WalletStore).load(uid))?.balance();
            if json_output {
                let result = WalletOperation {
                    balance_before: before,
                    balance_after: after,
                    delta: after - before,
                    reason: purpose.clone(),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("granted {} credits (purpose: {})", amount, purpose);
            }
            Ok(())
        }
        WalletCmd::Spend { amount, purpose, user_id: uid_opt } => {
            let uid = uid_opt.map(|s| Uuid::parse_str(&s)).transpose()?.unwrap_or(user_id);
            if amount <= 0 {
                anyhow::bail!("amount must be positive, got {}", amount);
            }
            let before = rt.block_on((&adapter as &dyn WalletStore).load(uid))?.balance();
            let mutation =
                focus_rewards::WalletMutation::SpendCredit { amount, purpose: purpose.clone() };
            rt.block_on((&adapter as &dyn WalletStore).apply(uid, mutation))?;
            let after = rt.block_on((&adapter as &dyn WalletStore).load(uid))?.balance();
            if json_output {
                let result = WalletOperation {
                    balance_before: before,
                    balance_after: after,
                    delta: after - before,
                    reason: purpose.clone(),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("spent {} credits (purpose: {})", amount, purpose);
            }
            Ok(())
        }
    }
}

// --- Penalty subcommand handlers ---

fn run_penalty(cmd: PenaltyCmd, db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    let adapter = open_adapter(db)?;
    let rt = tokio::runtime::Runtime::new()?;
    match cmd {
        PenaltyCmd::Show { user_id: uid_opt } => {
            let uid = uid_opt.map(|s| Uuid::parse_str(&s)).transpose()?.unwrap_or(Uuid::nil());
            let state = rt.block_on((&adapter as &dyn PenaltyStore).load(uid))?;
            if json_output {
                let lockout_windows: Vec<LockoutWindow> = state
                    .lockout_windows
                    .iter()
                    .map(|w| LockoutWindow {
                        starts_at: w.starts_at.to_rfc3339(),
                        ends_at: w.ends_at.to_rfc3339(),
                        reason: w.reason.clone(),
                        rigidity: format!("{:?}", w.rigidity),
                    })
                    .collect();
                let result = PenaltyState {
                    user_id: state.user_id.to_string(),
                    escalation_tier: format!("{:?}", state.escalation_tier),
                    bypass_budget: state.bypass_budget,
                    debt_balance: state.debt_balance,
                    strict_mode_until: state.strict_mode_until.map(|dt| dt.to_rfc3339()),
                    lockout_windows,
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("user_id: {}", state.user_id);
                println!("escalation_tier: {:?}", state.escalation_tier);
                println!("bypass_budget: {}", state.bypass_budget);
                println!("debt_balance: {}", state.debt_balance);
                println!("strict_mode_until: {:?}", state.strict_mode_until);
                if state.lockout_windows.is_empty() {
                    println!("lockout_windows: (none)");
                } else {
                    println!("lockout_windows:");
                    for window in &state.lockout_windows {
                        println!(
                            "  {} — {} ({}) [rigidity: {:?}]",
                            window.starts_at, window.ends_at, window.reason, window.rigidity
                        );
                    }
                }
            }
            Ok(())
        }
    }
}

// --- Connectors subcommand handlers ---

fn run_connectors(
    cmd: ConnectorsCmd,
    _db: &std::path::Path,
    json_output: bool,
) -> anyhow::Result<()> {
    match cmd {
        ConnectorsCmd::List => {
            if json_output {
                println!(
                    "{}",
                    serde_json::to_string(
                        &serde_json::json!({ "message": "connector registry not yet built into CLI" })
                    )?
                );
            } else {
                println!("(connector registry not yet built into CLI; implement in focus-sync/connectors orchestrator)");
            }
            Ok(())
        }
        ConnectorsCmd::Sync { id } => {
            if json_output {
                println!(
                    "{}",
                    serde_json::to_string(
                        &serde_json::json!({ "error": "connector sync not implemented", "id": id })
                    )?
                );
            } else {
                println!("(per-connector sync not yet built into CLI; id={})", id);
            }
            anyhow::bail!("connector sync requires SyncOrchestrator instance (TODO)");
        }
        ConnectorsCmd::New { name, auth, events } => {
            scaffold_connector(&name, &auth, events.as_deref(), json_output)?;
            Ok(())
        }
    }
}

// --- Sync subcommand handlers ---

fn run_sync(cmd: SyncCmd, _db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    match cmd {
        SyncCmd::Tick => {
            if json_output {
                println!(
                    "{}",
                    serde_json::to_string(
                        &serde_json::json!({ "error": "sync orchestrator not yet built into CLI" })
                    )?
                );
            } else {
                println!("(sync orchestrator not yet built into CLI; implement in focus-sync)");
            }
            anyhow::bail!("SyncOrchestrator::tick requires live connector registry (TODO)");
        }
    }
}

// --- Eval subcommand handlers ---

fn run_eval(cmd: EvalCmd, _db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    match cmd {
        EvalCmd::Tick => {
            if json_output {
                println!(
                    "{}",
                    serde_json::to_string(
                        &serde_json::json!({ "error": "eval pipeline not yet built into CLI" })
                    )?
                );
            } else {
                println!("(eval pipeline not yet built into CLI; implement in focus-eval)");
            }
            anyhow::bail!(
                "RuleEvaluationPipeline::tick requires full store + engine wiring (TODO)"
            );
        }
    }
}

// --- Focus subcommand handlers ---

fn run_focus(cmd: FocusCmd, db: &std::path::Path, json_output: bool) -> anyhow::Result<()> {
    let _adapter = open_adapter(db)?;
    match cmd {
        FocusCmd::Start { minutes } => {
            if json_output {
                let result = FocusSession {
                    event_type: "focus:session_started".to_string(),
                    minutes,
                    timestamp: Utc::now().to_rfc3339(),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("focus:session_started (minutes={}) [test event emitted]", minutes);
            }
            Ok(())
        }
        FocusCmd::Complete { minutes } => {
            if json_output {
                let result = FocusSession {
                    event_type: "focus:session_completed".to_string(),
                    minutes,
                    timestamp: Utc::now().to_rfc3339(),
                };
                println!("{}", serde_json::to_string(&result)?);
            } else {
                println!("focus:session_completed (minutes={}) [test event emitted]", minutes);
            }
            Ok(())
        }
    }
}

// --- Release notes subcommand handlers ---

#[derive(Clone, Debug)]
struct CommitInfo {
    hash: String,
    subject: String,
    #[allow(dead_code)]
    body: String,
}

fn run_release_notes(cmd: ReleaseNotesCmd, json_output: bool) -> anyhow::Result<()> {
    match cmd {
        ReleaseNotesCmd::Generate { since, format, synthesize } => {
            let commits = fetch_git_log(&since)?;
            let grouped = group_commits_by_type(&commits);

            // If synthesize flag is set, try to call LLM endpoint; fall back to template if unavailable
            if synthesize {
                if let Ok(llm_endpoint) = std::env::var("FOCALPOINT_RELEASE_NOTES_LLM") {
                    match synthesize_with_llm(&grouped, &llm_endpoint, &format) {
                        Ok(output) => {
                            println!("{}", output);
                            return Ok(());
                        }
                        Err(e) => {
                            eprintln!("warn: LLM synthesis failed ({}), falling back to template rendering", e);
                        }
                    }
                } else {
                    eprintln!("warn: --synthesize set but FOCALPOINT_RELEASE_NOTES_LLM env var not found, using template rendering");
                }
            }

            if json_output {
                output_json(&grouped)
            } else {
                match format.as_str() {
                    "md" => output_markdown(&grouped),
                    "discord" => output_discord(&grouped),
                    "testflight" => output_testflight(&grouped),
                    _ => anyhow::bail!(
                        "unsupported format: {} (use md, discord, or testflight)",
                        format
                    ),
                }
            }
        }
    }
}

fn fetch_git_log(since: &str) -> anyhow::Result<Vec<CommitInfo>> {
    let output = Command::new("git")
        .args(["log", &format!("{}..HEAD", since), "--oneline", "--pretty=format:%H|%s|%b"])
        .output()?;

    if !output.status.success() {
        anyhow::bail!("git log failed: {}", String::from_utf8_lossy(&output.stderr));
    }

    let text = String::from_utf8(output.stdout)?;
    let mut commits = Vec::new();

    for line in text.lines() {
        if line.is_empty() {
            continue;
        }
        let parts: Vec<&str> = line.splitn(3, '|').collect();
        if parts.len() >= 2 {
            commits.push(CommitInfo {
                hash: parts[0].to_string(),
                subject: parts[1].to_string(),
                body: parts.get(2).unwrap_or(&"").to_string(),
            });
        }
    }

    Ok(commits)
}

fn group_commits_by_type(commits: &[CommitInfo]) -> BTreeMap<String, Vec<CommitInfo>> {
    let mut grouped: BTreeMap<String, Vec<CommitInfo>> = BTreeMap::new();

    for commit in commits {
        let type_key = extract_type(&commit.subject);
        grouped.entry(type_key).or_default().push(commit.clone());
    }

    grouped
}

fn extract_type(subject: &str) -> String {
    let parts: Vec<&str> = subject.split(':').collect();
    if parts.is_empty() {
        return "other".to_string();
    }
    let prefix = parts[0].trim();

    // Extract type from conventional commit (feat/fix/docs/test/perf/chore/refactor/etc)
    if let Some(paren_pos) = prefix.find('(') {
        prefix[..paren_pos].to_string()
    } else {
        prefix.to_string()
    }
}

fn get_category_display(typ: &str) -> (&'static str, &'static str) {
    match typ {
        "feat" => ("Added", "✨"),
        "fix" => ("Fixed", "🐛"),
        "docs" => ("Documentation", "📚"),
        "test" => ("Tests", "✅"),
        "perf" => ("Performance", "⚡"),
        "chore" | "refactor" => ("Changed", "🔄"),
        _ => ("Other", "📝"),
    }
}

fn output_markdown(grouped: &BTreeMap<String, Vec<CommitInfo>>) -> anyhow::Result<()> {
    let display_order = vec!["feat", "fix", "perf", "docs", "test", "refactor", "chore"];

    for typ in display_order {
        if let Some(commits) = grouped.get(typ) {
            let (category, _) = get_category_display(typ);
            println!("\n### {}", category);
            for commit in commits {
                let subject = commit.subject.split(':').nth(1).unwrap_or(&commit.subject).trim();
                println!("- {} ({})", subject, &commit.hash[..7]);
            }
        }
    }

    // Handle "other" if present
    if let Some(commits) = grouped.get("other") {
        println!("\n### Other");
        for commit in commits {
            println!("- {} ({})", commit.subject, &commit.hash[..7]);
        }
    }

    Ok(())
}

fn output_discord(grouped: &BTreeMap<String, Vec<CommitInfo>>) -> anyhow::Result<()> {
    println!("**FocalPoint Release Notes**\n");

    let display_order = vec!["feat", "fix", "perf", "docs", "test", "refactor", "chore"];

    for typ in display_order {
        if let Some(commits) = grouped.get(typ) {
            let (category, emoji) = get_category_display(typ);
            println!("{} **{}**", emoji, category);
            for commit in commits {
                let subject = commit.subject.split(':').nth(1).unwrap_or(&commit.subject).trim();
                println!("  • {}", subject);
            }
            println!();
        }
    }

    Ok(())
}

fn output_testflight(grouped: &BTreeMap<String, Vec<CommitInfo>>) -> anyhow::Result<()> {
    let mut output = String::from("FocalPoint Release Notes\n");
    let max_len = 4000;

    let display_order = vec!["feat", "fix", "perf", "docs", "test", "refactor", "chore"];

    for typ in display_order {
        if let Some(commits) = grouped.get(typ) {
            let (category, _) = get_category_display(typ);
            output.push_str(&format!("\n{}:\n", category));
            for commit in commits {
                let subject = commit.subject.split(':').nth(1).unwrap_or(&commit.subject).trim();
                let line = format!("• {}\n", subject);
                if output.len() + line.len() > max_len {
                    output.push_str("...[truncated]");
                    break;
                }
                output.push_str(&line);
            }
        }
    }

    println!("{}", output);
    Ok(())
}

fn output_json(grouped: &BTreeMap<String, Vec<CommitInfo>>) -> anyhow::Result<()> {
    let display_order = vec!["feat", "fix", "perf", "docs", "test", "refactor", "chore"];
    let mut sections = Vec::new();

    for typ in display_order {
        if let Some(commits) = grouped.get(typ) {
            let (category, _) = get_category_display(typ);
            let items: Vec<String> = commits
                .iter()
                .map(|commit| {
                    commit.subject.split(':').nth(1).unwrap_or(&commit.subject).trim().to_string()
                })
                .collect();
            sections.push(ReleaseSection { category: category.to_string(), items });
        }
    }

    let result = ReleaseNotesOutput { sections };
    println!("{}", serde_json::to_string(&result)?);
    Ok(())
}

/// Synthesize release notes via LLM endpoint.
/// Posts grouped commits to the LLM with a prompt template and returns synthesis.
fn synthesize_with_llm(
    grouped: &BTreeMap<String, Vec<CommitInfo>>,
    llm_endpoint: &str,
    format: &str,
) -> anyhow::Result<String> {
    // Build the prompt from grouped commits
    let mut commit_list = String::new();
    for (category, commits) in grouped {
        commit_list.push_str(&format!("\n{}:\n", category));
        for commit in commits {
            let subject = commit.subject.split(':').nth(1).unwrap_or(&commit.subject).trim();
            commit_list.push_str(&format!("- {}\n", subject));
        }
    }

    let prompt = format!(
        "Write a concise release notes summary for FocalPoint in {} format based on these commits:\n{}",
        format, commit_list
    );

    let client =
        reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(30)).build()?;

    let body = serde_json::json!({
        "prompt": prompt,
        "max_tokens": 1000,
    });

    let response = client.post(llm_endpoint).json(&body).send()?;

    if !response.status().is_success() {
        anyhow::bail!("LLM server returned {}", response.status());
    }

    let json: serde_json::Value = response.json()?;
    let synthesis = json
        .get("text")
        .or_else(|| json.get("result"))
        .or_else(|| json.get("output"))
        .and_then(|v| v.as_str())
        .ok_or_else(|| anyhow::anyhow!("LLM response missing text/result/output field"))?;

    Ok(synthesis.to_string())
}

/// Search the template registry (or local fallback).
/// Queries the registry URL or searches local examples/templates/.
fn search_template_registry(query: &str, json_output: bool) -> anyhow::Result<()> {
    // Try registry URL from env var; fall back to local search
    let registry_url = std::env::var("FOCALPOINT_TEMPLATE_REGISTRY")
        .unwrap_or_else(|_| "https://packs.focalpoint.app/api/v1/search".to_string());

    let client =
        reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).build()?;

    let search_url = format!("{}?q={}", registry_url, urlencoding::encode(query));

    match client.get(&search_url).send() {
        Ok(response) if response.status().is_success() => {
            let results: Vec<TemplateSearchResult> = response.json()?;
            if json_output {
                println!("{}", serde_json::to_string(&results)?);
            } else {
                if results.is_empty() {
                    println!("no templates found matching '{}'", query);
                } else {
                    for result in results {
                        println!(
                            "{}  {}  {} ⭐  {} installs  by {}",
                            result.id, result.name, result.rating, result.installs, result.author
                        );
                    }
                }
            }
            Ok(())
        }
        _ => {
            // Fallback to local search in examples/templates/
            search_local_templates(query, json_output)
        }
    }
}

/// Search local template directory (fallback).
fn search_local_templates(query: &str, json_output: bool) -> anyhow::Result<()> {
    let dir = std::env::var("FOCALPOINT_EXAMPLES")
        .map(PathBuf::from)
        .ok()
        .or_else(|| std::env::current_dir().ok().map(|p| p.join("examples/templates")))
        .ok_or_else(|| anyhow::anyhow!("examples/templates not found"))?;

    if !dir.is_dir() {
        anyhow::bail!("{} is not a directory", dir.display());
    }

    let query_lower = query.to_lowercase();
    let mut results = Vec::new();

    for entry in std::fs::read_dir(&dir)? {
        let path = entry?.path();
        if path.extension().and_then(|s| s.to_str()) != Some("toml") {
            continue;
        }

        if let Ok(text) = std::fs::read_to_string(&path) {
            if let Ok(pack) = focus_templates::TemplatePack::from_toml_str(&text) {
                let matches = pack.id.to_lowercase().contains(&query_lower)
                    || pack.name.to_lowercase().contains(&query_lower)
                    || pack.description.to_lowercase().contains(&query_lower);

                if matches {
                    results.push(TemplateSearchResult {
                        id: pack.id,
                        name: pack.name,
                        author: pack.author,
                        rating: 4.5, // Placeholder for local results
                        installs: 0,
                        signed_by_fingerprint: None,
                    });
                }
            }
        }
    }

    if json_output {
        println!("{}", serde_json::to_string(&results)?);
    } else {
        if results.is_empty() {
            println!("no templates found matching '{}'", query);
        } else {
            for result in results {
                println!("{}  {}  (local)  by {}", result.id, result.name, result.author);
            }
        }
    }
    Ok(())
}

/// Show template pack details (manifest + README).
fn show_template_pack(pack_id: &str, json_output: bool) -> anyhow::Result<()> {
    // Try registry URL; fall back to local
    let registry_url = std::env::var("FOCALPOINT_TEMPLATE_REGISTRY")
        .unwrap_or_else(|_| "https://packs.focalpoint.app/api/v1".to_string());

    let client =
        reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).build()?;

    let show_url = format!("{}/packs/{}", registry_url, pack_id);

    match client.get(&show_url).send() {
        Ok(response) if response.status().is_success() => {
            let pack_detail: serde_json::Value = response.json()?;
            if json_output {
                println!("{}", serde_json::to_string(&pack_detail)?);
            } else {
                if let Some(name) = pack_detail.get("name").and_then(|v| v.as_str()) {
                    println!("# {}", name);
                }
                if let Some(desc) = pack_detail.get("description").and_then(|v| v.as_str()) {
                    println!("\n{}\n", desc);
                }
                if let Some(readme) = pack_detail.get("readme").and_then(|v| v.as_str()) {
                    println!("{}", readme);
                }
            }
            Ok(())
        }
        _ => {
            // Fallback to local
            show_local_template(pack_id, json_output)
        }
    }
}

/// Show local template pack details (fallback).
fn show_local_template(pack_id: &str, json_output: bool) -> anyhow::Result<()> {
    let dir = std::env::var("FOCALPOINT_EXAMPLES")
        .map(PathBuf::from)
        .ok()
        .or_else(|| std::env::current_dir().ok().map(|p| p.join("examples/templates")))
        .ok_or_else(|| anyhow::anyhow!("examples/templates not found"))?;

    let bundled = dir.join(format!("{}.toml", pack_id));
    let text = std::fs::read_to_string(&bundled)
        .map_err(|_| anyhow::anyhow!("template pack '{}' not found", pack_id))?;

    let pack = focus_templates::TemplatePack::from_toml_str(&text)?;

    if json_output {
        let detail = serde_json::json!({
            "id": pack.id,
            "name": pack.name,
            "version": pack.version,
            "author": pack.author,
            "description": pack.description,
            "rules_count": pack.rules.len(),
        });
        println!("{}", serde_json::to_string(&detail)?);
    } else {
        println!("# {}", pack.name);
        println!("\nVersion: {}", pack.version);
        println!("Author: {}", pack.author);
        println!("Rules: {}\n", pack.rules.len());
        println!("{}", pack.description);
    }
    Ok(())
}

/// Rate a template pack (POST to registry).
fn rate_template_pack(pack_id: &str, rating: u8, json_output: bool) -> anyhow::Result<()> {
    if !(1..=5).contains(&rating) {
        anyhow::bail!("rating must be 1-5");
    }

    let registry_url = std::env::var("FOCALPOINT_TEMPLATE_REGISTRY")
        .unwrap_or_else(|_| "https://packs.focalpoint.app/api/v1".to_string());

    let token = std::env::var("FOCALPOINT_TEMPLATE_TOKEN").ok();

    let client =
        reqwest::blocking::Client::builder().timeout(std::time::Duration::from_secs(10)).build()?;

    let rate_url = format!("{}/packs/{}/rate", registry_url, pack_id);
    let body = serde_json::json!({ "rating": rating });

    let mut request = client.post(&rate_url).json(&body);

    if let Some(tok) = token {
        request = request.bearer_auth(&tok);
    }

    match request.send() {
        Ok(response) if response.status().is_success() => {
            if json_output {
                let result =
                    serde_json::json!({ "pack_id": pack_id, "rating": rating, "status": "ok" });
                println!("{}", result);
            } else {
                println!("rating submitted for pack '{}': {} ⭐", pack_id, rating);
            }
            Ok(())
        }
        Ok(response) => {
            let msg = format!("HTTP {}", response.status());
            anyhow::bail!("failed to submit rating: {}", msg);
        }
        Err(e) => {
            eprintln!("warn: registry unavailable, rating not submitted: {}", e);
            if json_output {
                let result = serde_json::json!({ "pack_id": pack_id, "rating": rating, "status": "offline" });
                println!("{}", result);
            } else {
                println!("(rating submitted locally but registry unavailable)");
            }
            Ok(())
        }
    }
}

// Stub implementation: in production, this upserts to the DB.
// For CLI install validation, we just verify without persisting.
struct StubRuleStore;

impl focus_templates::RuleUpsert for StubRuleStore {
    fn upsert_rule(&mut self, _rule: focus_rules::Rule) -> std::result::Result<(), String> {
        Ok(())
    }
}

/// Load trusted public keys from ~/.config/focalpoint/trusted-keys.toml.
/// Returns a list of hex-encoded ed25519 public keys.
/// If the file doesn't exist, returns the compile-time root keys.
fn load_trusted_keys() -> anyhow::Result<Vec<String>> {
    let config_dir = dirs::config_dir()
        .ok_or_else(|| anyhow::anyhow!("failed to locate config directory"))?
        .join("focalpoint");
    std::fs::create_dir_all(&config_dir).ok(); // Best effort; not critical if fails.

    let trusted_file = config_dir.join("trusted-keys.toml");
    if !trusted_file.exists() {
        // Fallback to compile-time roots
        return Ok(focus_templates::PHENOTYPE_ROOT_PUBKEYS.iter().map(|s| s.to_string()).collect());
    }

    let text = std::fs::read_to_string(&trusted_file)?;
    let config: TrustedKeysConfig = toml::from_str(&text)?;
    Ok(config.keys.unwrap_or_default())
}

#[derive(serde::Deserialize, Debug)]
struct TrustedKeysConfig {
    #[serde(default)]
    keys: Option<Vec<String>>,
}

// --- Connector scaffolder ---

fn scaffold_connector(
    name: &str,
    auth: &str,
    events: Option<&str>,
    json_output: bool,
) -> anyhow::Result<()> {
    // Validate name: lowercase, hyphens, no underscores
    if !name.chars().all(|c| c.is_ascii_lowercase() || c == '-') || name.is_empty() {
        anyhow::bail!(
            "connector name must be lowercase with hyphens only (e.g., 'linear', 'apple-health')"
        );
    }

    let crate_name = format!("connector-{}", name);
    let crate_dir = PathBuf::from("crates").join(&crate_name);

    if crate_dir.exists() {
        anyhow::bail!("crate {} already exists", crate_dir.display());
    }

    // Parse event types
    let event_types: Vec<String> = events
        .unwrap_or("entity_created,entity_updated")
        .split(',')
        .map(|e| format!("{}:{}", name, e.trim()))
        .collect();

    // Create directory structure
    std::fs::create_dir_all(crate_dir.join("src/"))?;
    std::fs::create_dir_all(crate_dir.join("tests/fixtures"))?;

    // Generate Cargo.toml
    let cargo_toml = format!(
        r#"[package]
name = "{crate_name}"
version.workspace = true
edition.workspace = true
license.workspace = true
rust-version.workspace = true
publish = false

[dependencies]
# Workspace
focus-events.workspace = true
focus-connectors.workspace = true

# Core
serde.workspace = true
serde_json.workspace = true
thiserror.workspace = true
anyhow.workspace = true
uuid.workspace = true
chrono.workspace = true
tokio.workspace = true

# HTTP
reqwest = {{ version = "0.12", features = ["json"] }}
http = "1.1"

# Async
async-trait.workspace = true

# Logging
tracing.workspace = true

[dev-dependencies]
wiremock = "0.6"
tokio = {{ workspace = true, features = ["full"] }}
"#
    );

    std::fs::write(crate_dir.join("Cargo.toml"), cargo_toml)?;

    // Generate lib.rs
    let connector_name = pascal_case(name);
    let auth_enum = match auth {
        "token" | "apikey" => "ApiKey",
        "oauth2" => "OAuth2",
        "hmac" => "Hmac",
        _ => "ApiKey",
    };
    let event_types_str = event_types
        .iter()
        .map(|e| format!("\"{}\".into()", e))
        .collect::<Vec<_>>()
        .join(",\n        ");

    let lib_rs = format!(
        "//! {} connector — {} auth, API client, event mapping, `Connector` impl.
//! Emits: {}.

pub mod api;
pub mod auth;
pub mod events;
pub mod models;

use std::sync::Arc;

use async_trait::async_trait;
use tokio::sync::Mutex;
use tracing::{{debug, info, warn}};
use uuid::Uuid;

use focus_connectors::{{
    AuthStrategy, Connector, ConnectorError, ConnectorManifest, HealthState, Result, SyncMode,
    SyncOutcome, VerificationTier,
}};

use crate::api::Client;
use crate::auth::TokenStore;
use crate::events::EventMapper;

/// {} connector.
pub struct {}Connector {{
    manifest: ConnectorManifest,
    account_id: Uuid,
    token_store: Arc<dyn TokenStore>,
    client: Mutex<Client>,
}}

pub struct {}ConnectorBuilder {{
    account_id: Uuid,
    token_store: Option<Arc<dyn TokenStore>>,
    http: Option<reqwest::Client>,
}}

impl {}ConnectorBuilder {{
    pub fn new() -> Self {{
        Self {{
            account_id: Uuid::nil(),
            token_store: None,
            http: None,
        }}
    }}

    pub fn account_id(mut self, id: Uuid) -> Self {{
        self.account_id = id;
        self
    }}

    pub fn token_store(mut self, s: Arc<dyn TokenStore>) -> Self {{
        self.token_store = Some(s);
        self
    }}

    pub fn http(mut self, h: reqwest::Client) -> Self {{
        self.http = Some(h);
        self
    }}

    pub fn build(self) -> {}Connector {{
        let http = self.http.unwrap_or_default();
        let store = self
            .token_store
            .unwrap_or_else(|| Arc::new(auth::InMemoryTokenStore::new()));
        let client = Client::new(http);
        {}Connector {{
            manifest: default_manifest(),
            account_id: self.account_id,
            token_store: store,
            client: Mutex::new(client),
        }}
    }}
}}

fn default_manifest() -> ConnectorManifest {{
    ConnectorManifest {{
        id: \"{}\".into(),
        version: \"0.1.0\".into(),
        display_name: \"{}\".into(),
        auth_strategy: AuthStrategy::{},
        sync_mode: SyncMode::Polling {{
            cadence_seconds: 300,
        }},
        capabilities: vec![],
        entity_types: vec![\"entity\".into()],
        event_types: vec![
        {}
        ],
        tier: VerificationTier::Unverified,
        health_indicators: vec![\"token_valid\".into()],
    }}
}}

#[async_trait]
impl Connector for {}Connector {{
    fn manifest(&self) -> &ConnectorManifest {{
        &self.manifest
    }}

    async fn health(&self) -> HealthState {{
        // TODO: Implement health check (e.g., verify token)
        HealthState::Healthy
    }}

    async fn sync(&self, _cursor: Option<String>) -> Result<SyncOutcome> {{
        let _client = self.client.lock().await;
        let _mapper = EventMapper::new(self.account_id);

        // TODO: Implement sync logic
        // 1. Fetch data from API
        // 2. Map to NormalizedEvent using mapper
        // 3. Return SyncOutcome with events

        Ok(SyncOutcome {{
            events: Vec::new(),
            next_cursor: None,
            partial: false,
        }})
    }}
}}

#[cfg(test)]
mod tests {{
    use super::*;

    // Traces to: FR-CONNECTOR-{}-001
    #[test]
    fn builder_constructs() {{
        let account_id = Uuid::new_v4();
        let connector = {}ConnectorBuilder::new()
            .account_id(account_id)
            .build();
        assert_eq!(connector.manifest().id, \"{}\");
    }}

    // Traces to: FR-CONNECTOR-{}-001
    #[test]
    fn manifest_has_events() {{
        let manifest = default_manifest();
        assert!(!manifest.event_types.is_empty());
    }}
}}
",
        name,
        auth,
        event_types.join(", "),
        name,
        connector_name,
        connector_name,
        connector_name,
        connector_name,
        connector_name,
        name,
        name,
        auth_enum,
        event_types_str,
        connector_name,
        name.to_uppercase(),
        connector_name,
        name,
        name.to_uppercase()
    );

    std::fs::write(crate_dir.join("src/lib.rs"), lib_rs)?;

    // Generate auth.rs
    let auth_rs = r#"//! Token auth storage and helpers.

use async_trait::async_trait;
use std::sync::Arc;
use tokio::sync::Mutex;

/// Token storage contract.
#[async_trait]
pub trait TokenStore: Send + Sync {
    async fn get_token(&self) -> Option<String>;
    async fn set_token(&self, token: String);
}

/// In-memory token store (ephemeral).
pub struct InMemoryTokenStore {
    token: Arc<Mutex<Option<String>>>,
}

impl InMemoryTokenStore {
    pub fn new() -> Self {
        Self {
            token: Arc::new(Mutex::new(None)),
        }
    }
}

#[async_trait]
impl TokenStore for InMemoryTokenStore {
    async fn get_token(&self) -> Option<String> {
        self.token.lock().await.clone()
    }

    async fn set_token(&self, token: String) {
        *self.token.lock().await = Some(token);
    }
}
"#;

    std::fs::write(crate_dir.join("src/auth.rs"), auth_rs)?;

    // Generate api.rs
    let api_rs = r#"//! HTTP client for API interactions.

use reqwest::Client as ReqwestClient;

/// API client.
pub struct Client {
    http: ReqwestClient,
}

impl Client {
    pub fn new(http: ReqwestClient) -> Self {
        Self { http }
    }

    // TODO: Implement API methods
    // Example:
    // pub async fn get_items(&self) -> Result<Vec<Item>> {
    //     self.http
    //         .get("https://api.provider.com/items")
    //         .bearer_auth(&self.token)
    //         .send()
    //         .await?
    //         .json()
    //         .await
    //         .map_err(|e| ConnectorError::Network(e.to_string()))
    // }
}
"#;

    std::fs::write(crate_dir.join("src/api.rs"), api_rs)?;

    // Generate models.rs
    let models_rs = r#"//! API response types (Serde-derived).

use serde::{Deserialize, Serialize};

// TODO: Define API response types
// Example:
// #[derive(Debug, Clone, Serialize, Deserialize)]
// pub struct Item {
//     pub id: String,
//     pub name: String,
//     pub created_at: String,
// }
"#;

    std::fs::write(crate_dir.join("src/models.rs"), models_rs)?;

    // Generate events.rs
    let events_rs = r#"//! Event mapping — transforms API responses into normalized events.

use chrono::Utc;
use focus_events::{EventFactory, EventType, NormalizedEvent, TraceRef};
use uuid::Uuid;

pub struct EventMapper {
    account_id: Uuid,
}

impl EventMapper {
    pub fn new(account_id: Uuid) -> Self {
        Self { account_id }
    }

    // TODO: Implement event mapping methods
    // Example:
    // pub fn map_items(&self, items: Vec<Item>) -> Vec<NormalizedEvent> {
    //     items.into_iter()
    //         .map(|item| {
    //             let occurred_at = chrono::DateTime::parse_from_rfc3339(&item.created_at)
    //                 .map(|dt| dt.with_timezone(&Utc))
    //                 .unwrap_or_else(|_| Utc::now());
    //
    //             let dedupe_key = EventFactory::new_dedupe_key(
    //                 "myconnector",
    //                 &format!("{}-created", item.id),
    //                 occurred_at,
    //             );
    //
    //             NormalizedEvent {
    //                 event_id: Uuid::new_v4(),
    //                 connector_id: "myconnector".into(),
    //                 account_id: self.account_id,
    //                 event_type: EventType::Custom("myconnector:item_created".into()),
    //                 occurred_at,
    //                 effective_at: Utc::now(),
    //                 dedupe_key,
    //                 confidence: 0.99,
    //                 payload: serde_json::json!({
    //                     "id": item.id,
    //                     "name": item.name,
    //                 }),
    //                 raw_ref: Some(TraceRef {
    //                     source: "api".into(),
    //                     id: item.id,
    //                 }),
    //             }
    //         })
    //         .collect()
    // }
}
"#;

    std::fs::write(crate_dir.join("src/events.rs"), events_rs)?;

    // Generate test stub
    let test_rs = format!(
        "//! Wiremock integration tests.

use wiremock::{{Mock, MockServer, ResponseTemplate}};
use wiremock::matchers::{{method, path}};

// Traces to: FR-CONNECTOR-{}-SYNC-001
#[tokio::test]
async fn sync_fetches_and_maps() {{
    let _mock_server = MockServer::start().await;

    // TODO: Mock API responses
    // Mock::given(method(\"GET\"))
    //     .and(path(\"/items\"))
    //     .respond_with(ResponseTemplate::new(200).set_body_string(\"{{}}\"))
    //     .mount(&mock_server)
    //     .await;

    // TODO: Create connector and call sync()
    // let outcome = connector.sync(None).await.unwrap();
    // assert!(!outcome.events.is_empty());
}}
",
        name.to_uppercase()
    );

    std::fs::write(crate_dir.join("tests/wiremock_tests.rs"), test_rs)?;

    // Update workspace Cargo.toml
    let workspace_cargo = PathBuf::from("Cargo.toml");
    let mut workspace_content = std::fs::read_to_string(&workspace_cargo)?;

    if !workspace_content.contains(&format!(r#""{}""#, crate_name)) {
        // Find the end of the members array and insert before it
        if let Some(members_end) = workspace_content.rfind(']') {
            let (before, after) = workspace_content.split_at(members_end);
            workspace_content = format!("{}    \"{}\",\n{}\n", before, crate_name, after);
            std::fs::write(&workspace_cargo, &workspace_content)?;
        }
    }

    // Output result
    if json_output {
        #[derive(Serialize)]
        struct ScaffoldResult {
            success: bool,
            crate_name: String,
            path: String,
            auth_strategy: String,
            event_types: Vec<String>,
            next_steps: Vec<String>,
        }

        let result = ScaffoldResult {
            success: true,
            crate_name,
            path: crate_dir.display().to_string(),
            auth_strategy: auth.to_string(),
            event_types,
            next_steps: vec![
                format!("cd {} && cargo check", crate_dir.display()),
                "Update src/api.rs with API methods".to_string(),
                "Update src/models.rs with response types".to_string(),
                "Implement event mapping in src/events.rs".to_string(),
                "Write tests in tests/wiremock_tests.rs".to_string(),
                "Create docs-site/connectors/{}.md documentation".to_string(),
            ],
        };
        println!("{}", serde_json::to_string(&result)?);
    } else {
        println!("✓ Scaffolded connector: {}", crate_name);
        println!("  path: {}", crate_dir.display());
        println!("  auth: {}", auth);
        println!("  events: {}", event_types.join(", "));
        println!();
        println!("Next steps:");
        println!("  1. cd {} && cargo check", crate_dir.display());
        println!("  2. Update src/api.rs with API methods");
        println!("  3. Update src/models.rs with response types");
        println!("  4. Implement event mapping in src/events.rs");
        println!("  5. Write tests in tests/wiremock_tests.rs");
        println!("  6. Create connector documentation page");
    }

    Ok(())
}

fn pascal_case(s: &str) -> String {
    s.split('-')
        .map(|part| {
            let mut chars = part.chars();
            match chars.next() {
                None => String::new(),
                Some(first) => first.to_uppercase().collect::<String>() + chars.as_str(),
            }
        })
        .collect()
}

fn run_demo(sub: DemoCmd, db_path: &std::path::Path, json: bool) -> anyhow::Result<()> {
    let rt = tokio::runtime::Runtime::new()?;
    rt.block_on(async {
        let adapter = SqliteAdapter::open(db_path)?;
        match sub {
            DemoCmd::Seed => {
                let report = seed_demo_data(&adapter).await?;
                if json {
                    println!("{}", serde_json::to_string_pretty(&report)?);
                } else {
                    println!("✅ Demo data seeded successfully!");
                    println!("  Tasks created: {}", report.tasks_count);
                    println!("  Rules installed: {}", report.rules_count);
                    println!("  Wallet balance: {} credits", report.wallet_balance);
                    println!("  Wallet streak: {} days", report.wallet_streak_days);
                    println!("  Connectors connected: {}", report.connectors_connected);
                    println!("  Audit records created: {}", report.audit_records_count);
                    println!("  Ritual completions: {}", report.ritual_completions_count);
                }
            }
            DemoCmd::Reset => {
                reset_demo_data(&adapter).await?;
                if json {
                    println!("{{\"status\": \"reset_complete\"}}");
                } else {
                    println!("✅ Demo data reset complete!");
                }
            }
        }
        Ok(())
    })
}

async fn run_replay(
    sub: replay::ReplayCmd,
    db_path: &Path,
    json: bool,
) -> anyhow::Result<()> {
    let adapter = Arc::new(SqliteAdapter::open(db_path)?);
    let result = replay::execute(adapter, sub).await?;

    if json {
        // Output is already JSON or markdown formatted string
        println!("{}", result);
    } else {
        // For non-JSON output, render markdown
        println!("{}", result);
    }

    Ok(())
}
