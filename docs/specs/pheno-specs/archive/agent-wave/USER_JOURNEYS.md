# User Journeys — Agent Wave

---

## UJ-1: Orchestrator Dispatching a Wave of Parallel Agents

**Actor**: Orchestration consumer (thegent, CI pipeline, or workflow engine)
**Goal**: Execute a set of independent tasks in parallel across multiple AI agents.

```
Consumer                    Agent Wave                    AgentAPI++
    |                           |                              |
    |-- Wave.create({           |                              |
    |     tasks: [T1,T2,T3],    |                              |
    |     policy: "max_cost:$5" |                              |
    |   }) -------------------> |                              |
    |                     [validate policy]                    |
    |                     [spawn 3 agent slots]                |
    |                           |-- dispatch(T1) -----------> |
    |                           |-- dispatch(T2) -----------> |
    |                           |-- dispatch(T3) -----------> |
    |                     [await completions]                  |
    |                           |<-- result(T1) ------------- |
    |                           |<-- result(T2) ------------- |
    |                           |<-- result(T3) ------------- |
    |<-- WaveResult ----------- |                              |
    |   { results: [...], cost: $1.23 }
```

**Steps**:
1. Consumer creates a `Wave` with a list of `Task` descriptors and a policy budget.
2. Agent Wave validates the policy (max cost, max agents, timeout).
3. Dispatcher spawns agent slots and dispatches tasks via AgentAPI++.
4. Wave monitors all agent results as they complete.
5. On full completion, `WaveResult` returned with per-task results and aggregate cost.

**Failure Paths**:
- Policy budget exceeded mid-wave: remaining tasks cancelled; partial results returned with `status: budget_exceeded`.
- Agent slot failure: task re-queued or failed with `status: agent_error`.

---

## UJ-2: Consumer Using Dependent (Sequential) Tasks

**Actor**: Workflow author
**Goal**: Express task dependencies so later tasks use output from earlier ones.

```
Consumer                    Agent Wave
    |                           |
    |-- Wave.create({           |
    |     tasks: [              |
    |       { id: "plan", ... },|
    |       { id: "impl",       |
    |         depends_on: "plan"}
    |     ]                     |
    |   }) -------------------> |
    |                     [build DAG]
    |                     [dispatch "plan" first]
    |                           |-- dispatch(plan) ---------> |
    |                           |<-- result(plan) ----------- |
    |                     [inject plan output into impl task]  |
    |                           |-- dispatch(impl) ---------> |
    |                           |<-- result(impl) ----------- |
    |<-- WaveResult ----------- |
```

**Steps**:
1. Consumer defines tasks with `depends_on` references.
2. Agent Wave builds a DAG from task dependencies.
3. Independent tasks dispatched in parallel; dependent tasks wait.
4. Outputs from upstream tasks injected into downstream task inputs automatically.

---

## UJ-3: Policy Federation Enforcement

**Actor**: Platform operator
**Goal**: Ensure all agent waves comply with organizational policy (cost, model tier, data residency).

```
Policy Config               Agent Wave                    AgentAPI++
    |                           |                              |
    |-- policy.toml:            |                              |
    |   max_cost_per_wave: $10  |                              |
    |   allowed_models: [...]   |                              |
    |   data_residency: "US"    |                              |
    |                           |                              |
Consumer                        |                              |
    |-- Wave.create(tasks) ---> |                              |
    |                     [evaluate policy against wave config]|
    |                     [reject if violates any rule]        |
    |<-- Err(PolicyViolation) - |                              |
    |   { rule: "max_cost", detail: "estimated $15 > $10" }   |
```

**Steps**:
1. Operator defines policy in `policy.toml` (loaded by Agent Wave at startup).
2. Consumer submits `Wave.create(tasks)`.
3. Agent Wave evaluates estimated cost, model tier, and data residency against policy.
4. Violations rejected with descriptive `PolicyViolation` error before any agent is dispatched.
5. Compliant waves proceed to dispatch.

---

## UJ-4: Agent Lifecycle Monitoring

**Actor**: Operations engineer
**Goal**: Observe agent lifecycle events (start, progress, complete, error) in real time.

```
Engineer                    Agent Wave
    |                           |
    |-- subscribe(wave_id) ---> |
    |                     [register event stream]
    |                           |
    |<-- AgentStarted(T1) ----- |
    |<-- AgentProgress(T1, 40%) |
    |<-- AgentCompleted(T1) --- |
    |<-- AgentError(T2, msg) -- |
    |<-- WaveCompleted -------- |
```

**Steps**:
1. Engineer subscribes to lifecycle events for a wave ID.
2. Agent Wave emits typed events: `AgentStarted`, `AgentProgress`, `AgentCompleted`, `AgentError`, `WaveCompleted`.
3. Engineer's subscriber receives events as SSE or typed channel stream.
4. On error events, engineer can inspect `AgentError.reason` for diagnostics.

---

## UJ-5: CI Pipeline Triggering a Wave for Code Review

**Actor**: CI pipeline (GitHub Actions, thegent CI)
**Goal**: Run parallel code review agents across multiple changed files.

```
CI Pipeline                 Agent Wave
    |                           |
    |-- Wave.create({           |
    |     tasks: changed_files.map(|f| review_task(f)),
    |     policy: "max_agents: 10, timeout: 300s"
    |   }) -------------------> |
    |                     [dispatch up to 10 review agents in parallel]
    |                     [collect review comments per file]
    |<-- WaveResult ----------- |
    |   { comments: [...], summary: "3 issues found" }
    |                           |
    |-- post_review_comments()  |
```

**Steps**:
1. CI pipeline collects changed file list from git diff.
2. Creates a `Wave` with one review task per file, bounded by `max_agents: 10`.
3. Agent Wave dispatches up to 10 agents in parallel; queues remaining tasks.
4. All review results aggregated into a `WaveResult`.
5. CI pipeline posts comments to PR via GitHub API.
