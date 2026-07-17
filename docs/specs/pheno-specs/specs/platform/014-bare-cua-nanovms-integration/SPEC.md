# bare-cua nanovms Integration

## Meta

- **ID**: 014-bare-cua-nanovms-integration
- **Title**: bare-cua nanovms Integration — Sandboxed CUA Execution
- **Created**: 2026-04-04
- **State**: specified
- **Scope**: bare-cua, nanovms (cross-project integration)

## Context

bare-cua is a Rust-based Computer-Use Agent (CUA) framework that enables AI agents to interact with computer systems through tool execution, browser automation, and file system operations. Currently, these operations run in the host environment with limited isolation, creating security risks when executing untrusted code.

nanovms provides a 3-tier isolation architecture (WASM sandbox, gVisor containers, Firecracker microVMs) with cross-platform support (macOS/Lima, Windows/WSL2, Linux/KVM). Integrating these two projects would enable secure, isolated CUA execution with tiered security based on trust levels.

## Problem Statement

bare-cua executes agent tools directly on the host system:
- **No isolation**: Tool execution shares host resources
- **Security risk**: Untrusted code can access sensitive files/systems
- **Platform inconsistency**: Different isolation on macOS vs Linux vs Windows
- **No recovery**: Failed/corrupted operations require manual cleanup

## Goals

- Enable 3-tier sandboxing for bare-cua tool execution
- Tier 1 (WASM): Fast tool execution (~1ms startup, ~1MB memory)
- Tier 2 (gVisor): Browser automation and semi-trusted code (~90ms startup)
- Tier 3 (Firecracker): Full isolation for untrusted file operations (~125ms startup)
- Cross-platform support via nanovms adapters
- Automatic cleanup and snapshot recovery

## Non-Goals

- Rewriting bare-cua core CUA logic
- Modifying nanovms Go implementation (use as-is via FFI/gRPC)
- Supporting non-tiered execution modes
- Browser engine changes (keep existing automation)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        bare-cua Agent                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │ Planner  │ │  Tools   │ │ Browser  │ │  File    │          │
│  │          │ │          │ │  Auto    │ │  System  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴─────────────┴─────────────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │  Tier 1 │      │  Tier 2 │      │  Tier 3 │
   │  WASM   │      │ gVisor  │      │MicroVM  │
   │ Sandbox │      │Container│      │Firecracker
   │ ~1ms    │      │ ~90ms   │      │ ~125ms  │
   └────┬────┘      └────┬────┘      └────┬────┘
        └─────────────────┴─────────────────┘
                          │
                    ┌─────┴─────┐
                    │  nanovms  │
                    │   Go Lib  │
                    └─────┬─────┘
                          │
        ┌─────────────────┼─────────────────┐
        ▼                 ▼                 ▼
   ┌─────────┐      ┌─────────┐      ┌─────────┐
   │macOS/Lima│     │Win/WSL2 │      │Linux/KVM│
   └─────────┘      └─────────┘      └─────────┘
```

## Integration Interface

### Option A: Rust FFI to Go (Recommended)

Create `bare-cua-nanovms-ffi` crate:
- Link to nanovms Go library via cgo → cbindgen
- Expose Rust-safe wrappers for sandbox operations
- Async support via tokio

### Option B: gRPC Sidecar

- nanovms exposes gRPC service
- bare-cua connects via `nanovms-client` crate
- Better for remote/cloud scenarios

### Option C: HTTP REST API

- nanovms REST API (future feature)
- Simple but higher latency
- Good for prototyping

## Work Packages

| WP | Title | Owner | State | Est |
|----|-------|-------|-------|-----|
| WP1 | nanovms Rust client library | TBD | planned | 3d |
| WP2 | bare-cua sandbox trait | TBD | planned | 2d |
| WP3 | Tier 1 (WASM) adapter | TBD | planned | 3d |
| WP4 | Tier 2 (gVisor) adapter | TBD | planned | 4d |
| WP5 | Tier 3 (Firecracker) adapter | TBD | planned | 5d |
| WP6 | Integration tests | TBD | planned | 3d |
| WP7 | Documentation & examples | TBD | planned | 2d |

## Acceptance Criteria

- [ ] bare-cua can execute tools in WASM sandbox (Tier 1)
- [ ] Browser automation runs in gVisor container (Tier 2)
- [ ] File operations can use Firecracker microVM (Tier 3)
- [ ] Cross-platform: macOS, Linux, Windows all supported
- [ ] Startup times meet tier targets (1ms/90ms/125ms)
- [ ] Automatic cleanup after sandbox destruction
- [ ] Snapshot/recovery works for long-running agents

## Dependencies

- nanovms Go library must expose FFI-friendly API
- bare-cua must define sandbox trait interface
- Cross-compilation setup for cgo on all platforms

## Related

- worklogs/INTEGRATION.md — Cross-project integration analysis
- nanovms README — 3-tier isolation architecture
- bare-cua AGENTS.md — CUA framework design

## FR Traceability

| FR | Description | WP |
|----|-------------|----|
| FR-014-001 | WASM sandbox execution | WP3 |
| FR-014-002 | gVisor container execution | WP4 |
| FR-014-003 | Firecracker microVM execution | WP5 |
| FR-014-004 | Cross-platform sandboxing | WP1, WP6 |
| FR-014-005 | Snapshot/recovery | WP5 |
