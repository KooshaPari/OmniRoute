---
work_package_id: WP18
title: CLI Device Commands
lane: "done"
dependencies: []
base_branch: main
base_commit: bd5ea46e023042041a01000dba720d62833421a9
created_at: '2026-03-02T17:31:34.639953+00:00'
subtasks: [T104, T105, T106]
shell_pid: "6998"
agent: "claude-opus"
reviewed_by: "Koosha Paridehpour"
review_status: "approved"
history:
- date: '2026-03-02'
  action: created
  by: spec-kitty
---

# WP18: CLI Device Commands

Implementation command: `spec-kitty implement WP18 --base WP17`

## Objective

Add device management CLI commands to `crates/agileplus-subcmds` for peer discovery, synchronization, and status reporting.

## Subtasks

### T104: `agileplus device discover`

Implement the `device discover` subcommand that queries Tailscale peers and checks for AgilePlus availability.

**Command:**
```bash
agileplus device discover
```

**Implementation:**
1. Query Tailscale local API for peer list (via `agileplus-p2p::discovery::discover_peers()`)
2. For each peer, attempt connection to AgilePlus port (default 3000)
3. If connection succeeds, probe endpoint (e.g., `GET /health`) to confirm AgilePlus is running
4. Determine version if available (from `/api/version` or health endpoint)
5. Format and display as table

**Output:**
```
DEVICE ID                          HOSTNAME          TAILSCALE IP   STATUS    LAST SEEN             AGILEPLUS VERSION
550e8400-e29b-41d4-a716-446655440000  my-laptop         100.x.x.1      online    2026-03-02 10:15:30   0.1.0
550e8400-e29b-41d4-a716-446655440001  server-1          100.x.x.2      online    2026-03-02 10:10:15   0.1.0
550e8400-e29b-41d4-a716-446655440002  old-device        100.x.x.3      offline   2026-02-28 09:45:00   (unknown)
```

**Status values:**
- `online`: Device reachable and AgilePlus responding
- `offline`: Device reachable but AgilePlus not responding
- `unreachable`: Device not reachable on Tailscale network

**Flags:**
- `--timeout <seconds>`: Connection timeout per peer (default: 2)
- `--port <port>`: Custom AgilePlus port (default: 3000)
- `--json`: Output as JSON instead of table

**Error handling:**
- If Tailscale local API not available, suggest installing Tailscale
- If no peers found, inform user that device is not on a Tailscale network

### T105: `agileplus device sync`

Implement the `device sync` subcommand for triggering P2P event replication.

**Commands:**
```bash
# Sync with all discovered peers
agileplus device sync --all

# Sync with specific peer
agileplus device sync --peer 550e8400-e29b-41d4-a716-446655440001

# Auto-sync if only one peer discovered
agileplus device sync
```

**Implementation:**
1. If `--peer` is specified, sync with that device only
2. If `--all` is specified, discover peers and sync with all online peers
3. If neither flag is specified and exactly one peer is discovered, sync automatically
4. If no `--peer` and multiple peers found, error: "Multiple peers found. Use --all or specify --peer"
5. Call `agileplus-p2p::replication::replicate_events()` for each peer
6. Call `agileplus-p2p::vector_clock::sync_with_peer()` to apply events and advance vector clocks
7. Display sync report with statistics

**Output:**
```
Syncing with server-1 (550e8400-e29b-41d4-a716-446655440001)...

Sync Report:
  Events sent:        15
  Events received:    8
  Conflicts detected: 2
  Conflicts resolved: 2 (local wins)
  Sync duration:      1.234s

Updated sync vector:
  Feature/1:     5
  Feature/2:     3
  WorkPackage/1: 7

Sync completed successfully.
```

**Flags:**
- `--peer <device-id>`: Sync with specific peer
- `--all`: Sync with all discovered peers
- `--strategy <strategy>`: Conflict resolution strategy: `local-wins`, `remote-wins`, `merge` (default: `local-wins`)
- `--dry-run`: Show what would be synced without applying changes
- `--verbose`: Show event-by-event details

**Error handling:**
- If peer is offline, report and continue to next peer (if `--all`)
- If sync fails with a peer, log error and allow retry
- Handle network interruptions gracefully (reconnect with backoff)

### T106: `agileplus device status`

Implement the `device status` subcommand for viewing local device info and sync state.

**Command:**
```bash
agileplus device status
```

**Implementation:**
1. Query local DeviceNode from SQLite
2. Fetch sync vector (map of entity → last synced sequence)
3. Query sync mappings for all known peers
4. Fetch timestamp of last sync per peer
5. Count pending outbound events (events not yet synced to all peers)
6. Format as structured output

**Output:**
```
Local Device Status
===================

Device ID:      550e8400-e29b-41d4-a716-446655440000
Hostname:       my-laptop
Tailscale IP:   100.x.x.1
Created:        2026-02-15 14:30:00 UTC

Sync State
==========

Known Peers:    2
  server-1     (online, last sync: 2026-03-02 10:15:30)
  old-device   (offline, last sync: 2026-02-28 09:45:00)

Sync Vector (per-entity last sequence):
  Feature/1:              5
  Feature/2:              3
  WorkPackage/1:          7
  WorkPackage/2:          2

Pending Outbound Events: 3
  (events created locally, not yet synced to all peers)

Health Check:
  Database:       OK
  Local Tailscale: connected (100.x.x.1)
  NATS (replication): not configured
```

**Flags:**
- `--json`: Output as JSON for scripting
- `--peers-only`: Show only peer sync state (omit local device info)
- `--vectors-only`: Show only sync vectors (omit peer list)

**Error handling:**
- If device not initialized, suggest running `agileplus device discover` first
- If database unavailable, report degraded status

## Definition of Done

- [ ] `agileplus device discover` lists peers with status and AgilePlus version
- [ ] `agileplus device sync --all` discovers and syncs with all online peers
- [ ] `agileplus device sync --peer <id>` syncs with specified peer
- [ ] `agileplus device sync` auto-syncs if single peer found
- [ ] Sync reports show events sent/received and conflicts resolved
- [ ] `agileplus device status` shows local device and sync vectors
- [ ] Status command includes pending outbound events count
- [ ] All commands support `--json` output for scripting
- [ ] Error messages guide users (missing Tailscale, multiple peers, offline devices)
- [ ] Integration test: discover peers, trigger sync, verify status updates
- [ ] Documentation: Device sync workflow and conflict resolution strategy

## Activity Log

- 2026-03-02T17:31:35Z – claude-opus – shell_pid=6998 – lane=doing – Assigned agent via workflow command
- 2026-03-02T20:47:23Z – claude-opus – shell_pid=6998 – lane=for_review – Ready for review: CLI device discover/sync/status with 22 tests
- 2026-03-02T23:19:47Z – claude-opus – shell_pid=6998 – lane=done – Merged to main, 516 tests passing
