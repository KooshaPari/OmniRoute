//! `omni` subcommand modules. Each module exposes a top-level function
//! `run(args) -> Result<()>` that the binary dispatches to.

pub mod version;
pub mod doctor;
pub mod models;
pub mod keys;
pub mod usage;
pub mod combo;
pub mod bench;
pub mod migrate;
pub mod db;
pub mod init;
pub mod serve;

use std::time::Instant;

use anyhow::Result;
use tracing::info;

/// Run a subcommand with a tracing span. The wrapper handles the
/// start/done logs and the elapsed time.
pub fn traced<F: FnOnce() -> Result<()>>(name: &str, f: F) -> Result<()> {
    let start = Instant::now();
    info!(command = name, "starting");
    let res = f();
    match &res {
        Ok(()) => info!(command = name, elapsed_ms = start.elapsed().as_millis() as u64, "done"),
        Err(e) => info!(command = name, elapsed_ms = start.elapsed().as_millis() as u64, error = %e, "failed"),
    }
    res
}

/// Parse a `--since` duration like `1h`, `24h`, `7d`, `30m`, `15s` into a
/// `chrono::DateTime<Utc>` representing the moment that far in the past.
pub fn parse_since(s: &str) -> Result<chrono::DateTime<chrono::Utc>> {
    use chrono::{Duration, Utc};
    if s.is_empty() {
        anyhow::bail!("--since cannot be empty");
    }
    let (num, unit) = s.split_at(s.len() - 1);
    let n: i64 = num.parse().with_context(|| format!("parse --since: {s:?}"))?;
    let dur = match unit {
        "s" => Duration::seconds(n),
        "m" => Duration::minutes(n),
        "h" => Duration::hours(n),
        "d" => Duration::days(n),
        "w" => Duration::weeks(n),
        other => anyhow::bail!("unsupported duration unit {other:?} in --since"),
    };
    Ok(Utc::now() - dur)
}

use anyhow::Context;
