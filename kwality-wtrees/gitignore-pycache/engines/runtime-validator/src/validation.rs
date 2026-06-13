//! Validation orchestration and result aggregation
//!
//! This module provides the core validation orchestration logic, coordinating
//! between different validation engines and aggregating results.

use anyhow::{Context, Result};
use async_trait::async_trait;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};
use uuid::Uuid;

use crate::container::{ContainerManager, ExecutionEnvironment};
use crate::fuzzing::FuzzingEngine;
use crate::metrics::{ContainerEvent, ErrorSeverity, MetricsCollector};
use crate::performance::{PerformanceMetrics, PerformanceProfiler};
use crate::security::{SecurityMonitor, SecurityResult};
use crate::{
    Codebase, Finding, FindingType, RuntimeConfig, Severity, ValidationResult, ValidationStatus,
};

/// Validation orchestrator that coordinates all validation engines
#[derive(Debug)]
pub struct ValidationOrchestrator {
    config: RuntimeConfig,
    container_manager: Arc<ContainerManager>,
    performance_profiler: Arc<PerformanceProfiler>,
    security_monitor: Arc<SecurityMonitor>,
    fuzzing_engine: Arc<FuzzingEngine>,
    metrics_collector: Arc<MetricsCollector>,
    active_validations: Arc<RwLock<HashMap<String, ValidationSession>>>,
}

/// Individual validation session tracking
#[derive(Debug, Clone)]
pub struct ValidationSession {
    pub validation_id: String,
    pub codebase_id: String,
    pub status: ValidationStatus,
    pub started_at: chrono::DateTime<chrono::Utc>,
    pub estimated_completion: Option<chrono::DateTime<chrono::Utc>>,
    pub progress: ValidationProgress,
    pub engine_status: HashMap<String, EngineStatus>,
}

/// Progress tracking for validation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationProgress {
    pub overall_progress: f64, // 0.0 to 1.0
    pub current_phase: ValidationPhase,
    pub completed_phases: Vec<ValidationPhase>,
    pub estimated_time_remaining: Option<Duration>,
}

/// Validation phases
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq, Hash)]
pub enum ValidationPhase {
    Initialization,
    EnvironmentSetup,
    StaticAnalysis,
    SecurityScanning,
    RuntimeExecution,
    PerformanceProfiling,
    FuzzTesting,
    ResultAggregation,
    Cleanup,
    Completed,
}

/// Status of individual validation engines
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineStatus {
    pub engine_name: String,
    pub status: EngineExecutionStatus,
    pub progress: f64,
    pub started_at: Option<chrono::DateTime<chrono::Utc>>,
    pub completed_at: Option<chrono::DateTime<chrono::Utc>>,
    pub error_message: Option<String>,
}

/// Engine execution status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum EngineExecutionStatus {
    Pending,
    Running,
    Completed,
    Failed,
    Skipped,
}

/// Validation engine trait for standardized execution
#[async_trait]
pub trait ValidationEngine: Send + Sync {
    /// Get the engine name
    fn name(&self) -> &str;

    /// Check if the engine is enabled for this validation
    fn is_enabled(&self, config: &RuntimeConfig) -> bool;

    /// Execute the validation engine
    async fn execute(
        &self,
        env: &ExecutionEnvironment,
        config: &RuntimeConfig,
    ) -> Result<EngineResult>;

    /// Get estimated execution time
    fn estimated_duration(&self, codebase: &Codebase) -> Duration;
}

/// Result from individual validation engine
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineResult {
    pub engine_name: String,
    pub execution_time: Duration,
    pub success: bool,
    pub findings: Vec<Finding>,
    pub metrics: HashMap<String, serde_json::Value>,
    pub recommendations: Vec<String>,
    pub confidence: f64,
}

/// Validation pipeline configuration
#[derive(Debug, Clone)]
pub struct ValidationPipeline {
    pub phases: Vec<ValidationPhase>,
    pub parallel_execution: bool,
    pub timeout_per_phase: HashMap<ValidationPhase, Duration>,
    pub retry_config: RetryConfig,
}

/// Retry configuration for failed validations
#[derive(Debug, Clone)]
pub struct RetryConfig {
    pub max_retries: u32,
    pub retry_delay: Duration,
    pub exponential_backoff: bool,
    pub retryable_errors: Vec<String>,
}

/// Validation result aggregator
#[derive(Debug)]
pub struct ResultAggregator {
    weight_config: ValidationWeights,
}

/// Weights for different validation aspects
#[derive(Debug, Clone)]
pub struct ValidationWeights {
    pub security_weight: f64,
    pub performance_weight: f64,
    pub functionality_weight: f64,
    pub code_quality_weight: f64,
    pub reliability_weight: f64,
}

impl ValidationOrchestrator {
    /// Create a new validation orchestrator
    pub async fn new(
        config: RuntimeConfig,
        container_manager: ContainerManager,
        performance_profiler: PerformanceProfiler,
        security_monitor: SecurityMonitor,
        fuzzing_engine: FuzzingEngine,
        metrics_collector: MetricsCollector,
    ) -> Result<Self> {
        info!("Initializing validation orchestrator");

        Ok(Self {
            config,
            container_manager: Arc::new(container_manager),
            performance_profiler: Arc::new(performance_profiler),
            security_monitor: Arc::new(security_monitor),
            fuzzing_engine: Arc::new(fuzzing_engine),
            metrics_collector: Arc::new(metrics_collector),
            active_validations: Arc::new(RwLock::new(HashMap::new())),
        })
    }

    /// Start a new validation session
    pub async fn start_validation(&self, codebase: &Codebase) -> Result<String> {
        let validation_id = Uuid::new_v4().to_string();
        let started_at = chrono::Utc::now();

        info!(
            validation_id = %validation_id,
            codebase_id = %codebase.id,
            "Starting new validation session"
        );

        // Create validation session
        let session = ValidationSession {
            validation_id: validation_id.clone(),
            codebase_id: codebase.id.clone(),
            status: ValidationStatus::Running,
            started_at,
            estimated_completion: self.estimate_completion_time(codebase),
            progress: ValidationProgress {
                overall_progress: 0.0,
                current_phase: ValidationPhase::Initialization,
                completed_phases: Vec::new(),
                estimated_time_remaining: Some(Duration::from_secs(300)), // 5 minutes default
            },
            engine_status: HashMap::new(),
        };

        // Register session
        {
            let mut active_validations = self.active_validations.write().await;
            active_validations.insert(validation_id.clone(), session);
        }

        // Start validation in background
        let orchestrator = self.clone();
        let codebase_clone = codebase.clone();
        let validation_id_clone = validation_id.clone();
        tokio::spawn(async move {
            if let Err(e) = orchestrator
                .execute_validation(&validation_id_clone, &codebase_clone)
                .await
            {
                error!("Validation failed: {}", e);
                orchestrator
                    .mark_validation_failed(&validation_id_clone, &e.to_string())
                    .await;
            }
        });

        Ok(validation_id)
    }

    /// Get validation status
    pub async fn get_validation_status(
        &self,
        validation_id: &str,
    ) -> Result<Option<ValidationSession>> {
        let active_validations = self.active_validations.read().await;
        Ok(active_validations.get(validation_id).cloned())
    }

    /// List all active validations
    pub async fn list_active_validations(&self) -> Result<Vec<ValidationSession>> {
        let active_validations = self.active_validations.read().await;
        Ok(active_validations.values().cloned().collect())
    }

    /// Cancel a running validation
    pub async fn cancel_validation(&self, validation_id: &str) -> Result<()> {
        let mut active_validations = self.active_validations.write().await;

        if let Some(session) = active_validations.get_mut(validation_id) {
            session.status = ValidationStatus::Cancelled;
            info!("Validation cancelled: {}", validation_id);
        }

        Ok(())
    }

    /// Execute the complete validation pipeline
    async fn execute_validation(
        &self,
        validation_id: &str,
        codebase: &Codebase,
    ) -> Result<ValidationResult> {
        let start_time = Instant::now();

        // Update phase: Environment Setup
        self.update_validation_phase(validation_id, ValidationPhase::EnvironmentSetup)
            .await;

        // Create execution environment
        let execution_env = self
            .container_manager
            .create_execution_environment(codebase)
            .await
            .context("Failed to create execution environment")?;

        // Record container creation
        self.metrics_collector
            .record_container_event(ContainerEvent::Created)
            .await?;

        let mut validation_result = ValidationResult {
            validation_id: validation_id.to_string(),
            codebase_id: codebase.id.clone(),
            status: ValidationStatus::Running,
            started_at: chrono::Utc::now(),
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

        // Execute validation pipeline
        let pipeline_result = self
            .execute_pipeline(&execution_env, &mut validation_result)
            .await;

        // Record container destruction
        let container_lifetime = start_time.elapsed();
        self.metrics_collector
            .record_container_event(ContainerEvent::Destroyed {
                lifetime: container_lifetime,
            })
            .await?;

        // Cleanup environment
        if self.config.validation.cleanup_after_validation {
            if let Err(e) = self
                .container_manager
                .cleanup_environment(&execution_env)
                .await
            {
                warn!("Failed to cleanup execution environment: {}", e);
            }
        }

        // Finalize result
        validation_result.completed_at = Some(chrono::Utc::now());
        validation_result.duration = Some(start_time.elapsed());
        validation_result.status = if pipeline_result.is_ok() {
            ValidationStatus::Completed
        } else {
            ValidationStatus::Failed
        };

        // Calculate overall score
        validation_result.overall_score = self.calculate_overall_score(&validation_result);

        // Update final phase
        self.update_validation_phase(validation_id, ValidationPhase::Completed)
            .await;

        // Record metrics
        let engine_metrics = HashMap::new(); // Would collect from individual engines
        self.metrics_collector
            .record_validation(
                start_time.elapsed(),
                pipeline_result.is_ok(),
                validation_result.overall_score,
                engine_metrics,
            )
            .await?;

        // Remove from active validations
        {
            let mut active_validations = self.active_validations.write().await;
            active_validations.remove(validation_id);
        }

        if let Err(ref e) = pipeline_result {
            error!("Validation pipeline failed: {}", e);
            self.metrics_collector.record_error(
                "ValidationPipelineError".to_string(),
                e.to_string(),
                ErrorSeverity::High,
            )?;
        }

        pipeline_result?;
        Ok(validation_result)
    }

    /// Execute the validation pipeline phases
    async fn execute_pipeline(
        &self,
        env: &ExecutionEnvironment,
        result: &mut ValidationResult,
    ) -> Result<()> {
        let pipeline = self.create_validation_pipeline();

        for phase in &pipeline.phases {
            self.update_validation_phase(&result.validation_id, phase.clone())
                .await;

            match phase {
                ValidationPhase::SecurityScanning => {
                    self.execute_security_validation(env, result).await?;
                }
                ValidationPhase::RuntimeExecution => {
                    self.execute_runtime_validation(env, result).await?;
                }
                ValidationPhase::PerformanceProfiling => {
                    self.execute_performance_validation(env, result).await?;
                }
                ValidationPhase::FuzzTesting => {
                    if self.config.fuzzing.enabled {
                        self.execute_fuzzing_validation(env, result).await?;
                    }
                }
                ValidationPhase::ResultAggregation => {
                    self.aggregate_results(result).await?;
                }
                _ => {
                    // Other phases handled elsewhere or skipped
                    debug!("Skipping phase: {:?}", phase);
                }
            }
        }

        Ok(())
    }

    /// Execute security validation
    async fn execute_security_validation(
        &self,
        env: &ExecutionEnvironment,
        result: &mut ValidationResult,
    ) -> Result<()> {
        info!("Executing security validation");

        self.security_monitor.start_monitoring(env).await?;
        result.security_result = self.security_monitor.collect_results(env).await?;

        // Convert security violations to findings
        for violation in &result.security_result.violations {
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
                file: violation.location.clone(),
                line: None,
                evidence: violation.evidence.clone(),
                confidence: 0.9,
            });
        }

        Ok(())
    }

    /// Execute runtime validation
    async fn execute_runtime_validation(
        &self,
        env: &ExecutionEnvironment,
        result: &mut ValidationResult,
    ) -> Result<()> {
        info!("Executing runtime validation");

        let execution_result = self.container_manager.execute_code(env).await?;

        // Analyze execution results
        if execution_result.exit_code != 0 {
            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::RuntimeError,
                severity: Severity::High,
                title: "Runtime Execution Failed".to_string(),
                description: format!(
                    "Code execution failed with exit code {}",
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
                confidence: 1.0,
            });
        }

        Ok(())
    }

    /// Execute performance validation
    async fn execute_performance_validation(
        &self,
        env: &ExecutionEnvironment,
        result: &mut ValidationResult,
    ) -> Result<()> {
        info!("Executing performance validation");

        self.performance_profiler.start_profiling(env).await?;
        result.performance_metrics = self.performance_profiler.collect_metrics(env).await?;

        // Check for performance issues
        if result.performance_metrics.cpu_usage_percent > 90.0 {
            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::PerformanceIssue,
                severity: Severity::Medium,
                title: "High CPU Usage".to_string(),
                description: format!(
                    "CPU usage ({:.1}%) exceeds threshold",
                    result.performance_metrics.cpu_usage_percent
                ),
                file: None,
                line: None,
                evidence: HashMap::new(),
                confidence: 0.8,
            });
        }

        Ok(())
    }

    /// Execute fuzzing validation
    async fn execute_fuzzing_validation(
        &self,
        env: &ExecutionEnvironment,
        result: &mut ValidationResult,
    ) -> Result<()> {
        info!("Executing fuzzing validation");

        let fuzzing_result = self.fuzzing_engine.fuzz_code(env).await?;

        // Convert crashes to findings
        for crash in &fuzzing_result.crashes {
            let severity = match crash.severity {
                crate::fuzzing::CrashSeverity::Critical => Severity::Critical,
                crate::fuzzing::CrashSeverity::High => Severity::High,
                crate::fuzzing::CrashSeverity::Medium => Severity::Medium,
                crate::fuzzing::CrashSeverity::Low => Severity::Low,
            };

            result.findings.push(Finding {
                id: Uuid::new_v4().to_string(),
                finding_type: FindingType::CrashProne,
                severity,
                title: format!("Fuzzing Crash: {:?}", crash.crash_type),
                description: crash.error_message.clone(),
                file: crash.crash_location.clone(),
                line: None,
                evidence: HashMap::new(),
                confidence: 0.9,
            });
        }

        result.fuzzing_result = Some(fuzzing_result);
        Ok(())
    }

    /// Aggregate validation results
    async fn aggregate_results(&self, result: &mut ValidationResult) -> Result<()> {
        info!("Aggregating validation results");

        let aggregator = ResultAggregator::new();
        result.overall_score = aggregator.calculate_weighted_score(result);
        result.recommendations = aggregator.generate_recommendations(result);

        Ok(())
    }

    /// Create validation pipeline configuration
    fn create_validation_pipeline(&self) -> ValidationPipeline {
        let phases = vec![
            ValidationPhase::Initialization,
            ValidationPhase::EnvironmentSetup,
            ValidationPhase::SecurityScanning,
            ValidationPhase::RuntimeExecution,
            ValidationPhase::PerformanceProfiling,
            ValidationPhase::FuzzTesting,
            ValidationPhase::ResultAggregation,
            ValidationPhase::Cleanup,
        ];

        let mut timeout_per_phase = HashMap::new();
        timeout_per_phase.insert(ValidationPhase::SecurityScanning, Duration::from_secs(60));
        timeout_per_phase.insert(ValidationPhase::RuntimeExecution, Duration::from_secs(120));
        timeout_per_phase.insert(
            ValidationPhase::PerformanceProfiling,
            Duration::from_secs(90),
        );
        timeout_per_phase.insert(ValidationPhase::FuzzTesting, Duration::from_secs(180));

        ValidationPipeline {
            phases,
            parallel_execution: self.config.validation.parallel_execution,
            timeout_per_phase,
            retry_config: RetryConfig {
                max_retries: 2,
                retry_delay: Duration::from_secs(5),
                exponential_backoff: true,
                retryable_errors: vec!["ContainerError".to_string(), "NetworkError".to_string()],
            },
        }
    }

    /// Update validation phase
    async fn update_validation_phase(&self, validation_id: &str, phase: ValidationPhase) {
        let mut active_validations = self.active_validations.write().await;

        if let Some(session) = active_validations.get_mut(validation_id) {
            if !session
                .progress
                .completed_phases
                .contains(&session.progress.current_phase)
            {
                session
                    .progress
                    .completed_phases
                    .push(session.progress.current_phase.clone());
            }
            session.progress.current_phase = phase;
            session.progress.overall_progress =
                session.progress.completed_phases.len() as f64 / 8.0; // 8 total phases
        }
    }

    /// Mark validation as failed
    async fn mark_validation_failed(&self, validation_id: &str, error_message: &str) {
        let mut active_validations = self.active_validations.write().await;

        if let Some(session) = active_validations.get_mut(validation_id) {
            session.status = ValidationStatus::Failed;
            error!("Validation {} failed: {}", validation_id, error_message);
        }
    }

    /// Estimate completion time for validation
    fn estimate_completion_time(
        &self,
        codebase: &Codebase,
    ) -> Option<chrono::DateTime<chrono::Utc>> {
        // Simple estimation based on codebase size
        let estimated_seconds = match codebase.files.len() {
            0..=10 => 120,   // 2 minutes for small codebases
            11..=50 => 300,  // 5 minutes for medium codebases
            51..=100 => 600, // 10 minutes for large codebases
            _ => 900,        // 15 minutes for very large codebases
        };

        Some(chrono::Utc::now() + chrono::Duration::seconds(estimated_seconds))
    }

    /// Calculate overall validation score
    fn calculate_overall_score(&self, result: &ValidationResult) -> f64 {
        let aggregator = ResultAggregator::new();
        aggregator.calculate_weighted_score(result)
    }
}

impl Clone for ValidationOrchestrator {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            container_manager: Arc::clone(&self.container_manager),
            performance_profiler: Arc::clone(&self.performance_profiler),
            security_monitor: Arc::clone(&self.security_monitor),
            fuzzing_engine: Arc::clone(&self.fuzzing_engine),
            metrics_collector: Arc::clone(&self.metrics_collector),
            active_validations: Arc::clone(&self.active_validations),
        }
    }
}

impl ResultAggregator {
    /// Create new result aggregator with default weights
    fn new() -> Self {
        Self {
            weight_config: ValidationWeights {
                security_weight: 0.30,      // 30% security
                performance_weight: 0.20,   // 20% performance
                functionality_weight: 0.25, // 25% functionality
                code_quality_weight: 0.15,  // 15% code quality
                reliability_weight: 0.10,   // 10% reliability
            },
        }
    }

    /// Calculate weighted overall score
    fn calculate_weighted_score(&self, result: &ValidationResult) -> f64 {
        let security_score = result.security_result.security_score;
        let performance_score = self.calculate_performance_score(&result.performance_metrics);
        let functionality_score = self.calculate_functionality_score(result);
        let quality_score = self.calculate_quality_score(result);
        let reliability_score = self.calculate_reliability_score(result);

        let weighted_score = security_score * self.weight_config.security_weight
            + performance_score * self.weight_config.performance_weight
            + functionality_score * self.weight_config.functionality_weight
            + quality_score * self.weight_config.code_quality_weight
            + reliability_score * self.weight_config.reliability_weight;

        weighted_score.clamp(0.0, 100.0)
    }

    /// Calculate performance score
    fn calculate_performance_score(&self, metrics: &PerformanceMetrics) -> f64 {
        let cpu_score = (100.0 - metrics.cpu_usage_percent).max(0.0);
        let memory_score = if metrics.memory_usage_mb > 0 {
            (100.0 - (metrics.memory_usage_mb as f64 / 10.0)).max(0.0)
        } else {
            100.0
        };

        (cpu_score + memory_score) / 2.0
    }

    /// Calculate functionality score based on execution success
    fn calculate_functionality_score(&self, result: &ValidationResult) -> f64 {
        let runtime_errors = result
            .findings
            .iter()
            .filter(|f| matches!(f.finding_type, FindingType::RuntimeError))
            .count();

        if runtime_errors == 0 {
            100.0
        } else {
            (100.0 - (runtime_errors as f64 * 20.0)).max(0.0)
        }
    }

    /// Calculate code quality score
    fn calculate_quality_score(&self, result: &ValidationResult) -> f64 {
        // Simplified quality score based on finding count
        let finding_count = result.findings.len();
        (100.0 - (finding_count as f64 * 5.0)).max(0.0)
    }

    /// Calculate reliability score
    fn calculate_reliability_score(&self, result: &ValidationResult) -> f64 {
        let crash_findings = result
            .findings
            .iter()
            .filter(|f| matches!(f.finding_type, FindingType::CrashProne))
            .count();

        if crash_findings == 0 {
            100.0
        } else {
            (100.0 - (crash_findings as f64 * 25.0)).max(0.0)
        }
    }

    /// Generate recommendations based on results
    fn generate_recommendations(&self, result: &ValidationResult) -> Vec<crate::Recommendation> {
        let mut recommendations = Vec::new();

        // Security recommendations
        if result.security_result.security_score < 70.0 {
            recommendations.push(crate::Recommendation {
                id: Uuid::new_v4().to_string(),
                title: "Improve Security Posture".to_string(),
                description: "Address security vulnerabilities found during scanning".to_string(),
                priority: crate::Priority::Critical,
                action: "Review and fix security findings".to_string(),
                effort: crate::EffortLevel::High,
                impact: crate::ImpactLevel::Critical,
            });
        }

        // Performance recommendations
        if result.performance_metrics.cpu_usage_percent > 80.0 {
            recommendations.push(crate::Recommendation {
                id: Uuid::new_v4().to_string(),
                title: "Optimize Performance".to_string(),
                description: "High resource usage detected during execution".to_string(),
                priority: crate::Priority::Medium,
                action: "Profile and optimize CPU-intensive operations".to_string(),
                effort: crate::EffortLevel::Medium,
                impact: crate::ImpactLevel::High,
            });
        }

        recommendations
    }
}

impl Default for ValidationProgress {
    fn default() -> Self {
        Self {
            overall_progress: 0.0,
            current_phase: ValidationPhase::Initialization,
            completed_phases: Vec::new(),
            estimated_time_remaining: None,
        }
    }
}
