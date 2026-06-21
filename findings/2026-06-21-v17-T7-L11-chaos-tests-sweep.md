# v17 — T7 L11 Anti-Fragility chaos_ Tests Sweep

**Date:** 2026-06-21
**Cycle:** 7
**Pillar:** L11 (Anti-Fragility)
**Wave:** B
**Scope:** 5 critical crates

## Purpose

L11 (Anti-Fragility) is at 0.00. Need chaos_-prefixed tests in
5 critical crates per the convention in `docs/chaos/chaos-test-convention.md`.

## Per-crate test plan

### pheno-port-adapter (most critical — network)

```rust
#[test] fn chaos_connection_refused_uses_circuit_breaker() { ... }

#[test] fn chaos_dns_resolution_failure_recovers() { ... }

#[test] fn chaos_tcp_reset_mid_stream_reconnects() { ... }

#[test] fn chaos_slow_consumer_does_not_block_pool() { ... }
```

### pheno-tracing (OTel export)

```rust
#[test] fn chaos_otlp_endpoint_unreachable_does_not_panic() { ... }

#[test] fn chaos_otlp_endpoint_429_throttles_export() { ... }

#[test] fn chaos_batch_flush_under_load_no_loss() { ... }
```

### pheno-otel (metrics + traces)

```rust
#[test] fn chaos_metrics_registry_overflow_drops_oldest() { ... }

#[test] fn chaos_span_recorder_backpressure() { ... }
```

### pheno-config (config reload)

```rust
#[test] fn chaos_config_reload_invalid_keeps_old_config() { ... }

#[test] fn chaos_sighup_race_condition_handled() { ... }
```

### pheno-flags (CLI parsing)

```rust
#[test] fn chaos_unicode_flag_name_preserved() { ... }

#[test] fn chaos_extremely_long_arg_truncated_safely() { ... }
```

## Coverage target

Each crate: 80% line coverage of the chaos test paths.
L11 fleet mean: 0.00 → 3.00.

## CI integration

Already wired via `chaos-gate.yml` (v16 T7). Chaos tests
run in --test-threads=1 to surface race conditions.
