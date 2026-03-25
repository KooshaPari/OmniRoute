//! Process runtime management with shared pool support

use anyhow::{bail, Result};
use std::collections::HashMap;
use std::path::PathBuf;
use std::process::Stdio;
use std::sync::Arc;
use std::time::{Duration, Instant};
use sysinfo::{Pid, System};
use tokio::process::{Child, Command};
use tokio::sync::RwLock;

#[derive(Debug, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub cmd: Vec<String>,
    pub memory_mb: u64,
    pub cpu_percent: f32,
    pub start_time: u64,
    pub project: Option<String>,
    pub harness: Option<String>,
}

impl ProcessInfo {
    pub fn from_sysinfo(pid: Pid, name: String, sys: &System) -> Option<Self> {
        sys.process(pid).map(|p| {
            ProcessInfo {
                pid: pid.as_u32(),
                name,
                cmd: p.cmd().iter().filter_map(|s| s.to_str().map(String::from)).collect(),
                memory_mb: p.memory() / 1024 / 1024,
                cpu_percent: p.cpu_usage(),
                start_time: p.start_time(),
                project: None,
                harness: None,
            }
        })
    }
}

#[derive(Debug)]
pub struct ManagedProcess {
    pub info: ProcessInfo,
    pub child: Option<Child>,
}

pub struct ProcessPool {
    processes: RwLock<HashMap<u32, ManagedProcess>>,
    system: RwLock<System>,
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
            if let Some(info) = ProcessInfo::from_sysinfo(Pid::from_u32(*pid), procs.get(pid).unwrap().info.name.clone(), &sys) {
                result.push(info);
            }
        }
        result
    }

    /// Spawn a new process
    pub async fn spawn(
        &self,
        cmd: &str,
        args: &[String],
        cwd: Option<PathBuf>,
        project: Option<String>,
        harness: Option<String>,
    ) -> Result<ProcessInfo> {
        let mut command = Command::new(cmd);
        command.args(args);

        if let Some(ref path) = cwd {
            command.current_dir(path);
        }

        command.stdout(Stdio::piped());
        command.stderr(Stdio::piped());
        command.stdin(Stdio::null());

        let child = command.spawn()?;

        let pid = child.id().unwrap_or(0);

        // Refresh to get accurate info
        self.refresh().await;

        let info = ProcessInfo {
            pid,
            name: cmd.to_string(),
            cmd: vec![cmd.to_string()].into_iter().chain(args.iter().cloned()).collect(),
            memory_mb: 0,
            cpu_percent: 0.0,
            start_time: 0,
            project,
            harness,
        };

        let managed = ManagedProcess {
            info: info.clone(),
            child: Some(child),
        };

        let mut procs = self.processes.write().await;
        procs.insert(pid, managed);

        Ok(info)
    }

    /// Kill a process by PID
    pub async fn kill(&self, pid: u32) -> Result<()> {
        let mut procs = self.processes.write().await;
        if let Some(managed) = procs.remove(&pid) {
            if let Some(mut child) = managed.child {
                let _ = child.kill().await;
            }
        }
        Ok(())
    }

    /// Kill all managed processes
    pub async fn kill_all(&self) -> Result<()> {
        let mut procs = self.processes.write().await;
        for (_, managed) in procs.drain() {
            if let Some(mut child) = managed.child {
                let _ = child.kill().await;
            }
        }
        Ok(())
    }

    /// Get process by PID
    pub async fn get(&self, pid: u32) -> Option<ProcessInfo> {
        let procs = self.processes.read().await;
        procs.get(&pid).map(|m| m.info.clone())
    }

    /// Check if process is still running
    pub async fn is_running(&self, _pid: u32) -> bool {
        let procs = self.processes.read().await;
        !procs.is_empty()
    }

    /// Get system memory usage
    pub async fn system_memory_usage(&self) -> (u64, u64) {
        let sys = self.system.read().await;
        (sys.used_memory() / 1024 / 1024, sys.total_memory() / 1024 / 1024)
    }

    /// Get total managed memory
    pub async fn total_managed_memory(&self) -> u64 {
        let procs = self.processes.read().await;
        procs.values().map(|m| m.info.memory_mb).sum()
    }
}

/// Shared runtime pool for node/bun processes
pub struct SharedRuntime {
    /// Pooled node processes
    node_pool: RwLock<Vec<PooledProcess>>,
    /// Pooled bun processes
    bun_pool: RwLock<Vec<PooledProcess>>,
    /// Max instances per runtime type
    max_per_type: usize,
    /// System reference
    system: Arc<RwLock<System>>,
    /// Last health check
    last_health_check: RwLock<Instant>,
}

#[derive(Debug, Clone)]
pub struct PooledProcess {
    pub pid: u32,
    pub name: String,
    pub memory_mb: u64,
    pub cpu_percent: f32,
    pub start_time: u64,
    pub in_use: bool,
    pub last_used: Instant,
    pub project: Option<String>,
}

impl SharedRuntime {
    pub fn new(max_per_type: usize) -> Self {
        Self {
            node_pool: RwLock::new(Vec::new()),
            bun_pool: RwLock::new(Vec::new()),
            max_per_type,
            system: Arc::new(RwLock::new(System::new_all())),
            last_health_check: RwLock::new(Instant::now()),
        }
    }

    /// Refresh system info
    pub async fn refresh(&self) {
        let mut sys = self.system.write().await;
        sys.refresh_all();
    }

    /// Get a pooled process for a harness type
    pub async fn acquire(&self, harness_type: &str) -> Result<PooledProcess> {
        let pool = match harness_type {
            "node" => &self.node_pool,
            "bun" => &self.bun_pool,
            _ => bail!("Unsupported harness type: {}. Use 'node' or 'bun'", harness_type),
        };

        let mut pool_guard = pool.write().await;

        // Try to find an idle pooled process
        if let Some(idx) = pool_guard.iter().position(|p| !p.in_use) {
            pool_guard[idx].in_use = true;
            pool_guard[idx].last_used = Instant::now();
            return Ok(pool_guard[idx].clone());
        }

        // Check if we can spawn a new one
        if pool_guard.len() < self.max_per_type {
            // Spawn new pooled process
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

            // Wait a moment for process to start
            tokio::time::sleep(Duration::from_millis(100)).await;
            self.refresh().await;

            let sys = self.system.read().await;
            let pooled = if let Some(p) = sys.process(Pid::from_u32(pid)) {
                PooledProcess {
                    pid,
                    name: name.to_string(),
                    memory_mb: p.memory() / 1024 / 1024,
                    cpu_percent: p.cpu_usage(),
                    start_time: p.start_time(),
                    in_use: true,
                    last_used: Instant::now(),
                    project: None,
                }
            } else {
                bail!("Failed to spawn pooled process");
            };

            pool_guard.push(pooled.clone());
            Ok(pooled)
        } else {
            bail!("Pool exhausted: max {} instances of {} allowed", self.max_per_type, harness_type);
        }
    }

    /// Release a pooled process back to the pool
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

    /// Run a command using a pooled process
    pub async fn run_with_pool(&self, harness_type: &str, project: &str, script: &str) -> Result<(u32, String)> {
        let pooled = self.acquire(harness_type).await?;

        // In a real implementation, this would run the script via IPC
        // For now, we just return the pooled process info
        let output = format!("Using pooled {} process {} for project {}", harness_type, pooled.pid, project);

        self.release(harness_type, pooled.pid).await?;

        Ok((pooled.pid, output))
    }

    /// Health check for pooled processes
    pub async fn health_check(&self) -> RuntimeHealth {
        self.refresh().await;

        let sys = self.system.read().await;
        let node_pool = self.node_pool.read().await;
        let bun_pool = self.bun_pool.read().await;

        let mut healthy = true;
        let mut issues = Vec::new();

        // Check each pooled process
        for p in node_pool.iter().chain(bun_pool.iter()) {
            if let Some(proc) = sys.process(Pid::from_u32(p.pid)) {
                if proc.memory() > 1024 * 1024 * 1024 {
                    // Over 1GB memory
                    issues.push(format!("{} (PID {}) using {} MB - high memory",
                        p.name, p.pid, proc.memory() / 1024 / 1024));
                }
            } else {
                healthy = false;
                issues.push(format!("{} (PID {}) not found - may have crashed", p.name, p.pid));
            }
        }

        RuntimeHealth {
            healthy,
            issues,
            node_count: node_pool.len(),
            bun_count: bun_pool.len(),
            node_in_use: node_pool.iter().filter(|p| p.in_use).count(),
            bun_in_use: bun_pool.iter().filter(|p| p.in_use).count(),
        }
    }

    /// Prune stale pooled processes
    pub async fn prune(&self, idle_threshold: Duration) -> usize {
        let mut pruned = 0;

        // Prune node pool
        {
            let mut pool = self.node_pool.write().await;
            pool.retain(|p| {
                if !p.in_use && p.last_used.elapsed() > idle_threshold {
                    // Kill the process
                    if let Ok(pid) = Pid::from_u32(p.pid).as_u32().try_into() {
                        let _ = nix::sys::signal::kill(
                            nix::unistd::Pid::from_raw(pid),
                            nix::sys::signal::SIGTERM,
                        );
                    }
                    pruned += 1;
                    false
                } else {
                    true
                }
            });
        }

        // Prune bun pool
        {
            let mut pool = self.bun_pool.write().await;
            pool.retain(|p| {
                if !p.in_use && p.last_used.elapsed() > idle_threshold {
                    if let Ok(pid) = Pid::from_u32(p.pid).as_u32().try_into() {
                        let _ = nix::sys::signal::kill(
                            nix::unistd::Pid::from_raw(pid),
                            nix::sys::signal::SIGTERM,
                        );
                    }
                    pruned += 1;
                    false
                } else {
                    true
                }
            });
        }

        pruned
    }

    /// Get pool status
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
    pub node_count: usize,
    pub bun_count: usize,
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
    pub name: String,
    pub memory_limit_mb: u64,
    pub max_processes: usize,
    pub cpu_affinity: Option<Vec<usize>>,
}

impl Default for ProjectLimits {
    fn default() -> Self {
        Self {
            name: "default".to_string(),
            memory_limit_mb: 1024,
            max_processes: 10,
            cpu_affinity: None,
        }
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

    /// Set limits for a project
    pub async fn set_limits(&self, name: &str, limits: ProjectLimits) {
        let mut projects = self.projects.write().await;
        projects.insert(name.to_string(), limits);
    }

    /// Get limits for a project
    pub async fn get_limits(&self, name: &str) -> ProjectLimits {
        let projects = self.projects.read().await;
        projects.get(name).cloned().unwrap_or_default()
    }

    /// Check if project is within resource limits
    pub async fn check_limits(&self, project: &str) -> Result<ResourceCheck> {
        self.refresh();
        let sys = self.system.read().await;
        let limits = self.get_limits(project).await;

        let mut total_memory = 0u64;
        let mut process_count = 0usize;

        // Count processes for this project
        for (pid, proc) in sys.processes() {
            let cmd: Vec<String> = proc.cmd().iter().filter_map(|s| s.to_str().map(String::from)).collect();
            if cmd.iter().any(|c| c.contains(project)) {
                total_memory += proc.memory() / 1024 / 1024;
                process_count += 1;
            }
        }

        let memory_ok = total_memory <= limits.memory_limit_mb;
        let processes_ok = process_count <= limits.max_processes;

        Ok(ResourceCheck {
            project: project.to_string(),
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
        // Trigger refresh
        let sys = self.system.clone();
        tokio::spawn(async move {
            let mut s = sys.write().await;
            s.refresh_all();
        });
    }
}

#[derive(Debug, Clone)]
pub struct ResourceCheck {
    pub project: String,
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
    ByName(String),
    ByProject(String),
    ByHarness(String),
    ByPattern(String),
}

impl ProcessPool {
    /// Find processes matching a filter
    pub async fn find(&self, filter: ProcessFilter) -> Vec<ProcessInfo> {
        self.refresh().await;
        let sys = self.system.read().await;
        let procs = self.processes.read().await;

        let mut result = Vec::new();

        for (pid, managed) in procs.iter() {
            let info = ProcessInfo::from_sysinfo(
                Pid::from_u32(*pid),
                managed.info.name.clone(),
                &sys,
            );

            if let Some(info) = info {
                let matches = match filter {
                    ProcessFilter::All => true,
                    ProcessFilter::ByName(ref name) => info.name.contains(name),
                    ProcessFilter::ByProject(ref proj) => info.project.as_ref() == Some(proj),
                    ProcessFilter::ByHarness(ref harness) => info.harness.as_ref() == Some(harness),
                    ProcessFilter::ByPattern(ref pat) => info.cmd.iter().any(|c| c.contains(pat)),
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

        // Spawn a simple process
        let info = pool.spawn("echo", &["hello".to_string()], None, None, None).await;
        assert!(info.is_ok());

        // List processes
        let list = pool.list().await;
        assert!(!list.is_empty());

        // Kill all
        pool.kill_all().await.unwrap();
    }
}
