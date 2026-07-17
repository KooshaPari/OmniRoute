# Data Model: AgilePlus — Spec-Driven Development Engine

**Date**: 2026-02-27
**Feature**: [spec.md](spec.md)

## Entity Relationship Diagram

```
┌──────────────┐       ┌──────────────────┐       ┌───────────────────┐
│   Feature    │1─────*│  Work Package    │1─────*│    Evidence       │
│              │       │                  │       │                   │
│ id (PK)      │       │ id (PK)          │       │ id (PK)           │
│ slug         │       │ feature_id (FK)  │       │ wp_id (FK)        │
│ friendly_name│       │ title            │       │ fr_id             │
│ state        │       │ state            │       │ type              │
│ spec_hash    │       │ sequence         │       │ artifact_path     │
│ target_branch│       │ file_scope[]     │       │ created_at        │
│ created_at   │       │ acceptance_criteria│      └───────────────────┘
│ updated_at   │       │ agent_id         │
└──────┬───────┘       │ pr_url           │
       │               │ pr_state         │
       │               │ created_at       │
       │               │ updated_at       │
       │               └──────────────────┘
       │
       │1─────*┌──────────────────────┐
       │       │ Governance Contract  │
       │       │                      │
       │       │ id (PK)              │
       │       │ feature_id (FK)      │
       │       │ version              │
       │       │ rules (JSON)         │
       │       │ bound_at             │
       │       └──────────────────────┘
       │
       │1─────*┌──────────────────────┐
       │       │    Audit Entry       │
       │       │                      │
       │       │ id (PK)              │
       │       │ feature_id (FK)      │
       │       │ wp_id (FK, nullable) │
       │       │ timestamp            │
       │       │ actor                │
       │       │ transition           │
       │       │ evidence_refs (JSON) │
       │       │ prev_hash (BLOB)     │
       │       │ hash (BLOB)          │
       │       └──────────────────────┘

┌──────────────────┐       ┌──────────────────┐
│  Policy Rule     │       │    Metric        │
│                  │       │                  │
│ id (PK)          │       │ id (PK)          │
│ domain           │       │ feature_id (FK)  │
│ rule (JSON)      │       │ command          │
│ active           │       │ duration_ms      │
│ created_at       │       │ agent_runs       │
│ updated_at       │       │ review_cycles    │
└──────────────────┘       │ timestamp        │
                           └──────────────────┘

┌──────────────────┐       ┌──────────────────┐       ┌───────────────────────┐
│  Backlog Item    │       │   Sync State     │       │ SubCommand Invocation │
│                  │       │                  │       │                       │
│ id (PK)          │       │ id (PK)          │       │ id (PK)               │
│ feature_id (FK)  │       │ entity_type      │       │ feature_id (FK)       │
│ wp_id (FK)       │       │ entity_id        │       │ wp_id (FK)            │
│ type             │       │ mirror           │       │ command               │
│ title            │       │ mirror_id        │       │ args (JSON)           │
│ body             │       │ mirror_url       │       │ caller                │
│ priority         │       │ last_synced_at   │       │ result                │
│ state            │       │ body_hash (BLOB) │       │ duration_ms           │
│ external_ref     │       └──────────────────┘       │ timestamp             │
│ tags (JSON)      │                                  └───────────────────────┘
│ triaged_by       │
│ created_at       │
└──────────────────┘

┌──────────────────┐
│ WP Dependency    │
│                  │
│ wp_id (FK)       │
│ depends_on (FK)  │
│ type             │  (data, file_overlap, explicit)
└──────────────────┘
```

## Entity Definitions

### Feature

The root aggregate. Represents a unit of work from idea to shipment.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| slug | TEXT | UNIQUE, NOT NULL | Kebab-case identifier (e.g., `001-spec-driven-development-engine`) |
| friendly_name | TEXT | NOT NULL | Human-readable name |
| state | TEXT | NOT NULL, CHECK(valid state) | Current lifecycle state |
| spec_hash | BLOB | NOT NULL | SHA-256 of current spec.md content |
| target_branch | TEXT | NOT NULL, DEFAULT 'main' | Git branch to merge into |
| created_at | TEXT | NOT NULL, ISO 8601 | Creation timestamp |
| updated_at | TEXT | NOT NULL, ISO 8601 | Last modification timestamp |

**Valid states**: `created`, `specified`, `researched`, `planned`, `implementing`, `validated`, `shipped`, `retrospected`

**State transitions**:
```
created → specified        (specify command completes)
specified → researched     (research command completes)
researched → planned       (plan command completes)
planned → implementing     (implement command starts)
implementing → validated   (validate command passes all gates)
validated → shipped        (ship command merges + archives)
shipped → retrospected     (retrospective command completes, optional)
```

Skip transitions allowed with governance exception: any state → next+N with warning logged.

### Work Package (WP)

A decomposed implementation unit within a feature.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| feature_id | INTEGER | FK → features.id, NOT NULL | Parent feature |
| title | TEXT | NOT NULL | WP title (e.g., "Implement SQLite adapter") |
| state | TEXT | NOT NULL, CHECK(valid state) | Current WP state |
| sequence | INTEGER | NOT NULL | Execution order within feature |
| file_scope | TEXT | JSON array | Declared file paths this WP touches |
| acceptance_criteria | TEXT | NOT NULL | Markdown, traced to FR IDs |
| agent_id | TEXT | nullable | Assigned agent identifier |
| pr_url | TEXT | nullable | GitHub PR URL when created |
| pr_state | TEXT | nullable | open, review, changes_requested, approved, merged |
| worktree_path | TEXT | nullable | Absolute path to worktree |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

**Valid states**: `planned`, `doing`, `review`, `done`, `blocked`

### Governance Contract

Defines required evidence and policy rules for state transitions.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| feature_id | INTEGER | FK → features.id, NOT NULL | Bound feature |
| version | INTEGER | NOT NULL, DEFAULT 1 | Contract version (immutable once bound) |
| rules | TEXT | NOT NULL, JSON | Array of rule objects |
| bound_at | TEXT | NOT NULL | ISO 8601, when contract was bound to feature |

**Rule schema** (JSON):
```json
{
  "transition": "implementing → validated",
  "required_evidence": [
    {"fr_id": "FR-001", "type": "test_result", "min_coverage": 80},
    {"fr_id": "FR-020", "type": "security_scan", "max_critical": 0}
  ],
  "policy_refs": ["POL-001", "POL-002"]
}
```

### Audit Entry

Hash-chained immutable record of every state transition.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Sequential ID |
| feature_id | INTEGER | FK → features.id, NOT NULL | Related feature |
| wp_id | INTEGER | FK → work_packages.id, nullable | Related WP (if WP-level transition) |
| timestamp | TEXT | NOT NULL | ISO 8601, UTC |
| actor | TEXT | NOT NULL | "user", "agent:claude-code", "agent:codex", "system" |
| transition | TEXT | NOT NULL | State transition (e.g., "specified → researched") |
| evidence_refs | TEXT | JSON array | References to evidence records |
| prev_hash | BLOB(32) | NOT NULL | SHA-256 of previous entry (zeros for first) |
| hash | BLOB(32) | NOT NULL, UNIQUE | SHA-256(id ‖ timestamp ‖ actor ‖ transition ‖ evidence_refs ‖ prev_hash) |

**Integrity check**: Sequential scan verifying `entry[n].prev_hash == entry[n-1].hash`.

### Evidence

Artifacts that satisfy governance contract requirements.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| wp_id | INTEGER | FK → work_packages.id, NOT NULL | Producing WP |
| fr_id | TEXT | NOT NULL | Functional requirement ID (e.g., "FR-001") |
| type | TEXT | NOT NULL, CHECK(valid type) | Evidence type |
| artifact_path | TEXT | NOT NULL | Relative path to evidence artifact in git |
| metadata | TEXT | nullable, JSON | Type-specific metadata (coverage %, scan results) |
| created_at | TEXT | NOT NULL | ISO 8601 |

**Valid types**: `test_result`, `ci_output`, `review_approval`, `security_scan`, `lint_result`, `manual_attestation`

### Policy Rule

Configurable quality/security/reliability checks.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| domain | TEXT | NOT NULL, CHECK(valid domain) | Policy domain |
| rule | TEXT | NOT NULL, JSON | Rule definition |
| active | INTEGER | NOT NULL, DEFAULT 1 | 0=disabled, 1=active |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

**Valid domains**: `quality`, `security`, `reliability`

### Metric

Observability data for retrospective analysis.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| feature_id | INTEGER | FK → features.id, nullable | Related feature |
| command | TEXT | NOT NULL | Command name (specify, plan, implement, etc.) |
| duration_ms | INTEGER | NOT NULL | Execution duration |
| agent_runs | INTEGER | DEFAULT 0 | Number of agent invocations |
| review_cycles | INTEGER | DEFAULT 0 | Number of review → fix loops |
| metadata | TEXT | nullable, JSON | Additional metrics |
| timestamp | TEXT | NOT NULL | ISO 8601 |

### WP Dependency

Tracks ordering and conflict relationships between WPs.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| wp_id | INTEGER | FK → work_packages.id | Dependent WP |
| depends_on | INTEGER | FK → work_packages.id | Prerequisite WP |
| type | TEXT | NOT NULL | `explicit` (user-declared), `file_overlap` (auto-detected), `data` (schema dependency) |

**UNIQUE(wp_id, depends_on)** — no duplicate edges.

### Backlog Item

Triaged bugs, feature ideas, and tasks queued for future processing.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| feature_id | INTEGER | FK → features.id, nullable | Originating feature (if discovered during implementation) |
| wp_id | INTEGER | FK → work_packages.id, nullable | Originating WP (if discovered during implementation) |
| type | TEXT | NOT NULL, CHECK(valid type) | Classification type |
| title | TEXT | NOT NULL | Brief description |
| body | TEXT | nullable | Detailed description, stack trace, reproduction steps |
| priority | TEXT | DEFAULT 'medium' | low, medium, high, critical |
| state | TEXT | NOT NULL, DEFAULT 'open' | Backlog state |
| external_ref | TEXT | nullable | GitHub issue URL or Plane.so item URL |
| tags | TEXT | nullable, JSON array | User-defined tags |
| triaged_by | TEXT | NOT NULL | "user" or "agent:<name>" |
| created_at | TEXT | NOT NULL | ISO 8601 |
| updated_at | TEXT | NOT NULL | ISO 8601 |

**Valid types**: `bug`, `feature`, `idea`, `task`, `tech_debt`
**Valid states**: `open`, `promoted` (became a feature/WP), `closed`, `wont_fix`

### Sync State

Tracks mirror synchronization state for Plane.so and GitHub.

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| entity_type | TEXT | NOT NULL | `feature`, `work_package`, `backlog_item` |
| entity_id | INTEGER | NOT NULL | ID of the synced entity |
| mirror | TEXT | NOT NULL | `plane` or `github` |
| mirror_id | TEXT | NOT NULL | External ID (Plane.so issue UUID or GitHub issue number) |
| mirror_url | TEXT | nullable | URL to the mirror item |
| last_synced_at | TEXT | NOT NULL | ISO 8601 |
| body_hash | BLOB(32) | nullable | SHA-256 of synced body for conflict detection |

**UNIQUE(entity_type, entity_id, mirror)** — one sync record per entity per mirror.

### Sub-Command Invocation

Audit log for agent sub-command usage (separate from state-transition audit chain).

| Field | Type | Constraints | Description |
|-------|------|-------------|-------------|
| id | INTEGER | PK, auto-increment | Unique identifier |
| feature_id | INTEGER | FK → features.id, nullable | Context feature |
| wp_id | INTEGER | FK → work_packages.id, nullable | Context WP |
| command | TEXT | NOT NULL | Sub-command name (e.g., "triage:classify") |
| args | TEXT | nullable, JSON | Arguments passed |
| caller | TEXT | NOT NULL | "user" or "agent:<name>" |
| result | TEXT | NOT NULL | "success" or "error" |
| duration_ms | INTEGER | nullable | Execution time |
| timestamp | TEXT | NOT NULL | ISO 8601 |

## Indexes

```sql
CREATE INDEX idx_features_state ON features(state);
CREATE INDEX idx_features_slug ON features(slug);
CREATE INDEX idx_wp_feature_state ON work_packages(feature_id, state);
CREATE INDEX idx_wp_feature_seq ON work_packages(feature_id, sequence);
CREATE INDEX idx_audit_feature ON audit_log(feature_id, id);
CREATE INDEX idx_evidence_wp ON evidence(wp_id);
CREATE INDEX idx_evidence_fr ON evidence(fr_id);
CREATE INDEX idx_metrics_feature ON metrics(feature_id, timestamp);
CREATE INDEX idx_deps_wp ON wp_dependencies(wp_id);
CREATE INDEX idx_deps_prereq ON wp_dependencies(depends_on);
CREATE INDEX idx_backlog_type ON backlog_items(type, state);
CREATE INDEX idx_backlog_feature ON backlog_items(feature_id);
CREATE INDEX idx_sync_entity ON sync_state(entity_type, entity_id);
CREATE INDEX idx_sync_mirror ON sync_state(mirror, mirror_id);
CREATE INDEX idx_subcmd_feature ON subcommand_invocations(feature_id, timestamp);
CREATE INDEX idx_subcmd_command ON subcommand_invocations(command, timestamp);
```

## Git Artifact Layout

All artifacts stored as files in git (source of truth). SQLite is a queryable cache that can be rebuilt.

```
kitty-specs/<feature>/
├── spec.md                    # Specification
├── research.md                # Research findings
├── plan.md                    # Implementation plan
├── data-model.md              # This file
├── meta.json                  # Feature metadata (slug, state, timestamps)
├── contracts/
│   ├── governance-v1.json     # Governance contract (versioned, immutable)
│   └── ...
├── evidence/
│   ├── WP01/
│   │   ├── test-results.json
│   │   ├── ci-output.json
│   │   └── review-approval.json
│   └── WP02/
│       └── ...
├── audit/
│   └── chain.jsonl            # Hash-chained audit log (git-portable format)
└── tasks/
    ├── tasks.md
    └── WP01-*.md, WP02-*.md ...
```

SQLite rebuild: parse `meta.json` + `audit/chain.jsonl` + `evidence/**` to reconstruct all tables.
