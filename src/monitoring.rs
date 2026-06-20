//! Monitoring and health check functionality

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::{SystemTime, UNIX_EPOCH};

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
        eprintln!("Health check failed: {}", reason);
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
        let by_harness: HashMap<String, usize> = HashMap::new();
        let mut total_memory = 0u64;
        let mut idle = 0usize;

        for proc in processes {
            total_memory += proc.memory_mb;

            // Track idle processes
            if proc.is_idle(cfg.monitoring.idle_threshold_secs) {
                idle += 1;
            }
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
