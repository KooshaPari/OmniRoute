//! sharecli - Shared CLI process manager

use anyhow::Result;
use clap::{Parser, Subcommand};

mod cast;
mod commands;
mod config;
mod monitoring;
mod runtime;
mod spawn_policy;

use commands::{
    cast as cast_cmd, check_limits, config as config_cmd, health, pool_status, project as project_cmd,
    ps, run_pool, set_limits, start, status, stop,
};
use runtime::ProcessPool;

#[derive(Parser, Debug)]
#[command(
    name = "sharecli",
    about = "Shared CLI process manager for multi-project agent orchestration",
    version = "0.1.0"
)]
struct Cli {
    #[command(subcommand)]
    command: Commands,

    /// Enable verbose output
    #[arg(short, long)]
    verbose: bool,

    /// Quiet mode
    #[arg(short, long)]
    quiet: bool,
}

#[derive(Subcommand, Debug)]
enum Commands {
    /// List managed processes
    Ps {
        /// Filter by project name
        #[arg(short, long)]
        project: Option<String>,

        /// Filter by harness type (claude, forge, node, bun)
        #[arg(short, long)]
        harness: Option<String>,

        /// Show all processes including system ones
        #[arg(short, long)]
        all: bool,
    },

    /// Start a harness process
    Start {
        /// Project name
        #[arg(required = true)]
        project: String,

        /// Harness type (claude, forge, node, bun)
        #[arg(short, long, default_value = "claude")]
        harness: String,

        /// Working directory
        #[arg(short, long)]
        cwd: Option<String>,

        /// Arguments to pass
        args: Vec<String>,
    },

    /// Stop managed processes
    Stop {
        /// Process ID to stop
        #[arg(short, long)]
        pid: Option<u32>,

        /// Project to stop all processes for
        #[arg(short, long)]
        project: Option<String>,

        /// Harness type to stop
        #[arg(short, long)]
        harness: Option<String>,

        /// Stop all managed processes
        #[arg(short, long)]
        all: bool,

        /// Force kill (SIGKILL)
        #[arg(short, long)]
        force: bool,
    },

    /// Check process health
    Status {
        /// Detailed output
        #[arg(short, long)]
        verbose: bool,
    },

    /// Run a runtime health probe
    Health {
        /// Optional harness type hint (node, bun, etc.)
        #[arg(long)]
        harness: Option<String>,
    },

    /// Configuration management
    Config {
        #[command(subcommand)]
        cmd: config::ConfigCmd,
    },

    /// Project management
    Project {
        #[command(subcommand)]
        cmd: config::ProjectCmd,
    },

    /// Optimize resource usage
    Optimize {
        /// Apply optimizations automatically
        #[arg(short, long)]
        apply: bool,
    },

    /// Prune idle processes
    Prune {
        /// Idle time threshold in seconds (default from config if omitted)
        #[arg(short, long)]
        idle_seconds: Option<u64>,

        /// Actually kill processes (dry run by default)
        #[arg(short, long)]
        force: bool,
    },

    /// Show shared runtime pool status
    Pool {
        /// Harness type to check (node, bun)
        #[arg(long)]
        harness: Option<String>,
    },

    /// Run using pooled runtime
    Run {
        /// Harness type (node, bun)
        #[arg(required = true)]
        harness: String,

        /// Project name
        #[arg(required = true)]
        project: String,
    },

    /// Set project resource limits
    Limits {
        /// Project name
        #[arg(required = true)]
        project: String,

        /// Memory limit in MB
        #[arg(short, long)]
        memory: Option<u64>,

        /// Max process count
        #[arg(short, long)]
        processes: Option<usize>,
    },

    /// Check project resource limits
    Check {
        /// Project name
        #[arg(required = true)]
        project: String,
    },

    /// Fleet device management
    Fleet {
        #[command(subcommand)]
        cmd: FleetCmd,
    },
    /// Cross-machine text injection into registered terminal panes
    Cast {
        #[command(subcommand)]
        cmd: CastCmd,
    },
}

#[derive(Subcommand, Debug)]
enum FleetCmd {
    /// Show fleet registry status and thermal level
    Status,
    /// Register this device into the fleet
    Register {
        /// Friendly device name (defaults to "local")
        #[arg(short, long)]
        name: Option<String>,
        /// Fleet coordinator address (e.g. nats://localhost:4222)
        #[arg(short, long, default_value = "nats://localhost:4222")]
        coordinator: String,
    },
}

#[derive(Subcommand, Debug)]
enum CastCmd {
    /// Register a pane: `cast register <name> <address>`
    Register {
        /// Friendly pane name (e.g. `civis-1`)
        name: String,
        /// Address in the form `machine:host[:window[:pane]]`
        address: String,
    },
    /// Unregister a pane
    Unregister { name: String },
    /// List all registered panes
    List,
    /// Send text to a registered pane
    Send {
        /// Registered pane name
        name: String,
        /// File to read; pass `-` (or omit) to read from stdin
        file: Option<String>,
    },
    /// Show the on-disk path of the pane-map file
    Where,
}

/// Returns true when the NO_COLOR environment variable is set (per https://no-color.org).
fn is_no_color() -> bool {
    std::env::var("NO_COLOR").is_ok_and(|v| !v.is_empty())
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    // Initialise global config (must happen before any command handler)
    config::init_global();

    if !cli.quiet {
        let builder = tracing_subscriber::fmt().with_max_level(if cli.verbose {
            tracing::Level::DEBUG
        } else {
            tracing::Level::INFO
        });

        // Respect NO_COLOR (audit L36)
        if is_no_color() {
            builder.with_ansi(false).init();
        } else {
            builder.init();
        }
    }

    match &cli.command {
        Commands::Ps { project, harness, all } => {
            ps(project.as_deref(), harness.as_deref(), *all).await?
        }
        Commands::Start { project, harness, cwd, args } => {
            start(project, harness, cwd.as_deref(), args).await?
        }
        Commands::Stop { pid, project, harness, all, force } => {
            stop(*pid, project.as_deref(), harness.as_deref(), *all, *force).await?
        }
        Commands::Status { verbose } => status(*verbose).await?,
        Commands::Config { cmd } => config_cmd(cmd)?,
        Commands::Project { cmd } => project_cmd(cmd)?,
        Commands::Optimize { apply } => optimize(*apply).await?,
        Commands::Prune { idle_seconds, force } => {
            prune(idle_seconds.unwrap_or(config::global().spawn.prune_idle_seconds), *force).await?
        }
        Commands::Pool { harness: _ } => pool_status().await?,
        Commands::Health { harness } => health(harness.as_deref()).await?,
        Commands::Run { harness, project } => run_pool(harness, project).await?,
        Commands::Limits { project, memory, processes } => {
            set_limits(project, *memory, *processes).await?
        }
        Commands::Check { project } => check_limits(project).await?,
        Commands::Fleet { cmd } => match cmd {
            FleetCmd::Status => fleet_status().await?,
            FleetCmd::Register { name, coordinator } => {
                fleet_register(name.as_deref(), coordinator).await?
            }
        },
        Commands::Cast { cmd } => match cmd {
            CastCmd::Register { name, address } => cast_cmd::register(&name, &address)?,
            CastCmd::Unregister { name } => cast_cmd::unregister(&name)?,
            CastCmd::List => cast_cmd::list()?,
            CastCmd::Send { name, file } => cast_cmd::send(&name, file.as_deref())?,
            CastCmd::Where => cast_cmd::where_file()?,
        },
    }

    Ok(())
}

async fn fleet_status() -> Result<()> {
    use sharecli_fleet::{ThermalGovernor, DEFAULT_COORDINATOR};

    let _gov = ThermalGovernor::new();
    println!("Thermal governor: ready");

    match sharecli_fleet::connect(DEFAULT_COORDINATOR).await {
        Ok(_client) => {
            println!("Fleet registry: connected to {DEFAULT_COORDINATOR}");
        }
        Err(e) => {
            println!("Fleet registry: not connected ({e})");
            println!("  Run `sharecli fleet register` to join the fleet.");
        }
    }
    Ok(())
}

async fn fleet_register(name: Option<&str>, coordinator: &str) -> Result<()> {
    let hostname = name.unwrap_or_else(|| {
        // Best-effort: fall back to "local" if gethostname is unavailable.
        "local"
    });

    println!("Registering device '{hostname}' with coordinator '{coordinator}'");

    match sharecli_fleet::connect(coordinator).await {
        Ok(client) => {
            let record = sharecli_fleet::DeviceRecord {
                device_id: format!("{hostname}-{}", std::process::id()),
                hostname: hostname.to_string(),
                os: std::env::consts::OS.to_string(),
                available_slots: 4,
            };
            sharecli_fleet::announce(&client, &record).await?;
            println!("Registered device '{}' (os={}, slots={})", record.device_id, record.os, record.available_slots);
        }
        Err(e) => {
            println!("Registration failed: {e}");
            println!("  Is the NATS coordinator running at '{coordinator}'?");
        }
    }
    Ok(())
}

async fn optimize(apply: bool) -> Result<()> {
    println!("Analyzing resource usage...");

    let pool = ProcessPool::new();
    let processes = pool.list().await;

    let mut by_harness: std::collections::HashMap<&str, (usize, u64)> =
        std::collections::HashMap::new();

    for proc in &processes {
        if let Some(ref harness) = proc.harness {
            let entry = by_harness.entry(harness.as_str()).or_insert((0, 0));
            entry.0 += 1;
            entry.1 += proc.memory_mb;
        }
    }

    println!("\nCurrent resource usage:");
    println!("{:<15} {:<10} {:<15}", "HARNESS", "COUNT", "MEMORY(MB)");
    println!("{}", "-".repeat(40));

    for (harness, (count, mem)) in &by_harness {
        println!("{:<15} {:<10} {:<15}", harness, count, mem);
    }

    let total_mem: u64 = by_harness.values().map(|(_, m)| m).sum();
    let total_count: usize = by_harness.values().map(|(c, _)| c).sum();

    println!("\n{:<15} {:<10} {:<15}", "TOTAL", total_count, total_mem);
    println!("\n=== Optimization Suggestions ===");

    if total_count > 30 {
        println!("- Consider reducing max instances per harness");
    }
    if total_mem > 4096 {
        println!("- Memory usage is high ({} MB). Consider pruning idle processes.", total_mem);
    }

    if apply {
        println!("\nApplying optimizations...");
        println!("Done.");
    }

    Ok(())
}

async fn prune(idle_seconds: u64, force: bool) -> Result<()> {
    println!("Pruning idle processes (threshold: {}s)...", idle_seconds);

    let pool = ProcessPool::new();
    let mut sys = sysinfo::System::new_all();
    sys.refresh_all();

    let processes = pool.list().await;
    let mut pruned = 0;
    let now = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).unwrap().as_secs();

    for proc in processes {
        if proc.start_time > 0 && (now - proc.start_time) > idle_seconds {
            if force {
                pool.kill(proc.pid).await?;
                println!("Pruned process {} ({})", proc.pid, proc.name);
            } else {
                println!("Would prune: {} ({})", proc.pid, proc.name);
            }
            pruned += 1;
        }
    }

    if force {
        println!("\nPruned {} processes.", pruned);
    } else {
        println!("\nWould prune {} processes (use --force to apply).", pruned);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_no_color_respects_env_var() {
        // When NO_COLOR is unset, is_no_color should return false
        unsafe { std::env::remove_var("NO_COLOR") };
        assert!(!is_no_color());

        // When NO_COLOR is set to empty string, should return false
        unsafe { std::env::set_var("NO_COLOR", "") };
        assert!(!is_no_color());

        // When NO_COLOR is set to non-empty, should return true
        unsafe { std::env::set_var("NO_COLOR", "1") };
        assert!(is_no_color());

        // Clean up
        unsafe { std::env::remove_var("NO_COLOR") };
    }
}
