use serde::Serialize;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum RuntimeState {
    Stopped,
    Starting,
    Running,
}

#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct RuntimeStatus {
    pub state: RuntimeState,
    pub origin: String,
}

impl RuntimeStatus {
    pub fn stopped(origin: impl Into<String>) -> Self {
        Self {
            state: RuntimeState::Stopped,
            origin: origin.into(),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn starts_stopped() {
        assert_eq!(
            RuntimeStatus::stopped("http://localhost:20128").state,
            RuntimeState::Stopped
        );
    }
}
