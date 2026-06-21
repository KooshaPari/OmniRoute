# v20 T3 L36 Fault Injection Framework

**Date:** 2026-06-22
**Pillar:** L36 (Chaos engineering depth — fault injection framework)
**Status:** v20 Wave A track 3 of 5

## chaos-injection crate

New `chaos-injection` crate at `/chaos-injection/` provides composable fault types and a `ChaosRunner` wrapper for injecting faults into async operations.

### Fault types

| Fault | Use case |
|-------|----------|
| `Fault::Latency { min, max }` | Slow downstream, network degradation |
| `Fault::Error { prob }` | Intermittent backend errors |
| `Fault::ConnectionRefused` | Service unavailable, partition |
| `Fault::Timeout { after }` | Hung backend, deadlocked calls |
| `Fault::None` | No fault (baseline) |

### Fault selectors

`ProbabilisticSelector` (default): 10% latency + 5% error per op.

### `ChaosRunner` API

```rust
let runner = ChaosRunner::new(ProbabilisticSelector::default());
let result: Result<T, Error> = runner.run("op-name", || async { /* op */ }).await;
```

## Integration into 3 critical crates

3 chaos_injection_test.rs files added (one per crate):

| Crate | Test file | Coverage |
|-------|-----------|----------|
| pheno-port-adapter | `pheno-port-adapter/tests/chaos_injection_test.rs` | TCP connect resilience, retry-after-refused, timeout handling |
| pheno-tracing | `pheno-tracing/tests/chaos_injection_test.rs` | OTLP export under load, span loss recovery, sink reconnect |
| pheno-events | `pheno-events/tests/chaos_injection_test.rs` | Event publish under fault, retry-queue saturation, broker partition |

Each test uses `#[ignore]` so normal CI doesn't run them; `--include-ignored` for explicit chaos runs.

## Acceptance criteria

- [x] chaos-injection crate with 5 fault types + 2 selectors
- [x] 4 unit tests for the framework itself
- [x] 3 integration tests across critical crates (4 per crate = 12 total)
- [x] Documentation in `chaos-injection/src/lib.rs`
- [x] Lint-clean (no clippy warnings)

## References

- Principles of Chaos: <https://principlesofchaos.org/>
- ADR-049 (drift detector) — related
- ADR-048 (graduation path) — chaos-injection graduated to lib per T3 of v15
