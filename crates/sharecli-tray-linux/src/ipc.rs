//! IPC client for sharecli systemtray (Unix socket NDJSON-RPC).

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::UnixStream;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HealthSnapshot {
    pub managed_processes: i32,
    pub used_memory_mb: u64,
    pub total_memory_mb: u64,
    pub healthy: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ProcessInfo {
    pub pid: u32,
    pub name: String,
    pub memory_mb: u64,
    pub project: Option<String>,
}

#[derive(Debug)]
pub struct IPCClient {
    sock_path: PathBuf,
}

impl IPCClient {
    pub fn new() -> Self {
        let sock_path = if let Ok(v) = std::env::var("SHARECLI_IPC_SOCK") {
            PathBuf::from(v)
        } else {
            let base = dirs::data_local_dir().unwrap_or_else(|| PathBuf::from("/tmp"));
            base.join("sharecli").join("ipc.sock")
        };
        Self { sock_path }
    }

    pub async fn health_snapshot(&self) -> Result<HealthSnapshot> {
        let req = r#"{"id":1,"method":"health.status","params":{}}"#;
        let resp = self.send_request(req).await?;

        let doc: serde_json::Value = serde_json::from_str(&resp)?;
        let result = doc
            .get("result")
            .ok_or_else(|| anyhow::anyhow!("no result in response"))?;
        let health: HealthSnapshot = serde_json::from_value(result.clone())?;
        Ok(health)
    }

    pub async fn process_list(&self) -> Result<Vec<ProcessInfo>> {
        let req = r#"{"id":2,"method":"process.list","params":{}}"#;
        let resp = self.send_request(req).await?;

        let doc: serde_json::Value = serde_json::from_str(&resp)?;
        let result = doc
            .get("result")
            .ok_or_else(|| anyhow::anyhow!("no result in response"))?;
        if !result.is_array() {
            return Ok(Vec::new());
        }
        let processes: Vec<ProcessInfo> = serde_json::from_value(result.clone())?;
        Ok(processes)
    }

    async fn send_request(&self, req: &str) -> Result<String> {
        let mut stream = UnixStream::connect(&self.sock_path).await?;

        let mut payload = req.to_string();
        payload.push('\n');
        stream.write_all(payload.as_bytes()).await?;

        let (reader, _) = stream.into_split();
        let mut lines = BufReader::new(reader).lines();

        let line = lines
            .next_line()
            .await?
            .ok_or_else(|| anyhow::anyhow!("empty response"))?;
        Ok(line)
    }
}
