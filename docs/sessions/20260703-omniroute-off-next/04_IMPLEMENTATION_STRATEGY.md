# OmniRoute Off-Next Implementation Strategy

## Decision

OmniRoute should not replace the Next dashboard with one transport or one client stack. The production-grade target is a layered control plane:

| Layer                   | Transport                                                  | Primary clients                                                      | Purpose                                                                      |
| ----------------------- | ---------------------------------------------------------- | -------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| Local privileged daemon | Unix domain socket on macOS/Linux, named pipe on Windows   | Native tray, Tauri desktop, service manager                          | Start/stop, local credentials, process control, low-latency trusted IPC      |
| Internal RPC            | gRPC/Twirp/Connect-style RPC over local socket or loopback | Desktop shells, automation, future Go/Rust daemon                    | Typed daemon commands and high-throughput control operations                 |
| Live event stream       | WebSocket and SSE                                          | Web console, desktop, tray                                           | Logs, request traces, quota pressure, provider health, token/request streams |
| Admin read aggregation  | GraphQL or typed query facade                              | Enterprise dashboards, audit cockpit                                 | Cross-resource read views without many round trips                           |
| Compatibility HTTP      | REST/OpenAPI under `/api/management/*`                     | Browser console, scripts, simple clients, Vercel-compatible surfaces | Stable lowest-common contract and easy deployment                            |

## Why REST still exists

REST is the compatibility layer, not the high-performance backend. It keeps the web console easy to host, allows static clients to work through Caddy/Vercel, and gives CLI scripts a stable API. High-frequency and privileged paths should move to local IPC/RPC and streaming transports.

## Cross-platform native clients

| Platform | First-class mechanism                                        | Notes                                                            |
| -------- | ------------------------------------------------------------ | ---------------------------------------------------------------- |
| macOS    | SwiftUI/AppKit tray + Unix domain socket                     | Best native menu-bar UX and launchd integration                  |
| Windows  | Tauri/Wails tray + named pipe or localhost RPC               | Use Windows Service integration for daemon lifecycle             |
| Linux    | Tauri/Wails tray + Unix domain socket + systemd user service | Support AppIndicator where available; fallback to desktop window |

## Forward DAG

```text
/api/management facade
  -> static management-console
  -> native macOS tray
  -> Windows/Linux tray shells
  -> local daemon IPC/RPC
  -> WS/SSE live telemetry
  -> GraphQL read aggregation
  -> remove Next from runtime packaging
```

## Slice 2 additions

Added concrete transport entrypoints:

| Artifact                                 | Role                                                                                                                                                  |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `src/app/api/management/events/route.ts` | SSE stream for management snapshots and heartbeats. Expands later to live logs, traces, quota pressure, provider status, and daemon lifecycle events. |
| `src/server/management/ipc/contracts.ts` | Cross-platform IPC endpoint and command contract for macOS/Linux Unix sockets, Windows named pipes, and loopback fallback.                            |
| `src/server/management/rpc/protocol.ts`  | Newline-delimited JSON RPC frame codec for local daemon commands over sockets/pipes.                                                                  |
| `management-console/src/events.ts`       | Browser client for management SSE events.                                                                                                             |

Next implementation order:

```text
1. Replace placeholder SSE events with real provider/log/quota signals.
2. Add daemon process that owns UDS/named-pipe listeners.
3. Wire macOS tray, Windows tray, Linux tray, and Tauri shell to RPC first.
4. Keep REST as browser-compatible fallback.
5. Add GraphQL only for multi-resource read aggregation after facade parity.
```
