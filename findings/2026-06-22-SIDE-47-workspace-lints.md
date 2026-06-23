# SIDE-47 — Cargo workspace lints audit (pheno-* fleet)

**Date:** 2026-06-22
**Scope:** 8 pheno-* core-substrate crates
**Mode:** read-only
**Source-of-truth:** each crate's `Cargo.toml` + `src/lib.rs` crate-level lint attrs
**Related ADRs:** ADR-040 (test coverage gates / substrate quality bar), ADR-078 (encryption-at-rest mandate, L52)
**Related v19 tracks:** T2 (L52, ADR-078 — `pheno-config/src/secrets.rs` work), T4 (L19 perf benchmarking)

---

## 1. TL;DR

- **0 of 8** pheno-* core crates have `[lints]` or `[workspace.lints]` declared in `Cargo.toml`.
- **0 of 8** apply workspace lints via `lints.workspace = true`.
- **5 of 8** declare an empty `[workspace]` table, opting out of the parent monorepo workspace
  (`repos/Cargo.toml`) — so even if the root gained `[workspace.lints]`, those crates would not
  pick it up.
- **The root monorepo `Cargo.toml` has no `[workspace.lints]` table.** It declares
  `[workspace.package]`, `[workspace.dependencies]`, but no lints surface — so lints enforcement
  is **structurally absent** from the fleet.
- Lint coverage today comes from **inline `#![deny(...)]` / `#![warn(...)]` attributes** in
  `src/lib.rs` — present on **3 of 8** crates (pheno-config, pheno-errors, pheno-port-adapter).

The fleet is relying on **ad-hoc, per-crate, hand-maintained inline attributes** for what should
be a **single, shared, version-controlled `[workspace.lints]` policy**. This is brittle
(2 waves of new substrate crates already shipped without the policy), duplicated (3 crates
re-state the same 3 attrs), and invisible to `cargo clippy --workspace` invocations from CI.

---

## 2. Per-crate lints coverage

| # | Crate               | `[lints]` table | `lints.workspace = true` | `[workspace]` opt-out | Crate-level lint attrs in `src/lib.rs`                                | Lint enforcement tier |
|---|---------------------|-----------------|--------------------------|------------------------|-----------------------------------------------------------------------|-----------------------|
| 1 | `pheno-cli-base`    | ❌              | ❌                       | ✅ (standalone)        | _(none)_                                                              | **NONE**              |
| 2 | `pheno-config`      | ❌              | ❌                       | ✅ (standalone)        | `#![forbid(unsafe_code)]`<br>`#![warn(missing_docs)]`                 | **WEAK** (warn-only docs) |
| 3 | `pheno-context`     | ❌              | ❌                       | _(implicit, no `[workspace]` table)_ | _(none)_                                                              | **NONE**              |
| 4 | `pheno-errors`      | ❌              | ❌                       | _(implicit)_           | `#![warn(missing_docs)]`<br>`#![deny(unsafe_code)]`<br>`#![deny(rust_2018_idioms)]` | **MEDIUM** (3 attrs, warn-only docs) |
| 5 | `pheno-events`      | ❌              | ❌                       | ✅ (standalone)        | _(none)_                                                              | **NONE**              |
| 6 | `pheno-flags`       | ❌              | ❌                       | ✅ (standalone)        | _(none)_                                                              | **NONE**              |
| 7 | `pheno-port-adapter`| ❌              | ❌                       | ✅ (standalone)        | `#![deny(missing_docs)]`<br>`#![deny(unsafe_code)]`<br>`#![deny(rust_2018_idioms)]` | **STRONG** (3 attrs, all deny) |
| 8 | `pheno-tracing`     | ❌              | ❌                       | ✅ (standalone)        | _(none)_                                                              | **NONE**              |

**Tier summary:**

- **STRONG (1/8):** pheno-port-adapter — only crate with `deny` for the full substrate trio
  (`missing_docs`, `unsafe_code`, `rust_2018_idioms`).
- **MEDIUM (1/8):** pheno-errors — `deny(unsafe_code)` + `deny(rust_2018_idioms)` + `warn(missing_docs)`.
- **WEAK (1/8):** pheno-config — `forbid(unsafe_code)` but `warn(missing_docs)` (downgrade from deny).
- **NONE (5/8):** pheno-cli-base, pheno-context, pheno-events, pheno-flags, pheno-tracing — zero
  crate-level lint enforcement.

### Why no `[workspace.lints]` can apply

Every pheno-* crate is shipped as a **standalone package** to crates.io or to consumers as a
path/git dep. The empty `[workspace]` table at the top of `Cargo.toml` (or, in pheno-context's
case, the absence of any workspace pointer at all) tells cargo: "this is its own workspace root,
don't look upward at the monorepo."

The rationale (documented inline in each `Cargo.toml`):

> *"The empty `[workspace]` table declares this crate as a standalone package. Without it, cargo
> looks upward and finds the surrounding monorepo workspace (which currently has unrelated tooling
> members)."*
> — `pheno-cli-base/Cargo.toml:13-16`

**Implication:** any fleet-wide lint policy must be **duplicated into each crate's `Cargo.toml`**
(unless the fleet decides to merge the 8 crates into a single workspace, which is a much bigger
architectural change — see §5).

### Why the root workspace can't carry the policy either

The root `repos/Cargo.toml` contains **70 members**, almost all `focus-*` / `connector-*` crates
inherited from the FocalPoint lineage. Even adding `[workspace.lints]` there would:

- Apply only to those 70 focus-* crates, not the pheno-* ones (because of the `[workspace]` opt-out).
- Risk lint breakages on the focus-* side that have nothing to do with the pheno-* substrate.

---

## 3. Top-3 missing lints (across the 8 crates)

Ranked by **(a) blast radius if missing** × **(b) substrate-quality-bar alignment per ADR-040**.

### 🥇 #1 — `missing_docs` (deny) — missing on 5 of 8

| Crate | Current state | Gap |
|-------|---------------|-----|
| pheno-cli-base | _(none)_ | deny missing |
| pheno-context | _(none)_ | deny missing |
| pheno-events | _(none)_ | deny missing |
| pheno-flags | _(none)_ | deny missing |
| pheno-tracing | _(none)_ | deny missing |
| pheno-config | `warn` | upgrade warn → deny |
| pheno-errors | `warn` | upgrade warn → deny |
| pheno-port-adapter | `deny` ✅ | — |

**Why it matters:** Per **ADR-040 substrate quality bar** (lib/SDK tier), every public item in a
substrate crate MUST have a doc comment. This is the difference between "a crate I can read" and
"a crate that reads itself." The substrate is consumed by other fleet crates that need IDE
hover-docs and `cargo doc --no-deps` to produce usable output. Without `deny(missing_docs)`,
new public items slip in undocumented and the bar erodes silently.

### 🥈 #2 — `unsafe_code` (forbid) — missing on 5 of 8

| Crate | Current state | Gap |
|-------|---------------|-----|
| pheno-cli-base | _(none)_ | forbid missing |
| pheno-context | _(none)_ | forbid missing |
| pheno-events | _(none)_ | forbid missing |
| pheno-flags | _(none)_ | forbid missing |
| pheno-tracing | _(none)_ | forbid missing |
| pheno-config | `forbid` ✅ | — |
| pheno-errors | `deny` (downgrade to `forbid`) | — |
| pheno-port-adapter | `deny` (downgrade to `forbid`) | — |

**Why it matters:** Per **ADR-078 encryption-at-rest mandate (L52)** — substrate crates that
may handle secret material must be `forbid(unsafe_code)` so a future contributor cannot
inadvertently introduce a use-after-free or unsound lifetime in the secret-handling code path.
`forbid` is strictly stronger than `deny` (cannot be overridden with `#[allow(unsafe_code)]`
inside the crate) and is the standard substrate floor. Two of the three crates that do enforce
it use the weaker `deny` and should be upgraded.

### 🥉 #3 — `rust_2018_idioms` (deny) — missing on 6 of 8

| Crate | Current state | Gap |
|-------|---------------|-----|
| pheno-cli-base | _(none)_ | deny missing |
| pheno-config | _(none)_ | deny missing |
| pheno-context | _(none)_ | deny missing |
| pheno-events | _(none)_ | deny missing |
| pheno-flags | _(none)_ | deny missing |
| pheno-tracing | _(none)_ | deny missing |
| pheno-errors | `deny` ✅ | — |
| pheno-port-adapter | `deny` ✅ | — |

**Why it matters:** The `rust_2018_idioms` group catches the most common deprecated patterns
(`#[macro_export]` with `pub` items, `extern crate`, anonymous trait parameters, elided
lifetimes in paths). Without it, a refactor can silently introduce code that doesn't compile on
MSRV 1.82 or that prints deprecation warnings during `cargo build`. The fact that only 2 of 8
crates enforce this is the biggest single indicator of lints-as-afterthought.

---

## 4. Sample fleet-wide `[workspace.lints]` block

This is the **target policy** the 8 crates should converge on. It cannot be applied as-is
today (because of the standalone-package opt-out — see §5) but it documents what the canonical
fleet lint surface SHOULD be.

```toml
# Recommended [workspace.lints] block — to be duplicated into each pheno-*
# crate's Cargo.toml once the standalone-package decision is resolved (see §5).
# Targets Rust 1.82 / edition 2021 (per [workspace.package] in the root).
#
# References:
#   - ADR-040 substrate quality bar (lib/SDK tier)
#   - ADR-078 encryption-at-rest mandate (L52)

[workspace.lints.rust]
# Substrate-floor: forbid unsafe, deny missing docs, deny deprecated idioms.
unsafe_code           = "forbid"   # ADR-078 substrate mandate
missing_docs          = "deny"     # ADR-040 lib/SDK quality bar
rust_2018_idioms      = "deny"     # catches MSRV-deprecated patterns
unused_must_use       = "deny"     # ignore no Result/Option silently
unreachable_pub       = "warn"     # no internal API leakage

[workspace.lints.clippy]
# Pedantic group: warn-by-default; allow the noisy ones via overrides below.
pedantic = { level = "warn", priority = -1 }

# Allow-list for pedantic lints that produce too much noise for substrate use:
module_name_repetitions = "allow"  # `Port::port()` style is intentional
must_use_candidate      = "allow"  # overlaps with rust::unused_must_use
missing_errors_doc      = "allow"  # we use thiserror everywhere
missing_panics_doc      = "allow"  # panics are deliberate pre-conditions
cast_possible_truncation = "allow" # pheno-config has intentional u32→u16
cast_precision_loss      = "allow"
cast_sign_loss           = "allow"
similar_names            = "allow" # trait-heavy crates hit this constantly

# Substrate-mandated denials (override the warn-pedantic default):
unwrap_used            = "deny"    # no panics in lib code; use expect with msg
expect_used            = "deny"    # same; forces proper error types
panic                  = "deny"    # same; forces proper error types
todo                   = "deny"    # no shipped TODOs in substrate
dbg_macro              = "deny"    # no debug! in lib code
print_stdout           = "deny"    # substrate crates use tracing, not println
print_stderr           = "deny"    # same
```

**Per-crate application** (after the §5 architectural decision):

```toml
# In each pheno-* crate's Cargo.toml [package] section:
[lints]
workspace = true
```

…and the crate's `src/lib.rs` drops the inline `#![deny(...)]` / `#![warn(...)]` attributes in
favor of the inherited workspace policy.

---

## 5. Recommended remediation path

The structural fix requires deciding what to do about the **standalone-package pattern**:

### Option A — Keep the opt-out, duplicate the lint policy (low risk, recommended for v23)

Keep each pheno-* crate as a standalone package (preserves the standalone-publish model). Add
the `[lints]` table to each `Cargo.toml` with the **same lints block** (pasted from §4). Drop
the inline `#![deny(...)]` attrs from `src/lib.rs`. CI runs `cargo clippy -- -D warnings` per
crate to enforce.

- **Pros:** zero architectural change, no `Cargo.lock` workspace shuffle, no MSRV drift,
  per-crate `cargo clippy` parity preserved.
- **Cons:** the lint policy is duplicated 8 times; future ADRs that change the policy (e.g.,
  ADR-090 adding a new lint) require 8-file sync. Drift risk over time.

### Option B — Unify into a `pheno-workspace` member crate (higher leverage, more risk)

Create a `pheno-workspace` meta-crate at the fleet root that holds a `[workspace.lints]` block
and the 8 pheno-* crates as `members`. Drop the standalone `[workspace]` opt-out from each
crate. Cargo will inherit the workspace lints.

- **Pros:** single source of truth for lint policy, matches Rust 2024 best practice, makes
  `cargo clippy --workspace` tractable, sets the stage for unified `Cargo.lock` once MSRV
  stabilises.
- **Cons:** requires merging 8 separate `Cargo.lock` files, slows down `cargo build` (workspace
  must build all 8 even when one crate is needed), changes the `crates.io` publish model (each
  crate is still published independently — workspace membership doesn't affect that, but the
  publish-from-workspace flow needs verifying). Breaks any consumer who today treats each
  pheno-* crate as a standalone git dep.

**Recommendation for v23 cycle-13 P2:** ship Option A in v23 (1 PR per crate, 8 PRs total,
~600 LOC), defer Option B to v24+ pending a separate ADR (`ADR-091-pheno-workspace-merge.md`).

---

## 6. Evidence

| What                                  | Where                                                                 |
|---------------------------------------|-----------------------------------------------------------------------|
| Root workspace manifest (no lints)    | `repos/Cargo.toml:1-183`                                              |
| 8 pheno-* `Cargo.toml` files audited  | `pheno-{cli-base,config,context,errors,events,flags,port-adapter,tracing}/Cargo.toml` |
| Crate-level inline lint attributes    | `src/lib.rs` of pheno-config, pheno-errors, pheno-port-adapter only   |
| cargo-deny config (related, not lints) | `repos/.cargo/audit-rules.toml` (managed by ADR-078)                  |
| Substrate quality bar (codifies lints)| ADR-040 (`docs/adr/2026-06-18/ADR-040-test-coverage-gates-per-tier.md`) |
| Encryption-at-rest mandate (unsafe)   | ADR-078 (`docs/adr/2026-06-21/ADR-078-encryption-at-rest-mandate.md`)  |

---

## 7. Status

**DONE — read-only audit.** No code changed, no commits made. Follow-up PRs are tracked
under the v23 cycle-13 P2 candidate track (recommendation §5 Option A: 8 PRs, ~600 LOC).
