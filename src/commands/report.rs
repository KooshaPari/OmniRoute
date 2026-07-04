//! Fleet analytics report command.
//!
//! `sharecli report [--format text|json]` prints a one-shot snapshot of the
//! current process fleet to stdout.  No running server is required.

use std::cmp::Reverse;
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use anyhow::Result;
use serde::{Deserialize, Serialize};

use crate::runtime::{ProcessInfo, ProcessPool};

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

/// Output format for `sharecli report`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub enum ReportFormat {
    #[default]
    Text,
    Json,
}

impl std::str::FromStr for ReportFormat {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> Result<Self> {
        match s.to_ascii_lowercase().as_str() {
            "text" => Ok(Self::Text),
            "json" => Ok(Self::Json),
            other => anyhow::bail!("unknown format '{}'; expected 'text' or 'json'", other),
        }
    }
}

/// Per-project breakdown included in the report.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct ProjectBreakdown {
    pub count: usize,
    pub memory_mb: u64,
}

/// Summary of one of the top memory consumers.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
pub struct TopConsumer {
    pub pid: u32,
    pub name: String,
    pub project: Option<String>,
    pub memory_mb: u64,
}

/// Full analytics snapshot.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FleetReport {
    /// Unix timestamp (seconds) when the snapshot was taken.
    pub timestamp: u64,
    /// Approximate daemon uptime in seconds (based on earliest process start time).
    pub uptime_seconds: u64,
    /// Total number of tracked processes.
    pub total_processes: usize,
    /// Sum of `memory_mb` across all tracked processes.
    pub total_memory_mb: u64,
    /// Per-project count + memory.
    pub by_project: HashMap<String, ProjectBreakdown>,
    /// Top-5 memory consumers (descending).
    pub top_consumers: Vec<TopConsumer>,
    /// Thermal pressure level string ("GREEN" / "YELLOW" / "RED" or "UNAVAILABLE").
    pub thermal_pressure: String,
}

// ---------------------------------------------------------------------------
// Aggregation logic (pure function — easy to unit-test)
// ---------------------------------------------------------------------------

/// Build a [`FleetReport`] from a slice of process snapshots.
///
/// `thermal` is the current thermal pressure string (caller supplies it so
/// the function stays sync and testable without hitting sysfs).
pub fn build_report(processes: &[ProcessInfo], thermal: &str) -> FleetReport {
    let now = SystemTime::now().duration_since(UNIX_EPOCH).unwrap_or_default().as_secs();

    let total_memory_mb: u64 = processes.iter().map(|p| p.memory_mb).sum();

    // Per-project breakdown
    let mut by_project: HashMap<String, ProjectBreakdown> = HashMap::new();
    for p in processes {
        let key = p.project.clone().unwrap_or_else(|| "<untagged>".to_string());
        let entry = by_project.entry(key).or_insert(ProjectBreakdown { count: 0, memory_mb: 0 });
        entry.count += 1;
        entry.memory_mb += p.memory_mb;
    }

    // Top-5 memory consumers
    let mut sorted: Vec<&ProcessInfo> = processes.iter().collect();
    sorted.sort_by_key(|p| Reverse(p.memory_mb));
    let top_consumers = sorted
        .into_iter()
        .take(5)
        .map(|p| TopConsumer {
            pid: p.pid,
            name: p.name.clone(),
            project: p.project.clone(),
            memory_mb: p.memory_mb,
        })
        .collect();

    // Uptime: time since the earliest process started (0 if no processes)
    let earliest_start = processes.iter().map(|p| p.start_time).filter(|&t| t > 0).min();
    let uptime_seconds = earliest_start.map(|t| now.saturating_sub(t)).unwrap_or(0);

    FleetReport {
        timestamp: now,
        uptime_seconds,
        total_processes: processes.len(),
        total_memory_mb,
        by_project,
        top_consumers,
        thermal_pressure: thermal.to_string(),
    }
}

// ---------------------------------------------------------------------------
// Rendering helpers
// ---------------------------------------------------------------------------

fn render_text(report: &FleetReport) {
    println!("=== Fleet Analytics Report ===");
    println!("Timestamp:       {}", report.timestamp);
    println!("Uptime:          {} s", report.uptime_seconds);
    println!("Thermal:         {}", report.thermal_pressure);
    println!("Total processes: {}", report.total_processes);
    println!("Total memory:    {} MB", report.total_memory_mb);

    println!("\n--- Per-Project Breakdown ---");
    println!("{:<25} {:>8} {:>12}", "PROJECT", "PROCS", "MEM (MB)");
    println!("{}", "-".repeat(47));
    let mut projects: Vec<(&String, &ProjectBreakdown)> = report.by_project.iter().collect();
    projects.sort_by(|a, b| a.0.cmp(b.0));
    for (name, bd) in &projects {
        println!("{:<25} {:>8} {:>12}", name, bd.count, bd.memory_mb);
    }

    if !report.top_consumers.is_empty() {
        println!("\n--- Top Memory Consumers ---");
        println!("{:>8} {:<25} {:<20} {:>12}", "PID", "NAME", "PROJECT", "MEM (MB)");
        println!("{}", "-".repeat(67));
        for tc in &report.top_consumers {
            println!(
                "{:>8} {:<25} {:<20} {:>12}",
                tc.pid,
                tc.name,
                tc.project.as_deref().unwrap_or("-"),
                tc.memory_mb
            );
        }
    }
}

fn render_json(report: &FleetReport) -> Result<()> {
    let json = serde_json::to_string_pretty(report)?;
    println!("{}", json);
    Ok(())
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/// Run the report command.
pub async fn run(format: ReportFormat) -> Result<()> {
    let pool = ProcessPool::new();
    let processes = pool.list().await;

    // Best-effort thermal level via sharecli-fleet
    let thermal = {
        use sharecli_fleet::thermal::ThermalGovernor;
        let gov = ThermalGovernor::new();
        match gov.poll() {
            Ok(level) => format!("{:?}", level),
            Err(_) => "UNAVAILABLE".to_string(),
        }
    };

    let report = build_report(&processes, &thermal);

    match format {
        ReportFormat::Text => render_text(&report),
        ReportFormat::Json => render_json(&report)?,
    }

    Ok(())
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

#[cfg(test)]
mod tests {
    use super::*;

    fn make_proc(
        pid: u32,
        name: &str,
        project: Option<&str>,
        memory_mb: u64,
        start_time: u64,
    ) -> ProcessInfo {
        ProcessInfo {
            pid,
            name: name.to_string(),
            cmd: vec![],
            memory_mb,
            start_time,
            project: project.map(String::from),
            harness: None,
        }
    }

    #[test]
    fn test_build_report_empty() {
        let report = build_report(&[], "GREEN");
        assert_eq!(report.total_processes, 0);
        assert_eq!(report.total_memory_mb, 0);
        assert!(report.by_project.is_empty());
        assert!(report.top_consumers.is_empty());
        assert_eq!(report.thermal_pressure, "GREEN");
    }

    #[test]
    fn test_build_report_aggregation() {
        let procs = vec![
            make_proc(1, "cargo", Some("alpha"), 300, 1_000_000),
            make_proc(2, "bun", Some("alpha"), 100, 1_000_100),
            make_proc(3, "node", Some("beta"), 200, 1_000_200),
            make_proc(4, "forge", None, 50, 1_000_300),
        ];
        let report = build_report(&procs, "YELLOW");

        assert_eq!(report.total_processes, 4);
        assert_eq!(report.total_memory_mb, 650);

        let alpha = report.by_project.get("alpha").expect("alpha missing");
        assert_eq!(alpha.count, 2);
        assert_eq!(alpha.memory_mb, 400);

        let beta = report.by_project.get("beta").expect("beta missing");
        assert_eq!(beta.count, 1);
        assert_eq!(beta.memory_mb, 200);

        let untagged = report.by_project.get("<untagged>").expect("untagged missing");
        assert_eq!(untagged.count, 1);
        assert_eq!(untagged.memory_mb, 50);
    }

    #[test]
    fn test_top_consumers_order_and_limit() {
        let procs: Vec<ProcessInfo> =
            (0u32..8).map(|i| make_proc(i, "proc", None, (i as u64 + 1) * 100, 0)).collect();
        let report = build_report(&procs, "GREEN");

        assert_eq!(report.top_consumers.len(), 5);
        // First element must be the highest memory consumer
        assert_eq!(report.top_consumers[0].memory_mb, 800);
        // Must be in descending order
        for w in report.top_consumers.windows(2) {
            assert!(w[0].memory_mb >= w[1].memory_mb);
        }
    }

    #[test]
    fn test_json_roundtrip() {
        let procs = vec![make_proc(10, "claude", Some("proj-a"), 512, 1_700_000_000)];
        let report = build_report(&procs, "RED");
        let json = serde_json::to_string(&report).expect("serialize");
        let back: FleetReport = serde_json::from_str(&json).expect("deserialize");
        assert_eq!(back.total_processes, report.total_processes);
        assert_eq!(back.total_memory_mb, report.total_memory_mb);
        assert_eq!(back.thermal_pressure, "RED");
        let pa = back.by_project.get("proj-a").unwrap();
        assert_eq!(pa.count, 1);
        assert_eq!(pa.memory_mb, 512);
    }

    #[test]
    fn test_report_format_from_str() {
        use std::str::FromStr;
        assert_eq!(ReportFormat::from_str("text").unwrap(), ReportFormat::Text);
        assert_eq!(ReportFormat::from_str("TEXT").unwrap(), ReportFormat::Text);
        assert_eq!(ReportFormat::from_str("json").unwrap(), ReportFormat::Json);
        assert_eq!(ReportFormat::from_str("JSON").unwrap(), ReportFormat::Json);
        assert!(ReportFormat::from_str("xml").is_err());
    }
}
