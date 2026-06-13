package integration

import (
	"context"
	"encoding/json"
	"os"
	"os/exec"
	"path/filepath"
	"testing"
	"time"

	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"github.com/stretchr/testify/suite"
)

// RuntimeValidatorTestSuite tests the Rust runtime validator integration
type RuntimeValidatorTestSuite struct {
	suite.Suite
	validatorBinary string
	tempDir         string
}

// SetupSuite prepares the test environment
func (suite *RuntimeValidatorTestSuite) SetupSuite() {
	// Build the Rust runtime validator for testing
	validatorDir := filepath.Join("..", "..", "engines", "runtime-validator")
	
	cmd := exec.Command("cargo", "build", "--release")
	cmd.Dir = validatorDir
	err := cmd.Run()
	require.NoError(suite.T(), err, "Failed to build runtime validator")

	suite.validatorBinary = filepath.Join(validatorDir, "target", "release", "runtime-validator")
	
	// Create temporary directory for test files
	tempDir, err := os.MkdirTemp("", "kwality-runtime-test-*")
	require.NoError(suite.T(), err)
	suite.tempDir = tempDir
}

// TearDownSuite cleans up the test environment
func (suite *RuntimeValidatorTestSuite) TearDownSuite() {
	if suite.tempDir != "" {
		if err := os.RemoveAll(suite.tempDir); err != nil {
			suite.T().Logf("Warning: failed to clean up temp directory: %v", err)
		}
	}
}

// RuntimeValidationRequest represents a validation request to the runtime validator
type RuntimeValidationRequest struct {
	CodebaseID string                 `json:"codebase_id"`
	Files      []RuntimeValidationFile `json:"files"`
	Config     RuntimeValidationConfig `json:"config"`
}

// RuntimeValidationFile represents a file in the validation request
type RuntimeValidationFile struct {
	Path     string `json:"path"`
	Content  string `json:"content"`
	Language string `json:"language,omitempty"`
}

// RuntimeValidationConfig represents validation configuration
type RuntimeValidationConfig struct {
	ContainerConfig    ContainerConfig    `json:"container"`
	PerformanceConfig  PerformanceConfig  `json:"performance"`
	SecurityConfig     SecurityConfig     `json:"security"`
	FuzzingConfig      FuzzingConfig      `json:"fuzzing"`
	ValidationConfig   ValidationConfig   `json:"validation"`
}

// ContainerConfig for container execution
type ContainerConfig struct {
	Image              string            `json:"image"`
	MemoryLimitMB      uint64            `json:"memory_limit_mb"`
	CPULimitCores      float64           `json:"cpu_limit_cores"`
	TimeoutSeconds     uint64            `json:"timeout_seconds"`
	NetworkIsolation   bool              `json:"network_isolation"`
	ReadonlyFilesystem bool              `json:"readonly_filesystem"`
	TempDirSizeMB      uint64            `json:"temp_dir_size_mb"`
	Environment        map[string]string `json:"environment"`
	SecurityOpts       []string          `json:"security_opts"`
}

// PerformanceConfig for performance analysis
type PerformanceConfig struct {
	EnableCPUProfiling    bool                   `json:"enable_cpu_profiling"`
	EnableMemoryProfiling bool                   `json:"enable_memory_profiling"`
	EnableIOProfiling     bool                   `json:"enable_io_profiling"`
	BenchmarkIterations   uint32                 `json:"benchmark_iterations"`
	Thresholds           PerformanceThresholds  `json:"thresholds"`
}

// PerformanceThresholds for validation limits
type PerformanceThresholds struct {
	MaxExecutionTimeMS     uint64  `json:"max_execution_time_ms"`
	MaxMemoryUsageMB       uint64  `json:"max_memory_usage_mb"`
	MaxCPUUsagePercent     float64 `json:"max_cpu_usage_percent"`
	MaxIOOpsPerSecond      uint64  `json:"max_io_ops_per_second"`
}

// SecurityConfig for security monitoring
type SecurityConfig struct {
	EnableSyscallMonitoring bool     `json:"enable_syscall_monitoring"`
	EnableNetworkMonitoring bool     `json:"enable_network_monitoring"`
	EnableFileMonitoring    bool     `json:"enable_file_monitoring"`
	BlockedSyscalls        []string `json:"blocked_syscalls"`
	AllowedNetworks        []string `json:"allowed_networks"`
	SensitiveFiles         []string `json:"sensitive_files"`
}

// FuzzingConfig for fuzzing tests
type FuzzingConfig struct {
	Enabled         bool   `json:"enabled"`
	DurationSeconds uint64 `json:"duration_seconds"`
	Iterations      uint32 `json:"iterations"`
	Strategy        string `json:"strategy"`
	CoverageGuided  bool   `json:"coverage_guided"`
}

// ValidationConfig for general validation settings
type ValidationConfig struct {
	MaxValidationTime       string `json:"max_validation_time"`
	ParallelExecution       bool   `json:"parallel_execution"`
	CleanupAfterValidation  bool   `json:"cleanup_after_validation"`
	DetailedLogging         bool   `json:"detailed_logging"`
}

// RuntimeValidationResult represents the validation response
type RuntimeValidationResult struct {
	ValidationID       string                      `json:"validation_id"`
	CodebaseID         string                      `json:"codebase_id"`
	Status             string                      `json:"status"`
	StartedAt          time.Time                   `json:"started_at"`
	CompletedAt        *time.Time                  `json:"completed_at"`
	Duration           *string                     `json:"duration"`
	OverallScore       float64                     `json:"overall_score"`
	SecurityResult     map[string]interface{}      `json:"security_result"`
	PerformanceMetrics map[string]interface{}      `json:"performance_metrics"`
	FuzzingResult      *map[string]interface{}     `json:"fuzzing_result"`
	Findings           []map[string]interface{}    `json:"findings"`
	Recommendations    []map[string]interface{}    `json:"recommendations"`
	Metadata           map[string]interface{}      `json:"metadata"`
}

// TestGoCodeValidation tests validation of Go code
func (suite *RuntimeValidatorTestSuite) TestGoCodeValidation() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-go-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "main.go",
				Content:  suite.getValidGoCode(),
				Language: "go",
			},
			{
				Path:    "go.mod",
				Content: suite.getGoMod(),
			},
		},
		Config: suite.getDefaultConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.True(suite.T(), result.OverallScore > 50.0, "Expected decent score for valid Go code")
	assert.NotNil(suite.T(), result.PerformanceMetrics)
	assert.NotNil(suite.T(), result.SecurityResult)
}

// TestRustCodeValidation tests validation of Rust code
func (suite *RuntimeValidatorTestSuite) TestRustCodeValidation() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-rust-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "src/main.rs",
				Content:  suite.getValidRustCode(),
				Language: "rust",
			},
			{
				Path:    "Cargo.toml",
				Content: suite.getRustCargoToml(),
			},
		},
		Config: suite.getDefaultConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.True(suite.T(), result.OverallScore > 50.0, "Expected decent score for valid Rust code")
}

// TestPythonCodeValidation tests validation of Python code
func (suite *RuntimeValidatorTestSuite) TestPythonCodeValidation() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-python-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "main.py",
				Content:  suite.getValidPythonCode(),
				Language: "python",
			},
		},
		Config: suite.getDefaultConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.True(suite.T(), result.OverallScore > 50.0, "Expected decent score for valid Python code")
}

// TestJavaScriptCodeValidation tests validation of JavaScript code
func (suite *RuntimeValidatorTestSuite) TestJavaScriptCodeValidation() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-javascript-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "index.js",
				Content:  suite.getValidJavaScriptCode(),
				Language: "javascript",
			},
			{
				Path:    "package.json",
				Content: suite.getPackageJson(),
			},
		},
		Config: suite.getDefaultConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.True(suite.T(), result.OverallScore > 50.0, "Expected decent score for valid JavaScript code")
}

// TestMaliciousCodeDetection tests detection of malicious code patterns
func (suite *RuntimeValidatorTestSuite) TestMaliciousCodeDetection() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-malicious-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "malicious.py",
				Content:  suite.getMaliciousPythonCode(),
				Language: "python",
			},
		},
		Config: suite.getStrictSecurityConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.True(suite.T(), result.OverallScore < 30.0, "Expected low score for malicious code")
	assert.True(suite.T(), len(result.Findings) > 0, "Expected security findings")
	
	// Check for security violations
	securityResult := result.SecurityResult
	assert.NotNil(suite.T(), securityResult)
}

// TestPerformanceIntensiveCode tests validation of performance-intensive code
func (suite *RuntimeValidatorTestSuite) TestPerformanceIntensiveCode() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-performance-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "intensive.go",
				Content:  suite.getPerformanceIntensiveGoCode(),
				Language: "go",
			},
		},
		Config: suite.getPerformanceConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.NotNil(suite.T(), result.PerformanceMetrics)
	
	// Should detect performance issues
	assert.True(suite.T(), len(result.Findings) > 0, "Expected performance findings")
}

// TestFuzzingValidation tests fuzzing capabilities
func (suite *RuntimeValidatorTestSuite) TestFuzzingValidation() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-fuzzing-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "fuzz_target.go",
				Content:  suite.getFuzzTargetGoCode(),
				Language: "go",
			},
		},
		Config: suite.getFuzzingConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Equal(suite.T(), "completed", result.Status)
	assert.NotNil(suite.T(), result.FuzzingResult)
}

// TestValidationTimeout tests timeout handling
func (suite *RuntimeValidatorTestSuite) TestValidationTimeout() {
	request := RuntimeValidationRequest{
		CodebaseID: "test-timeout-code",
		Files: []RuntimeValidationFile{
			{
				Path:     "infinite.go",
				Content:  suite.getInfiniteLoopGoCode(),
				Language: "go",
			},
		},
		Config: suite.getTimeoutConfig(),
	}

	result := suite.runValidation(request)
	
	assert.Contains(suite.T(), []string{"timeout", "failed"}, result.Status)
}

// Helper methods

func (suite *RuntimeValidatorTestSuite) runValidation(request RuntimeValidationRequest) RuntimeValidationResult {
	// Create request file
	requestFile := filepath.Join(suite.tempDir, "request.json")
	requestData, err := json.MarshalIndent(request, "", "  ")
	require.NoError(suite.T(), err)
	
	err = os.WriteFile(requestFile, requestData, 0644)
	require.NoError(suite.T(), err)

	// Create output file
	outputFile := filepath.Join(suite.tempDir, "result.json")

	// Run the runtime validator
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Minute)
	defer cancel()

	cmd := exec.CommandContext(ctx, suite.validatorBinary, "--input", requestFile, "--output", outputFile)
	cmd.Env = append(os.Environ(), "RUST_LOG=debug")
	
	output, err := cmd.CombinedOutput()
	if err != nil {
		suite.T().Logf("Runtime validator output: %s", string(output))
		require.NoError(suite.T(), err, "Runtime validator execution failed")
	}

	// Read the result
	resultData, err := os.ReadFile(outputFile)
	require.NoError(suite.T(), err)

	var result RuntimeValidationResult
	err = json.Unmarshal(resultData, &result)
	require.NoError(suite.T(), err)

	return result
}

func (suite *RuntimeValidatorTestSuite) getDefaultConfig() RuntimeValidationConfig {
	return RuntimeValidationConfig{
		ContainerConfig: ContainerConfig{
			Image:              "kwality/runner:latest",
			MemoryLimitMB:      256,
			CPULimitCores:      1.0,
			TimeoutSeconds:     120,
			NetworkIsolation:   true,
			ReadonlyFilesystem: false,
			TempDirSizeMB:      50,
			Environment:        map[string]string{},
			SecurityOpts:       []string{"no-new-privileges"},
		},
		PerformanceConfig: PerformanceConfig{
			EnableCPUProfiling:    true,
			EnableMemoryProfiling: true,
			EnableIOProfiling:     true,
			BenchmarkIterations:   3,
			Thresholds: PerformanceThresholds{
				MaxExecutionTimeMS:  30000,
				MaxMemoryUsageMB:    128,
				MaxCPUUsagePercent:  90.0,
				MaxIOOpsPerSecond:   1000,
			},
		},
		SecurityConfig: SecurityConfig{
			EnableSyscallMonitoring: true,
			EnableNetworkMonitoring: true,
			EnableFileMonitoring:    true,
			BlockedSyscalls:        []string{"ptrace", "mount"},
			AllowedNetworks:        []string{"127.0.0.1"},
			SensitiveFiles:         []string{"/etc/passwd"},
		},
		FuzzingConfig: FuzzingConfig{
			Enabled:         false,
			DurationSeconds: 30,
			Iterations:      100,
			Strategy:        "random",
			CoverageGuided:  false,
		},
		ValidationConfig: ValidationConfig{
			MaxValidationTime:      "5m",
			ParallelExecution:      false,
			CleanupAfterValidation: true,
			DetailedLogging:        true,
		},
	}
}

func (suite *RuntimeValidatorTestSuite) getStrictSecurityConfig() RuntimeValidationConfig {
	config := suite.getDefaultConfig()
	config.SecurityConfig.BlockedSyscalls = append(config.SecurityConfig.BlockedSyscalls, 
		"socket", "connect", "bind", "listen", "execve")
	return config
}

func (suite *RuntimeValidatorTestSuite) getPerformanceConfig() RuntimeValidationConfig {
	config := suite.getDefaultConfig()
	config.PerformanceConfig.Thresholds.MaxCPUUsagePercent = 50.0
	config.PerformanceConfig.Thresholds.MaxMemoryUsageMB = 64
	return config
}

func (suite *RuntimeValidatorTestSuite) getFuzzingConfig() RuntimeValidationConfig {
	config := suite.getDefaultConfig()
	config.FuzzingConfig.Enabled = true
	config.FuzzingConfig.DurationSeconds = 15
	config.FuzzingConfig.Iterations = 50
	return config
}

func (suite *RuntimeValidatorTestSuite) getTimeoutConfig() RuntimeValidationConfig {
	config := suite.getDefaultConfig()
	config.ContainerConfig.TimeoutSeconds = 5
	return config
}

// Test code samples

func (suite *RuntimeValidatorTestSuite) getValidGoCode() string {
	return `package main

import (
	"fmt"
	"net/http"
)

func main() {
	http.HandleFunc("/", handler)
	fmt.Println("Server starting on :8080")
	http.ListenAndServe(":8080", nil)
}

func handler(w http.ResponseWriter, r *http.Request) {
	fmt.Fprintf(w, "Hello, World!")
}`
}

func (suite *RuntimeValidatorTestSuite) getGoMod() string {
	return `module test-app

go 1.21`
}

func (suite *RuntimeValidatorTestSuite) getValidRustCode() string {
	return `fn main() {
	println!("Hello, World!");
	let numbers = vec![1, 2, 3, 4, 5];
	let sum: i32 = numbers.iter().sum();
	println!("Sum: {}", sum);
}`
}

func (suite *RuntimeValidatorTestSuite) getRustCargoToml() string {
	return `[package]
name = "test-app"
version = "0.1.0"
edition = "2021"`
}

func (suite *RuntimeValidatorTestSuite) getValidPythonCode() string {
	return `#!/usr/bin/env python3

def fibonacci(n):
	if n <= 1:
		return n
	return fibonacci(n-1) + fibonacci(n-2)

def main():
	print("Hello, World!")
	for i in range(10):
		print(f"fib({i}) = {fibonacci(i)}")

if __name__ == "__main__":
	main()`
}

func (suite *RuntimeValidatorTestSuite) getValidJavaScriptCode() string {
	return `const express = require('express');
const app = express();
const port = 3000;

app.get('/', (req, res) => {
	res.send('Hello, World!');
});

app.listen(port, () => {
	console.log('Server running on port ' + port);
});`
}

func (suite *RuntimeValidatorTestSuite) getPackageJson() string {
	return `{
	"name": "test-app",
	"version": "1.0.0",
	"main": "index.js",
	"dependencies": {
		"express": "^4.18.0"
	}
}`
}

func (suite *RuntimeValidatorTestSuite) getMaliciousPythonCode() string {
	return `import os
import subprocess
import socket

# Attempt to read sensitive files
try:
	with open('/etc/passwd', 'r') as f:
		passwd_data = f.read()
	print("Sensitive data accessed!")
except:
	pass

# Attempt network connection
try:
	s = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
	s.connect(('example.com', 80))
	s.close()
	print("Network access successful!")
except:
	pass

# Attempt command execution
try:
	result = subprocess.run(['whoami'], capture_output=True, text=True)
	print(f"Command result: {result.stdout}")
except:
	pass`
}

func (suite *RuntimeValidatorTestSuite) getPerformanceIntensiveGoCode() string {
	return `package main

import (
	"fmt"
	"runtime"
	"time"
)

func main() {
	// CPU intensive operation
	start := time.Now()
	
	// Allocate large amounts of memory
	data := make([][]byte, 1000)
	for i := range data {
		data[i] = make([]byte, 1024*1024) // 1MB each
	}
	
	// CPU intensive calculation
	result := 0
	for i := 0; i < 10000000; i++ {
		result += i * i
	}
	
	fmt.Printf("Result: %d\n", result)
	fmt.Printf("Time taken: %v\n", time.Since(start))
	
	var m runtime.MemStats
	runtime.ReadMemStats(&m)
	fmt.Printf("Memory usage: %d MB\n", m.Alloc/1024/1024)
}`
}

func (suite *RuntimeValidatorTestSuite) getFuzzTargetGoCode() string {
	return `package main

import (
	"fmt"
	"strconv"
)

func parseAndDouble(input string) (int, error) {
	num, err := strconv.Atoi(input)
	if err != nil {
		return 0, err
	}
	return num * 2, nil
}

func main() {
	test_inputs := []string{"123", "abc", "0", "-456"}
	
	for _, input := range test_inputs {
		result, err := parseAndDouble(input)
		if err != nil {
			fmt.Printf("Error processing %s: %v\n", input, err)
		} else {
			fmt.Printf("Input: %s, Result: %d\n", input, result)
		}
	}
}`
}

func (suite *RuntimeValidatorTestSuite) getInfiniteLoopGoCode() string {
	return `package main

import "time"

func main() {
	for {
		time.Sleep(100 * time.Millisecond)
		// Infinite loop to test timeout
	}
}`
}

// TestRuntimeValidatorTestSuite runs the integration test suite
func TestRuntimeValidatorTestSuite(t *testing.T) {
	suite.Run(t, new(RuntimeValidatorTestSuite))
}