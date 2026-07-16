use serde::Serialize;

#[derive(Serialize)]
pub struct GatewayStatus {
    pub state: String,
    pub healthy: bool,
}

#[derive(Serialize)]
pub struct ProxySettings {
    pub enabled: bool,
    pub upstream: String,
    pub port: u16,
}
