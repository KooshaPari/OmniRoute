//! `omni migrate` - run pending SQLite migrations against the local
//! `omni-server` data dir.

use std::path::PathBuf;

use anyhow::{Context, Result};
use clap::Args;
use omni_storage::migrations;

#[derive(Args, Debug, Clone)]
pub struct MigrateArgs {
    /// Data directory. Defaults to `./.data`.
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
    /// Don't actually apply; just report what would happen.
    #[arg(long)]
    pub dry_run: bool,
}

pub fn run(args: MigrateArgs) -> Result<()> {
    let dir = args
        .data_dir
        .clone()
        .unwrap_or_else(|| PathBuf::from("./.data"));
    println!("Migrating data dir: {}", dir.display());
    if args.dry_run {
        println!("dry-run: would open and apply migrations");
        return Ok(());
    }
    let runtime = tokio::runtime::Runtime::new().context("start tokio runtime")?;
    runtime.block_on(async {
        let pool = omni_storage::StoragePool::open(&dir)
            .await
            .with_context(|| format!("open storage at {}", dir.display()))?;
        migrations::run(pool.pool())
            .await
            .with_context(|| "apply migrations")?;
        anyhow::Ok(())
    })?;
    println!("applied migrations");
    Ok(())
}
