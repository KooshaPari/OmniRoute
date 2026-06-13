package models

import (
	"time"
)

// ValidationRequest represents a request to validate a codebase
type ValidationRequest struct {
	Name   string             `json:"name"`
	Source CodebaseSource     `json:"source"`
	Config ValidationConfig   `json:"config"`
}

// ValidationResponse represents the response after submitting a validation request
type ValidationResponse struct {
	TaskID      string    `json:"task_id"`
	Status      string    `json:"status"`
	SubmittedAt time.Time `json:"submitted_at"`
}

// ValidationResult represents the complete validation result
type ValidationResult struct {
	TaskID        string                    `json:"task_id"`
	Status        string                    `json:"status"`
	OverallScore  float64                   `json:"overall_score"`
	QualityGate   bool                      `json:"quality_gate"`
	StartedAt     time.Time                 `json:"started_at"`
	CompletedAt   *time.Time                `json:"completed_at,omitempty"`
	Duration      time.Duration             `json:"duration"`
	EngineResults map[string]*EngineResult  `json:"engine_results"`
	Findings      []Finding                 `json:"findings"`
	Summary       *ValidationSummary        `json:"summary"`
	Errors        []ValidationError         `json:"errors,omitempty"`
	Metadata      map[string]interface{}    `json:"metadata,omitempty"`
}

// ValidationConfig represents validation configuration
type ValidationConfig struct {
	EnabledEngines []string      `json:"enabled_engines"`
	Timeout        string        `json:"timeout"`
	Parallel       bool          `json:"parallel,omitempty"`
}

// EngineResult represents the result from a validation engine
type EngineResult struct {
	EngineName string                 `json:"engine_name"`
	Status     string                 `json:"status"`
	Score      float64                `json:"score"`
	Duration   time.Duration          `json:"duration"`
	Findings   []Finding              `json:"findings"`
	Metrics    map[string]interface{} `json:"metrics"`
	Error      string                 `json:"error,omitempty"`
}

// Finding represents a validation finding
type Finding struct {
	ID          string                 `json:"id"`
	Type        string                 `json:"type"`
	Severity    string                 `json:"severity"`
	Title       string                 `json:"title"`
	Description string                 `json:"description"`
	File        string                 `json:"file,omitempty"`
	Line        int                    `json:"line,omitempty"`
	Column      int                    `json:"column,omitempty"`
	Rule        string                 `json:"rule,omitempty"`
	Category    string                 `json:"category,omitempty"`
	Confidence  float64                `json:"confidence"`
	Impact      string                 `json:"impact,omitempty"`
	Fix         *FixSuggestion         `json:"fix,omitempty"`
	References  []string               `json:"references,omitempty"`
	Metadata    map[string]interface{} `json:"metadata,omitempty"`
}

// FixSuggestion represents a suggested fix for a finding
type FixSuggestion struct {
	Description string `json:"description"`
	Before      string `json:"before,omitempty"`
	After       string `json:"after,omitempty"`
	Automatic   bool   `json:"automatic"`
}

// ValidationSummary provides high-level validation summary
type ValidationSummary struct {
	TotalFiles         int                    `json:"total_files"`
	LinesOfCode        int                    `json:"lines_of_code"`
	Languages          []string               `json:"languages"`
	QualityMetrics     QualityMetrics         `json:"quality_metrics"`
	SecurityMetrics    SecurityMetrics        `json:"security_metrics"`
	PerformanceMetrics PerformanceMetrics     `json:"performance_metrics"`
	Recommendations    []Recommendation       `json:"recommendations"`
}

// QualityMetrics holds code quality metrics
type QualityMetrics struct {
	Correctness     float64 `json:"correctness"`
	Maintainability float64 `json:"maintainability"`
	Complexity      float64 `json:"complexity"`
	Documentation   float64 `json:"documentation"`
	TestCoverage    float64 `json:"test_coverage"`
}

// SecurityMetrics holds security metrics
type SecurityMetrics struct {
	VulnerabilityCount int     `json:"vulnerability_count"`
	SecurityScore      float64 `json:"security_score"`
	CriticalIssues     int     `json:"critical_issues"`
	HighIssues         int     `json:"high_issues"`
	MediumIssues       int     `json:"medium_issues"`
	LowIssues          int     `json:"low_issues"`
}

// PerformanceMetrics holds performance metrics
type PerformanceMetrics struct {
	PerformanceScore   float64            `json:"performance_score"`
	BenchmarkResults   map[string]float64 `json:"benchmark_results"`
	MemoryUsage        int64              `json:"memory_usage"`
	CPUUsage           float64            `json:"cpu_usage"`
	ExecutionTime      time.Duration      `json:"execution_time"`
}

// Recommendation represents a validation recommendation
type Recommendation struct {
	ID          string `json:"id"`
	Type        string `json:"type"`
	Priority    string `json:"priority"`
	Title       string `json:"title"`
	Description string `json:"description"`
	Action      string `json:"action"`
	File        string `json:"file,omitempty"`
}

// ValidationError represents an error during validation
type ValidationError struct {
	Code        string `json:"code"`
	Message     string `json:"message"`
	Details     string `json:"details,omitempty"`
	Engine      string `json:"engine,omitempty"`
	Recoverable bool   `json:"recoverable"`
}