# WP08: Rollback Capability

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 3 - Observability
**Wave**: 2
**Dependencies**: WP03, WP04, WP05 (all workflows must be running in Temporal/Hatchet)
**Author**: Claude Sonnet 4.6

## Mission

Ensure NATS can be restored as the primary workflow engine within 10 minutes of a critical failure. This is the safety net that makes the Big Bang migration acceptable: if Temporal/Hatchet fails catastrophically, NATS is restored in minutes, not hours.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-006, SC-007
- Plan: `../plan.md` — WP08 section
- Depends on: `WP03-agent-dispatch.md`, `WP04-hatchet-ci.md`, `WP05-data-sync.md`

## Context

After WP03/WP04/WP05, all workflow logic has been migrated to Temporal and Hatchet. NATS still runs but is idle for workflow purposes (it's retained as a pure event bus in WP09).

The rollback procedure:
1. Feature flag `WORKFLOW_ENGINE` switches between `temporal`, `hatchet`, and `nats`
2. All dispatch callers read this env var and route accordingly
3. NATS workflow logic is preserved in a git branch until the 48-hour observation period confirms success
4. The rollback itself is: change the env var, restart workers, verify NATS takes over

## What to Build

### 1. Feature Flag Configuration

```rust
// crates/temporal-worker/src/config.rs

#[derive(Debug, Clone)]
pub enum WorkflowEngine {
    Temporal,
    Hatchet,
    Nats,  // fallback: read from NATS queue
}

impl WorkflowEngine {
    pub fn from_env() -> Self {
        match std::env::var("WORKFLOW_ENGINE").as_deref() {
            Ok("hatchet") => Self::Hatchet,
            Ok("nats") => Self::Nats,
            _ => Self::Temporal,  // default to Temporal
        }
    }
}

// Central dispatch router
pub async fn dispatch_workflow(
    task: AgentTask,
    engine: &WorkflowEngine,
) -> anyhow::Result<WorkflowResult> {
    match engine {
        WorkflowEngine::Temporal => dispatch_to_temporal(&task).await,
        WorkflowEngine::Hatchet => dispatch_to_hatchet(&task).await,
        WorkflowEngine::Nats => dispatch_to_nats(&task).await,
    }
}
```

### 2. NATS Fallback Dispatch

```rust
// crates/temporal-worker/src/nats_fallback.rs
// Kept as-is from current implementation. This is the rollback path.

use nats::{Client, ClientOptions};
use serde_json::json;

pub async fn dispatch_to_nats(task: AgentTask) -> anyhow::Result<()> {
    let nats_url = std::env::var("NATS_URL").unwrap_or("nats://localhost:4222".into());
    let client = Client::connect(ClientOptions::default(), &nats_url).await?;

    let payload = json!({
        "task_id": task.task_id,
        "agent_type": task.agent_type,
        "prompt": task.prompt,
        "context": task.context,
    });

    client
        .publish("agent.dispatch", &payload.into_bytes()?)
        .await?;

    Ok(())
}
```

### 3. Preserve NATS Implementation in Git Branch

```bash
# Create rollback branch preserving current NATS workflow logic
git checkout -b rollback/nats-workflow-logic

# Document where the rollback branch lives:
echo "Rollback branch: rollback/nats-workflow-logic" >> docs/ROLLBACK.md
```

### 4. `docs/ROLLBACK.md`

```markdown
# Rollback Procedure: NATS JetStream Workflow Restoration

## When to Roll Back

Trigger rollback if ANY of:
- SC-007 fails: NATS cannot be restored within 10 minutes
- SC-003 fails: Temporal completion rate < 95% for > 15 minutes
- Temporal server is down for > 30 minutes with no recovery
- Data integrity issue discovered in Temporal workflow execution

## Rollback Procedure

### Step 1: Declare rollback
```bash
# Alert the team
curl -X POST "$SLACK_WEBHOOK_URL" \
  -d '{"text":"🚨 ROLLBACK: Switching WORKFLOW_ENGINE=nats"}'
```

### Step 2: Toggle feature flag
```bash
# In process-compose.yml or .env:
WORKFLOW_ENGINE=nats

# Apply:
docker compose -f infra/temporal/docker-compose.yml down
docker compose -f infra/hatchet/docker-compose.yml down

# Restart NATS workers
docker compose up -d nats-worker-agent-dispatch
docker compose up -d nats-worker-ci-pipeline
docker compose up -d nats-worker-data-sync
```

### Step 3: Verify NATS is accepting work
```bash
# Submit a test dispatch
nats pub agent.dispatch '{"task_id":"rollback-test-001","agent_type":"code","prompt":"echo rollback-test","context":{}}'

# Verify consumer picks it up
nats sub agent.dispatch  --count=1
```

### Step 4: Monitor for 1 hour
```bash
# Watch NATS consumer lag
docker logs nats-worker-agent-dispatch --tail=100 | grep -E "received|completed|failed"

# Check latency
curl -s localhost:8080/metrics | grep nats_dispatch_latency
```

### Step 5: Confirm rollback complete
```bash
# Verify all new dispatches go to NATS
curl -s http://localhost:8080/metrics | grep temporal_workflow_started_total
# Should be 0 after rollback

curl -s http://localhost:8222/metrics | grep nats_dispatch_total
# Should be increasing
```

## Time Budget

| Step | Target Time |
|------|-------------|
| Declare rollback | 1 minute |
| Toggle env var + restart | 5 minutes |
| Verify NATS accepting work | 3 minutes |
| Monitor 1 hour | 60 minutes |
| **Total** | **< 10 minutes to confirmed recovery** |

## Post-Rollback Investigation

After rollback is confirmed:
1. Collect Temporal logs: `docker logs temporal --tail=1000 > temporal-crash-$(date +%Y%m%d).log`
2. Collect Jaeger traces leading up to failure
3. Open incident report in Plane.so
4. Do not attempt re-migration until root cause is identified
```

### 5. Rollback Test (execute before WP09)

```bash
#!/bin/bash
# scripts/test-rollback.sh

set -e

echo "=== Testing Rollback Procedure ==="

# Step 1: Current state should be Temporal
CURRENT=$(grep WORKFLOW_ENGINE .env 2>/dev/null || echo "WORKFLOW_ENGINE=temporal")
echo "Current engine: $CURRENT"

# Step 2: Switch to NATS
echo "Switching WORKFLOW_ENGINE=nats..."
sed -i.bak 's/WORKFLOW_ENGINE=.*/WORKFLOW_ENGINE=nats/' .env
docker compose down temporal hatchet
docker compose up -d nats-worker-agent-dispatch
sleep 10

# Step 3: Verify NATS is accepting
echo "Verifying NATS is accepting work..."
TEST_RESULT=$(timeout 30 nats sub agent.dispatch --count=1 2>/dev/null | grep "rollback-test" || echo "")
if [ -n "$TEST_RESULT" ]; then
  echo "✅ NATS accepting work"
else
  echo "❌ NATS not accepting work - ABORT"
  exit 1
fi

# Step 4: Switch back to Temporal
echo "Reverting to Temporal..."
sed -i 's/WORKFLOW_ENGINE=.*/WORKFLOW_ENGINE=temporal/' .env
docker compose down nats-worker-agent-dispatch
docker compose -f infra/temporal/docker-compose.yml up -d
sleep 30

echo "✅ Rollback test complete. Total time: $SECONDS seconds"
```

## Acceptance Criteria

- [ ] Feature flag `WORKFLOW_ENGINE` routes all dispatch to Temporal by default
- [ ] Setting `WORKFLOW_ENGINE=nats` routes dispatch to NATS (rollback path tested)
- [ ] Setting `WORKFLOW_ENGINE=hatchet` routes dispatch to Hatchet
- [ ] Rollback branch `rollback/nats-workflow-logic` exists and builds cleanly
- [ ] Rollback procedure documented in `docs/ROLLBACK.md`
- [ ] Rollback test executed: NATS accepts work within 10 minutes of toggle
- [ ] Rollback test verified in test environment before production cutover
