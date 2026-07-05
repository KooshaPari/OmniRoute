use std::sync::Arc;
use serde::{Deserialize, Serialize};
use tokio::sync::RwLock;
use crate::error::{AppError, AppResult};

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum GatewayState {
    Idle,
    Starting,
    Started,
    Healthy,
    Degraded,
    Failed,
    Restart,
    Quit,
}

#[derive(Debug, Clone, Copy)]
pub struct GatewayProcess {
    state: Arc<RwLock<GatewayState>>,
}

impl GatewayProcess {
    pub fn new() -> Self {
        Self { state: Arc::new(RwLock::new(GatewayState::Idle)) }
    }

    pub async fn state(&self) -> GatewayState {
        *self.state.read().await
    }

    pub async fn transition(&self, to: GatewayState) {
        *self.state.write().await = to;
    }

    pub async fn start(&self) -> AppResult<()> {
        self.transition(GatewayState::Starting).await;
        self.transition(GatewayState::Started).await;
        self.transition(GatewayState::Healthy).await;
        Ok(())
    }

    pub async fn stop(&self) -> AppResult<()> {
        self.transition(GatewayState::Quit).await;
        Ok(())
    }

    pub async fn health_check(&self) -> bool {
        matches!(self.state().await, GatewayState::Healthy)
    }
}
