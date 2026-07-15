//! `omni db backup|restore|doctor` - SQLite maintenance.

use std::path::{Path, PathBuf};

use anyhow::{Context, Result};
use clap::{Args, Subcommand};

#[derive(Subcommand, Debug, Clone)]
pub enum DbCommand {
    /// Copy the SQLite database (and -wal / -shm) to a target file.
    Backup(BackupArgs),
    /// Restore a previously backed-up database.
    Restore(RestoreArgs),
    /// Run integrity_check + report journal mode.
    Doctor(DoctorArgs),
}

#[derive(Args, Debug, Clone)]
pub struct BackupArgs {
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
    #[arg(long)]
    pub out: PathBuf,
}

#[derive(Args, Debug, Clone)]
pub struct RestoreArgs {
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
    #[arg(long)]
    pub r#in: PathBuf,
}

#[derive(Args, Debug, Clone)]
pub struct DoctorArgs {
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
}

pub fn run(cmd: DbCommand) -> Result<()> {
    match cmd {
        DbCommand::Backup(a) => backup(a),
        DbCommand::Restore(a) => restore(a),
        DbCommand::Doctor(a) => doctor(a),
    }
}

fn resolve_dir(d: Option<PathBuf>) -> PathBuf {
    d.unwrap_or_else(|| PathBuf::from("./.data"))
}

fn db_path(dir: &Path) -> PathBuf {
    dir.join("storage.sqlite")
}

fn copy_file(src: &Path, dst: &Path) -> Result<()> {
    if let Some(parent) = dst.parent() {
        std::fs::create_dir_all(parent)
            .with_context(|| format!("create parent of {}", dst.display()))?;
    }
    std::fs::copy(src, dst)
        .with_context(|| format!("copy {} -> {}", src.display(), dst.display()))?;
    Ok(())
}

fn backup(args: BackupArgs) -> Result<()> {
    let dir = resolve_dir(args.data_dir);
    let db = db_path(&dir);
    if !db.exists() {
        anyhow::bail!("database not found at {}", db.display());
    }
    let out = &args.out;
    copy_file(&db, out)?;
    for suffix in ["wal", "shm"] {
        let mut s = db.clone();
        s.set_extension(suffix);
        if s.exists() {
            let mut dst = out.to_path_buf();
            dst.set_extension(suffix);
            copy_file(&s, &dst)?;
        }
    }
    let size = std::fs::metadata(out)?.len();
    println!("backup written: {} ({} bytes)", out.display(), size);
    Ok(())
}

fn restore(args: RestoreArgs) -> Result<()> {
    let dir = resolve_dir(args.data_dir);
    let db = db_path(&dir);
    if db.exists() {
        anyhow::bail!(
            "refusing to restore over an existing database at {}. Move the existing file aside first.",
            db.display()
        );
    }
    if !args.r#in.exists() {
        anyhow::bail!("backup file not found: {}", args.r#in.display());
    }
    std::fs::create_dir_all(&dir)?;
    copy_file(&args.r#in, &db)?;
    for suffix in ["wal", "shm"] {
        let mut s = args.r#in.clone();
        s.set_extension(suffix);
        if s.exists() {
            let mut dst = db.clone();
            dst.set_extension(suffix);
            copy_file(&s, &dst)?;
        }
    }
    println!("restored to {}", db.display());
    Ok(())
}

fn doctor(args: DoctorArgs) -> Result<()> {
    let dir = resolve_dir(args.data_dir);
    let db = db_path(&dir);
    if !db.exists() {
        anyhow::bail!("database not found at {}", db.display());
    }
    let runtime = tokio::runtime::Runtime::new().context("start tokio runtime")?;
    runtime.block_on(async {
        let pool = omni_storage::StoragePool::open(&dir)
            .await
            .with_context(|| format!("open storage at {}", dir.display()))?;
        let integrity: (String,) = sqlx::query_as("PRAGMA integrity_check")
            .fetch_one(pool.pool())
            .await
            .context("PRAGMA integrity_check")?;
        let journal: (String,) = sqlx::query_as("PRAGMA journal_mode")
            .fetch_one(pool.pool())
            .await
            .context("PRAGMA journal_mode")?;
        println!("integrity: {}", integrity.0);
        println!("journal_mode: {}", journal.0);
        anyhow::Ok(())
    })?;
    Ok(())
}
