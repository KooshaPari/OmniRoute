# phenotype-error-core — CLAUDE.md

## Project Overview

A Rust error handling library providing structured, traceable error types for Phenotype ecosystem projects.

**Language**: Rust
**Location**: `crates/phenotype-error-core/`
**Published**: Yes (to crates.io or internal registry)

## Phenotype Federated Hybrid Architecture

This project is part of the Phenotype Federated Hybrid Architecture:

### Phenotype Docs Chassis
Provides VitePress configuration and design tokens for documentation.

See: `docs/reference/PHENOTYPE_DOCS_CHASSIS_INTERFACE.md`

### AgilePlus Governance Chassis
Defines specification-driven delivery with PRD, ADR, FUNCTIONAL_REQUIREMENTS, and FR traceability.

See: `docs/reference/AGILEPLUS_GOVERNANCE_CHASSIS.md`

**For this project**:
- Maintain `/FUNCTIONAL_REQUIREMENTS.md` with FR-ERROR-XXX IDs
- Tag all tests with comment: `// Traces to: FR-ERROR-NNN`
- Map code entities in `docs/reference/CODE_ENTITY_MAP.md`
- Create worklog entries in `docs/worklogs/` per phase

## Specification Documents

**Root-level files** (in monorepo root):
- `/FUNCTIONAL_REQUIREMENTS.md` — Granular requirements for phenotype-error-core
- `/docs/worklogs/` — Phase-based worklog entries
- `/docs/reference/CODE_ENTITY_MAP.md` — Code ↔ requirements mapping

## Testing & Traceability

All tests MUST reference an FR:

```rust
// Traces to: FR-ERROR-001
#[test]
fn test_error_display_formatting() {
    // Test body
}
```

Run: `cargo test --lib phenotype_error_core`

## Build & Quality

```bash
cd crates/phenotype-error-core
cargo test
cargo clippy
cargo fmt
```

## Development Notes

- Provides `PhenotypeError` enum with structured error variants
- Supports error chaining and context propagation
- Serializable for logging and API responses
- Integration with tracing for distributed tracing

## See Also

- **AgilePlus Governance**: `docs/reference/AGILEPLUS_GOVERNANCE_CHASSIS.md`
- **Phenotype Docs**: `docs/reference/PHENOTYPE_DOCS_CHASSIS_INTERFACE.md`
- **Monorepo Root**: `../../../CLAUDE.md`

