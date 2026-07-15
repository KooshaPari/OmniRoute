//! `omni version` - print name, version, build, and the server version
//! (if reachable).

use anyhow::Result;

use crate::http;

pub fn run() -> Result<()> {
    let server = http::get_json::<serde_json::Value>("/healthz").ok();
    let server_version = server
        .as_ref()
        .and_then(|v| v.get("version"))
        .and_then(|v| v.as_str())
        .unwrap_or("(server unreachable)");
    println!(
        "omniroute {} (build: rust) - server: {}",
        env!("CARGO_PKG_VERSION"),
        server_version
    );
    Ok(())
}
