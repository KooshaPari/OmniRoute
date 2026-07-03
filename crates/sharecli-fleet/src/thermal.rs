//! Stub thermal governor — enforces thermal limits before scheduling work.

#[derive(Debug, Default, Clone)]
pub struct ThermalGovernor {
    _private: (),
}

impl ThermalGovernor {
    /// Create a new, default-configured governor.
    pub fn new() -> Self {
        Self { _private: () }
    }
}
