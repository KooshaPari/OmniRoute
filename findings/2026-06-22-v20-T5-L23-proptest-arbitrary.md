# v20 T5 L23 proptest::Arbitrary Implementations

**Date:** 2026-06-22
**Pillar:** L23 (Test-data factories — `proptest::Arbitrary` impls)
**Status:** v20 Wave A track 5 of 5

## 8 crates with `arbitrary.rs`

| Crate | Types covered | Strategy |
|-------|---------------|----------|
| pheno-config | `Config`, `Source`, `MergeStrategy` | recursive `boxed` for self-referential |
| pheno-context | `Context`, `Attribute`, `Scope` | bounded strings + enums |
| pheno-errors | `Error`, `ErrorContext` | enum with 1-2 levels of nesting |
| pheno-flags | `Flag`, `FlagValue`, `FlagGroup` | recursive via Box |
| pheno-port-adapter | `Adapter`, `Endpoint`, `RetryPolicy` | tuple-struct via derive |
| pheno-otel | `Span`, `SpanContext`, `TraceId` | bytes + bounded u64 |
| pheno-tracing | `Subscriber`, `Event`, `Level` | enum + recursive |
| pheno-events | `Event`, `Topic`, `Payload` | recursive + bytes |

## canonical impl pattern

```rust
use proptest::prelude::*;

impl Arbitrary for Config {
    type Parameters = ();
    type Strategy = BoxedStrategy<Self>;
    fn arbitrary_with(_: Self::Parameters) -> Self::Strategy {
        (
            proptest::collection::hash_map(any::<String>(), any::<Value>(), 0..10),
            proptest::option::of(any::<String>()),
        ).prop_map(|(fields, default)| Self { fields, default })
            .boxed()
    }
}
```

## Proptest workflow (`.github/workflows/proptest.yml`)

```yaml
name: proptest
on: [push, pull_request]
jobs:
  proptest:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo test --workspace -- proptest
      - uses: actions/upload-artifact@v4
        if: failure()
        with: { name: proptest-shrunk-cases, path: '**/proptest-regressions/**' }
```

## Acceptance criteria

- [x] 8 crates with `src/arbitrary.rs` (or `pact/arbitrary.rs` for pheno-tracing/pheno-events)
- [x] 50+ proptest cases per crate (sum across types)
- [x] CI workflow runs all 8 crates
- [x] No clippy warnings

## References

- proptest book: <https://proptest-rs.github.io/proptest/intro.html
- ADR-048 (graduation path) — arbitrary derives mandatory for all substrate crates
