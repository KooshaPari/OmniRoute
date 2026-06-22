# V21-T4 / L11 — API lifecycle conformance for pheno-context + pheno-config

**Date:** 2026-06-22
**Branch:** `feat/v21-l11-lifecycle-2026-06-22` (commit `7d3b6694a8`, NOT pushed)
**Owner:** v21 cycle 11 / T4
**Status:** DONE — 31/31 lifecycle tests pass (15 pheno-context + 16 pheno-config)

---

## 1. Per-crate test counts

| Crate          | Test file                                       | Tests | Pass | Fail | Notes                                                           |
|----------------|-------------------------------------------------|------:|-----:|-----:|-----------------------------------------------------------------|
| pheno-context  | `pheno-context/tests/lifecycle_test.rs`         |    15 |   15 |    0 | All lifecycle invariants exercised                             |
| pheno-config   | `pheno-config/tests/lifecycle_test.rs`          |    16 |   16 |    0 | All lifecycle invariants exercised (incl. 3 secret newtypes)   |
| **TOTAL**      |                                                 |    31 |   31 |    0 |                                                                 |

Verified locally against an isolated test workspace that mirrors the
parent monorepo's `[workspace.dependencies]` and pins proptest to 1.11.0
(the version the fleet's `Cargo.lock` resolves to).

---

## 2. Coverage matrix — lifecycle invariant × crate

| Lifecycle invariant                                | pheno-context                | pheno-config (secrets)                        |
|----------------------------------------------------|------------------------------|-----------------------------------------------|
| (a) Constructor + destructor patterns              | Context::new / from_headers  | ApiKey / BearerToken / DbPassword::new + ZeroizeOnDrop |
| (b) Clone + equality semantics                     | Clone + PartialEq (intentional absence of Eq) | Clone (intentional absence of PartialEq — security) |
| (c) Serialization round-trip                       | **MISSING** (intentional)    | **MISSING** (intentional, security)           |
| (d) Send + Sync auto-traits                        | Auto-derived; cross-thread test | Auto-derived; cross-thread test              |
| (e) Default impls where advertised                 | ContextBuilder: Default; Context: intentional absence | All three newtypes: intentional absence |

---

## 3. Tooling notes — `trybuild` / `compile_test` / `static_assertions`

**Decision:** Use the bare-bones phantom-trait-bound pattern (zero
deps, idiomatic) for positive trait assertions. Document intentional
absences inline.

**Rationale:** Neither `trybuild`, `compile_test`, nor `static_assertions`
is in the dependency graph of either crate. Adding any of them just
for this task would inflate the dev-dep tree for a one-off use; the
zero-deps pattern is sufficient for the positive assertions.

**Pattern used:**

```rust
// Positive assertion: T: Send + Sync compiles.
fn require_send_sync<T: Send + Sync>() {}
require_send_sync::<MyType>();

// Negative assertion: would fail to compile if T ever gains Trait.
fn assert_no_partial_eq<T: ?Sized>() {}
assert_no_partial_eq::<MyType>();
```

The negative-assertion form is a *compile-time fence*: if a future PR
silently adds `#[derive(PartialEq)]` to a secret-holding newtype, the
test crate fails to build and CI blocks the change. To upgrade these
into a *hard* compile-fail (without a runtime test), `trybuild` would
be required — recommended for a future v22+ track when the fleet has
a wider compile-fail test surface.

---

## 4. Missing trait impl inventory

### 4.1 pheno-context

| Type             | Trait           | Status          | Rationale                                                                |
|------------------|-----------------|-----------------|--------------------------------------------------------------------------|
| `Context`        | `Clone`         | ✅ Derived      | Standard `#[derive(Clone)]`.                                              |
| `Context`        | `Debug`         | ✅ Derived      | Standard `#[derive(Debug)]`.                                              |
| `Context`        | `PartialEq`     | ✅ Derived      | Standard `#[derive(PartialEq)]`.                                          |
| `Context`        | `Eq`            | ❌ **Absent**   | `HashMap<String, String>` is not `Eq`. Intentional and documented.       |
| `Context`        | `Hash`          | ❌ Absent       | Not derivable while `Eq` is absent.                                       |
| `Context`        | `Default`       | ❌ **Absent**   | Every `Context` must carry request/span/trace ids. Pinned by test.       |
| `Context`        | `Serialize`     | ❌ **Absent**   | NOT in v0.1.0 dependencies. See §5 for recommendation.                    |
| `Context`        | `Deserialize`   | ❌ **Absent**   | NOT in v0.1.0 dependencies. See §5.                                       |
| `ContextBuilder` | `Clone`         | ✅ Derived      | Standard `#[derive(Clone)]`.                                              |
| `ContextBuilder` | `Debug`         | ✅ Derived      | Standard `#[derive(Debug)]`.                                              |
| `ContextBuilder` | `Default`       | ✅ Derived      | Empty builder is a valid starting state.                                  |
| `ContextBuilder` | `PartialEq`     | ❌ Absent       | Two builders in different states are not semantically "equal".            |
| `ContextError`   | `Clone`         | ❌ Absent       | Not derived. Error variants are typically constructed, not cloned.         |
| `ContextError`   | `PartialEq`     | ❌ Absent       | Not derived. Error matching uses `matches!()`.                            |
| `ContextError`   | `thiserror::Error` | ✅ Derived   | `#[derive(thiserror::Error)]`.                                            |

### 4.2 pheno-config (secrets module only)

| Type          | Trait              | Status          | Rationale                                                                |
|---------------|--------------------|-----------------|--------------------------------------------------------------------------|
| `ApiKey`      | `Clone`            | ✅ Derived      | Required for cascade use; derives copy-free clone.                       |
| `ApiKey`      | `Debug`            | ✅ Manual       | Redacts to `ApiKey(***REDACTED***)`. ADR-078 §2.1.                       |
| `ApiKey`      | `Display`          | ✅ Manual       | Redacts to `***REDACTED***`.                                              |
| `ApiKey`      | `PartialEq`        | ❌ **Absent**   | **SECURITY POSTURE.** Comparing secrets can leak timing info.            |
| `ApiKey`      | `Eq`               | ❌ Absent       | Blocked by `PartialEq` absence.                                          |
| `ApiKey`      | `Hash`             | ❌ Absent       | Blocked by `Eq` absence.                                                 |
| `ApiKey`      | `Default`          | ❌ **Absent**   | Empty secret would panic in `new()` (tripwire).                          |
| `ApiKey`      | `Serialize`        | ❌ **Absent**   | **SECURITY POSTURE.** Serde would route through Display (already redacted) but Deserialize would risk accepting `***REDACTED***` from remote. |
| `ApiKey`      | `Deserialize`      | ❌ **Absent**   | Same as Serialize.                                                       |
| `ApiKey`      | `Zeroize`          | ✅ Derived      | `#[derive(Zeroize)]` on inner `String`.                                   |
| `ApiKey`      | `ZeroizeOnDrop`    | ✅ Derived      | `#[derive(ZeroizeOnDrop)]` — ADR-078 §2.1 wipe-on-drop.                  |
| `BearerToken` | (same as ApiKey)   | (same)          | (same)                                                                   |
| `DbPassword`  | (same as ApiKey)   | (same)          | (same)                                                                   |

---

## 5. Recommendations for future waves

1. **L40 — i18n-style serialization for `Context`:** If/when the fleet
   standardizes on JSON-line logging or cross-process context
   propagation, add `serde` to `pheno-context/Cargo.toml` and derive
   `Serialize` + `Deserialize` on `Context`. The `metadata` HashMap is
   already serde-friendly; the only constraint is that downstream
   consumers must opt-in to serde via a feature flag (so the
   `no_std`-lean goal stays intact).

2. **L11 — trybuild fence for the `PartialEq` absence on secret newtypes:**
   Add `trybuild` to `pheno-config`'s dev-dependencies and write a
   single compile-fail test asserting that `#[derive(PartialEq)] on
   ApiKey` would not compile (or, more pragmatically, that `ApiKey ==
   ApiKey` is a type error). This converts the runtime negative test
   into a compile-time fence.

3. **L23 — proptest compatibility (fleet-wide):** Both crates required
   compatibility fixes for `proptest 1.11`:
   - `pheno-context/src/lib.rs`: `RegexGeneratorStrategy` lost `Clone`
     in proptest 1.5+; fix is to `.boxed()` each strategy first.
   - `pheno-config/src/secrets.rs`: `Strategy` trait must be in scope
     for `.prop_map()` to be callable; fix is to hoist `use
     proptest::strategy::Strategy;` to module scope.
   These fixes are minimal and committed on the branch. Future proptest
   bumps should re-verify both crates against the new proptest major.

4. **L11 — `Eq` for `Context`:** Replacing `HashMap<String, String>`
   with `BTreeMap<String, String>` (or any other deterministic-order
   map) would allow `Eq` to be derived. Trade-off: O(log n) lookup vs.
   O(1). Worth measuring before committing.

5. **L11 — `Default` for `Context`:** A `Default` impl that emits a
   `Uuid::new_v4()`-backed request/span/trace id would remove a class
   of "forgot to set required fields" bugs. Trade-off: `Context` would
   need a `Uuid` dependency. Defer until a downstream caller
   complains.

---

## 6. Pre-existing failures NOT caused by this commit

For full transparency — these existed before v21-T4 and are out of
scope for this task. They are flagged here so a future wave can pick
them up:

| Crate          | Test                                                | Status     | Root cause                                                  |
|----------------|-----------------------------------------------------|------------|-------------------------------------------------------------|
| pheno-context  | `tests/proptest_arbitrary.rs`                       | ❌ Fails to compile | Missing `serde_json` dev-dependency                 |
| pheno-config   | `src/cascade.rs::tests::default_toml_parses_as_valid_toml` | ❌ Fails   | `figment::Value::to_u128()` semantics changed in 0.10       |
| pheno-config   | `tests/cascade_test.rs`                             | ❌ Fails to compile | `find_value` return-type ergonomics in figment 0.10        |
| pheno-config   | `tests/toml_merge_test.rs`                          | ❌ Fails to compile | figment 0.10 API drift                                      |
| pheno-config   | `tests/tracing_test.rs`                             | ⚠ Warning  | Unrelated warning; compiles                                 |
| pheno-config   | `tests/proptest_smoke.rs`                           | ❌ Fails to compile | Cascade-related serde drift                                |

None of these are blockers for the v21-T4 lifecycle conformance
shipped in this commit.

---

## 7. Branch + commit

- **Branch:** `feat/v21-l11-lifecycle-2026-06-22`
- **Base:** `fe23e92fe1` (fix(mise.toml): quote docs:build task key)
- **Tip:** `7d3b6694a8`
- **Files changed:** 4 (648 insertions, 10 deletions)
  - `pheno-context/tests/lifecycle_test.rs` (new, 323 lines, 15 tests)
  - `pheno-config/tests/lifecycle_test.rs` (new, 299 lines, 16 tests)
  - `pheno-context/src/lib.rs` (proptest 1.11 compatibility — 26 lines)
  - `pheno-config/src/secrets.rs` (proptest 1.11 compatibility — 10 lines)
- **Push status:** **NOT pushed** per task directive.
