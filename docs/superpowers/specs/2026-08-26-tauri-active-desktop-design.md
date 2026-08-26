# Tauri Active Desktop Design

**Status:** approved 2026-08-26

## Goal

Make Tauri 2 the only active OmniRoute desktop architecture while preserving Electron and Electrobun as explicitly inactive historical candidates. Keep SvelteKit + Hono as the web UI and API boundary, and prove desktop/API parity across the core user workflows.

## Architecture

The active desktop client is a thin Tauri 2 shell in `apps/desktop`. It serves the existing SvelteKit frontend and communicates with the local OmniRoute runtime through a typed command boundary. The shell owns lifecycle, health, local storage path selection, and secure command dispatch; routing and response behavior remain in the existing TypeScript/Bifrost/Rust layers.

Electron and Electrobun remain in the repository for provenance and rollback evidence but are removed from active setup, release, and required CI paths. No source or Git history is deleted.

## Required behavior

1. `apps/desktop` contains a buildable Tauri 2 project with a macOS-first development path and explicit capability permissions.
2. The desktop shell loads the Svelte frontend and exposes typed commands for runtime start/stop, readiness, dashboard URL, data directory, and safe error reporting.
3. The desktop smoke test proves launch, readiness, dashboard rendering, and graceful shutdown.
4. The Svelte browser and Tauri desktop surfaces share API contracts and parity fixtures for authentication, provider setup, routing, streaming, health, resilience, settings, audit export, and recovery.
5. Active documentation and scripts reference Tauri. Electron/Electrobun references are marked inactive or historical and are not required release gates.
6. Traceability records map each requirement to files, tests, CI jobs, and human acceptance.

## Non-goals

- Introducing Askama or another server-rendered UI stack.
- Rewriting the routing core or replacing the existing Bifrost/TypeScript fallback contract.
- Deleting Electron, Electrobun, or the archived Tauri design evidence.
- Claiming parity from compilation alone; parity requires workflow tests and packaged smoke evidence.

## Acceptance gates

| Gate | Evidence | Completion condition |
|---|---|---|
| Tauri build | `apps/desktop` build output and CI run | macOS build succeeds and artifact is inspectable |
| Runtime lifecycle | Rust unit/integration tests | start, readiness, stop, and error paths are deterministic |
| UI parity | browser/Tauri parity matrix | every listed workflow has a shared fixture and passing test |
| Routing/healing | failure matrix and existing resilience tests | bounded retry, fallback, quality gate, and recovery behavior pass |
| Inactive desktop policy | docs/scripts/workflow scan | no active release/setup gate requires Electron or Electrobun |
| Traceability | AgilePlus or repository fallback ledger | requirement, owner, files, tests, run IDs, and acceptance state are linked |
| Release | hosted required checks | qgate, Scorecard/security aggregate, cross-platform, and release readiness are green on one SHA |
