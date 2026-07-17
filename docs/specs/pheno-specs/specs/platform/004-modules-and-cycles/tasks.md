# Work Package Index: 004 Modules & Cycles

**Feature**: 004-modules-and-cycles
**Total WPs**: 7 | **Total Subtasks**: 38
**MVP Scope**: WP01 → WP02 → WP03 → WP04 = Domain + Storage + CLI (4 WPs)
**Full Scope**: + WP05 (Dashboard) + WP06 (Plane Sync) + WP07 (Integration Tests)

---

## Dependency Graph

```
WP01 (Domain Entities)
├── WP02 (Storage Port + SQLite)  [depends: WP01]
│   ├── WP03 (CLI Module Commands)  [depends: WP02]
│   ├── WP04 (CLI Cycle Commands)   [depends: WP02]
│   ├── WP05 (Dashboard Views)      [depends: WP02]
│   └── WP06 (Plane.so Sync)        [depends: WP02]
└── WP07 (Integration Tests)        [depends: WP03, WP04]
```

**Parallelizable**: WP03, WP04, WP05, WP06 can all run in parallel after WP02.

---

## Phase 1 — Domain Model

### WP01: Domain Entities — Module & Cycle (6 subtasks, ~350 lines)

**Goal**: Add Module, Cycle, CycleState, ModuleFeatureTag, CycleFeature to agileplus-domain and extend Feature with module_id.
**Priority**: P1 | **Dependencies**: none
**FRs**: FR-M01, FR-M02, FR-M03, FR-M04, FR-M07, FR-C01, FR-C02, FR-C03, FR-C04, FR-C05, FR-C07
**Prompt**: `tasks/WP01-domain-entities.md`

Subtasks:
- [ ] T001: Create Module struct with slug, friendly_name, description, parent_module_id
- [ ] T002: Create ModuleFeatureTag struct (module_id, feature_id, created_at)
- [ ] T003: Create CycleState enum with transition validation (Draft→Active→Review→Shipped→Archived)
- [ ] T004: Create Cycle struct with lifecycle state machine and module scope
- [ ] T005: Create CycleFeature struct and module-scope validation logic
- [ ] T006: Extend Feature with optional module_id field, extend DomainError

---

## Phase 2 — Storage

### WP02: Storage Port Extension + SQLite Adapter (7 subtasks, ~450 lines)

**Goal**: Extend StoragePort trait with Module/Cycle CRUD and implement in SQLite adapter.
**Priority**: P1 | **Dependencies**: WP01
**FRs**: FR-S01, FR-S02, FR-S03, FR-S04, FR-M05, FR-M06, FR-C06
**Prompt**: `tasks/WP02-storage-adapter.md`

Subtasks:
- [ ] T007: Add Module CRUD methods to StoragePort trait
- [ ] T008: Add Cycle CRUD methods to StoragePort trait
- [ ] T009: Add join table methods (tag/untag, add/remove Feature from Cycle)
- [ ] T010: Create SQLite migration 010_modules_cycles.sql (4 tables + indexes + ALTER)
- [ ] T011: Implement Module CRUD in SQLite adapter (with circular ref check)
- [ ] T012: Implement Cycle CRUD in SQLite adapter (with aggregate WP progress)
- [ ] T013: Implement join table operations and module-scope validation in SQLite

---

## Phase 3 — CLI (parallelizable)

### WP03: CLI Module Commands (5 subtasks, ~350 lines)

**Goal**: Add `agileplus module` subcommand group with create, list, show, assign, tag, untag, delete.
**Priority**: P1 | **Dependencies**: WP02
**FRs**: FR-CLI01, FR-CLI03
**Prompt**: `tasks/WP03-cli-module.md`

Subtasks:
- [ ] T014: Create module.rs command module with ModuleArgs enum (create, list, show, assign, tag, untag, delete)
- [ ] T015: Implement module create (with --parent flag) and module delete (with child/feature guards)
- [ ] T016: Implement module list (flat + --tree recursive) and module show (owned + tagged features)
- [ ] T017: Implement module assign/tag/untag commands
- [ ] T018: Wire module commands into main.rs Commands enum + unit tests

### WP04: CLI Cycle Commands (5 subtasks, ~350 lines)

**Goal**: Add `agileplus cycle` subcommand group with create, list, show, add, remove, transition.
**Priority**: P1 | **Dependencies**: WP02
**FRs**: FR-CLI02
**Prompt**: `tasks/WP04-cli-cycle.md`

Subtasks:
- [ ] T019: Create cycle.rs command module with CycleArgs enum
- [ ] T020: Implement cycle create (--start, --end, --module scope) and cycle list (by state)
- [ ] T021: Implement cycle show (assigned features, WP progress aggregate, date range)
- [ ] T022: Implement cycle add/remove (Feature assignment with scope validation)
- [ ] T023: Implement cycle transition (with gate enforcement for Shipped) + wire into main.rs + tests

---

## Phase 4 — Dashboard

### WP05: Dashboard Module & Cycle Views (5 subtasks, ~400 lines)

**Goal**: Add Module tree sidebar, Cycle kanban, and Cycle detail views to dashboard.
**Priority**: P3 | **Dependencies**: WP02
**FRs**: FR-D01, FR-D02, FR-D03, FR-D04
**Prompt**: `tasks/WP05-dashboard-views.md`

Subtasks:
- [ ] T024: Add Module and Cycle API routes in agileplus-api (list, show, tree)
- [ ] T025: Create module_tree.html Askama template (recursive tree with feature counts)
- [ ] T026: Create cycle_kanban.html template (columns by CycleState, feature cards)
- [ ] T027: Create cycle_detail.html template (WP burndown, feature progress table)
- [ ] T028: Wire routes into API router, add SSE event types for module/cycle changes

---

## Phase 5 — Plane.so Sync

### WP06: Plane.so Module & Cycle Sync (5 subtasks, ~400 lines)

**Goal**: Bidirectional sync of Modules and Cycles with Plane.so API.
**Priority**: P2 | **Dependencies**: WP02
**FRs**: FR-P01, FR-P02, FR-P03, FR-P04, FR-P05
**Prompt**: `tasks/WP06-plane-sync.md`

Subtasks:
- [ ] T029: Extend PlaneClient with module CRUD API methods (POST/PUT/DELETE /modules/)
- [ ] T030: Extend PlaneClient with cycle CRUD API methods (POST/PUT/DELETE /cycles/)
- [ ] T031: Implement outbound push for Module/Cycle create/update/delete events
- [ ] T032: Implement inbound pull/webhook for Plane Module/Cycle changes
- [ ] T033: Add sync_mappings entries for module and cycle entity types + assignment sync

---

## Phase 6 — Quality

### WP07: Integration Tests (5 subtasks, ~350 lines)

**Goal**: End-to-end tests covering Module→Cycle→Feature lifecycle through CLI.
**Priority**: P1 | **Dependencies**: WP03, WP04
**FRs**: SC-001, SC-002
**Prompt**: `tasks/WP07-integration-tests.md`

Subtasks:
- [ ] T034: Test Module hierarchy CRUD lifecycle (create tree, assign features, list --tree, delete guards)
- [ ] T035: Test Cycle lifecycle (create, add features, transition through states, gate enforcement)
- [ ] T036: Test Module-scoped Cycle (scope validation, rejection of out-of-scope features)
- [ ] T037: Test backward compatibility (existing features with no module_id still work)
- [ ] T038: Test edge cases (circular module ref, overlapping cycles, empty cycle, delete with children)

---

## Subtask Index

| ID | Description | WP | Parallel |
|----|-------------|-----|----------|
| T001 | Module struct | WP01 | |
| T002 | ModuleFeatureTag struct | WP01 | [P] T001 |
| T003 | CycleState enum + transitions | WP01 | [P] T001 |
| T004 | Cycle struct | WP01 | |
| T005 | CycleFeature + scope validation | WP01 | |
| T006 | Feature.module_id + DomainError | WP01 | [P] T001 |
| T007 | StoragePort Module CRUD | WP02 | |
| T008 | StoragePort Cycle CRUD | WP02 | [P] T007 |
| T009 | StoragePort join table ops | WP02 | |
| T010 | SQLite migration 010 | WP02 | |
| T011 | SQLite Module CRUD impl | WP02 | |
| T012 | SQLite Cycle CRUD impl | WP02 | [P] T011 |
| T013 | SQLite join table impl | WP02 | |
| T014 | CLI module command scaffold | WP03 | |
| T015 | CLI module create/delete | WP03 | |
| T016 | CLI module list/show | WP03 | |
| T017 | CLI module assign/tag/untag | WP03 | |
| T018 | CLI module wiring + tests | WP03 | |
| T019 | CLI cycle command scaffold | WP04 | |
| T020 | CLI cycle create/list | WP04 | |
| T021 | CLI cycle show | WP04 | |
| T022 | CLI cycle add/remove | WP04 | |
| T023 | CLI cycle transition + tests | WP04 | |
| T024 | Dashboard API routes | WP05 | |
| T025 | Module tree template | WP05 | [P] T024 |
| T026 | Cycle kanban template | WP05 | [P] T024 |
| T027 | Cycle detail template | WP05 | [P] T024 |
| T028 | SSE events + router wiring | WP05 | |
| T029 | Plane module API methods | WP06 | |
| T030 | Plane cycle API methods | WP06 | [P] T029 |
| T031 | Outbound push module/cycle | WP06 | |
| T032 | Inbound pull/webhook | WP06 | |
| T033 | Sync mappings + assignment sync | WP06 | |
| T034 | Integration: module hierarchy | WP07 | |
| T035 | Integration: cycle lifecycle | WP07 | [P] T034 |
| T036 | Integration: scoped cycles | WP07 | [P] T034 |
| T037 | Integration: backward compat | WP07 | [P] T034 |
| T038 | Integration: edge cases | WP07 | |
