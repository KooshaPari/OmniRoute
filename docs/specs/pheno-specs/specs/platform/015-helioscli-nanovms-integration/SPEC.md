# heliosCLI nanovms Integration

## Meta

- **ID**: 015-helioscli-nanovms-integration
- **Title**: heliosCLI nanovms Integration — Cross-Platform Sandboxing
- **Created**: 2026-04-04
- **State**: specified
- **Scope**: heliosCLI, nanovms (cross-project integration)

## Context

heliosCLI provides a Rust-based CLI for AI coding agents with multi-backend support. Currently, it includes `helios-linux-sandbox` which uses Landlock + seccomp for Linux-only sandboxing. This limits heliosCLI's security model to Linux platforms, leaving macOS and Windows without equivalent isolation.

nanovms provides a unified 3-tier isolation architecture with cross-platform adapters (macOS/Lima, Windows/WSL2, Linux/KVM). Integrating nanovms would give heliosCLI consistent sandboxing across all platforms, plus additional tiers (WASM, microVMs) not currently available.

## Problem Statement

heliosCLI sandboxing is Linux-only:
- **Limited platform support**: No sandboxing on macOS or Windows
- **Single tier**: Only Landlock+seccomp, no WASM or microVM options
- **Manual setup**: Users must configure Landlock/seccomp manually
- **No VM isolation**: Can't isolate entire agent sessions

## Goals

- Replace Linux-only sandbox with cross-platform nanovms integration
- Tier 1 (WASM): Fast command execution (~1ms startup)
- Tier 2 (gVisor): Semi-trusted code isolation (~90ms startup)
- Tier 3 (Firecracker): Full microVM isolation (~125ms startup)
- Support macOS (Lima), Windows (WSL2), Linux (KVM) equally
- Maintain backward compatibility with existing policies

## Non-Goals

- Removing existing Linux sandbox (keep as fallback)
- Supporting platforms beyond macOS/Windows/Linux
- Changing heliosCLI core agent logic
- Modifying nanovms Go implementation

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      heliosCLI (Rust)                            │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐          │
│  │   CLI    │ │   TUI    │ │   Exec   │ │  MCP     │          │
│  │          │ │          │ │          │ │  Server  │          │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └────┬─────┘          │
└───────┼─────────────┼─────────────┼─────────────┼──────────────┘
        │             │             │             │
        └─────────────┴──────┬──────┴─────────────┘
                             │
                    ┌─────────┴─────────┐
                    │  helios-sandbox   │
                    │     trait         │
                    └─────────┬─────────┘
                             │
        ┌──────────────────────┼──────────────────────┐
        │                      │                      │
        ▼                      ▼                      ▼
  ┌─────────────┐      ┌─────────────┐      ┌─────────────┐
  │   Legacy    │      │  nanovms    │      │   Future    │
  │linux-sandbox│      │  adapter    │      │   WASM      │
  │ (Landlock)  │      │             │      │             │
  └─────────────┘      └──────┬──────┘      └─────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
   ┌─────────┐          ┌─────────┐          ┌─────────┐
   │  Tier 1 │          │  Tier 2 │          │  Tier 3 │
   │  WASM   │          │ gVisor  │          │MicroVM  │
   │ Sandbox │          │Container│          │Firecracker
   └─────────┘          └─────────┘          └─────────┘
```

## Integration Strategy

### Phase 1: Adapter Trait (heliosCLI)

Define `SandboxExecutor` trait in heliosCLI:
```rust
trait SandboxExecutor {
    async fn execute(&self, cmd: Command, tier: Tier) -> Result<Output>;
    async fn create_session(&self, config: SessionConfig) -> Result<Session>;
    async fn destroy_session(&self, id: SessionId) -> Result<()>;
}
```

### Phase 2: nanovms Client Crate

Create `nanovms-client` Rust crate:
- FFI bindings to nanovms Go library
- gRPC client alternative
- Async/await support via tokio

### Phase 3: Adapter Implementation

Implement `nanovms-sandbox-adapter` crate:
- Implements `SandboxExecutor` trait
- Maps heliosCLI policies to nanovms tiers
- Configuration translation

### Phase 4: Platform Rollout

1. Linux: Add nanovms as option alongside legacy
2. macOS: nanovms via Lima (primary sandbox)
3. Windows: nanovms via WSL2 (primary sandbox)

## Work Packages

| WP | Title | Owner | State | Est |
|----|-------|-------|-------|-----|
| WP1 | Define SandboxExecutor trait | TBD | planned | 2d |
| WP2 | Create nanovms-client crate | TBD | planned | 4d |
| WP3 | Implement nanovms-sandbox-adapter | TBD | planned | 5d |
| WP4 | Linux integration (nanovms + legacy) | TBD | planned | 3d |
| WP5 | macOS integration (Lima) | TBD | planned | 4d |
| WP6 | Windows integration (WSL2) | TBD | planned | 4d |
| WP7 | Policy mapping & validation | TBD | planned | 3d |
| WP8 | Integration tests (all platforms) | TBD | planned | 5d |
| WP9 | Documentation & migration guide | TBD | planned | 2d |

## Acceptance Criteria

- [ ] heliosCLI uses nanovms on macOS (Lima) for sandboxing
- [ ] heliosCLI uses nanovms on Windows (WSL2) for sandboxing
- [ ] heliosCLI uses nanovms on Linux (KVM) alongside legacy
- [ ] All 3 tiers available: WASM, gVisor, Firecracker
- [ ] Existing policies work unchanged (backward compatible)
- [ ] Startup times: Tier 1 <5ms, Tier 2 <150ms, Tier 3 <200ms
- [ ] Integration tests pass on all 3 platforms

## Dependencies

- nanovms Go library with FFI or gRPC interface
- heliosCLI SandboxExecutor trait definition
- Platform CI for macOS, Windows, Linux testing

## Related

- worklogs/INTEGRATION.md — Cross-project integration analysis
- heliosCLI AGENTS.md — heliosCLI architecture
- nanovms README — 3-tier isolation details

## FR Traceability

| FR | Description | WP |
|----|-------------|----|
| FR-015-001 | SandboxExecutor trait | WP1 |
| FR-015-002 | nanovms Rust client | WP2 |
| FR-015-003 | macOS Lima sandboxing | WP5 |
| FR-015-004 | Windows WSL2 sandboxing | WP6 |
| FR-015-005 | Linux KVM sandboxing | WP4 |
| FR-015-006 | Tier 1/2/3 support | WP3 |
| FR-015-007 | Backward compatibility | WP7 |
