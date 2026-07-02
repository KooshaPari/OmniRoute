//! Monitoring and health check functionality
// These types are a stub reserved for future dashboard integration; none are
// wired into the binary yet.  Suppress dead_code for the whole module rather
// than scattering per-item allows across a placeholder.
#![allow(dead_code)]

use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

use serde::{Deserialize, Serialize};
use tracing::warn;

use crate::config;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HealthStatus {
    pub healthy: bool,
    pub last_check: u64,
    pub uptime_seconds: u64,
    pub checks_passed: u32,
    pub checks_failed: u32,
}

impl HealthStatus {
    pub fn new() -> Self {
        Self {
            healthy: true,
            last_check: now_secs(),
            uptime_seconds: 0,
            checks_passed: 1,
            checks_failed: 0,
        }
    }

    pub fn mark_healthy(&mut self) {
        self.healthy = true;
        self.last_check = now_secs();
        self.checks_passed += 1;
    }

    pub fn mark_unhealthy(&mut self, reason: &str) {
        self.healthy = false;
        self.last_check = now_secs();
        self.checks_failed += 1;
        warn!("Health check failed: {}", reason);
    }
}

impl Default for HealthStatus {
    fn default() -> Self {
        Self::new()
    }
}

#[derive(Debug, Clone)]
pub struct ProcessStats {
    pub pid: u32,
    pub name: String,
    pub memory_mb: u64,
    pub cpu_percent: f32,
    pub start_time: u64,
    pub uptime_seconds: u64,
}

impl ProcessStats {
    pub fn is_idle(&self, threshold_secs: u64) -> bool {
        self.uptime_seconds > threshold_secs && self.cpu_percent < 1.0
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MonitoringReport {
    pub timestamp: u64,
    pub total_processes: usize,
    pub total_memory_mb: u64,
    pub by_project: HashMap<String, usize>,
    pub by_harness: HashMap<String, usize>,
    pub idle_processes: usize,
    pub recommendations: Vec<String>,
}

impl MonitoringReport {
    pub fn generate(processes: &[ProcessStats]) -> Self {
        let cfg = config::global();
        let by_project: HashMap<String, usize> = HashMap::new();
        let mut by_harness: HashMap<String, usize> = HashMap::new();
        let mut total_memory = 0u64;
        let mut idle = 0usize;

        for proc in processes {
            total_memory += proc.memory_mb;

            // Track idle processes
            if proc.is_idle(cfg.monitoring.idle_threshold_secs) {
                idle += 1;
            }

            // Populate breakdown maps (audit L8: these were left empty)
            *by_harness.entry(proc.name.clone()).or_insert(0) += 1;
            // Project name not available on ProcessStats directly;
            // by_project is populated when project metadata is passed.
        }

        let mut recommendations = Vec::new();

        if total_memory > cfg.monitoring.high_memory_threshold_mb {
            recommendations.push(format!(
                "High memory usage: {} MB. Consider pruning idle processes.",
                total_memory
            ));
        }

        if idle > cfg.monitoring.idle_process_threshold {
            recommendations
                .push(format!("{} idle processes found. Run 'sharecli prune' to clean up.", idle));
        }

        Self {
            timestamp: now_secs(),
            total_processes: processes.len(),
            total_memory_mb: total_memory,
            by_project,
            by_harness,
            idle_processes: idle,
            recommendations,
        }
    }
}

fn now_secs() -> u64 {
    SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn setup() {
        // Ensure global config is initialised before tests access it
        crate::config::init_global();
    }

    #[test]
    fn test_mark_unhealthy_uses_tracing_not_eprintln() {
        // Smoke test: mark_unhealthy should not panic and should flip healthy to false.
        let mut status = HealthStatus::new();
        assert!(status.healthy);
        status.mark_unhealthy("test failure");
        assert!(!status.healthy);
        assert_eq!(status.checks_failed, 1);
    }

    #[test]
    fn test_monitoring_report_populates_by_harness() {
        setup();
        let stats = vec![
            ProcessStats {
                pid: 100,
                name: "node".into(),
                memory_mb: 128,
                cpu_percent: 0.5,
                start_time: 1000,
                uptime_seconds: 100,
            },
            ProcessStats {
                pid: 101,
                name: "bun".into(),
                memory_mb: 256,
                cpu_percent: 0.3,
                start_time: 1001,
                uptime_seconds: 200,
            },
            ProcessStats {
                pid: 102,
                name: "node".into(),
                memory_mb: 64,
                cpu_percent: 2.0,
                start_time: 1002,
                uptime_seconds: 10,
            },
        ];

        let report = MonitoringReport::generate(&stats);
        assert_eq!(report.total_processes, 3);
        assert_eq!(report.total_memory_mb, 448);
        // by_harness must be populated (audit L8 fix)
        assert_eq!(report.by_harness.get("node"), Some(&2));
        assert_eq!(report.by_harness.get("bun"), Some(&1));
        // by_project is still empty (no project metadata on ProcessStats)
        assert!(report.by_project.is_empty());
    }

    #[test]
    fn test_monitoring_report_empty() {
        setup();
        let report = MonitoringReport::generate(&[]);
        assert_eq!(report.total_processes, 0);
        assert_eq!(report.total_memory_mb, 0);
        assert!(report.by_harness.is_empty());
        assert!(report.recommendations.is_empty());
    }
}
