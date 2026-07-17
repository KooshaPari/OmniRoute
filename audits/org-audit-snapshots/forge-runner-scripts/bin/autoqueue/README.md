# bin/autoqueue/

The autoqueue is a queued-workload orchestrator: it accepts tasks, runs them
sequentially against a configurable set of providers (LLM APIs), and tracks
state in a JSON log.

## Scripts

### `autoqueue.sh`
Main entry point. Reads tasks from the queue file, dispatches them to the
next available provider, and writes results to the output log. Supports
rate-limiting, retry-with-backoff, and graceful shutdown on SIGTERM.

```bash
./autoqueue.sh start           # Start the queue worker
./autoqueue.sh stop            # Graceful stop
./autoqueue.sh status          # Show current state
./autoqueue.sh enqueue TASK    # Add a task to the queue
```

### `corpus-builder.sh`
Pre-builds the corpus that the queue operates on. Fetches documents from
configured sources (HTTP, file glob), normalizes encoding, deduplicates, and
writes the canonical corpus file.

```bash
./corpus-builder.sh --source <url-or-glob> --out corpus.jsonl
```

### `queue-manager.sh`
Companion to `autoqueue.sh` for queue inspection: shows pending tasks,
in-flight tasks, completed tasks, and failed tasks with last error.

```bash
./queue-manager.sh pending
./queue-manager.sh failed
./queue-manager.sh retry <task-id>
```

### `launcher_*.sh` (4 files)
Provider-specific launchers (one per provider: anthropic, openai, ollama,
local-fallback). Each wraps the provider's API with retry/timeout/JSON-mode.

### `monitor.sh`
Live TUI-style monitor (uses `less` if stdout is a TTY, plain text otherwise).
Refreshes every 2 seconds; Ctrl+C to exit.

### `synthesizer.sh`
Post-processing step: aggregates results across multiple completed tasks
into a single synthesis document (default JSON, with optional markdown
rendering via `synthesizer --format=md`).

## Provider configuration

Providers are configured in `~/.forge/autoqueue/config/providers.yaml`. The
launchers read this at startup. See `~/.forge/autoqueue/config/example.yaml`
for the canonical schema.

## Logs and state

- Active queue:   `~/.forge/autoqueue/state/queue.jsonl`
- Result log:     `~/.forge/autoqueue/state/results.jsonl`
- Error log:      `~/.forge/autoqueue/state/errors.log`
- PID file:       `~/.forge/autoqueue/state/autoqueue.pid`