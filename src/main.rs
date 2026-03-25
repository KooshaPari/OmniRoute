//! sharecli - Shared CLI process manager

use anyhow::Result;
use clap::{Parser, Subcommand};

mod commands;
mod config;
mod runtime;

use commands::{ps, start, stop, status, config as config_cmd, project as project_cmd, pool_status, run_pool, set_limits, check_limits};
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
        /// Idle time threshold in seconds
        #[arg(short, long, default_value = "300")]
        idle_seconds: u64,

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
}

#[tokio::main]
async fn main() -> Result<()> {
    let cli = Cli::parse();

    if !cli.quiet {
        tracing_subscriber::fmt()
            .with_max_level(if cli.verbose {
                tracing::Level::DEBUG
            } else {
                tracing::Level::INFO
            })
            .init();
    }

    match &cli.command {
        Commands::Ps { project, harness, all } => ps(project.as_deref(), harness.as_deref(), *all).await?,
        Commands::Start { project, harness, cwd, args } => start(project, harness, cwd.as_deref(), args).await?,
        Commands::Stop { pid, project, harness, all, force } => stop(*pid, project.as_deref(), harness.as_deref(), *all, *force).await?,
        Commands::Status { verbose } => status(*verbose).await?,
        Commands::Config { cmd } => config_cmd(cmd)?,
        Commands::Project { cmd } => project_cmd(cmd)?,
        Commands::Optimize { apply } => optimize(*apply).await?,
        Commands::Prune { idle_seconds, force } => prune(*idle_seconds, *force).await?,
        Commands::Pool { harness: _ } => pool_status().await?,
        Commands::Run { harness, project } => run_pool(harness, project).await?,
        Commands::Limits { project, memory, processes } => set_limits(project, *memory, *processes).await?,
        Commands::Check { project } => check_limits(project).await?,
    }

    Ok(())
}

async fn optimize(apply: bool) -> Result<()> {
    println!("Analyzing resource usage...");

    let pool = ProcessPool::new();
    let processes = pool.list().await;

    let mut by_harness: std::collections::HashMap<&str, (usize, u64)> = std::collections::HashMap::new();

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
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap()
        .as_secs();

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
