//! `omni` CLI entrypoint.

use std::process::ExitCode;

use anyhow::Result;
use clap::{Parser, Subcommand};
use tracing_subscriber::EnvFilter;

#[derive(Parser, Debug)]
#[command(name = "omni", version, about = "OmniRoute CLI", long_about = None)]
struct Cli {
    /// Verbose tracing (-v, -vv).
    #[arg(short, long, action = clap::ArgAction::Count)]
    verbose: u8,
    #[command(subcommand)]
    cmd: Cmd,
}

#[derive(Subcommand, Debug)]
enum Cmd {
    /// Start the OmniRoute server in the foreground.
    Serve(omni_cli::commands::serve::ServeArgs),
    /// Print the CLI + server version.
    Version,
    /// Run a series of health checks against the server.
    Doctor,
    /// Initialize a data dir with a default config file.
    Init(omni_cli::commands::init::InitArgs),
    /// List or show models.
    Models {
        #[command(subcommand)]
        action: ModelsCmd,
    },
    /// Manage API keys.
    Keys {
        #[command(subcommand)]
        action: KeysCmd,
    },
    /// Show usage summary for a time window.
    Usage(omni_cli::commands::usage::UsageArgs),
    /// Run a small load bench against `/v1/chat/completions`.
    Bench(omni_cli::commands::bench::BenchArgs),
    /// Multi-model fan-out via `/v1/combos`.
    Combo(omni_cli::commands::combo::ComboArgs),
    /// Run pending migrations.
    Migrate(omni_cli::commands::migrate::MigrateArgs),
    /// Database maintenance.
    Db {
        #[command(subcommand)]
        action: omni_cli::commands::db::DbCommand,
    },
}

#[derive(Subcommand, Debug)]
enum ModelsCmd {
    List(omni_cli::commands::models::ListArgs),
    Show(omni_cli::commands::models::ShowArgs),
}

#[derive(Subcommand, Debug)]
enum KeysCmd {
    List(omni_cli::commands::keys::ListArgs),
    Create(omni_cli::commands::keys::CreateArgs),
    Revoke(omni_cli::commands::keys::RevokeArgs),
}

fn main() -> ExitCode {
    let cli = Cli::parse();
    init_tracing(cli.verbose);
    let res = match cli.cmd {
        Cmd::Serve(a) => omni_cli::commands::traced("serve", || omni_cli::commands::serve::run(a)),
        Cmd::Version => omni_cli::commands::traced("version", omni_cli::commands::version::run),
        Cmd::Doctor => omni_cli::commands::traced("doctor", omni_cli::commands::doctor::run),
        Cmd::Init(a) => omni_cli::commands::traced("init", || omni_cli::commands::init::run(a)),
        Cmd::Models { action } => match action {
            ModelsCmd::List(a) => omni_cli::commands::traced("models list", || omni_cli::commands::models::list(a)),
            ModelsCmd::Show(a) => omni_cli::commands::traced("models show", || omni_cli::commands::models::show(a)),
        },
        Cmd::Keys { action } => match action {
            KeysCmd::List(a) => omni_cli::commands::traced("keys list", || omni_cli::commands::keys::list(a)),
            KeysCmd::Create(a) => omni_cli::commands::traced("keys create", || omni_cli::commands::keys::create(a)),
            KeysCmd::Revoke(a) => omni_cli::commands::traced("keys revoke", || omni_cli::commands::keys::revoke(a)),
        },
        Cmd::Usage(a) => omni_cli::commands::traced("usage", || omni_cli::commands::usage::run(a)),
        Cmd::Bench(a) => omni_cli::commands::traced("bench", || omni_cli::commands::bench::run(a)),
        Cmd::Combo(a) => omni_cli::commands::traced("combo", || omni_cli::commands::combo::run(a)),
        Cmd::Migrate(a) => omni_cli::commands::traced("migrate", || omni_cli::commands::migrate::run(a)),
        Cmd::Db { action } => omni_cli::commands::traced("db", || omni_cli::commands::db::run(action)),
    };
    match res {
        Ok(()) => ExitCode::SUCCESS,
        Err(e) => {
            eprintln!("error: {e:?}");
            ExitCode::FAILURE
        }
    }
}

fn init_tracing(verbose: u8) {
    let level = match verbose {
        0 => "warn",
        1 => "info",
        _ => "debug",
    };
    let filter = EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new(level));
    let _ = tracing_subscriber::fmt()
        .with_env_filter(filter)
        .with_target(false)
        .without_time()
        .try_init();
}
