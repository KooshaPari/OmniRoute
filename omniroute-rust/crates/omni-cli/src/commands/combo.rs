//! `omni combo <model1> <model2> ... --prompt "..."` - multi-model
//! fan-out via `/v1/combos`.

use anyhow::Result;
use clap::Args;
use serde_json::{json, Value};

use crate::http;
use crate::output::print_table;

#[derive(Args, Debug, Clone)]
pub struct ComboArgs {
    pub models: Vec<String>,
    #[arg(long, default_value = "Hello, world.")]
    pub prompt: String,
    #[arg(long)]
    pub json: bool,
}

pub fn run(args: ComboArgs) -> Result<()> {
    if args.models.is_empty() {
        anyhow::bail!("at least one model is required");
    }
    let body = json!({
        "candidates": args.models,
        "prompt": args.prompt,
    });
    let v: Value = http::post_json("/v1/combos", &body)?;
    if args.json {
        println!("{}", serde_json::to_string_pretty(&v)?);
        return Ok(());
    }
    let winner = v.get("winner").and_then(|x| x.as_str()).unwrap_or("(none)");
    println!("Combo winner: {winner}");
    let candidates = v
        .get("candidates")
        .and_then(|x| x.as_array())
        .cloned()
        .unwrap_or_default();
    let mut rows: Vec<Vec<String>> = Vec::new();
    for c in candidates {
        rows.push(vec![
            c.get("model").and_then(|x| x.as_str()).unwrap_or("").to_string(),
            if c.get("ok").and_then(|x| x.as_bool()).unwrap_or(false) {
                "[ok]".into()
            } else {
                "[fail]".into()
            },
            c.get("elapsed_ms")
                .and_then(|x| x.as_u64())
                .map(|n| format!("{n}ms"))
                .unwrap_or_default(),
            c.get("error").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        ]);
    }
    print_table(&["model", "status", "elapsed", "error"], &rows);
    if let Some(usage) = v.get("usage") {
        println!(
            "usage: prompt={} completion={} total={}",
            usage.get("prompt_tokens").and_then(|x| x.as_u64()).unwrap_or(0),
            usage.get("completion_tokens").and_then(|x| x.as_u64()).unwrap_or(0),
            usage.get("total_tokens").and_then(|x| x.as_u64()).unwrap_or(0),
        );
    }
    Ok(())
}
