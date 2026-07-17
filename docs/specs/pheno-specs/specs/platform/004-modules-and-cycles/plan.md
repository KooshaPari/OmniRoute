# Implementation Plan: AgilePlus Modules & Cycles Domain Model

**Branch**: `004-modules-and-cycles` | **Date**: 2026-03-03 | **Spec**: [spec.md](spec.md)

## Summary

Add first-class Module and Cycle entities to the AgilePlus domain model. Modules provide hierarchical feature grouping with strict ownership plus many-to-many tagging. Cycles provide time-boxed lifecycle phases (Draft→Active→Review→Shipped→Archived) with configurable module scoping. Extends StoragePort, CLI, dashboard, and Plane.so sync.

## Technical Context

**Language/Version**: Rust nightly (2024 edition)
**Primary Dependencies**: serde, chrono, sha2 (domain); rusqlite (storage); clap (CLI); axum + askama (dashboard); reqwest (Plane sync)
**Storage**: SQLite via agileplus-sqlite with new migrations
**Testing**: cargo test (unit) + integration tests
**Target Platform**: macOS, Linux, Windows
**Project Type**: Multi-crate workspace (existing pattern)
**Performance Goals**: CLI <50ms startup, SQLite queries <5ms p99
**Constraints**: Domain crate zero external deps (except serde/chrono/sha2)
**Scale/Scope**: 50+ Modules, 100+ Cycles, 500+ Features

## Constitution Check

*GATE: Passed*

- Domain crate zero-dependency rule: ✓ Module and Cycle entities use only serde/chrono/sha2
- No `unwrap()` in production: ✓ All Result-based error handling
- `thiserror` for errors: ✓ Extends existing DomainError
- Newtype IDs: Will use i64 consistent with existing Feature/WP pattern (constitution says newtype but existing code uses raw i64 — follow existing pattern for consistency)
- Agent-first: ✓ All operations exposed via CLI (programmatic) and dashboard API
- Conventional commits: ✓ `feat(domain):`, `feat(sqlite):`, etc.
- FR/WP traceability: ✓ Module headers will reference FR-M/FR-C/FR-S IDs

## Project Structure

### Source Code (modified/new files)

```
crates/agileplus-domain/src/domain/
├── module.rs              # NEW: Module entity, ModuleFeatureTag
├── cycle.rs               # NEW: Cycle entity, CycleState, CycleFeature
├── mod.rs                 # MODIFIED: add pub mod module; pub mod cycle;
├── feature.rs             # MODIFIED: add module_id field
└── state_machine.rs       # MODIFIED: add CycleState (or in cycle.rs)

crates/agileplus-domain/src/ports/
└── storage.rs             # MODIFIED: add Module/Cycle CRUD trait methods

crates/agileplus-sqlite/src/
├── migrations/
│   └── 006_modules_cycles.sql  # NEW: tables for modules, cycles, joins
└── lib.rs (or storage.rs)      # MODIFIED: implement new StoragePort methods

crates/agileplus-cli/src/commands/
├── module.rs              # NEW: module subcommands
└── cycle.rs               # NEW: cycle subcommands

crates/agileplus-api/src/
├── routes/
│   ├── module.rs          # NEW: dashboard routes
│   └── cycle.rs           # NEW: dashboard routes
└── templates/
    ├── module_tree.html   # NEW: sidebar module tree
    ├── cycle_kanban.html  # NEW: cycle board view
    └── cycle_detail.html  # NEW: cycle detail with burndown

crates/agileplus-plane/src/
├── outbound.rs            # MODIFIED: add push_module, push_cycle
├── inbound.rs             # MODIFIED: add pull_module, pull_cycle
└── webhook.rs             # MODIFIED: handle module/cycle webhook events
```

## Complexity Tracking

No constitution violations — feature follows existing patterns exactly.
ted structure and reference the real
directories captured above]

## Complexity Tracking

*Fill ONLY if Constitution Check has violations that must be justified*

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| [e.g., 4th project] | [current need] | [why 3 projects insufficient] |
| [e.g., Repository pattern] | [specific problem] | [why direct DB access insufficient] |