# Guard — Fuzz Tests for the Rule Engine (side-15)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-15
**Agent:** orch-v11-real-guard-3
**Verdict:** The rule engine (referenced as `pheno-rules` / `phenotype-policy` depending on the repo) has **zero fuzz coverage**. Two known panics reachable from `Rule::eval()` were patched in 2026-Q1 without regression coverage; this finding establishes a `cargo-fuzz` target and a weekly OSS-Fuzz-equivalent cron.

## Scope

The rule engine is a deterministic expression evaluator consumed by 4 fleet repos (pheno-flags, phenotype-policy, phenotype-workflow, phenotype-hub). Input grammar: predicate AST (sum-type of `Literal | Ref | And | Or | Not | Compare`), serialized as JSON or RON. Panics observed in production: (a) stack overflow on deeply nested `And` chains, (b) integer overflow in `Compare::Duration` arithmetic.

## Survey (2026-06-20)

| Repo containing the rule engine | `fuzz/` dir | `cargo fuzz` targets | OSS-Fuzz integration | Coverage |
|---|---|---|---|---|
| `pheno-rules` (canonical, ADR-013) | no | 0 | no | 0 lines |
| `phenotype-policy` (legacy) | no | 0 | no | 0 lines |
| `pheno-flags` (consumer) | no | 0 | n/a | n/a |
| `phenotype-workflow` (consumer) | no | 0 | n/a | n/a |

Coverage: **0%** of the rule-engine entry points have fuzz coverage.

## Fuzz target design (3 targets, minimal viable)

```rust
// fuzz/fuzz_targets/eval_ron.rs
#![no_main]
use libfuzzer_sys::fuzz_target;
use pheno_rules::{Rule, Value};

fuzz_target!(|data: &[u8]| {
    // Best-effort parse; ignore parse errors.
    if let Ok(rule) = ron::de::from_bytes::<Rule>(data) {
        let _ = rule.eval(&Value::default());
    }
});

// fuzz/fuzz_targets/eval_json.rs
// fuzz/fuzz_targets/serde_roundtrip.rs — guarantees serialize/deserialize equivalence
```

Target properties:
- **eval_ron**: catches stack-overflow, panics in arithmetic, divide-by-zero.
- **eval_json**: catches deserialization memory blowups, integer overflow during parse.
- **serde_roundtrip**: catches refactor breakage (every AST node must round-trip cleanly).

## CI integration

```yaml
# .github/workflows/fuzz.yml
name: fuzz
on:
  schedule: [{ cron: '0 6 * * *' }]   # nightly 06:00 PDT, 60-min wall budget
  pull_request:
    paths: ['crates/pheno-rules/**', 'fuzz/**']
jobs:
  fuzz:
    runs-on: ubuntu-latest-heavy
    timeout-minutes: 90
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@nightly
        with: { targets: 'x86_64-unknown-linux-gnu' }
      - run: cargo install --locked cargo-fuzz
      - run: cargo fuzz run eval_ron -- -max_total_time=3600 -max_len=65536
      - run: cargo fuzz run eval_json -- -max_total_time=3600 -max_len=65536
      - run: cargo fuzz run serde_roundtrip -- -max_total_time=1800
      - if: failure()
        uses: actions/upload-artifact@v4
        with: { name: fuzz-crash, path: fuzz/artifacts/ }
```

## Seed corpus (initial)

- All 12 unit-test fixtures (`crates/pheno-rules/tests/fixtures/*.ron`).
- All 8 example predicates from `pheno-rules/examples/`.
- A minimal corpus generator (`fuzz/corpus_gen/`) that emits 10k randomly-shaped ASTs obeying `serde_json::Value` invariants — ensures the fuzzer can mutate into non-trivial shapes.

## Why this matters

1. The 2026-Q1 patch for `Compare::Duration` overflow landed without fuzz coverage; **a single regression test** is not enough to catch the same class of bug in adjacent arithmetic sites.
2. RON and JSON deserialization are two distinct attack surfaces for untrusted input — both must be covered.
3. Cargo-fuzz finds bugs in seconds that unit tests miss in years; cost is a nightly 60-minute cron job, ~$5 of CI.

## Action items

1. **Add `cargo-fuzz` to `pheno-rules`** — create `fuzz/Cargo.toml`, `fuzz/fuzz_targets/{eval_ron,eval_json,serde_roundtrip}.rs`. Estimated 80 LOC.
2. **Generate seed corpus** — copy existing fixtures, add `corpus_gen` (40 LOC).
3. **Wire weekly fuzz cron** — see CI yaml above.
4. **Open PR `phenotype-policy#X`** to mark `pheno-rules` as canonical and add a `fuzz/` symlink (deprecation notice).
5. **Backfill oss-fuzz project config** (`Dockerfile`, `project.yaml`) — optional but recommended; OSS-Fuzz free tier covers OSS Rust.

## When to skip

- `phenotype-policy` itself — should *not* gain fuzz targets; the deprecation path is to delete the crate. Once deleted, fuzz coverage on `pheno-rules` covers all downstream consumers.
- Consumer crates (`pheno-flags`, `phenotype-workflow`) — they only consume `Rule`, not parse it. Fuzz on the consumer side would be redundant.

## Acceptance criteria

- `pheno-rules/fuzz/` ships with 3 targets and seed corpus within **1 week**.
- Nightly cron runs for **2 consecutive weeks** without crashing.
- Any crash found is filed as a P0 bug and patched within **48 hours**.

**Refs:** `ADR-013` (mcp-router substrate), `ADR-040` (coverage gates), `pheno-rules/src/eval.rs`, `findings/2026-06-15-L5-110-substrate-audit.md`.