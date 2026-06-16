//! Process runtime management with shared pool support.
//!
//! Spawn/monitor/kill delegated to substrate [`ProcessPort`] (`runtime-process`);
//! sharecli retains metadata tagging, pooling, and resource limits.

use anyhow::{bail, Result};
use runtime_process::CommandGroupProcess;
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};
use substrate::{ProcessHandle, ProcessPort, ProcessSpawnSpec};
use sysinfo::{Pid, System};
use tokio::process::Command;
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cmd: Vec<String>,
    pub memory_mb: u64,
    pub start_time: u64,
    pub project: Option<String>,
    pub harness: Option<String>,
}

impl ProcessInfo {
    pub fn from_sysinfo(pid: Pid, name: String, sys: &System) -> Option<Self> {
        sys.process(pid).map(|p| ProcessInfo {
            pid: pid.as_u32(),
            name,
            cmd: p.cmd().iter().map(|s| s.to_string()).collect(),
            memory_mb: p.memory() / 1024 / 1024,
            start_time: p.start_time(),
            project: None,
            harness: None,
        })
    }
}

#[derive(Debug)]
pub struct ManagedProcess {
    pub info: ProcessInfo,
    pub handle: ProcessHandle,
}

pub struct ProcessPool {
    processes: RwLock<HashMap<u32, ManagedProcess>>,
    system: RwLock<System>,
    port: CommandGroupProcess,
}

impl Default for ProcessPool {
    fn default() -> Self {
        Self::new()
    }
}

impl ProcessPool {
    pub fn new() -> Self {
        Self {
            processes: RwLock::new(HashMap::new()),
            system: RwLock::new(System::new_all()),
            port: CommandGroupProcess::new(),
        }
    }

    /// Refresh system process information
    pub async fn refresh(&self) {
        let mut sys = self.system.write().await;
        sys.refresh_all();
    }

    /// Get all managed processes
    pub async fn list(&self) -> Vec<ProcessInfo> {
        let sys = self.system.read().await;
        let procs = self.processes.read().await;

        let mut result = Vec::new();
        for pid in procs.keys() {
            if let Some(info) = ProcessInfo::from_sysinfo(
                Pid::from_u32(*pid),
                procs.get(pid).unwrap().info.name.clone(),
                &sys,
            ) {
                result.push(info);
            }
        }
        result
    }

    /// Spawn a new process via substrate ProcessPort
    pub async fn spawn(
        &self,
        cmd: &str,
        args: &[String],
        cwd: Option<PathBuf>,
        project: Option<String>,
        harness: Option<String>,
    ) -> Result<ProcessInfo> {
        let spec = ProcessSpawnSpec { program: cmd.to_string(), args: args.to_vec(), cwd };

        let handle =
            self.port.spawn(&spec).await.map_err(|e| anyhow::anyhow!("spawn {cmd}: {e}"))?;

        let pid = handle.pid;

        self.refresh().await;

        let info = ProcessInfo {
            pid,
            name: cmd.to_string(),
            cmd: vec![cmd.to_string()].into_iter().chain(args.iter().cloned()).collect(),
            memory_mb: 0,
            start_time: 0,
            project,
            harness,
        };

        let managed = ManagedProcess { info: info.clone(), handle };

        let mut procs = self.processes.write().await;
        procs.insert(pid, managed);

        Ok(info)
    }

    /// Kill a process by PID via substrate ProcessPort
    pub async fn kill(&self, pid: u32) -> Result<()> {
        let mut procs = self.processes.write().await;
        if let Some(managed) = procs.remove(&pid) {
            self.port
                .kill_group(&managed.handle)
                .await
                .map_err(|e| anyhow::anyhow!("kill pid {pid}: {e}"))?;
        }
        Ok(())
    }

    /// Kill all managed processes
    pub async fn kill_all(&self) -> Result<()> {
        let mut procs = self.processes.write().await;
        for (_, managed) in procs.drain() {
            let _ = self.port.kill_group(&managed.handle).await;
        }
        Ok(())
    }

    /// Get system memory usage
    pub async fn system_memory_usage(&self) -> (u64, u64) {
        let sys = self.system.read().await;
        (sys.used_memory() / 1024 / 1024, sys.total_memory() / 1024 / 1024)
    }
}

/// Shared runtime pool for node/bun processes
pub struct SharedRuntime {
    node_pool: RwLock<Vec<PooledProcess>>,
    bun_pool: RwLock<Vec<PooledProcess>>,
    max_per_type: usize,
    system: Arc<RwLock<System>>,
}

#[derive(Debug, Clone)]
pub struct PooledProcess {
    pub pid: u32,
    pub name: String,
    pub in_use: bool,
    pub last_used: Instant,
}

impl SharedRuntime {
    pub fn new(max_per_type: usize) -> Self {
        Self {
            node_pool: RwLock::new(Vec::new()),
            bun_pool: RwLock::new(Vec::new()),
            max_per_type,
            system: Arc::new(RwLock::new(System::new_all())),
        }
    }

    pub async fn refresh(&self) {
        let mut sys = self.system.write().await;
        sys.refresh_all();
    }

    pub async fn acquire(&self, harness_type: &str) -> Result<PooledProcess> {
        let pool = match harness_type {
            "node" => &self.node_pool,
            "bun" => &self.bun_pool,
            _ => bail!("Unsupported harness type: {}. Use 'node' or 'bun'", harness_type),
        };

        let mut pool_guard = pool.write().await;

        if let Some(idx) = pool_guard.iter().position(|p| !p.in_use) {
            pool_guard[idx].in_use = true;
            pool_guard[idx].last_used = Instant::now();
            return Ok(pool_guard[idx].clone());
        }

        if pool_guard.len() < self.max_per_type {
            let (cmd, name) = match harness_type {
                "node" => ("node", "node"),
                "bun" => ("bun", "bun"),
                _ => unreachable!(),
            };

            let child = Command::new(cmd)
                .arg("--version")
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()?;

            let pid = child.id().unwrap_or(0);
            drop(child);

            tokio::time::sleep(Duration::from_millis(100)).await;
            self.refresh().await;

            let sys = self.system.read().await;
            let pooled = if sys.process(Pid::from_u32(pid)).is_some() {
                PooledProcess {
                    pid,
                    name: name.to_string(),
                    in_use: true,
                    last_used: Instant::now(),
                }
            } else {
                bail!("Failed to spawn pooled process");
            };

            pool_guard.push(pooled.clone());
            Ok(pooled)
        } else {
            bail!(
                "Pool exhausted: max {} instances of {} allowed",
                self.max_per_type,
                harness_type
            );
        }
    }

    pub async fn release(&self, harness_type: &str, pid: u32) -> Result<()> {
        let pool = match harness_type {
            "node" => &self.node_pool,
            "bun" => &self.bun_pool,
            _ => bail!("Unsupported harness type: {}", harness_type),
        };

        let mut pool_guard = pool.write().await;
        if let Some(p) = pool_guard.iter_mut().find(|p| p.pid == pid) {
            p.in_use = false;
            p.last_used = Instant::now();
        }
        Ok(())
    }

    pub async fn run_with_pool(
        &self,
        harness_type: &str,
        project: &str,
        _script: &str,
    ) -> Result<(u32, String)> {
        let pooled = self.acquire(harness_type).await?;

        let output =
            format!("Using pooled {} process {} for project {}", harness_type, pooled.pid, project);

        self.release(harness_type, pooled.pid).await?;

        Ok((pooled.pid, output))
    }

    pub async fn health_check(&self) -> RuntimeHealth {
        self.refresh().await;

        let sys = self.system.read().await;
        let node_pool = self.node_pool.read().await;
        let bun_pool = self.bun_pool.read().await;

        let mut healthy = true;
        let mut issues = Vec::new();

        for p in node_pool.iter().chain(bun_pool.iter()) {
            if let Some(proc) = sys.process(Pid::from_u32(p.pid)) {
                if proc.memory() > 1024 * 1024 * 1024 {
                    issues.push(format!(
                        "{} (PID {}) using {} MB - high memory",
                        p.name,
                        p.pid,
                        proc.memory() / 1024 / 1024
                    ));
                }
            } else {
                healthy = false;
                issues.push(format!("{} (PID {}) not found - may have crashed", p.name, p.pid));
            }
        }

        RuntimeHealth {
            healthy,
            issues,
            node_in_use: node_pool.iter().filter(|p| p.in_use).count(),
            bun_in_use: bun_pool.iter().filter(|p| p.in_use).count(),
        }
    }

    pub async fn status(&self) -> PoolStatus {
        let node_pool = self.node_pool.read().await;
        let bun_pool = self.bun_pool.read().await;

        PoolStatus {
            node_total: node_pool.len(),
            node_idle: node_pool.iter().filter(|p| !p.in_use).count(),
            bun_total: bun_pool.len(),
            bun_idle: bun_pool.iter().filter(|p| !p.in_use).count(),
            max_per_type: self.max_per_type,
        }
    }
}

#[derive(Debug, Clone)]
pub struct RuntimeHealth {
    pub healthy: bool,
    pub issues: Vec<String>,
    pub node_in_use: usize,
    pub bun_in_use: usize,
}

#[derive(Debug, Clone)]
pub struct PoolStatus {
    pub node_total: usize,
    pub node_idle: usize,
    pub bun_total: usize,
    pub bun_idle: usize,
    pub max_per_type: usize,
}

/// Project resource limits
#[derive(Debug, Clone)]
pub struct ProjectLimits {
    pub memory_limit_mb: u64,
    pub max_processes: usize,
    pub cpu_affinity: Option<Vec<usize>>,
}

impl Default for ProjectLimits {
    fn default() -> Self {
        Self { memory_limit_mb: 1024, max_processes: 10, cpu_affinity: None }
    }
}

/// Project resource manager
pub struct ProjectResources {
    projects: RwLock<HashMap<String, ProjectLimits>>,
    system: Arc<RwLock<System>>,
}

impl Default for ProjectResources {
    fn default() -> Self {
        Self::new()
    }
}

impl ProjectResources {
    pub fn new() -> Self {
        Self {
            projects: RwLock::new(HashMap::new()),
            system: Arc::new(RwLock::new(System::new_all())),
        }
    }

    pub async fn set_limits(&self, name: &str, limits: ProjectLimits) {
        let mut projects = self.projects.write().await;
        projects.insert(name.to_string(), limits);
    }

    pub async fn get_limits(&self, name: &str) -> ProjectLimits {
        let projects = self.projects.read().await;
        projects.get(name).cloned().unwrap_or_default()
    }

    pub async fn check_limits(&self, project: &str) -> Result<ResourceCheck> {
        self.refresh();
        let sys = self.system.read().await;
        let limits = self.get_limits(project).await;

        let mut total_memory = 0u64;
        let mut process_count = 0usize;

        for proc in sys.processes().values() {
            let cmd: Vec<String> = proc.cmd().iter().map(|s| s.to_string()).collect();
            if cmd.iter().any(|c| c.contains(project)) {
                total_memory += proc.memory() / 1024 / 1024;
                process_count += 1;
            }
        }

        let memory_ok = total_memory <= limits.memory_limit_mb;
        let processes_ok = process_count <= limits.max_processes;

        Ok(ResourceCheck {
            memory_mb: total_memory,
            memory_limit_mb: limits.memory_limit_mb,
            memory_ok,
            process_count,
            max_processes: limits.max_processes,
            processes_ok,
            overall_ok: memory_ok && processes_ok,
        })
    }

    fn refresh(&self) {
        let sys = self.system.clone();
        tokio::spawn(async move {
            let mut s = sys.write().await;
            s.refresh_all();
        });
    }
}

#[derive(Debug, Clone)]
pub struct ResourceCheck {
    pub memory_mb: u64,
    pub memory_limit_mb: u64,
    pub memory_ok: bool,
    pub process_count: usize,
    pub max_processes: usize,
    pub processes_ok: bool,
    pub overall_ok: bool,
}

/// Filter for specific process types
#[derive(Debug, Clone)]
pub enum ProcessFilter {
    All,
    ByProject(String),
    ByHarness(String),
}

impl ProcessPool {
    pub async fn find(&self, filter: ProcessFilter) -> Vec<ProcessInfo> {
        self.refresh().await;
        let sys = self.system.read().await;
        let procs = self.processes.read().await;

        let mut result = Vec::new();

        for (pid, managed) in procs.iter() {
            let info =
                ProcessInfo::from_sysinfo(Pid::from_u32(*pid), managed.info.name.clone(), &sys);

            if let Some(info) = info {
                let matches = match filter {
                    ProcessFilter::All => true,
                    ProcessFilter::ByProject(ref proj) => info.project.as_ref() == Some(proj),
                    ProcessFilter::ByHarness(ref harness) => info.harness.as_ref() == Some(harness),
                };

                if matches {
                    result.push(info);
                }
            }
        }

        result
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_process_pool() {
        let pool = ProcessPool::new();

        #[cfg(unix)]
        let (cmd, args) = ("sleep", vec!["1".to_string()]);
        #[cfg(windows)]
        let (cmd, args) = (
            "cmd",
            vec![
                "/C".to_string(),
                "ping".to_string(),
                "127.0.0.1".to_string(),
                "-n".to_string(),
                "2".to_string(),
            ],
        );

        let info = pool.spawn(cmd, &args, None, None, None).await;
        assert!(info.is_ok());

        let list = pool.list().await;
        assert!(!list.is_empty());

        pool.kill_all().await.unwrap();
    }
}
