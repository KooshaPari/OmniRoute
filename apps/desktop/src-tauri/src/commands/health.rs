use serde::Serialize;

#[derive(Serialize)]
pub struct Ping {
    pub ok: bool,
    pub ts: i64,
}

#[tauri::command]
pub fn ping() -> Ping { Ping { ok: true, ts: chrono::Utc::now().timestamp_millis() } }

#[tauri::command]
pub fn health() -> serde_json::Value {
    serde_json::json!({
        "status": "healthy",
        "version": env!("CARGO_PKG_VERSION"),
        "uptimeSeconds": 0i64,
    })
}
