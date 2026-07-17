# WP02: Temporal Worker SDK Integration

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 1 - Foundation
**Wave**: 0
**Dependencies**: WP01 (Temporal must be deployed and healthy)
**Author**: Claude Sonnet 4.6

## Mission

Integrate the Temporal Rust SDK into the codebase. Implement a minimal worker that connects to Temporal, registers a skeleton workflow and activity, and confirms end-to-end connectivity. This establishes the foundation for all subsequent workflow migrations.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-002
- Plan: `../plan.md` — WP02 section
- Depends on: `WP01-temporal-deploy.md`

## Context

Rust is the primary language for all services in the Phenotype ecosystem. The Temporal Rust SDK (`temporal-sdk`) is production-ready. Use `tokio` as the async runtime.

The worker will be a separate binary or a service module within the existing Rust workspace. It needs to:
1. Connect to Temporal at `TEMPORAL_HOST` (default: `http://localhost:8233`)
2. Register a namespace (default: `default`)
3. Register at least one workflow type and one activity type
4. Poll Temporal for available activity tasks
5. Execute activities and report results back to Temporal

## What to Build

### 1. Add Dependency

Add to `Cargo.toml` of the relevant workspace crate:

```toml
[dependencies]
temporal-sdk = "0.8"
temporal-sdk-core = "0.8"
tokio = { version = "1", features = ["full"] }
anyhow = "1"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
```

### 2. Create `crates/temporal-worker/` Module

Structure:
```
crates/temporal-worker/
├── Cargo.toml
└── src/
    ├── lib.rs          # worker entry, exports
    ├── client.rs       # Temporal client initialization
    ├── workflows.rs    # workflow type definitions
    ├── activities.rs   # activity implementations
    └── main.rs         # binary that runs the worker
```

### 3. `src/client.rs` — Client Initialization

```rust
use temporal_sdk::{Client, ClientOptions, ClientOptionsBuilder};
use std::env;

pub async fn create_client() -> anyhow::Result<Client> {
    let host = env::var("TEMPORAL_HOST").unwrap_or_else(|_| "http://localhost:8233".into());
    let namespace = env::var("TEMPORAL_NAMESPACE").unwrap_or_else(|_| "default".into());

    let client = ClientOptionsBuilder::default()
        .target_host(host.parse()?)
        .namespace(namespace)
        .build()?
        .connect("temporal-worker", None, None)
        .await?;

    Ok(client)
}
```

### 4. `src/workflows.rs` — Minimal Skeleton Workflow

```rust
use temporal_sdk::{WorkflowContext, WorkflowResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DummyInput {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DummyOutput {
    pub result: String,
}

pub async fn dummy_workflow(ctx: WorkflowContext, input: DummyInput) -> WorkflowResult<DummyOutput> {
    ctx.logger().info("dummy_workflow started", &[("input", &input.value)]);

    // Register this workflow by calling an activity
    let activity_result: String = ctx
        .activity(dummy_activity::execute(input.value.clone()))
        .start_to_close_timeout(std::time::Duration::from_secs(30))
        .await
        .map_err(|e| anyhow::anyhow!("activity failed: {}", e))?;

    ctx.logger().info("dummy_workflow completed");

    Ok(DummyOutput { result: activity_result })
}
```

### 5. `src/activities.rs` — Minimal Activity

```rust
use temporal_sdk::{ActivityContext, ActivityResult};
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct DummyActivityInput {
    pub value: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct DummyActivityOutput {
    pub value: String,
}

pub async fn execute(ctx: ActivityContext, input: DummyActivityInput) -> ActivityResult<DummyActivityOutput> {
    ctx.heartbeat("processing...")?;
    tokio::time::sleep(std::time::Duration::from_millis(500)).await;
    Ok(DummyActivityOutput {
        value: format!("processed: {}", input.value)
    })
}

pub fn register_all() -> impl Fn(temporal_sdk::Worker) {
    |mut worker: temporal_sdk::Worker| {
        worker.register_activity("dummy_activity", execute);
    }
}
```

### 6. `src/main.rs` — Worker Binary

```rust
use temporal_sdk::{Runtime, Worker, WorkerConfigBuilder};
use std::env;
use anyhow::Result;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod client;
mod workflows;
mod activities;

#[tokio::main]
async fn main() -> Result<()> {
    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new("info"))
        .with(tracing_subscriber::fmt::layer())
        .init();

    let client = client::create_client().await?;
    let task_queue = env::var("TEMPORAL_TASK_QUEUE").unwrap_or_else(|_| "default".into());

    let mut worker = Worker::new(
        &WorkerConfigBuilder::default()
            .name(task_queue.clone())
            .task_queue(task_queue)
            .build(),
    );

    worker.register_workflow_callback(workflows::dummy_workflow);
    activities::register_all()(&mut worker);

    let client_clone = client.clone();
    tokio::spawn(async move {
        worker.run(&client_clone).await;
    });

    tracing::info!("temporal-worker running on task queue: {}", task_queue);

    // Keep running
    tokio::signal::ctrl_c().await?;
    Ok(())
}
```

### 7. Update Process Compose

Add to `process-compose.yml`:

```yaml
temporal-worker:
  command: cargo run --bin temporal-worker
  depends_on:
    - temporal  # ensure Temporal is up
  environment:
    TEMPORAL_HOST: http://temporal:8233
    TEMPORAL_TASK_QUEUE: default
    TEMPORAL_NAMESPACE: default
```

## Testing the Worker

```bash
# 1. Start Temporal (WP01 must be done)
docker compose -f infra/temporal/docker-compose.yml up -d

# 2. Build and run worker
cargo build --bin temporal-worker
TEMPORAL_HOST=http://localhost:8233 TEMPORAL_TASK_QUEUE=default cargo run --bin temporal-worker

# 3. In another terminal, start a workflow via tctl
tctl workflow run \
  --workflow_type dummy_workflow \
  --task_queue default \
  --input '{"value":"hello"}'

# 4. Check worker logs — should show activity execution
# 5. Check Temporal UI at localhost:8233 — workflow should appear in history
```

## Acceptance Criteria

- [ ] `cargo build --bin temporal-worker` compiles without errors
- [ ] Worker starts and connects to Temporal (logs show successful connection)
- [ ] Worker polls the task queue every ~10 seconds
- [ ] `tctl workflow run` triggers the skeleton workflow
- [ ] Workflow appears in Temporal Web UI at `:8233`
- [ ] Workflow history shows the activity execution
- [ ] Worker handles Temporal being unavailable gracefully (retry connection)
- [ ] Unit tests pass: `cargo test --lib temporal_worker`
