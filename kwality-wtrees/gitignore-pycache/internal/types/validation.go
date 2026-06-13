package types

import (
	"time"
)

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
	Evidence    map[string]interface{} `json:"evidence,omitempty"`
}

// ValidationConfig represents configuration for validation
type ValidationConfig struct {
	EnabledEngines   []string           `json:"enabled_engines"`
	Timeout          string             `json:"timeout"`
	Parallel         bool               `json:"parallel"`
	SecurityConfig   *SecurityConfig    `json:"security,omitempty"`
	PerformanceConfig *PerformanceConfig `json:"performance,omitempty"`
	ReportingConfig  *ReportingConfig   `json:"reporting,omitempty"`
}

// SecurityConfig represents security validation configuration
type SecurityConfig struct {
	Scanners            []string          `json:"scanners"`
	MinSeverity         string            `json:"min_severity"`
	SecretsDetection    bool              `json:"secrets_detection"`
	ComplianceFrameworks []string         `json:"compliance_frameworks,omitempty"`
	FailOnCritical      bool              `json:"fail_on_critical"`
	CustomRules         map[string]string `json:"custom_rules,omitempty"`
}

// PerformanceConfig represents performance validation configuration
type PerformanceConfig struct {
	Benchmarks   map[string]bool       `json:"benchmarks"`
	Thresholds   map[string]string     `json:"thresholds"`
	LoadTesting  *LoadTestingConfig    `json:"load_testing,omitempty"`
}

// LoadTestingConfig represents load testing configuration
type LoadTestingConfig struct {
	Enabled         bool   `json:"enabled"`
	ConcurrentUsers int    `json:"concurrent_users"`
	Duration        string `json:"duration"`
	RampUpTime      string `json:"ramp_up_time"`
}

// ReportingConfig represents reporting configuration
type ReportingConfig struct {
	Formats           []string `json:"formats"`
	DetailedFindings  bool     `json:"detailed_findings"`
	IncludeRemediation bool    `json:"include_remediation"`
	ExecutiveSummary  bool     `json:"executive_summary"`
}