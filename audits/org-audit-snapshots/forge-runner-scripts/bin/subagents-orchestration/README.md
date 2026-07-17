# bin/subagents-orchestration/

Scripts for launching, resuming, and monitoring the Forge subagent fleet.
All scripts are idempotent and re-runnable.

## Launch

### `launch_all_subagents.sh`
Spins up the full subagent roster in their target CLIs. Each subagent is
opened in a dedicated Ghostty window with its CLI (claude / codex / forge)
and a unique working directory under `~/.agents/workspaces/<id>/`.

```bash
./launch_all_subagents.sh                # Default roster (12 subagents)
./launch_all_subagents.sh --roster core  # Only "core" tier
./launch_all_subagents.sh --dry-run      # Print what would happen
```

### `open_subagents.sh`
Lightweight wrapper around `launch_all_subagents.sh` with sensible defaults
for the most common case (full roster, 12 windows).

```bash
./open_subagents.sh
```

### `open_ghostty_windows.sh`
Lower-level: opens N empty Ghostty windows in parallel, with a startup
command. Used by `launch_all_subagents.sh` to open the windows before
each CLI is launched.

```bash
./open_ghostty_windows.sh --count 12 --startup-cmd "./run-cli.sh"
```

## Resume

### `resume_all_subagents.sh`
Walks the subagent roster, checks each one's `last_heartbeat` timestamp, and
re-launches any subagent whose heartbeat is older than the staleness
threshold (default 5 minutes). Idempotent: running it twice is a no-op
once the roster is healthy.

```bash
./resume_all_subagents.sh                    # Default threshold
./resume_all_subagents.sh --stale-secs 180   # 3 minutes
./resume_all_subagents.sh --id codex-2       # Just one subagent
```

## Window helpers

### `open_parent_windows.sh`
Opens the parent (orchestrator) windows that watch the subagent fleet.
Includes a top-level status window (showing all 12 subagents) and a log
tail window per CLI type.

### `open_extra_parents.sh`
Adds additional parent windows on top of `open_parent_windows.sh` (e.g. a
dedicated crash-recovery window, a tasks board window, a memory monitor).

## DAG orchestration

### `dag_orchestrator.py`
Python orchestrator that reads a DAG plan (a JSON file describing tasks and
their dependencies) and drives the subagent fleet through it. Each task in
the DAG is assigned to a subagent; the orchestrator waits for dependencies
to complete before unblocking each task.

```python
from dag_orchestrator import DAGOrchestrator
orch = DAGOrchestrator.from_plan_file("plan.json")
orch.run()
```

### `dag_dispatcher.py`
Lower-level dispatch helper. Given a single task spec, finds an available
subagent of the right type and dispatches the task to it. Used by
`dag_orchestrator.py` but can be called directly for ad-hoc dispatch.

```python
from dag_dispatcher import dispatch_task
result = dispatch_task(task_spec, timeout=300)
```

### `dag_launch_2026_06_13.sh`
Snapshot of the 2026-06-13 DAG launch script. Kept for reproducibility
of that specific wave; new launches should use the upstream
`launch_all_subagents.sh` + `dag_orchestrator.py` pattern.

## File layout

- `launch_all_subagents.sh`       — main entry point
- `resume_all_subagents.sh`       — health check + restart
- `open_*.sh`                     — Ghostty window helpers
- `dag_orchestrator.py`           — DAG plan runner
- `dag_dispatcher.py`             — single-task dispatcher
- `dag_launch_2026_06_13.sh`      — historical snapshot