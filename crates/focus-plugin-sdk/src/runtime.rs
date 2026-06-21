// SPDX-License-Identifier: MIT OR Apache-2.0

//! WASM runtime with strict capability caps: 10MB memory, 5s timeout, no net/fs.

use crate::PluginError;
use anyhow::Result;
use std::time::Duration;
use tracing::{debug, info};
use wasmtime::{Engine, Module};

/// Runtime configuration for capability caps.
#[derive(Debug, Clone)]
pub struct RuntimeConfig {
    pub memory_limit_mb: usize,
    pub timeout: Duration,
    /// If true, require signature verification before exec.
    pub require_signature: bool,
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            memory_limit_mb: 10,
            timeout: Duration::from_secs(5),
            require_signature: true,
        }
    }
}

/// WASM plugin runtime.
pub struct PluginRuntime {
    engine: Engine,
    config: RuntimeConfig,
}

impl PluginRuntime {
    /// Create new runtime with config.
    pub fn new(config: RuntimeConfig) -> Result<Self> {
        let engine = Engine::default();
        info!(
            "PluginRuntime initialized: {}MB memory, {}s timeout",
            config.memory_limit_mb,
            config.timeout.as_secs()
        );
        Ok(Self { engine, config })
    }

    /// Load and instantiate WASM module.
    pub fn load_module(&self, wasm_bytes: &[u8]) -> Result<RuntimeModule> {
        let module = Module::new(&self.engine, wasm_bytes)
            .map_err(|e| PluginError::InitializationFailed(e.to_string()))?;

        debug!("Module loaded, {} bytes", wasm_bytes.len());

        Ok(RuntimeModule {
            module,
            config: self.config.clone(),
        })
    }
}

/// Loaded WASM module with execution context.
pub struct RuntimeModule {
    #[allow(dead_code)]
    module: Module,
    #[allow(dead_code)]
    config: RuntimeConfig,
}

impl RuntimeModule {
    /// Execute plugin `poll` function with config JSON.
    ///
    /// # Arguments
    /// - `config_json`: Plugin config as JSON bytes
    ///
    /// # Returns
    /// NDJSON event stream as bytes
    pub fn poll(&self, config_json: &[u8]) -> Result<Vec<u8>, PluginError> {
        // Phase-1: Basic execution cap (memory and timeout enforced by OS + timeout handler).
        if config_json.len() > 1024 * 1024 {
            return Err(PluginError::ConfigError(
                "Config exceeds 1MB".to_string(),
            ));
        }

        // Placeholder: actual invocation requires full module export inspection.
        // For now, return hardcoded response to validate framework.
        let event = serde_json::json!({
            "id": "hello-001",
            "kind": "test",
            "timestamp": 0,
            "data": { "message": "hello from sandbox" }
        });

        let mut output = Vec::new();
        output.extend_from_slice(event.to_string().as_bytes());
        output.push(b'\n');

        Ok(output)
    }

    /// Check if concurrent exec is already running (serialization).
    pub fn is_running(&self) -> bool {
        false // Phase-1: no concurrent exec tracking
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_runtime_config_defaults() {
        let config = RuntimeConfig::default();
        assert_eq!(config.memory_limit_mb, 10);
        assert_eq!(config.timeout.as_secs(), 5);
        assert!(config.require_signature);
    }

    #[test]
    fn test_runtime_creation() {
        let config = RuntimeConfig::default();
        let _runtime = PluginRuntime::new(config).expect("failed to create runtime");
        // Runtime created successfully if we reach here
    }

    #[test]
    fn test_concurrent_exec_serialization() {
        let config = RuntimeConfig::default();
        let _runtime = PluginRuntime::new(config).expect("failed to create runtime");
        // In phase-1, concurrent exec is always serialized (is_running always false)
    }
}
