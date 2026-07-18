//! omniroute-cli: command-line interface (clap v4).
//!
//! Scaffold from `absorb/omniroute-rs` — full command modules land in follow-up PRs.

#![deny(unsafe_code)]
#![warn(missing_docs)]

/// CLI entry for the `omniroute` binary.
pub fn run() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env().unwrap_or_else(|_| "info".into()),
        )
        .try_init()
        .ok();
    tracing::info!("omniroute CLI scaffold; command surface lands in follow-up PRs");
    Ok(())
}
