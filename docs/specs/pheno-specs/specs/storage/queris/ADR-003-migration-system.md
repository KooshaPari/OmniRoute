# ADR-003: Migration System & Schema Evolution Strategy

**Date**: 2026-04-04
**Status**: Proposed
**Deciders**: KooshaPari

## Context

Queris requires a robust migration system to handle:
- **Schema evolution** as applications grow and change
- **Version control** for database schema changes
- **Rollback capabilities** when migrations fail or need reversal
- **Multi-environment consistency** (dev, staging, production)
- **Team collaboration** with conflict detection

The migration system must integrate seamlessly with:
- Rust's build system (Cargo)
- The Phenotype ecosystem's CI/CD pipeline
- Existing database tooling and best practices

## Decision Drivers

- **Rust-native implementation** for consistency with Queris
- **Embedded migrations** for easy deployment
- **Reversible operations** for safe rollbacks
- **Checksum verification** to detect tampering
- **Multiple backend support** (PostgreSQL, MySQL, SQLite)
- **Programmatic API** for custom migration logic
- **CLI tooling** for developer workflows

## Options Considered

### Option A: refinery (Rust-native)

**Pros**:
- ✅ Pure Rust implementation
- ✅ Async support with tokio/async-std
- ✅ Embedded migrations via `include_migration_mods!`
- ✅ Checksum verification for integrity
- ✅ Multiple backend support
- ✅ Programmatic API and CLI
- ✅ Transaction-based migrations

**Cons**:
- ⚠️ Smaller community than mature solutions
- ⚠️ Fewer advanced features (no rollback in some cases)
- ⚠️ Limited ecosystem integrations

### Option B: Diesel Migrations (Built-in)

**Pros**:
- ✅ Integrated with Diesel ORM
- ✅ Mature and well-documented
- ✅ Forward and backward migrations
- ✅ Rust code-based migrations (not just SQL)

**Cons**:
- ⚠️ Tightly coupled to Diesel
- ⚠️ Limited async support
- ⚠️ Not compatible with our sqlx-based architecture

### Option C: SQLx CLI + barrel

**Pros**:
- ✅ Works with sqlx ecosystem
- ✅ SQL-based migrations (language agnostic)
- ✅ Compile-time verification

**Cons**:
- ⚠️ Separate migration tool (not embedded)
- ⚠️ barrel crate less maintained
- ⚠️ No programmatic API

### Option D: External Tools (Flyway/Liquibase)

**Pros**:
- ✅ Industry-standard tools
- ✅ Rich feature sets
- ✅ Wide database support
- ✅ Enterprise features

**Cons**:
- ⚠️ JVM dependency (Flyway/Liquibase)
- ⚠️ Not integrated with Rust build process
- ⚠️ Additional deployment complexity
- ⚠️ Duplicated configuration

## Decision

**Adopt refinery as the primary migration framework** with a custom Queris CLI wrapper for enhanced developer experience.

### Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    Queris Migration Architecture                             │
│                                                                             │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Developer Workflow                                  │   │
│  │                                                                        │   │
│  │   $ queris migrate create add_user_email_verified                      │   │
│  │                                                                        │   │
│  │   Creates:                                                             │   │
│  │   migrations/                                                          │   │
│  │   └── U20260404120001_add_user_email_verified/                         │   │
│  │       ├── up.sql                                                       │   │
│  │       └── down.sql                                                     │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Migration Runner (refinery)                         │   │
│  │                                                                        │   │
│  │   ┌──────────────┐  ┌──────────────┐  ┌──────────────┐               │   │
│  │   │   Version    │  │   Checksum   │  │   Applied    │               │   │
│  │   │   Control    │  │   Verify     │  │   At         │               │   │
│  │   │   Table      │  │   SHA256     │  │   Timestamp  │               │   │
│  │   └──────────────┘  └──────────────┘  └──────────────┘               │   │
│  │                                                                        │   │
│  │   Migration Flow:                                                      │   │
│  │   1. Read embedded migrations                                          │   │
│  │   2. Verify checksums                                                  │   │
│  │   3. Compare with refinery_schema_history                              │   │
│  │   4. Run pending migrations (in transaction)                           │   │
│  │   5. Update history table                                              │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                    │                                         │
│                                    ▼                                         │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                    Database Layer                                        │   │
│  │                                                                        │   │
│  │   ┌──────────────────────────────────────────────────────────────┐    │   │
│  │   │  refinery_schema_history                                       │    │   │
│  │   │  ─────────────────────────────────────────────────────────────  │    │   │
│  │   │  version    | name                    | applied_on  | checksum│    │   │
│  │   │  ─────────────────────────────────────────────────────────────  │    │   │
│  │   │  20260404120001 | add_user_email_verified | 2026-04-04... | a1b2..│   │   │
│  │   │  20260403150000 | create_users_table      | 2026-04-03... | c3d4..│   │   │
│  │   └──────────────────────────────────────────────────────────────┘    │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Migration Naming Convention

```
Format: U{timestamp}_{description}

Examples:
- U20260404120001_add_user_email_verified
- U20260403150000_create_users_table
- U20260402100000_add_post_indexes

Components:
- U: Universal prefix for sorting
- YYYYMMDDHHMMSS: Timestamp (UTC)
- description: snake_case description
```

### Migration File Structure

```sql
-- migrations/U20260404120001_add_user_email_verified/up.sql
-- Add email_verified column to users table
-- Author: koosha
-- Ticket: PHEN-123

BEGIN;

ALTER TABLE users 
ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX idx_users_email_verified 
ON users(email_verified) 
WHERE email_verified = FALSE;

COMMENT ON COLUMN users.email_verified IS 
    'Whether the user has verified their email address';

COMMIT;
```

```sql
-- migrations/U20260404120001_add_user_email_verified/down.sql
-- Rollback: Remove email_verified column

BEGIN;

DROP INDEX IF EXISTS idx_users_email_verified;

ALTER TABLE users 
DROP COLUMN IF EXISTS email_verified;

COMMIT;
```

### Programmatic API

```rust
use queris::migrate::{Migrator, MigrationConfig};

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    let config = MigrationConfig {
        // Use embedded migrations compiled into binary
        migrations: queris::embed_migrations!(),
        // Or load from directory
        // migrations_dir: Some("./migrations".into()),
        strict: true,  // Fail on checksum mismatch
        dry_run: false, // Actually apply changes
    };

    let migrator = Migrator::new(config).await?;
    
    // Run all pending migrations
    let report = migrator.run().await?;
    
    println!("Applied {} migrations", report.applied_count);
    for migration in report.applied {
        println!("  ✓ {}", migration.name);
    }
    
    // Check status without running
    let status = migrator.status().await?;
    println!("\nPending migrations: {}", status.pending.len());
    
    Ok(())
}
```

### Embedded Migrations

```rust
// In your application code
use queris::embed_migrations;

// Embeds all migrations from the migrations/ directory at compile time
embed_migrations!("./migrations");

pub async fn init_database(pool: &Pool<Postgres>) -> Result<()> {
    // Run embedded migrations on startup
    queris::migrate::run_embedded(pool).await?;
    Ok(())
}
```

## Implementation Plan

### Phase 1: Core Migration System (Current)
- [ ] refinery integration with sqlx backends
- [ ] Embedded migration macro (`embed_migrations!`)
- [ ] Basic CLI commands (create, run, status)
- [ ] PostgreSQL support

### Phase 2: Multi-Backend & Features (2026 Q2)
- [ ] MySQL migration support
- [ ] SQLite migration support
- [ ] Checksum verification
- [ ] Migration rollback (down.sql)

### Phase 3: Advanced Features (2026 Q3)
- [ ] Migration groups (dev-only, test-only)
- [ ] Conditional migrations (feature flags)
- [ ] Data migration helpers (seed data)
- [ ] Schema diff generation

### Phase 4: Enterprise Features (2026 Q4)
- [ ] Migration locking (prevent concurrent runs)
- [ ] Migration hooks (pre/post scripts)
- [ ] Schema validation before migration
- [ ] Migration dry-run with impact analysis

## Consequences

### Positive
- **Rust-native** integration with no external dependencies
- **Embedded migrations** enable single-binary deployment
- **Checksum verification** prevents tampering
- **Programmatic API** allows custom migration logic
- **Transaction safety** ensures atomic migrations
- **Multi-backend support** consistent across PostgreSQL, MySQL, SQLite

### Negative
- **Smaller ecosystem** than Flyway/Liquibase
- **Manual rollback** requires writing down.sql files
- **No GUI** for non-technical users
- **Limited cloud integrations** compared to mature tools

### Mitigations
- Provide comprehensive migration documentation
- Create migration templates for common operations
- Build a simple TUI for migration status viewing
- Document integration with CI/CD for automated migration testing

## Migration Safety Guidelines

### DO
- ✅ Wrap migrations in transactions (BEGIN/COMMIT)
- ✅ Provide down.sql for every up.sql
- ✅ Test migrations on a copy of production data
- ✅ Add indexes in separate migrations after column creation
- ✅ Use `IF NOT EXISTS` / `IF EXISTS` for idempotency
- ✅ Document breaking changes in migration comments

### DON'T
- ❌ Modify existing migration files after they've been applied
- ❌ Delete or rename columns without a multi-step migration
- ❌ Run migrations without backups
- ❌ Add NOT NULL columns without default values
- ❌ Create migrations that take locks on large tables without planning

## References

- [refinery](https://github.com/rust-db/refinery) — Rust migration toolkit
- [Diesel Migrations](https://diesel.rs/guides/migrations.html) — Reference implementation
- [Flyway](https://flywaydb.org/) — Industry standard (reference)
- [Liquibase](https://www.liquibase.org/) — Another standard (reference)
- [PostgreSQL ALTER TABLE](https://www.postgresql.org/docs/current/sql-altertable.html) — Lock behavior
- [Zero-Downtime Migrations](https://planetscale.com/blog/zero-downtime-migrations) — Best practices

---

*This ADR establishes the schema evolution and migration foundation for Queris.*
