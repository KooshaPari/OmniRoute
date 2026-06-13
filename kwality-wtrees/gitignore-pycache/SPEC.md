# SPEC.md - Kwality (AI Codebase Validation Platform)

## Mission

To provide definitive validation of AI-generated code through comprehensive static analysis, secure runtime testing, and multi-dimensional security scanning - ensuring production-grade code quality before deployment.

## Tenets (unless you know better ones)

1. **Security First**: AI-generated code is assumed vulnerable until proven otherwise. Every line must be validated.

2. **Minimal Trust**: No LLM output is trusted. Verification is mandatory, not optional.

3. **Performance Obsession**: Validation must be fast. Thoroughness and speed are not trade-offs.

4. **Observable Everything**: Deep telemetry is not optional. If you cannot observe it, you cannot validate it.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    Kwality Validation Platform                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    API / CLI Layer                           ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       ││
│  │  │   CLI Tool   │  │   REST API   │  │   Webhooks   │       ││
│  │  │   (Cobra)    │  │   (Gin)      │  │   (Events)   │       ││
│  │  │              │  │              │  │              │       ││
│  │  │ • validate   │  │ • POST /api/ │  │ • GitHub     │       ││
│  │  │ • server     │  │   validate   │  │ • GitLab     │       ││
│  │  │ • health     │  │ • GET /health│  │ • Slack      │       ││
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬───────┘       ││
│  │         └─────────────────┴─────────────────┘                ││
│  │                           │                                  ││
│  └───────────────────────────┼───────────────────────────────────┘│
│                             │                                  │
│  ┌──────────────────────────┴───────────────────────────────────┐│
│  │              Orchestration Layer (Go)                        ││
│  │                                                              ││
│  │  ┌─────────────────────────────────────────────────────┐    ││
│  │  │            Validation Coordinator                   │    ││
│  │  │  • Request validation                             │    ││
│  │  │  • Engine selection                               │    ││
│  │  │  • Parallel execution                             │    ││
│  │  │  • Result aggregation                             │    ││
│  │  └──────────────────────┬────────────────────────────┘    ││
│  │                         │                                    ││
│  │  ┌──────────────────────┴────────────────────────────┐      ││
│  │  │              Task Queue Manager                   │      ││
│  │  │  • Redis/RabbitMQ task distribution             │      ││
│  │  │  • Worker scaling                                │      ││
│  │  │  • Retry logic                                   │      ││
│  │  │  • Priority queues                               │      ││
│  │  └─────────────────────────────────────────────────┘      ││
│  │                                                              ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Validation Engines                                ││
│  │                                                                ││
│  │  ┌──────────────────┐  ┌──────────────────┐                    ││
│  │  │  Static Analysis │  │ Runtime Validator│                    ││
│  │  │     (Go)         │  │    (Rust)        │                    ││
│  │  │                  │  │                  │                    ││
│  │  │ • AST Parsing    │  │ • Container Exec │                    ││
│  │  │ • Multi-lang     │  │ • Performance    │                    ││
│  │  │   Linters        │  │ • Memory Analysis│                    ││
│  │  │ • Code Quality   │  │ • Fuzzing Engine │                    ││
│  │  │ • Dependencies   │  │                  │                    ││
│  │  └────────┬─────────┘  └────────┬─────────┘                    ││
│  │           │                     │                                ││
│  │  ┌────────┴─────────┐  ┌────────┴─────────┐                  ││
│  │  │ Security Scanner │  │ Integration Test │                  ││
│  │  │     (Go)         │  │     (Go)         │                  ││
│  │  │                  │  │                  │                  ││
│  │  │ • SAST Analysis  │  │ • API Validation │                  ││
│  │  │ • Vulnerability  │  │ • E2E Testing    │                  ││
│  │  │   Detection      │  │ • Contract Tests │                  ││
│  │  │ • Secrets Scan   │  │                  │                  ││
│  │  └────────┬─────────┘  └────────┬─────────┘                  ││
│  │           └─────────────────────┘                              ││
│  │                     │                                          ││
│  │  ┌──────────────────┴──────────────────┐                      ││
│  │  │      Engine Interface (Standard)    │                      ││
│  │  │  • Validate(input) → Result         │                      ││
│  │  │  • GetScore() → float64           │                      ││
│  │  │  • GetFindings() → []Finding       │                      ││
│  │  └───────────────────────────────────┘                      ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Isolation & Safety Layer                          ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        ││
│  │  │   Docker     │  │   Resource   │  │   Security   │        ││
│  │  │   Containers │  │   Limits     │  │   Monitor    │        ││
│  │  │              │  │              │  │              │        ││
│  │  │ • Sandbox    │  │ • CPU quotas │  │ • Syscall    │        ││
│  │  │ • Network    │  │ • Memory cap │  │   audit      │        ││
│  │  │   isolation  │  │ • Disk limit │  │ • Behavior   │        ││
│  │  │ • Ephemeral  │  │ • Timeout    │  │   analysis   │        ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘        ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
│  ┌──────────────────────────────────────────────────────────────┐│
│  │              Data Layer                                        ││
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        ││
│  │  │  PostgreSQL    │  │    Redis     │  │    S3/MinIO  │        ││
│  │  │  (State)       │  │   (Cache)    │  │  (Artifacts) │        ││
│  │  │                │  │              │  │              │        ││
│  │  │ • Validation   │  │ • Queue      │  │ • Reports    │        ││
│  │  │   results      │  │ • Session    │  │ • Logs       │        ││
│  │  │ • Audit log    │  │ • Rate limit │  │ • Screenshots│        ││
│  │  └──────────────┘  └──────────────┘  └──────────────┘        ││
│  └──────────────────────────────────────────────────────────────┘│
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Breakdown

### 1. CLI (`cmd/kwality-cli/main.go`)

The CLI provides the primary interface for developers to validate codebases locally and interact with the Kwality platform.

**Commands**:

```bash
# Core validation commands
kwality validate <path>          # Validate codebase at path
kwality validate --git <url>     # Validate from Git repository
kwality validate --engines static,security  # Selective engine execution
kwality validate --config .kwality.yaml  # Custom configuration

# Server commands
kwality server                   # Start validation server
kwality server --port 8080      # Custom port
kwality server --host 0.0.0.0   # Bind to all interfaces

# Health and status
kwality health                   # System health check
kwality health --detailed       # Detailed diagnostics
kwality status                   # Show system status
kwality metrics                  # Performance metrics

# Security commands
kwality security-scan <path>    # Security-focused validation
kwality compliance-check        # Compliance validation
kwality secrets-scan <path>     # Secrets detection only
kwality vuln-scan <path>        # Vulnerability scan only

# Management commands
kwality config                   # Show configuration
kwality config init             # Initialize config file
kwality logs                    # View application logs
kwality version                 # Show version information
```

**Cobra Framework**:
- Command framework with automatic help generation
- Flag parsing with validation
- Subcommand structure
- Shell completion support (bash, zsh, fish)

**Output Formats**:
```bash
kwality validate ./project --output json      # JSON output
kwality validate ./project --output table     # Human-readable table
kwality validate ./project --output sarif     # SARIF format for CI integration
kwality validate ./project --silent           # Exit code only
```

**Exit Codes**:
- 0: Validation passed, no issues found
- 1: Validation failed (quality gate not met)
- 2: System error
- 3: Invalid arguments

### 2. REST API (`internal/server/gin_server.go`)

**Gin Framework** with middleware stack:
- Request ID injection
- Structured logging (zap)
- Rate limiting (per IP and API key)
- CORS configuration
- Authentication (JWT or API key)
- Request/Response validation

**Endpoints**:

```go
// Validation endpoints
POST /api/v1/validate/codebase    // Submit codebase for validation
GET  /api/v1/validate/:id           // Get validation results
GET  /api/v1/validate/:id/status    // Get validation status
DELETE /api/v1/validate/:id         // Cancel validation

// Task management
GET  /api/v1/tasks                  // List validation tasks
GET  /api/v1/tasks/:id              // Get specific task

// Engine management
GET  /api/v1/engines                // List available engines
GET  /api/v1/engines/:name          // Get engine details
POST /api/v1/engines/:name/health   // Check engine health

// Health and monitoring
GET  /health                        // Health check
GET  /health/detailed               // Detailed health
GET  /metrics                       // Prometheus metrics
GET  /ready                         // Readiness probe

// Webhook endpoints
POST /webhooks/github               // GitHub webhook
POST /webhooks/gitlab               // GitLab webhook
POST /webhooks/custom               // Custom webhook
```

**Request/Response Examples**:

Request:
```json
POST /api/v1/validate/codebase
Content-Type: application/json
Authorization: Bearer <token>
X-Request-ID: <uuid>

{
  "name": "ai-generated-service",
  "source": {
    "type": "git",
    "repository": {
      "url": "https://github.com/example/ai-service.git",
      "branch": "main",
      "commit": "abc123"
    }
  },
  "config": {
    "enabled_engines": ["static", "runtime", "security", "integration"],
    "timeout": "15m",
    "quality_gate": {
      "min_overall_score": 80,
      "min_security_score": 90,
      "block_on_secrets": true
    }
  },
  "webhooks": [
    {
      "url": "https://example.com/webhook",
      "events": ["completed", "failed"],
      "secret": "webhook-secret"
    }
  ]
}
```

Response:
```json
{
  "validation_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "created_at": "2024-01-15T10:00:00Z",
  "estimated_duration": "5m",
  "check_status_url": "/api/v1/validate/550e8400-e29b-41d4-a716-446655440000"
}
```

### 3. Orchestration Layer (`internal/orchestrator/`)

#### 3.1 Validation Coordinator (`orchestrator.go`)

Central coordination service managing all validation workflows.

**Responsibilities**:
- Parses validation requests
- Selects appropriate engines based on language and configuration
- Manages parallel execution across engines
- Aggregates results from all engines
- Evaluates quality gates
- Handles errors and retries

**Pipeline Phases**:

```go
type PipelinePhase int

const (
    PhaseIngestion PipelinePhase = iota
    PhaseStaticAnalysis
    PhaseSecurityScanning
    PhaseRuntimeValidation
    PhaseIntegrationTesting
    PhaseAggregation
)
```

**Phase Execution**:

```go
func (o *Orchestrator) ExecuteValidation(ctx context.Context, task *ValidationTask) (*ValidationResult, error) {
    // Phase 1: Ingestion
    codebase, err := o.ingestCodebase(ctx, task.Source)
    if err != nil {
        return nil, fmt.Errorf("ingestion failed: %w", err)
    }
    
    // Phase 2: Static Analysis (parallel)
    staticResults, err := o.runStaticAnalysis(ctx, codebase, task.Config)
    if err != nil {
        return nil, fmt.Errorf("static analysis failed: %w", err)
    }
    
    // Phase 3: Security Scanning (parallel)
    securityResults, err := o.runSecurityScanning(ctx, codebase, task.Config)
    if err != nil {
        return nil, fmt.Errorf("security scanning failed: %w", err)
    }
    
    // Phase 4: Runtime Validation (parallel, gated)
    if task.Config.Runtime.Enabled {
        runtimeResults, err := o.runRuntimeValidation(ctx, codebase, task.Config)
        if err != nil {
            return nil, fmt.Errorf("runtime validation failed: %w", err)
        }
    }
    
    // Phase 5: Integration Testing (optional)
    if task.Config.Integration.Enabled {
        integrationResults, err := o.runIntegrationTests(ctx, codebase, task.Config)
        if err != nil {
            return nil, fmt.Errorf("integration testing failed: %w", err)
        }
    }
    
    // Phase 6: Aggregation
    result := o.aggregateResults(staticResults, securityResults, runtimeResults, integrationResults)
    
    // Evaluate quality gate
    result.QualityGate = o.evaluateQualityGate(result, task.Config.QualityGate)
    
    return result, nil
}
```

#### 3.2 Task Queue Manager

**Redis/RabbitMQ Integration**:
- Task distribution to worker pools
- Priority queue support (critical, high, normal, low)
- Retry logic with exponential backoff
- Dead letter queue for failed tasks
- Worker scaling based on queue depth

**Queue Structure**:

```go
type TaskQueue struct {
    // Redis keys
    pendingKey    string // "kwality:queue:pending"
    processingKey string // "kwality:queue:processing"
    failedKey     string // "kwality:queue:failed"
    deadLetterKey string // "kwality:queue:dead"
    
    // Priority queues
    criticalQueue string // "kwality:queue:critical"
    highQueue     string // "kwality:queue:high"
    normalQueue   string // "kwality:queue:normal"
    lowQueue      string // "kwality:queue:low"
}
```

**Retry Configuration**:

```go
type RetryConfig struct {
    MaxRetries      int           // Maximum retry attempts (default: 3)
    InitialBackoff  time.Duration // Initial backoff (default: 1s)
    MaxBackoff      time.Duration // Maximum backoff (default: 5m)
    BackoffMultiplier float64     // Exponential multiplier (default: 2.0)
}
```

### 4. Validation Engines

All engines implement the `ValidationEngine` interface:

```go
type ValidationEngine interface {
    Name() string
    Version() string
    SupportedLanguages() []string
    
    Validate(ctx context.Context, input *EngineInput) (*EngineResult, error)
    GetDefaultConfig() EngineConfig
    HealthCheck(ctx context.Context) error
}
```

#### 4.1 Static Analysis Engine (`internal/engines/static_analysis.go`)

**Language Support**:

**Go**:
- golangci-lint: Meta-linter with 10+ linters
- go vet: Built-in analysis
- staticcheck: 150+ advanced checks
- gosec: Security-focused scanning
- ineffassign: Dead assignment detection
- errcheck: Uncaught error detection

**Rust**:
- clippy: 650+ lints
- cargo-check: Built-in analysis
- cargo-audit: Dependency vulnerability scanning
- cargo-deny: License and security checking

**JavaScript/TypeScript**:
- ESLint: Comprehensive linting
- TSLint (legacy): TypeScript-specific rules
- tsc --noEmit: Type checking
- ts-prune: Dead code detection

**Python**:
- pylint: Comprehensive analysis
- bandit: Security scanning
- ruff: High-performance linting (Rust-based)
- mypy: Type checking
- pyright: Microsoft's type checker

**Java**:
- SpotBugs: Bug pattern detection
- PMD: Source code analysis
- Checkstyle: Style checking
- SonarJava: Quality analysis

**Capabilities**:
- **AST Parsing**: Tree-sitter for 40+ languages
- **Metrics Calculation**: Cyclomatic complexity, cognitive complexity, maintainability index
- **Dependency Analysis**: Direct and transitive dependency scanning
- **Code Quality**: Best practice enforcement, style checking
- **Documentation**: Comment coverage, API documentation completeness

**Output Format** (SARIF-compatible):

```json
{
  "tool": {
    "driver": {
      "name": "kwality-static",
      "version": "2.0.0"
    }
  },
  "results": [
    {
      "ruleId": "go:S106",
      "level": "warning",
      "message": {
        "text": "Print statements should not be used in production code"
      },
      "locations": [
        {
          "physicalLocation": {
            "artifactLocation": {
              "uri": "src/main.go"
            },
            "region": {
              "startLine": 42,
              "startColumn": 5,
              "endLine": 42,
              "endColumn": 18
            }
          }
        }
      ]
    }
  ]
}
```

#### 4.2 Runtime Validator (`engines/runtime-validator/` - Rust)

**Container Execution**:
- gVisor-based sandboxing
- OCI-compatible runtime
- Image caching for fast startup
- Ephemeral containers (auto-cleanup)

**Performance Profiler**:
- CPU profiling (pprof format for Go, flamegraphs for Rust)
- Memory profiling (heap, allocation tracking)
- I/O profiling (disk and network)
- Goroutine/thread analysis

**Fuzzing Engine**:
- LibFuzzer integration
- Coverage-guided fuzzing
- Crash detection and minimization
- Corpus management

**Memory Analysis**:
- Leak detection (valgrind, LeakSanitizer)
- Use-after-free detection
- Buffer overflow detection
- Memory sanitizer integration

**Safety Features**:
- Network isolation (no external access)
- seccomp-bpf syscall filtering
- Resource limits (CPU, memory, disk)
- Read-only root filesystem
- Non-root execution

**Rust Implementation Rationale**:
- Memory safety for sandboxing code
- Zero-cost abstractions for performance
- Safe FFI for system calls
- Predictable resource usage (no GC pauses)

```rust
// Runtime validator core structure
pub struct RuntimeValidator {
    container_runtime: ContainerRuntime,
    resource_limits: ResourceLimits,
    security_profile: SecurityProfile,
}

impl ValidationEngine for RuntimeValidator {
    fn validate(&self, input: &EngineInput) -> Result<EngineResult, ValidationError> {
        // Create isolated container
        let container = self.container_runtime.create_container(ContainerConfig {
            image: input.config.runtime_image.clone(),
            command: input.config.runtime_command.clone(),
            resource_limits: self.resource_limits.clone(),
            network_mode: NetworkMode::None,
            security_profile: self.security_profile.clone(),
        })?;
        
        // Execute with timeout
        let output = container.execute_with_timeout(
            input.codebase.clone(),
            input.config.timeout
        )?;
        
        // Analyze results
        let result = self.analyze_output(output)?;
        
        Ok(result)
    }
}
```

#### 4.3 Security Scanner (`internal/engines/security.go`)

**SAST (Static Application Security Testing)**:
- Semgrep: 2,000+ community rules, custom rule support
- CodeQL: Semantic analysis, taint tracking
- Gitleaks: Secret detection (200+ patterns)
- Bandit: Python security scanning
- gosec: Go security analysis

**Vulnerability Detection**:
- NVD (National Vulnerability Database) integration
- GHSA (GitHub Security Advisories) integration
- OSV (Open Source Vulnerabilities) integration
- Snyk vulnerability database
- Custom vulnerability feeds

**Secrets Detection**:
- API keys (AWS, Azure, GCP, etc.)
- Database credentials
- Private keys (RSA, EC, DSA)
- Tokens (JWT, OAuth, API tokens)
- Passwords and passphrases
- High-entropy string detection

**Compliance Scanning**:
- OWASP Top 10
- CWE (Common Weakness Enumeration)
- SOC 2 controls
- ISO 27001 requirements
- GDPR data protection
- HIPAA (healthcare)
- PCI DSS (payments)

**Severity Classification**:

```go
type Severity string

const (
    SeverityCritical Severity = "critical"  // Immediate action required
    SeverityHigh     Severity = "high"      // Fix before production
    SeverityMedium   Severity = "medium"    // Fix in next sprint
    SeverityLow      Severity = "low"       // Fix when convenient
    SeverityInfo     Severity = "info"      // Informational only
)

// Scoring based on CVSS v3.1
func CalculateCVSS(metrics CVSSMetrics) float64 {
    // ... CVSS calculation
}
```

#### 4.4 Integration Tester (`internal/engines/integration.go`)

**API Validation**:
- OpenAPI/Swagger specification compliance
- Request/response validation
- Schema validation (JSON Schema)
- Authentication testing
- Rate limit testing

**Contract Testing**:
- Consumer-driven contracts (Pact)
- Provider verification
- Breaking change detection
- Contract evolution tracking

**End-to-End Testing**:
- Playwright for web applications
- Database integration testing
- Service dependency mocking
- Workflow validation

**Performance Testing**:
- Load testing (k6, Apache Bench)
- Stress testing
- Spike testing
- Endurance testing

### 5. Isolation Layer

#### 5.1 Container Management

**Docker API Integration**:
- Container lifecycle management
- Image management
- Volume management
- Network management

**Security Configuration**:

```go
type ContainerSecurity struct {
    // User configuration
    User         string   // Non-root user
    Group        string   // Non-root group
    
    // Filesystem
    ReadOnlyRootFilesystem bool     // Read-only root
    Mounts                 []Mount  // Explicit mounts only
    
    // Capabilities
    CapDrop  []string // Drop all capabilities
    CapAdd   []string // Add back only necessary
    
    // Security profiles
    SeccompProfile string  // seccomp-bpf profile
    AppArmorProfile string // AppArmor profile
    SELinuxOptions  []string // SELinux options
    
    // Network
    NetworkMode string // "none" for isolation
    
    // Resources
    ResourceLimits ResourceLimits
}
```

#### 5.2 Resource Limits

**Default Limits**:
- CPU: 1 core (configurable: 0.1 - 8 cores)
- Memory: 512MB (configurable: 128MB - 8GB)
- Disk: 10GB tmpfs (configurable: 1GB - 100GB)
- Network: Isolated by default
- Timeout: 5 minutes (configurable: 1s - 1h)

**Enforcement**:
- cgroup v2 for resource limiting
- OOM killer configuration
- Disk quota enforcement
- Network bandwidth limiting (if network enabled)

#### 5.3 Security Monitoring

**Syscall Auditing**:
- seccomp-bpf filtering
- Audit logging for all syscalls
- Anomaly detection (unusual syscall patterns)
- Real-time alerting

**File Access Monitoring**:
- Read/write tracking
- Sensitive file detection (/etc/passwd, private keys)
- File integrity monitoring

**Network Monitoring**:
- Connection tracking (if network enabled)
- DNS query logging
- Traffic analysis

**Behavior Analysis**:
- Process tree monitoring
- Resource usage tracking
- Exit code analysis

### 6. Data Layer

#### 6.1 PostgreSQL (`internal/database/`)

**Schema**:

```sql
-- Validation tasks
CREATE TABLE validation_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    status VARCHAR(50) NOT NULL,
    source_type VARCHAR(50) NOT NULL,
    source_url TEXT,
    config JSONB NOT NULL,
    results JSONB,
    overall_score DECIMAL(5,2),
    quality_gate BOOLEAN,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    created_by VARCHAR(255),
    tags TEXT[]
);

-- Engine results
CREATE TABLE engine_results (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES validation_tasks(id),
    engine_name VARCHAR(100) NOT NULL,
    status VARCHAR(50) NOT NULL,
    score DECIMAL(5,2),
    findings JSONB,
    metrics JSONB,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    raw_output TEXT
);

-- Findings
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id UUID REFERENCES validation_tasks(id),
    engine_name VARCHAR(100) NOT NULL,
    rule_id VARCHAR(255),
    severity VARCHAR(50) NOT NULL,
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path TEXT,
    line_number INTEGER,
    column_number INTEGER,
    remediation TEXT,
    references TEXT[]
);

-- Audit log
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    timestamp TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET
);

-- Indexes
CREATE INDEX idx_tasks_status ON validation_tasks(status);
CREATE INDEX idx_tasks_created_at ON validation_tasks(created_at);
CREATE INDEX idx_tasks_created_by ON validation_tasks(created_by);
CREATE INDEX idx_findings_task_id ON findings(task_id);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_audit_timestamp ON audit_log(timestamp);
```

**Migrations**: GORM AutoMigrate with versioned migrations support

#### 6.2 Redis

**Use Cases**:
- Task queue (lists and sorted sets)
- Rate limiting (counters with expiration)
- Session storage (hashes with TTL)
- Result caching (string values with TTL)
- Distributed locking (Redlock)

**Key Patterns**:

```
# Task queue
kwality:queue:pending:{priority}  -> List of task IDs
kwality:queue:processing        -> Hash of task_id -> worker_id
kwality:queue:failed            -> List of failed tasks

# Rate limiting
kwality:ratelimit:{ip}          -> Counter with TTL
kwality:ratelimit:{api_key}     -> Counter with TTL

# Caching
kwality:cache:validation:{hash} -> Cached result with TTL
kwality:cache:ast:{hash}        -> Cached AST with TTL

# Sessions
kwality:session:{token}         -> Hash with TTL

# Locks
kwality:lock:{resource}         -> Lock value with TTL
```

#### 6.3 Object Storage (S3/MinIO)

**Stored Objects**:
- Validation reports (PDF, JSON, SARIF)
- Build artifacts
- Screenshots and videos (E2E testing)
- Log archives
- Code snapshots

**Organization**:

```
s3://kwality-artifacts/
├── reports/
│   └── {year}/{month}/{day}/{task_id}/
│       ├── report.json
│       ├── report.pdf
│       └── report.sarif
├── artifacts/
│   └── {task_id}/
│       ├── build/
│       └── test-results/
├── logs/
│   └── {year}/{month}/{day}/{task_id}/
│       └── engine-{name}.log
└── screenshots/
    └── {task_id}/
        └── {test_name}.png
```

---

## Data Models

### ValidationTask

```go
type ValidationTask struct {
    // Identity
    ID   uuid.UUID `json:"id" gorm:"primaryKey;type:uuid;default:gen_random_uuid()"`
    Name string    `json:"name" gorm:"not null"`
    
    // Status
    Status TaskStatus `json:"status" gorm:"not null;index"`
    
    // Source
    Source CodebaseSource `json:"source" gorm:"embedded;embeddedPrefix:source_"`
    
    // Configuration
    Config ValidationConfig `json:"config" gorm:"serializer:json"`
    
    // Results
    Results       map[string]EngineResult `json:"results,omitempty" gorm:"serializer:json"`
    OverallScore  float64                 `json:"overall_score" gorm:"column:overall_score"`
    QualityGate   bool                    `json:"quality_gate"`
    
    // Timing
    CreatedAt   time.Time  `json:"created_at" gorm:"index"`
    StartedAt   *time.Time `json:"started_at,omitempty"`
    CompletedAt *time.Time `json:"completed_at,omitempty"`
    Duration    *time.Duration `json:"duration,omitempty"`
    
    // Metadata
    CreatedBy string   `json:"created_by,omitempty" gorm:"index"`
    Tags      []string `json:"tags,omitempty" gorm:"type:text[]"`
}

type TaskStatus string

const (
    TaskPending    TaskStatus = "pending"
    TaskRunning    TaskStatus = "running"
    TaskCompleted  TaskStatus = "completed"
    TaskFailed     TaskStatus = "failed"
    TaskCancelled  TaskStatus = "cancelled"
    TaskRetrying   TaskStatus = "retrying"
)

type CodebaseSource struct {
    Type       SourceType      `json:"type"`
    Repository *GitRepository  `json:"repository,omitempty"`
    LocalPath  string          `json:"local_path,omitempty"`
    ArchiveURL string          `json:"archive_url,omitempty"`
    Content    string          `json:"content,omitempty"` // For inline code
}

type SourceType string

const (
    SourceTypeGit     SourceType = "git"
    SourceTypeLocal   SourceType = "local"
    SourceTypeArchive SourceType = "archive"
    SourceTypeInline  SourceType = "inline"
)

type GitRepository struct {
    URL       string `json:"url"`
    Branch    string `json:"branch,omitempty"`
    Commit    string `json:"commit,omitempty"`
    Tag       string `json:"tag,omitempty"`
    AuthToken string `json:"-"` // Excluded from serialization
}
```

### ValidationConfig

```go
type ValidationConfig struct {
    // Engine selection
    EnabledEngines []string      `json:"enabled_engines"`
    Timeout        time.Duration `json:"timeout"`
    
    // Per-engine configuration
    StaticAnalysis StaticAnalysisConfig `json:"static_analysis,omitempty"`
    Runtime        RuntimeConfig        `json:"runtime,omitempty"`
    Security       SecurityConfig       `json:"security,omitempty"`
    Integration    IntegrationConfig    `json:"integration,omitempty"`
    
    // Quality gate
    QualityGate QualityGateConfig `json:"quality_gate,omitempty"`
    
    // Advanced options
    Parallel    bool `json:"parallel,omitempty"`
    CacheEnabled bool `json:"cache_enabled,omitempty"`
    DryRun      bool `json:"dry_run,omitempty"`
}

type StaticAnalysisConfig struct {
    Enabled      bool     `json:"enabled"`
    Linters      []string `json:"linters,omitempty"`
    MaxFileSize  int64    `json:"max_file_size,omitempty"`  // bytes
    MaxFiles     int      `json:"max_files,omitempty"`
    ExcludePaths []string `json:"exclude_paths,omitempty"`
    IncludePaths []string `json:"include_paths,omitempty"`
}

type RuntimeConfig struct {
    Enabled           bool    `json:"enabled"`
    ContainerImage    string  `json:"container_image,omitempty"`
    MemoryLimitMB     int     `json:"memory_limit_mb,omitempty"`
    CPULimitCores     float64 `json:"cpu_limit_cores,omitempty"`
    TimeoutSeconds    int     `json:"timeout_seconds,omitempty"`
    NetworkIsolation  bool    `json:"network_isolation,omitempty"`
    EnableFuzzing     bool    `json:"enable_fuzzing,omitempty"`
    EnableProfiling   bool    `json:"enable_profiling,omitempty"`
}

type SecurityConfig struct {
    Enabled            bool     `json:"enabled"`
    Scanners           []string `json:"scanners,omitempty"`
    VulnerabilityDBs   []string `json:"vulnerability_dbs,omitempty"`
    SecretsDetection   bool     `json:"secrets_detection,omitempty"`
    ComplianceStandards []string `json:"compliance_standards,omitempty"`
    FailOnCritical     bool     `json:"fail_on_critical,omitempty"`
}

type IntegrationConfig struct {
    Enabled           bool     `json:"enabled"`
    TestCommand       string   `json:"test_command,omitempty"`
    TestFramework     string   `json:"test_framework,omitempty"`
    OpenAPISpec       string   `json:"openapi_spec,omitempty"`
    MockDependencies  bool     `json:"mock_dependencies,omitempty"`
}

type QualityGateConfig struct {
    MinOverallScore   float64 `json:"min_overall_score,omitempty"`   // 0-100
    MinSecurityScore  float64 `json:"min_security_score,omitempty"` // 0-100
    MaxCriticalIssues int     `json:"max_critical_issues,omitempty"` // 0 = unlimited
    MaxHighIssues     int     `json:"max_high_issues,omitempty"`
    BlockOnSecrets    bool    `json:"block_on_secrets,omitempty"`
    RequireTestsPass  bool    `json:"require_tests_pass,omitempty"`
}
```

### EngineResult

```go
type EngineResult struct {
    // Identity
    Engine  string       `json:"engine"`
    Version string       `json:"version,omitempty"`
    Status  EngineStatus `json:"status"`
    
    // Scoring
    Score float64 `json:"score,omitempty"` // 0-100
    
    // Results
    Findings []Finding     `json:"findings,omitempty"`
    Metrics  EngineMetrics `json:"metrics,omitempty"`
    
    // Timing
    StartedAt   time.Time     `json:"started_at,omitempty"`
    CompletedAt time.Time     `json:"completed_at,omitempty"`
    Duration    time.Duration `json:"duration,omitempty"`
    
    // Raw output
    RawOutput   string `json:"raw_output,omitempty"`
    ExitCode    int    `json:"exit_code,omitempty"`
}

type EngineStatus string

const (
    EngineSuccess  EngineStatus = "success"
    EnginePartial  EngineStatus = "partial"
    EngineFailed   EngineStatus = "failed"
    EngineSkipped  EngineStatus = "skipped"
    EngineTimeout  EngineStatus = "timeout"
)

type Finding struct {
    // Identity
    ID     string `json:"id,omitempty"`
    RuleID string `json:"rule_id,omitempty"`
    
    // Classification
    Severity   Severity `json:"severity"`
    Confidence float64  `json:"confidence,omitempty"` // 0.0-1.0
    
    // Description
    Title       string `json:"title"`
    Description string `json:"description,omitempty"`
    
    // Location
    Location *Location `json:"location,omitempty"`
    
    // Remediation
    Remediation string   `json:"remediation,omitempty"`
    References  []string `json:"references,omitempty"`
    
    // Source
    Engine      string `json:"engine"`
    
    // Correlation
    RelatedFindings []string `json:"related_findings,omitempty"` // IDs of related findings
}

type Severity string

const (
    SeverityCritical Severity = "critical"
    SeverityHigh     Severity = "high"
    SeverityMedium   Severity = "medium"
    SeverityLow      Severity = "low"
    SeverityInfo     Severity = "info"
)

type Location struct {
    File       string `json:"file"`
    Line       int    `json:"line,omitempty"`
    Column     int    `json:"column,omitempty"`
    EndLine    int    `json:"end_line,omitempty"`
    EndColumn  int    `json:"end_column,omitempty"`
    Snippet    string `json:"snippet,omitempty"`
}

type EngineMetrics struct {
    FilesScanned     int     `json:"files_scanned,omitempty"`
    LinesScanned     int     `json:"lines_scanned,omitempty"`
    IssuesFound      int     `json:"issues_found,omitempty"`
    IssuesFixed      int     `json:"issues_fixed,omitempty"`
    DurationSeconds  float64 `json:"duration_seconds,omitempty"`
    MemoryUsageMB    float64 `json:"memory_usage_mb,omitempty"`
    CPUUsagePercent  float64 `json:"cpu_usage_percent,omitempty"`
}
```

---

## Performance Specifications

### Validation Throughput

| Project Size | Files | Lines | Target Time | Max Time |
|--------------|-------|-------|-------------|----------|
| Small        | <1000 | <50K  | <2 min      | 5 min    |
| Medium       | 1K-10K| 50K-500K| <8 min    | 15 min   |
| Large        | 10K+  | 500K+ | <20 min     | 30 min   |
| Monorepo     | 100K+ | 5M+   | <60 min     | 120 min  |

### Engine Performance

| Engine | Throughput | Memory | CPU |
|--------|------------|--------|-----|
| Static Analysis | 100 files/sec | 500MB | 2 cores |
| Security Scanner | 50 files/sec | 1GB | 2 cores |
| Runtime Validator | 1 codebase/5 min | 2GB | 1 core |
| Integration Tester | Depends on tests | 1GB | 1 core |

### API Performance

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| Health Check | 10ms | 50ms | 100ms |
| Task Submission | 100ms | 500ms | 1s |
| Result Retrieval | 20ms | 100ms | 200ms |
| Task List (100) | 50ms | 200ms | 500ms |

### Resource Usage

| Component | Memory | CPU | Storage |
|-----------|--------|-----|---------|
| Orchestrator | 512MB | 1 core | 10GB |
| Static Analysis Worker | 1GB | 2 cores | 5GB |
| Security Scanner Worker | 2GB | 2 cores | 10GB |
| Runtime Validator Worker | 2GB | 1 core | 20GB |
| Database | 4GB | 2 cores | 100GB |
| Redis | 1GB | 0.5 cores | 10GB |

### Scaling Limits

- **Concurrent Validations**: 100+ per orchestrator instance
- **Queue Depth**: 10,000+ pending tasks
- **Workers per Type**: 20+ per orchestrator
- **Horizontal Scaling**: Unlimited with load balancer

---

## Integration Points

### GitHub Actions

```yaml
name: Kwality Validation
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Kwality Validation
        uses: kwality/validate-action@v2
        with:
          engines: static,security,runtime
          fail-on-threshold: 80
          config: .kwality.yaml
          
      - name: Upload Results
        uses: actions/upload-artifact@v4
        with:
          name: validation-results
          path: kwality-report.json
```

### GitLab CI

```yaml
kwality:
  image: kwality/cli:latest
  script:
    - kwality validate . --engines static,runtime --output gitlab-codequality-report.json
  artifacts:
    reports:
      codequality: gitlab-codequality-report.json
    paths:
      - kwality-report.json
```

### Jenkins

```groovy
pipeline {
    agent any
    stages {
        stage('Validate') {
            steps {
                sh 'kwality validate . --engines static,security --output report.json'
            }
        }
    }
    post {
        always {
            archiveArtifacts artifacts: 'report.json'
        }
    }
}
```

### Docker Compose

```yaml
version: '3.8'
services:
  kwality:
    image: kwality/platform:latest
    environment:
      - KWALITY_DB_HOST=postgres
      - KWALITY_REDIS_HOST=redis
      - KWALITY_ENV=production
    ports:
      - "8080:8080"
    depends_on:
      - postgres
      - redis
    volumes:
      - /var/run/docker.sock:/var/run/docker.sock
      
  postgres:
    image: postgres:16-alpine
    environment:
      - POSTGRES_USER=kwality
      - POSTGRES_PASSWORD=${DB_PASSWORD}
      - POSTGRES_DB=kwality
    volumes:
      - postgres_data:/var/lib/postgresql/data
      
  redis:
    image: redis:7-alpine
    volumes:
      - redis_data:/data

volumes:
  postgres_data:
  redis_data:
```

### Kubernetes

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kwality-orchestrator
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kwality-orchestrator
  template:
    metadata:
      labels:
        app: kwality-orchestrator
    spec:
      containers:
        - name: orchestrator
          image: kwality/orchestrator:latest
          ports:
            - containerPort: 8080
          env:
            - name: KWALITY_DB_HOST
              value: "postgres-service"
            - name: KWALITY_REDIS_HOST
              value: "redis-service"
          resources:
            requests:
              memory: "512Mi"
              cpu: "500m"
            limits:
              memory: "1Gi"
              cpu: "1000m"
---
apiVersion: v1
kind: Service
metadata:
  name: kwality-orchestrator-service
spec:
  selector:
    app: kwality-orchestrator
  ports:
    - port: 8080
      targetPort: 8080
  type: LoadBalancer
```

### Webhook Integration

**Outgoing Webhooks**:
```json
POST https://example.com/webhook/kwality
Headers:
  X-Kwality-Signature: sha256=<hmac>
  Content-Type: application/json

{
  "event": "validation.completed",
  "timestamp": "2024-01-15T10:05:30Z",
  "validation": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "name": "ai-service",
    "status": "completed",
    "overall_score": 87.5,
    "quality_gate": true,
    "url": "https://kwality.example.com/validations/550e8400-e29b-41d4-a716-446655440000"
  }
}
```

**Incoming Webhooks** (GitHub/GitLab):
```go
POST /webhooks/github
Headers:
  X-GitHub-Event: push
  X-GitHub-Delivery: <uuid>
  X-Hub-Signature-256: sha256=<hmac>

{
  "ref": "refs/heads/main",
  "repository": {
    "clone_url": "https://github.com/example/repo.git"
  },
  "head_commit": {
    "id": "abc123"
  }
}
```

---

## Security Model

### Threat Model

**Assumptions**:
- AI-generated code may be malicious
- Attackers may attempt container escape
- Network attacks from within containers are possible
- Resource exhaustion attacks are likely

**Threats**:
1. Container escape via kernel exploits
2. Privilege escalation through misconfiguration
3. Resource exhaustion (CPU, memory, disk)
4. Information leakage between validations
5. Supply chain attacks via dependencies

### Isolation Layers

**Layer 1: Container (Docker)**
- Namespaces (PID, Network, Mount, IPC, UTS, User)
- cgroups (CPU, memory, I/O limits)
- Seccomp (syscall filtering)
- Capabilities (drop all, add minimal)

**Layer 2: gVisor (Userspace Kernel)**
- Sentry: Implements Linux syscall interface in userspace
- Platform: Limited syscall exposure to host
- Gofer: Filesystem proxy

**Layer 3: seccomp-bpf**
- Whitelist approach: Deny all, allow specific
- BPF filter for efficient syscall filtering
- 20 syscall limit for most validations

### Secrets Management

**Detection**:
- 350+ secret patterns (GitGuardian dataset)
- Entropy analysis for unknown patterns
- High-entropy string detection
- Known credential formats (AWS, Azure, GCP, etc.)

**Prevention**:
- Pre-commit hooks block secrets
- Server-side rejection of commits with secrets
- Automatic rotation suggestions
- Integration with secret managers (Vault, AWS SM, Azure Key Vault)

**Response**:
- Immediate alert on detection
- Automatic task cancellation
- Audit log entry
- Incident response workflow trigger

### Audit Logging

**Immutable Logs**:
- Append-only with cryptographic integrity
- Signed log entries
- Tamper-evident log chain

**Logged Events**:
- All validation submissions
- All engine executions
- All configuration changes
- All access attempts
- All secret detections
- All security events

**Retention**:
- Default: 90 days online, 1 year archive
- Compliance mode: 7 years archive
- Real-time streaming to SIEM

---

## Extensibility

### Custom Engines

```go
package myengine

import "kwality/internal/engines"

type MyCustomEngine struct {
    config MyConfig
}

func (e *MyCustomEngine) Name() string {
    return "my-custom-engine"
}

func (e *MyCustomEngine) SupportedLanguages() []string {
    return []string{"go", "python"}
}

func (e *MyCustomEngine) Validate(ctx context.Context, input *engines.EngineInput) (*engines.EngineResult, error) {
    // Custom validation logic
    findings := e.analyze(input.Codebase)
    
    return &engines.EngineResult{
        Engine:   e.Name(),
        Status:   engines.EngineSuccess,
        Score:    e.calculateScore(findings),
        Findings: findings,
    }, nil
}

func (e *MyCustomEngine) GetDefaultConfig() map[string]interface{} {
    return map[string]interface{}{
        "custom_option": "default_value",
    }
}
```

**Registration**:
```go
func init() {
    engines.Register(&MyCustomEngine{})
}
```

### Custom Rules

**Semgrep Rule Format**:
```yaml
rules:
  - id: kwality.custom.no-ai-logger
    pattern: |
      log.Println("AI generated this code")
    languages:
      - go
    message: "Detected AI-generated marker"
    severity: WARNING
    metadata:
      category: ai-detection
```

**Rule Distribution**:
- Local rules in `.kwality/rules/`
- Remote rule registries
- Built-in rule library
- Community rule sharing

### Webhook Handlers

**Custom Webhook Handler**:
```go
type CustomWebhookHandler struct{}

func (h *CustomWebhookHandler) Handle(event WebhookEvent) error {
    switch event.Type {
    case "validation.completed":
        return h.onValidationCompleted(event)
    case "validation.failed":
        return h.onValidationFailed(event)
    default:
        return nil
    }
}
```

---

## Error Handling

### Error Categories

```go
type ErrorCategory string

const (
    ErrorCategoryValidation ErrorCategory = "validation"      // Validation logic error
    ErrorCategorySystem     ErrorCategory = "system"          // System error
    ErrorCategoryNetwork    ErrorCategory = "network"         // Network error
    ErrorCategorySecurity   ErrorCategory = "security"      // Security violation
    ErrorCategoryInput      ErrorCategory = "input"           // Invalid input
    ErrorCategoryTimeout    ErrorCategory = "timeout"         // Timeout
    ErrorCategoryCanceled   ErrorCategory = "canceled"        // Canceled by user
)

type ValidationError struct {
    Category    ErrorCategory `json:"category"`
    Code        string        `json:"code"`
    Message     string        `json:"message"`
    Details     interface{}   `json:"details,omitempty"`
    Retryable   bool          `json:"retryable"`
    Recoverable bool          `json:"recoverable"`
}
```

### Retry Logic

```go
type RetryPolicy struct {
    MaxRetries      int
    InitialBackoff  time.Duration
    MaxBackoff      time.Duration
    Multiplier      float64
    RetryableErrors []string
}

var DefaultRetryPolicy = RetryPolicy{
    MaxRetries:      3,
    InitialBackoff:  1 * time.Second,
    MaxBackoff:      5 * time.Minute,
    Multiplier:      2.0,
    RetryableErrors: []string{"network_error", "timeout", "rate_limited"},
}
```

---

## Monitoring and Observability

### Metrics

**Prometheus Metrics**:

```go
// Counters
validationRequestsTotal = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "kwality_validation_requests_total",
        Help: "Total validation requests",
    },
    []string{"status", "engine"},
)

validationErrorsTotal = prometheus.NewCounterVec(
    prometheus.CounterOpts{
        Name: "kwality_validation_errors_total",
        Help: "Total validation errors",
    },
    []string{"category"},
)

// Histograms
validationDuration = prometheus.NewHistogramVec(
    prometheus.HistogramOpts{
        Name:    "kwality_validation_duration_seconds",
        Help:    "Validation duration in seconds",
        Buckets: prometheus.ExponentialBuckets(1, 2, 15),
    },
    []string{"engine"},
)

// Gauges
activeValidations = prometheus.NewGauge(
    prometheus.GaugeOpts{
        Name: "kwality_active_validations",
        Help: "Currently running validations",
    },
)

queueDepth = prometheus.NewGaugeVec(
    prometheus.GaugeOpts{
        Name: "kwality_queue_depth",
        Help: "Current queue depth",
    },
    []string{"priority"},
)
```

### Tracing

**OpenTelemetry Integration**:

```go
func (o *Orchestrator) ExecuteValidation(ctx context.Context, task *ValidationTask) (*ValidationResult, error) {
    ctx, span := tracer.Start(ctx, "ExecuteValidation",
        trace.WithAttributes(
            attribute.String("task.id", task.ID.String()),
            attribute.String("task.name", task.Name),
        ),
    )
    defer span.End()
    
    // ... validation logic
    
    return result, nil
}
```

### Logging

**Structured Logging (zap)**:

```go
logger.Info("validation_started",
    zap.String("task_id", task.ID.String()),
    zap.String("task_name", task.Name),
    zap.String("source_type", string(task.Source.Type)),
    zap.Strings("engines", task.Config.EnabledEngines),
)

logger.Error("validation_failed",
    zap.String("task_id", task.ID.String()),
    zap.Error(err),
    zap.String("category", string(err.Category)),
)
```

**Log Levels**:
- DEBUG: Detailed debugging information
- INFO: General operational information
- WARN: Warning events (not errors)
- ERROR: Error events that might still allow continuation
- FATAL: Severe errors causing termination

### Health Checks

**Health Endpoint** (`/health`):
```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:00:00Z",
  "version": "2.0.0",
  "checks": {
    "database": {
      "status": "healthy",
      "response_time_ms": 5
    },
    "redis": {
      "status": "healthy",
      "response_time_ms": 2
    },
    "runtime_engine": {
      "status": "healthy",
      "version": "1.5.0"
    }
  }
}
```

**Readiness Probe** (`/ready`):
- Returns 200 when ready to accept traffic
- Returns 503 during startup/shutdown

**Liveness Probe** (`/health`):
- Returns 200 if alive
- Returns 500 if dead (trigger container restart)

---

## Deployment

### Environment Configuration

**Development**:
```yaml
environment: development
log_level: debug
metrics_enabled: true
profiling_enabled: true

server:
  port: 8080
  host: localhost

database:
  host: localhost
  port: 5432
  name: kwality_dev
  ssl_mode: disable
```

**Staging**:
```yaml
environment: staging
log_level: info
metrics_enabled: true
profiling_enabled: false

server:
  port: 8080
  host: 0.0.0.0

database:
  host: postgres.staging.internal
  ssl_mode: require
```

**Production**:
```yaml
environment: production
log_level: warn
metrics_enabled: true
profiling_enabled: false

caching:
  ttl: 1h
  max_size: 10GB

rate_limiting:
  requests_per_minute: 1000
  burst_size: 100

security:
  tls_min_version: "1.3"
  hsts_enabled: true
  csp_enabled: true
```

### Blue-Green Deployment

```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: kwality-orchestrator
spec:
  replicas: 3
  strategy:
    blueGreen:
      activeService: kwality-orchestrator-active
      previewService: kwality-orchestrator-preview
      autoPromotionEnabled: false
      scaleDownDelaySeconds: 600
```

### Database Migrations

```bash
# Run migrations
kwality migrate up

# Rollback
kwality migrate down

# Check status
kwality migrate status
```

**Migration Files**:
```sql
-- 001_initial_schema.sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE validation_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    -- ...
);
```

---

## Versioning and Compatibility

### API Versioning

**URL-based versioning**:
- `/api/v1/validate` - Current stable
- `/api/v2/validate` - Next version (development)

**Breaking Changes**:
- Only in major version bumps
- 6-month deprecation period
- Migration guides provided

### Engine Versioning

**Semantic Versioning**:
- MAJOR: Breaking changes to engine interface
- MINOR: New features, backward compatible
- PATCH: Bug fixes

**Engine Compatibility**:
```go
type EngineVersion struct {
    Major int
    Minor int
    Patch int
}

func (e *EngineVersion) CompatibleWith(other *EngineVersion) bool {
    return e.Major == other.Major && e.Minor >= other.Minor
}
```

---

## Testing

### Unit Tests

```go
func TestStaticAnalysis(t *testing.T) {
    engine := NewStaticAnalysisEngine()
    
    input := &EngineInput{
        Codebase: testCodebase,
        Config:   testConfig,
    }
    
    result, err := engine.Validate(context.Background(), input)
    
    assert.NoError(t, err)
    assert.Greater(t, result.Score, 0.0)
    assert.NotEmpty(t, result.Findings)
}
```

### Integration Tests

```go
func TestValidationPipeline(t *testing.T) {
    // Start test server
    server := testutil.StartTestServer(t)
    defer server.Stop()
    
    // Submit validation
    resp, err := http.Post(
        server.URL+"/api/v1/validate/codebase",
        "application/json",
        testPayload,
    )
    
    assert.NoError(t, err)
    assert.Equal(t, http.StatusAccepted, resp.StatusCode)
}
```

### E2E Tests

```bash
# Run E2E test suite
make test-e2e

# Run specific test
make test-e2e TEST=validation_flow
```

---

## Contributing

### Development Setup

```bash
# Clone repository
git clone https://github.com/KooshaPari/kwality.git
cd kwality

# Install dependencies
go mod download
cd engines/runtime-validator && cargo build && cd ../..

# Run tests
make test

# Start development server
make dev
```

### Code Standards

**Go**:
- gofmt for formatting
- golangci-lint for linting
- go vet for analysis
- 80% test coverage minimum

**Rust**:
- rustfmt for formatting
- clippy for linting
- cargo check for analysis
- 70% test coverage minimum

### Pull Request Process

1. Create feature branch
2. Write tests first (TDD)
3. Implement feature
4. Run full test suite
5. Update documentation
6. Submit PR with description
7. Code review (2 approvals required)
8. Merge to main

---

## Appendix A: Configuration Reference

### A.1 Full Configuration Schema

```yaml
# kwality.yaml - Complete configuration reference

# Server configuration
server:
  port: 8080
  host: "0.0.0.0"
  tls:
    enabled: true
    cert_file: "/etc/kwality/tls.crt"
    key_file: "/etc/kwality/tls.key"
    min_version: "1.3"
  cors:
    enabled: true
    allowed_origins: ["https://app.kwality.dev"]
    allowed_methods: ["GET", "POST", "PUT", "DELETE"]
  rate_limiting:
    enabled: true
    requests_per_minute: 1000
    burst_size: 100

# Database configuration
database:
  type: "postgresql"
  host: "localhost"
  port: 5432
  name: "kwality"
  user: "kwality"
  password: "${DB_PASSWORD}"  # From environment
  ssl_mode: "require"
  max_connections: 50
  connection_timeout: "30s"
  
  # Pool settings
  pool:
    max_open: 50
    max_idle: 10
    max_lifetime: "1h"
    max_idle_time: "10m"

# Redis configuration
redis:
  host: "localhost"
  port: 6379
  password: "${REDIS_PASSWORD}"
  database: 0
  pool_size: 20
  
  # Sentinel configuration for HA
  sentinel:
    enabled: false
    master_name: "mymaster"
    addresses:
      - "sentinel1:26379"
      - "sentinel2:26379"
      - "sentinel3:26379"

# Queue configuration
queue:
  type: "redis"  # or "rabbitmq"
  redis:
    key_prefix: "kwality:queue"
  rabbitmq:
    url: "amqp://guest:guest@localhost:5672/"
    exchange: "kwality"
    prefetch_count: 10
  
  # Worker configuration
  workers:
    static_analysis: 5
    security_scan: 3
    runtime: 2
    integration: 2

# Storage configuration
storage:
  type: "s3"  # or "minio", "gcs", "azure"
  s3:
    bucket: "kwality-artifacts"
    region: "us-east-1"
    endpoint: ""  # For MinIO
    access_key: "${AWS_ACCESS_KEY}"
    secret_key: "${AWS_SECRET_KEY}"
  
  # Local fallback for development
  local:
    path: "/var/lib/kwality/artifacts"

# Validation defaults
validation:
  defaults:
    enabled_engines:
      - static
      - security
    timeout: "10m"
    parallel: true
    cache_enabled: true

# Engine-specific configuration
engines:
  static_analysis:
    enabled: true
    default_linters:
      go:
        - golangci-lint
        - go vet
      rust:
        - clippy
        - cargo-check
      python:
        - ruff
        - pylint
      javascript:
        - eslint
        - tsc
    
    # AST settings
    ast:
      parser: "tree-sitter"
      timeout: "30s"
      max_file_size: "10MB"
    
    # Metrics
    metrics:
      enabled: true
      cyclomatic_threshold: 15
      cognitive_threshold: 20

  runtime:
    enabled: true
    container_runtime: "gvisor"
    
    # Resource defaults
    resources:
      memory_limit: "512MB"
      cpu_limit: 1.0
      timeout: "300s"
    
    # Security
    security:
      network_isolation: true
      read_only_root: true
      seccomp_profile: "default"
      capabilities:
        drop: ["ALL"]
    
    # Fuzzing
    fuzzing:
      enabled: true
      duration: "60s"
      max_total_time: "300s"

  security:
    enabled: true
    scanners:
      - semgrep
      - gosec
      - bandit
      - cargo-audit
    
    # Secret detection
    secrets:
      enabled: true
      patterns:
        - "aws"
        - "gcp"
        - "azure"
        - "generic-api-key"
        - "private-key"
      entropy_threshold: 4.5
    
    # Vulnerability databases
    vulnerability_dbs:
      - nvd
      - ghsa
      - osv
    
    # Compliance
    compliance:
      standards:
        - owasp-top-10
        - cwe-top-25

  integration:
    enabled: false  # Disabled by default
    test_frameworks:
      - pytest
      - jest
      - go-test
    
    api_testing:
      enabled: true
      timeout: "30s"

# Quality gate defaults
quality_gate:
  min_overall_score: 80
  min_security_score: 90
  max_critical_issues: 0
  max_high_issues: 5
  block_on_secrets: true
  require_tests_pass: true

# Webhook configuration
webhooks:
  enabled: true
  timeout: "30s"
  retry:
    max_attempts: 3
    backoff: "1s"
  
  # Signatures
  signatures:
    enabled: true
    header: "X-Kwality-Signature"
    algorithm: "sha256"
    secret: "${WEBHOOK_SECRET}"

# Monitoring configuration
monitoring:
  metrics:
    enabled: true
    format: "prometheus"
    path: "/metrics"
    
  tracing:
    enabled: true
    exporter: "otlp"  # or "jaeger", "zipkin"
    endpoint: "http://localhost:4317"
    sampling_rate: 0.1
    
  logging:
    level: "info"
    format: "json"
    output: "stdout"
    
    # Structured fields
    fields:
      - timestamp
      - level
      - message
      - request_id
      - user_id
      - duration_ms

# Authentication
auth:
  enabled: true
  
  # JWT configuration
  jwt:
    enabled: true
    secret: "${JWT_SECRET}"
    issuer: "kwality"
    audience: "kwality-api"
    access_token_ttl: "1h"
    refresh_token_ttl: "168h"  # 7 days
  
  # API Keys
  api_keys:
    enabled: true
    header: "X-API-Key"
    
  # OAuth2 (Enterprise)
  oauth2:
    enabled: false
    providers:
      - name: "github"
        client_id: "${GITHUB_CLIENT_ID}"
        client_secret: "${GITHUB_CLIENT_SECRET}"
      - name: "gitlab"
        client_id: "${GITLAB_CLIENT_ID}"
        client_secret: "${GITLAB_CLIENT_SECRET}"

# Notifications
notifications:
  enabled: true
  
  # Email
  email:
    enabled: false
    smtp_host: "smtp.example.com"
    smtp_port: 587
    username: "${SMTP_USER}"
    password: "${SMTP_PASS}"
    from: "kwality@example.com"
  
  # Slack
  slack:
    enabled: false
    webhook_url: "${SLACK_WEBHOOK_URL}"
    
  # Discord
  discord:
    enabled: false
    webhook_url: "${DISCORD_WEBHOOK_URL}"

# Feature flags
features:
  advanced_runtime: false
  ml_predictions: false
  custom_rules_ui: false
  sarif_export: true
  gitlab_integration: true
  github_integration: true
  bitbucket_integration: false
```

### A.2 Environment Variable Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KWALITY_ENV` | No | `development` | Environment (development, staging, production) |
| `KWALITY_PORT` | No | `8080` | Server port |
| `KWALITY_LOG_LEVEL` | No | `info` | Logging level |
| `DB_HOST` | Yes | - | Database host |
| `DB_PORT` | No | `5432` | Database port |
| `DB_NAME` | No | `kwality` | Database name |
| `DB_USER` | Yes | - | Database user |
| `DB_PASSWORD` | Yes | - | Database password |
| `REDIS_HOST` | Yes | - | Redis host |
| `REDIS_PORT` | No | `6379` | Redis port |
| `REDIS_PASSWORD` | No | - | Redis password |
| `JWT_SECRET` | Yes | - | JWT signing secret |
| `WEBHOOK_SECRET` | No | - | Webhook signing secret |
| `AWS_ACCESS_KEY` | No | - | S3 access key |
| `AWS_SECRET_KEY` | No | - | S3 secret key |
| `S3_BUCKET` | No | `kwality-artifacts` | S3 bucket name |

---

## Appendix B: Database Schema

### B.1 Entity Relationship Diagram

```
┌─────────────────┐       ┌─────────────────┐       ┌─────────────────┐
│ validation_tasks│       │ engine_results  │       │    findings     │
├─────────────────┤       ├─────────────────┤       ├─────────────────┤
│ id (PK)         │◄──────│ task_id (FK)    │◄──────│ task_id (FK)    │
│ name            │       │ engine_name     │       │ engine_name     │
│ status          │       │ status          │       │ rule_id         │
│ source_type     │       │ score           │       │ severity        │
│ config          │       │ findings        │       │ title           │
│ results         │       │ metrics         │       │ location        │
│ overall_score   │       │ raw_output      │       │ remediation     │
│ quality_gate    │       │                 │       │                 │
└─────────────────┘       └─────────────────┘       └─────────────────┘
         │
         │
         ▼
┌─────────────────┐
│   audit_log     │
├─────────────────┤
│ id (PK)         │
│ timestamp       │
│ user_id         │
│ action          │
│ resource_type   │
│ resource_id     │
│ details         │
│ ip_address      │
└─────────────────┘
```

### B.2 Migration Scripts

**001_initial_schema.sql**:
```sql
-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Create enum types
CREATE TYPE task_status AS ENUM ('pending', 'running', 'completed', 'failed', 'cancelled', 'retrying');
CREATE TYPE engine_status AS ENUM ('success', 'partial', 'failed', 'skipped', 'timeout');
CREATE TYPE severity AS ENUM ('critical', 'high', 'medium', 'low', 'info');
CREATE TYPE source_type AS ENUM ('git', 'local', 'archive', 'inline');

-- Validation tasks table
CREATE TABLE validation_tasks (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name VARCHAR(255) NOT NULL,
    status task_status NOT NULL DEFAULT 'pending',
    source_type source_type NOT NULL,
    source_url TEXT,
    source_branch VARCHAR(255),
    source_commit VARCHAR(40),
    config JSONB NOT NULL DEFAULT '{}',
    results JSONB,
    overall_score DECIMAL(5,2),
    quality_gate BOOLEAN,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    created_by VARCHAR(255),
    tags TEXT[],
    metadata JSONB
);

-- Engine results table
CREATE TABLE engine_results (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES validation_tasks(id) ON DELETE CASCADE,
    engine_name VARCHAR(100) NOT NULL,
    engine_version VARCHAR(50),
    status engine_status NOT NULL,
    score DECIMAL(5,2),
    findings JSONB,
    metrics JSONB,
    raw_output TEXT,
    started_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    duration_ms INTEGER,
    error_message TEXT
);

-- Findings table
CREATE TABLE findings (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    task_id UUID NOT NULL REFERENCES validation_tasks(id) ON DELETE CASCADE,
    engine_name VARCHAR(100) NOT NULL,
    rule_id VARCHAR(255),
    severity severity NOT NULL,
    confidence DECIMAL(3,2),
    title VARCHAR(500) NOT NULL,
    description TEXT,
    file_path TEXT,
    line_number INTEGER,
    column_number INTEGER,
    end_line INTEGER,
    end_column INTEGER,
    snippet TEXT,
    remediation TEXT,
    references TEXT[],
    related_findings UUID[],
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

-- Audit log table
CREATE TABLE audit_log (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    timestamp TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW(),
    user_id VARCHAR(255),
    user_email VARCHAR(255),
    action VARCHAR(100) NOT NULL,
    resource_type VARCHAR(100) NOT NULL,
    resource_id UUID,
    details JSONB,
    ip_address INET,
    user_agent TEXT
);

-- Create indexes
CREATE INDEX idx_tasks_status ON validation_tasks(status);
CREATE INDEX idx_tasks_created_at ON validation_tasks(created_at DESC);
CREATE INDEX idx_tasks_created_by ON validation_tasks(created_by);
CREATE INDEX idx_tasks_source_type ON validation_tasks(source_type);
CREATE INDEX idx_tasks_tags ON validation_tasks USING GIN(tags);

CREATE INDEX idx_engine_results_task_id ON engine_results(task_id);
CREATE INDEX idx_engine_results_engine ON engine_results(engine_name);

CREATE INDEX idx_findings_task_id ON findings(task_id);
CREATE INDEX idx_findings_severity ON findings(severity);
CREATE INDEX idx_findings_engine ON findings(engine_name);
CREATE INDEX idx_findings_rule ON findings(rule_id);

CREATE INDEX idx_audit_timestamp ON audit_log(timestamp DESC);
CREATE INDEX idx_audit_user ON audit_log(user_id);
CREATE INDEX idx_audit_resource ON audit_log(resource_type, resource_id);
CREATE INDEX idx_audit_action ON audit_log(action);

-- Create views
CREATE VIEW validation_summary AS
SELECT 
    t.id,
    t.name,
    t.status,
    t.overall_score,
    t.quality_gate,
    t.created_at,
    COUNT(f.id) as total_findings,
    COUNT(f.id) FILTER (WHERE f.severity = 'critical') as critical_count,
    COUNT(f.id) FILTER (WHERE f.severity = 'high') as high_count,
    COUNT(f.id) FILTER (WHERE f.severity = 'medium') as medium_count
FROM validation_tasks t
LEFT JOIN findings f ON t.id = f.task_id
GROUP BY t.id, t.name, t.status, t.overall_score, t.quality_gate, t.created_at;
```

---

## Appendix C: API Specification

### C.1 OpenAPI 3.0 Specification

```yaml
openapi: 3.0.0
info:
  title: Kwality API
  version: 2.0.0
  description: AI Code Validation Platform API

servers:
  - url: https://api.kwality.dev/v2
    description: Production
  - url: https://staging-api.kwality.dev/v2
    description: Staging

security:
  - BearerAuth: []
  - ApiKeyAuth: []

paths:
  /health:
    get:
      summary: Health check
      security: []
      responses:
        '200':
          description: Service is healthy
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/HealthResponse'

  /validate/codebase:
    post:
      summary: Submit codebase for validation
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/ValidationRequest'
      responses:
        '202':
          description: Validation accepted
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationAccepted'
        '400':
          description: Invalid request
        '429':
          description: Rate limited

  /validate/{id}:
    get:
      summary: Get validation results
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: Validation results
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/ValidationResult'
        '404':
          description: Validation not found

    delete:
      summary: Cancel validation
      parameters:
        - name: id
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '204':
          description: Validation cancelled
        '409':
          description: Cannot cancel (already completed)

  /tasks:
    get:
      summary: List validation tasks
      parameters:
        - name: status
          in: query
          schema:
            type: string
        - name: limit
          in: query
          schema:
            type: integer
            default: 50
        - name: offset
          in: query
          schema:
            type: integer
            default: 0
      responses:
        '200':
          description: List of tasks
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TaskList'

  /engines:
    get:
      summary: List available engines
      responses:
        '200':
          description: List of engines
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/EngineInfo'

components:
  securitySchemes:
    BearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
    ApiKeyAuth:
      type: apiKey
      in: header
      name: X-API-Key

  schemas:
    HealthResponse:
      type: object
      properties:
        status:
          type: string
          enum: [healthy, degraded, unhealthy]
        version:
          type: string
        timestamp:
          type: string
          format: date-time
        checks:
          type: object
          additionalProperties:
            type: object
            properties:
              status:
                type: string
              response_time_ms:
                type: integer

    ValidationRequest:
      type: object
      required:
        - name
        - source
      properties:
        name:
          type: string
        source:
          type: object
          properties:
            type:
              type: string
              enum: [git, local, archive]
            repository:
              type: object
              properties:
                url:
                  type: string
                branch:
                  type: string
                commit:
                  type: string
        config:
          $ref: '#/components/schemas/ValidationConfig'
        webhooks:
          type: array
          items:
            type: object
            properties:
              url:
                type: string
              events:
                type: array
                items:
                  type: string

    ValidationConfig:
      type: object
      properties:
        enabled_engines:
          type: array
          items:
            type: string
        timeout:
          type: string
        quality_gate:
          type: object
          properties:
            min_overall_score:
              type: number
            min_security_score:
              type: number
            block_on_secrets:
              type: boolean

    ValidationAccepted:
      type: object
      properties:
        validation_id:
          type: string
          format: uuid
        status:
          type: string
        created_at:
          type: string
          format: date-time
        check_status_url:
          type: string

    ValidationResult:
      type: object
      properties:
        id:
          type: string
          format: uuid
        name:
          type: string
        status:
          type: string
        overall_score:
          type: number
        quality_gate:
          type: boolean
        started_at:
          type: string
          format: date-time
        completed_at:
          type: string
          format: date-time
        duration:
          type: string
        engine_results:
          type: object
          additionalProperties:
            $ref: '#/components/schemas/EngineResult'
        findings:
          type: array
          items:
            $ref: '#/components/schemas/Finding'

    EngineResult:
      type: object
      properties:
        engine:
          type: string
        status:
          type: string
        score:
          type: number
        findings:
          type: array
          items:
            $ref: '#/components/schemas/Finding'
        metrics:
          type: object

    Finding:
      type: object
      properties:
        id:
          type: string
        severity:
          type: string
          enum: [critical, high, medium, low, info]
        title:
          type: string
        description:
          type: string
        file:
          type: string
        line:
          type: integer
        column:
          type: integer
        remediation:
          type: string

    TaskList:
      type: object
      properties:
        tasks:
          type: array
          items:
            type: object
        total:
          type: integer
        limit:
          type: integer
        offset:
          type: integer

    EngineInfo:
      type: object
      properties:
        name:
          type: string
        version:
          type: string
        supported_languages:
          type: array
          items:
            type: string
        description:
          type: string
```

---

## Appendix D: Troubleshooting Guide

### D.1 Common Issues

**Issue: Validation timeout**
- Symptom: Task status shows "failed" with timeout error
- Cause: Codebase too large or infinite loop in runtime tests
- Solution: Increase timeout in config or reduce scope

**Issue: Container startup failure**
- Symptom: Runtime validation fails immediately
- Cause: Docker not running or insufficient permissions
- Solution: Check Docker daemon, add user to docker group

**Issue: Database connection errors**
- Symptom: API returns 500 with database errors
- Cause: PostgreSQL not accessible or credentials wrong
- Solution: Verify DB_HOST, DB_PORT, DB_PASSWORD env vars

**Issue: High memory usage**
- Symptom: OOM killer terminates processes
- Cause: Too many concurrent validations or memory leak
- Solution: Reduce worker count, add memory limits

**Issue: False positive rate too high**
- Symptom: Many reported issues are not real
- Cause: Overly sensitive rules or misconfiguration
- Solution: Tune rule severity, add exclusions

### D.2 Debug Mode

Enable debug logging:
```bash
export KWALITY_LOG_LEVEL=debug
kwality server
```

Enable profiling:
```bash
export KWALITY_PPROF_ENABLED=true
export KWALITY_PPROF_PORT=6060
go tool pprof http://localhost:6060/debug/pprof/heap
```

### D.3 Support Channels

- Documentation: https://docs.kwality.dev
- GitHub Issues: https://github.com/KooshaPari/kwality/issues
- Discord: https://discord.gg/kwality
- Enterprise Support: enterprise@kwality.dev

---

## Document Information

**Version**: 2.0  
**Last Updated**: April 2026  
**Author**: Kwality Architecture Team  
**Review Cycle**: Quarterly  

**Contributing**: All contributions must align with the tenets defined at the beginning of this document.

---

*End of SPEC.md*
