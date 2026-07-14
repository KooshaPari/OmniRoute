//! `omni init` - create a fresh data dir with a default `omniroute.yaml`.

use std::path::PathBuf;

use anyhow::Result;
use clap::Args;

#[derive(Args, Debug, Clone)]
pub struct InitArgs {
    #[arg(long)]
    pub data_dir: Option<PathBuf>,
}

pub fn run(args: InitArgs) -> Result<()> {
    let dir = args
        .data_dir
        .clone()
        .unwrap_or_else(|| PathBuf::from("./.data"));
    std::fs::create_dir_all(&dir)?;
    let yaml = dir.join("omniroute.yaml");
    let body = "# Default OmniRoute config - edit and reload with SIGHUP.\nserver:\n  bind: 127.0.0.1:9090\n  require_auth: true\n  record_usage: true\nproviders:\n  # Provide API keys via env vars; the server auto-seeds on boot.\n  # OPENAI_API_KEY, ANTHROPIC_API_KEY, GROQ_API_KEY, OPENROUTER_API_KEY, ...\n";
    if !yaml.exists() {
        std::fs::write(&yaml, body)?;
        println!("wrote {}", yaml.display());
    } else {
        println!("{} already exists; leaving it alone", yaml.display());
    }
    println!("next steps:");
    println!("  - export OMNI_DATA_DIR={}", dir.display());
    println!("  - export OPENAI_API_KEY=sk-...   # or any other provider");
    println!("  - cargo run -p omni-server --release");
    Ok(())
}
