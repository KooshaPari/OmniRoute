//! Fuzzing engine for dynamic code validation
//!
//! This module provides fuzzing capabilities to test code robustness by generating
//! random inputs and monitoring program behavior under stress conditions.

use anyhow::Result;
use rand::Rng;
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::sync::Mutex;
use std::time::{Duration, Instant};
use tracing::{debug, info};

use crate::container::ExecutionEnvironment;
use crate::{FuzzingConfig, FuzzingStrategy};

/// Fuzzing engine for generating test inputs and monitoring behavior
#[derive(Debug)]
pub struct FuzzingEngine {
    config: FuzzingConfig,
    input_generators: Vec<Box<dyn InputGenerator>>,
    coverage_tracker: Mutex<CoverageTracker>,
    crash_detector: Mutex<CrashDetector>,
}

/// Result of fuzzing execution
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FuzzingResult {
    pub total_executions: u32,
    pub crashes_found: u32,
    pub unique_crashes: u32,
    pub coverage_percentage: f64,
    pub execution_time: Duration,
    pub crashes: Vec<CrashReport>,
    pub interesting_inputs: Vec<InterestingInput>,
    pub coverage_info: CoverageInfo,
    pub performance_anomalies: Vec<PerformanceAnomaly>,
}

/// Individual crash report
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CrashReport {
    pub id: String,
    pub crash_type: CrashType,
    pub severity: CrashSeverity,
    pub reproducer_input: String,
    pub stack_trace: String,
    pub error_message: String,
    pub timestamp: chrono::DateTime<chrono::Utc>,
    pub crash_location: Option<String>,
}

/// Types of crashes that can be detected
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CrashType {
    SegmentationFault,
    MemoryCorruption,
    StackOverflow,
    HeapOverflow,
    IntegerOverflow,
    DivisionByZero,
    NullPointerDereference,
    AssertionFailure,
    Panic,
    Timeout,
    OutOfMemory,
    Other(String),
}

/// Crash severity levels
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum CrashSeverity {
    Critical,
    High,
    Medium,
    Low,
}

/// Interesting input that produced unique behavior
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InterestingInput {
    pub input_data: String,
    pub execution_path: String,
    pub coverage_increase: f64,
    pub execution_time: Duration,
    pub memory_usage: u64,
    pub uniqueness_score: f64,
}

/// Code coverage information
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct CoverageInfo {
    pub lines_covered: u32,
    pub total_lines: u32,
    pub functions_covered: u32,
    pub total_functions: u32,
    pub branches_covered: u32,
    pub total_branches: u32,
    pub coverage_map: HashMap<String, u32>,
}

/// Performance anomaly detected during fuzzing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PerformanceAnomaly {
    pub anomaly_type: PerformanceAnomalyType,
    pub input_trigger: String,
    pub baseline_performance: f64,
    pub anomaly_performance: f64,
    pub severity: f64,
    pub description: String,
}

/// Types of performance anomalies
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum PerformanceAnomalyType {
    ExcessiveExecutionTime,
    MemoryLeak,
    CpuSpike,
    InfiniteLoop,
    ResourceExhaustion,
}

/// Input generator trait for creating test inputs
pub trait InputGenerator: Send + Sync + std::fmt::Debug {
    fn generate_input(&self) -> Result<String>;
    fn mutate_input(&self, input: &str) -> Result<String>;
    fn get_generator_type(&self) -> &'static str;
}

/// Random input generator
#[derive(Debug)]
pub struct RandomInputGenerator {
    max_length: usize,
}

/// Structured input generator
#[derive(Debug)]
pub struct StructuredInputGenerator {
    templates: Vec<String>,
}

/// Grammar-based input generator
#[derive(Debug)]
pub struct GrammarInputGenerator {
    grammar_rules: HashMap<String, Vec<String>>,
}

/// Mutation-based input generator
#[derive(Debug)]
pub struct MutationInputGenerator {
    seed_inputs: Vec<String>,
}

/// Coverage tracking for fuzzing
#[derive(Debug)]
pub struct CoverageTracker {
    coverage_map: HashMap<String, u32>,
    total_coverage: f64,
}

/// Crash detection and analysis
#[derive(Debug)]
pub struct CrashDetector {
    crash_patterns: Vec<CrashPattern>,
    crash_history: VecDeque<CrashReport>,
}

/// Pattern for detecting specific crash types
#[derive(Debug, Clone)]
pub struct CrashPattern {
    pub pattern: regex::Regex,
    pub crash_type: CrashType,
    pub severity: CrashSeverity,
}

impl FuzzingEngine {
    /// Create a new fuzzing engine
    pub fn new(config: FuzzingConfig) -> Result<Self> {
        info!(
            "Initializing fuzzing engine with strategy: {:?}",
            config.strategy
        );

        let mut input_generators: Vec<Box<dyn InputGenerator>> = Vec::new();

        // Add input generators based on strategy
        match config.strategy {
            FuzzingStrategy::Random => {
                input_generators.push(Box::new(RandomInputGenerator::new(1024)?));
            }
            FuzzingStrategy::Structured => {
                input_generators.push(Box::new(StructuredInputGenerator::new()?));
            }
            FuzzingStrategy::Grammar => {
                input_generators.push(Box::new(GrammarInputGenerator::new()?));
            }
            FuzzingStrategy::Mutation => {
                input_generators.push(Box::new(MutationInputGenerator::new()?));
            }
        }

        let coverage_tracker = CoverageTracker::new();
        let crash_detector = CrashDetector::new()?;

        Ok(Self {
            config,
            input_generators,
            coverage_tracker: Mutex::new(coverage_tracker),
            crash_detector: Mutex::new(crash_detector),
        })
    }

    /// Run fuzzing campaign on the execution environment
    pub async fn fuzz_code(&self, env: &ExecutionEnvironment) -> Result<FuzzingResult> {
        info!("Starting fuzzing campaign for environment {}", env.id);

        let start_time = Instant::now();
        let mut result = FuzzingResult {
            total_executions: 0,
            crashes_found: 0,
            unique_crashes: 0,
            coverage_percentage: 0.0,
            execution_time: Duration::ZERO,
            crashes: Vec::new(),
            interesting_inputs: Vec::new(),
            coverage_info: CoverageInfo::default(),
            performance_anomalies: Vec::new(),
        };

        // Run fuzzing iterations
        for i in 0..self.config.iterations {
            if start_time.elapsed() > Duration::from_secs(self.config.duration_seconds) {
                info!("Fuzzing campaign reached time limit");
                break;
            }

            // Generate input
            let input = self.generate_test_input()?;

            // Execute with input
            let execution_result = self.execute_with_input(env, &input).await?;

            result.total_executions += 1;

            // Check for crashes
            if let Some(crash) = self
                .crash_detector
                .lock()
                .unwrap()
                .analyze_execution(&execution_result)?
            {
                result.crashes_found += 1;
                if self.is_unique_crash(&crash, &result.crashes) {
                    result.unique_crashes += 1;
                    result.crashes.push(crash);
                }
            }

            // Update coverage if enabled
            if self.config.coverage_guided {
                let coverage_change = self
                    .coverage_tracker
                    .lock()
                    .unwrap()
                    .update_coverage(&execution_result)?;
                if coverage_change > 0.0 {
                    result.interesting_inputs.push(InterestingInput {
                        input_data: input.clone(),
                        execution_path: execution_result.execution_path.clone(),
                        coverage_increase: coverage_change,
                        execution_time: execution_result.execution_time,
                        memory_usage: execution_result.memory_usage,
                        uniqueness_score: self
                            .calculate_uniqueness_score(&input, &result.interesting_inputs),
                    });
                }
            }

            // Check for performance anomalies
            if let Some(anomaly) = self.detect_performance_anomaly(&input, &execution_result)? {
                result.performance_anomalies.push(anomaly);
            }

            if i % 100 == 0 {
                debug!(
                    "Fuzzing progress: {}/{} executions",
                    i + 1,
                    self.config.iterations
                );
            }
        }

        result.execution_time = start_time.elapsed();
        result.coverage_percentage = self
            .coverage_tracker
            .lock()
            .unwrap()
            .get_coverage_percentage();
        result.coverage_info = self.coverage_tracker.lock().unwrap().get_coverage_info();

        info!(
            "Fuzzing campaign completed: {} executions, {} crashes found, {:.1}% coverage",
            result.total_executions, result.crashes_found, result.coverage_percentage
        );

        Ok(result)
    }

    /// Generate test input using configured generators
    fn generate_test_input(&self) -> Result<String> {
        if self.input_generators.is_empty() {
            return Ok("".to_string());
        }

        let mut rng = rand::thread_rng();
        let generator_index = rng.gen_range(0..self.input_generators.len());
        let generator = &self.input_generators[generator_index];

        generator.generate_input()
    }

    /// Execute code with given input (simplified simulation)
    async fn execute_with_input(
        &self,
        _env: &ExecutionEnvironment,
        _input: &str,
    ) -> Result<ExecutionResult> {
        // Simplified execution result for demonstration
        // In a real implementation, this would execute the code with the input
        // and collect detailed execution information

        let mut rng = rand::thread_rng();
        let execution_time = Duration::from_millis(rng.gen_range(1..100));
        let memory_usage = rng.gen_range(1024..10240);
        let exit_code = if rng.gen_range(0..1000) < 5 { -1 } else { 0 }; // 0.5% crash rate

        Ok(ExecutionResult {
            exit_code,
            execution_time,
            memory_usage,
            execution_path: format!("path-{}", rng.gen_range(1..100)),
            stdout: "".to_string(),
            stderr: if exit_code != 0 {
                "segmentation fault".to_string()
            } else {
                "".to_string()
            },
        })
    }

    /// Check if crash is unique compared to existing crashes
    fn is_unique_crash(&self, crash: &CrashReport, existing_crashes: &[CrashReport]) -> bool {
        !existing_crashes.iter().any(|existing| {
            std::mem::discriminant(&crash.crash_type)
                == std::mem::discriminant(&existing.crash_type)
                && crash.crash_location == existing.crash_location
        })
    }

    /// Calculate uniqueness score for an input
    fn calculate_uniqueness_score(&self, input: &str, existing_inputs: &[InterestingInput]) -> f64 {
        if existing_inputs.is_empty() {
            return 1.0;
        }

        let mut min_distance = f64::MAX;
        for existing in existing_inputs {
            let distance = self.calculate_input_distance(input, &existing.input_data);
            min_distance = min_distance.min(distance);
        }

        // Normalize to 0-1 range
        (min_distance / (min_distance + 1.0)).min(1.0)
    }

    /// Calculate distance between two inputs
    fn calculate_input_distance(&self, input1: &str, input2: &str) -> f64 {
        // Simple Levenshtein distance normalized by length
        let distance = levenshtein::levenshtein(input1, input2) as f64;
        let max_len = input1.len().max(input2.len()) as f64;

        if max_len == 0.0 {
            0.0
        } else {
            distance / max_len
        }
    }

    /// Detect performance anomalies in execution
    fn detect_performance_anomaly(
        &self,
        input: &str,
        execution: &ExecutionResult,
    ) -> Result<Option<PerformanceAnomaly>> {
        // Simple performance anomaly detection
        if execution.execution_time > Duration::from_millis(1000) {
            return Ok(Some(PerformanceAnomaly {
                anomaly_type: PerformanceAnomalyType::ExcessiveExecutionTime,
                input_trigger: input.to_string(),
                baseline_performance: 50.0, // ms
                anomaly_performance: execution.execution_time.as_millis() as f64,
                severity: (execution.execution_time.as_millis() as f64 / 1000.0).min(1.0),
                description: "Execution time significantly exceeds baseline".to_string(),
            }));
        }

        if execution.memory_usage > 50 * 1024 * 1024 {
            // 50MB
            return Ok(Some(PerformanceAnomaly {
                anomaly_type: PerformanceAnomalyType::MemoryLeak,
                input_trigger: input.to_string(),
                baseline_performance: 1024.0 * 1024.0, // 1MB
                anomaly_performance: execution.memory_usage as f64,
                severity: (execution.memory_usage as f64 / (50.0 * 1024.0 * 1024.0)).min(1.0),
                description: "Memory usage significantly exceeds baseline".to_string(),
            }));
        }

        Ok(None)
    }
}

/// Simplified execution result for fuzzing
#[derive(Debug)]
struct ExecutionResult {
    exit_code: i32,
    execution_time: Duration,
    memory_usage: u64,
    execution_path: String,
    #[allow(dead_code)]
    stdout: String,
    stderr: String,
}

impl RandomInputGenerator {
    fn new(max_length: usize) -> Result<Self> {
        Ok(Self { max_length })
    }
}

impl InputGenerator for RandomInputGenerator {
    fn generate_input(&self) -> Result<String> {
        let mut rng = rand::thread_rng();
        let length = rng.gen_range(1..=self.max_length);
        let input: String = (0..length)
            .map(|_| rng.gen_range(0..255) as u8 as char)
            .collect();
        Ok(input)
    }

    fn mutate_input(&self, input: &str) -> Result<String> {
        let mut rng = rand::thread_rng();
        let mut bytes = input.as_bytes().to_vec();

        if !bytes.is_empty() {
            let index = rng.gen_range(0..bytes.len());
            bytes[index] = rng.gen_range(0..255);
        }

        Ok(String::from_utf8_lossy(&bytes).to_string())
    }

    fn get_generator_type(&self) -> &'static str {
        "random"
    }
}

impl StructuredInputGenerator {
    fn new() -> Result<Self> {
        let templates = vec![
            "{{\"key\": \"value\"}}".to_string(),
            "{{\"number\": {}}}".to_string(),
            "{{\"array\": [1, 2, 3]}}".to_string(),
            "{{\"nested\": {{\"inner\": \"value\"}}}}".to_string(),
        ];
        Ok(Self { templates })
    }
}

impl InputGenerator for StructuredInputGenerator {
    fn generate_input(&self) -> Result<String> {
        let mut rng = rand::thread_rng();
        let template = &self.templates[rng.gen_range(0..self.templates.len())];

        // Simple template filling
        let value = rng.gen_range(1..1000);
        let result = template.replace("{}", &value.to_string());

        Ok(result)
    }

    fn mutate_input(&self, input: &str) -> Result<String> {
        // Simple mutation: replace numbers
        let mut rng = rand::thread_rng();
        let new_value = rng.gen_range(1..1000);

        if let Ok(regex) = regex::Regex::new(r"\d+") {
            Ok(regex
                .replace_all(input, new_value.to_string().as_str())
                .to_string())
        } else {
            Ok(input.to_string())
        }
    }

    fn get_generator_type(&self) -> &'static str {
        "structured"
    }
}

impl GrammarInputGenerator {
    fn new() -> Result<Self> {
        let mut grammar_rules = HashMap::new();
        grammar_rules.insert("start".to_string(), vec!["expr".to_string()]);
        grammar_rules.insert(
            "expr".to_string(),
            vec![
                "num".to_string(),
                "expr + expr".to_string(),
                "expr - expr".to_string(),
                "(expr)".to_string(),
            ],
        );
        grammar_rules.insert(
            "num".to_string(),
            vec!["1".to_string(), "2".to_string(), "3".to_string()],
        );

        Ok(Self { grammar_rules })
    }
}

impl InputGenerator for GrammarInputGenerator {
    fn generate_input(&self) -> Result<String> {
        self.expand_symbol("start", 0)
    }

    fn mutate_input(&self, _input: &str) -> Result<String> {
        // Generate new input instead of mutating
        self.generate_input()
    }

    fn get_generator_type(&self) -> &'static str {
        "grammar"
    }
}

impl GrammarInputGenerator {
    fn expand_symbol(&self, symbol: &str, depth: usize) -> Result<String> {
        if depth > 10 {
            return Ok("1".to_string()); // Prevent infinite recursion
        }

        if let Some(productions) = self.grammar_rules.get(symbol) {
            let mut rng = rand::thread_rng();
            let production = &productions[rng.gen_range(0..productions.len())];

            // Simple expansion
            if production.contains(' ') {
                let parts: Vec<&str> = production.split(' ').collect();
                let mut result = String::new();
                for part in parts {
                    if self.grammar_rules.contains_key(part) {
                        result.push_str(&self.expand_symbol(part, depth + 1)?);
                    } else {
                        result.push_str(part);
                    }
                }
                Ok(result)
            } else if self.grammar_rules.contains_key(production) {
                self.expand_symbol(production, depth + 1)
            } else {
                Ok(production.clone())
            }
        } else {
            Ok(symbol.to_string())
        }
    }
}

impl MutationInputGenerator {
    fn new() -> Result<Self> {
        let seed_inputs = vec![
            "hello world".to_string(),
            "123456".to_string(),
            "{\"test\": true}".to_string(),
            "function test() { return 42; }".to_string(),
        ];
        Ok(Self { seed_inputs })
    }
}

impl InputGenerator for MutationInputGenerator {
    fn generate_input(&self) -> Result<String> {
        let mut rng = rand::thread_rng();
        let seed = &self.seed_inputs[rng.gen_range(0..self.seed_inputs.len())];
        self.mutate_input(seed)
    }

    fn mutate_input(&self, input: &str) -> Result<String> {
        let mut rng = rand::thread_rng();
        let mut bytes = input.as_bytes().to_vec();

        if bytes.is_empty() {
            return Ok(input.to_string());
        }

        // Random mutation strategies
        match rng.gen_range(0..4) {
            0 => {
                // Bit flip
                let index = rng.gen_range(0..bytes.len());
                let bit = rng.gen_range(0..8);
                bytes[index] ^= 1 << bit;
            }
            1 => {
                // Byte replacement
                let index = rng.gen_range(0..bytes.len());
                bytes[index] = rng.gen_range(0..255);
            }
            2 => {
                // Insert byte
                let index = rng.gen_range(0..=bytes.len());
                bytes.insert(index, rng.gen_range(0..255));
            }
            3 => {
                // Delete byte
                if !bytes.is_empty() {
                    let index = rng.gen_range(0..bytes.len());
                    bytes.remove(index);
                }
            }
            _ => {}
        }

        Ok(String::from_utf8_lossy(&bytes).to_string())
    }

    fn get_generator_type(&self) -> &'static str {
        "mutation"
    }
}

impl CoverageTracker {
    fn new() -> Self {
        Self {
            coverage_map: HashMap::new(),
            total_coverage: 0.0,
        }
    }

    fn update_coverage(&mut self, execution: &ExecutionResult) -> Result<f64> {
        let path = &execution.execution_path;
        let current_count = self.coverage_map.get(path).unwrap_or(&0);

        if *current_count == 0 {
            self.coverage_map.insert(path.clone(), 1);
            self.total_coverage += 1.0;
            Ok(1.0) // New coverage
        } else {
            self.coverage_map.insert(path.clone(), current_count + 1);
            Ok(0.0) // No new coverage
        }
    }

    fn get_coverage_percentage(&self) -> f64 {
        // Simplified coverage calculation
        let total_possible_paths = 100.0; // Assume 100 possible paths
        (self.coverage_map.len() as f64 / total_possible_paths * 100.0).min(100.0)
    }

    fn get_coverage_info(&self) -> CoverageInfo {
        CoverageInfo {
            lines_covered: self.coverage_map.len() as u32,
            total_lines: 100, // Simplified
            functions_covered: (self.coverage_map.len() / 5) as u32,
            total_functions: 20, // Simplified
            branches_covered: (self.coverage_map.len() / 2) as u32,
            total_branches: 50, // Simplified
            coverage_map: self
                .coverage_map
                .iter()
                .map(|(k, v)| (k.clone(), *v))
                .collect(),
        }
    }
}

impl CrashDetector {
    fn new() -> Result<Self> {
        let crash_patterns = vec![
            CrashPattern {
                pattern: regex::Regex::new(r"segmentation fault|segfault")?,
                crash_type: CrashType::SegmentationFault,
                severity: CrashSeverity::Critical,
            },
            CrashPattern {
                pattern: regex::Regex::new(r"stack overflow")?,
                crash_type: CrashType::StackOverflow,
                severity: CrashSeverity::High,
            },
            CrashPattern {
                pattern: regex::Regex::new(r"out of memory|oom")?,
                crash_type: CrashType::OutOfMemory,
                severity: CrashSeverity::High,
            },
            CrashPattern {
                pattern: regex::Regex::new(r"assertion failed|panic")?,
                crash_type: CrashType::AssertionFailure,
                severity: CrashSeverity::Medium,
            },
        ];

        Ok(Self {
            crash_patterns,
            crash_history: VecDeque::new(),
        })
    }

    fn analyze_execution(&mut self, execution: &ExecutionResult) -> Result<Option<CrashReport>> {
        if execution.exit_code == 0 {
            return Ok(None);
        }

        // Check stderr for crash patterns
        for pattern in &self.crash_patterns {
            if pattern.pattern.is_match(&execution.stderr) {
                let crash = CrashReport {
                    id: uuid::Uuid::new_v4().to_string(),
                    crash_type: pattern.crash_type.clone(),
                    severity: pattern.severity.clone(),
                    reproducer_input: "".to_string(), // Would contain the input that caused the crash
                    stack_trace: execution.stderr.clone(),
                    error_message: execution.stderr.clone(),
                    timestamp: chrono::Utc::now(),
                    crash_location: None,
                };

                self.crash_history.push_back(crash.clone());
                if self.crash_history.len() > 1000 {
                    self.crash_history.pop_front();
                }

                return Ok(Some(crash));
            }
        }

        // Generic crash for non-zero exit codes
        Ok(Some(CrashReport {
            id: uuid::Uuid::new_v4().to_string(),
            crash_type: CrashType::Other(format!("Exit code {}", execution.exit_code)),
            severity: CrashSeverity::Medium,
            reproducer_input: "".to_string(),
            stack_trace: execution.stderr.clone(),
            error_message: format!("Process exited with code {}", execution.exit_code),
            timestamp: chrono::Utc::now(),
            crash_location: None,
        }))
    }
}

impl Default for FuzzingResult {
    fn default() -> Self {
        Self {
            total_executions: 0,
            crashes_found: 0,
            unique_crashes: 0,
            coverage_percentage: 0.0,
            execution_time: Duration::ZERO,
            crashes: Vec::new(),
            interesting_inputs: Vec::new(),
            coverage_info: CoverageInfo::default(),
            performance_anomalies: Vec::new(),
        }
    }
}
