# ADR-003: Async Task Execution with Tokio and Work-Stealing Scheduler

**Status**: Accepted  
**Date**: 2026-04-04  
**Author**: phenoForge Core Team  
**Reviewers**: Performance Team, Architecture Review Board  

---

## Context

phenoForge must execute tasks according to their dependency graph. Key requirements:

1. **Dependency Respect**: Tasks run only after dependencies complete
2. **Parallelism**: Independent tasks run concurrently
3. **Resource Limits**: Configurable concurrency limits
4. **Cancellation**: Graceful task cancellation
5. **Observability**: Progress tracking, timing, logs

We evaluated multiple concurrency models.

## Decision

We will use Tokio's async runtime with a work-stealing scheduler for task execution.

### Architecture

```
┌────────────────────────────────────────────────────────────────┐
│                     phenoForge Executor                         │
│                                                                │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                 Dependency Graph                         │  │
│  │  ┌─────┐    ┌─────┐    ┌─────┐                         │  │
│  │  │ A   │───▶│ B   │    │ D   │                         │  │
│  │  └─────┘    └─────┘    └─────┘                         │  │
│  │       │          │                                    │  │
│  │       ▼          ▼                                    │  │
│  │  ┌─────┐    ┌─────┐                                   │  │
│  │  │ C   │    │ E   │◀────┐                             │  │
│  │  └─────┘    └─────┘     │                             │  │
│  │                  ▲       │                             │  │
│  │                  └───────┘                             │  │
│  └─────────────────────────────────────────────────────────┘  │
│                           │                                    │
│                           ▼                                    │
│  ┌─────────────────────────────────────────────────────────┐  │
│  │                 Tokio Runtime (Multi-thread)             │  │
│  │                                                         │  │
│  │  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌─────────┐  │  │
│  │  │ Worker 1 │  │ Worker 2 │  │ Worker 3 │  │ Worker N│  │  │
│  │  │ (Core 1) │  │ (Core 2) │  │ (Core 3) │  │ (Core N)│  │  │
│  │  │ ┌──────┐ │  │ ┌──────┐ │  │ ┌──────┐ │  │┌──────┐ │  │  │
│  │  │ │ Task │ │  │ │ Task │ │  │ │ Task │ │  ││ Task │ │  │  │
│  │  │ └──────┘ │  │ └──────┘ │  │ └──────┘ │  │└──────┘ │  │  │
│  │  │ Steal ◀──┼──┼──▶     │  │  │          │  │         │  │  │
│  │  └──────────┘  └──────────┘  └──────────┘  └─────────┘  │  │
│  └─────────────────────────────────────────────────────────┘  │
│                                                                │
└────────────────────────────────────────────────────────────────┘
```

## Rationale

### Why Async/Await (vs Threads vs Processes)

| Model | Overhead | Memory | Complexity | Use Case |
|-------|----------|--------|------------|----------|
| OS Threads | 1-2MB | High | Low | CPU-bound |
| OS Processes | 10MB+ | Very High | Medium | Isolation |
| **Async Tasks** | **~1KB** | **Low** | **Medium** | **I/O + CPU mix** |
| Green Threads | 4KB | Low | Low | (deprecated) |

Build tasks typically:
- Spawn subprocesses (I/O wait)
- Read/write files (I/O)
- Some CPU work (hashing, graph computation)

Async/await efficiently handles the I/O wait time.

### Why Tokio

Tokio is the dominant Rust async runtime:

1. **Maturity**: Production-proven (AWS, Discord, etc.)
2. **Ecosystem**: Compatible with most async Rust crates
3. **Performance**: Work-stealing scheduler, efficient I/O
4. **Features**: Channels, timeouts, cancellation, tracing
5. **Team Familiarity**: Phenotype ecosystem uses Tokio

### Why Not Alternatives

| Alternative | Reason for Rejection |
|-------------|---------------------|
| async-std | Smaller ecosystem, less mature |
| smol | Good but less mainstream |
| Thread pool | Higher memory, no async ecosystem |
| Rayon | Data parallelism only, not task graph |
| Custom runtime | Unnecessary complexity |

### Work-Stealing vs Work-Sharing

**Work-Stealing** (Tokio default):
- Each worker has a local queue
- Idle workers steal from busy workers
- Good for task graphs with varying execution times

```
Worker 1 (busy): [Task A] [Task B] [Task C] [Task D]
Worker 2 (idle):                       ◀── steals Task D
```

**Work-Sharing**:
- Central queue all workers pull from
- Simpler but more contention
- Better for uniform tasks

We chose work-stealing for variable build task durations.

## Consequences

### Positive

1. **Performance**:
   - Lightweight tasks (~1KB vs ~2MB thread)
   - Efficient I/O handling
   - Full CPU utilization via work-stealing

2. **Scalability**:
   - 1000s of concurrent tasks possible
   - Grows with available cores
   - Bounded by configuration

3. **Responsiveness**:
   - Non-blocking file watching
   - Real-time progress updates
   - Graceful cancellation

4. **Ecosystem**:
   - Access to tokio::process for subprocess
   - tokio::fs for async file operations
   - tokio::sync for coordination
   - tracing for observability

5. **Correctness**:
   - Structured concurrency
   - Cancellation propagation
   - Timeout handling

### Negative

1. **Learning Curve**: Async Rust has complexity
   - `'static` lifetime requirements
   - `Send` + `Sync` bounds
   - Cancellation safety
   - Mitigation: Good abstractions, documentation

2. **Compile Times**: Async can increase compile times
   - Mitigation: Keep task closures simple
   - Mitigation: Pre-compiled templates

3. **Debug Complexity**: Async stack traces harder
   - Mitigation: tracing for structured logging
   - Mitigation: tokio-console for debugging

### Neutral

1. **Runtime Dependency**: Requires Tokio runtime
   - Standard for Rust async
   - Single binary with runtime embedded

## Implementation Details

### Task Execution

```rust
use tokio::task::JoinSet;
use std::sync::Arc;

pub struct TaskExecutor {
    graph: Arc<TaskGraph>,
    semaphore: Arc<Semaphore>, // Concurrency limit
}

impl TaskExecutor {
    pub async fn execute(&self, target: TaskId) -> Result<ExecutionReport> {
        let mut completed = HashSet::new();
        let mut running = JoinSet::new();
        let mut pending: VecDeque<TaskId> = self.graph.dependencies(target).collect();
        
        // Seed with initial ready tasks
        for task in self.graph.ready_tasks() {
            running.spawn(self.run_task(task));
        }
        
        // Event loop
        while !running.is_empty() || !pending.is_empty() {
            tokio::select! {
                // Task completed
                Some(result) = running.join_next() => {
                    let (task_id, outcome) = result?;
                    completed.insert(task_id);
                    
                    // Check dependents
                    for dependent in self.graph.dependents_of(task_id) {
                        if self.graph.all_deps_completed(dependent, &completed) {
                            pending.push_back(dependent);
                        }
                    }
                }
                
                // Start pending tasks if under limit
                else => {
                    if let Some(task) = pending.pop_front() {
                        let permit = self.semaphore.clone().acquire_owned().await?;
                        running.spawn(async move {
                            let _permit = permit; // Hold until complete
                            self.run_task(task).await
                        });
                    }
                }
            }
        }
        
        Ok(ExecutionReport { completed })
    }
    
    async fn run_task(&self, task_id: TaskId) -> Result<(TaskId, TaskOutcome)> {
        let task = self.graph.get(task_id)?;
        
        // Check cache
        if let Some(cached) = self.cache.get(task.signature()).await {
            return Ok((task_id, TaskOutcome::Cached(cached)));
        }
        
        // Execute with timeout
        let outcome = tokio::time::timeout(
            task.timeout(),
            self.execute_task_body(task)
        ).await??;
        
        // Store in cache
        self.cache.store(task.signature(), &outcome).await?;
        
        Ok((task_id, outcome))
    }
}
```

### Concurrency Control

```rust
// Configurable parallelism
pub struct ConcurrencyConfig {
    /// Maximum parallel tasks (default: num_cpus)
    pub max_parallel_tasks: usize,
    
    /// Maximum parallel IO operations
    pub max_parallel_io: usize,
    
    /// Per-task timeout
    pub default_timeout: Duration,
}

// Usage
let semaphore = Arc::new(Semaphore::new(config.max_parallel_tasks));
```

### Cancellation

```rust
pub struct CancellableTask {
    cancel_tx: tokio::sync::oneshot::Sender<()>,
    handle: JoinHandle<TaskResult>,
}

impl CancellableTask {
    pub async fn cancel(self) -> Result<()> {
        // Signal cancellation
        let _ = self.cancel_tx.send(());
        
        // Wait for graceful shutdown
        tokio::time::timeout(Duration::from_secs(5), self.handle).await??;
        
        // If not stopped, abort
        self.handle.abort();
        
        Ok(())
    }
}

// In task body
async fn task_body(cancel_rx: oneshot::Receiver<()>) -> TaskResult {
    tokio::select! {
        result = actual_work() => result,
        _ = cancel_rx => {
            // Cleanup
            TaskResult::Cancelled
        }
    }
}
```

### Subprocess Management

```rust
use tokio::process::Command;

async fn run_subprocess(cmd: &mut Command) -> Result<Output> {
    let mut child = cmd
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .spawn()?;
    
    // Stream output in real-time
    let stdout = child.stdout.take().unwrap();
    let stderr = child.stderr.take().unwrap();
    
    tokio::spawn(stream_output(stdout, OutputStream::Stdout));
    tokio::spawn(stream_output(stderr, OutputStream::Stderr));
    
    // Wait with timeout
    tokio::time::timeout(TIMEOUT, child.wait()).await??;
    
    Ok(())
}
```

### Progress Reporting

```rust
use tokio::sync::broadcast;

pub struct ProgressReporter {
    tx: broadcast::Sender<ProgressEvent>,
}

#[derive(Clone, Debug)]
pub enum ProgressEvent {
    TaskStarted { task: TaskId, timestamp: Instant },
    TaskCompleted { task: TaskId, duration: Duration, outcome: Outcome },
    TaskFailed { task: TaskId, error: String },
    OverallProgress { completed: usize, total: usize },
}

impl ProgressReporter {
    pub fn subscribe(&self) -> broadcast::Receiver<ProgressEvent> {
        self.tx.subscribe()
    }
    
    pub fn emit(&self, event: ProgressEvent) {
        let _ = self.tx.send(event); // Broadcast to all listeners
    }
}
```

## Resource Management

### CPU Affinity (Optional)

```rust
#[cfg(target_os = "linux")]
pub fn set_cpu_affinity(core_ids: &[CoreId]) {
    // Pin workers to specific cores for cache efficiency
}
```

### Memory Limits

```rust
// Monitor memory usage
let initial_memory = get_memory_usage();

if current_memory - initial_memory > MAX_MEMORY {
    // Backpressure: delay new tasks
    tokio::time::sleep(Duration::from_millis(100)).await;
}
```

### File Descriptor Limits

```rust
// Limit concurrent file operations
static FILE_SEMAPHORE: Semaphore = Semaphore::const_new(100);

async fn with_file_limit<F, Fut, R>(f: F) -> R
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = R>,
{
    let _permit = FILE_SEMAPHORE.acquire().await.unwrap();
    f().await
}
```

## Configuration

```toml
# .forge/config.toml
[execution]
max_parallel_tasks = "auto"  # or specific number
max_parallel_io = 32
default_timeout = "10m"
graceful_shutdown_timeout = "30s"

[execution.resources]
memory_limit = "8GB"
file_descriptors = 4096
enable_cpu_affinity = false
```

## Performance Characteristics

| Metric | Target | Notes |
|--------|--------|-------|
| Task spawn latency | <10μs | Async task creation |
| Context switch | ~1μs | Tokio work-stealing |
| Idle CPU usage | <1% | Efficient parking |
| Memory per task | ~1KB | Stack allocation |
| Max concurrent | 10,000+ | Bounded by memory |

## Comparison with Industry

| System | Concurrency Model | Runtime |
|--------|------------------|---------|
| Bazel | Thread pool | Java |
| Buck2 | Async (Tokio) | Rust |
| Nx | Node.js async | Node.js |
| Gradle | Thread pool | JVM |
| phenoForge | Async (Tokio) | Rust |

## Debugging and Observability

### Tokio Console

```rust
#[tokio::main]
async fn main() {
    console_subscriber::init(); // Enable tokio-console
    
    // Run phenoForge
}
```

### Tracing Integration

```rust
use tracing::{info, instrument};

#[instrument(skip(self), fields(task_id = %task.id))]
async fn execute_task(&self, task: &Task) -> Result<()> {
    info!("Starting task execution");
    
    let result = self.run(task).await;
    
    match &result {
        Ok(_) => info!("Task completed successfully"),
        Err(e) => info!(error = %e, "Task failed"),
    }
    
    result
}
```

## References

- Tokio: https://tokio.rs/
- Async Rust Book: https://rust-lang.github.io/async-book/
- Tokio Internals: https://tokio.rs/blog/2019-10-scheduler
- Work-Stealing: https://en.wikipedia.org/wiki/Work_stealing
- Structured Concurrency: https://vorpus.org/blog/notes-on-structured-concurrency/

## Changelog

| Date | Author | Change |
|------|--------|--------|
| 2026-04-04 | phenoForge Team | Initial decision |
