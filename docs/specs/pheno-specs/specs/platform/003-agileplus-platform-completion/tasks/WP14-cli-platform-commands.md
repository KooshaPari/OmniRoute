---
work_package_id: WP14
title: CLI Platform Commands
lane: "done"
dependencies: []
base_branch: main
base_commit: 01aaf89e12d5a77cf4c76d0503a7d25b479c1df4
created_at: '2026-03-02T12:16:19.765874+00:00'
subtasks: [T084, T085, T086, T087, T088, T089]
shell_pid: "35810"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

## Objective

Add platform management, event query, and dashboard CLI commands to `crates/agileplus-subcmds`.

Implementation command: `spec-kitty implement WP14 --base WP10`

## Subtasks

### T084: `agileplus platform up`

Start the platform and all services:

**Behavior:**
- Detect `process-compose` binary in PATH
- If missing: print install instructions and exit with error
  ```
  Error: process-compose not found.
  Install from: https://github.com/F1bonacc1/process-compose
  ```
- If found: spawn `process-compose up -f process-compose.yml`
- Wait for all health checks to pass (poll `/health` every 2s, timeout 60s)
- Display status table on success

**Output:**
```
Starting AgilePlus platform...
process-compose starting (pid 12345)

Waiting for services to be ready...
[████░░░░░░] 40% (NATS connecting, Dragonfly starting, ...)

✓ All services healthy!

Service        Status    Uptime    Port
─────────────────────────────────────
API            Healthy   2s        8080
NATS           Healthy   2s        4222
Dragonfly      Healthy   2s        6379
Neo4j          Healthy   2s        7687
MinIO          Healthy   2s        9000
SQLite         Ready     2s        -

Platform ready. Dashboard: http://localhost:8080/dashboard
```

### T085: `agileplus platform down`

Stop all platform services:

**Behavior:**
- Run `process-compose down`
- Wait for graceful shutdown (max 30s)
- Print confirmation

**Output:**
```
Stopping AgilePlus platform...
✓ process-compose stopped
✓ All services shut down gracefully
Platform down.
```

### T086: `agileplus platform status`

Query service health and display status:

**Behavior:**
- Query `GET /health` endpoint
- If API running: display per-service status from response
- If API not running: attempt direct pings to individual services
- Display table with color-coding

**Output (all healthy):**
```
Service        Status    Latency    Uptime       Last Check
───────────────────────────────────────────────────────────────
API            Healthy   1ms        3h 22m       2s ago
NATS           Healthy   2ms        3h 22m       2s ago
Dragonfly      Healthy   1ms        3h 22m       2s ago
Neo4j          Healthy   5ms        3h 22m       2s ago
MinIO          Healthy   8ms        3h 22m       2s ago
SQLite         Healthy   3ms        3h 22m       2s ago

Overall Status: HEALTHY
```

**Output (degraded):**
```
Service        Status      Latency    Uptime       Last Check
──────────────────────────────────────────────────────────────
API            Healthy     1ms        3h 22m       2s ago
NATS           Degraded    450ms      3h 22m       2s ago ⚠
Dragonfly      Healthy     1ms        3h 22m       2s ago
Neo4j          Unhealthy   TIMEOUT    --           5m ago ✗
MinIO          Healthy     8ms        3h 22m       2s ago
SQLite         Healthy     3ms        3h 22m       2s ago

Overall Status: DEGRADED (1 service slow, 1 service down)
```

**Color-coding:**
- Green: healthy (latency < 50ms)
- Yellow: degraded (latency 50-200ms or non-critical service down)
- Red: unavailable (critical service unreachable)

### T087: `agileplus platform logs [service]`

Display and follow service logs:

**Behavior:**
- Run `process-compose logs [service]`
- Options:
  - `--follow` / `-f` (stream logs)
  - `--lines N` (show last N lines, default 100)
  - `--since <duration>` (e.g., `--since 1h`)
- If no service specified: show combined logs for all services

**Examples:**
```bash
agileplus platform logs              # All logs, last 100 lines
agileplus platform logs nats         # NATS logs only
agileplus platform logs api --follow # Stream API logs
agileplus platform logs neo4j --since 30m  # Neo4j logs from last 30m
```

**Output:**
```
[14:23:45] [api] Server listening on 0.0.0.0:8080
[14:23:46] [nats] Server started (pid=12456)
[14:23:47] [dragonfly] Ready to accept connections on port 6379
[14:23:48] [neo4j] Started:instance=neo4j
[14:23:49] [minio] Endpoint: http://localhost:9000
```

### T088: `agileplus events`

Query and display event log:

**Options:**
- `--feature <slug>` (filter by feature)
- `--since <duration>` (e.g., `1h`, `7d`, `2025-03-01`)
- `--type <event_type>` (e.g., `feature_created`, `state_changed`)
- `--actor <name>` (e.g., `spec-kitty`, `sync-oracle`)
- `--entity-type <type>` (e.g., `feature`, `work-package`)
- `--format [table|json|jsonl]` (default: table)
- `--limit N` (default: 50)

**Default output (table):**
```
agileplus events --since 2h

Time                  | Entity           | Type               | Actor       | Summary
─────────────────────────────────────────────────────────────────────────────────────────
2026-03-02 12:45:30   | Feature: 5       | feature_created    | spec-kitty  | Auth Flow created
2026-03-02 12:44:15   | WP: 8            | state_changed      | sync-oracle | database-schema: specified → implementing
2026-03-02 12:43:00   | Feature: 5       | sync_conflict      | platform    | Conflict detected (resolved: LocalWins)
2026-03-02 12:30:00   | WP: 7            | updated            | user        | api-endpoints: description updated
2026-03-02 12:20:45   | Feature: 3       | state_changed      | system      | api-design: researched → specified
```

**JSON output:**
```bash
agileplus events --since 1h --format json
[
  {
    "id": 1234,
    "timestamp": "2026-03-02T12:45:30Z",
    "event_type": "feature_created",
    "entity_type": "feature",
    "entity_id": 5,
    "actor": "spec-kitty",
    "payload": {"title": "Auth Flow", "state": "created"}
  },
  ...
]
```

**Filtered example:**
```bash
agileplus events --feature auth-flow --since 24h
```

### T089: `agileplus dashboard [open|port <N>]`

Launch and manage dashboard:

**Subcommands:**
- `open`: Launch default browser to dashboard URL
- `port <N>`: Configure dashboard port (default 8080, write to config)

**Examples:**
```bash
agileplus dashboard open          # Open http://localhost:8080/dashboard
agileplus dashboard port 3000     # Set port to 3000, write to config
agileplus dashboard               # Alias for `open`
```

**Behavior:**
- `open`: Check if API is running on configured port. If not, suggest `agileplus platform up`
- Launch browser using system default: `open` (macOS), `xdg-open` (Linux), `start` (Windows)
- Print dashboard URL to stdout
- Verify browser opened successfully; on failure, print URL for manual navigation

**Output:**
```bash
agileplus dashboard open
Opening http://localhost:8080/dashboard in browser...
✓ Dashboard opened

agileplus dashboard port 3000
Dashboard port updated to 3000.
(Requires server restart to take effect. Run: agileplus platform down && agileplus platform up)
```

**Error cases:**
```bash
agileplus dashboard open
Error: API server not running on port 8080.
Start the platform with: agileplus platform up

agileplus dashboard open --port 9000
Opening http://localhost:9000/dashboard in browser...
✗ Could not open browser automatically.
Manual URL: http://localhost:9000/dashboard
```

## Definition of Done

- `agileplus platform up` starts all services and waits for health checks
- `agileplus platform down` gracefully stops services
- `agileplus platform status` shows accurate service health
- `agileplus platform logs` displays and follows service logs
- `agileplus events` queries and formats event log with filters
- `agileplus dashboard` opens/configures dashboard
- All commands handle errors gracefully with helpful messages
- Color-coded output improves readability (green/yellow/red for status)

## Activity Log

- 2026-03-02T12:16:19Z – claude-opus – shell_pid=35810 – lane=doing – Assigned agent via workflow command
- 2026-03-02T12:25:03Z – claude-opus – shell_pid=35810 – lane=for_review – Ready for review: platform up/down/status/logs, events query, dashboard CLI commands (57 tests)
- 2026-03-02T23:19:37Z – claude-opus – shell_pid=35810 – lane=done – Merged to main, 516 tests passing
