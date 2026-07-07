# ADR-0006: kbridge — Unix-socket + MessagePack-RPC

**Status**: Accepted (2026-07-04)

## Context

The webview (browser or Tauri) cannot open Unix sockets directly. The BFF (apps/web) must broker between HTTP/WS and the Rust gateway daemon's Unix-socket daemon.

## Decision

- Daemon at `/var/run/omniroute/gateway.sock` (overridable via env).
- 4-byte BE length prefix + MessagePack payload (rmp-serde).
- Ops: `ping`, `health`, `combo_resolve`, `usage_record`.
- Browser → `/api/kbridge` WS → BFF → Unix socket → daemon.
- Tauri webview → `tauri::command` → `omniroute-gateway::KbridgeClient` → Unix socket directly.

## Consequences

- Low-latency local RPC; no HTTP overhead for hot paths.
- Wire format is versioned via the `id` field (UUID v4).
