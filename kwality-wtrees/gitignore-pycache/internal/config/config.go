package config

import (
	"fmt"
	"os"
	"strconv"
	"time"
)

// Config holds the application configuration
type Config struct {
	Environment string        `json:"environment"`
	Server      ServerConfig  `json:"server"`
	Database    DatabaseConfig `json:"database"`
	Redis       RedisConfig   `json:"redis"`
	Logging     LoggingConfig `json:"logging"`
	Orchestrator OrchestratorConfig `json:"orchestrator"`
	Validation  ValidationConfig   `json:"validation"`
	Security    SecurityConfig     `json:"security"`
}

// ServerConfig holds HTTP server configuration
type ServerConfig struct {
	Port         int           `json:"port"`
	Host         string        `json:"host"`
	ReadTimeout  time.Duration `json:"read_timeout"`
	WriteTimeout time.Duration `json:"write_timeout"`
	IdleTimeout  time.Duration `json:"idle_timeout"`
}

// DatabaseConfig holds database configuration
type DatabaseConfig struct {
	Host         string `json:"host"`
	Port         int    `json:"port"`
	Username     string `json:"username"`
	Password     string `json:"password"`
	Database     string `json:"database"`
	SSLMode      string `json:"ssl_mode"`
	MaxConns     int    `json:"max_conns"`
	MaxIdleConns int    `json:"max_idle_conns"`
	MaxLifetime  time.Duration `json:"max_lifetime"`
}

// RedisConfig holds Redis configuration
type RedisConfig struct {
	Host     string `json:"host"`
	Port     int    `json:"port"`
	Password string `json:"password"`
	Database int    `json:"database"`
	PoolSize int    `json:"pool_size"`
}

// LoggingConfig holds logging configuration
type LoggingConfig struct {
	Level  string `json:"level"`
	Format string `json:"format"`
	Output string `json:"output"`
}

// OrchestratorConfig holds orchestrator configuration
type OrchestratorConfig struct {
	MaxWorkers    int    `json:"max_workers"`
	QueueSize     int    `json:"queue_size"`
	ResultStorage string `json:"result_storage"`
	TimeoutMinutes int   `json:"timeout_minutes"`
}

// ValidationConfig holds validation engine configuration
type ValidationConfig struct {
	EnabledEngines []string          `json:"enabled_engines"`
	StaticAnalysis StaticAnalysisConfig `json:"static_analysis"`
	RuntimeValidation RuntimeValidationConfig `json:"runtime_validation"`
	SecurityScanning SecurityScanningConfig `json:"security_scanning"`
	IntegrationTesting IntegrationTestingConfig `json:"integration_testing"`
}

// StaticAnalysisConfig holds static analysis configuration
type StaticAnalysisConfig struct {
	EnabledLinters []string `json:"enabled_linters"`
	CustomRules    []string `json:"custom_rules"`
	MaxFileSize    int64    `json:"max_file_size"`
	MaxFiles       int      `json:"max_files"`
}

// RuntimeValidationConfig holds runtime validation configuration
type RuntimeValidationConfig struct {
	ContainerImage    string        `json:"container_image"`
	TimeoutSeconds    int           `json:"timeout_seconds"`
	MemoryLimitMB     int           `json:"memory_limit_mb"`
	CPULimitCores     float64       `json:"cpu_limit_cores"`
	NetworkIsolation  bool          `json:"network_isolation"`
	TempDirSize       string        `json:"temp_dir_size"`
}

// SecurityScanningConfig holds security scanning configuration
type SecurityScanningConfig struct {
	EnabledScanners   []string `json:"enabled_scanners"`
	VulnDatabases     []string `json:"vuln_databases"`
	SecretsDetection  bool     `json:"secrets_detection"`
	DependencyScanning bool    `json:"dependency_scanning"`
}

// IntegrationTestingConfig holds integration testing configuration
type IntegrationTestingConfig struct {
	EnableAPITesting bool     `json:"enable_api_testing"`
	EnableE2ETesting bool     `json:"enable_e2e_testing"`
	TestEnvironments []string `json:"test_environments"`
	MockServices     []string `json:"mock_services"`
}

// SecurityConfig holds security-related configuration
type SecurityConfig struct {
	JWTSecret       string        `json:"jwt_secret"`
	APIKeyHeader    string        `json:"api_key_header"`
	RateLimitRPS    int           `json:"rate_limit_rps"`
	CORSOrigins     []string      `json:"cors_origins"`
	SessionTimeout  time.Duration `json:"session_timeout"`
}

// Load loads configuration from environment variables
func Load() (*Config, error) {
	// Validate required environment variables
	if err := validateRequiredEnvVars(); err != nil {
		return nil, err
	}
	cfg := &Config{
		Environment: getEnvString("KWALITY_ENV", "development"),
		Server: ServerConfig{
			Port:         getEnvInt("KWALITY_PORT", 8080),
			Host:         getEnvString("KWALITY_HOST", "0.0.0.0"),
			ReadTimeout:  getEnvDuration("KWALITY_READ_TIMEOUT", "30s"),
			WriteTimeout: getEnvDuration("KWALITY_WRITE_TIMEOUT", "30s"),
			IdleTimeout:  getEnvDuration("KWALITY_IDLE_TIMEOUT", "60s"),
		},
		Database: DatabaseConfig{
			Host:         getEnvString("DB_HOST", "localhost"),
			Port:         getEnvInt("DB_PORT", 5432),
			Username:     getEnvString("DB_USERNAME", "kwality"),
			Password:     getEnvString("DB_PASSWORD", "password"),
			Database:     getEnvString("DB_DATABASE", "kwality"),
			SSLMode:      getEnvString("DB_SSL_MODE", "disable"),
			MaxConns:     getEnvInt("DB_MAX_CONNS", 25),
			MaxIdleConns: getEnvInt("DB_MAX_IDLE_CONNS", 5),
			MaxLifetime:  getEnvDuration("DB_MAX_LIFETIME", "30m"),
		},
		Redis: RedisConfig{
			Host:     getEnvString("REDIS_HOST", "localhost"),
			Port:     getEnvInt("REDIS_PORT", 6379),
			Password: getEnvString("REDIS_PASSWORD", ""),
			Database: getEnvInt("REDIS_DB", 0),
			PoolSize: getEnvInt("REDIS_POOL_SIZE", 10),
		},
		Logging: LoggingConfig{
			Level:  getEnvString("LOG_LEVEL", "info"),
			Format: getEnvString("LOG_FORMAT", "json"),
			Output: getEnvString("LOG_OUTPUT", "stdout"),
		},
		Orchestrator: OrchestratorConfig{
			MaxWorkers:     getEnvInt("ORCHESTRATOR_MAX_WORKERS", 10),
			QueueSize:      getEnvInt("ORCHESTRATOR_QUEUE_SIZE", 100),
			ResultStorage:  getEnvString("ORCHESTRATOR_RESULT_STORAGE", "redis"),
			TimeoutMinutes: getEnvInt("ORCHESTRATOR_TIMEOUT_MINUTES", 30),
		},
		Validation: ValidationConfig{
			EnabledEngines: getEnvStringSlice("VALIDATION_ENABLED_ENGINES", []string{"static", "runtime", "security"}),
			StaticAnalysis: StaticAnalysisConfig{
				EnabledLinters: getEnvStringSlice("STATIC_ANALYSIS_LINTERS", []string{"golangci-lint", "eslint", "pylint"}),
				CustomRules:    getEnvStringSlice("STATIC_ANALYSIS_CUSTOM_RULES", []string{}),
				MaxFileSize:    getEnvInt64("STATIC_ANALYSIS_MAX_FILE_SIZE", 10*1024*1024), // 10MB
				MaxFiles:       getEnvInt("STATIC_ANALYSIS_MAX_FILES", 1000),
			},
			RuntimeValidation: RuntimeValidationConfig{
				ContainerImage:   getEnvString("RUNTIME_CONTAINER_IMAGE", "kwality/runner:latest"),
				TimeoutSeconds:   getEnvInt("RUNTIME_TIMEOUT_SECONDS", 300), // 5 minutes
				MemoryLimitMB:    getEnvInt("RUNTIME_MEMORY_LIMIT_MB", 512),
				CPULimitCores:    getEnvFloat64("RUNTIME_CPU_LIMIT_CORES", 1.0),
				NetworkIsolation: getEnvBool("RUNTIME_NETWORK_ISOLATION", true),
				TempDirSize:      getEnvString("RUNTIME_TEMP_DIR_SIZE", "100m"),
			},
			SecurityScanning: SecurityScanningConfig{
				EnabledScanners:    getEnvStringSlice("SECURITY_ENABLED_SCANNERS", []string{"semgrep", "gosec", "bandit"}),
				VulnDatabases:      getEnvStringSlice("SECURITY_VULN_DATABASES", []string{"nvd", "ghsa"}),
				SecretsDetection:   getEnvBool("SECURITY_SECRETS_DETECTION", true),
				DependencyScanning: getEnvBool("SECURITY_DEPENDENCY_SCANNING", true),
			},
			IntegrationTesting: IntegrationTestingConfig{
				EnableAPITesting: getEnvBool("INTEGRATION_ENABLE_API_TESTING", true),
				EnableE2ETesting: getEnvBool("INTEGRATION_ENABLE_E2E_TESTING", false),
				TestEnvironments: getEnvStringSlice("INTEGRATION_TEST_ENVIRONMENTS", []string{"docker"}),
				MockServices:     getEnvStringSlice("INTEGRATION_MOCK_SERVICES", []string{}),
			},
		},
		Security: SecurityConfig{
			JWTSecret:      getEnvString("JWT_SECRET", "your-secret-key"),
			APIKeyHeader:   getEnvString("API_KEY_HEADER", "X-API-Key"),
			RateLimitRPS:   getEnvInt("RATE_LIMIT_RPS", 100),
			CORSOrigins:    getEnvStringSlice("CORS_ORIGINS", []string{"*"}),
			SessionTimeout: getEnvDuration("SESSION_TIMEOUT", "24h"),
		},
	}

	return cfg, nil
}

// validateRequiredEnvVars ensures critical security environment variables are set
func validateRequiredEnvVars() error {
	requiredVars := []string{
		"JWT_SECRET",
		"DB_PASSWORD",
	}
	
	for _, envVar := range requiredVars {
		if os.Getenv(envVar) == "" {
			return fmt.Errorf("required environment variable %s is not set", envVar)
		}
	}
	return nil
}

// Helper functions for environment variable parsing
func getEnvString(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvInt64(key string, defaultValue int64) int64 {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.ParseInt(value, 10, 64); err == nil {
			return intValue
		}
	}
	return defaultValue
}

func getEnvFloat64(key string, defaultValue float64) float64 {
	if value := os.Getenv(key); value != "" {
		if floatValue, err := strconv.ParseFloat(value, 64); err == nil {
			return floatValue
		}
	}
	return defaultValue
}

func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
	}
	return defaultValue
}

func getEnvDuration(key string, defaultValue string) time.Duration {
	if value := os.Getenv(key); value != "" {
		if duration, err := time.ParseDuration(value); err == nil {
			return duration
		}
	}
	duration, _ := time.ParseDuration(defaultValue)
	return duration
}

func getEnvStringSlice(key string, defaultValue []string) []string {
	// For simplicity, this assumes comma-separated values
	// In production, you might want to use JSON or another format
	if value := os.Getenv(key); value != "" {
		// Simple comma-separated parsing
		// You could enhance this to support JSON arrays
		return []string{value} // Simplified for now
	}
	return defaultValue
}