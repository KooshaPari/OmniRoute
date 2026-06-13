//! Container management for safe code execution
//!
//! This module provides containerized execution of AI-generated code using Docker
//! with strict resource limits, network isolation, and security monitoring.

use anyhow::{Context, Result};
use bollard::container::{
    Config, CreateContainerOptions, RemoveContainerOptions, StartContainerOptions,
    StopContainerOptions,
};
use bollard::exec::{CreateExecOptions, StartExecResults};
use bollard::image::CreateImageOptions;
use bollard::models::{ContainerCreateResponse, HostConfig, Mount, MountTypeEnum};
use bollard::Docker;
use futures_util::TryStreamExt;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::default::Default;
use std::path::PathBuf;
use std::time::{Duration, Instant};
use tempfile::TempDir;
use tokio::fs;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::{Codebase, ContainerConfig};

/// Container manager for safe code execution
#[derive(Debug)]
pub struct ContainerManager {
    docker: Docker,
    config: ContainerConfig,
}

/// Execution environment for a codebase
#[derive(Debug)]
pub struct ExecutionEnvironment {
    pub id: String,
    pub container_id: Option<String>,
    pub working_dir: PathBuf,
    pub temp_dir: TempDir,
    pub codebase: Codebase,
    pub metadata: HashMap<String, String>,
}

/// Result of code execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExecutionResult {
    pub execution_id: String,
    pub exit_code: i64,
    pub stdout: String,
    pub stderr: String,
    pub duration: Duration,
    pub resource_usage: ResourceUsage,
    pub security_events: Vec<SecurityEvent>,
}

/// Resource usage during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub cpu_usage_percent: f64,
    pub memory_usage_mb: u64,
    pub disk_usage_mb: u64,
    pub network_io_bytes: u64,
    pub file_descriptors: u32,
    pub max_memory_mb: u64,
    pub max_cpu_percent: f64,
}

/// Security event during execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityEvent {
    pub event_type: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub description: String,
    pub risk_level: String,
    pub details: HashMap<String, serde_json::Value>,
}

impl ContainerManager {
    /// Create a new container manager
    pub async fn new(config: ContainerConfig) -> Result<Self> {
        info!("Initializing container manager");

        // Connect to Docker daemon
        let docker =
            Docker::connect_with_socket_defaults().context("Failed to connect to Docker daemon")?;

        // Verify Docker is accessible
        match docker.ping().await {
            Ok(_) => info!("Docker daemon connection established"),
            Err(e) => {
                error!("Failed to ping Docker daemon: {}", e);
                return Err(anyhow::anyhow!("Docker daemon not accessible: {}", e));
            }
        }

        // Ensure required images are available
        let manager = Self { docker, config };
        manager.ensure_runtime_image().await?;

        Ok(manager)
    }

    /// Create execution environment for a codebase
    pub async fn create_execution_environment(
        &self,
        codebase: &Codebase,
    ) -> Result<ExecutionEnvironment> {
        let env_id = Uuid::new_v4().to_string();
        info!(
            "Creating execution environment for codebase {}",
            codebase.id
        );

        // Create temporary directory
        let temp_dir = TempDir::new().context("Failed to create temporary directory")?;

        let working_dir = temp_dir.path().join("workspace");
        fs::create_dir_all(&working_dir)
            .await
            .context("Failed to create working directory")?;

        // Write codebase files to working directory
        for file in &codebase.files {
            let file_path = working_dir.join(&file.path);

            // Create parent directories
            if let Some(parent) = file_path.parent() {
                fs::create_dir_all(parent)
                    .await
                    .with_context(|| format!("Failed to create directory for {}", file.path))?;
            }

            // Write file content
            fs::write(&file_path, &file.content)
                .await
                .with_context(|| format!("Failed to write file {}", file.path))?;

            debug!("Written file: {}", file.path);
        }

        let env = ExecutionEnvironment {
            id: env_id,
            container_id: None,
            working_dir,
            temp_dir,
            codebase: codebase.clone(),
            metadata: HashMap::new(),
        };

        info!("Execution environment created: {}", env.id);
        Ok(env)
    }

    /// Execute code in the execution environment
    pub async fn execute_code(&self, env: &ExecutionEnvironment) -> Result<ExecutionResult> {
        let execution_id = Uuid::new_v4().to_string();
        let start_time = Instant::now();

        info!("Starting code execution in environment {}", env.id);

        // Create container
        let container_id = self
            .create_container(env)
            .await
            .context("Failed to create container")?;

        // Start container
        self.docker
            .start_container(&container_id, None::<StartContainerOptions<String>>)
            .await
            .context("Failed to start container")?;

        debug!("Container started: {}", container_id);

        // Execute the code
        let mut result = ExecutionResult {
            execution_id: execution_id.clone(),
            exit_code: 0,
            stdout: String::new(),
            stderr: String::new(),
            duration: Duration::ZERO,
            resource_usage: ResourceUsage::default(),
            security_events: Vec::new(),
        };

        // Detect and execute based on codebase language/type
        let execution_command = self.detect_execution_command(&env.codebase)?;

        match self
            .execute_command_in_container(&container_id, &execution_command)
            .await
        {
            Ok((exit_code, stdout, stderr)) => {
                result.exit_code = exit_code;
                result.stdout = stdout;
                result.stderr = stderr;
            }
            Err(e) => {
                error!("Command execution failed: {}", e);
                result.exit_code = -1;
                result.stderr = format!("Execution failed: {e}");
            }
        }

        // Collect resource usage
        result.resource_usage = self
            .collect_resource_usage(&container_id)
            .await
            .unwrap_or_else(|e| {
                warn!("Failed to collect resource usage: {}", e);
                ResourceUsage::default()
            });

        // Stop and remove container
        let _ = self
            .docker
            .stop_container(&container_id, Some(StopContainerOptions { t: 10 }))
            .await;

        let _ = self
            .docker
            .remove_container(
                &container_id,
                Some(RemoveContainerOptions {
                    force: true,
                    ..Default::default()
                }),
            )
            .await;

        result.duration = start_time.elapsed();

        info!(
            "Code execution completed: {} (exit: {}, duration: {:?})",
            execution_id, result.exit_code, result.duration
        );

        Ok(result)
    }

    /// Cleanup execution environment
    pub async fn cleanup_environment(&self, env: &ExecutionEnvironment) -> Result<()> {
        info!("Cleaning up execution environment: {}", env.id);

        // Remove container if it exists
        if let Some(container_id) = &env.container_id {
            let _ = self
                .docker
                .remove_container(
                    container_id,
                    Some(RemoveContainerOptions {
                        force: true,
                        ..Default::default()
                    }),
                )
                .await;
        }

        // Temporary directory is automatically cleaned up when TempDir is dropped
        debug!("Execution environment cleaned up: {}", env.id);
        Ok(())
    }

    /// Health check for container manager
    pub async fn health_check(&self) -> Result<HashMap<String, serde_json::Value>> {
        let mut status = HashMap::new();

        // Check Docker daemon
        match self.docker.ping().await {
            Ok(_) => {
                status.insert(
                    "docker_daemon".to_string(),
                    serde_json::Value::String("healthy".to_string()),
                );
            }
            Err(e) => {
                status.insert(
                    "docker_daemon".to_string(),
                    serde_json::Value::String(format!("unhealthy: {e}")),
                );
            }
        }

        // Check runtime image availability
        match self.docker.inspect_image(&self.config.image).await {
            Ok(_) => {
                status.insert(
                    "runtime_image".to_string(),
                    serde_json::Value::String("available".to_string()),
                );
            }
            Err(_) => {
                status.insert(
                    "runtime_image".to_string(),
                    serde_json::Value::String("missing".to_string()),
                );
            }
        }

        // System information
        match self.docker.info().await {
            Ok(info) => {
                status.insert(
                    "containers_running".to_string(),
                    serde_json::Value::Number(info.containers_running.unwrap_or(0).into()),
                );
                status.insert(
                    "images_count".to_string(),
                    serde_json::Value::Number(info.images.unwrap_or(0).into()),
                );
            }
            Err(_) => {
                status.insert(
                    "system_info".to_string(),
                    serde_json::Value::String("unavailable".to_string()),
                );
            }
        }

        Ok(status)
    }

    /// Ensure runtime image is available
    async fn ensure_runtime_image(&self) -> Result<()> {
        info!("Checking runtime image: {}", self.config.image);

        match self.docker.inspect_image(&self.config.image).await {
            Ok(_) => {
                info!("Runtime image is available: {}", self.config.image);
                return Ok(());
            }
            Err(_) => {
                info!(
                    "Runtime image not found, attempting to pull: {}",
                    self.config.image
                );
            }
        }

        // Try to pull the image
        let options = Some(CreateImageOptions {
            from_image: self.config.image.clone(),
            ..Default::default()
        });

        let mut stream = self.docker.create_image(options, None, None);

        use futures_util::stream::StreamExt;
        while let Some(result) = stream.next().await {
            match result {
                Ok(output) => {
                    if let Some(status) = output.status {
                        debug!("Image pull: {}", status);
                    }
                }
                Err(e) => {
                    error!("Failed to pull runtime image: {}", e);
                    return Err(anyhow::anyhow!("Failed to pull runtime image: {}", e));
                }
            }
        }

        info!("Runtime image pulled successfully: {}", self.config.image);
        Ok(())
    }

    /// Create container for execution
    async fn create_container(&self, env: &ExecutionEnvironment) -> Result<String> {
        let container_name = format!("kwality-exec-{}", env.id);

        // Configure host mount for code access
        let mount = Mount {
            target: Some("/workspace".to_string()),
            source: Some(env.working_dir.to_string_lossy().to_string()),
            typ: Some(MountTypeEnum::BIND),
            read_only: Some(false),
            ..Default::default()
        };

        // Configure resource limits
        let host_config = HostConfig {
            memory: Some(self.config.memory_limit_mb as i64 * 1024 * 1024), // Convert MB to bytes
            nano_cpus: Some((self.config.cpu_limit_cores * 1_000_000_000.0) as i64),
            network_mode: if self.config.network_isolation {
                Some("none".to_string())
            } else {
                Some("bridge".to_string())
            },
            mounts: Some(vec![mount]),
            readonly_rootfs: Some(self.config.readonly_filesystem),
            security_opt: Some(self.config.security_opts.clone()),
            tmpfs: Some({
                let mut tmpfs = HashMap::new();
                tmpfs.insert(
                    "/tmp".to_string(),
                    format!("size={}m", self.config.temp_dir_size_mb),
                );
                tmpfs
            }),
            ..Default::default()
        };

        let config = Config {
            image: Some(self.config.image.clone()),
            working_dir: Some("/workspace".to_string()),
            env: Some(
                self.config
                    .environment
                    .iter()
                    .map(|(k, v)| format!("{k}={v}"))
                    .collect(),
            ),
            host_config: Some(host_config),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        };

        let options = CreateContainerOptions {
            name: container_name.clone(),
            platform: None,
        };

        let response: ContainerCreateResponse = self
            .docker
            .create_container(Some(options), config)
            .await
            .context("Failed to create container")?;

        debug!("Container created: {} ({})", container_name, response.id);
        Ok(response.id)
    }

    /// Execute command in container
    async fn execute_command_in_container(
        &self,
        container_id: &str,
        command: &[String],
    ) -> Result<(i64, String, String)> {
        let exec_config = CreateExecOptions {
            cmd: Some(command.iter().map(|s| s.as_str()).collect()),
            attach_stdout: Some(true),
            attach_stderr: Some(true),
            ..Default::default()
        };

        let exec = self
            .docker
            .create_exec(container_id, exec_config)
            .await
            .context("Failed to create exec")?;

        let start_exec = self
            .docker
            .start_exec(&exec.id, None)
            .await
            .context("Failed to start exec")?;

        let mut stdout = Vec::new();
        let mut stderr = Vec::new();

        if let StartExecResults::Attached { mut output, .. } = start_exec {
            use futures_util::stream::StreamExt;
            while let Some(Ok(msg)) = output.next().await {
                match msg {
                    bollard::container::LogOutput::StdOut { message } => {
                        stdout.extend_from_slice(&message);
                    }
                    bollard::container::LogOutput::StdErr { message } => {
                        stderr.extend_from_slice(&message);
                    }
                    _ => {}
                }
            }
        }

        // Get exit code
        let exec_inspect = self
            .docker
            .inspect_exec(&exec.id)
            .await
            .context("Failed to inspect exec")?;

        let exit_code = exec_inspect.exit_code.unwrap_or(-1);
        let stdout_str = String::from_utf8_lossy(&stdout).to_string();
        let stderr_str = String::from_utf8_lossy(&stderr).to_string();

        debug!(
            "Command executed: exit={}, stdout_len={}, stderr_len={}",
            exit_code,
            stdout_str.len(),
            stderr_str.len()
        );

        Ok((exit_code, stdout_str, stderr_str))
    }

    /// Detect execution command based on codebase
    fn detect_execution_command(&self, codebase: &Codebase) -> Result<Vec<String>> {
        // Analyze files to determine how to execute the code
        let mut has_go = false;
        let mut has_rust = false;
        let mut has_python = false;
        let mut has_javascript = false;
        let mut has_java = false;

        for file in &codebase.files {
            match file.path.as_str() {
                p if p.ends_with(".go") => has_go = true,
                p if p.ends_with(".rs") || p == "Cargo.toml" => has_rust = true,
                p if p.ends_with(".py") => has_python = true,
                p if p.ends_with(".js") || p.ends_with(".ts") || p == "package.json" => {
                    has_javascript = true
                }
                p if p.ends_with(".java") => has_java = true,
                _ => {}
            }
        }

        // Determine execution strategy
        if has_go {
            // Look for main.go or try to run as module
            if codebase.files.iter().any(|f| f.path == "main.go") {
                Ok(vec![
                    "go".to_string(),
                    "run".to_string(),
                    "main.go".to_string(),
                ])
            } else {
                Ok(vec!["go".to_string(), "run".to_string(), ".".to_string()])
            }
        } else if has_rust {
            if codebase.files.iter().any(|f| f.path == "Cargo.toml") {
                Ok(vec!["cargo".to_string(), "run".to_string()])
            } else {
                // Single Rust file
                let rust_file = codebase
                    .files
                    .iter()
                    .find(|f| f.path.ends_with(".rs"))
                    .map(|f| f.path.clone())
                    .unwrap_or_else(|| "main.rs".to_string());
                Ok(vec![
                    "rustc".to_string(),
                    rust_file.clone(),
                    "&&".to_string(),
                    format!("./{}", rust_file.replace(".rs", "")),
                ])
            }
        } else if has_python {
            // Look for main.py or __main__.py
            if let Some(main_file) = codebase
                .files
                .iter()
                .find(|f| f.path == "main.py" || f.path == "__main__.py")
                .map(|f| f.path.clone())
            {
                Ok(vec!["python3".to_string(), main_file])
            } else {
                // Run first Python file found
                let py_file = codebase
                    .files
                    .iter()
                    .find(|f| f.path.ends_with(".py"))
                    .map(|f| f.path.clone())
                    .unwrap_or_else(|| "main.py".to_string());
                Ok(vec!["python3".to_string(), py_file])
            }
        } else if has_javascript {
            if codebase.files.iter().any(|f| f.path == "package.json") {
                Ok(vec!["npm".to_string(), "start".to_string()])
            } else {
                // Run first JS file found
                let js_file = codebase
                    .files
                    .iter()
                    .find(|f| f.path.ends_with(".js"))
                    .map(|f| f.path.clone())
                    .unwrap_or_else(|| "index.js".to_string());
                Ok(vec!["node".to_string(), js_file])
            }
        } else if has_java {
            // Simple Java execution - would need more sophisticated detection in production
            let java_file = codebase
                .files
                .iter()
                .find(|f| f.path.ends_with(".java"))
                .map(|f| f.path.clone())
                .unwrap_or_else(|| "Main.java".to_string());

            let class_name = java_file.replace(".java", "");
            Ok(vec![
                "javac".to_string(),
                java_file.clone(),
                "&&".to_string(),
                "java".to_string(),
                class_name,
            ])
        } else {
            // Default: try to run as shell script
            Ok(vec![
                "sh".to_string(),
                "-c".to_string(),
                "echo 'No runnable code detected'".to_string(),
            ])
        }
    }

    /// Collect resource usage from container
    async fn collect_resource_usage(&self, container_id: &str) -> Result<ResourceUsage> {
        let stats = self
            .docker
            .stats(
                container_id,
                Some(bollard::container::StatsOptions {
                    stream: false,
                    one_shot: true,
                }),
            )
            .try_collect::<Vec<_>>()
            .await
            .context("Failed to collect container stats")?;

        if let Some(stat) = stats.first() {
            let memory_usage_mb = stat.memory_stats.usage.unwrap_or(0) / (1024 * 1024);
            let memory_limit_mb = stat.memory_stats.limit.unwrap_or(0) / (1024 * 1024);

            // Calculate CPU usage percentage
            let cpu_usage_percent = {
                let cpu_stats = &stat.cpu_stats;
                let precpu_stats = &stat.precpu_stats;
                let cpu_delta = cpu_stats.cpu_usage.total_usage as f64
                    - precpu_stats.cpu_usage.total_usage as f64;
                let system_delta = cpu_stats.system_cpu_usage.unwrap_or(0) as f64
                    - precpu_stats.system_cpu_usage.unwrap_or(0) as f64;

                if system_delta > 0.0 && cpu_delta > 0.0 {
                    (cpu_delta / system_delta) * cpu_stats.online_cpus.unwrap_or(1) as f64 * 100.0
                } else {
                    0.0
                }
            };

            Ok(ResourceUsage {
                cpu_usage_percent,
                memory_usage_mb,
                disk_usage_mb: 0, // Would need additional stats collection
                network_io_bytes: stat
                    .networks
                    .as_ref()
                    .and_then(|nets| nets.values().next())
                    .map(|net| net.rx_bytes + net.tx_bytes)
                    .unwrap_or(0),
                file_descriptors: 0, // Would need additional stats collection
                max_memory_mb: memory_limit_mb,
                max_cpu_percent: 100.0,
            })
        } else {
            Ok(ResourceUsage::default())
        }
    }
}

impl Default for ResourceUsage {
    fn default() -> Self {
        Self {
            cpu_usage_percent: 0.0,
            memory_usage_mb: 0,
            disk_usage_mb: 0,
            network_io_bytes: 0,
            file_descriptors: 0,
            max_memory_mb: 0,
            max_cpu_percent: 0.0,
        }
    }
}
