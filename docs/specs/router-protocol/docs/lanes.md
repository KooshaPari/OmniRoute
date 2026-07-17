# Execution Lanes

## Overview

Substrate's `wave` crate provides **three execution lanes** for dispatching
tasks to engines. The choice of lane is made by the supervisor based on the
Task's structure and the routing decision.

| Lane | When to use | Concurrency | Failure mode |
|---|---|---|---|
| **SYNC** | single-engine, blocking, simple request/response | 1 | bubble up |
| **FANOUT** | N independent engines, race for best result | semaphore-bounded (default 8) | partial ok |
| **TREE** | parent engine orchestrating child agents via a2a | recursive, depth-guarded | tree-failure rollup |

## SYNC lane

Single engine, single task. The supervisor calls `EnginePort::start()` →
`post_message()` → `dump()` → `extract_result()`. All events stream through
the mailbox. Failure bubbles up to the caller.

```rust
let session = engine.start(&task).await?;
engine.post_message(&session.conv_id, &prompt).await?;
let dump = engine.dump(&session.conv_id).await?;
let result = engine.extract_result(&session.conv_id).await?;
```

## FANOUT lane

The supervisor picks N engines (e.g. `agentapi-claude`, `cliproxy-gpt-4o`,
`forge-kimi`), dispatches the same task to each in parallel, and returns
the first non-erroring result. The semaphore bounds in-flight engines to
prevent resource exhaustion.

```rust
let runner = FanoutRunner::new(vec![
    Arc::new(engine_claude),
    Arc::new(engine_gpt4o),
    Arc::new(engine_kimi),
])
.with_semaphore(8);

let result = runner.dispatch(task).await?;
```

Partial-failure semantics: if engine X fails, the runner continues with the
remaining N-1. The result records which engines succeeded/failed for trace
analysis.

## TREE lane

The supervisor calls an **orchestrator engine** (e.g. `agentapi-claude`
with subagents enabled). The orchestrator spawns child agents via
`subagent_spawn` mailbox events, each child gets its own conv_id, and the
orchestrator collects results through the a2a task tree.

```rust
let runner = TreeRunner::new(Arc::new(orchestrator));
let root_task = a2a::TaskTree::new(root_conv_id);
let result = runner.run(root_task).await?;
```

The substrate `a2a` crate provides the task tree semantics (parents,
children, shared mailbox, fan-out per node, depth-bounded recursion).

## Choosing a lane

Default: **SYNC**. Use **FANOUT** if you have multiple candidate engines
and want the fastest/winning result. Use **TREE** if the task inherently
requires decomposition into sub-tasks.

The routing decision can override the lane default via
`RouterDispatch.lane: "sync" | "fanout" | "tree"`.

## Integration test

The `substrate/crates/wave-3lane-tests` crate exercises all three lanes
against in-memory stub engines + `engine-agentapi` (offline mode). See
[`substrate@55ae4bc`](https://github.com/KooshaPari/substrate/commit/55ae4bc).