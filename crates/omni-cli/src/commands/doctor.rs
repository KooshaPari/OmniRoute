//! `omni doctor` - hit the health, ready, and me endpoints; print a
//! pass/fail report.

use anyhow::Result;

use crate::http;
use crate::output::print_table;

pub fn run() -> Result<()> {
    let mut rows: Vec<Vec<String>> = Vec::new();
    let mut all_ok = true;
    for (label, path) in [
        ("liveness", "/healthz"),
        ("readiness", "/readyz"),
        ("me", "/v1/me/status"),
    ] {
        let res = http::get_json::<serde_json::Value>(path);
        let (status, detail) = match res {
            Ok(v) => {
                let detail = match path {
                    "/healthz" => v
                        .get("uptime_secs")
                        .and_then(|x| x.as_u64())
                        .map(|n| format!("uptime {}s", n))
                        .unwrap_or_else(|| "ok".into()),
                    "/readyz" => v
                        .get("status")
                        .and_then(|x| x.as_str())
                        .unwrap_or("ok")
                        .to_string(),
                    _ => v
                        .get("providers")
                        .and_then(|x| x.as_u64())
                        .map(|n| format!("{} providers", n))
                        .unwrap_or_else(|| "ok".into()),
                };
                ("[ok]".to_string(), detail)
            }
            Err(e) => {
                all_ok = false;
                ("[fail]".to_string(), e.to_string())
            }
        };
        rows.push(vec![label.to_string(), status, detail]);
    }
    print_table(&["check", "status", "detail"], &rows);
    if all_ok {
        Ok(())
    } else {
        anyhow::bail!("one or more checks failed")
    }
}
