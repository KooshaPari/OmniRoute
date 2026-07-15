//! `omni models list` / `omni models show <id>`

use anyhow::Result;
use clap::Args;
use serde_json::Value;

use crate::http;
use crate::output::print_table;

#[derive(Args, Debug, Clone)]
pub struct ListArgs {
    /// Filter by provider id (matches `owned_by`).
    #[arg(long)]
    pub provider: Option<String>,
    /// Emit JSON instead of a table.
    #[arg(long)]
    pub json: bool,
}

pub fn list(args: ListArgs) -> Result<()> {
    let v: Value = http::get_json("/v1/models")?;
    let data = v
        .get("data")
        .and_then(|d| d.as_array())
        .cloned()
        .unwrap_or_default();
    let filtered: Vec<&Value> = if let Some(p) = &args.provider {
        data.iter()
            .filter(|m| m.get("owned_by").and_then(|x| x.as_str()) == Some(p.as_str()))
            .collect()
    } else {
        data.iter().collect()
    };
    if args.json {
        let arr: Vec<&Value> = filtered.clone();
        println!("{}", serde_json::to_string_pretty(&arr)?);
    } else {
        let rows: Vec<Vec<String>> = filtered
            .iter()
            .map(|m| {
                vec![
                    m.get("id").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                    m.get("object").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                    m.get("owned_by").and_then(|x| x.as_str()).unwrap_or("").to_string(),
                ]
            })
            .collect();
        print_table(&["id", "object", "owned_by"], &rows);
    }
    Ok(())
}

#[derive(Args, Debug, Clone)]
pub struct ShowArgs {
    pub model: String,
    #[arg(long)]
    pub json: bool,
}

pub fn show(args: ShowArgs) -> Result<()> {
    let path = format!("/v1/models/{}", urlencoded(&args.model));
    let v: Value = http::get_json(&path)?;
    println!("{}", serde_json::to_string_pretty(&v)?);
    Ok(())
}

fn urlencoded(s: &str) -> String {
    s.chars()
        .map(|c| {
            if c.is_ascii_alphanumeric() || c == '-' || c == '_' || c == '.' || c == '~' {
                c.to_string()
            } else {
                format!("%{:02X}", c as u32)
            }
        })
        .collect()
}
