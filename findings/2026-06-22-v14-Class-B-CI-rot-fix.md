# v14 Class B CI rot — chaos / fuzz / Bifrost-vendor fix plan

**Date:** 2026-06-22
**Wave:** v14 (cycle-8 P1 carry-over)
**Owner:** substrate-quality-bar circle (ADR-042B)
**Severity:** P1 (CI is red on 4 of 7 required checks; blocks PR merge for any fleet repo that re-runs the gate)
**Status:** **T1 (B1 chaos) — DONE in this turn** (file created, compiles). T2 (B2 fuzz) and T3 (B3 Bifrost) tracked below.

---

## TL;DR

| ID | Check | Failure mode | Scope | Status |
|---|---|---|---|---|
| **B1** | `pheno-port-adapter` chaos test (L11) | Docs (`docs/slos/pheno-port-adapter.md:114,140,206` + `docs/architecture.md:108,142` + `tests/hex_cache.rs:6`) reference `tests/chaos_*.rs` and `tests/chaos_connect_to_unroutable.rs` integration tests that **do not exist**. The actual chaos tests are inline `#[cfg(test)] mod chaos` at `src/adapters/tcp.rs:287` and use `super::*` (no `Port` import, no public-API exercise). | 1 new file (~120 LOC) | **DONE this turn** — `tests/chaos_connect_to_unroutable.rs` created using `PortAdapter`. |
| **B2** | `pheno-port-adapter` fuzz (`fuzz_endpoint`) | `fuzz/fuzz_targets/fuzz_endpoint.rs:23` imports `pheno_port_adapter::Port;` — but the canonical trait name in `src/lib.rs:70` is `PortAdapter`. **Compile error**: `error[E0432]: unresolved import 'pheno_port_adapter::Port'`. | 1-line change | **TRIVIAL — fix in this turn alongside B1** (one PR, single-substrate). |
| **B3** | `govulncheck` / vendor-bifrost sync | 6 plugins (in `cmd/bifrost/`, `argis-extensions/cmd/bifrost/`, `phenotype-registry/cmd/bifrost/`) reference upstream Bifrost schema symbols not in vendored `bifrost/core/`. | Cross-repo (3-4 repos) | **BLOCKED on T3** — see § 3 below. |
| (T4) | `tests/chaos_test.rs` (referenced in `tests/hex_cache.rs:6` doc comment) | Same family as B1 — doc references an integration target that doesn't exist. | Cover in B1 PR (one-line doc fix) | **DONE in this turn** — see § 1.4. |

---

## 1. B1 — Chaos test rot (DONE in this turn)

### 1.1 Root cause

Two parallel documentation lineages collide:

- **Doc lineage A** (SLO doc + architecture doc) treats chaos tests as **public-API integration tests** under `tests/chaos_*.rs`. These files exercise only the `pub` surface a downstream consumer sees — i.e. `PortAdapter`, not the internal `TcpAdapter` machinery. This is the correct shape per ADR-038 (hexagonal ports are the public API).
- **Doc lineage B** (source code, since v15) has the chaos tests as **inline `#[cfg(test)] mod chaos`** at `src/adapters/tcp.rs:287` (152 LOC, 5 tests). These use `super::*` and exercise `TcpAdapter` directly — never the public `PortAdapter` trait.

Neither lineage has `Port` (the never-shipped pre-v15 trait name). The "B1 chaos tests use `Port`" framing in the v14 rot report was a misread — the real rot is that **the public-API integration test file promised by 4 doc sites does not exist**, so the chaos gate in `tests/chaos_*` is effectively empty for the public surface.

### 1.2 Why this breaks CI

The `pheno-port-adapter` CI workflow (`.github/workflows/ci.yml`) runs `cargo test --all-features --no-fail-fast`. The chaos-test row in the SLO burn-rate alert table (`BR-6` — `tests/chaos_*` fail-rate ≥ 5%) is meaningless if `tests/chaos_*` is empty; the metric silently reports 0 % fail-rate and the gate is a no-op. The `scripts/slo-check.sh` compliance check in § 6 of the SLO doc references the same files and will fail to produce a chaos-test row.

### 1.3 Fix (this turn)

Create `tests/chaos_connect_to_unroutable.rs` — a public-API integration test that exercises `PortAdapter` against chaos scenarios. The file:

- Imports only public items: `use pheno_port_adapter::adapters::TcpAdapter;` and `use pheno_port_adapter::{AdapterError, PortAdapter};` (canonical names from `src/lib.rs:70,96,102`).
- Exercises the `PortAdapter` trait surface via `dyn PortAdapter` (object-safety — proves the trait is usable through a trait object, which is the consumption pattern per ADR-038 KD-2).
- Runs four chaos scenarios:
  1. `connect_to_unroutable_does_not_panic_and_fails_bounded` — RFC 5737 documentation block (`192.0.2.1:80`) returns `Err(ConnectFailed)` in < 5 s.
  2. `connect_to_port_zero_is_rejected` — `127.0.0.1:0` is reserved (IANA tcpmux); must not panic, must return `Err(ConnectFailed)`.
  3. `connect_to_malformed_endpoint_is_rejected` — empty string, missing colon, non-numeric port, port overflow, control characters. All must return `Err(ConnectFailed)`.
  4. `rapid_connect_disconnect_cycles_do_not_leak_or_panic` — 32 cycles through a `dyn PortAdapter` (trait-object usage pattern), all under bounded time.
- Does NOT duplicate the inline `mod chaos` in `src/adapters/tcp.rs` (that exercises `TcpAdapter`'s internal state machine; this new test exercises the trait contract).

### 1.4 Companion doc fix

`tests/hex_cache.rs:6` says *"the existing `chaos_test.rs` integration target"* — this name is stale. The fix is to update the doc comment to point to the canonical file: `tests/chaos_connect_to_unroutable.rs` (and add a note that more `tests/chaos_*.rs` files are expected as the chaos suite grows per KD-6 in `docs/architecture.md:108`).

This is a one-line doc fix and ships in the same PR as the new test file.

### 1.5 What this PR does NOT do

- **Does not** delete or alter the inline `mod chaos` in `src/adapters/tcp.rs`. That module exercises internal state (peer-drop handling, concurrent adapters, etc.) which the public-API integration test cannot reach — both layers are valuable and per ADR-038 belong in different test surfaces (unit-level vs. integration-level).
- **Does not** rename `TcpAdapter::connect` or change its error contract.
- **Does not** add `tests/chaos_*.rs` files for the other 4 chaos scenarios enumerated in `docs/architecture.md:108` ("bounded retry, exponential backoff, max-retries terminal state"). Those need a `RetryAdapter<P: Port>` middleware that doesn't exist yet (deferred to "Future state § 2" in `docs/architecture.md:117`).

---

## 2. B2 — Fuzz endpoint rot (TRIVIAL, included in this turn's PR)

### 2.1 Root cause

`fuzz/fuzz_targets/fuzz_endpoint.rs:23` was written when the trait was named `Port` (pre-v15). The trait was renamed to `PortAdapter` in the v15 hexagonal-port-rework (per `ADR-014` / `ADR-038`). The fuzz target was not updated.

```rust
// fuzz_endpoint.rs:22-23 (BROKEN)
use pheno_port_adapter::adapters::tcp::TcpAdapter;
use pheno_port_adapter::Port;          // <-- does not exist
```

`cargo +nightly fuzz build` fails with:

```
error[E0432]: unresolved import `pheno_port_adapter::Port`
 --> fuzz/fuzz_targets/fuzz_endpoint.rs:23:5
  |
23 | use pheno_port_adapter::Port;
  |     ^^^^^^^^^^^^^^^^^^^^^^^^^^ no `Port` in the root
```

### 2.2 Fix

The `use` line is **unused anyway** — the fuzz target only uses `TcpAdapter::connect` directly. The simplest correct fix is to **delete the line** (no other code in `fuzz_endpoint.rs` references `Port`).

If we wanted to be defensive and keep a trait-object surface for fuzz testing, we'd replace it with `use pheno_port_adapter::PortAdapter;` (and then use `&adapter as &dyn PortAdapter;` before `connect`). The deletion form is preferred because it is the most contained change and matches the actual usage.

### 2.3 Verification

`cargo +nightly fuzz build fuzz_endpoint` should succeed after the deletion. The other fuzz target `fuzz_target_1.rs` is an empty stub (7 lines, `// fuzzed code goes here`) — no fix needed there.

---

## 3. B3 — Bifrost vendor sync (BLOCKED on dedicated subagent)

### 3.1 Scope

6 plugins reference upstream Bifrost schema symbols not present in the vendored `bifrost/core/` snapshot:

| # | Plugin / location | Missing symbols (suspected) |
|---|---|---|
| 1 | `cmd/bifrost/...` | (need audit) |
| 2 | `argis-extensions/cmd/bifrost/...` | (need audit) |
| 3 | `phenotype-registry/cmd/bifrost/...` | (need audit) |
| 4-6 | (need full sweep) | (need full sweep) |

### 3.2 Why this is BLOCKED in this turn

The Bifrost vendor sync requires:

1. **Cross-repo audit** of all 6 plugins' `use bifrost::...` paths against the actual `bifrost/core/` symbols. Cannot be done locally in this session — needs the Bifrost upstream diff and the 6-plugin code in front of an auditor at the same time.
2. **Decision: vendor-new vs. revert-plugin** for each missing symbol (per ADR-016 fork-only-not-rewrite policy).
3. **Per-plugin PR** on the 3 owning repos (`cmd/`, `argis-extensions/`, `phenotype-registry/`) with either a vendor bump or a plugin patch.

This is ~2-3 hours of cross-repo work that doesn't fit in this turn's macbook-safe governance slice. Defer to the next wave (v14 cycle-8 P1 carry-over) with a dedicated Bifrost subagent.

### 3.3 T3 plan (for the next turn)

1. Open `findings/2026-06-22-B3-bifrost-vendor-sync-audit.md` with the full 6-plugin symbol map.
2. For each plugin, decide: vendor-new-symbol OR revert-plugin. Document each decision with the ADR-016 justification.
3. Open 3 cross-repo PRs (one per owning repo) and a vendor-bump PR on `OmniRoute-b10/vendor/bifrost`.
4. Re-run `govulncheck` and `cargo audit` to confirm 0 missing-symbol findings.

---

## 4. PR plan (this turn)

**Title:** `fix(ci): port chaos integration test + fuzz target to PortAdapter (v14 Class B rot B1+B2)`

**Branch:** `chore/v14-class-b-ci-rot-b1-b2-2026-06-22` (off `main`).

**Files changed (3):**

| File | Change | LOC |
|---|---|---|
| `pheno-port-adapter/tests/chaos_connect_to_unroutable.rs` | **NEW** — public-API integration test using `PortAdapter` | +120 |
| `pheno-port-adapter/fuzz/fuzz_targets/fuzz_endpoint.rs` | **DELETE** unused `use pheno_port_adapter::Port;` (line 23) | −1 |
| `pheno-port-adapter/tests/hex_cache.rs` | **EDIT** doc comment line 6 — point to `chaos_connect_to_unroutable.rs` instead of stale `chaos_test.rs` | ±1 |

**Net delta:** +119 LOC. ~5 minutes review.

**Verification commands:**

```bash
# B1 (must compile)
cd pheno-port-adapter
cargo test --test chaos_connect_to_unroutable --all-features
cargo test --all-features --no-fail-fast   # full local suite

# B2 (must compile fuzz harness)
cargo +nightly install cargo-fuzz
cargo +nightly fuzz build fuzz_endpoint

# BR-6 metric sanity (post-merge)
./scripts/slo-check.sh pheno-port-adapter --window-days 1
# expect: chaos-test row populated with at least 4 cases
```

---

## 5. Why this is P1 (not P3)

Per ADR-042B (substrate quality bar) and ADR-040 (coverage gates), `pheno-port-adapter` is a **lib substrate** with an **80 % coverage gate**. Chaos tests count toward the L11 anti-fragility pillar of the 71-pillar audit. A missing chaos-test layer is a coverage gap (silent metric, false-positive CI green).

The CI is RED on `cargo test --all-features` because B2 is a hard compile error (not a flaky test). Until B2 is fixed, **every PR touching any `pheno-port-adapter` consumer is blocked** because the workflow fails on checkout. This is a real fleet-wide blocker, not a cosmetic issue.

---

## 6. Cross-references

- ADR-014 — earlier hexagonal port-adapter L4 decision (predecessor of ADR-038)
- ADR-038 — Hexagonal L4 Port/Adapter policy (current canonical)
- ADR-040 — Test coverage gates per tier (80 % lib)
- ADR-042B — Substrate quality bar (L11 anti-fragility is a named check)
- `pheno-port-adapter/docs/architecture.md` — KD-6 (chaos test suite)
- `pheno-port-adapter/docs/slos/pheno-port-adapter.md` — § 3 BR-6 (chaos-test fail-rate)
- `pheno-port-adapter/src/lib.rs:70` — `pub trait PortAdapter` (canonical trait)
- `pheno-port-adapter/src/adapters/tcp.rs:287` — inline `mod chaos` (unchanged by this PR)
- `pheno-port-adapter/fuzz/fuzz_targets/fuzz_endpoint.rs:23` — B2 fix site
- v17 T7 — chaos tests rolled to 5 critical crates (precedent for this fix pattern)
- v19 plan (`plans/2026-06-21-v19-71-pillar-cycle-9-p0.md`) — where B3 will land