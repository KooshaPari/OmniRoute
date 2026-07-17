# Phenotype Forge Technical Specification

> High-Performance CLI Task Runner and Build Orchestrator

**Version**: 1.0  
**Status**: Draft  
**Last Updated**: 2026-04-04  
**Target Release**: 2026-Q2  

---

## Document Information

### Version History

| Version | Date | Author | Changes |
|---------|------|--------|---------|
| 0.1 | 2026-04-02 | Initial | 50-line stub |
| 1.0 | 2026-04-04 | phenoForge Team | Complete specification |

### Related Documents

- [SOTA_RESEARCH.md](./SOTA_RESEARCH.md) - State of the Art Research
- [docs/architecture/ADRs/](./docs/architecture/ADRs/) - Architecture Decision Records
- [PRD.md](./PRD.md) - Product Requirements Document
- [FUNCTIONAL_REQUIREMENTS.md](./FUNCTIONAL_REQUIREMENTS.md) - Functional Requirements

### Approvers

| Role | Name | Date |
|------|------|------|
| Technical Lead | TBD | - |
| Product Manager | TBD | - |
| Architecture Review | TBD | - |

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Scope and Objectives](#scope-and-objectives)
3. [System Overview](#system-overview)
4. [Architecture](#architecture)
5. [Task System](#task-system)
6. [Dependency Graph](#dependency-graph)
7. [Execution Engine](#execution-engine)
8. [Caching System](#caching-system)
9. [File Watching](#file-watching)
10. [Plugin System](#plugin-system)
11. [Remote Execution](#remote-execution)
12. [Configuration](#configuration)
13. [CLI Interface](#cli-interface)
14. [Observability](#observability)
15. [Performance](#performance)
16. [Security](#security)
17. [Testing Strategy](#testing-strategy)
18. [Deployment](#deployment)
19. [Roadmap](#roadmap)
20. [Glossary](#glossary)

---

## Executive Summary

Phenotype Forge (phenoForge) is a high-performance CLI task runner and build orchestrator for the Phenotype ecosystem. Built in Rust, it provides parallel task execution with automatic topological dependency resolution, incremental builds with intelligent caching, file-watching hot reload, and an extensible plugin system.

### Value Proposition

| Pain Point | Current Solutions | phenoForge Solution |
|------------|-------------------|---------------------|
| Slow builds | Make, shell scripts | Parallel execution, intelligent caching |
| Complex configuration | Bazel, CMake | Rust macro DSL, type-safe configs |
| No dependency tracking | Just, scripts | Automatic DAG resolution |
| CI inefficiency | Full rebuilds | Incremental builds, remote cache |
| Poor observability | Manual logging | Structured tracing, progress reporting |

### Key Differentiators

1. **Rust-Native**: Type-safe task definitions with compile-time validation
2. **Performance**: <50ms cold start, efficient parallel execution
3. **Intelligence**: xxHash-based incremental builds with tiered caching
4. **Ergonomics**: Simple macros, excellent error messages, full IDE support
5. **Extensibility**: WASM plugins, remote execution, Phenotype ecosystem integration

### Success Metrics

| Metric | Target | Measurement Method |
|--------|--------|---------------------|
| Cold start | <50ms | `time forge --help` |
| No-op build | <100ms | `forge build` with cache |
| Cache hit retrieval | <100ms | Benchmark suite |
| New user setup | <5 minutes | User testing |
| Task definition | <10 lines | Typical task example |
| Community adoption | 100+ stars | GitHub metrics |

---

## Scope and Objectives

### In Scope

1. **Task Definition**: Macro-based task DSL in Rust
2. **Dependency Management**: Automatic DAG construction and validation
3. **Parallel Execution**: Async task scheduling with Tokio
4. **Incremental Builds**: xxHash-based content-addressable caching
5. **File Watching**: Hot reload with debouncing
6. **CLI Interface**: Complete command-line experience
7. **Configuration**: TOML-based project configuration
8. **Observability**: Tracing, logging, progress reporting
9. **Plugin System**: WASM-based extensibility
10. **Remote Execution**: Distributed task execution (Phase 2)

### Out of Scope (Future Phases)

1. GUI interface
2. Language servers for non-Rust languages
3. Cloud-hosted build service
4. Package management (use Cargo)
5. IDE plugins (separate projects)

### Constraints

1. **Language**: Rust (Edition 2021+)
2. **Platform**: Linux, macOS, Windows
3. **Rust Version**: Latest stable
4. **Binary Size**: <50MB uncompressed
5. **Dependencies**: Minimal external crates

---

## System Overview

### Design Philosophy

**Build tools should be fast, reliable, and delightful to use.**

Our guiding principles:

1. **Speed**: Every millisecond counts. Optimize for developer iteration cycles.
2. **Correctness**: Deterministic builds, proper dependency tracking, no surprises.
3. **Ergonomics**: Simple for simple cases, powerful for complex ones.
4. **Extensibility**: Grow with user needs without configuration complexity.
5. **Observability**: Clear progress, actionable errors, insightful metrics.

### System Context

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              User/Developer                                  │
└─────────────────────────────────┬───────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           phenoForge CLI                                     │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         CLI Parser (clap)                             │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│  ┌─────────────────────────────────┼────────────────────────────────────────┐ │
│  │                    Core Engine                                          │ │
│  │                                                                         │ │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │ │
│  │   │   Parser     │  │   Graph      │  │  Scheduler   │  │  Executor │ │ │
│  │   │   (Macros)   │──│   (DAG)      │──│  (Tokio)     │──│  (Tasks)  │ │ │
│  │   └──────────────┘  └──────────────┘  └──────────────┘  └───────────┘ │ │
│  │                           │                                           │ │
│  │   ┌──────────────┐  ┌────┴──────────┐  ┌──────────────┐              │ │
│  │   │   Cache      │  │   File Watch    │  │   Plugins    │              │ │
│  │   │   (xxHash)   │  │   (notify)     │  │   (WASM)     │              │ │
│  │   └──────────────┘  └─────────────────┘  └──────────────┘              │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                    │                                        │
│  ┌─────────────────────────────────┼────────────────────────────────────────┐ │
│  │                    Observability Layer                                  │ │
│  │                                                                         │ │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                  │ │
│  │   │   Tracing    │  │   Logging    │  │   Metrics    │                  │ │
│  │   │   (OpenTel)  │  │   (structured)│  │   (prometheus)│                 │ │
│  │   └──────────────┘  └──────────────┘  └──────────────┘                  │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           External Systems                                   │
│                                                                              │
│   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  │
│   │   Filesystem │  │   Processes  │  │   Network    │  │   Remote     │  │
│   │              │  │   (Commands) │  │   (Cache)    │  │   Workers    │  │
│   └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Component Overview

| Component | Responsibility | Technology |
|-----------|---------------|------------|
| CLI Parser | Command-line argument parsing | clap |
| Macro System | Task definition DSL | proc-macro2, quote, syn |
| Task Graph | DAG construction, cycle detection | petgraph |
| Scheduler | Task ordering, parallelism | Tokio runtime |
| Executor | Task execution, subprocess management | tokio::process |
| Cache | Content-addressable storage | xxHash, sled/rocksdb |
| File Watcher | Hot reload, change detection | notify |
| Plugin System | WASM extensibility | wasmtime |
| Observability | Tracing, logging, metrics | tracing, opentelemetry |

### Data Flow

```
User Input (CLI)
      │
      ▼
┌──────────────────┐
│   Parse Args     │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│   Load Config    │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│  Build Task Graph│
│  (from macros)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Validate Graph   │
│ (cycle detect)   │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Topological Sort │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Schedule Tasks   │
│ (parallel exec)  │
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ Report Results   │
└──────────────────┘
```

---

## Architecture

### Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Presentation Layer                              │
│  - CLI commands and arguments                                                │
│  - Progress reporting and UI                                                │
│  - Error formatting and display                                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Application Layer                               │
│  - Task orchestration logic                                                  │
│  - Use case coordination                                                     │
│  - Workflow management                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Domain Layer                                      │
│  - Task definitions and traits                                               │
│  - Dependency graph model                                                    │
│  - Execution semantics                                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                              Infrastructure Layer                              │
│  - File system operations                                                    │
│  - Process management                                                         │
│  - Network communication                                                      │
│  - Caching and persistence                                                  │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Module Structure

```
src/
├── main.rs              # CLI entry point
├── lib.rs               # Library exports
├── cli/                 # CLI layer
│   ├── mod.rs
│   ├── args.rs          # Argument definitions
│   ├── commands.rs      # Command handlers
│   └── output.rs        # Output formatting
├── core/                # Core engine
│   ├── mod.rs
│   ├── task.rs          # Task trait and types
│   ├── graph.rs         # Dependency graph
│   ├── scheduler.rs     # Task scheduling
│   └── executor.rs      # Task execution
├── macros/              # Procedural macros
│   ├── lib.rs           # Macro crate entry
│   ├── task.rs          # #[task] macro
│   └── deps.rs          # #[deps] macro
├── cache/               # Caching system
│   ├── mod.rs
│   ├── store.rs         # Cache storage
│   ├── hash.rs          # Content hashing
│   └── remote.rs        # Remote cache client
├── watch/               # File watching
│   ├── mod.rs
│   ├── watcher.rs       # File system watcher
│   └── debouncer.rs     # Event debouncing
├── plugin/              # Plugin system
│   ├── mod.rs
│   ├── loader.rs        # WASM loader
│   └── runtime.rs       # WASM runtime
├── config/              # Configuration
│   ├── mod.rs
│   ├── loader.rs        # Config file loading
│   └── types.rs         # Config data types
├── error/               # Error handling
│   ├── mod.rs
│   └── types.rs         # Error definitions
└── observability/       # Tracing and metrics
    ├── mod.rs
    ├── tracing.rs
    └── metrics.rs
```

### Key Abstractions

#### Task Trait

```rust
/// Core task abstraction
#[async_trait]
pub trait Task: Send + Sync + 'static {
    /// Unique task identifier
    fn id(&self) -> TaskId;
    
    /// Task name for display
    fn name(&self) -> &str;
    
    /// Task dependencies
    fn dependencies(&self) -> &[TaskId];
    
    /// Execute the task
    async fn execute(&self, ctx: &TaskContext) -> TaskResult;
    
    /// Task cache configuration
    fn cache_config(&self) -> Option<CacheConfig> {
        None
    }
    
    /// Timeout for this task
    fn timeout(&self) -> Duration {
        Duration::from_secs(300)
    }
}
```

#### Task Graph

```rust
/// Directed Acyclic Graph of tasks
pub struct TaskGraph {
    tasks: HashMap<TaskId, Box<dyn Task>>,
    edges: HashMap<TaskId, Vec<TaskId>>, // task -> dependencies
}

impl TaskGraph {
    /// Add a task to the graph
    pub fn add_task(&mut self, task: Box<dyn Task>) -> Result<(), GraphError>;
    
    /// Get tasks in topological order
    pub fn topological_order(&self) -> Result<Vec<TaskId>, CycleError>;
    
    /// Get tasks at a specific depth level
    pub fn tasks_at_level(&self, level: usize) -> Vec<TaskId>;
    
    /// Detect cycles in the graph
    pub fn detect_cycles(&self) -> Option<Vec<TaskId>>;
    
    /// Get all transitive dependencies
    pub fn transitive_deps(&self, task: TaskId) -> HashSet<TaskId>;
}
```

#### Cache Interface

```rust
/// Content-addressable cache
#[async_trait]
pub trait Cache: Send + Sync {
    /// Look up a cached result
    async fn get(&self, key: CacheKey) -> Result<Option<CacheEntry>, CacheError>;
    
    /// Store a result in cache
    async fn put(&self, key: CacheKey, entry: CacheEntry) -> Result<(), CacheError>;
    
    /// Check if key exists (without retrieving)
    async fn exists(&self, key: CacheKey) -> Result<bool, CacheError>;
    
    /// Invalidate a cache entry
    async fn invalidate(&self, key: CacheKey) -> Result<(), CacheError>;
}
```

---

## Task System

### Task Definition

Tasks are defined using procedural macros:

```rust
use pheno_forge::prelude::*;

/// Basic task
#[task]
fn clean() -> TaskResult {
    fs::remove_dir_all("./target").ok();
    TaskResult::ok()
}

/// Task with dependencies
#[task]
#[deps(compile)]
fn test() -> TaskResult {
    sh!("cargo test").run()
}

/// Task with multiple dependencies
#[task]
#[deps(test, lint)]
fn check() -> TaskResult {
    TaskResult::ok()
}

/// Caching task
#[task]
#[deps(clean)]
#[cache]
fn build() -> TaskResult {
    let output = sh!("cargo build --release").output()?;
    TaskResult::ok()
        .with_output("./target/release/myapp")
}

/// Task with environment
#[task]
#[env(RUST_LOG = "debug", RUST_BACKTRACE = "1")]
fn debug_build() -> TaskResult {
    sh!("cargo build").run()
}

/// Remote execution task
#[task]
#[remote]
fn heavy_computation() -> TaskResult {
    // Automatically distributed to remote workers
    compute()
}

/// Task with shell script
#[task]
#[shell(r#"
    echo "Building..."
    cargo build --release
    echo "Running tests..."
    cargo test
    echo "Done!"
"#)]
fn full_pipeline() {}
```

### Task Attributes

| Attribute | Description | Example |
|-----------|-------------|---------|
| `#[task]` | Mark function as a task | `#[task]` |
| `#[deps(...)]` | Declare dependencies | `#[deps(build, lint)]` |
| `#[cache]` | Enable output caching | `#[cache]` |
| `#[cache(ttl = "1h")]` | Cache with TTL | `#[cache(ttl = "24h")]` |
| `#[remote]` | Allow remote execution | `#[remote]` |
| `#[env(KEY = "value")]` | Set environment variables | `#[env(DEBUG = "1")]` |
| `#[cwd("path")]` | Set working directory | `#[cwd("./server")]` |
| `#[timeout("5m")]` | Task timeout | `#[timeout("10m")]` |
| `#[shell("...")]` | Shell script task | `#[shell("echo hi")]` |
| `#[doc = "..."]` | Task description | Standard Rust doc comment |

### Task Types

#### 1. Command Tasks

Execute shell commands with error handling:

```rust
#[task]
fn build() -> TaskResult {
    // Simple command
    cmd!("cargo", "build", "--release").run()?;
    
    // With environment
    cmd!("npm", "run", "build")
        .env("NODE_ENV", "production")
        .cwd("./frontend")
        .run()?;
    
    // With output capture
    let output = cmd!("git", "rev-parse", "HEAD")
        .output()?;
    
    TaskResult::ok()
        .with_output_string(output.stdout)
}
```

#### 2. Closure Tasks

Pure Rust code:

```rust
#[task]
fn generate_schema() -> TaskResult {
    let schema = generate_openapi_spec()?;
    fs::write("./schema.json", schema)?;
    TaskResult::ok()
        .with_output("./schema.json")
}
```

#### 3. Shell Tasks

Inline shell scripts:

```rust
#[task]
#[shell(r#"
    set -e
    echo "Starting build..."
    cargo build --release
    echo "Build complete!"
"#)]
fn build_with_logging() {}
```

#### 4. WASM Plugin Tasks

Execute WASM modules:

```rust
#[task]
#[plugin(path = "./plugins/custom.wasm")]
fn custom_operation() {}
```

### Task Context

Tasks receive context for introspection:

```rust
#[task]
async fn context_aware(ctx: &TaskContext) -> TaskResult {
    // Access project root
    let root = ctx.project_root();
    
    // Access configuration
    let config = ctx.config();
    
    // Check if running in CI
    let is_ci = ctx.is_ci();
    
    // Access previous results
    let deps = ctx.dependencies_results();
    
    // Progress reporting
    ctx.report_progress(0.5, "Halfway done");
    
    TaskResult::ok()
}
```

### Task Results

```rust
pub enum TaskResult {
    /// Task succeeded
    Ok {
        outputs: Vec<PathBuf>,
        metadata: HashMap<String, String>,
    },
    
    /// Task failed
    Err {
        error: TaskError,
        partial_outputs: Vec<PathBuf>,
    },
    
    /// Task was skipped (cached)
    Cached(CacheKey),
    
    /// Task was cancelled
    Cancelled,
}
```

---

## Dependency Graph

### Graph Construction

The dependency graph is built at compile time from macro expansions:

```rust
// User writes:
#[task]
#[deps(build)]
fn test() {}

// Macro generates:
const __TASK_TEST: StaticTask = StaticTask {
    name: "test",
    dependencies: &["build"],
    handler: __test_handler,
    // ...
};

// Registration:
inventory::submit! {
    TaskRegistration { name: "test", def: &__TASK_TEST }
}
```

At runtime:

```rust
pub fn build_graph() -> TaskGraph {
    let mut graph = TaskGraph::new();
    
    // Collect all registered tasks
    for registration in inventory::iter::<TaskRegistration> {
        graph.add_task(registration.def.to_task())?;
    }
    
    // Validate graph
    if let Some(cycle) = graph.detect_cycles() {
        panic!("Dependency cycle detected: {:?}", cycle);
    }
    
    Ok(graph)
}
```

### Cycle Detection

Uses depth-first search with coloring:

```rust
fn detect_cycles(graph: &TaskGraph) -> Option<Vec<TaskId>> {
    enum Color { White, Gray, Black }
    
    let mut colors: HashMap<TaskId, Color> = 
        graph.tasks.keys().map(|k| (k.clone(), Color::White)).collect();
    
    fn dfs(
        task: TaskId,
        graph: &TaskGraph,
        colors: &mut HashMap<TaskId, Color>,
        path: &mut Vec<TaskId>,
    ) -> Option<Vec<TaskId>> {
        colors.insert(task.clone(), Color::Gray);
        path.push(task.clone());
        
        for dep in graph.dependencies_of(&task) {
            match colors.get(dep) {
                Some(Color::Gray) => {
                    // Cycle found!
                    let cycle_start = path.iter().position(|t| t == dep).unwrap();
                    return Some(path[cycle_start..].to_vec());
                }
                Some(Color::White) => {
                    if let Some(cycle) = dfs(dep.clone(), graph, colors, path) {
                        return Some(cycle);
                    }
                }
                _ => {}
            }
        }
        
        path.pop();
        colors.insert(task, Color::Black);
        None
    }
    
    for task in graph.tasks.keys() {
        if colors.get(task) == Some(&Color::White) {
            let mut path = Vec::new();
            if let Some(cycle) = dfs(task.clone(), graph, &mut colors, &mut path) {
                return Some(cycle);
            }
        }
    }
    
    None
}
```

### Topological Sort

Kahn's algorithm for parallel scheduling:

```rust
fn topological_sort(graph: &TaskGraph) -> Vec<Vec<TaskId>> {
    // Compute in-degrees
    let mut in_degree: HashMap<TaskId, usize> = HashMap::new();
    for task in graph.tasks.keys() {
        in_degree.insert(task.clone(), graph.dependencies_of(task).count());
    }
    
    let mut levels: Vec<Vec<TaskId>> = Vec::new();
    let mut completed: HashSet<TaskId> = HashSet::new();
    
    while completed.len() < graph.tasks.len() {
        // Find all tasks with no incomplete dependencies
        let ready: Vec<TaskId> = graph
            .tasks
            .keys()
            .filter(|t| !completed.contains(t))
            .filter(|t| {
                graph.dependencies_of(t).all(|d| completed.contains(&d))
            })
            .cloned()
            .collect();
        
        if ready.is_empty() && completed.len() < graph.tasks.len() {
            panic!("Cycle detected (should have been caught earlier)");
        }
        
        levels.push(ready.clone());
        completed.extend(ready);
    }
    
    levels
}
```

### Dynamic Dependencies

Support for conditional dependencies:

```rust
#[task]
#[deps(compile)]
#[deps(test, if = "cfg(test)")]
#[deps(lint, if = "env(CI)")]
fn build() -> TaskResult {
    // test only runs when cfg(test) is true
    // lint only runs when CI environment variable is set
    sh!("cargo build").run()
}
```

---

## Execution Engine

### Async Runtime

Tokio-based with work-stealing:

```rust
#[tokio::main]
async fn main() {
    let runtime = tokio::runtime::Builder::new_multi_thread()
        .worker_threads(num_cpus::get())
        .max_blocking_threads(512)
        .thread_stack_size(2 * 1024 * 1024) // 2MB
        .enable_all()
        .build()
        .unwrap();
    
    runtime.block_on(run_forges());
}
```

### Task Scheduler

```rust
pub struct Scheduler {
    graph: Arc<TaskGraph>,
    semaphore: Arc<Semaphore>,
    completed: Arc<DashSet<TaskId>>,
    in_progress: Arc<DashSet<TaskId>>,
}

impl Scheduler {
    pub async fn run(&self, target: TaskId) -> Result<ExecutionReport> {
        let mut set = JoinSet::new();
        
        // Start with tasks that have no dependencies
        for task in self.graph.roots() {
            self.spawn_task(&mut set, task).await?;
        }
        
        // Event loop
        while !set.is_empty() {
            match set.join_next().await {
                Some(Ok((task_id, result))) => {
                    self.completed.insert(task_id.clone());
                    
                    // Notify dependents
                    for dependent in self.graph.dependents_of(&task_id) {
                        if self.is_ready(&dependent) {
                            self.spawn_task(&mut set, dependent).await?;
                        }
                    }
                }
                Some(Err(e)) => return Err(e.into()),
                None => break,
            }
        }
        
        Ok(ExecutionReport {
            completed: self.completed.iter().map(|c| c.clone()).collect(),
        })
    }
    
    async fn spawn_task(&self, set: &mut JoinSet<(TaskId, TaskResult)>, task: TaskId) {
        let permit = self.semaphore.clone().acquire_owned().await.unwrap();
        let graph = self.graph.clone();
        let cache = self.cache.clone();
        
        set.spawn(async move {
            let _permit = permit;
            let result = execute_with_cache(graph.get(&task).unwrap(), &cache).await;
            (task, result)
        });
    }
}
```

### Subprocess Management

```rust
pub struct CommandRunner;

impl CommandRunner {
    pub async fn run(cmd: &mut Command) -> Result<CommandOutput> {
        let mut child = cmd
            .stdout(Stdio::piped())
            .stderr(Stdio::piped())
            .kill_on_drop(true)
            .spawn()?;
        
        // Stream stdout/stderr
        let stdout = child.stdout.take().unwrap();
        let stderr = child.stderr.take().unwrap();
        
        let stdout_handle = tokio::spawn(stream_output(stdout, OutputStream::Stdout));
        let stderr_handle = tokio::spawn(stream_output(stderr, OutputStream::Stderr));
        
        // Wait with timeout
        let status = tokio::time::timeout(
            Duration::from_secs(300),
            child.wait()
        ).await??;
        
        let _ = tokio::join!(stdout_handle, stderr_handle);
        
        if !status.success() {
            return Err(CommandError::ExitCode(status.code().unwrap_or(-1)));
        }
        
        Ok(CommandOutput { status })
    }
}
```

### Concurrency Control

```rust
pub struct ConcurrencyLimiter {
    cpu_semaphore: Arc<Semaphore>,
    io_semaphore: Arc<Semaphore>,
}

impl ConcurrencyLimiter {
    pub fn new(config: &ConcurrencyConfig) -> Self {
        Self {
            cpu_semaphore: Arc::new(Semaphore::new(config.max_cpu_tasks)),
            io_semaphore: Arc::new(Semaphore::new(config.max_io_tasks)),
        }
    }
    
    pub async fn acquire_cpu_permit(&self) -> SemaphorePermit<'_> {
        self.cpu_semaphore.acquire().await.unwrap()
    }
    
    pub async fn acquire_io_permit(&self) -> SemaphorePermit<'_> {
        self.io_semaphore.acquire().await.unwrap()
    }
}
```

---

## Caching System

### Cache Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Cache Lookup Flow                                   │
│                                                                              │
│   ┌───────────┐    ┌───────────┐    ┌───────────┐    ┌───────────┐         │
│   │  Compute  │───▶│  Check L1 │───▶│  Check L2 │───▶│  Check L3 │         │
│   │ Signature │    │  Memory   │    │  Local FS │    │  Remote   │         │
│   └───────────┘    └─────┬─────┘    └─────┬─────┘    └─────┬─────┘         │
│                          │                │                │               │
│                          │ Cache Hit      │ Cache Hit      │ Cache Hit    │
│                          │ (10ns)         │ (1ms)          │ (50ms)        │
│                          ▼                ▼                ▼               │
│                   ┌─────────────────────────────────────────────────┐      │
│                   │              Restore Outputs                   │      │
│                   └─────────────────────────────────────────────────┘      │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Content Hashing

Using xxHash3-128:

```rust
pub struct ContentHasher;

impl ContentHasher {
    pub fn hash_file(path: &Path) -> Result<u128> {
        let file = File::open(path)?;
        let mut reader = BufReader::new(file);
        let mut hasher = Xxh3::new();
        
        let mut buffer = [0u8; 65536];
        loop {
            let n = reader.read(&mut buffer)?;
            if n == 0 {
                break;
            }
            hasher.update(&buffer[..n]);
        }
        
        Ok(hasher.digest128())
    }
    
    pub fn hash_string(s: &str) -> u128 {
        xxh3_128(s.as_bytes())
    }
    
    pub fn hash_bytes(data: &[u8]) -> u128 {
        xxh3_128(data)
    }
}
```

### Task Signature

```rust
#[derive(Debug, Clone)]
pub struct TaskSignature {
    pub task_name_hash: u128,
    pub command_hash: u128,
    pub input_hashes: Vec<u128>,
    pub env_hash: u128,
    pub platform_hash: u128,
}

impl TaskSignature {
    pub fn compute(task: &dyn Task, inputs: &[PathBuf]) -> Result<Self> {
        Ok(Self {
            task_name_hash: hash_string(&task.name()),
            command_hash: hash_bytes(&task.command_bytes()),
            input_hashes: inputs.iter().map(|p| hash_file(p)).collect::<Result<Vec<_>>>()?,
            env_hash: hash_env(&task.env_vars()),
            platform_hash: hash_platform(),
        })
    }
    
    pub fn to_cache_key(&self) -> u128 {
        // Combine all hashes into final cache key
        let mut hasher = Xxh3::new();
        hasher.update(&self.task_name_hash.to_le_bytes());
        hasher.update(&self.command_hash.to_le_bytes());
        for hash in &self.input_hashes {
            hasher.update(&hash.to_le_bytes());
        }
        hasher.update(&self.env_hash.to_le_bytes());
        hasher.update(&self.platform_hash.to_le_bytes());
        hasher.digest128()
    }
}
```

### Cache Storage

```rust
#[async_trait]
pub trait CacheStore: Send + Sync {
    async fn get(&self, key: u128) -> Result<Option<CacheEntry>>;
    async fn put(&self, key: u128, entry: CacheEntry) -> Result<()>;
    async fn exists(&self, key: u128) -> Result<bool>;
}

// L1: In-memory (DashMap)
pub struct L1Cache {
    inner: DashMap<u128, CacheEntry>,
}

// L2: Local filesystem
pub struct L2Cache {
    root: PathBuf,
}

#[async_trait]
impl CacheStore for L2Cache {
    async fn get(&self, key: u128) -> Result<Option<CacheEntry>> {
        let path = self.key_to_path(key);
        
        if !path.exists() {
            return Ok(None);
        }
        
        let meta: CacheMetadata = serde_json::from_str(
            &fs::read_to_string(path.join("meta.json")).await?
        )?;
        
        // Copy outputs from cache
        let outputs = self.restore_outputs(&path, &meta.outputs).await?;
        
        Ok(Some(CacheEntry { meta, outputs }))
    }
    
    async fn put(&self, key: u128, entry: CacheEntry) -> Result<()> {
        let path = self.key_to_path(key);
        fs::create_dir_all(&path).await?;
        
        // Store outputs
        let outputs_dir = path.join("outputs");
        fs::create_dir_all(&outputs_dir).await?;
        
        for output in &entry.outputs {
            let dest = outputs_dir.join(output.file_name().unwrap());
            fs::copy(output, dest).await?;
        }
        
        // Store metadata
        fs::write(
            path.join("meta.json"),
            serde_json::to_string(&entry.meta)?
        ).await?;
        
        Ok(())
    }
}

// L3: Remote (S3-compatible)
pub struct L3Cache {
    client: S3Client,
    bucket: String,
}
```

### Cache Tier Manager

```rust
pub struct TieredCache {
    l1: L1Cache,
    l2: L2Cache,
    l3: Option<L3Cache>,
    metrics: Arc<CacheMetrics>,
}

impl TieredCache {
    pub async fn get(&self, key: u128) -> Result<Option<CacheEntry>> {
        // L1 check
        if let Some(entry) = self.l1.get(key) {
            self.metrics.l1_hits.increment();
            return Ok(Some(entry));
        }
        
        // L2 check
        if let Some(entry) = self.l2.get(key).await? {
            self.metrics.l2_hits.increment();
            // Promote to L1
            self.l1.insert(key, entry.clone());
            return Ok(Some(entry));
        }
        
        // L3 check (if enabled)
        if let Some(ref l3) = self.l3 {
            if let Some(entry) = l3.get(key).await? {
                self.metrics.l3_hits.increment();
                // Store in L2 for next time
                self.l2.put(key, entry.clone()).await?;
                self.l1.insert(key, entry.clone());
                return Ok(Some(entry));
            }
        }
        
        self.metrics.misses.increment();
        Ok(None)
    }
}
```

---

## File Watching

### Watch Mode Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Watch Mode Flow                                   │
│                                                                              │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐            │
│   │  File System │─────▶│   Debouncer  │─────▶│   Rebuild    │            │
│   │  Events      │      │  (300ms)     │      │   Trigger    │            │
│   └──────────────┘      └──────────────┘      └──────┬───────┘            │
│                                                      │                      │
│                                                      ▼                      │
│   ┌──────────────┐      ┌──────────────┐      ┌──────────────┐            │
│   │  Cache Check │◀─────│  Task Graph  │◀─────│   Analyze    │            │
│   │              │      │   Update     │      │   Changes    │            │
│   └──────────────┘      └──────────────┘      └──────────────┘            │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Implementation

```rust
pub struct FileWatcher {
    watcher: RecommendedWatcher,
    debouncer: Debouncer,
    filter: FileFilter,
}

impl FileWatcher {
    pub fn new(config: &WatchConfig) -> Result<Self> {
        let (tx, rx) = mpsc::channel();
        
        let watcher = notify::recommended_watcher(
            move |res: Result<Event, notify::Error>| {
                if let Ok(event) = res {
                    let _ = tx.send(event);
                }
            }
        )?;
        
        Ok(Self {
            watcher,
            debouncer: Debouncer::new(config.debounce_duration),
            filter: FileFilter::new(config),
        })
    }
    
    pub async fn watch(&mut self, paths: &[PathBuf]) -> Result<()> {
        for path in paths {
            self.watcher.watch(path, RecursiveMode::Recursive)?;
        }
        
        loop {
            tokio::select! {
                event = self.rx.recv() => {
                    if let Ok(event) = event {
                        if self.filter.should_trigger(&event) {
                            self.debouncer.trigger(|| {
                                self.on_change().await;
                            });
                        }
                    }
                }
            }
        }
    }
    
    async fn on_change(&self) {
        // Clear screen
        print!("\x1B[2J\x1B[1;1H");
        println!("[watch] Change detected, rebuilding...");
        
        // Rebuild affected tasks
        if let Err(e) = self.rebuild().await {
            eprintln!("[watch] Build failed: {}", e);
        }
    }
}

pub struct FileFilter {
    include_patterns: Vec<Pattern>,
    exclude_patterns: Vec<Pattern>,
}

impl FileFilter {
    pub fn should_trigger(&self, event: &Event) -> bool {
        let path = match &event.kind {
            EventKind::Modify(_) | EventKind::Create(_) => {
                event.paths.first()
            }
            _ => return false,
        };
        
        if let Some(path) = path {
            let path_str = path.to_string_lossy();
            
            // Check excludes first
            for pattern in &self.exclude_patterns {
                if pattern.matches(&path_str) {
                    return false;
                }
            }
            
            // Check includes
            for pattern in &self.include_patterns {
                if pattern.matches(&path_str) {
                    return true;
                }
            }
        }
        
        false
    }
}
```

### Debouncer

```rust
pub struct Debouncer {
    delay: Duration,
    pending: Option<AbortHandle>,
}

impl Debouncer {
    pub fn trigger<F>(&mut self, f: F)
    where
        F: FnOnce() + Send + 'static,
    {
        // Cancel previous
        if let Some(handle) = self.pending.take() {
            handle.abort();
        }
        
        // Schedule new
        let delay = self.delay;
        let (abort_handle, abort_registration) = AbortHandle::new_pair();
        
        let future = Abortable::new(
            async move {
                tokio::time::sleep(delay).await;
                f();
            },
            abort_registration,
        );
        
        tokio::spawn(future);
        self.pending = Some(abort_handle);
    }
}
```

---

## Plugin System

### WASM Plugin Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Plugin System                                       │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────────┐  │
│   │                     phenoForge Host                                   │  │
│   │                                                                       │  │
│   │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐             │  │
│   │   │  Plugin      │  │  WASM        │  │  Host        │             │  │
│   │   │  Registry    │──│  Runtime     │──│  Functions   │             │  │
│   │   │              │  │  (wasmtime)  │  │              │             │  │
│   │   └──────────────┘  └──────┬───────┘  └──────────────┘             │  │
│   │                            │                                       │  │
│   └────────────────────────────┼───────────────────────────────────────┘  │
│                                │                                           │
│                                ▼                                           │
│   ┌──────────────────────────────────────────────────────────────────────┐│
│   │                     WASM Plugin (Sandboxed)                             ││
│   │                                                                         ││
│   │   #[plugin]                                                             ││
│   │   fn custom_task() {                                                    ││
│   │       let output = host::run_command("cargo", &["build"]);               ││
│   │       host::write_file("output.txt", output);                           ││
│   │   }                                                                     ││
│   │                                                                         ││
│   └──────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### Plugin Definition

```rust
// In plugin (compiled to WASM)
use pheno_forge_plugin::*;

#[plugin]
#[plugin(name = "format")]
fn format_code() -> PluginResult {
    let files = host::find_files("**/*.rs")?;
    
    for file in files {
        let content = host::read_file(&file)?;
        let formatted = host::run_command("rustfmt", &[&file])?;
        host::write_file(&file, formatted)?;
    }
    
    PluginResult::ok()
}

// Host-side implementation
pub struct PluginHost {
    engine: wasmtime::Engine,
    linker: wasmtime::Linker<HostState>,
}

impl PluginHost {
    pub fn new() -> Result<Self> {
        let engine = wasmtime::Engine::default();
        let mut linker = wasmtime::Linker::new(&engine);
        
        // Define host functions
        linker.func_wrap(
            "host",
            "run_command",
            |mut caller: Caller<'_, HostState>, cmd_ptr: i32, args_ptr: i32| -> i32 {
                let (cmd, args) = read_string_and_array(&mut caller, cmd_ptr, args_ptr);
                let output = std::process::Command::new(cmd)
                    .args(args)
                    .output()
                    .ok();
                write_output(&mut caller, output)
            }
        )?;
        
        linker.func_wrap(
            "host",
            "read_file",
            |mut caller: Caller<'_, HostState>, path_ptr: i32| -> i32 {
                let path = read_string(&mut caller, path_ptr);
                let content = std::fs::read_to_string(path).ok();
                write_string(&mut caller, content)
            }
        )?;
        
        Ok(Self { engine, linker })
    }
    
    pub fn load_plugin(&mut self, wasm_bytes: &[u8]) -> Result<Plugin> {
        let module = wasmtime::Module::new(&self.engine, wasm_bytes)?;
        let instance = self.linker.instantiate(&module)?;
        
        Ok(Plugin { instance })
    }
}
```

### Plugin Manifest

```toml
# .forge/plugins/my-plugin.toml
[plugin]
name = "my-plugin"
version = "1.0.0"
entry = "plugin.wasm"

[permissions]
filesystem = ["./src", "./target"]
network = false
commands = ["cargo", "rustfmt"]

[tasks]
format = { description = "Format code using custom rules" }
lint = { description = "Run custom linter" }
```

---

## Remote Execution

### Distributed Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Remote Execution                                    │
│                                                                              │
│   ┌──────────────────┐                    ┌──────────────────┐              │
│   │   phenoForge     │                    │   Worker Pool    │              │
│   │   (Client)       │                    │                  │              │
│   │                  │                    │   ┌──────────┐   │              │
│   │   ┌──────────┐   │    gRPC/HTTP2     │   │ Worker 1 │   │              │
│   │   │Scheduler │───┼──────────────────▶│   │ ┌──────┐ │   │              │
│   │   └──────────┘   │                    │   │ │Task A│ │   │              │
│   │        │         │                    │   │ └──────┘ │   │              │
│   │   ┌──────────┐   │                    │   └──────────┘   │              │
│   │   │  CAS     │   │                    │   ┌──────────┐   │              │
│   │   │ Client   │◀──┼──────────────────│   │ Worker 2 │   │              │
│   │   └──────────┘   │   Upload/Download │   │ ┌──────┐ │   │              │
│   │                  │                    │   │ │Task B│ │   │              │
│   └──────────────────┘                    │   │ └──────┘ │   │              │
│                                             │   └──────────┘   │              │
│                                             └──────────────────┘              │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Worker Protocol

```protobuf
syntax = "proto3";

service RemoteWorker {
    // Execute a task remotely
    rpc ExecuteTask(ExecuteRequest) returns (ExecuteResponse);
    
    // Check worker health and capacity
    rpc GetStatus(StatusRequest) returns (StatusResponse);
    
    // Stream logs during execution
    rpc StreamLogs(LogRequest) returns (stream LogEntry);
}

message ExecuteRequest {
    string task_id = 1;
    bytes task_definition = 2;
    repeated string input_digests = 3;
    map<string, string> environment = 4;
}

message ExecuteResponse {
    string task_id = 1;
    TaskStatus status = 2;
    string output_digest = 3;
    int32 exit_code = 4;
    bytes stdout = 5;
    bytes stderr = 6;
    int64 execution_time_ms = 7;
}

enum TaskStatus {
    PENDING = 0;
    RUNNING = 1;
    COMPLETED = 2;
    FAILED = 3;
    CANCELLED = 4;
    CACHED = 5;
}
```

### Worker Implementation

```rust
pub struct WorkerService {
    executor: Arc<TaskExecutor>,
    cas: Arc<dyn CasClient>,
}

#[tonic::async_trait]
impl RemoteWorker for WorkerService {
    async fn execute_task(
        &self,
        request: Request<ExecuteRequest>,
    ) -> Result<Response<ExecuteResponse>, Status> {
        let req = request.into_inner();
        
        // Download inputs from CAS
        for digest in &req.input_digests {
            self.cas.download(digest).await?;
        }
        
        // Execute task
        let start = Instant::now();
        let result = self.executor.execute(&req.task_definition).await;
        let elapsed = start.elapsed();
        
        // Upload outputs to CAS
        let output_digest = self.cas.upload(&result.outputs).await?;
        
        Ok(Response::new(ExecuteResponse {
            task_id: req.task_id,
            status: result.status.into(),
            output_digest,
            exit_code: result.exit_code,
            stdout: result.stdout.into_bytes(),
            stderr: result.stderr.into_bytes(),
            execution_time_ms: elapsed.as_millis() as i64,
        }))
    }
}
```

---

## Configuration

### Configuration File

```toml
# .forge/config.toml
[project]
name = "my-project"
version = "1.0.0"
description = "A sample project"

# Default tasks to run when no task specified
[default]
tasks = ["check", "build", "test"]

[execution]
# Parallel execution settings
parallel = true
max_workers = 8
default_timeout = "10m"
graceful_shutdown_timeout = "30s"

# Resource limits
[execution.resources]
memory_limit = "8GB"
file_descriptors = 4096
enable_cpu_affinity = false

[cache]
enabled = true
local_dir = "~/.cache/pheno-forge"
max_local_size = "10GB"
compression = "zstd"  # none, zstd, gzip

# Cache TTL
[cache.ttl]
default = "30d"
success = "7d"
failed = "1d"

# Remote cache configuration
[cache.remote]
enabled = false
endpoint = "s3://my-bucket/pheno-forge-cache"
region = "us-east-1"
access_key = "$AWS_ACCESS_KEY_ID"
secret_key = "$AWS_SECRET_ACCESS_KEY"
timeout = "30s"
concurrent_uploads = 4

# File watching configuration
[watch]
enabled = true
debounce = 500  # milliseconds
use_polling = false  # use native FS events when available

# Watch paths (relative to project root)
[[watch.paths]]
path = "src"
recursive = true

[[watch.paths]]
path = "Cargo.toml"
recursive = false

# Ignore patterns
[[watch.ignore]]
pattern = "target/**"

[[watch.ignore]]
pattern = ".git/**"

[[watch.ignore]]
pattern = "**/*.tmp"

# Plugin configuration
[plugins]
directory = "./.forge/plugins"
auto_load = true

[[plugins.registry]]
name = "official"
url = "https://plugins.kooshapari.com"

# Remote execution
[remote]
enabled = false
endpoint = "https://forge-workers.example.com"
auth_token = "$FORGE_AUTH_TOKEN"
max_concurrent_remote = 4

# Observability
[observability]
# Tracing
[observability.tracing]
enabled = true
format = "json"  # json, pretty
level = "info"
export = "stdout"  # stdout, file, otlp

[observability.tracing.otlp]
endpoint = "http://localhost:4317"
headers = { "x-api-key" = "$OTLP_API_KEY" }

# Metrics
[observability.metrics]
enabled = true
endpoint = "127.0.0.1:9090"
format = "prometheus"

# Logging
[observability.logging]
level = "info"
format = "compact"  # compact, pretty, json
file = ".forge/logs/forge.log"
max_size = "100MB"
max_files = 5
```

### Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `FORGE_CONFIG` | Config file path | `.forge/config.toml` |
| `FORGE_CACHE_DIR` | Cache directory | `~/.cache/pheno-forge` |
| `FORGE_LOG` | Log level | `info` |
| `FORGE_WORKERS` | Parallel workers | `num_cpus` |
| `FORGE_REMOTE_CACHE` | Remote cache URL | - |
| `FORGE_REMOTE_EXEC` | Remote exec endpoint | - |

---

## CLI Interface

### Command Structure

```
forge [OPTIONS] [COMMAND] [ARGS...]

Commands:
    run       Run a specific task (default)
    list      List all available tasks
    graph     Display dependency graph
    check     Validate configuration
    watch     Run in watch mode
    cache     Cache management
    clean     Clean build artifacts
    init      Initialize a new project
    help      Print help information
    version   Print version information

Options:
    -c, --config <FILE>    Config file path
    -j, --jobs <N>         Number of parallel jobs
        --dry-run          Show what would be executed
        --cache <MODE>     Cache mode: read-write, read-only, none
        --remote           Enable remote execution
        --no-color         Disable colored output
    -v, --verbose          Verbose output
    -q, --quiet            Suppress non-error output
    -h, --help             Print help
    -V, --version          Print version
```

### Command Examples

```bash
# Run default tasks
forge

# Run specific task
forge build

# Run with dependencies
forge test  # Automatically runs build first if configured

# Dry run
forge deploy --dry-run

# Parallel execution with limit
forge test --jobs 4

# Watch mode
forge build --watch

# List all tasks
forge list

# Show dependency graph
forge graph
# Outputs:
# build
# ├── compile
# ├── lint
# └── test
#     └── compile

# Validate configuration
forge check

# Cache management
forge cache stats
forge cache clean  # Remove all cached entries
forge cache clean --older-than 7d

# Clean build artifacts
forge clean
forge clean --target  # Only clean target directory

# Initialize project
forge init
forge init --template rust-cli

# Remote execution
forge heavy-task --remote
```

### Output Formats

#### List Command

```bash
$ forge list

Available Tasks:
  clean        Clean build artifacts
  compile      Compile source files
  lint         Run linter [deps: compile]
  test         Run tests [deps: compile]
  build        Full build [deps: lint, test]
  package      Create release package [deps: build]
  deploy       Deploy to production [deps: package]
```

#### Graph Command

```bash
$ forge graph --format dot
digraph tasks {
    "build" -> "compile";
    "build" -> "lint";
    "build" -> "test";
    "lint" -> "compile";
    "test" -> "compile";
    "package" -> "build";
    "deploy" -> "package";
}

$ forge graph --format text
build
├── compile
├── lint
│   └── [deps: compile]
└── test
    └── [deps: compile]

package
└── [deps: build]

deploy
└── [deps: package]
```

#### Progress Display

```
$ forge build
[1/7] 🔨 clean          completed  0.2s
[2/7] 🔨 compile        completed  12.5s
[3/7] 🔨 lint           completed  3.1s
[4/7] 🔨 test           completed  45.2s
[5/7] 🔨 build          cached     0.1s
[6/7] 📦 package        completed  2.3s
[7/7] 🚀 deploy         running    5.0s

✅ All tasks completed in 68.3s
```

---

## Observability

### Tracing

OpenTelemetry integration:

```rust
use tracing::{info, instrument};
use opentelemetry::trace::Tracer;

#[instrument(skip(ctx), fields(task_id = %task.id()))]
async fn execute_task(task: &Task, ctx: &TaskContext) -> TaskResult {
    let span = tracing::info_span!("task_execution", task.name = %task.name());
    
    async {
        info!("Starting task execution");
        
        let result = task.execute(ctx).await;
        
        match &result {
            Ok(_) => info!("Task completed successfully"),
            Err(e) => info!(error = %e, "Task failed"),
        }
        
        result
    }
    .instrument(span)
    .await
}
```

### Metrics

Prometheus-compatible metrics:

```rust
use metrics::{counter, gauge, histogram, Label};

// Task execution metrics
counter!("forge_task_executions_total", 
    "task" => task_name, 
    "status" => "success"
);

histogram!("forge_task_duration_seconds",
    duration.as_secs_f64(),
    "task" => task_name
);

gauge!("forge_active_tasks", active_count as f64);
gauge!("forge_cache_size_bytes", cache_size as f64);

// Cache metrics
counter!("forge_cache_hits_total", "tier" => "l1");
counter!("forge_cache_misses_total");

// Graph metrics
gauge!("forge_graph_tasks_total", task_count as f64);
gauge!("forge_graph_edges_total", edge_count as f64);
```

### Logging

Structured logging with tracing-subscriber:

```rust
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

pub fn init_logging(config: &LogConfig) {
    let fmt_layer = tracing_subscriber::fmt::layer()
        .with_target(false)
        .with_level(true)
        .compact();
    
    let filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new(&config.level));
    
    tracing_subscriber::registry()
        .with(fmt_layer)
        .with(filter)
        .init();
}
```

---

## Performance

### Performance Targets

| Metric | Target | Stretch | Measurement |
|--------|--------|---------|-------------|
| Cold start | <50ms | <20ms | `forge --help` |
| Task graph build | <10ms | <5ms | 100 tasks |
| Cache lookup (L1) | <100ns | <50ns | Memory access |
| Cache lookup (L2) | <5ms | <1ms | SSD read |
| Subprocess spawn | <5ms | <2ms | Empty command |
| No-op build | <100ms | <50ms | Cached tasks |
| Watch response | <50ms | <20ms | File change to build |
| Memory per task | <1KB | <512B | Resident size |
| Max tasks | 10,000 | 100,000 | Test suite |

### Optimization Strategies

#### 1. Lazy Evaluation

Only compute what's needed:

```rust
pub struct LazyGraph {
    task_defs: HashMap<TaskId, TaskDef>,
    computed: DashMap<TaskId, Arc<Task>>,
}

impl LazyGraph {
    pub fn get(&self, id: &TaskId) -> Arc<Task> {
        self.computed.entry(id.clone()).or_insert_with(|| {
            Arc::new(self.compute_task(id))
        }).clone()
    }
}
```

#### 2. Zero-Copy Where Possible

```rust
// Use references instead of clones
fn process_inputs<'a>(&self, inputs: &'a [PathBuf]) -> &'a [PathBuf] {
    // Process without copying
    inputs
}
```

#### 3. Parallel Hashing

```rust
pub fn hash_files_parallel(paths: &[PathBuf]) -> Vec<u128> {
    paths
        .par_iter()
        .map(|p| hash_file(p).unwrap())
        .collect()
}
```

#### 4. Connection Pooling

```rust
pub struct RemoteCachePool {
    clients: Pool<S3Client>,
}

impl RemoteCachePool {
    pub async fn get(&self, key: u128) -> Result<Option<CacheEntry>> {
        let client = self.clients.get().await?;
        client.get(key).await
    }
}
```

---

## Security

### Sandboxing

Plugin isolation:

```rust
use wasmtime::{Config, Module, Store, Instance};

pub fn create_sandboxed_runtime() -> Result<wasmtime::Engine> {
    let mut config = Config::new();
    
    // Disable features not needed
    config.wasm_threads(false);
    config.wasm_reference_types(false);
    config.wasm_simd(false);
    config.wasm_bulk_memory(false);
    config.wasm_multi_value(false);
    
    // Enable fuel metering for resource limits
    config.consume_fuel(true);
    
    Ok(wasmtime::Engine::new(&config)?)
}

pub fn execute_with_limits(
    instance: &Instance,
    store: &mut Store<HostState>,
    fuel: u64,
) -> Result<()> {
    store.add_fuel(fuel)?;
    
    // Execute
    let result = instance.call(store, "run", ());
    
    // Check remaining fuel
    let remaining = store.get_fuel()?;
    if remaining == 0 {
        return Err(Error::OutOfFuel);
    }
    
    result
}
```

### Secret Management

```rust
pub struct SecretResolver;

impl SecretResolver {
    pub fn resolve(&self, key: &str) -> Result<String> {
        // Try environment first
        if let Ok(value) = env::var(key) {
            return Ok(value);
        }
        
        // Try secret vault
        if key.starts_with("vault:") {
            return self.resolve_from_vault(&key[6..]);
        }
        
        // Try credential store
        if key.starts_with("credential:") {
            return self.resolve_from_credential_store(&key[11..]);
        }
        
        Err(Error::SecretNotFound(key.to_string()))
    }
}

// Usage in task
#[task]
#[env(API_KEY = "vault:production/api-key")]
fn deploy() -> TaskResult {
    // API_KEY resolved at runtime
    sh!("deploy-script").run()
}
```

---

## Testing Strategy

### Test Pyramid

```
                    ┌─────────────┐
                    │   E2E       │  5%  (CLI integration)
                    ├─────────────┤
                    │  Integration│  20% (component tests)
                    ├─────────────┤
                    │    Unit     │  75% (function tests)
                    └─────────────┘
```

### Unit Tests

```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_graph_construction() {
        let mut graph = TaskGraph::new();
        
        graph.add_task(Box::new(MockTask::new("a"))).unwrap();
        graph.add_task(Box::new(MockTask::new("b").with_deps(&["a"]))).unwrap();
        
        let order = graph.topological_order().unwrap();
        assert_eq!(order, vec!["a", "b"]);
    }
    
    #[test]
    fn test_cycle_detection() {
        let mut graph = TaskGraph::new();
        
        graph.add_task(Box::new(MockTask::new("a").with_deps(&["b"]))).unwrap();
        graph.add_task(Box::new(MockTask::new("b").with_deps(&["a"]))).unwrap();
        
        let cycle = graph.detect_cycles();
        assert!(cycle.is_some());
    }
    
    #[test]
    fn test_content_hashing() {
        let temp_file = tempfile::NamedTempFile::new().unwrap();
        fs::write(temp_file.path(), "test content").unwrap();
        
        let hash1 = ContentHasher::hash_file(temp_file.path()).unwrap();
        let hash2 = ContentHasher::hash_file(temp_file.path()).unwrap();
        
        assert_eq!(hash1, hash2);
    }
}
```

### Integration Tests

```rust
#[tokio::test]
async fn test_end_to_end_build() {
    let temp_dir = tempfile::tempdir().unwrap();
    
    // Create project structure
    fs::write(temp_dir.path().join("forge.toml"), r#"
[project]
name = "test"
"#).unwrap();
    
    // Run forge
    let output = Command::new("forge")
        .arg("--config")
        .arg(temp_dir.path().join("forge.toml"))
        .arg("build")
        .output()
        .await
        .unwrap();
    
    assert!(output.status.success());
}
```

### Property-Based Tests

```rust
use proptest::prelude::*;

proptest! {
    #[test]
    fn test_topological_order_preserves_dependencies(
        edges in prop::collection::vec(
            (any::<u8>(), any::<u8>()),
            0..100
        )
    ) {
        let mut graph = TaskGraph::new();
        
        // Add tasks and edges
        for (from, to) in &edges {
            graph.add_task_if_missing(from.to_string());
            graph.add_task_if_missing(to.to_string());
            graph.add_edge(from.to_string(), to.to_string());
        }
        
        if let Ok(order) = graph.topological_order() {
            // Verify all dependencies come before dependents
            for (i, task) in order.iter().enumerate() {
                for dep in graph.dependencies_of(task) {
                    let dep_idx = order.iter().position(|t| t == dep).unwrap();
                    assert!(dep_idx < i, "Dependency must come before task");
                }
            }
        }
    }
}
```

---

## Deployment

### Release Process

```yaml
# .github/workflows/release.yml
name: Release

on:
  push:
    tags:
      - 'v*'

jobs:
  build:
    strategy:
      matrix:
        target:
          - x86_64-unknown-linux-gnu
          - x86_64-apple-darwin
          - aarch64-apple-darwin
          - x86_64-pc-windows-msvc
    
    runs-on: ${{ matrix.os }}
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Install Rust
        uses: dtolnay/rust-action@stable
        with:
          targets: ${{ matrix.target }}
      
      - name: Build
        run: cargo build --release --target ${{ matrix.target }}
      
      - name: Package
        run: |
          mkdir -p dist
          cp target/${{ matrix.target }}/release/forge dist/forge-${{ matrix.target }}
          tar czf forge-${{ matrix.target }}.tar.gz -C dist .
      
      - name: Upload
        uses: actions/upload-release-asset@v1
        with:
          upload_url: ${{ steps.create_release.outputs.upload_url }}
          asset_path: ./forge-${{ matrix.target }}.tar.gz
```

### Installation Methods

```bash
# Cargo install
cargo install pheno-forge

# Homebrew
brew install phenotype/tap/forge

# Direct download
curl -sSL https://get.kooshapari.com/forge | sh

# Docker
docker run -v $(pwd):/workspace phenotype/forge build
```

---

## Roadmap

### Phase 1: MVP (Q2 2026)

- [x] Basic task definition macros
- [x] Dependency graph construction
- [x] Parallel task execution
- [x] CLI interface
- [ ] File watching
- [ ] Basic caching
- [ ] Configuration file support

### Phase 2: Core (Q3 2026)

- [ ] Incremental builds with xxHash
- [ ] Tiered caching (L1/L2/L3)
- [ ] Remote cache support
- [ ] Plugin system (WASM)
- [ ] Advanced observability
- [ ] Remote execution framework

### Phase 3: Scale (Q4 2026)

- [ ] Distributed task execution
- [ ] Build analytics
- [ ] CI/CD integrations
- [ ] IDE extensions
- [ ] Enterprise features

### Future Considerations

1. **Cloud-Native**: Kubernetes operator for remote workers
2. **AI Integration**: Smart build prediction and optimization
3. **Language Expansion**: Support for task definitions in other languages
4. **Visual Tools**: Web UI for build inspection

---

## Glossary

| Term | Definition |
|------|------------|
| **Task** | A unit of work that can be executed |
| **DAG** | Directed Acyclic Graph - the task dependency structure |
| **Cache Hit** | When a task result is retrieved from cache |
| **Cache Miss** | When a task must be executed because no cache entry exists |
| **Hermetic Build** | A build that depends only on declared inputs |
| **Incremental Build** | Only rebuilding changed components |
| **L1/L2/L3 Cache** | Memory, local filesystem, and remote cache tiers |
| **Plugin** | An extension module, typically WASM |
| **Remote Execution** | Running tasks on remote workers |
| **Task Graph** | The complete DAG of tasks and dependencies |
| **Topological Sort** | Ordering tasks such that dependencies come first |
| **WASM** | WebAssembly - portable binary instruction format |
| **xxHash** | Fast hash algorithm for content addressing |

---

## References

### Internal Documents

- [SOTA_RESEARCH.md](./SOTA_RESEARCH.md) - Comprehensive build system research
- [ADR-001](./docs/architecture/ADRs/ADR-001-rust-macro-task-dsl.md) - Task DSL Decision
- [ADR-002](./docs/architecture/ADRs/ADR-002-xxhash-tiered-caching.md) - Caching Decision
- [ADR-003](./docs/architecture/ADRs/ADR-003-tokio-async-execution.md) - Execution Decision

### External References

- [Bazel Documentation](https://bazel.build/docs)
- [Buck2 Documentation](https://buck2.build/docs)
- [Nx Documentation](https://nx.dev/docs)
- [Tokio Documentation](https://tokio.rs/)
- [Wasmtime Documentation](https://docs.wasmtime.dev/)
- [xxHash Specification](https://github.com/Cyan4973/xxHash)

### Academic Papers

1. Mokhov et al. "Build Systems a la Carte" (2018)
2. Löh et al. "Fighting Software Erosion with Build Systems"

---

## Appendices

### Appendix A: Error Codes

| Code | Description | Resolution |
|------|-------------|------------|
| E001 | Cycle detected in task graph | Check task dependencies |
| E002 | Task not found | Verify task name or registration |
| E003 | Cache write failed | Check disk space and permissions |
| E004 | Remote cache unavailable | Check network and credentials |
| E005 | Task timeout | Increase timeout or optimize task |
| E006 | Plugin load failed | Verify WASM module |

### Appendix B: Configuration Schema

Full JSON Schema available at: `schemas/config.schema.json`

### Appendix C: Benchmark Suite

```bash
# Run performance benchmarks
cargo bench

# Run stress tests
cargo test --release --features stress-test

# Profile build
valgrind --tool=callgrind target/release/forge build
```

### Appendix D: Complete API Reference

#### TaskContext Methods

```rust
impl TaskContext {
    /// Access project root directory
    pub fn project_root(&self) -> &Path;
    
    /// Access configuration
    pub fn config(&self) -> &ForgeConfig;
    
    /// Check if running in CI environment
    pub fn is_ci(&self) -> bool;
    
    /// Get results from dependency tasks
    pub fn dependency_results(&self) -> &HashMap<TaskId, TaskResult>;
    
    /// Report progress (0.0 to 1.0)
    pub fn report_progress(&self, progress: f32, message: &str);
    
    /// Access the cache
    pub fn cache(&self) -> &dyn Cache;
    
    /// Get environment variables
    pub fn env(&self, key: &str) -> Option<String>;
    
    /// Access the file system abstraction
    pub fn fs(&self) -> &dyn FileSystem;
    
    /// Get the execution start time
    pub fn start_time(&self) -> Instant;
    
    /// Access task-specific temporary directory
    pub fn temp_dir(&self) -> &Path;
    
    /// Access the task's declared inputs
    pub fn inputs(&self) -> &[PathBuf];
    
    /// Access the task's declared outputs
    pub fn outputs(&self) -> &[PathBuf];
}
```

#### TaskResult Builder

```rust
impl TaskResult {
    /// Create successful result
    pub fn ok() -> Self;
    
    /// Create successful result with outputs
    pub fn ok_with_outputs(outputs: Vec<PathBuf>) -> Self;
    
    /// Create failed result
    pub fn err(error: impl Into<TaskError>) -> Self;
    
    /// Create cached result
    pub fn cached(key: CacheKey) -> Self;
    
    /// Add metadata
    pub fn with_metadata(self, key: &str, value: &str) -> Self;
    
    /// Add output artifact
    pub fn with_output(self, path: impl AsRef<Path>) -> Self;
    
    /// Set duration
    pub fn with_duration(self, duration: Duration) -> Self;
}
```

#### Command Builder

```rust
impl Command {
    /// Create new command
    pub fn new(program: impl AsRef<OsStr>) -> Self;
    
    /// Add argument
    pub fn arg(self, arg: impl AsRef<OsStr>) -> Self;
    
    /// Add multiple arguments
    pub fn args(self, args: impl IntoIterator<Item = impl AsRef<OsStr>>) -> Self;
    
    /// Set environment variable
    pub fn env(self, key: impl AsRef<OsStr>, val: impl AsRef<OsStr>) -> Self;
    
    /// Remove environment variable
    pub fn env_remove(self, key: impl AsRef<OsStr>) -> Self;
    
    /// Clear all environment variables
    pub fn env_clear(self) -> Self;
    
    /// Set working directory
    pub fn current_dir(self, dir: impl AsRef<Path>) -> Self;
    
    /// Set stdin
    pub fn stdin(self, cfg: impl Into<Stdio>) -> Self;
    
    /// Set stdout
    pub fn stdout(self, cfg: impl Into<Stdio>) -> Self;
    
    /// Set stderr
    pub fn stderr(self, cfg: impl Into<Stdio>) -> Self;
    
    /// Execute and wait
    pub async fn run(self) -> TaskResult;
    
    /// Execute and capture output
    pub async fn output(self) -> Result<Output>;
    
    /// Execute with streaming output
    pub async fn stream(self) -> Result<StreamingOutput>;
}
```

### Appendix E: Platform-Specific Notes

#### Linux

- Uses `inotify` for file watching (best performance)
- Supports `fanotify` for additional monitoring capabilities
- Process sandboxing via `seccomp` (optional)
- CPU affinity support for task pinning

#### macOS

- Uses `FSEvents` for file watching
- No `inotify` equivalent; `kqueue` for fallback
- File system events may coalesce (batch notifications)
- Sandboxing via `sandbox-exec` (optional)

#### Windows

- Uses `ReadDirectoryChangesW` for file watching
- May require polling for certain network drives
- Process management via Job Objects
- Antivirus may impact file watching performance

### Appendix F: Migration Guide

#### From Make

| Make | phenoForge |
|------|------------|
| `make build` | `forge build` |
| `make -j4` | `forge build --jobs 4` |
| `.PHONY` | `#[task]` (no outputs) |
| `$@`, `$<` | Use `ctx.inputs()`, `ctx.outputs()` |
| `$(VAR)` | Standard Rust variables |

#### From Just

| Just | phenoForge |
|------|------------|
| `just build` | `forge build` |
| `build: compile` | `#[deps(compile)]` |
| `{{VAR}}` | `{var}` (Rust format) |

#### From Bazel

| Bazel | phenoForge |
|-------|------------|
| `bazel build //...` | `forge build` |
| `BUILD` files | `#[task]` in `.rs` files |
| `bazel query` | `forge graph` |
| `remote_cache` | `[cache.remote]` in config |

### Appendix G: Best Practices

#### Task Organization

```rust
// tasks.rs - Keep tasks in a dedicated module

/// Build the project
#[task]
#[deps(compile, assets)]
pub fn build() -> TaskResult {
    // Implementation
}

/// Compile source files
#[task]
#[deps(lint)]
pub fn compile() -> TaskResult {
    // Implementation
}

/// Lint source files
#[task]
pub fn lint() -> TaskResult {
    // Implementation
}

/// Process assets
#[task]
pub fn assets() -> TaskResult {
    // Implementation
}
```

#### Error Handling

```rust
use anyhow::{Context, Result};

#[task]
fn deploy() -> TaskResult {
    // Use ? for early returns
    let config = load_config()
        .context("Failed to load deployment config")?;
    
    // Use map_err for custom errors
    upload_artifacts()
        .map_err(|e| TaskError::UploadFailed(e.to_string()))?;
    
    TaskResult::ok()
}
```

#### Caching Strategy

```rust
#[task]
#[cache]
#[cache_inputs("src/**/*.rs", "Cargo.toml", "Cargo.lock")]
#[cache_outputs("target/release/myapp")]
fn build() -> TaskResult {
    // Only re-runs if inputs change
    sh!("cargo build --release").run()
}
```

### Appendix H: Troubleshooting

#### Slow Startup

```bash
# Profile startup
time forge --help

# Check for unnecessary dependencies
forge --verbose build

# Use release build
cargo build --release
```

#### Cache Not Working

```bash
# Check cache stats
forge cache stats

# Verify cache key computation
forge build --verbose 2>&1 | grep "cache"

# Clear and rebuild
forge cache clean
forge build
```

#### File Watching Issues

```bash
# Check file descriptor limits
ulimit -n

# Use polling mode (if native events fail)
forge watch --use-polling

# Increase debounce time
forge watch --debounce 1000
```

### Appendix I: Contributing Guidelines

See [CONTRIBUTING.md](./CONTRIBUTING.md) for full details.

Quick start:
```bash
# Clone repository
git clone https://github.com/phenotype/forge.git
cd forge

# Build
cargo build

# Run tests
cargo test

# Run with example
forge --config examples/basic/forge.toml build
```

### Appendix J: License Information

phenoForge is licensed under the MIT License. See [LICENSE](./LICENSE) for details.

Third-party dependencies:
- tokio: MIT
- clap: MIT OR Apache-2.0
- serde: MIT OR Apache-2.0
- xxhash-rust: BSD-2-Clause
- wasmtime: Apache-2.0 WITH LLVM-exception

---

*End of Specification*

**Document Status**: Draft - Pending Review  
**Next Review Date**: 2026-04-18  
**Owner**: phenoForge Core Team
