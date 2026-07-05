//! `omni serve` - fork the `omni-server` binary. Streams stdout/stderr
//! to the parent. Ctrl-C kills the child.

use std::path::PathBuf;
use std::process::{Child, Command, Stdio};

use anyhow::{Context, Result};
use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct ServeArgs {
    #[arg(long)]
    pub bind: Option<String>,
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
    /// Don't auto-seed providers from environment variables.
    #[arg(long)]
    pub no_seed: bool,
}

pub fn run(args: ServeArgs) -> Result<()> {
    // Resolve the child binary. In dev mode we use `cargo run -p omni-server`;
    // in installed mode we expect `omni-server` on PATH.
    let (program, mut cargs) = if let Ok(p) = which("omni-server") {
        (p, Vec::new())
    } else {
        (
            PathBuf::from("cargo"),
            vec!["run".to_string(), "-p".to_string(), "omni-server".to_string(), "--quiet".to_string()],
        )
    };
    if let Some(b) = &args.bind {
        cargs.push("--bind".to_string());
        cargs.push(b.clone());
    }
    if let Some(d) = &args.data_dir {
        cargs.push("--data-dir".to_string());
        cargs.push(d.display().to_string());
    }
    let mut cmd = Command::new(&program);
    cmd.args(&cargs)
        .stdin(Stdio::null())
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit());
    let mut child: Child = cmd
        .spawn()
        .with_context(|| format!("spawn {program:?} with args {cargs:?}"))?;
    println!("omni-server started (pid {})", child.id());
    let status = child.wait().context("wait for omni-server")?;
    let code = status.code().unwrap_or(-1);
    println!("omni-server exited with code {code}");
    if status.success() {
        Ok(())
    } else {
        anyhow::bail!("omni-server exited with code {code}")
    }
}

/// Minimal `which` implementation: searches PATH for the given binary.
fn which(bin: &str) -> Result<PathBuf> {
    let path = std::env::var_os("PATH").context("PATH is unset")?;
    for dir in std::env::split_paths(&path) {
        let p = dir.join(bin);
        if p.is_file() {
            return Ok(p);
        }
    }
    anyhow::bail!("{bin} not found on PATH")
}
