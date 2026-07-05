//! `omni keys list|create|revoke` - admin endpoints not yet implemented
//! on the server (v0.1). For v0.1 we print a clear "admin endpoints
//! pending" message and exit 0.

use anyhow::Result;
use clap::Args;
use serde_json::json;

use crate::http;

const NOT_IMPLEMENTED: &str = "admin endpoints pending (v0.1.1). The CLI is in place; the server-side admin handlers land in the next slice.";

#[derive(Args, Debug, Clone)]
pub struct ListArgs {
    #[arg(long)]
    pub json: bool,
}

pub fn list(args: ListArgs) -> Result<()> {
    let body = json!({});
    let (status, text) = http::post_json_raw("/admin/keys/list", &body)?;
    if status == 404 {
        if args.json {
            println!("{}", serde_json::to_string_pretty(&json!({"status": "pending", "note": NOT_IMPLEMENTED}))?);
        } else {
            println!("{NOT_IMPLEMENTED}");
        }
        return Ok(());
    }
    println!("ok (status {status}): {text}");
    Ok(())
}

#[derive(Args, Debug, Clone)]
pub struct CreateArgs {
    #[arg(long)]
    pub label: String,
    #[arg(long)]
    pub tenant: Option<String>,
}

pub fn create(args: CreateArgs) -> Result<()> {
    let body = json!({"label": args.label, "tenant": args.tenant});
    let (status, text) = http::post_json_raw("/admin/keys/create", &body)?;
    if status == 404 {
        println!("{NOT_IMPLEMENTED}");
        return Ok(());
    }
    println!("ok (status {status}): {text}");
    Ok(())
}

#[derive(Args, Debug, Clone)]
pub struct RevokeArgs {
    pub id: String,
}

pub fn revoke(args: RevokeArgs) -> Result<()> {
    let body = json!({"id": args.id});
    let (status, text) = http::post_json_raw("/admin/keys/revoke", &body)?;
    if status == 404 {
        println!("{NOT_IMPLEMENTED}");
        return Ok(());
    }
    println!("ok (status {status}): {text}");
    Ok(())
}
