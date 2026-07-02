//! Request dispatch for the IPC server.
//!
//! Methods exposed:
//!   process.list        → Vec<ProcessSummary>
//!   process.kill        → { pid }
//!   process.kill_all    → {}
//!   health.status       → HealthSnapshot
//!   config.get          → Config
//!   config.set          → { key, value }  (dot-path into TOML)
//!   monitoring.report   → MonitoringReport

use std::sync::Arc;

use anyhow::Result;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use sharecli::config::Config;
use sharecli::{ProcessInfo, ProcessPool};
use tokio::sync::RwLock;

// ---------------------------------------------------------------------------
// Wire types
// ---------------------------------------------------------------------------

#[derive(Deserialize)]
pub struct Request {
    pub id: u64,
    pub method: String,
    #[serde(default)]
    pub params: Value,
}

#[derive(Serialize)]
pub struct Response {
    pub id: u64,
    pub result: Value,
    pub error: Option<String>,
}

impl Response {
    fn ok(id: u64, result: impl Serialize) -> Self {
        Self { id, result: serde_json::to_value(result).unwrap_or(Value::Null), error: None }
    }

    fn err(id: u64, msg: impl std::fmt::Display) -> Self {
        Self { id, result: Value::Null, error: Some(msg.to_string()) }
    }
}

#[derive(Serialize)]
pub struct ProcessSummary {
    pub pid: u32,
    pub name: String,
    pub cmd: Vec<String>,
    pub memory_mb: u64,
    pub project: Option<String>,
    pub harness: Option<String>,
    pub start_time: u64,
}

impl From<ProcessInfo> for ProcessSummary {
    fn from(p: ProcessInfo) -> Self {
        Self {
            pid: p.pid,
            name: p.name,
            cmd: p.cmd,
            memory_mb: p.memory_mb,
            project: p.project,
            harness: p.harness,
            start_time: p.start_time,
        }
    }
}

#[derive(Serialize)]
pub struct HealthSnapshot {
    pub managed_processes: usize,
    pub used_memory_mb: u64,
    pub total_memory_mb: u64,
    pub healthy: bool,
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

pub struct Handler {
    pool: Arc<ProcessPool>,
    config: Arc<RwLock<Config>>,
}

impl Handler {
    pub async fn new() -> Result<Self> {
        let pool = Arc::new(ProcessPool::new());
        let config = Arc::new(RwLock::new(Config::load().unwrap_or_default()));
        Ok(Self { pool, config })
    }

    pub async fn dispatch(&self, raw: &str) -> Response {
        let req: Request = match serde_json::from_str(raw) {
            Ok(r) => r,
            Err(e) => return Response::err(0, format!("parse error: {e}")),
        };

        match self.handle(&req).await {
            Ok(val) => Response::ok(req.id, val),
            Err(e) => Response::err(req.id, e),
        }
    }

    async fn handle(&self, req: &Request) -> Result<Value> {
        match req.method.as_str() {
            "process.list" => {
                self.pool.refresh().await;
                let procs: Vec<ProcessSummary> =
                    self.pool.list().await.into_iter().map(ProcessSummary::from).collect();
                Ok(serde_json::to_value(procs)?)
            }

            "process.kill" => {
                let pid: u32 =
                    req.params["pid"].as_u64().ok_or_else(|| anyhow::anyhow!("missing pid"))?
                        as u32;
                self.pool.kill(pid).await?;
                Ok(Value::Bool(true))
            }

            "process.kill_all" => {
                self.pool.kill_all().await?;
                Ok(Value::Bool(true))
            }

            "health.status" => {
                self.pool.refresh().await;
                let procs = self.pool.list().await;
                let (used, total) = self.pool.system_memory_usage().await;
                let snap = HealthSnapshot {
                    managed_processes: procs.len(),
                    used_memory_mb: used,
                    total_memory_mb: total,
                    healthy: used < total / 2,
                };
                Ok(serde_json::to_value(snap)?)
            }

            "config.get" => {
                let cfg = self.config.read().await.clone();
                Ok(serde_json::to_value(cfg)?)
            }

            "config.set" => {
                let key =
                    req.params["key"].as_str().ok_or_else(|| anyhow::anyhow!("missing key"))?;
                let value = &req.params["value"];
                self.apply_config_patch(key, value).await?;
                Ok(Value::Bool(true))
            }

            "monitoring.report" => {
                self.pool.refresh().await;
                let procs = self.pool.list().await;
                let (used, total) = self.pool.system_memory_usage().await;
                let report = serde_json::json!({
                    "timestamp": std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap()
                        .as_secs(),
                    "total_processes": procs.len(),
                    "used_memory_mb": used,
                    "total_memory_mb": total,
                    "processes": procs.iter().map(|p| serde_json::json!({
                        "pid": p.pid,
                        "name": p.name.clone(),
                        "memory_mb": p.memory_mb,
                        "project": p.project.clone(),
                        "harness": p.harness.clone(),
                    })).collect::<Vec<_>>(),
                });
                Ok(report)
            }

            other => Err(anyhow::anyhow!("unknown method: {other}")),
        }
    }

    /// Apply a dot-path config patch: "runtime.max_memory_mb" → 8192
    async fn apply_config_patch(&self, key: &str, value: &Value) -> Result<()> {
        let mut cfg = self.config.write().await;
        let mut raw = serde_json::to_value(&*cfg)?;

        let parts: Vec<&str> = key.split('.').collect();
        set_nested(&mut raw, &parts, value.clone())
            .map_err(|e| anyhow::anyhow!("config.set {key}: {e}"))?;

        *cfg = serde_json::from_value(raw)?;
        cfg.save()?;
        Ok(())
    }
}

fn set_nested(val: &mut Value, path: &[&str], new: Value) -> Result<(), String> {
    if path.is_empty() {
        *val = new;
        return Ok(());
    }
    match val {
        Value::Object(map) => {
            let entry = map.entry(path[0]).or_insert(Value::Object(serde_json::Map::new()));
            set_nested(entry, &path[1..], new)
        }
        _ => Err(format!("expected object at segment '{}'", path[0])),
    }
}
