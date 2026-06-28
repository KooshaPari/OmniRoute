# SIDE-43: pheno-* panic-free audit

**Date:** 2026-06-21 (executed; report dated 2026-06-22 per SIDE-43 filename convention)
**Author:** orch-w1-a (macbook)
**Scope:** 10 pheno-* Rust crates at the monorepo root + `pheno-chaos` workspace (2 sub-crates)
**Tool:** `rg` (ripgrep 14.x) on `\b(panic!|\.unwrap\(\)|\.expect\()`
**Reference ADR:** ADR-040 (test coverage gates), ADR-047 (predictive DRY), ADR-048 (substrate graduation)

---

## Methodology

For each Rust pheno-* crate, we searched `src/` for `panic!`, `.unwrap()`, and `.expect(`
macros. Each occurrence was classified into one of four buckets:

| Bucket                              | Compiled into release? | Reachable from normal API call?              | Counts toward panic-free SLA? |
| :---------------------------------- | :--------------------- | :------------------------------------------- | :----------------------------- |
| **A. Real production path**        | Yes                    | Yes — exercised by any consumer              | **Yes (HIGH)**                 |
| **B. `impl proptest::Arbitrary`**   | Yes                    | Only via proptest `arbitrary()` on the type  | Yes (LOW; rarely invoked)      |
| **C. `#[cfg(test)] mod tests`**     | No (cfg-gated)         | No (test-only)                               | No                             |
| **D. Rustdoc `///` example block**  | No (cargo test --doc)  | Only via `cargo test --doc`                  | No                             |
| **E. Intentional `panic!` in chaos**| Yes                    | Yes — chaos harness design                   | Acceptable (excluded)          |

**Counts are reported both ways:**

1. **Raw `src/` count** — every match under `src/`, irrespective of bucket.
2. **Production-only count** — Bucket A + Bucket B (the two buckets that survive
   `cargo build --release`).

Bucket C/D matches are excluded from the SLA but are listed for completeness.

---

## Per-crate counts (production-only)

| Crate                            | Raw src/ | A (mutex/real) | B (Arbitrary) | C (tests) | D (doctest) | E (chaos) | Files w/ prod hits |
| :------------------------------- | -------: | -------------: | ------------: | --------: | ----------: | --------: | -----------------: |
| `pheno-cli-base`                 |        3 |              0 |             0 |         3 |           0 |         0 |                  0 |
| `pheno-config`                   |        2 |              0 |             1 |         1 |           0 |         0 |                  1 |
| `pheno-context`                  |        8 |              0 |             4 |         4 |           0 |         0 |                  1 |
| `pheno-errors`                   |       11 |              0 |             0 |         9 |           2 |         0 |                  0 |
| `pheno-events`                   |        2 |              0 |             0 |         2 |           0 |         0 |                  0 |
| `pheno-flags`                    |        3 |              0 |             2 |         0 |           1 |         0 |                  1 |
| `pheno-otel`                     |       21 |              0 |             6 |        13 |           2 |         0 |                  2 |
| `pheno-port-adapter`             |       45 |              8 |             4 |        33 |           0 |         0 |                  4 |
| `pheno-tracing`                  |        6 |              5 |             0 |         1 |           0 |         0 |                  1 |
| `pheno-chaos` (`pheno-chaos`)    |        4 |              0 |             0 |         3 |           0 |         1 |                  1 |
| `pheno-chaos-macros`             |        0 |              0 |             0 |         0 |           0 |         0 |                  0 |
| **TOTAL (10 + 2 sub-crates)**    |  **105** |         **13** |        **17** |    **69** |       **5** |     **1** |             **12** |

**Headline:** Only **13** panic-producing calls live on real production paths
across the entire pheno-* fleet. **17** more exist in `proptest::Arbitrary` impls
(compile-in, reachable only when a downstream consumer explicitly calls
`Arbitrary::arbitrary()`). The other **75** are in test code or rustdoc examples.

---

## Top 10 risky locations (Bucket A — real production paths)

Risk scoring: **H/M/L** = High/Medium/Low. High = called on a hot path or from a
public API surface reachable from any consumer; Medium = public API surface but
not on hot path; Low = test helper or internal-only.

| #  | Location                                              | Call                                | Risk | Why                                                                                                              |
| :- | :---------------------------------------------------- | :---------------------------------- | :--- | :--------------------------------------------------------------------------------------------------------------- |
|  1 | `pheno-tracing/src/sampling.rs:261`                   | `self.tokens.lock().unwrap()`       | **H** | Inside `try_consume()` — called on **every** sampling decision. Mutex poisoning crashes the tracing pipeline.   |
|  2 | `pheno-tracing/src/sampling.rs:353`                   | `self.window.lock().unwrap()`       | **M** | Inside `error_rate_exceeds()`. Hot path for tail-based error-rate samplers. Poison propagates on every check.    |
|  3 | `pheno-tracing/src/sampling.rs:379`                   | `self.armed.lock().unwrap()`        | **M** | Tail sampler `arm` state. Poison kills the sampler's ability to escalate capture rate after error bursts.        |
|  4 | `pheno-tracing/src/sampling.rs:389`                   | `self.window.lock().unwrap()`       | **M** | `observe()` — sliding-window update. Hot path on every sampled span's outcome.                                   |
|  5 | `pheno-tracing/src/sampling.rs:400`                   | `self.armed.lock().unwrap()`        | **M** | Threshold-trip write inside `observe()`. Same blast radius as #3.                                              |
|  6 | `pheno-port-adapter/src/adapters/tcp.rs:45`           | `self.inner.lock().expect(...)`    | **M** | Inside `health()` (public trait method). Mutex poisoning crashes any TCP adapter liveness probe.                 |
|  7 | `pheno-port-adapter/src/adapters/tcp.rs:65`           | `self.inner.lock().expect(...)`    | **M** | Inside `connect()` — public trait method. Poison crashes the connect path; affects every TCP-using service.     |
|  8 | `pheno-port-adapter/src/adapters/tcp.rs:76`           | `self.inner.lock().expect(...)`    | **M** | Inside `disconnect()`. Same blast radius as #7 but on the close path.                                            |
|  9 | `pheno-port-adapter/src/adapters/unix.rs:50`          | `self.inner.lock().expect(...)`    | **M** | Unix-socket `health()`. Same pattern as #6.                                                                     |
| 10 | `pheno-port-adapter/src/adapters/unix.rs:69,80`       | `self.inner.lock().expect(...)`    | **M** | Unix-socket `connect()` + `disconnect()`. Same pattern as #7/#8.                                                |

### Honourable mentions (Bucket A — just outside top 10)

| Location                                              | Call                              | Risk | Notes                                                                                                          |
| :---------------------------------------------------- | :-------------------------------- | :--- | :-------------------------------------------------------------------------------------------------------------- |
| `pheno-port-adapter/src/adapters/unix.rs:80`          | `self.inner.lock().expect(...)`   | M    | Already at #10 above; also a `disconnect()` path.                                                              |
| `pheno-port-adapter/src/adapters/mock_clock.rs:153`   | `self.inner.offset.lock().expect(...)` | **L** | `MockClock` is a test double; not used in production paths, but lives in src/ and ships in release binaries.   |
| `pheno-port-adapter/src/adapters/mock_clock.rs:162`   | `self.inner.unix_nanos.lock().expect(...)` | **L** | Same as above.                                                                                                |
| `pheno-chaos/crates/pheno-chaos/src/runtime.rs:130`   | `panic!("fault ... failed to inject: {}", ...)` | **EXCL** | Intentional — the chaos harness **must** panic if it cannot inject a fault (else the harness is silently broken). Per ADR-023 this is acceptable. |

### Bucket B — `proptest::Arbitrary` impls (17 calls, all compile-in)

All 17 are `.expect("... regex")` on `proptest::string::string_regex(...).expect(...)`.
A consumer only reaches them by calling `proptest::arbitrary::Arbitrary::arbitrary()`
on the type (e.g. `let e: AdapterError = AdapterError::arbitrary();`). The regex
itself is a compile-time constant known-valid, so the panic is impossible in practice
— but the code is compiled into release binaries.

| File                                                 | Hits | Regex purpose             |
| :--------------------------------------------------- | ---: | :------------------------ |
| `pheno-otel/src/lib.rs`                              |    6 | `otlp_error`, `endpoint`, `service_name` |
| `pheno-context/src/lib.rs`                           |    4 | `ContextError`, id/metadata key/value    |
| `pheno-port-adapter/src/lib.rs`                      |    4 | `adapter_error`, `connection id`        |
| `pheno-flags/src/lib.rs`                             |    2 | `flag error`, `flag key`                 |
| `pheno-config/src/secrets.rs`                        |    1 | `non_empty_ascii_string`                 |

**Recommendation:** Replace `.expect("... regex")` with `.expect("... regex (compile-time-valid)")`
plus a `const _: () = assert!(...);` compile-time check, OR move the regex into a
`OnceLock<Regex>` to surface failure as `Err` at runtime. Risk is LOW but the
footprint is non-zero.

### Bucket D — Rustdoc examples (5 calls, doctest-only)

These panic inside `///` example blocks; they are only executed by
`cargo test --doc`. They do **not** ship in release binaries.

| File                              | Line | Snippet                                                        |
| :-------------------------------- | ---: | :------------------------------------------------------------- |
| `pheno-otel/src/init.rs`          |   52 | `let _guard = pheno_otel::init("my-service").expect("init telemetry");` |
| `pheno-otel/src/init.rs`          |   81 | Same pattern in `init_with_stdout` doctest.                    |
| `pheno-errors/src/lib.rs`         |   72 | `assert_eq!(lookup_user("42").unwrap(), "Alice");`             |
| `pheno-errors/src/rfc7807.rs`     |   30 | `let json = serde_json::to_string(&problem).unwrap();`         |
| `pheno-flags/src/lib.rs`          |   41 | `let flags = FlagSet::from_env("MYAPP").unwrap();`             |

**Recommendation:** Convert to `?` + `unwrap_or_else(|| panic!("..."))` is
**not** an improvement (still panics). The clean fix is to mark them
`ignore` (skip the doctest) or use `?` + `.expect` only with verified inputs.
Not blocking; treat as documentation drift.

---

## Pattern analysis

### Pattern 1 — `Mutex::lock().expect("... mutex poisoned")` (8 sites in pheno-port-adapter)

All 8 follow the same pattern in `tcp.rs` / `unix.rs` / `mock_clock.rs`:

```rust
let mut state = self.inner.lock().expect("... adapter mutex poisoned");
```

**Fix template** (one-shot PR per adapter):

```rust
let mut state = self.inner.lock().unwrap_or_else(|poison| {
    // Recover gracefully: a poisoned mutex means a peer thread panicked
    // mid-operation; the data inside may still be self-consistent for
    // simple state types.  Reset by clearing the poison flag.
    poison.into_inner()
});
```

Or, for stricter correctness, return a new `AdapterError::MutexPoisoned` variant
and propagate. Either way the API gets a `Result`-returning alternative.

**Why it matters:** A single panicking thread poisons the mutex, and from that
point on **every** subsequent `lock()` panics — taking down the entire adapter
instead of just the failing request. This is a cascading-failure amplification
pattern.

### Pattern 2 — `Mutex::lock().unwrap()` in tail sampler (5 sites in pheno-tracing/sampling.rs)

Same shape as Pattern 1 but on the sampling hot path. **Every span** flowing
through the SDK hits `try_consume()` (#1 above) and potentially `observe()` (#4).
A poisoning event in any one of them takes down tracing fleet-wide.

**Fix:** Same `unwrap_or_else(|p| p.into_inner())` pattern, or better — switch
to `parking_lot::Mutex` which does not poison (already in the dep tree via
`pheno-port-adapter`). ADR-048 graduation path recommends this.

### Pattern 3 — `proptest::string::string_regex(...).expect(...)` (17 sites)

The regex is a string literal known at compile time. The `.expect()` is
effectively a runtime assertion that the literal is well-formed.

**Fix:** Add a `const _REGEX_CHECK: () = assert!(...)` (Rust 1.79+), or use
`once_cell::sync::Lazy<Regex>` so a malformed regex surfaces as `Err` at the
first consumer rather than as a panic inside the lib.

### Pattern 4 — Rustdoc `.unwrap()` examples (5 sites)

Not blocking, but a future `cargo test --doc` regression will panic and look
like a real failure. Convert to `?` + `unwrap_or_else` won't help — mark
`ignore` or add an `unwrap_or_default` if appropriate.

---

## Recommendations (priority-ordered)

| Priority | Action                                                                                          | LoC  | Touched crates                                   |
| :------- | :---------------------------------------------------------------------------------------------- | ---: | :----------------------------------------------- |
| **P0**   | Replace `.lock().expect(...)` with `.lock().unwrap_or_else(|p| p.into_inner())` in **pheno-tracing/sampling.rs** | ~10  | pheno-tracing                                    |
| **P0**   | Same fix in **pheno-port-adapter/src/adapters/{tcp,unix}.rs**                                  | ~20  | pheno-port-adapter                               |
| **P1**   | Move 17 proptest `Arbitrary` regex `.expect()`s into `OnceLock<Regex>` (or `LazyLock` on Rust 1.80+) | ~60  | pheno-otel, pheno-context, pheno-port-adapter, pheno-flags, pheno-config |
| **P2**   | Mark 5 rustdoc `.unwrap()` examples `ignore` or rewrite as `Result`                             | ~15  | pheno-otel, pheno-errors, pheno-flags            |
| **P3**   | Add `clippy.toml` rule `clippy::unwrap_used = "warn"` at workspace root (substrate graduation per ADR-048) | ~5   | All 10 pheno-* crates                            |
| **P3**   | Add `clippy.toml` rule `clippy::panic = "warn"` (Rust 1.81+) to block `panic!` in non-test src  | ~5   | All 10 pheno-* crates                            |

**Aggregate LoC:** ~115 LoC across 10 crates; ~1 PR per crate is fine (small
touches); can be batched into 2-3 PRs by area (tracing + port-adapter first,
then proptest cleanup, then lint rules).

**Estimated dev wall time:** 3-4 hours of focused work (device: macbook). No
heavy build cycles required — the affected crates are small. `cargo test`
on each touched crate is enough to verify.

---

## Verdict

**The fleet is already close to panic-free.** Out of 105 raw matches in `src/`:

- 13 are real production paths (8 in transport mutexes, 5 in sampler mutexes).
- 17 are proptest-only (compile-in, runtime-unreachable for normal consumers).
- 75 are in test or doctest code and never ship.
- 1 is an intentional `panic!` in the chaos harness (excluded by design).

**Net:** 30 sites need attention (Bucket A + B), of which only 13 are
production-real. A focused 3-4 hour sweep brings the fleet to **zero
panic-on-normal-API-call** status — a meaningful step toward substrate
graduation (ADR-048) and predictive DRY (ADR-047).

---

## Appendix A — Per-file detail (Bucket A + B only)

```
pheno-port-adapter/src/lib.rs:116,120,124,139                  (B) proptest adapter_error regex ×3, connection id ×1
pheno-port-adapter/src/adapters/tcp.rs:45,65,76                (A) mutex poisoned ×3
pheno-port-adapter/src/adapters/unix.rs:50,69,80               (A) mutex poisoned ×3
pheno-port-adapter/src/adapters/mock_clock.rs:153,162          (A-L) test-double mutex ×2
pheno-otel/src/lib.rs:120,124,128,132,147,149                  (B) proptest otlp_error ×4, endpoint ×1, service_name ×1
pheno-otel/src/init.rs:52,81                                   (D) doctest .expect ×2
pheno-context/src/lib.rs:21,101,103,105                        (B) proptest ContextError/id/metadata regex ×4
pheno-config/src/secrets.rs:159                                (B) proptest non_empty_ascii_string regex ×1
pheno-flags/src/lib.rs:41                                      (D) doctest .unwrap ×1
pheno-flags/src/lib.rs:233,249                                 (B) proptest flag error/key regex ×2
pheno-errors/src/lib.rs:72                                     (D) doctest .unwrap ×1
pheno-errors/src/rfc7807.rs:30                                 (D) doctest .unwrap ×1
pheno-tracing/src/sampling.rs:261,353,379,389,400              (A) lock().unwrap() in tail sampler ×5
pheno-chaos/crates/pheno-chaos/src/runtime.rs:130              (E) intentional panic! ×1
```

## Appendix B — Commands run

```bash
# Per-crate src/ raw counts
for crate in pheno-cli-base pheno-config pheno-context pheno-errors \
            pheno-events pheno-flags pheno-otel pheno-port-adapter \
            pheno-tracing; do
  rg -c --type rust '\b(panic!|unwrap\(\)|expect\()' "$crate/src"
done

# Per-file production-only listing (test_start = first ^#\[cfg\(test\)\] line)
# See /tmp/top_hits.sh in the audit session.
```

## Appendix C — Out of scope (worktrees)

The audit covers the canonical pheno-* crates at the monorepo root. Worktree
duplicates (under `FocalPoint/`, `HeliosLab/`, `phenoData/`, `phenoUtils/`,
`phenoUtils-phenoschema-final/`, `phenotype-python-sdk/packages/`,
`phenotype-go-sdk/packages/`, `phenoAI/crates/`, `pheno/packages/`,
`pheno/python/`, `pheno/agileplus/`, `helios-cli/crates/`) are excluded —
they will diverge once the canonical sweep lands. Re-audit recommended post-merge.
