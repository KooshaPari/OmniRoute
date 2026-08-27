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

The limits below are part of the contract, not performance targets. A test
must fail when an implementation exceeds them or retries a request after a
terminal outcome. The canonical gate IDs are reused by the repository
traceability ledger and CI summaries.

| Gate ID                     | Gate                    | Evidence                                                                                            | Completion condition                                                                                                                                                                     |
| --------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `DESKTOP-TAURI-BUILD`       | Tauri build             | `apps/desktop` build output and CI run                                                              | macOS build succeeds and the artifact is inspectable                                                                                                                                     |
| `DESKTOP-RUNTIME-LIFECYCLE` | Runtime lifecycle       | Rust unit/integration tests                                                                         | start, readiness, stop, repeated calls, and sanitized error paths are deterministic                                                                                                      |
| `DESKTOP-UI-PARITY`         | UI parity               | browser/Tauri parity matrix and existing browser tests                                              | every listed workflow has a shared fixture and passing test                                                                                                                              |
| `ROUTING-HEALING-BOUNDS`    | Routing/healing         | failure matrix plus `tests/integration/gemini-combo-cooldown-wait.test.ts` and resilience E2E tests | at most 2 retries for one provider request, at most 3 provider candidates per request, one response-repair pass, and no retry after a terminal quality-gate or malformed-response result |
| `DESKTOP-INACTIVE-POLICY`   | Inactive desktop policy | `npm run check:active-desktop` and workflow scan                                                    | no active release/setup gate requires Electron or Electrobun                                                                                                                             |
| `DESKTOP-TRACEABILITY`      | Traceability            | AgilePlus or repository fallback ledger                                                             | requirement, owner, files, tests, CI run IDs, and acceptance state are linked                                                                                                            |
| `RELEASE-READINESS`         | Release                 | `qgate`, `Scorecard`, security aggregate, cross-platform, and release-readiness hosted checks       | all required checks are green on one SHA and human package acceptance is recorded                                                                                                        |

Coverage is a separate invariant of `RELEASE-READINESS`: the existing
repository threshold remains at least 60% statements, lines, functions, and
branches, and any new desktop/routing fixture must be included in the relevant
ratchet rather than excluded. A local pass is evidence only; hosted checks and
human acceptance remain required.
