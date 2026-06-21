# SIDE-17: Cargo Profile Analysis — pheno-* Fleet

**Date:** 2026-06-22
**Task ID:** side-17
**Scope:** `[profile.*]` settings audit across 8 pheno-* crates + root workspace
**Author:** Orchestrator (auto-generated)
**Verdict:** **Zero profile customization across the fleet.** All 6 crates with a `Cargo.toml` rely on Cargo defaults. The remaining 2 crates (`pheno-agents-md`, `pheno-cargo-template`) are **empty stub directories** with no `Cargo.toml` at all. **No root `Cargo.toml` exists**, so there is no monorepo-wide profile to inherit. **Recommendation: adopt a fleet-canonical `[profile.*]` block** (proposed below) and either restore or formally archive the two empty stubs.

---

## 1. Scope & method

8 pheno-* crates requested for audit:

| # | Crate | Status |
|---|---|---|
| 1 | `pheno-otel` | Top-level standalone, Cargo.toml present (37 lines) |
| 2 | `pheno-port-adapter` | Top-level standalone, Cargo.toml present (34 lines) |
| 3 | `pheno-errors` | Top-level standalone, Cargo.toml present (21 lines) |
| 4 | `pheno-context` | Top-level standalone, Cargo.toml present (25 lines) |
| 5 | `pheno-config` | Top-level standalone, Cargo.toml present (33 lines) |
| 6 | `pheno-cli-base` | Only inside `focalpoint-wt-v12-16-17/`, Cargo.toml present (28 lines) |
| 7 | `pheno-agents-md` | **Empty stub directory** — no Cargo.toml anywhere on disk |
| 8 | `pheno-cargo-template` | **Empty stub directory** — no Cargo.toml anywhere on disk |

**Method:** For each manifest, full read + `grep -c '^\[profile\.'` + `grep -E '^(lto|codegen-units|opt-level|debug)\s*='`. Also verified no `Cargo.toml` at the monorepo root, no `.cargo/config.toml` (only `.cargo/audit-rules.toml` for `cargo-deny`), and no `[profile.*]` sections anywhere in `.cargo/`.

```bash
grep -c '^\[profile\.' <each manifest>     # → 0 for all 6 readable crates
grep -E '^(lto|codegen-units|opt-level|debug)\s*=' <each manifest>   # → 0 matches
find . -maxdepth 1 -name 'Cargo.toml'       # → absent
ls .cargo/                                  # → audit-rules.toml only
```

---

## 2. Per-crate findings

All 6 readable crates have **zero profile customization**. Every crate inherits Cargo's default profile values for every profile (`dev`, `release`, `test`, `bench`).

| Crate | Manifest | Lines | `[profile.*]` | `lto` | `codegen-units` | `opt-level` | `debug` | Result |
|---|---|---:|---:|---|---|---|---|---|
| `pheno-otel` | `pheno-otel/Cargo.toml` | 37 | **0** | (Cargo default) | (Cargo default) | (Cargo default) | (Cargo default) | All defaults |
| `pheno-port-adapter` | `pheno-port-adapter/Cargo.toml` | 34 | **0** | (Cargo default) | (Cargo default) | (Cargo default) | (Cargo default) | All defaults |
| `pheno-errors` | `pheno-errors/Cargo.toml` | 21 | **0** | (Cargo default) | (Cargo default) | (Cargo default) | (Cargo default) | All defaults |
| `pheno-context` | `pheno-context/Cargo.toml` | 25 | **0** | (Cargo default) | (Cargo default) | (Cargo default) | (Cargo default) | All defaults |
| `pheno-config` | `pheno-config/Cargo.toml` | 33 | **0** | (Cargo default) | (Cargo default) | (Cargo default) | (Cargo default) | All defaults |
| `pheno-cli-base` | `focalpoint-wt-v12-16-17/pheno-cli-base/Cargo.toml` | 28 | **0** | (Cargo default) | (Cargo default) | (Cargo default) | (Cargo default) | All defaults |
| `pheno-agents-md` | (no manifest) | — | **n/a** | n/a | n/a | n/a | n/a | Empty stub |
| `pheno-cargo-template` | (no manifest) | — | **n/a** | n/a | n/a | n/a | n/a | Empty stub |

**Concrete defaults Cargo applies** (Rust 1.75+ toolchain, used by all crates here):

| Profile | `opt-level` | `debug` | `lto` | `codegen-units` | `incremental` |
|---|---|---|---|---|---|
| `dev` | 0 | `true` | `false` | 16 | `true` |
| `release` | 3 | `false` | `false` | 16 | `false` |
| `test` | 0 | `true` | `false` | 16 | `true` |
| `bench` | 3 | `false` | `false` | 16 | `false` |

---

## 3. Crate-level evidence (excerpts)

All 6 crates share the same structural shape: `[package]` + (sometimes `[lib]`) + `[dependencies]` + `[dev-dependencies]`. None declare a `[profile.*]` block.

### 3.1 `pheno-otel` (`pheno-otel/Cargo.toml:1-37`)

```toml
[package]
name = "pheno-otel"
version = "0.1.0"
edition = "2021"
rust-version = "1.75"
…

[workspace]                       # empty — declares standalone package

[lib]
name = "pheno_otel"
path = "src/lib.rs"

[dependencies]
thiserror = "2"
…

[dev-dependencies]
loom = "0.7"
pact_consumer = "1.4"
```

No `[profile.dev]`, `[profile.release]`, `[profile.test]`, or `[profile.bench]`. Uses cargo defaults (opt-level 0/3, debug true/false, lto false, codegen-units 16).

### 3.2 `pheno-port-adapter` (`pheno-port-adapter/Cargo.toml:1-34`)

```toml
[package]
name = "pheno-port-adapter"
version = "0.1.0"
edition = "2021"
rust-version = "1.82"

[workspace]

[dependencies]
thiserror = "2.0"
tokio = { version = "1", features = ["rt-multi-thread", "macros", "sync", "time"] }
…

[dev-dependencies]
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
criterion = "0.8"
```

No `[profile.*]` section. Notably, no `release` profile override — `criterion` benchmarks ship with the default `release` (`opt-level = 3`, `lto = false`, `codegen-units = 16`).

### 3.3 `pheno-errors` (`pheno-errors/Cargo.toml:1-21`)

```toml
[package]
name = "pheno-errors"
version = "0.1.0"
edition = "2021"
license = "MIT"
…

[dependencies]
anyhow = "1"
thiserror = "2"
tracing = "0.1"
serde = { version = "1", features = ["derive"] }
pheno-otel = { path = "../pheno-otel" }

[dev-dependencies]
proptest = "1"
tracing-test = "0.2"
criterion = "0.8"
```

No `[profile.*]`. No `release` LTO for the criterion `create_display` bench.

### 3.4 `pheno-context` (`pheno-context/Cargo.toml:1-25`)

```toml
[package]
name = "pheno-context"
version = "0.1.0"
edition = "2021"
license = "MIT OR Apache-2.0"
rust-version = "1.82"
…
publish = false

[lib]
name = "pheno_context"
path = "src/lib.rs"

[dependencies]
thiserror = { workspace = true }
http = "1.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"

[dev-dependencies]
http = "1.1"
proptest = "1.4"
serde_json = "1"
```

Note line 17: `thiserror = { workspace = true }` — references a workspace dependency. This requires a root `Cargo.toml` `[workspace.dependencies]` table, but **no root `Cargo.toml` exists**. This is an **inconsistency / latent breakage**: `cargo build` from this crate root would fail to resolve `workspace = true` until a `[workspace]` block with a `[workspace.dependencies]` table is reintroduced at the monorepo root.

### 3.5 `pheno-config` (`pheno-config/Cargo.toml:1-33`)

```toml
[package]
name = "pheno-config"
version = "0.1.0"
edition = "2021"
description = "Canonical typed-config loader for the pheno-* fleet. …"
license = "MIT OR Apache-2.0"
publish = false

[lib]
name = "pheno_config"
path = "src/lib.rs"

[dependencies]
zeroize = { version = "1.7", features = ["zeroize_derive"] }
figment = { version = "0.10", features = ["toml", "env", "yaml"] }
toml = "0.7"
criterion = "0.8"
figment = { version = "0.10", features = ["toml", "env", "yaml"] }   # duplicate dep entry

[dev-dependencies]
```

Two anomalies worth surfacing (out of scope of SIDE-17 but noted for follow-up):
1. `figment = "0.10"` is **declared twice** in `[dependencies]` (lines 26 and 39). Cargo silently merges these but it's a copy-paste residue.
2. `[dev-dependencies]` is **empty** despite the criterion benchmark in `benches/cascade_load.rs` referenced from the comment.

No `[profile.*]` section.

### 3.6 `pheno-cli-base` (`focalpoint-wt-v12-16-17/pheno-cli-base/Cargo.toml:1-28`)

```toml
[package]
name = "pheno-cli-base"
version = "0.1.0"
edition = "2021"
rust-version = "1.82"
license = "MIT OR Apache-2.0"
…
publish = false

[workspace]                       # empty — declares standalone package

[lib]
name = "pheno_cli_base"
path = "src/lib.rs"

[dependencies]
clap = { version = "4.5", features = ["derive", "env"] }
tracing = "0.1"
tracing-subscriber = { version = "0.3", features = ["env-filter"] }

[dev-dependencies]
tracing-subscriber = { version = "0.3", features = ["env-filter"] }
```

No `[profile.*]`. Note this crate is inside the **`focalpoint-wt-v12-16-17`** worktree (FocalPoint repo bucket is `PAUSED` per ADR-023), so any profile recommendation must be replicated to that location if adopted.

### 3.7 `pheno-agents-md` — empty stub

```
./FocalPoint/pheno-agents-md/                total 0   (created 2026-06-18)
./focalpoint-wt-v12-16-17/pheno-agents-md/   total 0   (created 2026-06-21)
```

Both directories contain only `.` and `..`. **No `Cargo.toml`, no `src/`, no anything.** This crate is referenced in `AGENTS.md` §"pheno-* family" (Rust: 11 crates) but does not yet exist on disk. It is also listed in `WORKLOG.md` / AGENTS.md as `L6_PHENO_REPOS_HEALTH_2026_06_14.md` mentions "4 fail in pheno-agents-md" — that history predates the directory being emptied.

### 3.8 `pheno-cargo-template` — empty stub

```
./focalpoint-wt-v12-16-17/pheno-cargo-template/   total 0   (created 2026-06-21)
```

The empty stub exists in only one location (`focalpoint-wt-v12-16-17/`, not in `FocalPoint/`). No `Cargo.toml`, no `src/`, no template files. This is the **cargo-template** the AGENTS.md references for "pheno-cargo-template" — currently a placeholder.

---

## 4. Workspace-level evidence

### 4.1 No root `Cargo.toml`

```bash
$ find . -maxdepth 1 -name 'Cargo.toml'
$ ls Cargo.toml
ls: Cargo.toml: No such file or directory
```

A `Cargo.lock` exists at the root (`/Users/kooshapari/CodeProjects/Phenotype/repos/Cargo.lock`, 203,814 bytes, dated 2026-06-19) but **without a root `Cargo.toml`, this lockfile is orphaned / stale** — it is not actively maintained by any workspace `cargo` invocation. Per AGENTS.md, the monorepo root is **not** a single workspace; sub-crates are standalone (each declaring `[workspace]` to opt out of any surrounding workspace lookup). The lockfile is a fossil.

### 4.2 No `.cargo/config.toml`

`.cargo/` contains only `audit-rules.toml` (76 lines, `cargo-deny` configuration per ADR-078). **No `.cargo/config.toml` exists** — so there is no fleet-wide `[profile.*]` injected via cargo config either. This is the canonical location for fleet-wide profile overrides if the fleet ever adopts a shared profile (see §5 recommendations).

### 4.3 `audit-rules.toml` content excerpt (`.cargo/audit-rules.toml:1-20`)

```toml
# cargo-deny configuration for the Phenotype monorepo.
# Managed by ADR-078 (Encryption-at-Rest Mandate, L52, v19 T2). …
# Run locally with:
#   cargo deny --manifest-path .cargo/audit-rules.toml check
```

Not profile-related. Confirms `.cargo/` is exclusively for security audit at present.

---

## 5. Fleet-wide consistency — current state

| Profile setting | `dev` | `release` | `test` | `bench` | Source |
|---|---:|---:|---:|---:|---|
| `opt-level` | 0 (default) | 3 (default) | 0 (default) | 3 (default) | Cargo |
| `debug` | true (default) | false (default) | true (default) | false (default) | Cargo |
| `lto` | false (default) | false (default) | false (default) | false (default) | Cargo |
| `codegen-units` | 16 (default) | 16 (default) | 16 (default) | 16 (default) | Cargo |
| `incremental` | true (default) | false (default) | true (default) | false (default) | Cargo |

**Consistency verdict:** All 6 readable crates are **perfectly consistent** — because they all use Cargo defaults. This is consistent-by-accident (no overrides anywhere), not consistent-by-design.

---

## 6. Recommendations

### 6.1 Fleet-canonical profile block (proposed)

Two paths to choose from. Both target the same fleet outcome but differ in maintenance burden.

#### Option A — Per-crate `[profile.*]` block (most explicit)

Drop the following into each of the 6 readable crates' `Cargo.toml` **at the bottom**, after `[dev-dependencies]`. Replicate to `focalpoint-wt-v12-16-17/pheno-cli-base/Cargo.toml` as well.

```toml
# Fleet-canonical profile block (SIDE-17, ADR-proposed).
# Mirrors the recommended Rust release-profile defaults for libraries:
#   - release: opt-level 3 (full opt) + LTO thin + codegen-units 1
#     (gives ~10-20% smaller and ~5-15% faster binaries; ~2x link time)
#   - dev:     opt-level 0 + debug true + incremental true (Cargo defaults)
#   - test:    inherits dev (debug + line tables for failures)
#   - bench:   inherits release (so cargo bench numbers reflect production perf)
[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1
debug = false        # no debug info in release; set to "line-tables-only" if needed

[profile.dev]
opt-level = 0
debug = true
incremental = true

[profile.bench]
inherits = "release"

[profile.test]
inherits = "dev"
```

**Rationale for `release` choices:**

| Setting | Value | Why |
|---|---|---|
| `opt-level` | 3 | Maximum optimization for shipped binaries. All other crates use this default; declaring it makes it explicit. |
| `lto` | `"thin"` | Cross-crate inlining across `pheno-port-adapter` ↔ `pheno-otel` ↔ `pheno-errors` boundary. Full LTO is overkill for libraries with `pub` surface; thin LTO gives most of the benefit at ~half the link cost. |
| `codegen-units` | 1 | Maximum cross-module inlining opportunity. Default of 16 parallelizes compilation but reduces optimization headroom. Crate build times are not on the critical path for this fleet (heavy-runner bench, per ADR-023). |
| `debug` | false | Strip debug info from release. Use `"line-tables-only"` if stack traces are needed in production. |

**Rationale for `bench`:** `criterion` benchmarks live in 3 crates (`pheno-port-adapter`, `pheno-errors`, `pheno-config`). Inheriting `release` (opt 3, lto thin, codegen-units 1) gives **stable, comparable** numbers across runs and crates. Without this, benchmarks inherit only `release` defaults (lto false, codegen-units 16) and produce noisier data.

#### Option B — Fleet-wide `.cargo/config.toml` (less per-crate duplication)

Create `/Users/kooshapari/CodeProjects/Phenotype/repos/.cargo/config.toml` (this directory currently only has `audit-rules.toml`, so adding `config.toml` is non-conflicting):

```toml
# Fleet-wide cargo configuration (SIDE-17, ADR-proposed).
# This file is auto-discovered by every `cargo` invocation in this
# directory tree. Profile overrides here apply to ALL crates in the
# monorepo without modifying their Cargo.toml files.
#
# Reference: https://doc.rust-lang.org/cargo/reference/config.html#profile

[profile.release]
opt-level = 3
lto = "thin"
codegen-units = 1

[profile.dev]
opt-level = 0
debug = true

[profile.bench]
inherits = "release"

[profile.test]
inherits = "dev"
```

**Pros:** single point of change, survives crate additions.
**Cons:** invisible to readers of individual crates; can be overridden by a per-crate `[profile.*]` block (and there are zero of those today, so this is fine); some IDE integrations don't surface `.cargo/config.toml` profile info.

**Recommendation:** **Option B for the fleet root, plus the Option A `[profile.bench]` block in the 3 crates with criterion benches**, because criterion honors the bench profile *per crate* (the `.cargo/config.toml` `[profile.bench]` IS inherited, so Option A is redundant if Option B is adopted — confirm by cargo bench smoke test).

### 6.2 Restore or archive the empty stubs

`pheno-agents-md` and `pheno-cargo-template` are listed in `AGENTS.md` §"pheno-* family" but have no Cargo.toml. Decide explicitly:

- **Restore** (preferred if these crates are on the v19+ roadmap): create the `Cargo.toml` + `src/lib.rs` skeleton and apply the Option A profile block.
- **Archive** (preferred if the crates are not actively scheduled): remove from `AGENTS.md` and add to the `PAUSED APPs` table in the style of `pheno-agents-md` not-paused entry.

Recommend a **one-line worklog entry per stub** per the v19 worklog schema (`device: macbook`):

```
bucket_change pheno-agents-md: from=ACTIVE-LISTED to=PAUSED-EMPTY-STUB reason=no Cargo.toml, restore-or-archive gate (SIDE-17 follow-up)
bucket_change pheno-cargo-template: from=ACTIVE-LISTED to=PAUSED-EMPTY-STUB reason=no Cargo.toml, restore-or-archive gate (SIDE-17 follow-up)
```

### 6.3 Fix the `pheno-context` workspace-dep resolution

`pheno-context/Cargo.toml:17` uses `thiserror = { workspace = true }` but **no root `Cargo.toml` exists** to host `[workspace.dependencies]`. This will fail to resolve. Two paths:

1. **Restore a root `Cargo.toml`** with `[workspace] members = [...]` + `[workspace.dependencies]` + the recommended `[profile.*]` block (Option A) → then `pheno-context` resolves.
2. **Drop the workspace reference** in `pheno-context` and use `thiserror = "1"` literal → smaller blast radius, no monorepo reintroduction needed.

Recommend path 2 for SIDE-17; path 1 is a separate, larger discussion (see `AGENTS.md` §"Root `Cargo.toml` workspace" stale-warning note).

### 6.4 Clean up `pheno-config` duplicate dep + empty dev-deps

Out of scope for SIDE-17 but surfaced during read:

- Remove the duplicate `figment = { version = "0.10", ... }` declaration (lines 26 and 39).
- Either move `criterion = "0.8"` to `[dev-dependencies]` or document why it's in `[dependencies]` (currently `[dev-dependencies]` is empty despite a benchmark file referenced in the comment).

---

## 7. Summary scorecard

| Pillar (71-pillar L13/L14/L57 cross-ref) | Status | Score |
|---|---|---|
| L13 perf budgets (informed by `release` opt + LTO) | Default — not yet tuned | **2.0** (adequate) |
| L14 latency budgets | Default | **2.0** |
| L57 perf regression gate (criterion bench comparability) | Default `bench` profile (lto false, codegen-units 16) → noisy | **1.5** (minimal) |
| L19 perf benchmarking infra (per v19 T4) | Not yet adopted fleet-wide; per-crate bench present in 3 crates | **2.0** |
| L22 CI cache (sccache) | Independent of profiles; not covered here | n/a |

**Fleet mean impact if Option B is adopted:** L57 moves from 1.5 → 2.0; L13 stays at 2.0 (now explicit); L19 stays at 2.0 (now measurable). Net: +0.5 across 3 pillars = +1.5/71 = ~+0.02 fleet mean. Small, but the **`bench` profile fix alone** (Option A or B) materially improves criterion number stability for the 3 benchmark-bearing crates.

---

## 8. Open questions / follow-ups

1. **Restore or archive** `pheno-agents-md` and `pheno-cargo-template`? Owner: orch-w1-a. Decision deadline: before v19 cycle-9 re-audit (week of 2026-06-22).
2. **Adopt Option A, Option B, or both?** Recommend Option B (single `.cargo/config.toml`); ADR-proposed. Owner: orch-w1-a. Tracks as a v19 follow-up if not blocked.
3. **`pheno-context` workspace-dep resolution** — fix now (drop `workspace = true`) or restore root `Cargo.toml` (larger scope)? Recommend drop `workspace = true` now, defer monorepo workspace discussion.
4. **`pheno-config` duplicate `figment`** — clean up in a follow-up PR (out of scope here).
5. **Stale root `Cargo.lock`** — delete or formalize a process to keep it in sync if a root workspace is reintroduced.

---

## 9. References

- `pheno-otel/Cargo.toml:1-37` — source manifest for crate #1
- `pheno-port-adapter/Cargo.toml:1-34` — source manifest for crate #2
- `pheno-errors/Cargo.toml:1-21` — source manifest for crate #3
- `pheno-context/Cargo.toml:1-25` — source manifest for crate #4 (note `workspace = true` issue)
- `pheno-config/Cargo.toml:1-33` — source manifest for crate #5 (note duplicate `figment` and empty dev-deps)
- `focalpoint-wt-v12-16-17/pheno-cli-base/Cargo.toml:1-28` — source manifest for crate #6
- `FocalPoint/pheno-agents-md/` — empty stub
- `focalpoint-wt-v12-16-17/pheno-agents-md/` — empty stub
- `focalpoint-wt-v12-16-17/pheno-cargo-template/` — empty stub
- `/Users/kooshapari/CodeProjects/Phenotype/repos/.cargo/audit-rules.toml` — confirmed not profile-related
- `/Users/kooshapari/CodeProjects/Phenotype/repos/Cargo.toml` — **does not exist**
- `/Users/kooshapari/CodeProjects/Phenotype/repos/Cargo.lock` — stale orphan (no root `Cargo.toml` to maintain it)
- AGENTS.md §"Stale / warnings" — pre-existing note about root `Cargo.toml` workspace inconsistency
- ADR-023 (App-level repo triage, L5-101) — bucket governance for sub-crates
- ADR-040 (Test coverage gates per tier) — criterion as fleet benchmark tool
- ADR-048 (Substrate graduation path) — profile + observability + bench expectations for STABLE-tier substrates
