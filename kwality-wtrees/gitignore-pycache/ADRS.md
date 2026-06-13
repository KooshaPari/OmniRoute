# Architecture Decision Records (ADRs)

## ADR-001: Go + Rust Hybrid Architecture for Validation Platform

**Status**: Accepted  
**Date**: 2024-01-15  
**Deciders**: Kwality Architecture Team  
**Consulted**: Security Team, Performance Team, DevOps Team  
**Informed**: All Engineering Teams  

### Context

Kwality requires a validation platform capable of high-throughput static analysis, secure runtime execution, and multi-dimensional security scanning. The platform must handle:
- 1000+ file static analysis per minute
- Containerized code execution with strict isolation
- Multi-language support (Go, Rust, Python, JavaScript, Java)
- Sub-100ms API response times

Single-language approaches were evaluated but failed to meet all requirements.

### Decision

We will use a **hybrid Go/Rust architecture**:
- **Go (70% of codebase)**: Orchestration, static analysis, API layer, database interaction
- **Rust (30% of codebase)**: Runtime validation, security-critical components, performance-sensitive parsers

### Rationale

#### Why Go for Orchestration

1. **Goroutines for Concurrency**: Native concurrency model ideal for orchestrating multiple validation engines in parallel
2. **Ecosystem Maturity**: Excellent libraries for:
   - Web frameworks (Gin, Echo)
   - Database access (GORM, sqlx)
   - CLI tools (Cobra, Viper)
   - Cloud infrastructure (AWS SDK, Kubernetes client)
3. **Build Speed**: Fast compilation supports rapid iteration
4. **Deployment**: Single static binary simplifies deployment
5. **Team Expertise**: Strong Go expertise in organization

#### Why Rust for Runtime Validation

1. **Memory Safety**: Eliminates entire classes of vulnerabilities in code execution environment
2. **Zero-Cost Abstractions**: High-level code with C-level performance
3. **FFI Capabilities**: Safe interoperability with C libraries for sandboxing
4. **Container Runtime**: Native support for low-level system interactions
5. **Security**: No garbage collection means predictable resource usage for sandboxing

#### Language Boundary

```
┌─────────────────────────────────────────────────────────────┐
│                    Orchestration Layer (Go)                 │
│  ├── API Server (Gin)                                       │
│  ├── Task Queue Manager                                     │
│  ├── Static Analysis Coordinator                            │
│  └── Database/Cache Layer                                   │
└──────────────────────┬──────────────────────────────────────┘
                       │ gRPC
┌──────────────────────▼──────────────────────────────────────┐
│                  Runtime Engine (Rust)                      │
│  ├── Container Manager                                      │
│  ├── seccomp-bpf Integration                                │
│  ├── Fuzzing Engine                                         │
│  └── Performance Profiler                                   │
└─────────────────────────────────────────────────────────────┘
```

### Consequences

#### Positive

- **Security**: Rust eliminates memory safety vulnerabilities in the execution engine
- **Performance**: Go's goroutines handle thousands of concurrent validations
- **Maintainability**: Clear separation of concerns between orchestration and execution
- **Observability**: Both languages have excellent OpenTelemetry support

#### Negative

- **Complexity**: Two build systems, two package managers, two deployment artifacts
- **Cross-Language Debugging**: Harder to trace issues across Go/Rust boundary
- **Team Split**: Requires expertise in both languages
- **Build Time**: Sequential builds (Go then Rust) increase CI time

#### Mitigations

- **Interface Definition**: Strict gRPC API contracts prevent drift
- **Shared Types**: Protocol Buffers for all cross-boundary communication
- **Containerized Builds**: Consistent build environment via Docker
- **Documentation**: Comprehensive cross-language debugging guides

### Alternatives Considered

#### Alternative 1: Pure Go

**Pros**: Single language, faster development, unified tooling  
**Cons**: Runtime validation requires unsafe code (cgo) for low-level operations, garbage collection pauses problematic for real-time sandboxing

**Rejected**: Security requirements for runtime engine cannot be met safely in Go alone.

#### Alternative 2: Pure Rust

**Pros**: Maximum safety, single toolchain, excellent performance  
**Cons**: Slower development velocity, smaller ecosystem for web/API layer, harder to hire for

**Rejected**: Development speed and ecosystem maturity for API layer inferior to Go.

#### Alternative 3: Go + Python

**Pros**: Python's data science libraries for ML-based validation  
**Cons**: Python's performance and packaging complexity, GIL limits concurrency

**Rejected**: Python's runtime overhead unacceptable for high-throughput validation.

### Implementation Notes

**gRPC Interface**:
```protobuf
service RuntimeEngine {
  rpc ExecuteValidation(ValidationRequest) returns (ValidationResponse);
  rpc StreamLogs(StreamRequest) returns (stream LogEntry);
  rpc HealthCheck(HealthRequest) returns (HealthResponse);
}
```

**Build Process**:
1. Compile Rust runtime engine: `cargo build --release`
2. Copy binary to Go embed location
3. Build Go orchestrator: `go build`
4. Single binary includes both components

### Related Decisions

- ADR-002: Container-based Isolation Strategy
- ADR-003: gRPC for Inter-Service Communication

### References

- [Rust FFI Safety](https://doc.rust-lang.org/nomicon/ffi.html)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [gRPC Performance](https://grpc.io/docs/guides/performance/)

---

## ADR-002: Container-based Isolation with gVisor for Runtime Validation

**Status**: Accepted  
**Date**: 2024-02-01  
**Deciders**: Security Team, Architecture Team  
**Consulted**: DevOps Team, Performance Team  
**Informed**: All Engineering Teams  

### Context

Runtime validation requires executing AI-generated code with unknown properties. Security requirements:
- No network access during validation
- Strict CPU/memory/disk limits
- Protection against container escape
- Defense against kernel exploitation
- Complete cleanup after execution

Traditional Docker containers provide insufficient isolation for untrusted code.

### Decision

We will use **gVisor** as the primary runtime isolation mechanism with **seccomp-bpf** syscall filtering.

**Architecture**:
```
┌──────────────────────────────────────────┐
│          Kwality Runtime Engine          │
├──────────────────────────────────────────┤
│  gVisor Sentry (Userspace Kernel)        │
│  ├── Platform Syscall Interception       │
│  ├── Gofer (Filesystem Proxy)            │
│  └── Network Stack                       │
├──────────────────────────────────────────┤
│  OCI Runtime (runsc)                     │
├──────────────────────────────────────────┤
│  Containerd Integration                  │
└──────────────────────────────────────────┘
```

### Rationale

#### Why gVisor Over Alternatives

1. **Security Posture**: Two-layer defense
   - Sentry: Userspace kernel implements Linux syscall interface
   - Platform: Limited syscall exposure to host kernel

2. **Compatibility**: Runs unmodified Linux binaries
   - No changes to validation containers needed
   - Standard OCI container format

3. **Performance**: Acceptable overhead for our use case
   - 20-50% overhead vs native (acceptable for validation)
   - Syscall-intensive workloads slower, but our workload is CPU-bound analysis

4. **Resource Limits**: Native integration with cgroups
   - CPU quotas
   - Memory limits with OOM handling
   - Disk quotas via tmpfs
   - Network namespace isolation

#### Syseccomp-bpf Integration

Additional filtering on top of gVisor:
- Whitelist approach: Only allow known-safe syscalls
- 90% of validation code needs <20 syscalls
- Blocks even within gVisor for defense in depth

### Consequences

#### Positive

- **Security**: Defense in depth with two isolation layers
- **Compatibility**: No changes to validation containers
- **Observability**: gVisor provides detailed syscall logs
- **Compliance**: Isolation meets SOC 2, ISO 27001 requirements

#### Negative

- **Performance**: 20-50% overhead vs native containers
- **Complexity**: Additional runtime to manage
- **Compatibility Edge Cases**: Some syscalls not fully implemented
- **Resource Usage**: Sentry requires additional memory

#### Mitigations

- **Benchmarking**: Continuous performance monitoring
- **Fallback**: Native containers for trusted code (optional)
- **Pre-warming**: Pool of warm gVisor containers
- **Monitoring**: Alert on compatibility issues

### Alternatives Considered

#### Alternative 1: Native Docker

**Pros**: Fastest performance, simplest setup  
**Cons**: Insufficient isolation for untrusted code, known container escape vulnerabilities

**Rejected**: Security requirements mandate stronger isolation.

#### Alternative 2: Kata Containers

**Pros**: VM-level isolation, strong security boundary  
**Cons**: Higher overhead (3s startup), more resource usage

**Rejected**: Startup time too slow for per-validation isolation.

#### Alternative 3: Firecracker

**Pros**: Fast microVM startup (125ms), AWS proven  
**Cons**: Requires VM image management, more complex integration

**Partially Adopted**: Firecracker used for specific high-risk scenarios, gVisor as default.

#### Alternative 4: WebAssembly (Wasmtime)

**Pros**: Capability-based security, deterministic execution  
**Cons**: Limited language support, requires code recompilation

**Future Consideration**: Evaluating for v2.0.

### Implementation Details

**gVisor Configuration**:
```json
{
  "runsc_config": {
    "platform": "systrap",
    "network": "none",
    "debug": false,
    "debug-log": "/var/log/runsc/",
    "file-access": "exclusive",
    "overlay": true
  }
}
```

**Resource Limits**:
- CPU: 1 core (configurable)
- Memory: 512MB default, 2GB max
- Disk: 10GB tmpfs
- Network: None (isolated)

**Security Profile**:
```yaml
seccomp:
  defaultAction: SCMP_ACT_ERRNO
  syscalls:
    - action: SCMP_ACT_ALLOW
      names:
        - read
        - write
        - open
        - close
        - exit
        - exit_group
        # ... 17 more
```

### Related Decisions

- ADR-001: Go + Rust Hybrid Architecture
- ADR-003: Resource Limits and Timeouts

### References

- [gVisor Architecture](https://gvisor.dev/docs/architecture_guide/)
- [Container Security](https://cloud.google.com/container-security)
- [seccomp-bpf](https://www.kernel.org/doc/Documentation/prctl/seccomp_filter.txt)

---

## ADR-003: Multi-Engine Validation Pipeline with Parallel Execution

**Status**: Accepted  
**Date**: 2024-02-15  
**Deciders**: Architecture Team, Performance Team  
**Consulted**: Security Team, ML Team  
**Informed**: All Engineering Teams  

### Context

AI-generated code requires validation across multiple dimensions:
- Static analysis (syntax, quality, dependencies)
- Security scanning (vulnerabilities, secrets, compliance)
- Runtime validation (execution, performance, fuzzing)
- Integration testing (APIs, contracts, E2E)

Sequential execution is too slow. Naive parallel execution wastes resources. We need intelligent orchestration.

### Decision

We will implement a **multi-engine validation pipeline** with:
1. **Phase-based execution**: Each engine type runs in parallel within phases
2. **Dependency graph**: Engines declare dependencies, pipeline respects ordering
3. **Result correlation**: Cross-engine findings are correlated and deduplicated
4. **Early termination**: Critical failures stop dependent engines

### Pipeline Architecture

```
Phase 1: Ingestion
├── Language Detection
├── Dependency Resolution
└── Pre-flight Checks

Phase 2: Static Analysis (Parallel)
├── AST Parser
├── Linter (per-language)
├── Dependency Scanner
└── Complexity Analyzer

Phase 3: Security Scanning (Parallel)
├── SAST Scanner
├── Secrets Detector
├── Vulnerability Checker
└── Compliance Validator

Phase 4: Runtime Validation (Parallel, gated)
├── Containerized Execution
├── Performance Profiler
├── Fuzzing Engine
└── Memory Analyzer

Phase 5: Integration Testing (Optional)
├── API Validator
├── Contract Tester
└── E2E Runner

Phase 6: Aggregation
├── Result Correlation
├── Score Calculation
├── Quality Gate Evaluation
└── Report Generation
```

### Rationale

#### Why Phase-Based

1. **Resource Optimization**: Static analysis (CPU) can run alongside security scanning (I/O)
2. **Dependency Management**: Runtime tests need static analysis results for coverage guidance
3. **Early Failure**: Critical security issues stop pipeline before expensive runtime tests
4. **Observability**: Clear pipeline stages for monitoring and debugging

#### Why Parallel Within Phases

1. **Speed**: 4-6x faster than sequential for typical validation
2. **Resource Utilization**: Multiple cores used effectively
3. **Independent Results**: No cross-engine dependencies within phases

#### Why Result Correlation

1. **Noise Reduction**: Same issue found by multiple engines → single finding
2. **Confidence Scoring**: Multiple engines agreeing → higher confidence
3. **Comprehensive Context**: Static + runtime findings provide complete picture

### Consequences

#### Positive

- **Performance**: Sub-5 minute validation for most projects
- **Thoroughness**: No single point of failure in validation
- **Flexibility**: Engines can be added/removed without pipeline changes
- **Intelligence**: Cross-engine correlation improves accuracy

#### Negative

- **Complexity**: Pipeline orchestration is complex
- **Resource Spikes**: Parallel execution requires burst capacity
- **Debugging**: Harder to trace failures across parallel engines
- **Ordering Dependencies**: Incorrect ordering causes failures

#### Mitigations

- **Circuit Breakers**: Failed engines don't block others
- **Timeouts**: Per-engine and per-phase timeouts
- **Retry Logic**: Exponential backoff for transient failures
- **Dry Runs**: Test pipeline changes without real execution

### Engine Interface

All engines implement:
```go
type ValidationEngine interface {
    Name() string
    SupportedLanguages() []string
    
    // Execution
    Validate(ctx context.Context, input *EngineInput) (*EngineResult, error)
    
    // Metadata
    GetDefaultConfig() map[string]interface{}
    EstimatedDuration(input *EngineInput) time.Duration
    
    // Dependencies
    Dependencies() []string  // Names of engines that must complete first
    Provides() []string      // Data types this engine produces
}
```

### Pipeline Configuration

```yaml
pipeline:
  phases:
    - name: static_analysis
      engines:
        - ast_parser
        - go_linter
        - rust_clippy
        - dependency_scanner
      parallel: true
      timeout: 2m
      
    - name: security_scanning
      engines:
        - semgrep
        - secrets_scanner
        - vulnerability_checker
      parallel: true
      timeout: 3m
      
    - name: runtime_validation
      engines:
        - container_runner
        - fuzzer
      parallel: true
      timeout: 10m
      requires:
        - static_analysis  # Must complete first
```

### Result Correlation

```go
type CorrelatedFinding struct {
    // Unique identifier
    ID string
    
    // Location
    File string
    Line int
    Column int
    
    // Description
    Title string
    Description string
    Severity Severity
    
    // Sources
    Sources []EngineFinding  // Raw findings from each engine
    
    // Confidence
    Confidence float64  // 0.0-1.0 based on agreement
    
    // Remediation
    Remediation string
}
```

### Alternatives Considered

#### Alternative 1: Sequential Execution

**Pros**: Simple to implement, easy to debug  
**Cons**: 15-30 minute validation times, unacceptable for CI/CD

**Rejected**: Performance requirements mandate parallelism.

#### Alternative 2: Fully Parallel (No Phases)

**Pros**: Maximum speed  
**Cons**: Resource contention, dependency violations, harder to reason about

**Rejected**: Dependencies between engines require some ordering.

#### Alternative 3: Event-Driven (CQRS)

**Pros**: Decoupled, scalable, resilient  
**Cons**: More complex, eventual consistency challenges

**Partially Adopted**: Internal message bus for engine communication, but synchronous pipeline for simplicity.

### Performance Benchmarks

| Project Size | Sequential | Parallel Pipeline | Speedup |
|--------------|------------|-------------------|---------|
| Small (<1K)  | 8 min      | 2 min             | 4x      |
| Medium (1-10K)| 20 min    | 5 min             | 4x      |
| Large (10K+) | 45 min     | 12 min            | 3.75x   |

### Related Decisions

- ADR-001: Go + Rust Hybrid Architecture
- ADR-002: Container-based Isolation

### References

- [Pipeline Architecture Patterns](https://docs.microsoft.com/en-us/azure/architecture/patterns/pipes-and-filters)
- [Go Concurrency Patterns](https://go.dev/blog/pipelines)
- [Prometheus Query Parallelism](https://prometheus.io/docs/prometheus/latest/querying/)

---

## ADR Index

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| 001 | Go + Rust Hybrid Architecture | Accepted | 2024-01-15 |
| 002 | Container-based Isolation with gVisor | Accepted | 2024-02-01 |
| 003 | Multi-Engine Validation Pipeline | Accepted | 2024-02-15 |

---

*All contributions must align with the tenets defined in CHARTER.md.*
