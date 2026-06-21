# SIDE-03: Test coverage expansion for pheno-errors

**Date:** 2026-06-21
**Branch:** `feat/side-03-test-coverage-2026-06-21`
**Commit:** `2d63a0ab1e` (local only — NOT pushed per task directive)
**Crates touched:** `pheno-errors` (Cargo.toml + src/lib.rs + src/rfc7807.rs)
**Diff:** +172 / -0 (3 files)

## Headline

| Metric                     | Before | After | Δ      |
|----------------------------|-------:|------:|-------:|
| `cargo test -p pheno-errors --lib` passing tests |     20 |    25 | **+5** |
| Failing / ignored          |      0 |     0 |    0   |
| Critical-path branches untested |   5 |     0 |   -5   |

## The 5 tests added

### 1. `tests::log_warn_actually_emits_tracing_event`
**File:** `pheno-errors/src/lib.rs:347-379`
**Closes:** `AppError::log_warn` (`lib.rs:172-179`)

The existing `log_warn_preserves_error` (`lib.rs:331-335`) only checked that
the function returned the same value (passthrough). It never asserted the
emit side-effect — i.e., that `tracing::warn!` actually fires with the
structured fields. Without this test, `log_warn` could be silently
refactored to a no-op and the suite would still be green.

Uses `#[traced_test]` from `tracing-test = "0.2"` to capture events.
Asserts four things:
1. Return value preserved (passthrough contract).
2. `logs_contain("error")`, `logs_contain("validation")`,
   `logs_contain("email format invalid")` — message field + kind tag +
   display string all surfaced.
3. `logs_contain("WARN")` — correct level.
4. `!logs_contain("ERROR")` — must NOT promote to ERROR.

### 2. `tests::log_error_actually_emits_tracing_event`
**File:** `pheno-errors/src/lib.rs:381-412`
**Closes:** `AppError::log_error` (`lib.rs:185-192`)

Same gap as test 1, but for the ERROR-level helper. Asserts:
1. Return value preserved.
2. `logs_contain("storage")`, `logs_contain("disk write failed")` —
   structured fields surface.
3. `logs_contain("ERROR")` — level must be ERROR (distinct from
   `log_warn`'s WARN).

These two tests together pin the **level-promotion semantics** that
distinguish the two helpers, which was previously only documented in
doc-comments and never asserted.

### 3. `rfc7807::tests::not_found_sets_instance_field`
**File:** `pheno-errors/src/rfc7807.rs:269-293`
**Closes:** `From<&AppError>` NotFound branch — `with_instance(format!("{entity}/{id}"))` at `rfc7807.rs:154`

The existing `not_found_maps_to_404` (`rfc7807.rs:174-189`) checks
status, title, detail, and problem_type. It **never reads
`problem.instance`**, so the `with_instance(...)` call at line 154 was
silently untested. A future refactor could drop that line and the suite
would still pass.

Asserts:
1. `problem.instance == Some("order/ord_abc123")` — follows the
   `{entity}/{id}` convention.
2. `json.contains("\"instance\":\"order/ord_abc123\"")` — round-trips
   through the wire format.

### 4. `rfc7807::tests::problem_new_constructor_isolated_fields`
**File:** `pheno-errors/src/rfc7807.rs:295-327`
**Closes:** `Problem::new` constructor (`rfc7807.rs:92-100`)

`Problem::new` was only ever tested **chained** with `with_type(...)` /
`with_instance(...)` (see `builder_round_trips` at `rfc7807.rs:237-245`).
The constructor's own behavior — "set the three required-ish fields,
leave problem_type and instance as `None`" — was inferred but never
asserted.

Asserts:
1. `status == Some(503)`, `title == Some("Service Unavailable")`,
   `detail == Some("upstream timed out")` — populated correctly.
2. `problem_type.is_none()`, `instance.is_none()` — optional fields
   default to `None` as documented.
3. JSON wire format omits both `"type"` and `"instance"` — i.e., the
   `skip_serializing_if = "Option::is_none"` behavior holds for the
   constructor's defaults.

### 5. `rfc7807::tests::problem_json_wire_format_with_all_fields`
**File:** `pheno-errors/src/rfc7807.rs:329-366`
**Closes:** `Problem` serde rename + full positive-case wire format

No previous test exercised the **serde rename** (`#[serde(rename = "type")]`
at `rfc7807.rs:57`) in a positive case. The existing
`none_fields_are_omitted_from_json` (`rfc7807.rs:254-267`) only checks
that `None` fields are skipped, not that a populated `problem_type`
serialises as `"type"` (the RFC 7807 §3.1 mandated key). A refactor that
removed the rename would not be caught.

Asserts:
1. `json.contains("\"type\":\"https://errors.pheno.dev/not-found\"")` —
   the rename works.
2. `!json.contains("problem_type")` — no Rust field name leaks through.
3. All 5 spec fields present in the wire format: `type`, `title`,
   `status`, `detail`, `instance`.
4. The wire format is itself valid JSON (re-parsed via
   `serde_json::from_str::<serde_json::Value>`) and the values match.

## Before / after count

```
$ cargo test -p pheno-errors --lib
running 25 tests
test rfc7807::tests::conflict_maps_to_409 ... ok
test rfc7807::tests::builder_round_trips ... ok
test rfc7807::tests::default_is_about_blank ... ok
test rfc7807::tests::domain_maps_to_500_about_blank ... ok
test rfc7807::tests::none_fields_are_omitted_from_json ... ok
test rfc7807::tests::not_found_maps_to_404 ... ok
test rfc7807::tests::not_found_sets_instance_field ... ok          <-- NEW (3)
test rfc7807::tests::problem_json_wire_format_with_all_fields ... ok  <-- NEW (5)
test rfc7807::tests::problem_new_constructor_isolated_fields ... ok   <-- NEW (4)
test rfc7807::tests::storage_maps_to_500_about_blank ... ok
test rfc7807::tests::validation_maps_to_400 ... ok
test tests::appresult_alias_works ... ok
test tests::display_formats_variants ... ok
test tests::from_anyhow_creates_domain ... ok
test tests::from_anyhow_preserves_cause_chain ... ok
test tests::from_io_error_creates_storage ... ok
test tests::from_string_creates_domain ... ok
test tests::from_str_creates_domain ... ok
test tests::kind_returns_correct_tag ... ok
test tests::log_error_actually_emits_tracing_event ... ok          <-- NEW (2)
test tests::log_error_preserves_error ... ok
test tests::log_warn_actually_emits_tracing_event ... ok           <-- NEW (1)
test tests::log_warn_preserves_error ... ok
test tests::proptest_domain_kind ... ok
test tests::proptest_not_found_kind ... ok

test result: ok. 25 passed; 0 failed; 0 ignored; 0 measured; 0 filtered out
```

| Item                                         | Before | After | Δ   |
|----------------------------------------------|-------:|------:|-----|
| Total lib tests passing                      |     20 |    25 | +5  |
| Critical-path branches without test          |      5 |     0 | -5  |

## Cargo.toml change

One line added: `serde_json = "1"` to `[dev-dependencies]`.

This was a **pre-existing missing dev-dependency** that blocked test
compilation — the existing tests in `rfc7807` already called
`serde_json::to_string(...)` but `serde_json` was not declared. The
upstream tests worked anyway only because `serde` (with `derive`)
transitively pulls in some serialization types but not the JSON
serialization crate itself. Without this fix, the new wire-format tests
would not have compiled either.

## Why these 5 (selection rationale)

The audit was path-driven: enumerate every public function and
`From` branch in `src/lib.rs` and `src/rfc7807.rs`, then check whether
the **observable side-effect** (not just the return value) was
asserted. Each of the 5 chosen paths has the same structural gap:

| Gap pattern                                                           | Found in                |
|-----------------------------------------------------------------------|-------------------------|
| Return value asserted but side-effect not                             | Tests 1, 2              |
| Branch taken but specific field never read                            | Test 3                  |
| Constructor only tested in chained form, defaults never asserted      | Test 4                  |
| Serde rename never asserted positive; only omission was tested        | Test 5                  |

Other functions (constructors, `From` impls for `io::Error` / `&str` /
`String` / `anyhow::Error`, `kind()`, `Default for Problem`, `Display`)
were already exercised by the existing 20 tests, so they are not in
scope here.

## Caveats / known issues

- **`cargo test -p pheno-errors` (without `--lib`) still fails** due
  to 5 pre-existing compile errors in `examples/otel_quickstart.rs`
  that reference types and methods that don't exist on `AppError`
  (`ErrorContext`, `with_context`, `From<ParseIntError>`). These errors
  pre-date this change (the example was committed broken) and are
  unrelated to test coverage. Tracked separately.
- **Branch not pushed.** Per task directive: "DO NOT push."

## Files changed

```
pheno-errors/Cargo.toml     |  1 +
pheno-errors/src/lib.rs     | 72 +++++++++++++++++++++++++++++++++
pheno-errors/src/rfc7807.rs | 99 +++++++++++++++++++++++++++++++++++++++++++++
3 files changed, 172 insertions(+)
```

## Verification commands

```bash
# In an isolated worktree at /tmp/side-03-wt (or any checkout of the branch):
cargo test -p pheno-errors --lib

# Verify the 5 new tests are present by name:
cargo test -p pheno-errors --lib log_warn_actually_emits_tracing_event
cargo test -p pheno-errors --lib log_error_actually_emits_tracing_event
cargo test -p pheno-errors --lib not_found_sets_instance_field
cargo test -p pheno-errors --lib problem_new_constructor_isolated_fields
cargo test -p pheno-errors --lib problem_json_wire_format_with_all_fields
```
