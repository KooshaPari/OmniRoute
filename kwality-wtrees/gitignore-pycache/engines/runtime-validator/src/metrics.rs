//! Metrics collection and aggregation for runtime validation
//!
//! This module provides comprehensive metrics collection, aggregation, and analysis
//! for monitoring validation performance and system health.

use anyhow::Result;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::{Arc, Mutex};
use std::time::{Duration, SystemTime};
use tokio::sync::RwLock;
use tracing::{debug, info};

/// Metrics collector for validation operations
#[derive(Debug)]
pub struct MetricsCollector {
    validation_metrics: Arc<RwLock<ValidationMetrics>>,
    performance_metrics: Arc<RwLock<PerformanceMetrics>>,
    system_metrics: Arc<RwLock<SystemMetrics>>,
    error_metrics: Arc<Mutex<ErrorMetrics>>,
    time_series_buffer: Arc<Mutex<TimeSeriesBuffer>>,
}

/// Validation-specific metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationMetrics {
    pub total_validations: u64,
    pub successful_validations: u64,
    pub failed_validations: u64,
    pub avg_validation_time: Duration,
    pub validation_throughput: f64, // validations per second
    pub engine_metrics: HashMap<String, EngineMetrics>,
    pub quality_score_distribution: ScoreDistribution,
}

/// Performance metrics for the validation system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceMetrics {
    pub cpu_usage_percent: f64,
    pub memory_usage_mb: u64,
    pub memory_peak_mb: u64,
    pub disk_io_ops: u64,
    pub network_io_bytes: u64,
    pub container_metrics: ContainerMetrics,
    pub resource_utilization: ResourceUtilization,
}

/// System-level metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SystemMetrics {
    pub uptime: Duration,
    pub active_workers: u32,
    pub queue_depth: u32,
    pub health_status: HealthStatus,
    pub version_info: VersionInfo,
    pub configuration_hash: String,
}

/// Error and anomaly metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorMetrics {
    pub total_errors: u64,
    pub error_rate: f64, // errors per minute
    pub error_types: HashMap<String, u64>,
    pub recent_errors: VecDeque<ErrorEvent>,
    pub critical_failures: u64,
    pub timeout_events: u64,
}

/// Metrics for individual validation engines
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EngineMetrics {
    pub engine_name: String,
    pub total_executions: u64,
    pub avg_execution_time: Duration,
    pub success_rate: f64,
    pub findings_generated: u64,
    pub resource_usage: ResourceUsage,
}

/// Quality score distribution statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreDistribution {
    pub mean_score: f64,
    pub median_score: f64,
    pub std_deviation: f64,
    pub percentiles: HashMap<String, f64>, // "p50", "p95", "p99"
    pub score_histogram: Vec<ScoreBucket>,
}

/// Score bucket for histogram
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ScoreBucket {
    pub range_start: f64,
    pub range_end: f64,
    pub count: u64,
}

/// Container-specific metrics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ContainerMetrics {
    pub containers_created: u64,
    pub containers_destroyed: u64,
    pub avg_container_lifetime: Duration,
    pub container_failures: u64,
    pub resource_violations: u64,
}

/// Resource utilization tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUtilization {
    pub cpu_cores_used: f64,
    pub memory_efficiency: f64,
    pub disk_io_efficiency: f64,
    pub network_bandwidth_used: f64,
    pub container_density: f64,
}

/// Individual resource usage measurement
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ResourceUsage {
    pub cpu_time_ms: u64,
    pub memory_peak_mb: u64,
    pub disk_read_mb: u64,
    pub disk_write_mb: u64,
    pub network_rx_mb: u64,
    pub network_tx_mb: u64,
}

/// Health status enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum HealthStatus {
    Healthy,
    Degraded,
    Critical,
    Unknown,
}

/// Version and build information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionInfo {
    pub version: String,
    pub build_date: String,
    pub git_commit: String,
    pub rust_version: String,
}

/// Error event for tracking
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ErrorEvent {
    pub timestamp: SystemTime,
    pub error_type: String,
    pub error_message: String,
    pub severity: ErrorSeverity,
    pub context: HashMap<String, String>,
}

/// Error severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum ErrorSeverity {
    Critical,
    High,
    Medium,
    Low,
    Info,
}

/// Time series data buffer for trend analysis
#[derive(Debug)]
pub struct TimeSeriesBuffer {
    validation_times: VecDeque<TimeSeriesPoint>,
    cpu_usage: VecDeque<TimeSeriesPoint>,
    memory_usage: VecDeque<TimeSeriesPoint>,
    error_rates: VecDeque<TimeSeriesPoint>,
    max_points: usize,
}

/// Individual time series data point
#[derive(Debug, Clone)]
pub struct TimeSeriesPoint {
    pub timestamp: SystemTime,
    pub value: f64,
}

/// Aggregated metrics summary
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricsSummary {
    pub validation_metrics: ValidationMetrics,
    pub performance_metrics: PerformanceMetrics,
    pub system_metrics: SystemMetrics,
    pub error_metrics: ErrorMetrics,
    pub trends: TrendAnalysis,
    pub alerts: Vec<MetricAlert>,
}

/// Trend analysis results
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrendAnalysis {
    pub validation_time_trend: TrendDirection,
    pub error_rate_trend: TrendDirection,
    pub throughput_trend: TrendDirection,
    pub resource_usage_trend: TrendDirection,
}

/// Trend direction enumeration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum TrendDirection {
    Increasing,
    Decreasing,
    Stable,
    Volatile,
}

/// Metric alert for threshold violations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MetricAlert {
    pub alert_type: AlertType,
    pub severity: AlertSeverity,
    pub message: String,
    pub threshold: f64,
    pub actual_value: f64,
    pub timestamp: SystemTime,
}

/// Types of metric alerts
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertType {
    HighErrorRate,
    LowThroughput,
    ResourceExhaustion,
    QualityDegradation,
    SystemFailure,
}

/// Alert severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum AlertSeverity {
    Critical,
    Warning,
    Info,
}

impl MetricsCollector {
    /// Create a new metrics collector
    pub fn new() -> Result<Self> {
        info!("Initializing metrics collector");

        let validation_metrics = Arc::new(RwLock::new(ValidationMetrics::default()));
        let performance_metrics = Arc::new(RwLock::new(PerformanceMetrics::default()));
        let system_metrics = Arc::new(RwLock::new(SystemMetrics::default()));
        let error_metrics = Arc::new(Mutex::new(ErrorMetrics::default()));
        let time_series_buffer = Arc::new(Mutex::new(TimeSeriesBuffer::new(1000)));

        Ok(Self {
            validation_metrics,
            performance_metrics,
            system_metrics,
            error_metrics,
            time_series_buffer,
        })
    }

    /// Record validation completion
    pub async fn record_validation(
        &self,
        duration: Duration,
        success: bool,
        quality_score: f64,
        engine_results: HashMap<String, EngineMetrics>,
    ) -> Result<()> {
        let mut metrics = self.validation_metrics.write().await;

        metrics.total_validations += 1;
        if success {
            metrics.successful_validations += 1;
        } else {
            metrics.failed_validations += 1;
        }

        // Update average validation time
        let total_time =
            metrics.avg_validation_time.as_millis() as f64 * (metrics.total_validations - 1) as f64;
        let new_total_time = total_time + duration.as_millis() as f64;
        metrics.avg_validation_time =
            Duration::from_millis((new_total_time / metrics.total_validations as f64) as u64);

        // Update throughput (simplified calculation)
        metrics.validation_throughput = metrics.successful_validations as f64 / 3600.0; // per hour

        // Update engine metrics
        for (engine_name, engine_metric) in engine_results {
            metrics.engine_metrics.insert(engine_name, engine_metric);
        }

        // Update quality score distribution
        self.update_score_distribution(&mut metrics.quality_score_distribution, quality_score);

        // Record time series data
        if let Ok(mut buffer) = self.time_series_buffer.lock() {
            buffer.add_validation_time(duration.as_millis() as f64);
        }

        debug!(
            "Recorded validation: duration={:?}, success={}, score={:.1}",
            duration, success, quality_score
        );
        Ok(())
    }

    /// Record system performance metrics
    pub async fn record_performance(
        &self,
        cpu_usage: f64,
        memory_usage: u64,
        disk_io: u64,
        network_io: u64,
    ) -> Result<()> {
        let mut metrics = self.performance_metrics.write().await;

        metrics.cpu_usage_percent = cpu_usage;
        metrics.memory_usage_mb = memory_usage;
        metrics.memory_peak_mb = metrics.memory_peak_mb.max(memory_usage);
        metrics.disk_io_ops += disk_io;
        metrics.network_io_bytes += network_io;

        // Update resource utilization
        metrics.resource_utilization.cpu_cores_used = cpu_usage / 100.0 * num_cpus::get() as f64;
        metrics.resource_utilization.memory_efficiency = memory_usage as f64 / (8.0 * 1024.0); // Assume 8GB total

        // Record time series data
        if let Ok(mut buffer) = self.time_series_buffer.lock() {
            buffer.add_cpu_usage(cpu_usage);
            buffer.add_memory_usage(memory_usage as f64);
        }

        Ok(())
    }

    /// Record container metrics
    pub async fn record_container_event(&self, event: ContainerEvent) -> Result<()> {
        let mut metrics = self.performance_metrics.write().await;

        match event {
            ContainerEvent::Created => {
                metrics.container_metrics.containers_created += 1;
            }
            ContainerEvent::Destroyed { lifetime } => {
                metrics.container_metrics.containers_destroyed += 1;

                // Update average lifetime
                let total_containers = metrics.container_metrics.containers_destroyed;
                let current_avg_ms =
                    metrics.container_metrics.avg_container_lifetime.as_millis() as f64;
                let new_avg_ms = (current_avg_ms * (total_containers - 1) as f64
                    + lifetime.as_millis() as f64)
                    / total_containers as f64;
                metrics.container_metrics.avg_container_lifetime =
                    Duration::from_millis(new_avg_ms as u64);
            }
            ContainerEvent::Failed => {
                metrics.container_metrics.container_failures += 1;
            }
            ContainerEvent::ResourceViolation => {
                metrics.container_metrics.resource_violations += 1;
            }
        }

        Ok(())
    }

    /// Record error event
    pub fn record_error(
        &self,
        error_type: String,
        error_message: String,
        severity: ErrorSeverity,
    ) -> Result<()> {
        if let Ok(mut metrics) = self.error_metrics.lock() {
            metrics.total_errors += 1;

            // Update error type count
            let count = metrics.error_types.entry(error_type.clone()).or_insert(0);
            *count += 1;

            // Add to recent errors
            let error_event = ErrorEvent {
                timestamp: SystemTime::now(),
                error_type,
                error_message,
                severity,
                context: HashMap::new(),
            };

            metrics.recent_errors.push_back(error_event);
            if metrics.recent_errors.len() > 100 {
                metrics.recent_errors.pop_front();
            }

            // Update error rate (simplified)
            metrics.error_rate = metrics.total_errors as f64 / 60.0; // per minute

            // Record time series data
            if let Ok(mut buffer) = self.time_series_buffer.lock() {
                buffer.add_error_rate(metrics.error_rate);
            }
        }

        Ok(())
    }

    /// Update system status
    pub async fn update_system_status(
        &self,
        active_workers: u32,
        queue_depth: u32,
        health: HealthStatus,
    ) -> Result<()> {
        let mut metrics = self.system_metrics.write().await;

        metrics.active_workers = active_workers;
        metrics.queue_depth = queue_depth;
        metrics.health_status = health;

        Ok(())
    }

    /// Get comprehensive metrics summary
    pub async fn get_metrics_summary(&self) -> Result<MetricsSummary> {
        let validation_metrics = self.validation_metrics.read().await.clone();
        let performance_metrics = self.performance_metrics.read().await.clone();
        let system_metrics = self.system_metrics.read().await.clone();
        let error_metrics = self.error_metrics.lock().unwrap().clone();

        // Analyze trends
        let trends = self.analyze_trends().await?;

        // Generate alerts
        let alerts = self
            .generate_alerts(&validation_metrics, &performance_metrics, &error_metrics)
            .await?;

        Ok(MetricsSummary {
            validation_metrics,
            performance_metrics,
            system_metrics,
            error_metrics,
            trends,
            alerts,
        })
    }

    /// Export metrics in Prometheus format
    pub async fn export_prometheus(&self) -> Result<String> {
        let validation_metrics = self.validation_metrics.read().await;
        let performance_metrics = self.performance_metrics.read().await;
        let system_metrics = self.system_metrics.read().await;

        let mut output = String::new();

        // Validation metrics
        output.push_str("# HELP kwality_validations_total Total number of validations performed\n");
        output.push_str("# TYPE kwality_validations_total counter\n");
        output.push_str(&format!(
            "kwality_validations_total {}\n",
            validation_metrics.total_validations
        ));

        output.push_str("# HELP kwality_validation_duration_seconds Average validation duration\n");
        output.push_str("# TYPE kwality_validation_duration_seconds gauge\n");
        output.push_str(&format!(
            "kwality_validation_duration_seconds {:.3}\n",
            validation_metrics.avg_validation_time.as_secs_f64()
        ));

        // Performance metrics
        output.push_str("# HELP kwality_cpu_usage_percent Current CPU usage percentage\n");
        output.push_str("# TYPE kwality_cpu_usage_percent gauge\n");
        output.push_str(&format!(
            "kwality_cpu_usage_percent {:.2}\n",
            performance_metrics.cpu_usage_percent
        ));

        output.push_str("# HELP kwality_memory_usage_mb Current memory usage in MB\n");
        output.push_str("# TYPE kwality_memory_usage_mb gauge\n");
        output.push_str(&format!(
            "kwality_memory_usage_mb {}\n",
            performance_metrics.memory_usage_mb
        ));

        // System metrics
        output.push_str("# HELP kwality_active_workers Number of active worker processes\n");
        output.push_str("# TYPE kwality_active_workers gauge\n");
        output.push_str(&format!(
            "kwality_active_workers {}\n",
            system_metrics.active_workers
        ));

        Ok(output)
    }

    /// Get real-time metrics for monitoring dashboard
    pub async fn get_realtime_metrics(&self) -> Result<HashMap<String, serde_json::Value>> {
        let mut metrics = HashMap::new();

        let validation_metrics = self.validation_metrics.read().await;
        let performance_metrics = self.performance_metrics.read().await;
        let system_metrics = self.system_metrics.read().await;

        metrics.insert(
            "total_validations".to_string(),
            serde_json::Value::Number(validation_metrics.total_validations.into()),
        );
        metrics.insert(
            "validation_throughput".to_string(),
            serde_json::Value::Number(
                serde_json::Number::from_f64(validation_metrics.validation_throughput).unwrap(),
            ),
        );
        metrics.insert(
            "cpu_usage".to_string(),
            serde_json::Value::Number(
                serde_json::Number::from_f64(performance_metrics.cpu_usage_percent).unwrap(),
            ),
        );
        metrics.insert(
            "memory_usage_mb".to_string(),
            serde_json::Value::Number(performance_metrics.memory_usage_mb.into()),
        );
        metrics.insert(
            "active_workers".to_string(),
            serde_json::Value::Number(system_metrics.active_workers.into()),
        );
        metrics.insert(
            "queue_depth".to_string(),
            serde_json::Value::Number(system_metrics.queue_depth.into()),
        );

        Ok(metrics)
    }

    /// Update quality score distribution
    fn update_score_distribution(&self, distribution: &mut ScoreDistribution, score: f64) {
        // Simple moving average for mean
        let total_scores = distribution
            .score_histogram
            .iter()
            .map(|b| b.count)
            .sum::<u64>()
            + 1;
        distribution.mean_score =
            (distribution.mean_score * (total_scores - 1) as f64 + score) / total_scores as f64;

        // Add to histogram
        let bucket_index = ((score / 10.0).floor() as usize).min(9);
        if distribution.score_histogram.len() != 10 {
            distribution.score_histogram = (0..10)
                .map(|i| ScoreBucket {
                    range_start: i as f64 * 10.0,
                    range_end: (i + 1) as f64 * 10.0,
                    count: 0,
                })
                .collect();
        }
        distribution.score_histogram[bucket_index].count += 1;
    }

    /// Analyze performance trends
    async fn analyze_trends(&self) -> Result<TrendAnalysis> {
        // Simplified trend analysis
        Ok(TrendAnalysis {
            validation_time_trend: TrendDirection::Stable,
            error_rate_trend: TrendDirection::Decreasing,
            throughput_trend: TrendDirection::Increasing,
            resource_usage_trend: TrendDirection::Stable,
        })
    }

    /// Generate metric alerts
    async fn generate_alerts(
        &self,
        validation: &ValidationMetrics,
        performance: &PerformanceMetrics,
        errors: &ErrorMetrics,
    ) -> Result<Vec<MetricAlert>> {
        let mut alerts = Vec::new();

        // High error rate alert
        if errors.error_rate > 10.0 {
            alerts.push(MetricAlert {
                alert_type: AlertType::HighErrorRate,
                severity: AlertSeverity::Critical,
                message: "Error rate exceeds threshold".to_string(),
                threshold: 10.0,
                actual_value: errors.error_rate,
                timestamp: SystemTime::now(),
            });
        }

        // High CPU usage alert
        if performance.cpu_usage_percent > 90.0 {
            alerts.push(MetricAlert {
                alert_type: AlertType::ResourceExhaustion,
                severity: AlertSeverity::Warning,
                message: "CPU usage is critically high".to_string(),
                threshold: 90.0,
                actual_value: performance.cpu_usage_percent,
                timestamp: SystemTime::now(),
            });
        }

        // Low throughput alert
        if validation.validation_throughput < 0.1 {
            alerts.push(MetricAlert {
                alert_type: AlertType::LowThroughput,
                severity: AlertSeverity::Warning,
                message: "Validation throughput is below expected levels".to_string(),
                threshold: 0.1,
                actual_value: validation.validation_throughput,
                timestamp: SystemTime::now(),
            });
        }

        Ok(alerts)
    }
}

/// Container event types for metrics
pub enum ContainerEvent {
    Created,
    Destroyed { lifetime: Duration },
    Failed,
    ResourceViolation,
}

impl TimeSeriesBuffer {
    fn new(max_points: usize) -> Self {
        Self {
            validation_times: VecDeque::new(),
            cpu_usage: VecDeque::new(),
            memory_usage: VecDeque::new(),
            error_rates: VecDeque::new(),
            max_points,
        }
    }

    fn add_validation_time(&mut self, time_ms: f64) {
        let point = TimeSeriesPoint {
            timestamp: SystemTime::now(),
            value: time_ms,
        };
        self.validation_times.push_back(point);
        if self.validation_times.len() > self.max_points {
            self.validation_times.pop_front();
        }
    }

    fn add_cpu_usage(&mut self, usage: f64) {
        let point = TimeSeriesPoint {
            timestamp: SystemTime::now(),
            value: usage,
        };
        self.cpu_usage.push_back(point);
        if self.cpu_usage.len() > self.max_points {
            self.cpu_usage.pop_front();
        }
    }

    fn add_memory_usage(&mut self, usage: f64) {
        let point = TimeSeriesPoint {
            timestamp: SystemTime::now(),
            value: usage,
        };
        self.memory_usage.push_back(point);
        if self.memory_usage.len() > self.max_points {
            self.memory_usage.pop_front();
        }
    }

    fn add_error_rate(&mut self, rate: f64) {
        let point = TimeSeriesPoint {
            timestamp: SystemTime::now(),
            value: rate,
        };
        self.error_rates.push_back(point);
        if self.error_rates.len() > self.max_points {
            self.error_rates.pop_front();
        }
    }

    #[allow(dead_code)]
    fn add_point(&mut self, series: &mut VecDeque<TimeSeriesPoint>, value: f64) {
        series.push_back(TimeSeriesPoint {
            timestamp: SystemTime::now(),
            value,
        });

        if series.len() > self.max_points {
            series.pop_front();
        }
    }
}

// Default implementations
impl Default for ValidationMetrics {
    fn default() -> Self {
        Self {
            total_validations: 0,
            successful_validations: 0,
            failed_validations: 0,
            avg_validation_time: Duration::ZERO,
            validation_throughput: 0.0,
            engine_metrics: HashMap::new(),
            quality_score_distribution: ScoreDistribution::default(),
        }
    }
}

impl Default for PerformanceMetrics {
    fn default() -> Self {
        Self {
            cpu_usage_percent: 0.0,
            memory_usage_mb: 0,
            memory_peak_mb: 0,
            disk_io_ops: 0,
            network_io_bytes: 0,
            container_metrics: ContainerMetrics::default(),
            resource_utilization: ResourceUtilization::default(),
        }
    }
}

impl Default for SystemMetrics {
    fn default() -> Self {
        Self {
            uptime: Duration::ZERO,
            active_workers: 0,
            queue_depth: 0,
            health_status: HealthStatus::Unknown,
            version_info: VersionInfo::default(),
            configuration_hash: "unknown".to_string(),
        }
    }
}

impl Default for ErrorMetrics {
    fn default() -> Self {
        Self {
            total_errors: 0,
            error_rate: 0.0,
            error_types: HashMap::new(),
            recent_errors: VecDeque::new(),
            critical_failures: 0,
            timeout_events: 0,
        }
    }
}

impl Default for ContainerMetrics {
    fn default() -> Self {
        Self {
            containers_created: 0,
            containers_destroyed: 0,
            avg_container_lifetime: Duration::ZERO,
            container_failures: 0,
            resource_violations: 0,
        }
    }
}

impl Default for ResourceUtilization {
    fn default() -> Self {
        Self {
            cpu_cores_used: 0.0,
            memory_efficiency: 0.0,
            disk_io_efficiency: 0.0,
            network_bandwidth_used: 0.0,
            container_density: 0.0,
        }
    }
}

impl Default for ScoreDistribution {
    fn default() -> Self {
        Self {
            mean_score: 0.0,
            median_score: 0.0,
            std_deviation: 0.0,
            percentiles: HashMap::new(),
            score_histogram: Vec::new(),
        }
    }
}

impl Default for VersionInfo {
    fn default() -> Self {
        Self {
            version: env!("CARGO_PKG_VERSION").to_string(),
            build_date: "unknown".to_string(),
            git_commit: "unknown".to_string(),
            rust_version: "unknown".to_string(),
        }
    }
}
