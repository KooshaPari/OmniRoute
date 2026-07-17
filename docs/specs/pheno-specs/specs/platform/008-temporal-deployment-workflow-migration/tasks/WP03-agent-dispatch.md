# WP03: Agent Dispatch Workflow Migration

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 2 - Core Migration
**Wave**: 1
**Dependencies**: WP02 (Worker SDK must be integrated)
**Author**: Claude Sonnet 4.6

## Mission

Migrate the primary agent task dispatch workflow from NATS JetStream to Temporal. This is the most critical workflow — agent dispatch must be durable, survive crashes, and be fully observable. After this work package, agent dispatch is fully Temporal-powered.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-003, SC-001, SC-002, SC-003, SC-004, SC-009
- Plan: `../plan.md` — WP03 section
- Depends on: `WP02-worker-sdk.md`

## Context

Before writing code, audit the existing NATS agent dispatch implementation:

1. Find all NATS subjects used for agent dispatch: `grep -r "nats\|jetstream\|NatsClient" --include="*.rs" -l`
2. Find queue consumers that handle agent dispatch: look for `subscribe`, `queue_subscribe`, `jetstream` in worker/consumer code
3. Document the current flow:
   - What triggers a dispatch? (API call, webhook, cron?)
   - What does each step do?
   - What happens on failure?
   - How does the agent report back?
4. Preserve the git SHA of the NATS implementation before removing it (needed for WP08 rollback)

## What to Build

### File: `crates/temporal-worker/src/workflows/agent_dispatch.rs`

```rust
use temporal_sdk::{WorkflowContext, WorkflowResult, RetryPolicy};
use serde::{Deserialize, Serialize};
use std::time::Duration;
use anyhow::anyhow;
use std::env;

/// ─── Data Types ───

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentTask {
    pub task_id: String,
    pub agent_type: String,
    pub prompt: String,
    pub context: serde_json::Value,
    pub timeout_seconds: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidationResult {
    pub is_valid: bool,
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DispatchResult {
    pub run_id: String,
    pub started_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AgentOutput {
    pub result: String,
    pub duration_ms: u64,
    pub tokens_used: Option<u64>,
}

/// ─── Workflow ───

pub async fn agent_dispatch(
    ctx: WorkflowContext,
    task: AgentTask,
) -> WorkflowResult<AgentOutput> {
    // Emit workflow start event
    ctx.logger().info("agent_dispatch started", &[("task_id", &task.task_id)]);

    // ── Step 1: Validate task input ──
    let validation = ctx
        .activity(validate_task::execute(task.clone()))
        .start_to_close_timeout(Duration::from_secs(30))
        .retry(RetryPolicy::default()) // 3 retries, exponential backoff
        .await
        .map_err(|e| anyhow!("validate_task failed: {}", e))?;

    if !validation.is_valid {
        ctx.logger().error("validation failed", &[("error", validation.error.as_deref().unwrap_or("unknown"))]);
        return Err(anyhow!("validation failed: {}", validation.error.as_deref().unwrap_or("unknown")).into());
    }

    ctx.logger().info("validation passed", &[("task_id", &task.task_id)]);

    // ── Step 2: Dispatch to agent runtime ──
    let dispatch_result = ctx
        .activity(dispatch_to_agent::execute(dispatch_to_agent::Input {
            task_id: task.task_id.clone(),
            agent_type: task.agent_type.clone(),
            prompt: task.prompt.clone(),
            context: task.context.clone(),
        }))
        .start_to_close_timeout(Duration::from_secs(task.timeout_seconds))
        .heartbeat_timeout(Duration::from_secs(60))  // heartbeat every 60s
        .retry(RetryPolicy::default())
        .await
        .map_err(|e| anyhow!("dispatch_to_agent failed: {}", e))?;

    ctx.logger().info("agent dispatched", &[("run_id", &dispatch_result.run_id)]);

    // ── Step 3: Collect results with polling ──
    let output = ctx
        .activity(collect_agent_result::execute(collect_agent_result::Input {
            task_id: task.task_id.clone(),
            run_id: dispatch_result.run_id.clone(),
            poll_interval_seconds: 30,
        }))
        .start_to_close_timeout(Duration::from_secs(1800)) // 30 min
        .heartbeat_timeout(Duration::from_secs(120))
        .retry(RetryPolicy::default())
        .await
        .map_err(|e| anyhow!("collect_agent_result failed: {}", e))?;

    ctx.logger().info("result collected", &[("task_id", &task.task_id)]);

    // ── Step 4: Notify completion ──
    let _notify_result = ctx
        .activity(notify_completion::execute(notify_completion::Input {
            task_id: task.task_id.clone(),
            result: output.clone(),
        }))
        .start_to_close_timeout(Duration::from_secs(30))
        .retry(RetryPolicy::default())
        .await
        .map_err(|e| {
            // Non-fatal: log but don't fail the workflow
            ctx.logger().warn("notify_completion failed", &[("error", &e.to_string())]);
        });

    ctx.logger().info("agent_dispatch completed", &[("task_id", &task.task_id)]);

    Ok(output)
}

/// ─── Saga Compensation ──
/// On final failure, emit a failure signal so the agent runtime
/// knows to clean up any in-progress state.

pub async fn saga_compensate(ctx: WorkflowContext, task_id: String) -> WorkflowResult<()> {
    ctx.logger().error("agent_dispatch saga compensation", &[("task_id", &task_id)]);

    ctx.activity(emit_failure_signal::execute(task_id.clone()))
        .start_to_close_timeout(Duration::from_secs(30))
        .await
        .map_err(|e| anyhow!("saga compensation failed: {}", e))?;

    Ok(())
}
```

### Activity Implementations

### `activities/validate_task.rs`

```rust
use temporal_sdk::{ActivityContext, ActivityResult};
use anyhow::anyhow;

pub async fn execute(ctx: ActivityContext, task: super::AgentTask) -> ActivityResult<super::ValidationResult> {
    ctx.heartbeat("validating...")?;

    if task.task_id.is_empty() {
        return Ok(super::ValidationResult {
            is_valid: false,
            error: Some("task_id is required".into()),
        });
    }
    if task.prompt.is_empty() {
        return Ok(super::ValidationResult {
            is_valid: false,
            error: Some("prompt is required".into()),
        });
    }

    Ok(super::ValidationResult { is_valid: true, error: None })
}
```

### `activities/dispatch_to_agent.rs`

```rust
// Dispatches the task to the agent runtime.
// Primary: SGLang/vLLM server accessible via Tailscale VPN.
// Fallback: Groq Cloud API.
// This activity heartbeats every 60 seconds to detect agent stalls.

use temporal_sdk::{ActivityContext, ActivityResult};
use anyhow::anyhow;
use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize, Deserialize)]
pub struct Input {
    pub task_id: String,
    pub agent_type: String,
    pub prompt: String,
    pub context: serde_json::Value,
}

pub async fn execute(ctx: ActivityContext, input: Input) -> ActivityResult<super::DispatchResult> {
    ctx.heartbeat("connecting to agent runtime...")?;

    let agent_endpoint = std::env::var("AGENT_RUNTIME_URL")
        .unwrap_or_else(|_| "http://localhost:8080".into());

    // Attempt primary: SGLang/vLLM via HTTP
    let run_id = match dispatch_to_sglang(&ctx, &agent_endpoint, &input).await {
        Ok(id) => id,
        Err(e) => {
            ctx.heartbeat("primary agent runtime failed, falling back to Groq...")?;
            dispatch_to_groq(&ctx, &input).await?
        }
    };

    Ok(super::DispatchResult {
        run_id,
        started_at: chrono::Utc::now().to_rfc3339(),
    })
}

async fn dispatch_to_sglang(ctx: &ActivityContext, endpoint: &str, input: &Input) -> anyhow::Result<String> {
    ctx.heartbeat("dispatching to SGLang...")?;
    let client = reqwest::Client::new();
    let resp = client
        .post(format!("{}/v1/agent/run", endpoint))
        .json(&serde_json::json!({
            "task_id": input.task_id,
            "agent_type": input.agent_type,
            "prompt": input.prompt,
            "context": input.context,
        }))
        .timeout(Duration::from_secs(30))
        .send()
        .await?;
    let body: serde_json::Value = resp.json().await?;
    body["run_id"].as_str()
        .map(|s| s.to_string())
        .ok_or_else(|| anyhow::anyhow!("invalid response from SGLang"))
}

async fn dispatch_to_groq(ctx: &ActivityContext, input: &Input) -> anyhow::Result<String> {
    ctx.heartbeat("dispatching to Groq fallback...")?;
    let api_key = std::env::var("GROQ_API_KEY")?;
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.groq.com/openai/v1/chat/completions")
        .header("Authorization", format!("Bearer {}", api_key))
        .json(&serde_json::json!({
            "model": "llama-3.3-70b-versatile",
            "messages": [{"role": "user", "content": &input.prompt}]
        }))
        .timeout(Duration::from_secs(60))
        .send()
        .await?;
    let body: serde_json::Value = resp.json().await?;
    let run_id = format!("groq-{}", uuid::Uuid::new_v4());
    Ok(run_id)
}
```

### `activities/collect_agent_result.rs`

```rust
// Polls the agent runtime for completion.
// Heartbeats every 60 seconds.
// Returns when agent signals completion or timeout.

use temporal_sdk::{ActivityContext, ActivityResult};
use anyhow::anyhow;
use serde::{Deserialize, Serialize};
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct Input {
    pub task_id: String,
    pub run_id: String,
    pub poll_interval_seconds: u64,
}

pub async fn execute(ctx: ActivityContext, input: Input) -> ActivityResult<super::AgentOutput> {
    let client = reqwest::Client::new();
    let agent_endpoint = std::env::var("AGENT_RUNTIME_URL")
        .unwrap_or_else(|_| "http://localhost:8080".into());

    let start = std::time::Instant::now();
    let poll_interval = Duration::from_secs(input.poll_interval_seconds);

    loop {
        ctx.heartbeat(format!("polling agent result ({}s elapsed)", start.elapsed().as_secs()))?;

        match client
            .get(format!("{}/v1/agent/status/{}", agent_endpoint, input.run_id))
            .timeout(Duration::from_secs(10))
            .send()
            .await
        {
            Ok(resp) if resp.status() == 200 => {
                let body: serde_json::Value = resp.json().await?;
                let status = body["status"].as_str().unwrap_or("pending");

                match status {
                    "completed" => {
                        return Ok(super::AgentOutput {
                            result: body["result"].as_str().unwrap_or("").to_string(),
                            duration_ms: start.elapsed().as_millis() as u64,
                            tokens_used: body["tokens_used"].as_u64(),
                        });
                    }
                    "failed" => {
                        return Err(anyhow!("agent failed: {}", body["error"].as_str().unwrap_or("unknown")).into());
                    }
                    _ => {
                        // still pending, wait and poll again
                        tokio::time::sleep(poll_interval).await;
                    }
                }
            }
            Ok(_) => {
                tokio::time::sleep(poll_interval).await;
            }
            Err(e) => {
                ctx.heartbeat(format!("poll failed (retrying): {}", e))?;
                tokio::time::sleep(poll_interval).await;
            }
        }
    }
}
```

### `activities/notify_completion.rs`

```rust
// Sends a completion notification to the notification channel.
// Non-critical: failures here do not fail the overall workflow.

use temporal_sdk::{ActivityContext, ActivityResult};
use anyhow::anyhow;

#[derive(Debug, serde::Serialize, serde::Deserialize)]
pub struct Input {
    pub task_id: String,
    pub result: super::AgentOutput,
}

pub async fn execute(ctx: ActivityContext, input: Input) -> ActivityResult<()> {
    ctx.heartbeat("sending notification...")?;

    let webhook_url = std::env::var("NOTIFICATION_WEBHOOK_URL")
        .unwrap_or_else(|_| "".into());

    if webhook_url.is_empty() {
        ctx.heartbeat("no webhook configured, skipping notification")?;
        return Ok(());
    }

    let client = reqwest::Client::new();
    client
        .post(&webhook_url)
        .json(&serde_json::json!({
            "event": "agent_dispatch.completed",
            "task_id": input.task_id,
            "result": input.result,
        }))
        .timeout(Duration::from_secs(10))
        .send()
        .await
        .map_err(|e| anyhow!("webhook failed: {}", e))?;

    Ok(())
}
```

## Crash Recovery Test

```bash
# 1. Start a long-running agent dispatch workflow
tctl workflow run \
  --workflow_type agent_dispatch \
  --task_queue default \
  --input '{"task_id":"test-001","agent_type":"code","prompt":"Count to 100","context":{},"timeout_seconds":300}'

# 2. Kill the Temporal server mid-execution
docker kill temporal

# 3. Wait 30 seconds, restart
docker start temporal

# 4. Verify: workflow resumes from last checkpoint, completes
tctl workflow show <workflow_id>

# PASS: workflow completes with full history showing the interruption
```

## Acceptance Criteria

- [ ] Agent dispatch workflow runs end-to-end (validate → dispatch → collect → notify)
- [ ] Simulated agent timeout triggers exponential backoff retry (max 3 retries)
- [ ] Workflow is visible in Temporal Web UI with step-by-step timeline
- [ ] Workflow resumes after Temporal server restart (SC-001: 100% resume rate)
- [ ] `get_task_status` query returns current step and step history
- [ ] Heartbeat signals visible in workflow timeline
- [ ] Saga compensation fires on final failure
- [ ] All 4 steps appear in Temporal history with correct timestamps and durations
- [ ] `cargo test --lib` passes for agent_dispatch workflow module
