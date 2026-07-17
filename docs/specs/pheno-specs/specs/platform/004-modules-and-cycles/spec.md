# Feature Specification: AgilePlus Modules & Cycles Domain Model

**Feature Branch**: `004-modules-and-cycles`
**Created**: 2026-03-03
**Status**: Draft
**Input**: AgilePlus native Modules and Cycles domain model

## User Scenarios & Testing

### User Story 1 - Module Hierarchy & Feature Grouping (Priority: P1)

A project lead creates a Module called "Authentication" and assigns three existing Features (login, SSO, password-reset) to it as owned children. They create a sub-Module "OAuth Providers" nested under Authentication. A fourth Feature "unified-search" is tagged to Authentication as a secondary association (it's primarily owned by the "Content" Module). CLI and dashboard views show Features grouped by Module, with tagged Features distinguished from owned ones.

**Why this priority**: Without Modules, teams with 20+ features have no organizational structure — this is the foundational grouping primitive.

**Independent Test**: Create Modules via CLI, assign Features, verify tree listing and Feature queries return correct groupings.

**Acceptance Scenarios**:

1. **Given** no Modules exist, **When** `agileplus module create "Authentication"` is run, **Then** a Module with slug "authentication" is persisted and returned
2. **Given** Module "Authentication" exists, **When** `agileplus module create "OAuth Providers" --parent authentication` is run, **Then** a child Module is created under Authentication
3. **Given** Feature "login" exists, **When** `agileplus module assign login authentication` is run, **Then** Feature.module_id is set to Authentication's id
4. **Given** Feature "unified-search" is owned by "Content", **When** `agileplus module tag unified-search authentication` is run, **Then** a tag record is created; `agileplus module show authentication` lists unified-search under "Tagged Features"
5. **Given** Module "Authentication" owns 3 Features, **When** `agileplus module list --tree` is run, **Then** output shows hierarchical tree with Feature counts

---

### User Story 2 - Cycle Lifecycle Planning (Priority: P1)

A PM creates Cycle "Sprint 2026-Q1-W10" with start 2026-03-03 and end 2026-03-14. They assign 5 Features from across two Modules. The Cycle tracks its own lifecycle (Draft → Active → Review → Shipped → Archived). Dashboard shows aggregate WP progress. The Cycle cannot transition to Shipped until all assigned Features are at least Validated.

**Why this priority**: Time-boxed planning is the core value proposition of Cycles — without lifecycle enforcement, it's just a label.

**Independent Test**: Create a Cycle, add Features, advance through lifecycle states, verify gate enforcement.

**Acceptance Scenarios**:

1. **Given** no Cycles exist, **When** `agileplus cycle create "Sprint W10" --start 2026-03-03 --end 2026-03-14` is run, **Then** a Cycle in Draft state is created
2. **Given** Cycle "Sprint W10" in Draft, **When** `agileplus cycle transition "Sprint W10" active` is run, **Then** Cycle moves to Active
3. **Given** Cycle has Feature "login" in Implementing state, **When** `agileplus cycle transition "Sprint W10" shipped` is run, **Then** transition is REJECTED with reason "Feature login not yet Validated"
4. **Given** all assigned Features are Validated or Shipped, **When** `agileplus cycle transition "Sprint W10" shipped` is run, **Then** Cycle transitions to Shipped
5. **Given** Cycle exists, **When** `agileplus cycle show "Sprint W10"` is run, **Then** output shows assigned Features, WP counts per state, and date range

---

### User Story 3 - Module-Scoped vs Cross-Module Cycles (Priority: P2)

A developer creates a Cycle scoped to the "Notifications" Module for a focused refactoring sprint. Only Features owned by or tagged to "Notifications" can be added. Separately, a PM creates a release Cycle with no module scope, spanning Authentication and Billing Modules.

**Why this priority**: Configurable scoping adds flexibility but builds on the base Cycle entity.

**Independent Test**: Create both scoped and unscoped Cycles, verify Feature assignment validation.

**Acceptance Scenarios**:

1. **Given** Module "Notifications" exists, **When** `agileplus cycle create "Notif Refactor" --start ... --end ... --module notifications` is run, **Then** Cycle is created with module_scope set
2. **Given** scoped Cycle, **When** attempting to add Feature "login" (owned by Authentication, not tagged to Notifications), **Then** operation is REJECTED with "Feature not in Module scope"
3. **Given** scoped Cycle, **When** adding Feature "alert-settings" (owned by Notifications), **Then** addition succeeds
4. **Given** unscoped Cycle (no --module), **When** adding Features from any Module, **Then** all additions succeed

---

### User Story 4 - Plane.so Bidirectional Sync (Priority: P2)

When a Module or Cycle is created in AgilePlus, it pushes to Plane.so as the corresponding Plane entity. When updated in Plane, changes pull back. Feature-to-Module and Feature-to-Cycle assignments sync as Plane issue-to-module and issue-to-cycle mappings.

**Why this priority**: Sync is essential for teams using Plane.so but builds on the domain model being correct first.

**Independent Test**: Create Module/Cycle in AgilePlus, verify Plane API calls, simulate inbound webhook, verify state update.

**Acceptance Scenarios**:

1. **Given** sync enabled, **When** Module "Auth" is created in AgilePlus, **Then** a Plane Module is created via POST to `/api/v1/workspaces/{slug}/projects/{id}/modules/`
2. **Given** sync mapping exists, **When** Plane Module name is updated via webhook, **Then** AgilePlus Module friendly_name is updated
3. **Given** Feature assigned to Module in AgilePlus, **When** sync runs, **Then** corresponding Plane issue is added to Plane Module
4. **Given** Cycle created in AgilePlus, **When** sync runs, **Then** Plane Cycle is created with matching dates and name
5. **Given** conflict (both sides changed), **When** sync runs, **Then** configured conflict_strategy applies

---

### User Story 5 - Dashboard Module & Cycle Views (Priority: P3)

Dashboard sidebar shows Module tree with expandable hierarchy and Feature counts. A Cycle kanban view shows Cycles as columns by state with Feature cards inside. Cycle detail page shows burndown of WPs.

**Why this priority**: Visual views are high-value but can be added after CLI and domain model are solid.

**Independent Test**: Verify dashboard endpoints return correct HTML with Module tree and Cycle kanban.

**Acceptance Scenarios**:

1. **Given** Modules with Features exist, **When** dashboard sidebar loads, **Then** Module tree is rendered with correct counts
2. **Given** Cycles in various states exist, **When** Cycle kanban page loads, **Then** Cycles appear in correct state columns
3. **Given** Cycle with assigned Features, **When** Cycle detail page loads, **Then** WP burndown and Feature progress are displayed

---

### Edge Cases

- **Circular Module hierarchy**: Attempting to set a Module's parent to itself or to a descendant is rejected
- **Feature with no Module**: Allowed — module_id is nullable for backward compatibility with existing Features
- **Empty Cycle**: Valid — a Cycle in Draft with no assigned Features is a planning placeholder
- **Overlapping Cycles**: Features can be in multiple concurrent Cycles
- **Module-scoped Cycle with subsequently-untagged Feature**: If a Feature is removed from a Module after being added to a scoped Cycle, the Feature remains in the Cycle (no cascade removal)
- **Deleting a Cycle**: Unlinks Features but does not change Feature states
- **Deleting a Module with children**: Rejected — must delete or reparent child Modules first
- **Plane sync conflict**: Uses existing conflict_strategy config (local-wins, remote-wins, manual)

## Requirements

### Functional Requirements

#### Module Entity

- **FR-M01**: System MUST support a Module entity with id, slug, friendly_name, description, parent_module_id (nullable), created_at, updated_at
- **FR-M02**: System MUST enforce tree hierarchy — Modules can nest, but circular references are rejected
- **FR-M03**: Each Feature MUST have an optional module_id foreign key for strict ownership (one Module per Feature)
- **FR-M04**: System MUST support many-to-many tagging via module_feature_tags join table
- **FR-M05**: Module queries MUST return both owned and tagged Features, distinguished by relationship type
- **FR-M06**: Module deletion MUST be rejected if it still owns Features or has child Modules
- **FR-M07**: Module slug MUST be unique among siblings (same parent_module_id)

#### Cycle Entity

- **FR-C01**: System MUST support a Cycle entity with id, name, description, state (CycleState), start_date, end_date, module_scope_id (nullable), created_at, updated_at
- **FR-C02**: CycleState MUST follow lifecycle: Draft → Active → Review → Shipped → Archived
- **FR-C03**: Feature-to-Cycle assignment MUST be many-to-many via cycle_features join table
- **FR-C04**: When module_scope_id is set, only Features owned by or tagged to that Module are assignable
- **FR-C05**: When module_scope_id is null, any Feature is assignable
- **FR-C06**: System MUST compute aggregate WP progress per Cycle (count per WpState across all assigned Features)
- **FR-C07**: Cycle transition to Shipped MUST be gated on all assigned Features being Validated or Shipped

#### Storage Port

- **FR-S01**: StoragePort MUST be extended with Module CRUD operations
- **FR-S02**: StoragePort MUST be extended with Cycle CRUD operations
- **FR-S03**: StoragePort MUST support module_feature_tags and cycle_features join table operations
- **FR-S04**: SQLite migrations MUST add modules, module_feature_tags, cycles, cycle_features tables and Feature.module_id column

#### CLI

- **FR-CLI01**: `agileplus module create|list|show|assign|tag|untag|delete` commands
- **FR-CLI02**: `agileplus cycle create|list|show|add|remove|transition` commands
- **FR-CLI03**: `agileplus module list --tree` MUST render hierarchical tree output

#### Dashboard

- **FR-D01**: Module tree view in sidebar with Feature counts
- **FR-D02**: Cycle kanban view with state columns and Feature cards
- **FR-D03**: Cycle detail page with WP burndown
- **FR-D04**: Module detail page with owned/tagged Feature lists

#### Plane.so Sync

- **FR-P01**: Module create/update MUST push to Plane.so Modules API
- **FR-P02**: Cycle create/update MUST push to Plane.so Cycles API
- **FR-P03**: Plane Module/Cycle updates MUST pull into AgilePlus via webhook or poll
- **FR-P04**: Feature-Module and Feature-Cycle assignments MUST sync to Plane issue-module and issue-cycle mappings
- **FR-P05**: Sync mappings MUST use existing sync_mappings infrastructure with entity_type discriminator

### Key Entities

- **Module**: Hierarchical grouping of Features. Has parent/child relationships and many-to-many tags. Maps to Plane.so Module.
- **Cycle**: Time-boxed implementation phase with lifecycle state machine. Contains Features via join table. Optionally scoped to a Module. Maps to Plane.so Cycle.
- **ModuleFeatureTag**: Join table linking Features to Modules (many-to-many secondary association)
- **CycleFeature**: Join table linking Features to Cycles (many-to-many)

## Success Criteria

### Measurable Outcomes

- **SC-001**: Teams can organize 50+ Features into a Module hierarchy navigable in under 3 CLI commands
- **SC-002**: Cycle-based planning allows selecting Features, enforcing time bounds, and gating completion on Feature states
- **SC-003**: Module and Cycle data round-trips through Plane.so sync without data loss (verified by automated contract tests)
- **SC-004**: All Module and Cycle operations available via CLI without requiring dashboard access
- **SC-005**: Dashboard renders Module tree and Cycle views with SSE-driven real-time updates

## Assumptions

- Plane.so API supports Module and Cycle CRUD (`/api/v1/workspaces/{slug}/projects/{id}/modules/` and `/cycles/`)
- Existing sync_mappings table can be extended with entity_type discriminator
- Dashboard SSE infrastructure (spec003) is available
- Backward compatibility: existing Features with no Module continue to work (module_id nullable)

## Dependencies

- spec003 (Platform Completion) — dashboard SSE, NATS event bus
- agileplus-plane crate — existing sync infrastructure
- agileplus-domain — Feature and WorkPackage entities

## Out of Scope

- Module/Cycle permissions (deferred to multi-user feature)
- Module templates or archetypes
- Cycle velocity/capacity planning algorithms
- Automatic Feature-to-Cycle assignment
- GitHub Projects sync for Modules/Cycles
