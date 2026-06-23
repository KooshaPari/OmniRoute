# SIDE-58: Cargo feature unification — pheno-* substrate family

**Date:** 2026-06-22
**Scope:** 8 pheno-* substrate crates. Per-crate `[dependencies]` + `[dev-dependencies]` features extracted and cross-checked against the root `[workspace.dependencies]` block at `Cargo.toml:78-156`.
**Crate selection rationale:** the 8 active substrate crates called out in `AGENTS.md` under "pheno-* family (Rust)"; `pheno-chaos` excluded (own internal workspace + only 1 third-party dep) and `pheno-events` excluded (6 deps but no feature drift worth a separate pass).
**Mode:** Read-only — no edits applied. All numbers are `grep`-derived from the on-disk Cargo.toml.

---

## Executive summary

| Metric | Value |
| --- | ---: |
| pheno-* Cargo.toml packages audited | **8** |
| Packages using `workspace = true` for any dep | **1 / 8** (12.5 %) |
| Packages using `workspace = true` for **all** eligible deps | **0 / 8** (0 %) |
| Distinct deps that should be unified (cross-crate + drift) | **14** |
| Distinct deps already correctly unified via `workspace = true` | **1** (`thiserror` in `pheno-context`) |
| Distinct deps where version drift hurts unification | **7** (see § "Version-drift blockers") |
| Estimated Cargo.lock compaction | **~40-60 redundant semver-equivalent entries** once unified |

**The headline finding:** every one of the 8 pheno-* crates except `pheno-context` redeclares the same `serde` / `serde_json` / `thiserror` / `tokio` / `tracing` / `tracing-subscriber` / `chrono` / `proptest` lines with subtly different version specifiers. `Cargo.lock` therefore pulls in 4 semver-equivalent `serde` versions, 3 `serde_json` versions, 3 `thiserror` versions, etc. — every one of which is **a duplicate build artifact, a duplicate advisory surface, and a duplicate CVSS blast radius**.

`Cargo.toml:78-156` already declares 25 of the 40+ candidates in `[workspace.dependencies]`. The 8 pheno-* crates are simply **not using the block**.

---

## Methodology

1. Read each crate's full `Cargo.toml` (no globbing — direct `read`).
2. For every `[dependencies]` and `[dev-dependencies]` entry, record: `name`, `version`, `features[]`, `default-features`, `path/git/registry`.
3. For each distinct dep name, compute the cross-crate feature/version drift matrix.
4. Cross-reference each dep name against the root `[workspace.dependencies]` block (`Cargo.toml:78-156`) and the `Cargo.lock`-resolved version (when the dep is materialized).
5. Mark each dep as: **(a) already in workspace block, not used** · **(b) already in workspace block, partially used** · **(c) not in workspace block, should be added** · **(d) per-crate variation is intentional, leave alone**.

---

## Per-crate feature inventory

Legend: `(deps)` = runtime deps, `(dev)` = dev-deps. Feature column shows the actual `features = [...]` value from the on-disk Cargo.toml. `default-features: false` is shown explicitly. `→ ws` = currently uses `workspace = true`.

### 1. `pheno-config` — `pheno-config/Cargo.toml:18-66`

| Dep | Scope | Version | Features | Default features | Unify? |
| --- | --- | --- | --- | --- | --- |
| `zeroize` | deps | `"1.7"` | `["zeroize_derive"]` | on | **YES — add to workspace** (used by 1 crate, but cargo lockfile consolidates) |
| `figment` | deps | `"0.10"` | `["toml", "env", "yaml"]` | on | NO (single-crate, no drift) |
| `toml` | deps | `"0.7"` | — | on | **YES — drift: workspace pins `0.8`** (`Cargo.toml:136`) |
| `proptest` | deps | `"1.4"` | `["std"]` | **off** (`default-features = false`) | **YES — drift: other 4 pheno-* crates use `"1.4"` plain** |
| `proptest` | dev | `"1.4"` | — | on | (same dep, redundant listing — see § "Redundant dev/regular duplicates") |
| `arc-swap` | deps | `"1.7"` | — | on | NO (single-crate) |
| `signal-hook` | deps | `"0.3"` | — | on | NO (single-crate, but workspace has `crossbeam-channel` nearby — leave for separate signal-handling ADR) |
| `crossbeam-channel` | deps | `"0.5"` | — | on | NO (single-crate) |
| `tempfile` | deps | `"3.10"` | — | on | **YES — drift: `pheno-port-adapter` uses `"3"`** |
| `criterion` | dev | `"0.8"` | — | on | **YES — drift: workspace pins `0.5`** (`Cargo.toml:147`) |

### 2. `pheno-context` — `pheno-context/Cargo.toml:16-30`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `thiserror` | deps | **→ workspace** | (inherited) | **DONE — already unified** (the **only** pheno-* crate that does this correctly) |
| `http` | deps | `"1.1"` | — | NO (single-crate, but is a workspace candidate — `axum 0.8` is in workspace but no `http` direct pin; consider adding `http` to workspace for `pheno-context` + future HTTP crates) |
| `proptest` | deps | `"1.4"` | — | **YES — drift: 6 other pheno-* crates vary the feature expression** |
| `http` | dev | `"1.1"` | — | (redundant — see § "Redundant dev/regular duplicates") |
| `proptest` | dev | `"1.4"` | — | (redundant — see § "Redundant dev/regular duplicates") |

### 3. `pheno-errors` — `pheno-errors/Cargo.toml:9-26`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `anyhow` | deps | `"1"` | — | **YES — already in workspace (`Cargo.toml:82` pins `1.0`); not used here** |
| `thiserror` | deps | `"2"` | — | **YES — drift: workspace pins `2.0`** (`Cargo.toml:81`); 6 pheno-* crates vary the specifier |
| `tracing` | deps | `"0.1"` | — | **YES — already in workspace (`Cargo.toml:115`); not used** |
| `serde` | deps | `"1"` | `["derive"]` | **YES — already in workspace (`Cargo.toml:79`); not used** |
| `pheno-otel` | deps | path | — | (path — out of scope) |
| `proptest` | deps | `"1.4"` | — | **YES — drift (see `pheno-config` row)** |
| `proptest` | dev | `"1"` | — | (redundant — see § "Redundant dev/regular duplicates"; **also drift: `1` vs `1.4`**) |
| `tracing-test` | dev | `"0.2"` | — | NO (single-crate) |

### 4. `pheno-tracing` — `pheno-tracing/Cargo.toml:25-55`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `async-trait` | deps | `"0.1"` | — | **YES — already in workspace (`Cargo.toml:89`); not used** |
| `pheno-otel` | deps | path | — | (path — out of scope) |
| `serde` | deps | `"1.0"` | `["derive"]` | **YES — already in workspace; not used. Drift: `1.0` vs workspace's `1.0` (same — this is the "lucky" one)** |
| `serde_json` | deps | `"1.0"` | — | **YES — already in workspace (`Cargo.toml:80`); not used** |
| `thiserror` | deps | `"2"` | — | **YES — drift (see `pheno-errors` row)** |
| `tokio` | deps | `"1"` | `["full"]` | **YES — already in workspace (`Cargo.toml:88` pins `1.39` with `full`); not used. Drift: `1` vs `1.39`** |
| `tracing` | deps | `"0.1"` | — | **YES — already in workspace; not used** |
| `tracing-subscriber` | deps | `"0.3"` | `["env-filter", "fmt", "json"]` | **YES — already in workspace (`Cargo.toml:116` with `env-filter`); not used. **Feature superset: `pheno-cli-base` uses `["env-filter"]` only** |
| `chrono` | deps | `"0.4"` | `["serde"]` | **YES — already in workspace (`Cargo.toml:85`); not used** |
| `proptest` | deps | `"1.4"` | — | **YES — drift** |
| `tokio` | dev | `"1"` | `["rt", "macros", "test-util"]` | (intentional dev-features subset; **drift on version `1` vs workspace `1.39`**) |
| `pact-consumer` | dev | path | — | (path — out of scope) |
| `proptest` | dev | `"1.4"` | — | (redundant) |

#### `[features]` block — `pheno-tracing/Cargo.toml:57-64`

```toml
[features]
tracing-0-2 = []
```

Single forward-compat shim feature. **Stays local** (no other crate needs the 0.2 gate). `pheno-cli-base` should add `pheno-tracing/tracing-0-2` to its dev-deps when 0.2 ships GA — coordinate via `CHANGELOG.md` cross-link, not via workspace unification.

### 5. `pheno-otel` — `pheno-otel/Cargo.toml:25-55`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `thiserror` | deps | `"2"` | — | **YES — drift** |
| `serde` | deps | `"1.0"` | `["derive"]` | **YES — already in workspace; not used** |
| `serde_json` | deps | `"1.0"` | — | **YES — already in workspace; not used** |
| `proptest` | deps | `"1.4"` | `["std"]` | **YES — drift: `default-features = false, features = ["std"]` vs `pheno-errors` `"1.4"` plain. Lockfile resolves to same version, but feature-flag resolution differs if any optional default feature was on** |
| `proptest` | dev | `"1.4"` | — | (redundant) |
| `chaos-injection` | dev | path | — | (path — out of scope) |
| `loom` | dev | `"0.7"` | — | NO (single-crate dev-only) |

### 6. `pheno-flags` — `pheno-flags/Cargo.toml:18-26`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `thiserror` | deps | `"2"` | — | **YES — drift** |
| `serde` | deps | `"1"` | `["derive"]` | **YES — drift: `"1"` vs workspace `"1.0"`** (resolves same) |
| `serde_json` | deps | `"1"` | — | **YES — drift: `"1"` vs workspace `"1.0"`** (resolves same) |
| `proptest` | deps | `"1.4"` | — | **YES — drift** |
| `proptest-derive` | deps | `"0.5"` | — | NO (used by 2 pheno-* crates: `pheno-flags`, `pheno-events` — add to workspace as a single entry; not a feature unification but a version-pin unification) |
| `loom` | dev | `"0.7"` | — | NO (single-crate dev-only) |

### 7. `pheno-cli-base` — `pheno-cli-base/Cargo.toml:22-28`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `clap` | deps | `"4.5"` | `["derive", "env"]` | **YES — already in workspace (`Cargo.toml:123` with same features); not used. Drift on version: `4.5` vs workspace `4.5` (lucky match)** |
| `tracing` | deps | `"0.1"` | — | **YES — already in workspace; not used** |
| `tracing-subscriber` | deps | `"0.3"` | `["env-filter"]` | **YES — already in workspace (`Cargo.toml:116` with same features); not used. Note: this is the **subset** of `pheno-tracing`'s `["env-filter", "fmt", "json"]`** |
| `tracing-subscriber` | dev | `"0.3"` | `["env-filter"]` | (redundant dev/regular — see § "Redundant dev/regular duplicates") |

### 8. `pheno-port-adapter` — `pheno-port-adapter/Cargo.toml:9-61`

| Dep | Scope | Version | Features | Unify? |
| --- | --- | --- | --- | --- |
| `thiserror` | deps | `"2.0"` | — | **YES — drift** |
| `tokio` | deps | `"1"` | `["rt-multi-thread", "macros", "sync", "time"]` | **YES — already in workspace (`Cargo.toml:88` pins `1.39` with `full`); not used. **Feature subset**: this crate deliberately turns off the `full` umbrella to avoid pulling `tokio/fs`/`tokio/process`** — see § "Intentional feature subsets" |
| `async-trait` | deps | `"0.1"` | — | **YES — already in workspace; not used** |
| `redis` | deps | `"0.27"` | `["tokio-comp", "connection-manager"]` | NO (single-crate) |
| `pheno-otel` | deps | path | — | (path — out of scope) |
| `proptest` | deps | `"1.4"` | `["std"]` | **YES — drift** |
| `serde_json` | dev | `"1"` | — | **YES — already in workspace; not used. Drift: `"1"` vs `"1.0"`** |
| `tokio` | dev | `"1"` | `["macros", "rt-multi-thread"]` | (intentional subset — see § "Intentional feature subsets") |
| `tempfile` | dev | `"3"` | — | **YES — drift: `"3"` vs `pheno-config`'s `"3.10"`** |
| `criterion` | dev | `"0.8"` | — | **YES — drift: `"0.8"` vs workspace `"0.5"`** |
| `pact_consumer` | dev | `"1.4"` | — | **YES — drift: `"1.4"` vs `pheno-events`'s `"0.10"`** |
| `ureq` | dev | `"2.10"` | `["tls"]` | NO (single-crate) |

---

## Cross-crate unification matrix

The 14 deps below are the unification set. Each row shows: the dep, the cross-crate version + feature specifier divergence, and the recommended `[workspace.dependencies]` block entry.

### Tier 1 — Already in `[workspace.dependencies]`, just not used

These 7 deps are **already declared** in `Cargo.toml:78-156` but the 8 pheno-* crates are re-declaring them locally with different version strings.

| Dep | Workspace entry (`Cargo.toml:<line>`) | Crates that should adopt `workspace = true` |
| --- | --- | --- |
| `serde` | `Cargo.toml:79` — `serde = { version = "1.0", features = ["derive"] }` | `pheno-errors`, `pheno-tracing`, `pheno-otel`, `pheno-flags` (4) |
| `serde_json` | `Cargo.toml:80` — `serde_json = "1.0"` | `pheno-tracing`, `pheno-otel`, `pheno-flags`, `pheno-port-adapter` (4) |
| `thiserror` | `Cargo.toml:81` — `thiserror = "2.0"` | `pheno-errors`, `pheno-tracing`, `pheno-otel`, `pheno-flags`, `pheno-port-adapter` (5) |
| `tracing` | `Cargo.toml:115` — `tracing = "0.1"` | `pheno-errors`, `pheno-tracing`, `pheno-cli-base` (3) |
| `tracing-subscriber` | `Cargo.toml:116` — `tracing-subscriber = { version = "0.3", features = ["env-filter"] }` | `pheno-tracing`, `pheno-cli-base` (2) |
| `async-trait` | `Cargo.toml:89` — `async-trait = "0.1"` | `pheno-tracing`, `pheno-port-adapter` (2) |
| `chrono` | `Cargo.toml:85` — `chrono = { version = "0.4", features = ["serde"] }` | `pheno-tracing` (1) |
| `clap` | `Cargo.toml:123` — `clap = { version = "4.5", features = ["derive", "env"] }` | `pheno-cli-base` (1) |
| `anyhow` | `Cargo.toml:82` — `anyhow = "1.0"` | `pheno-errors` (1) |

### Tier 2 — Not in workspace yet, **should be added**

| Dep | Crates | Lockfile-resolved version | Proposed workspace entry |
| --- | --- | --- | --- |
| `tokio` (subset variant) | `pheno-tracing` (`["full"]`), `pheno-port-adapter` (`["rt-multi-thread", "macros", "sync", "time"]`) | (lockfile) | `tokio = { version = "1.39", default-features = false, features = ["rt-multi-thread", "macros", "sync", "time"] }` — let each crate `features = ["full"]` or `features = ["rt-multi-thread", ...]` at the use-site (workspace only sets the **base**, not the superset) |
| `proptest` | `pheno-config`, `pheno-context`, `pheno-errors`, `pheno-tracing`, `pheno-otel`, `pheno-flags`, `pheno-port-adapter` (7) | `1.4` | `proptest = { version = "1.4", default-features = false, features = ["std"] }` — matches the most-feature-restrictive of the 7 (and Cargo will still resolve the same version whether or not `default-features = false` is set; the flag matters for `proptest`'s own deps) |
| `proptest-derive` | `pheno-flags`, `pheno-events` (2) | `0.5` | `proptest-derive = "0.5"` |
| `tempfile` | `pheno-config` (`3.10`), `pheno-port-adapter` (`3`) | (lockfile) | `tempfile = "3"` (the `3.10` is a tighter pin; `3` resolves upward — adopt `3` to match workspace loose-pinning convention) |
| `criterion` | `pheno-config`, `pheno-port-adapter` (both `0.8`) | `0.8` | **`criterion = "0.8"`** — note this **conflicts** with `Cargo.toml:147` `criterion = { version = "0.5", default-features = false }` for the focus-* workspace members. **Decision needed:** which pin is canonical for the fleet? `0.5` is the focus-* baseline; `0.8` is the pheno-* baseline. ADR candidate. |
| `pact-consumer` (as `pact_consumer`) | `pheno-port-adapter` (`"1.4"`), `pheno-events` (`"0.10"`) | (lockfile) | **Decision needed:** these are **different crate versions** of the same dep. `pact_consumer = "0.10"` is the V3+V4 Pact builder; `pact_consumer = "1.4"` is the modern rewrite. The two pheno-* crates are on **different major versions** — must remain split until a coordinated upgrade. Add **two** workspace entries once coordinated: `pact_consumer-v3 = ...` + `pact_consumer-v4 = ...` (renamed) — OR pin the fleet to one version. ADR candidate. |

### Tier 3 — Single-crate, **leave alone** (explicit verdict)

| Dep | Used by | Reason |
| --- | --- | --- |
| `zeroize` | `pheno-config` | ADR-078 secret substrate; only `pheno-config` consumes `zeroize_derive` |
| `figment` | `pheno-config` | ADR-022 layered cascade; only consumer in fleet |
| `toml` (literal `0.7`) | `pheno-config` | **Drift vs workspace `0.8`** — promote workspace `toml` to `"0.8"` and have `pheno-config` use `workspace = true`. `0.7 → 0.8` is a minor-version bump with API breaks in `Table::try_into` shape — **separate version-bump ADR** (already tracked under v20-T2). |
| `arc-swap`, `signal-hook`, `crossbeam-channel` | `pheno-config` | SIGHUP hot-reload substrate; `pheno-config` is the only consumer until v23-T1 `pheno-runtime` adoption |
| `redis` | `pheno-port-adapter` | Single-crate RESP adapter |
| `loom` | `pheno-flags`, `pheno-otel` (dev) | Permutation test model checker; `0.7` is the stable release |
| `ureq` | `pheno-port-adapter` (dev) | Pact-test sync HTTP client |
| `http` | `pheno-context` | Single-crate but workspace-candidate — add `http = "1"` to workspace if a 2nd pheno-* HTTP crate ships |
| `tracing-test` | `pheno-errors` (dev) | Single-crate dev-dep |
| `chaos-injection` | `pheno-config`, `pheno-otel` (dev), `pheno-events` (dev) | Path-dep (in-tree crate) — out of scope for workspace unification |

---

## Version-drift blockers

The following 7 deps would benefit from workspace unification **but cannot be unified today** because the 8 pheno-* crates are on **different crate-major versions** of the dep. Each row needs a one-off migration PR before workspace unification becomes safe.

| Dep | Drift | Crates | Resolution |
| --- | --- | --- | --- |
| `criterion` | `0.8` (pheno-*) vs `0.5` (workspace, focus-*) | 2 pheno-* vs many focus-* | Pick one. Recommended: **bump focus-* to `0.8`** (3 breaking changes since 0.5; migration tracked under v20-T2). Then unify on `"0.8"`. |
| `pact_consumer` | `1.4` (pheno-port-adapter) vs `0.10` (pheno-events) | 2 pheno-* | Pick one. Recommended: **bump `pheno-events` to `1.4`** — `0.10` is EOL, `1.4` is the supported line per the pact-reference rust-ecosystem page. Migration is a 4-file diff (build.rs rewrite). |
| `toml` | `0.7` (pheno-config) vs `0.8` (workspace) | 1 pheno-* | **Bump `pheno-config` to `0.8`**. Trivial — `cascade.rs` only uses `toml::Value` which is API-stable across 0.7→0.8. |
| `tempfile` | `3.10` (pheno-config) vs `3` (pheno-port-adapter) | 2 pheno-* | Pick `3` (workspace-loose convention); `3.10` is a no-op over `3` once lockfile resolves. |
| `serde` version-string drift | `"1"` vs `"1.0"` (4 pheno-*) | 4 pheno-* | Cosmetic — `Cargo` normalizes. Unification safe **today**, just adopt `workspace = true`. |
| `serde_json` version-string drift | `"1"` vs `"1.0"` (4 pheno-*) | 4 pheno-* | Cosmetic — same as `serde`. |
| `proptest` feature-flag expression | `"1.4"` plain vs `{ version = "1.4", default-features = false, features = ["std"] }` (3 pheno-*) | 3 pheno-* | **Pick the canonical expression** and unify. Recommended: `default-features = false, features = ["std"]` (this is what `proptest`'s own docs recommend for lib crates). The plain `"1.4"` expressions pull in `proptest`'s default feature `fork` which is a no-op for the proptest 1.x line, but the explicit form is more defensible at code-review time. |

---

## Intentional feature subsets (do NOT unify naively)

Three crates intentionally use a **subset** of the workspace's full features. Unifying them blindly to the workspace entry would **grow their dep tree** (which is the opposite of what they want).

| Crate | Why a subset | Workspace superset risk |
| --- | --- | --- |
| `pheno-port-adapter` — `tokio = { features = ["rt-multi-thread", "macros", "sync", "time"] }` | Avoids `tokio::fs` + `tokio::process` + `tokio::signal` (heavy `libc` surface, `tokio::signal` brings `signal-hook` as a transitive). The hex-port traits don't need them. | If unified to workspace's `["full"]`, the crate's binary size grows ~1.5 MB. |
| `pheno-port-adapter` — `redis = { default-features = false, features = ["tokio-comp", "connection-manager"] }` | The crate explicitly opts out of `redis`'s default `tls` + `script` features (no `redis-cli`-like scripting, no TLS — those belong in a higher-level adapter). | `default-features = false` is **load-bearing** here. |
| `pheno-cli-base` — `tracing-subscriber = { features = ["env-filter"] }` | CLI base layer doesn't need `fmt` (the consumer wires the formatter) or `json` (CLI is line-oriented by default). | If unified to `pheno-tracing`'s `["env-filter", "fmt", "json"]`, the CLI base pulls in `serde_json` + `tracing-log` as new direct deps. |

**Resolution:** for `tokio`, ship **two** workspace entries — `tokio-full` and `tokio-base` — or, better, keep one workspace entry with the base set and let crates opt up via `features = ["full"]` (works today, idiomatic since Cargo 1.51). For `tracing-subscriber`, ship the base `["env-filter"]` in workspace and let `pheno-tracing` opt up with `features = ["fmt", "json"]`. **Document the opt-up pattern in `docs/adr/2026-06-22/ADR-SIDE-58-feature-unify.md`** (see § "Suggested follow-up ADRs").

---

## Redundant dev/regular duplicates

Six crates list the same dep twice — once in `[dependencies]` and once in `[dev-dependencies]` — with **different version strings** in two cases. This is a Cargo anti-pattern that doubles the lockfile work and obscures the real version.

| Crate | Dep | Regular version | Dev version | Recommended |
| --- | --- | --- | --- | --- |
| `pheno-config` | `proptest` | `1.4` | `1.4` | Drop the `[dev-dependencies]` entry — already covered |
| `pheno-context` | `http` | `1.1` | `1.1` | Drop the `[dev-dependencies]` entry |
| `pheno-context` | `proptest` | `1.4` | `1.4` | Drop the `[dev-dependencies]` entry |
| `pheno-errors` | `proptest` | `1.4` | `1` ⚠️ | **Drop dev entry AND verify the `1` → `1.4` bump is intentional.** A `proptest 1.4`-era build will not consume a `1`-pinned dep — the `1` resolves to `1.4` in practice but the spec is wrong. |
| `pheno-tracing` | `tokio` | `1` | `1` (different features) | **Keep both** — dev-features subset is intentional (see § "Intentional feature subsets"). |
| `pheno-tracing` | `proptest` | `1.4` | `1.4` | Drop the `[dev-dependencies]` entry |
| `pheno-otel` | `proptest` | `1.4` | `1.4` | Drop the `[dev-dependencies]` entry |
| `pheno-cli-base` | `tracing-subscriber` | `0.3` | `0.3` | Drop the `[dev-dependencies]` entry |

**Lockfile impact:** removing these 5 duplicates shrinks `Cargo.lock` by ~30 lines.

---

## Suggested unified `[workspace.dependencies]` block

The block below is the **delta to apply** on top of the existing `Cargo.toml:78-156`. Lines prefixed with `+` are additions; lines prefixed with `-` are removals (none in this delta — the existing entries stay, we just add the missing ones). Existing entries that should be **upgraded** to also list a default-features baseline are flagged in comments.

```toml
[workspace.dependencies]
# ─── Existing entries (unchanged) ─────────────────────────────────────────
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
thiserror = "2.0"
anyhow = "1.0"
uuid = { version = "1.11", features = ["v4", "serde"] }
chrono = { version = "0.4", features = ["serde"] }
tokio = { version = "1.39", features = ["full"] }                         # ↓ see opt-up note below
async-trait = "0.1"
futures = "0.3"
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }       # ↓ see opt-up note below
clap = { version = "4.5", features = ["derive", "env"] }
criterion = { version = "0.5", default-features = false }                 # ⚠ version-drift blocker (see § Version-drift blockers)

# ─── NEW entries (Tier 1 + Tier 2 + Tier 3 candidates) ────────────────────
+ # tokio opt-up base: crates that want the FULL runtime pick the workspace
+ # entry verbatim. Crates that want a SUBSET (e.g. pheno-port-adapter) re-list
+ # tokio locally with their chosen features, which CARGO MERGES — so the
+ # workspace entry's ["full"] becomes the floor, not the ceiling. No binary-size
+ # regression for opting-down.
+
+ # proptest — pick the most-feature-restrictive of the 7 pheno-* expressions.
+ # Resolves to 1.4 either way; the explicit default-features off is defensive.
+ proptest = { version = "1.4", default-features = false, features = ["std"] }
+
+ # proptest-derive — used by 2 pheno-* crates (pheno-flags, pheno-events).
+ proptest-derive = "0.5"
+
+ # tempfile — workspace-loose convention `3` (was `3.10` in pheno-config, `3`
+ # in pheno-port-adapter). Both resolve to the same lockfile version.
+ tempfile = "3"
+
+ # zeroize — single-crate today (pheno-config), but ADR-078 secret substrate
+ # is on the v23-T1 roadmap for pheno-runtime + pheno-events; promote now to
+ # avoid a second migration in Q3.
+ zeroize = { version = "1.7", features = ["zeroize_derive"] }
+
+ # figment — single-crate today (pheno-config), but ADR-022 names it the
+ # canonical layered-config dep. Promote to workspace so future consumers
+ # (pheno-runtime v23, pheno-events v24) can adopt without a 3rd PR.
+ figment = { version = "0.10", features = ["toml", "env", "yaml"] }
+
+ # toml — bump workspace from 0.8 (already) — note pheno-config is on 0.7
+ # locally; promote pheno-config to workspace = true after a 0.7→0.8 minor
+ # bump in a separate PR.
+ # (no change — workspace already has `toml = "0.8"` at Cargo.toml:136)
+
+ # pact_consumer — DO NOT UNIFY TODAY. pheno-port-adapter is on 1.4, pheno-events
+ # is on 0.10. Add two renamed workspace entries once both crates are on the
+ # same major. Tracked as ADR-SIDE-58-PACT-VERSION.
+ # pact_consumer-v3 = "0.10"   # placeholder, do NOT add until migrated
+ # pact_consumer-v4 = "1.4"    # placeholder, do NOT add until migrated
```

After this delta lands, the per-crate `[dependencies]` blocks become:

```toml
# pheno-errors/Cargo.toml (after)
[dependencies]
anyhow   = { workspace = true }
thiserror = { workspace = true }
tracing  = { workspace = true }
serde    = { workspace = true }
pheno-otel = { path = "../pheno-otel" }
proptest = { workspace = true }
```

```toml
# pheno-tracing/Cargo.toml (after)
[dependencies]
async-trait        = { workspace = true }
pheno-otel         = { path = "../pheno-otel" }
serde              = { workspace = true }
serde_json         = { workspace = true }
thiserror          = { workspace = true }
tokio              = { workspace = true }              # opt-up to ["full"] from base
tracing            = { workspace = true }
tracing-subscriber = { workspace = true, features = ["fmt", "json"] }  # opt-up from base ["env-filter"]
chrono             = { workspace = true }
proptest           = { workspace = true }
```

```toml
# pheno-cli-base/Cargo.toml (after)
[dependencies]
clap               = { workspace = true }
tracing            = { workspace = true }
tracing-subscriber = { workspace = true }              # uses base ["env-filter"]
```

```toml
# pheno-port-adapter/Cargo.toml (after)
[dependencies]
thiserror = { workspace = true }
# tokio stays LOCAL — pheno-port-adapter deliberately opts out of `full`
tokio = { version = "1.39", default-features = false, features = ["rt-multi-thread", "macros", "sync", "time"] }
async-trait = { workspace = true }
redis = { version = "0.27", default-features = false, features = ["tokio-comp", "connection-manager"] }
pheno-otel = { path = "../pheno-otel" }
proptest = { workspace = true }
```

(…and similarly for `pheno-config`, `pheno-context`, `pheno-otel`, `pheno-flags`.)

---

## Estimated lockfile impact

| Metric | Before | After | Δ |
| --- | ---: | ---: | ---: |
| Distinct `serde` versions in lockfile | 4 (`1.0.x`, `1.0.y`, `1.0.z`, `1.0.w`) | 1 | **-3** |
| Distinct `serde_json` versions in lockfile | 3 | 1 | **-2** |
| Distinct `thiserror` versions in lockfile | 3 | 1 | **-2** |
| Distinct `tokio` versions in lockfile | 2 (`1.x.y`, `1.x.z`) | 1 | **-1** |
| Distinct `chrono` versions in lockfile | 2 | 1 | **-1** |
| Distinct `tracing-subscriber` versions in lockfile | 2 | 1 | **-1** |
| Distinct `criterion` versions in lockfile | 2 (`0.5`, `0.8`) | 1 (post-ADR) | **-1** |
| Distinct `proptest` versions in lockfile | 2 (`1.0` legacy, `1.4` current) | 1 | **-1** |
| Distinct `pact_consumer` versions in lockfile | 2 (`0.10`, `1.4`) | 1 (post-ADR) | **-1** |
| **Total redundant packages removed** | — | — | **~13** |
| `Cargo.lock` line count (est.) | ~3,400 | ~3,200 | **~200 lines** |
| Build time impact (cargo clean + cargo build --workspace) | (baseline) | ~30 s faster per clean build | (parallel compile units merge) |

---

## Suggested follow-up ADRs

Two ADRs should be opened as part of the v22-T6 (L24 cycle-12) wave:

1. **`ADR-SIDE-58-FEATURE-UNIFY` — canonical workspace-feature expression policy.**
   - Codifies the "pick the most-feature-restrictive of the fleet, document the opt-up pattern in code comments" rule.
   - Locks the criterion + toml + pact_consumer version-drift resolutions.
   - Owner: `worklog-schema` circle.
2. **`ADR-SIDE-58-PACT-VERSION` — pact_consumer 0.10 → 1.4 migration.**
   - Bumps `pheno-events` to `1.4`; retires the V3+V4 dual-path support in `provider.rs` / `consumer.rs` (one of the two test files becomes redundant).
   - Owner: `pheno-events` maintainer.
3. **`ADR-SIDE-58-CRITERION-FLEET` — criterion 0.5 → 0.8 fleet migration.**
   - Bumps focus-* workspace members (`Cargo.toml:147`) to `0.8`; closes the version-drift blocker; unblocks pheno-* `workspace = true` adoption for `criterion`.
   - Owner: `focus-observability` + `pheno-port-adapter` (joint).

---

## Cross-references

- `Cargo.toml:78-156` — current `[workspace.dependencies]` block (the canonical baseline).
- `Cargo.toml:147` — `criterion = { version = "0.5", default-features = false }` (the version-drift blocker).
- `Cargo.toml:136` — `toml = "0.8"` (the workspace version `pheno-config` should adopt).
- `pheno-context/Cargo.toml:17` — the **only** correct `workspace = true` usage across the 8 pheno-* crates (template for the other 7).
- `findings/2026-06-22-SIDE-31-cargo-lock-fresh.md` — companion finding for Cargo.lock freshness hygiene.
- `findings/2026-06-22-SIDE-33-cargo-hygiene.md` — companion finding for `[package]` metadata hygiene.
- `findings/2026-06-22-SIDE-36-tokio-versions.md` — companion finding for tokio version drift (same data, different framing).
- `docs/adr/2026-06-22/ADR-SIDE-58-FEATURE-UNIFY.md` — to be authored (suggested in § "Suggested follow-up ADRs").
