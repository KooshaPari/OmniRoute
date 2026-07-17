# Data Model: Modules & Cycles

## Entities

### Module

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | i64 | PK, auto-increment | |
| slug | String | unique within sibling scope | kebab-case |
| friendly_name | String | required | display name |
| description | Option\<String\> | | markdown content |
| parent_module_id | Option\<i64\> | FK → modules.id | null = root module |
| created_at | DateTime\<Utc\> | required | |
| updated_at | DateTime\<Utc\> | required | |

**Invariants:**
- `parent_module_id` cannot reference self or any descendant (no cycles in tree)
- `slug` unique among siblings (same `parent_module_id`)
- Cannot delete if owns Features or has child Modules

### ModuleFeatureTag (Join Table)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| module_id | i64 | FK → modules.id | |
| feature_id | i64 | FK → features.id | |
| created_at | DateTime\<Utc\> | | |

**PK**: (module_id, feature_id)

**Note**: This is the many-to-many "tagging" relationship. The strict ownership is via `Feature.module_id`.

### Cycle

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| id | i64 | PK, auto-increment | |
| name | String | unique, required | display name |
| description | Option\<String\> | | |
| state | CycleState | required, default Draft | lifecycle state |
| start_date | NaiveDate | required | |
| end_date | NaiveDate | required, > start_date | |
| module_scope_id | Option\<i64\> | FK → modules.id | null = cross-module |
| created_at | DateTime\<Utc\> | required | |
| updated_at | DateTime\<Utc\> | required | |

### CycleState (Enum)

```
Draft → Active → Review → Shipped → Archived
```

Allowed transitions:
- Draft → Active
- Active → Review
- Active → Draft (revert)
- Review → Shipped
- Review → Active (changes requested)
- Shipped → Archived

**Gate**: Review → Shipped requires all assigned Features in Validated or Shipped state.

### CycleFeature (Join Table)

| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| cycle_id | i64 | FK → cycles.id | |
| feature_id | i64 | FK → features.id | |
| added_at | DateTime\<Utc\> | | |

**PK**: (cycle_id, feature_id)

**Constraint**: If Cycle has `module_scope_id`, Feature must be owned by or tagged to that Module.

### Feature (Modified)

Add field:
| Field | Type | Constraints | Notes |
|-------|------|-------------|-------|
| module_id | Option\<i64\> | FK → modules.id | null for unassigned (backward compat) |

## Relationships

```
Module 1──* Module (parent/child hierarchy)
Module 1──* Feature (ownership via Feature.module_id)
Module *──* Feature (tagging via ModuleFeatureTag)
Cycle *──* Feature (assignment via CycleFeature)
Cycle *──1 Module (optional scope via Cycle.module_scope_id)
```

## SQLite Migration (006_modules_cycles.sql)

```sql
CREATE TABLE modules (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    slug            TEXT NOT NULL,
    friendly_name   TEXT NOT NULL,
    description     TEXT,
    parent_module_id INTEGER REFERENCES modules(id),
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    UNIQUE(parent_module_id, slug)
);

CREATE TABLE module_feature_tags (
    module_id   INTEGER NOT NULL REFERENCES modules(id),
    feature_id  INTEGER NOT NULL REFERENCES features(id),
    created_at  DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (module_id, feature_id)
);

ALTER TABLE features ADD COLUMN module_id INTEGER REFERENCES modules(id);

CREATE TABLE cycles (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    name            TEXT NOT NULL UNIQUE,
    description     TEXT,
    state           TEXT NOT NULL DEFAULT 'Draft',
    start_date      DATE NOT NULL,
    end_date        DATE NOT NULL,
    module_scope_id INTEGER REFERENCES modules(id),
    created_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    updated_at      DATETIME NOT NULL DEFAULT (datetime('now')),
    CHECK (end_date > start_date)
);

CREATE TABLE cycle_features (
    cycle_id    INTEGER NOT NULL REFERENCES cycles(id),
    feature_id  INTEGER NOT NULL REFERENCES features(id),
    added_at    DATETIME NOT NULL DEFAULT (datetime('now')),
    PRIMARY KEY (cycle_id, feature_id)
);

CREATE INDEX idx_modules_parent ON modules(parent_module_id);
CREATE INDEX idx_features_module ON features(module_id);
CREATE INDEX idx_cycles_state ON cycles(state);
CREATE INDEX idx_cycles_module_scope ON cycles(module_scope_id);
```
