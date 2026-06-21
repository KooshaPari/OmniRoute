// SPDX-License-Identifier: MIT OR Apache-2.0
/// Example: CLI backup & restore with focus-backup crate.
///
/// Build: cargo run --example backup_restore --manifest-path crates/focus-cli/Cargo.toml -- --help
///
/// Commands:
///   backup create --out <path> [--passphrase-from-env VAR]
///   backup restore --in <path> [--passphrase-from-env VAR]
use anyhow::Result;
use clap::{Parser, Subcommand};
use std::fs;
use std::path::PathBuf;

#[derive(Parser)]
#[command(name = "focus")]
#[command(about = "FocalPoint CLI — screen-time platform")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Backup and restore operations
    Backup {
        #[command(subcommand)]
        action: BackupAction,
    },
}

#[derive(Subcommand)]
enum BackupAction {
    /// Create an encrypted backup
    Create {
        /// Output file path
        #[arg(long)]
        out: PathBuf,

        /// Environment variable containing the passphrase (defaults to prompt)
        #[arg(long)]
        passphrase_from_env: Option<String>,
    },

    /// Restore from an encrypted backup
    Restore {
        /// Input backup file path
        #[arg(long)]
        in_file: PathBuf,

        /// Environment variable containing the passphrase (defaults to prompt)
        #[arg(long)]
        passphrase_from_env: Option<String>,
    },
}

fn main() -> Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Backup { action } => match action {
            BackupAction::Create { out, passphrase_from_env } => {
                let _passphrase = get_passphrase(&passphrase_from_env)?;
                // Placeholder: real impl calls focus_backup::create_backup
                println!("Creating encrypted backup to {}", out.display());
                println!(
                    "Using passphrase from: {}",
                    passphrase_from_env.as_deref().unwrap_or("stdin")
                );
                Ok(())
            }
            BackupAction::Restore { in_file, passphrase_from_env } => {
                let _data = fs::read(&in_file)?;
                let _passphrase = get_passphrase(&passphrase_from_env)?;
                println!("Restoring backup from {}", in_file.display());
                println!(
                    "Using passphrase from: {}",
                    passphrase_from_env.as_deref().unwrap_or("stdin")
                );
                Ok(())
            }
        },
    }
}

fn get_passphrase(env_var: &Option<String>) -> Result<String> {
    if let Some(var) = env_var {
        std::env::var(var).map_err(|e| anyhow::anyhow!("Missing env var {}: {}", var, e))
    } else {
        // In production, use rpassword crate for secure terminal input
        Ok("placeholder-passphrase".to_string())
    }
}
