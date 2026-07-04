//! CLI commands for sharecli

pub mod cast;
pub mod serve;
pub use serve::run as serve_run;

use std::path::PathBuf;
use std::sync::Arc;

use anyhow::Result;

use crate::config::{self, Config, ConfigCmd, ProjectCmd};
use crate::runtime::{
    ProcessFilter, ProcessInfo, ProcessPool, ProjectLimits, ProjectResources, SharedRuntime,
};
use crate::spawn_policy::SpawnPolicy;

/// Shared runtime instance
static SHARED_RUNTIME: std::sync::OnceLock<SharedRuntime> = std::sync::OnceLock::new();

fn get_shared_runtime() -> &'static SharedRuntime {
    SHARED_RUNTIME.get_or_init(|| {
        let max = config::global().pool.max_per_type;
        SharedRuntime::new(max)
    })
}

/// Project resources instance
static PROJECT_RESOURCES: std::sync::OnceLock<ProjectResources> = std::sync::OnceLock::new();

fn get_project_resources() -> &'static ProjectResources {
    PROJECT_RESOURCES.get_or_init(ProjectResources::new)
}

/// List processes
pub async fn ps(project: Option<&str>, harness: Option<&str>, all: bool) -> Result<()> {
    let pool = ProcessPool::new();
    let filter = if let Some(p) = project {
        ProcessFilter::ByProject(p.to_string())
    } else if let Some(h) = harness {
        ProcessFilter::ByHarness(h.to_string())
    } else {
        ProcessFilter::All
    };
    let _ = all;

    let processes: Vec<ProcessInfo> = pool.find(filter).await;

    println!("{:<8} {:<20} {:<12} {:<15} HARNESS", "PID", "NAME", "MEM(MB)", "PROJECT");
    println!("{}", "-".repeat(70));

    for proc in &processes {
        let project = proc.project.as_deref().unwrap_or("-");
        let harness = proc.harness.as_deref().unwrap_or("-");
        println!(
            "{:<8} {:<20} {:<12.1} {:<15} {}",
            proc.pid, proc.name, proc.memory_mb as f64, project, harness
        );
    }

    let total_mem: u64 = processes.iter().map(|p| p.memory_mb).sum();
    println!("\nTotal: {} processes, {} MB memory", processes.len(), total_mem);

    Ok(())
}

/// Start a harness process
pub async fn start(project: &str, harness: &str, cwd: Option<&str>, args: &[String]) -> Result<()> {
    let cfg = Config::load()?;

    let project_path = if let Some(c) = cwd {
        PathBuf::from(expand_path(c))
    } else if let Some(path) = cfg.projects.get(project) {
        PathBuf::from(expand_path(path))
    } else {
        anyhow::bail!(
            "Unknown project: {}. Add with 'sharecli project add <name> <path>'",
            project
        );
    };

    if !project_path.exists() {
        anyhow::bail!("Project path does not exist: {:?}", project_path);
    }

    // Apply the spawn-policy throttle when the harness is a build harness (cargo/rustc/…).
    // The policy is constructed from the global config's [spawn_policy] section.
    let pool = {
        let policy = SpawnPolicy::new(cfg.spawn_policy.clone());
        ProcessPool::with_spawn_policy(Arc::new(policy))
    };
    println!("Starting {} harness for project '{}'...", harness, project);

    let info = pool
        .spawn(
            harness,
            args,
            Some(project_path.clone()),
            Some(project.to_string()),
            Some(harness.to_string()),
        )
        .await?;

    println!("Started process {} ({})", info.pid, info.name);
    println!("Working directory: {:?}", project_path);

    Ok(())
}

/// Stop processes
pub async fn stop(
    pid: Option<u32>,
    project: Option<&str>,
    harness: Option<&str>,
    all: bool,
    _force: bool,
) -> Result<()> {
    let pool = ProcessPool::new();

    if all {
        println!("Stopping all managed processes...");
        pool.kill_all().await?;
        println!("All processes stopped.");
        return Ok(());
    }

    if let Some(p) = pid {
        println!("Stopping process {}...", p);
        pool.kill(p).await?;
        println!("Process {} stopped.", p);
        return Ok(());
    }

    let filter = if let Some(proj) = project {
        ProcessFilter::ByProject(proj.to_string())
    } else if let Some(h) = harness {
        ProcessFilter::ByHarness(h.to_string())
    } else {
        anyhow::bail!("Specify --pid, --project, --harness, or --all to select what to stop");
    };

    let processes = pool.find(filter).await;
    for proc in processes {
        pool.kill(proc.pid).await?;
        println!("Stopped {} ({})", proc.pid, proc.name);
    }

    Ok(())
}

/// Check process status
pub async fn status(verbose: bool) -> Result<()> {
    let pool = ProcessPool::new();
    let processes: Vec<ProcessInfo> = pool.list().await;

    let mut by_harness: std::collections::HashMap<&str, (usize, u64)> =
        std::collections::HashMap::new();

    for proc in &processes {
        let h = proc.harness.as_deref().unwrap_or("unknown");
        let entry = by_harness.entry(h).or_insert((0, 0));
        entry.0 += 1;
        entry.1 += proc.memory_mb;
    }

    println!("=== Process Status ===\n");
    println!("Total: {} processes\n", processes.len());

    println!("{:<15} {:<10} {:<15}", "HARNESS", "COUNT", "MEMORY(MB)");
    println!("{}", "-".repeat(40));

    for (h, (count, mem)) in by_harness.iter() {
        println!("{:<15} {:<10} {:<15}", h, count, mem);
    }

    // Show pool status
    let runtime = get_shared_runtime();
    let pool_status = runtime.status().await;
    println!("\n=== Shared Runtime Pool ===\n");
    println!("{:<10} {:<10} {:<10}", "TYPE", "TOTAL", "IDLE");
    println!("{}", "-".repeat(30));
    println!("{:<10} {:<10} {:<10}", "node", pool_status.node_total, pool_status.node_idle);
    println!("{:<10} {:<10} {:<10}", "bun", pool_status.bun_total, pool_status.bun_idle);
    println!("\nMax per type: {}", pool_status.max_per_type);

    // Show system memory
    let (used, total) = pool.system_memory_usage().await;
    println!("\n=== System Memory ===\n");
    println!("Used: {} MB / {} MB ({}%)", used, total, (used * 100) / total);

    if verbose {
        println!("\n=== Detailed Process List ===\n");
        for proc in &processes {
            println!("PID: {}, Name: {}, Memory: {} MB", proc.pid, proc.name, proc.memory_mb);
            if !proc.cmd.is_empty() {
                println!("  Cmd: {}", proc.cmd.join(" "));
            }
        }
    }

    Ok(())
}

/// Configuration management
pub fn config(cfg_cmd: &ConfigCmd) -> Result<()> {
    match cfg_cmd {
        ConfigCmd::Init => {
            Config::init()?;
            println!("Configuration initialized.");
        }
        ConfigCmd::Validate => {
            let cfg = Config::load()?;
            println!("Configuration is valid.");
            println!("  Projects: {}", cfg.projects.len());
        }
        ConfigCmd::Show => {
            let cfg = Config::load()?;
            let serialized = toml::to_string_pretty(&cfg)?;
            println!("{}", serialized);
        }
        ConfigCmd::Get { key: _ } => {
            let cfg = Config::load()?;
            println!("Projects:");
            for (name, path) in &cfg.projects {
                println!("  {} = {}", name, path);
            }
        }
        ConfigCmd::Set { .. } => {
            println!("Set not implemented yet.");
        }
    }
    Ok(())
}

/// Project management
pub fn project(proj_cmd: &ProjectCmd) -> Result<()> {
    match proj_cmd {
        ProjectCmd::Add { name, path } => {
            let mut cfg = Config::load()?;
            cfg.projects.insert(name.clone(), expand_path(path));
            cfg.save()?;
            println!("Added project '{}'", name);
        }
        ProjectCmd::Remove { name } => {
            let mut cfg = Config::load()?;
            if cfg.projects.remove(name).is_some() {
                cfg.save()?;
                println!("Removed project '{}'", name);
            }
        }
        ProjectCmd::List => {
            let cfg = Config::load()?;
            if cfg.projects.is_empty() {
                println!("No projects registered. Run 'sharecli project discover'.");
            } else {
                println!("Registered Projects:");
                for (name, path) in &cfg.projects {
                    println!("  {} -> {}", name, path);
                }
            }
        }
        ProjectCmd::Show { name } => {
            let cfg = Config::load()?;
            if let Some(path) = cfg.projects.get(name) {
                println!("Project: {}", name);
                println!("Path:    {}", path);
                println!("Exists:  {}", std::path::Path::new(path).exists());
            }
        }
        ProjectCmd::Discover { path } => {
            let cfg = config::global();
            let base =
                PathBuf::from(expand_path(path.as_deref().unwrap_or(&cfg.paths.discovery_path)));
            println!("Scanning {:?} for projects...", base);

            let mut found = Vec::new();
            if let Ok(entries) = std::fs::read_dir(&base) {
                for entry in entries.flatten() {
                    let p = entry.path();
                    if p.is_dir() && p.join(".git").exists() {
                        let name =
                            p.file_name().and_then(|n| n.to_str()).unwrap_or("unknown").to_string();
                        found.push((name, p.to_string_lossy().to_string()));
                    }
                }
            }

            println!("\nFound {} projects:", found.len());
            for (name, path) in &found {
                println!("  {} -> {}", name, path);
            }
        }
        ProjectCmd::Generate { output } => {
            let cfg = config::global();
            let out_path = PathBuf::from(expand_path(
                output.as_deref().unwrap_or(&cfg.paths.default_compose_output),
            ));

            let sharewei_port = cfg.port.sharewei_port;
            let mut yaml = format!("# Generated by sharecli\nversion: \"0.5\"\n\nenv:\n  - SHAREWEI_PORT={}\n\nservices:\n", sharewei_port);

            for name in cfg.projects.keys() {
                yaml.push_str(&format!(
                    r#"  {}-agent:
    command: sharecli run --harness {} --project {}
    depends_on: {{}}
    log_location: .sharecli/logs/{}.log
    readiness_probe:
      exec:
        command: sharecli health --harness {}
      initial_delay_seconds: 5
      period_seconds: 10
      failure_threshold: 3

"#,
                    name, name, name, name, name
                ));
            }

            std::fs::write(&out_path, &yaml)?;
            println!("Generated process-compose.yml with {} services", cfg.projects.len());
            println!("Written to: {:?}", out_path);
        }
    }
    Ok(())
}

/// Run using pooled runtime
pub async fn run_pool(harness_type: &str, project: &str) -> Result<()> {
    let runtime = get_shared_runtime();
    let result = runtime.run_with_pool(harness_type, project, "").await?;
    println!("Pooled {} process {} for project {}", harness_type, result.0, project);
    println!("Output: {}", result.1);
    Ok(())
}

/// Show pool status
pub async fn pool_status() -> Result<()> {
    let runtime = get_shared_runtime();
    let status = runtime.status().await;

    println!("=== Shared Runtime Pool Status ===\n");
    println!("{:<10} {:<10} {:<10} {:<10}", "TYPE", "TOTAL", "IDLE", "MAX");
    println!("{}", "-".repeat(40));
    println!(
        "{:<10} {:<10} {:<10} {:<10}",
        "node", status.node_total, status.node_idle, status.max_per_type
    );
    println!(
        "{:<10} {:<10} {:<10} {:<10}",
        "bun", status.bun_total, status.bun_idle, status.max_per_type
    );
    println!("\nMax per type: {}", status.max_per_type);

    // Health check
    let health = runtime.health_check().await;
    println!("\n=== Health Check ===");
    if health.healthy {
        println!("Status: HEALTHY");
    } else {
        println!("Status: DEGRADED");
    }
    if !health.issues.is_empty() {
        println!("\nIssues:");
        for issue in &health.issues {
            println!("  - {}", issue);
        }
    }

    Ok(())
}

/// Run health probe for shared runtime
pub async fn health(harness: Option<&str>) -> Result<()> {
    if let Some(h) = harness {
        println!("Health probe requested for harness '{}'.", h);
        if h != "node" && h != "bun" {
            println!("Note: only the pooled node/bun runtimes are tracked currently.");
        }
    }

    let runtime = get_shared_runtime();
    let pool_status = runtime.status().await;
    let health = runtime.health_check().await;

    println!("\nShared runtime health: {}", if health.healthy { "HEALTHY" } else { "DEGRADED" });

    if !health.issues.is_empty() {
        println!("\nIssues detected:");
        for issue in &health.issues {
            println!("  - {}", issue);
        }
    } else {
        println!("No runtime issues detected.");
    }

    println!("\nPool summary:");
    println!(
        "  node: {} total, {} idle, {} in use",
        pool_status.node_total, pool_status.node_idle, health.node_in_use
    );
    println!(
        "  bun:  {} total, {} idle, {} in use",
        pool_status.bun_total, pool_status.bun_idle, health.bun_in_use
    );
    println!("\nMax per harness type: {}", pool_status.max_per_type);

    Ok(())
}

/// Set project limits
pub async fn set_limits(
    project: &str,
    memory_mb: Option<u64>,
    max_procs: Option<usize>,
) -> Result<()> {
    let resources = get_project_resources();
    let current = resources.get_limits(project).await;

    let memory_limit = memory_mb.unwrap_or(current.memory_limit_mb);
    let max_processes = max_procs.unwrap_or(current.max_processes);

    let limits = ProjectLimits {
        memory_limit_mb: memory_limit,
        max_processes,
        cpu_affinity: current.cpu_affinity,
    };

    resources.set_limits(project, limits).await;
    println!("Set limits for project '{}':", project);
    println!("  Memory: {} MB", memory_limit);
    println!("  Max processes: {}", max_processes);
    Ok(())
}

/// Check project limits
pub async fn check_limits(project: &str) -> Result<()> {
    let resources = get_project_resources();
    let check = resources.check_limits(project).await?;

    println!("=== Resource Limits for '{}' ===\n", project);

    println!("Memory: {} MB / {} MB", check.memory_mb, check.memory_limit_mb);
    if check.memory_ok {
        println!("  Status: OK");
    } else {
        println!("  Status: EXCEEDED (over by {} MB)", check.memory_mb - check.memory_limit_mb);
    }

    println!("\nProcesses: {} / {}", check.process_count, check.max_processes);
    if check.processes_ok {
        println!("  Status: OK");
    } else {
        println!("  Status: EXCEEDED (over by {})", check.process_count - check.max_processes);
    }

    println!("\nOverall: {}", if check.overall_ok { "OK" } else { "LIMIT EXCEEDED" });

    Ok(())
}

fn expand_path(path: &str) -> String {
    if path.starts_with("~/") {
        if let Ok(home) = std::env::var("HOME") {
            return path.replacen("~/", &format!("{}/", home), 1);
        }
    }
    path.to_string()
}
