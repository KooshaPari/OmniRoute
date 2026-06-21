# v17 — L2 Module Boundary Documentation + Dependency Table

**Date:** 2026-06-21
**Cycle:** 7 (P0 reduction)
**Pillar:** L2 (Module Boundary Documentation)
**Wave:** A

## Purpose

L2 (Module Boundary Documentation) is at 0.00 across the 3 substrate
repos. The pillar requires an explicit `MODULE_BOUNDARIES.md` for each
crate declaring its internal module structure, the public surface, the
intra-crate dependency graph, and the cross-crate import/export rules.

## Convention

Every `pheno-*-lib` MUST ship `MODULE_BOUNDARIES.md` with:

1. **Module tree** — ASCII tree of `src/**/*.rs` with one-line descriptions
2. **Public surface** — flat list of `pub` items (functions, structs, traits)
3. **Intra-crate deps** — which modules depend on which (table)
4. **Cross-crate imports** — `use pheno_x::y` declarations (table)
5. **Cross-crate exports** — items consumed by other crates (table)
6. **Boundary rules** — what MAY and MUST NOT cross a boundary

## Deliverables

3 `MODULE_BOUNDARIES.md` files in `pheno-flags`, `pheno-errors`,
`pheno-port-adapter`. Each file targets 150-200 lines with the
template below adapted to the crate's actual surface.

## Template (pheno-flags)

```markdown
# pheno-flags — Module Boundaries

## Module tree

```
src/
├── lib.rs           — crate root, re-exports
├── parser/
│   ├── mod.rs       — Parser struct + Token
│   ├── lexer.rs     — char-by-char tokenizer
│   └── grammar.rs   — flag grammar rules
├── schema/
│   ├── mod.rs       — Schema trait + SchemaBuilder
│   ├── value.rs     — Value enum (Bool|Int|String|List|Map)
│   └── validate.rs  — ValidationRule + ValidationError
├── emitter/
│   ├── mod.rs       — Emitter trait
│   ├── change.rs    — Change event
│   └── sink.rs      — Sink trait (where Changes go)
├── error.rs         — Error enum (single-file, no sub-modules)
└── ffi.rs           — UniFFI bindings (auto-generated, do not edit)
```

## Public surface

```rust
// parser
pub fn parse(input: &[u8]) -> Result<Token, Error>;
pub struct Parser { ... }
pub enum Token { ... }

// schema
pub trait Schema { ... }
pub struct SchemaBuilder { ... }
pub enum Value { ... }
pub trait ValidationRule { ... }

// emitter
pub trait Emitter { ... }
pub trait Sink { ... }
pub struct Change { ... }

// error
pub enum Error { UnknownFlag, InvalidValue, TypeMismatch, OutOfRange }
```

## Intra-crate dependencies

| From module | To module | Reason |
|-------------|-----------|--------|
| parser::mod | parser::lexer | delegates tokenization |
| parser::mod | parser::grammar | applies grammar rules |
| parser::mod | schema::value | produces typed values |
| parser::mod | error | returns Error on parse failure |
| schema::mod | schema::value | owns Value enum |
| schema::mod | schema::validate | applies rules |
| emitter::mod | emitter::change | produces Change events |
| emitter::mod | emitter::sink | delivers to Sink |
| emitter::mod | schema::value | typed Change payload |
| lib.rs | (all) | re-exports |

## Cross-crate imports

| Import | From crate | Purpose |
|--------|-----------|---------|
| `use pheno_errors::Error as PE` | pheno-errors | error wrapping in `wrap()` |
| `use pheno_context::Span` | pheno-context | span context on Change events |

## Cross-crate exports

| Item | Consumed by |
|------|-------------|
| `Value` | pheno-port-adapter (parses Connection strings) |
| `Error` | pheno-cli-base (renders user-facing errors) |
| `Change` | pheno-observability (subscribes for telemetry) |

## Boundary rules

1. **`src/parser/` MUST NOT depend on `src/emitter/`** — parsing is a
   pure function, no I/O.
2. **`src/emitter/` MUST NOT import `std::io`** — emissions are
   in-memory; persistence is delegated to `Sink` impls.
3. **`src/error.rs` MUST NOT import any other module** — single source
   of error truth, no cycles.
4. **Public API MUST NOT leak internal module paths** — re-export
   everything from `lib.rs`.
```

## Acceptance

- 3 `MODULE_BOUNDARIES.md` files
- Each module tree matches the actual `src/` layout
- Public surface matches `pub` items in the source (verified via `rg "^pub "`)
- Boundary rules are mechanical (a CI check can enforce them)

## Closure criterion for L2

L2 score moves from 0.00 → 3.00 once all 3 repos ship valid
`MODULE_BOUNDARIES.md` files.

Refs: `findings/2026-06-21-v17-L1-architecture-overview.md`
