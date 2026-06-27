# pheno-errors-macros

Proc-macro crate for `pheno-errors`. Per v23-T5 (L42): three derive macros
that produce `Diagnostic` impls with `Span` annotations pointing to the
source location of each variant.

## Macros

### `#[derive(Documented)]`

Generates a `documented()` method on the enum that returns the doc-comment
of the active variant. Use it as the `help` field of `miette::Diagnostic`.

```rust
use pheno_errors_macros::Documented;

#[derive(Documented)]
pub enum AppError {
    /// The configuration file is malformed. Re-read ADR-031 for the canonical format.
    Config,
    /// The resource with the given id was not found in the database.
    NotFound,
}

let e = AppError::Config;
assert_eq!(e.documented(), "The configuration file is malformed. Re-read ADR-031 for the canonical format.");
```

### `#[derive(SpanError)]`

Generates a `source_span()` method that returns the `proc_macro2::Span` of
where the error was constructed. Useful for IDE integrations that need
to highlight the source location in the editor.

```rust
use pheno_errors_macros::SpanError;

#[derive(SpanError)]
pub enum AppError {
    Config,
}

let e = AppError::Config;
let span = e.source_span();
// pass `span` to an LSP or other editor tool
```

### `#[error_code("PHN-...")]`

Attaches a stable, machine-readable error code to a variant. The
`Diagnostic` impl uses this for log aggregation. The macro validates
the code at compile time:

- Must start with `PHN-`
- Must be `PHN-[A-Z]+-[0-9]+` (uppercase prefix, numeric suffix)

A bad code produces a compile error pointing to the attribute location
(thanks to the `Span` annotation).

```rust
use pheno_errors_macros::error_code;

#[error_code("PHN-CFG-001")]
pub enum AppError {
    /// Config error
    Config,
}
```

## Why this exists

Before v23-T5, error codes were hand-written strings scattered across the
codebase, and the `help` text in `miette::Diagnostic` was a separate
hand-written string that often drifted out of sync with the doc-comment.
This crate solves both:

1. **Single source of truth:** the doc-comment is the help text.
   `Documented` derive reads it directly. No drift possible.
2. **Compile-time-validated codes:** `error_code` ensures every error
   has a stable `PHN-X-N` code at compile time, not at runtime.
3. **Span-aware diagnostics:** `SpanError` derive provides the source
   location for IDE integrations, so clicking an error in a log can
   jump to the exact source line that produced it.

## Cross-references

- `pheno-errors/src/display.rs` — `Display` impls (human-readable)
- `pheno-errors/src/diagnostic.rs` — `Diagnostic` impls (machine-readable)
- ADR-024 — Factory AI crosswalk: this crate implements the "structured
  error reporting" pillar
- ADR-042B — substrate quality bar: every pheno-* error type MUST have
  a `Diagnostic` impl, not just `Display`
- `phenotype-tooling/templates/reusable-quality-gate.yml` — the CI side
  verifies that every `pheno-errors` variant has a code
