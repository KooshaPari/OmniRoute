//! Kwality Runtime Validation Engine
//!
//! This engine provides safe execution and dynamic analysis of AI-generated code
//! using containerized environments, performance profiling, and security monitoring.

use anyhow::{Context, Result};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::time::Duration;
use sysinfo::SystemExt;
use tokio::time::timeout;
use tracing::{error, info, warn};
use uuid::Uuid;

pub mod container;
pub mod fuzzing;
pub mod metrics;
pub mod performance;
pub mod security;
pub mod validation;

use container::ContainerManager;
use fuzzing::{FuzzingEngine, FuzzingResult};
use metrics::MetricsCollector;
use performance::{PerformanceMetrics, PerformanceProfiler};
use security::{SecurityMonitor, SecurityResult};

/// Main runtime validation engine
#[derive(Debug)]
pub struct RuntimeValidator {
    container_manager: ContainerManager,
    performance_profiler: PerformanceProfiler,
    security_monitor: SecurityMonitor,
    fuzzing_engine: FuzzingEngine,
    #[allow(dead_code)]
    metrics_collector: MetricsCollector,
    config: RuntimeConfig,
}

/// Configuration for runtime validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RuntimeConfig {
    /// Container configuration
    pub container: ContainerConfig,
    /// Performance analysis configuration
    pub performance: PerformanceConfig,
    /// Security monitoring configuration
    pub security: SecurityConfig,
    /// Fuzzing configuration
    pub fuzzing: FuzzingConfig,
    /// General validation settings
    pub validation: ValidationConfig,
}

/// Container execution configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerConfig {
    /// Container image to use for execution
    pub image: String,
    /// Memory limit in MB
    pub memory_limit_mb: u64,
    /// CPU limit in cores
    pub cpu_limit_cores: f64,
    /// Execution timeout in seconds
    pub timeout_seconds: u64,
    /// Network isolation enabled
    pub network_isolation: bool,
    /// Read-only filesystem
    pub readonly_filesystem: bool,
    /// Temporary directory size limit
    pub temp_dir_size_mb: u64,
    /// Environment variables
    pub environment: HashMap<String, String>,
    /// Additional security options
    pub security_opts: Vec<String>,
}

/// Performance analysis configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceConfig {
    /// Enable CPU profiling
    pub enable_cpu_profiling: bool,
    /// Enable memory profiling
    pub enable_memory_profiling: bool,
    /// Enable I/O profiling
    pub enable_io_profiling: bool,
    /// Benchmark iterations
    pub benchmark_iterations: u32,
    /// Performance thresholds
    pub thresholds: PerformanceThresholds,
}

/// Performance thresholds for validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceThresholds {
    /// Maximum execution time in milliseconds
    pub max_execution_time_ms: u64,
    /// Maximum memory usage in MB
    pub max_memory_usage_mb: u64,
    /// Maximum CPU usage percentage
    pub max_cpu_usage_percent: f64,
    /// Maximum I/O operations per second
    pub max_io_ops_per_second: u64,
}

/// Security monitoring configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SecurityConfig {
    /// Enable syscall monitoring
    pub enable_syscall_monitoring: bool,
    /// Enable network monitoring
    pub enable_network_monitoring: bool,
    /// Enable file access monitoring
    pub enable_file_monitoring: bool,
    /// Blocked syscalls
    pub blocked_syscalls: Vec<String>,
    /// Allowed network destinations
    pub allowed_networks: Vec<String>,
    /// Sensitive file patterns to monitor
    pub sensitive_files: Vec<String>,
}

/// Fuzzing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzingConfig {
    /// Enable fuzzing
    pub enabled: bool,
    /// Fuzzing duration in seconds
    pub duration_seconds: u64,
    /// Number of fuzzing iterations
    pub iterations: u32,
    /// Input generation strategy
    pub strategy: FuzzingStrategy,
    /// Coverage-guided fuzzing
    pub coverage_guided: bool,
}

/// Fuzzing strategies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FuzzingStrategy {
    Random,
    Structured,
    Mutation,
    Grammar,
}

/// General validation configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationConfig {
    /// Maximum validation time
    pub max_validation_time: Duration,
    /// Parallel execution enabled
    pub parallel_execution: bool,
    /// Cleanup after validation
    pub cleanup_after_validation: bool,
    /// Detailed logging
    pub detailed_logging: bool,
}

/// Codebase representation for validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Codebase {
    pub id: String,
    pub name: String,
    pub files: Vec<CodeFile>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Individual code file
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CodeFile {
    pub path: String,
    pub content: String,
    pub language: Option<String>,
    pub file_type: FileType,
    pub size: u64,
}

/// File type classification
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FileType {
    Source,
    Test,
    Config,
    Build,
    Documentation,
    Asset,
    Other,
}

/// Runtime validation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub validation_id: String,
    pub codebase_id: String,
    pub status: ValidationStatus,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub duration: Option<Duration>,
    pub overall_score: f64,
    pub security_result: SecurityResult,
    pub performance_metrics: PerformanceMetrics,
    pub fuzzing_result: Option<FuzzingResult>,
    pub findings: Vec<Finding>,
    pub recommendations: Vec<Recommendation>,
    pub metadata: HashMap<String, serde_json::Value>,
}

/// Validation status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ValidationStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Timeout,
    Cancelled,
}

/// Individual finding from validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Finding {
    pub id: String,
    pub finding_type: FindingType,
    pub severity: Severity,
    pub title: String,
    pub description: String,
    pub file: Option<String>,
    pub line: Option<u32>,
    pub evidence: HashMap<String, serde_json::Value>,
    pub confidence: f64,
}

/// Types of findings
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FindingType {
    SecurityVulnerability,
    PerformanceIssue,
    RuntimeError,
    MemoryLeak,
    ResourceExhaustion,
    UnexpectedBehavior,
    CrashProne,
}

/// Severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Severity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

/// Validation recommendations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Recommendation {
    pub id: String,
    pub title: String,
    pub description: String,
    pub priority: Priority,
    pub action: String,
    pub effort: EffortLevel,
    pub impact: ImpactLevel,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum Priority {
    Critical,
    High,
    Medium,
    Low,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EffortLevel {
    Low,
    Medium,
    High,
    VeryHigh,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ImpactLevel {
    Low,
    Medium,
    High,
    Critical,
}

impl RuntimeValidator {
    /// Create a new runtime validator instance
    pub async fn new(config: RuntimeConfig) -> Result<Self> {
        info!("Initializing Runtime Validator");

        let container_manager = ContainerManager::new(config.container.clone())
            .await
            .context("Failed to initialize container manager")?;

        let performance_profiler = PerformanceProfiler::new(config.performance.clone())
            .context("Failed to initialize performance profiler")?;

        let security_monitor = SecurityMonitor::new(config.security.clone())
            .context("Failed to initialize security monitor")?;

        let fuzzing_engine = FuzzingEngine::new(config.fuzzing.clone())
            .context("Failed to initialize fuzzing engine")?;

        let metrics_collector =
            MetricsCollector::new().context("Failed to initialize metrics collector")?;

        Ok(Self {
            container_manager,
            performance_profiler,
            security_monitor,
            fuzzing_engine,
            metrics_collector,
            config,
        })
    }

    /// Validate a codebase using runtime analysis
    pub async fn validate(&self, codebase: &Codebase) -> Result<ValidationResult> {
        let validation_id = Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now();

        info!(
            validation_id = %validation_id,
            codebase_id = %codebase.id,
            "Starting runtime validation"
        );

        // Create validation result
        let mut result = ValidationResult {
            validation_id: validation_id.clone(),
            codebase_id: codebase.id.clone(),
            status: ValidationStatus::Running,
            started_at,
            completed_at: None,
            duration: None,
            overall_score: 0.0,
            security_result: SecurityResult::default(),
            performance_metrics: PerformanceMetrics::default(),
            fuzzing_result: None,
            findings: Vec::new(),
            recommendations: Vec::new(),
            metadata: HashMap::new(),
        };

        // Execute validation with timeout
        let validation_future = self.execute_validation(codebase, &mut result);
        let timeout_duration = Duration::from_secs(self.config.container.timeout_seconds);

        match timeout(timeout_duration, validation_future).await {
            Ok(validation_result) => match validation_result {
                Ok(_) => {
                    result.status = ValidationStatus::Completed;
                    info!(
                        validation_id = %validation_id,
                        "Runtime validation completed successfully"
                    );
                }
                Err(e) => {
                    result.status = ValidationStatus::Failed;
                    error!(
                        validation_id = %validation_id,
                        error = %e,
                        "Runtime validation failed"
                    );

                    result.findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        finding_type: FindingType::RuntimeError,
                        severity: Severity::Critical,
                        title: "Validation Execution Failed".to_string(),
                        description: format!("Runtime validation failed: {e}"),
                        file: None,
                        line: None,
                        evidence: HashMap::new(),
                        confidence: 1.0,
                    });
                }
            },
            Err(_) => {
                result.status = ValidationStatus::Timeout;
                warn!(
                    validation_id = %validation_id,
                    timeout_seconds = self.config.container.timeout_seconds,
                    "Runtime validation timed out"
                );

                result.findings.push(Finding {
                    id: Uuid::new_v4().to_string(),
                    finding_type: FindingType::RuntimeError,
                    severity: Severity::High,
                    title: "Validation Timeout".to_string(),
                    description: format!(
                        "Runtime validation exceeded {} seconds timeout",
                        self.config.container.timeout_seconds
                    ),
                    file: None,
                    line: None,
                    evidence: HashMap::new(),
                    confidence: 1.0,
                });
            }
        }

        // Calculate final metrics
        result.completed_at = Some(chrono::Utc::now());
        if let Some(completed_at) = result.completed_at {
            result.duration = Some(
                completed_at
                    .signed_duration_since(result.started_at)
                    .to_std()
                    .unwrap_or(Duration::ZERO),
            );
        }

        // Calculate overall score
        result.overall_score = self.calculate_overall_score(&result);

        // Generate recommendations
        result.recommendations = self.generate_recommendations(&result);

        Ok(result)
    }

    /// Execute the actual validation process
    async fn execute_validation(
        &self,
        codebase: &Codebase,
        result: &mut ValidationResult,
    ) -> Result<()> {
        // Step 1: Create execution environment
        let execution_env = self
            .container_manager
            .create_execution_environment(codebase)
            .await
            .context("Failed to create execution environment")?;

        // Step 2: Security monitoring setup
        self.security_monitor
            .start_monitoring(&execution_env)
            .await
            .context("Failed to start security monitoring")?;

        // Step 3: Performance profiling setup
        self.performance_profiler
            .start_profiling(&execution_env)
            .await
            .context("Failed to start performance profiling")?;

        // Step 4: Execute the code
        let execution_result = self.container_manager.execute_code(&execution_env).await;

        // Step 5: Collect security results
        result.security_result = self
            .security_monitor
            .collect_results(&execution_env)
            .await
            .context("Failed to collect security results")?;

        // Step 6: Collect performance metrics
        result.performance_metrics = self
            .performance_profiler
            .collect_metrics(&execution_env)
            .await
            .context("Failed to collect performance metrics")?;

        // Step 7: Run fuzzing if enabled
        if self.config.fuzzing.enabled {
            result.fuzzing_result = Some(
                self.fuzzing_engine
                    .fuzz_code(&execution_env)
                    .await
                    .context("Failed to run fuzzing")?,
            );
        }

        // Step 8: Analyze execution results
        match &execution_result {
            Ok(exec_result) => {
                self.analyze_execution_results(exec_result, result)
                    .await
                    .context("Failed to analyze execution results")?;
            }
            Err(e) => {
                // Handle execution failure
                result.findings.push(Finding {
                    id: uuid::Uuid::new_v4().to_string(),
                    finding_type: FindingType::RuntimeError,
                    severity: Severity::Critical,
                    title: "Code Execution Failed".to_string(),
                    description: format!("Failed to execute code: {e}"),
                    file: None,
                    line: None,
                    evidence: HashMap::new(),
                    confidence: 1.0,
                });
            }
        }

        // Step 9: Cleanup
        if self.config.validation.cleanup_after_validation {
            self.container_manager
                .cleanup_environment(&execution_env)
                .await
                .context("Failed to cleanup execution environment")?;
        }

        Ok(())
    }

    /// Analyze execution results and add findings
    async fn analyze_execution_results(
        &self,
        execution_result: &container::ExecutionResult,
        result: &mut ValidationResult,
    ) -> Result<()> {
        // Analyze exit code
        if execution_result.exit_code != 0 {
            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::RuntimeError,
                severity: Severity::High,
                title: "Non-zero Exit Code".to_string(),
                description: format!(
                    "Program exited with code {} indicating an error",
                    execution_result.exit_code
                ),
                file: None,
                line: None,
                evidence: [
                    (
                        "exit_code".to_string(),
                        serde_json::Value::Number(execution_result.exit_code.into()),
                    ),
                    (
                        "stderr".to_string(),
                        serde_json::Value::String(execution_result.stderr.clone()),
                    ),
                ]
                .into_iter()
                .collect(),
                confidence: 0.9,
            });
        }

        // Analyze stderr for common error patterns
        self.analyze_stderr(&execution_result.stderr, result);

        // Analyze performance issues
        let performance_metrics = result.performance_metrics.clone();
        self.analyze_performance_issues(&performance_metrics, result);

        // Analyze security issues
        let security_result = result.security_result.clone();
        self.analyze_security_issues(&security_result, result);

        Ok(())
    }

    /// Analyze stderr output for error patterns
    fn analyze_stderr(&self, stderr: &str, result: &mut ValidationResult) {
        let error_patterns = [
            (
                r"segmentation fault|segfault",
                FindingType::CrashProne,
                Severity::Critical,
            ),
            (
                r"memory leak|leak sanitizer",
                FindingType::MemoryLeak,
                Severity::High,
            ),
            (
                r"buffer overflow|stack overflow",
                FindingType::SecurityVulnerability,
                Severity::Critical,
            ),
            (
                r"assertion failed|panic",
                FindingType::RuntimeError,
                Severity::Medium,
            ),
            (
                r"out of memory|oom",
                FindingType::ResourceExhaustion,
                Severity::High,
            ),
            (
                r"timeout|deadlock",
                FindingType::PerformanceIssue,
                Severity::Medium,
            ),
        ];

        for (pattern, finding_type, severity) in error_patterns {
            if let Ok(regex) = regex::Regex::new(pattern) {
                if regex.is_match(stderr) {
                    result.findings.push(Finding {
                        id: Uuid::new_v4().to_string(),
                        finding_type,
                        severity,
                        title: format!("Error Pattern Detected: {pattern}"),
                        description: format!(
                            "Detected error pattern '{pattern}' in program output"
                        ),
                        file: None,
                        line: None,
                        evidence: [
                            (
                                "pattern".to_string(),
                                serde_json::Value::String(pattern.to_string()),
                            ),
                            (
                                "stderr_excerpt".to_string(),
                                serde_json::Value::String(stderr.to_string()),
                            ),
                        ]
                        .into_iter()
                        .collect(),
                        confidence: 0.8,
                    });
                }
            }
        }
    }

    /// Analyze performance metrics for issues
    fn analyze_performance_issues(
        &self,
        metrics: &PerformanceMetrics,
        result: &mut ValidationResult,
    ) {
        // Check CPU usage
        if metrics.cpu_usage_percent > self.config.performance.thresholds.max_cpu_usage_percent {
            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::PerformanceIssue,
                severity: Severity::Medium,
                title: "High CPU Usage".to_string(),
                description: format!(
                    "CPU usage ({:.1}%) exceeds threshold ({:.1}%)",
                    metrics.cpu_usage_percent,
                    self.config.performance.thresholds.max_cpu_usage_percent
                ),
                file: None,
                line: None,
                evidence: [
                    (
                        "cpu_usage".to_string(),
                        serde_json::Value::Number(
                            serde_json::Number::from_f64(metrics.cpu_usage_percent).unwrap(),
                        ),
                    ),
                    (
                        "threshold".to_string(),
                        serde_json::Value::Number(
                            serde_json::Number::from_f64(
                                self.config.performance.thresholds.max_cpu_usage_percent,
                            )
                            .unwrap(),
                        ),
                    ),
                ]
                .into_iter()
                .collect(),
                confidence: 0.9,
            });
        }

        // Check memory usage
        if metrics.memory_usage_mb > self.config.performance.thresholds.max_memory_usage_mb {
            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::PerformanceIssue,
                severity: Severity::Medium,
                title: "High Memory Usage".to_string(),
                description: format!(
                    "Memory usage ({} MB) exceeds threshold ({} MB)",
                    metrics.memory_usage_mb, self.config.performance.thresholds.max_memory_usage_mb
                ),
                file: None,
                line: None,
                evidence: [
                    (
                        "memory_usage_mb".to_string(),
                        serde_json::Value::Number(metrics.memory_usage_mb.into()),
                    ),
                    (
                        "threshold_mb".to_string(),
                        serde_json::Value::Number(
                            self.config
                                .performance
                                .thresholds
                                .max_memory_usage_mb
                                .into(),
                        ),
                    ),
                ]
                .into_iter()
                .collect(),
                confidence: 0.9,
            });
        }

        // Check execution time
        if metrics.execution_time_ms > self.config.performance.thresholds.max_execution_time_ms {
            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::PerformanceIssue,
                severity: Severity::Low,
                title: "Slow Execution".to_string(),
                description: format!(
                    "Execution time ({} ms) exceeds threshold ({} ms)",
                    metrics.execution_time_ms,
                    self.config.performance.thresholds.max_execution_time_ms
                ),
                file: None,
                line: None,
                evidence: [
                    (
                        "execution_time_ms".to_string(),
                        serde_json::Value::Number(metrics.execution_time_ms.into()),
                    ),
                    (
                        "threshold_ms".to_string(),
                        serde_json::Value::Number(
                            self.config
                                .performance
                                .thresholds
                                .max_execution_time_ms
                                .into(),
                        ),
                    ),
                ]
                .into_iter()
                .collect(),
                confidence: 0.9,
            });
        }
    }

    /// Analyze security results for issues
    fn analyze_security_issues(&self, security: &SecurityResult, result: &mut ValidationResult) {
        // Add security findings based on monitoring results
        for violation in &security.violations {
            let severity = match violation.risk_level.as_str() {
                "critical" => Severity::Critical,
                "high" => Severity::High,
                "medium" => Severity::Medium,
                "low" => Severity::Low,
                _ => Severity::Info,
            };

            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::SecurityVulnerability,
                severity,
                title: violation.title.clone(),
                description: violation.description.clone(),
                file: None,
                line: None,
                evidence: violation.evidence.clone(),
                confidence: 0.8,
            });
        }
    }

    /// Calculate overall validation score
    fn calculate_overall_score(&self, result: &ValidationResult) -> f64 {
        let mut score = 100.0;

        // Deduct points for findings based on severity
        for finding in &result.findings {
            let deduction = match finding.severity {
                Severity::Critical => 25.0,
                Severity::High => 15.0,
                Severity::Medium => 8.0,
                Severity::Low => 3.0,
                Severity::Info => 1.0,
            };
            score -= deduction * finding.confidence;
        }

        // Factor in performance score
        let performance_score = 100.0 - (result.performance_metrics.cpu_usage_percent / 2.0);
        score = (score + performance_score) / 2.0;

        // Factor in security score
        score = (score + result.security_result.security_score) / 2.0;

        // Ensure score is between 0 and 100
        score.clamp(0.0, 100.0)
    }

    /// Generate recommendations based on validation results
    fn generate_recommendations(&self, result: &ValidationResult) -> Vec<Recommendation> {
        let mut recommendations = Vec::new();

        // Performance recommendations
        if result.performance_metrics.cpu_usage_percent > 80.0 {
            recommendations.push(Recommendation {
                id: Uuid::new_v4().to_string(),
                title: "Optimize CPU Usage".to_string(),
                description: "The code shows high CPU usage. Consider optimizing algorithms or reducing computational complexity.".to_string(),
                priority: Priority::Medium,
                action: "Profile the code to identify CPU hotspots and optimize critical paths".to_string(),
                effort: EffortLevel::Medium,
                impact: ImpactLevel::High,
            });
        }

        // Memory recommendations
        if result.performance_metrics.memory_usage_mb > 100 {
            recommendations.push(Recommendation {
                id: Uuid::new_v4().to_string(),
                title: "Reduce Memory Usage".to_string(),
                description: "The code uses significant memory. Consider memory optimization techniques.".to_string(),
                priority: Priority::Medium,
                action: "Review memory allocation patterns and implement memory pooling where appropriate".to_string(),
                effort: EffortLevel::Medium,
                impact: ImpactLevel::Medium,
            });
        }

        // Security recommendations
        if result.security_result.security_score < 70.0 {
            recommendations.push(Recommendation {
                id: Uuid::new_v4().to_string(),
                title: "Improve Security Posture".to_string(),
                description: "Security analysis identified potential vulnerabilities that should be addressed.".to_string(),
                priority: Priority::High,
                action: "Review and fix security vulnerabilities identified in the security scan".to_string(),
                effort: EffortLevel::High,
                impact: ImpactLevel::Critical,
            });
        }

        recommendations
    }

    /// Get health status of the runtime validator
    pub async fn health_check(&self) -> Result<HashMap<String, serde_json::Value>> {
        let mut status = HashMap::new();

        status.insert(
            "status".to_string(),
            serde_json::Value::String("healthy".to_string()),
        );
        status.insert(
            "version".to_string(),
            serde_json::Value::String(env!("CARGO_PKG_VERSION").to_string()),
        );

        // Check container manager health
        let container_health = self.container_manager.health_check().await?;
        status.insert(
            "container_manager".to_string(),
            serde_json::to_value(container_health)?,
        );

        // Add system metrics
        let system_info = sysinfo::System::new_all();
        status.insert(
            "system_memory_usage".to_string(),
            serde_json::Value::Number(system_info.used_memory().into()),
        );
        status.insert(
            "system_cpu_count".to_string(),
            serde_json::Value::Number(system_info.cpus().len().into()),
        );

        Ok(status)
    }
}

impl Default for RuntimeConfig {
    fn default() -> Self {
        Self {
            container: ContainerConfig {
                image: "kwality/runner:latest".to_string(),
                memory_limit_mb: 512,
                cpu_limit_cores: 1.0,
                timeout_seconds: 300,
                network_isolation: true,
                readonly_filesystem: false,
                temp_dir_size_mb: 100,
                environment: HashMap::new(),
                security_opts: vec!["no-new-privileges".to_string()],
            },
            performance: PerformanceConfig {
                enable_cpu_profiling: true,
                enable_memory_profiling: true,
                enable_io_profiling: true,
                benchmark_iterations: 3,
                thresholds: PerformanceThresholds {
                    max_execution_time_ms: 10000,
                    max_memory_usage_mb: 256,
                    max_cpu_usage_percent: 90.0,
                    max_io_ops_per_second: 1000,
                },
            },
            security: SecurityConfig {
                enable_syscall_monitoring: true,
                enable_network_monitoring: true,
                enable_file_monitoring: true,
                blocked_syscalls: vec![
                    "ptrace".to_string(),
                    "mount".to_string(),
                    "umount".to_string(),
                ],
                allowed_networks: vec!["127.0.0.1".to_string()],
                sensitive_files: vec!["/etc/passwd".to_string(), "/etc/shadow".to_string()],
            },
            fuzzing: FuzzingConfig {
                enabled: false,
                duration_seconds: 60,
                iterations: 1000,
                strategy: FuzzingStrategy::Random,
                coverage_guided: true,
            },
            validation: ValidationConfig {
                max_validation_time: Duration::from_secs(600),
                parallel_execution: false,
                cleanup_after_validation: true,
                detailed_logging: false,
            },
        }
    }
}
