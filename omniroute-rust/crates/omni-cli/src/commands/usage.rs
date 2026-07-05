//! `omni usage --since <duration>` - usage summary endpoint not yet
//! implemented on the server (v0.1).

use anyhow::Result;
use clap::Args;
use serde_json::json;

use crate::commands::parse_since;
use crate::http;
use crate::output;

#[derive(Args, Debug, Clone)]
pub struct UsageArgs {
    /// Time window: e.g. `1h`, `24h`, `7d`, `30m`, `15s`.
    #[arg(long, default_value = "24h")]
    pub since: String,
    #[arg(long)]
    pub json: bool,
}

pub fn run(args: UsageArgs) -> Result<()> {
    let since = parse_since(&args.since)?;
    let body = json!({"since": since.to_rfc3339()});
    let (status, _text) = http::post_json_raw("/v1/usage", &body)?;
    if status == 404 {
        let payload = json!({
            "status": "pending",
            "note": "usage endpoint pending (v0.1.1). call_logs are being written; aggregation dashboard lands next slice.",
            "since": since.to_rfc3339(),
        });
        output::emit(&payload, args.json)?;
        return Ok(());
    }
    println!("ok (status {status})");
    Ok(())
}
