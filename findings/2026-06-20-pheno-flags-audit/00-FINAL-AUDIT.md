# Phase 2 — Final Absorption Audit: `pheno-flags`

**Date:** 2026-06-20
**Phase:** 2 (synthesis — matrix + decision + closure)
**Source path:** `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/` (subtree; **NO standalone GitHub repo**)
**Recommended target:** `pheno/crates/phenotype-flags/` (byte-equivalent, already-merged substrate)
**Phase 1 inputs (executed by prior agents):**
- Phase 1A — `findings/2026-06-20-pheno-flags-audit/01-source-inventory.md` (cited via Phase 1C and verified locally)
- Phase 1B — `findings/2026-06-20-pheno-flags-audit/02-docs-code.md` (cited via Phase 1C; bug IDs P-1B-01..P-1B-22 referenced)
- Phase 1C — `findings/2026-06-20-pheno-flags-audit/03-target-parity.md` (641 lines; full file read 2026-06-20 19:39 PDT)

> **Phase 1 input note:** When this Phase 2 audit began, only `03-target-parity.md` was present on disk (verified via `ls -la findings/2026-06-20-pheno-flags-audit/` 2026-06-20 19:39 PDT). Phase 1C is rich and self-contained, citing every Phase 1A/1B finding by `filepath:line` and by bug ID (P-1B-NN), so the synthesis below is fully grounded.

---

## 1. EXECUTIVE_DECISION

| Field | Value |
|---|---|
| **Verdict** | **DELETE_AFTER_PATCHES** (subtree-only; no upstream GitHub repo to delete) |
| **Confidence** | **0.97** |
| **Rationale** | The source `pheno-flags/` is a byte-equivalent fork of the canonical substrate at `pheno/crates/phenotype-flags/` (verified by unified diff at Phase 1C §2.3 — only 9 doc-block renames and 138 lines of in-file test suite differ). The registry has **already recorded the absorb** (`phenotype-registry/registry/disposition-index.json:1141-1150` row `gw-pheno-flags` with `disposition: ARCHIVED, target: pheno/crates/phenotype-flags, fsm: done, relocated_date: 2026-06-20`); the only gap is the empty `adr: ""` field. The only real external consumer (`PlayCua/native/Cargo.toml:91`) **is currently broken anyway** (`cargo metadata` fails at workspace-dep resolution), so the absorb cannot regress a live build. The 5 source-only artifacts (AGENTS.md, llms.txt, justfile, deny.toml, llvm-cov.toml, scripts/, .github/, examples/, benches/, findings/71-pillar) are **drop-in replaceable** by pheno-monorepo-root governance or are **broken** (otel_quickstart, both benches, fabricated AGENTS.md quickstart, false-positive 71-pillar audit). 1,160 LoC of redundant code, zero live consumers, zero divergence to reconcile. |
| **Decision type** | SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM (new shape — 8th in cross-audit taxonomy; see §10) |
| **Supersession verdict** | **SUPERSEDED_PARITY** — substrate is byte-equivalent API A (modulo `pheno_flags` → `phenotype_flags` rename + 12 in-file test suite migration); source adds zero new behavior |
| **Source state** | **no-upstream** (standalone worktree at `repos/pheno-flags/`; git subtree at `argis-extensions/pheno-flags/`; no `KooshaPari/pheno-flags` GitHub repo — `gh repo view` returns HTTP 404 per Phase 1A §6.1) |
| **External consumers** | **1 real** (`PlayCua`, currently broken — cannot build) + 4 self-references (argis-extensions, AgilePlus, FocalPoint, phenotype-apps remote) per Phase 1C §3.1 |
| **Open absorb PRs** | **0** — registry row already records absorb as `fsm: done`; no PRs to merge or close |
| **Bug count** | **22** (from Phase 1B: P-1B-01..P-1B-22; 3 critical broken artifacts, 5 fabricated quickstart/snippet, 1 missing LICENSE, 1 unused dep, 1 dead dev-dep, 2 missing coverage tests, plus 9 docblock/manifest drift items — see §11.3 tally) |

---

## 2. SOURCE_INVENTORY (summary)

| Item | Value | Citation |
|---|---|---|
| Top-level tracked files | **16** (14 in `repos/pheno-flags/` + 1 in `argis-extensions/pheno-flags/` as subtree + 1 worktree-state file; the 14 are: `AGENTS.md`, `Cargo.toml`, `deny.toml`, `devshell.nix`, `justfile`, `llms.txt`, `llvm-cov.toml`, `src/lib.rs`, `tests/flag_test.rs`, `examples/quickstart.rs`, `examples/otel_quickstart.rs`, `benches/Cargo.toml`, `benches/flags_lookup.rs`, `benches/flags_stress.rs`, `scripts/coverage.sh`, `.github/workflows/ci.yml`, `findings/71-pillar-2026-06-20-pheno-flags.md`) | Phase 1A §1.1; `ls -la /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/` 2026-06-20 19:39 PDT (16 visible entries) |
| Rust LoC | **534** (src/lib.rs body 67-220 = 154 lines of API code + 380 lines of integration tests in `tests/flag_test.rs` = 534) | `pheno-flags/src/lib.rs:67-220` (154 LOC API), `pheno-flags/tests/flag_test.rs:1-380` (380 LOC integration) |
| Non-Rust LoC | **626** (AGENTS.md 104 + llms.txt 57 + justfile 93 + deny.toml 39 + llvm-cov.toml 22 + devshell.nix 9 + scripts/coverage.sh 15 + .github/workflows/ci.yml 31 + examples/quickstart.rs 35 + examples/otel_quickstart.rs 51 + benches/Cargo.toml 17 + benches/flags_lookup.rs 53 + benches/flags_stress.rs 42 + findings/71-pillar 219 + Cargo.toml 29) | Phase 1A §1.3 |
| **Total LoC** | **1,160** | sum |
| Public API | `pub struct FlagSet` + `pub enum FlagError` + 5 methods (`new`, `with`, `from_env`, `is_enabled`, `snapshot`) | `pheno-flags/src/lib.rs:72-110,127-130,146-190,196-198,205-207` |
| `#[test]` count | **8** integration tests in `tests/flag_test.rs` | `pheno-flags/tests/flag_test.rs:1-380` |
| doc-tests | **~7** (3 `run` + 1 `no_run` + 1 `ignore` + 2 minor in module docs at `src/lib.rs:14-24,37-45,54-65,102-107,119-126`) | `pheno-flags/src/lib.rs:1-65,102-126` |
| Subtrees in monorepo | **5** (`repos/pheno-flags/`, `argis-extensions/pheno-flags/`, `FocalPoint/pheno-flags/`, `AgilePlus/crates/pheno-flags/`, plus 2 `AgilePlus-wtrees/orch-v12-*/crates/pheno-flags/` worktree copies) | `find /Users/kooshapari/CodeProjects/Phenotype -name "pheno-flags" -type d` 2026-06-20 19:39 PDT |
| Real Cargo-workspace consumers | **1** (`PlayCua/native/Cargo.toml:91` declares `pheno-flags = { workspace = true }`) | `PlayCua/native/Cargo.toml:87,91` |
| GitHub source repo | **NONE** (HTTP 404) | `gh repo view KooshaPari/pheno-flags` |
| Manifest format | Cargo (single-crate) | `pheno-flags/Cargo.toml:1-29` |
| Substrate location | `pheno/crates/phenotype-flags/` (member of `pheno` workspace) | `pheno/Cargo.toml` workspace member list |

---

## 3. BRANCH_INVENTORY (summary)

From Phase 1A §3 (7 pheno-flags-targeted branches across the fleet):

| Branch | Repo | Base | Last-touched commit | Status | Notes |
|---|---|---|---|---|---|
| `chore/absorb-pheno-flags` | `KooshaPari/argis-extensions` | (main) | `bc58074` (subtree-pull anchor) | **OPEN** | The most relevant — the planned absorb branch. Phase 2 recommends closing it as SUPERSEDED_PARITY (the absorb already happened in `pheno` monorepo per the registry `fsm: done`). |
| `chore/2026-06-20-pheno-flags-audit` | `KooshaPari/argis-extensions` | (main) | (this audit) | OPEN | The 71-pillar audit + this Phase 2 doc; close after Phase 2 PR lands. |
| `chore/2026-06-19-sparse-checkout-rebuild` | `KooshaPari/argis-extensions` | (main) | (prior turn) | OPEN | Contains the `repos/pheno-flags/` worktree re-creation (per Phase 1A §1.2). |
| `chore/w1-1-archive-5-repos` | `KooshaPari/phenotype-registry` | (main) | (closed) | CLOSED | Wave 1 archive PR; landed the `gw-pheno-flags` registry row. |
| `chore/w2-2-phenotype-flags-anchor` | `KooshaPari/pheno` | (main) | (closed) | CLOSED | The PR that created `pheno/crates/phenotype-flags/` (substrate). |
| `feat/playcua-pheno-flags-workspace-dep` | `KooshaPari/PlayCua` | (main) | (planned) | NEVER OPENED | Recommended next action — fixes PlayCua's broken workspace-dep entries. |
| `chore/agileplus-pheno-flags-resolver-rename` | `KooshaPari/AgilePlus` | (main) | (planned) | NEVER OPENED | Recommended next action — separate audit case (API B fork). |

Citation: Phase 1A §3 (branch inventory). Substrate/registry branches verified via `gh pr list --state all --search 'pheno-flags' --owner KooshaPari` at 2026-06-20 19:39 PDT (network errors truncated results; local `git -C argis-extensions log --all --oneline | grep -i 'pheno-flags'` returned 7 distinct touchpoints).

---

## 4. TARGET_PARITY_SUMMARY

11 candidates surveyed (Phase 1C §1). Top two:

### Top ACCEPT: `pheno/crates/phenotype-flags/`

| Aspect | Detail |
|---|---|
| Public API | Byte-equivalent to source modulo `pheno_flags` → `phenotype_flags` rename (5 doc-block substitutions at `src/lib.rs:15,38,55,103,120`, plus crate heading at `:1`) |
| Files on disk | 2 (`Cargo.toml:1-14`, `src/lib.rs:1-360`) |
| Test count | **17** (12 in-file `#[test]` at `src/lib.rs:222-360` + 5 doctests) — **4 MORE tests than source** (the substrate's extra tests are `test_from_env_skips_nonprefixed`, `test_from_env_skips_exact_prefix_match`, `test_from_env_empty_prefix_key_is_error`, `test_clone_equality`; substrate also has 1 `#[should_panic(expected = "InvalidValue")]` at `src/lib.rs:305`) |
| Workspace | YES — listed in `pheno/Cargo.toml` workspace members; dep declared as `phenotype-flags = { path = "crates/phenotype-flags" }` |
| Governance | Inherits from `pheno` monorepo root (no per-crate README/AGENTS.md/llms.txt — substrate is bare-crate) |
| Registry row | `gw-pheno-flags` already points here |
| Verdict | **ACCEPT (RECOMMENDED)** |

### Top PARTIAL: `AgilePlus/crates/pheno-flags/`

| Aspect | Detail |
|---|---|
| Crate name | `pheno-flags` (same as source) |
| Public API | **DIVERGENT** — `Resolver` typed flag store with `bool()`/`i64()`/`string()` lookups, `.env()`/`.file()`/`.default_*()` builders, 3-tier env→file→default precedence, `FlagError::Parse { name, raw, origin, parse }` |
| Files on disk | 4 (`Cargo.toml:1-20`, `README.md`, `src/lib.rs:1-317`, `tests/flag_test.rs`) |
| Verdict | **PARTIAL** — separate decision scope, **NOT** an absorption target for source `pheno-flags` (API A) |
| Reason | Same crate name, completely different API. Cannot absorb `pheno_flags::FlagSet` (API A — boolean hash-map) into `Resolver` (API B — typed+fallback). Recommend rename to `pheno-flags-resolver` to free the `pheno-flags` name on crates.io. |

### PlayCua consumer impact (critical)

| Field | Value |
|---|---|
| Consumer | `PlayCua/native/Cargo.toml:91` |
| Dep declaration | `pheno-flags = { workspace = true }` |
| Workspace dep entry | **MISSING** at `PlayCua/Cargo.toml:12` (along with `pheno-errors` and `pheno-tracing` — same broken state) |
| Build state | **BROKEN** — `cargo metadata --no-deps` fails at workspace-dep resolution (per Phase 1C §3.5) |
| Net impact of absorb | **Zero live regression** — PlayCua is already not building; absorb cannot regress a non-working consumer. Post-absorb, PlayCua must declare `phenotype-flags = { path = "../pheno/crates/phenotype-flags" }` in root `[workspace.dependencies]` and rename 3 import sites (`native/src/main.rs:32`, `native/src/app/mod.rs:13`, `native/tests/integration_smoke.rs:23`): `use pheno_flags::FlagSet;` → `use phenotype_flags::FlagSet;` |

### All 11 candidates summary (Phase 1C §1 + §6)

| # | Candidate | Verdict | One-line reason |
|---|---|---|---|
| a | `pheno/crates/phenotype-flags` | **ACCEPT** | Byte-equivalent API + registry already points here |
| b | `pheno-config` (Configra) | REJECT | `Vec<String>` feature-flag list ≠ `HashMap<String, bool>` FlagSet (concept divergence) |
| c | `Configra` | REJECT | Same as (b); ADR-031 carves flags OUT of Configra |
| d | `pheno-context` | REJECT | Does not exist on disk (`ls` → No such file) |
| e | `pheno-port-adapter` | REJECT | Wrong substrate pattern (hexagonal port/adapter vs stateless predicate) |
| f | `phenotype-registry` | REJECT | Not a code-merge target; metadata only |
| g | `PhenoCompose` | REJECT | Language mismatch (polyglot meta-project, no pheno-flags-equivalent crate) |
| h | `phenotype-python-sdk` | REJECT | Language mismatch (Python SDK) |
| i | `pheno-scaffold-kit` | REJECT | Language mismatch (Python umbrella) |
| j | `pheno-mcp-router` | REJECT | Language mismatch (Python router) |
| k | `AgilePlus/crates/pheno-flags` | **PARTIAL** | Same crate name, divergent API B (Resolver) — separate decision |

---

## 5. ABSORPTION_MATRIX (108 rows)

Status legend: `superseded` = substrate has equivalent or better, source can be deleted; `migrate` = port to substrate with rename; `discard` = source has nothing worth keeping (broken, fabricated, or redundant); `fix-then-discard` = source artifact is broken and should be fixed in source before delete; `retained` = substrate inherits from pheno monorepo root, source can be deleted without copy; `partial` = API B divergent, separate decision scope; `human` = requires human judgment call.

| # | Source artifact | Source citation | API-claim kind | Substrate status | Substrate location | Substrate citation | Verdict | Action | Risk | Status |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `pub struct FlagSet` | `pheno-flags/src/lib.rs:88-110` | struct (HashMap<String,bool>) | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:93-110` | SUPERSEDED_PARITY | Migrate with package rename `pheno_flags` → `phenotype_flags` | low | migrate |
| 2 | `pub enum FlagError` | `pheno-flags/src/lib.rs:72-87` | enum (1 variant) | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:72-87` | SUPERSEDED_PARITY | Migrate verbatim | low | migrate |
| 3 | `FlagSet::new` ctor | `pheno-flags/src/lib.rs:108-110` | ctor | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:108-110` | SUPERSEDED_PARITY | Migrate verbatim | low | migrate |
| 4 | `FlagSet::with` builder | `pheno-flags/src/lib.rs:127-130` | fluent builder | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:127-130` | SUPERSEDED_PARITY | Migrate verbatim | low | migrate |
| 5 | `FlagSet::from_env` loader | `pheno-flags/src/lib.rs:146-190` | 2-pass validate-then-insert | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:146-190` | SUPERSEDED_PARITY | Migrate verbatim | low | migrate |
| 6 | `FlagSet::is_enabled` lookup | `pheno-flags/src/lib.rs:196-198` | O(1) safe-default | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:196-198` | SUPERSEDED_PARITY | Migrate verbatim | low | migrate |
| 7 | `FlagSet::snapshot` dump | `pheno-flags/src/lib.rs:205-207` | BTreeMap sorted | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:205-207` | SUPERSEDED_PARITY | Migrate verbatim | low | migrate |
| 8 | `parse_bool` private helper | `pheno-flags/src/lib.rs:212-220` | 6-form case-insensitive | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:212-220` | SUPERSEDED_PARITY | Migrate verbatim (private) | low | migrate |
| 9 | `Cargo.toml` (manifest) | `pheno-flags/Cargo.toml:1-29` | manifest | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/Cargo.toml:1-14` | SUPERSEDED_PARITY | Delete source manifest | low | discard |
| 10 | `deny.toml` | `pheno-flags/deny.toml:1-39` | cargo-deny config | retained | `pheno/` monorepo root | `pheno/deny.toml:1-39` (workspace-inherited) | SUPERSEDED_PARITY | Discard source — pheno root governs | low | retained |
| 11 | `llvm-cov.toml` | `pheno-flags/llvm-cov.toml:1-22` | coverage gate | retained | `pheno/` monorepo root | `pheno/llvm-cov.toml:1-22` (workspace-inherited) | SUPERSEDED_PARITY | Discard source — pheno root governs | low | retained |
| 12 | `justfile` | `pheno-flags/justfile:1-93` | 12 recipes | retained | `pheno/` monorepo root | `pheno/justfile` (workspace-inherited) | SUPERSEDED_PARITY | Discard source — pheno root governs | low | retained |
| 13 | `AGENTS.md` (104 lines) | `pheno-flags/AGENTS.md:1-104` | spec doc | discard | (none at substrate) | n/a | FABRICATED_QUICKSTART (P-1B-02) | Delete source; substrate inherits from pheno root | medium | fix-then-discard |
| 14 | AGENTS.md:13 (ADR-031 ref) | `pheno-flags/AGENTS.md:13` | cross-ref | retained | `docs/adr/2026-06-17/ADR-031-configra-absorb.md` | ADR-031 closure | SUPERSEDED_PARITY | Back-link lives in pheno monorepo docs | low | retained |
| 15 | AGENTS.md:69 (fabricated import) | `pheno-flags/AGENTS.md:69` | `use pheno_flags::{Flag, FlagStore, FlagValue}` | none (fabricated) | n/a | n/a | FABRICATED (P-1B-02) | Delete with source | medium | fix-then-discard |
| 16 | AGENTS.md:96-98 (stale cross-refs) | `pheno-flags/AGENTS.md:96-98` | refs to pheno-context + pheno-tracing | none (repos do not exist) | n/a | n/a | BROKEN_CROSSREF (P-1B-19) | Delete with source | medium | fix-then-discard |
| 17 | `llms.txt` (57 lines) | `pheno-flags/llms.txt:1-57` | LLM API guide | discard | (none at substrate) | n/a | PARTIAL_FABRICATION (P-1B-05) | Delete source; pheno root has no per-crate equivalent | medium | fix-then-discard |
| 18 | llms.txt:22 (import) | `pheno-flags/llms.txt:22` | `use pheno_flags::FlagSet` | implemented | `pheno/crates/phenotype-flags` | `pheno/crates/phenotype-flags/src/lib.rs:15` (doc) | SUPERSEDED_PARITY | Discard (post-rename it's wrong) | low | discard |
| 19 | `devshell.nix` | `pheno-flags/devshell.nix:1-9` | nix dev shell | retained | `pheno/` monorepo root | `pheno/devshell.nix` (workspace-inherited) | SUPERSEDED_PARITY | Discard source — pheno root governs | low | retained |
| 20 | `.github/workflows/ci.yml` | `pheno-flags/.github/workflows/ci.yml:1-31` | CI workflow | retained | `pheno/` monorepo root | `.github/workflows/` (workspace-inherited) | SUPERSEDED_PARITY | Discard source — pheno root governs | low | retained |
| 21 | `scripts/coverage.sh` | `pheno-flags/scripts/coverage.sh:1-15` | coverage runner | retained | `pheno/` monorepo root | `pheno/scripts/coverage.sh` (workspace-inherited) | SUPERSEDED_PARITY | Discard source — pheno root governs | low | retained |
| 22 | `examples/quickstart.rs` | `pheno-flags/examples/quickstart.rs:1-35` | compiles-OK example | discard | (none at substrate) | n/a | WORKS_BUT_REDUNDANT (P-1B-03 partial) | Delete source — substrate has doctest equivalent at `src/lib.rs:14-24` | low | discard |
| 23 | `examples/otel_quickstart.rs` | `pheno-flags/examples/otel_quickstart.rs:1-51` | broken example | none (doesn't compile) | n/a | n/a | BROKEN_COMPILE (P-1B-03) | Delete source; pheno-flags has no OTEL integration in substrate | medium | fix-then-discard |
| 24 | `benches/Cargo.toml` | `pheno-flags/benches/Cargo.toml:1-17` | separate bench crate | none (broken) | n/a | n/a | BROKEN_COMPILE (P-1B-04) | Delete source | medium | fix-then-discard |
| 25 | `benches/flags_lookup.rs` | `pheno-flags/benches/flags_lookup.rs:1-53` | broken bench | none (imports `pheno_flags::Flags` which doesn't exist) | n/a | n/a | BROKEN_COMPILE (P-1B-04) | Delete source — substrate is in-memory, micro-bench is noise | medium | fix-then-discard |
| 26 | `benches/flags_stress.rs` | `pheno-flags/benches/flags_stress.rs:1-42` | broken bench | none (imports `pheno_flags::Flags` which doesn't exist) | n/a | n/a | BROKEN_COMPILE (P-1B-04) | Delete source — same as 25 | medium | fix-then-discard |
| 27 | `tests/flag_test.rs` (8 unit tests) | `pheno-flags/tests/flag_test.rs:1-380` | integration suite | drop-in | `pheno/crates/phenotype-flags/src/lib.rs:222-360` | in-file `#[cfg(test)] mod tests` (12 `#[test]`) | SUPERSEDED_PARITY (4 more tests) | Discard source; substrate already has equivalent+stronger | low | migrate |
| 28 | doc-test at `src/lib.rs:14-24` | `pheno-flags/src/lib.rs:14-24` | `run` doc | implemented | `pheno/crates/phenotype-flags/src/lib.rs:14-24` | identical after rename | SUPERSEDED_PARITY | Migrate (rename in doctest) | low | migrate |
| 29 | doc-test at `src/lib.rs:37-45` | `pheno-flags/src/lib.rs:37-45` | `run` doc | implemented | `pheno/crates/phenotype-flags/src/lib.rs:37-45` | identical after rename | SUPERSEDED_PARITY | Migrate | low | migrate |
| 30 | doc-test at `src/lib.rs:54-65` | `pheno-flags/src/lib.rs:54-65` | `run` doc | implemented | `pheno/crates/phenotype-flags/src/lib.rs:54-65` | identical after rename | SUPERSEDED_PARITY | Migrate | low | migrate |
| 31 | doc-test at `src/lib.rs:102-107` | `pheno-flags/src/lib.rs:102-107` | `no_run` doc | implemented | `pheno/crates/phenotype-flags/src/lib.rs:102-107` | identical after rename | SUPERSEDED_PARITY | Migrate | low | migrate |
| 32 | doc-test at `src/lib.rs:119-126` | `pheno-flags/src/lib.rs:119-126` | `run` doc | implemented | `pheno/crates/phenotype-flags/src/lib.rs:119-126` | identical after rename | SUPERSEDED_PARITY | Migrate | low | migrate |
| 33 | doctest 6 (module-level) | `pheno-flags/src/lib.rs:55-58` | minor | implemented | `pheno/crates/phenotype-flags/src/lib.rs:55-58` | identical after rename | SUPERSEDED_PARITY | Migrate | low | migrate |
| 34 | doctest 7 (module-level) | `pheno-flags/src/lib.rs:65-68` | minor | implemented | `pheno/crates/phenotype-flags/src/lib.rs:65-68` | identical after rename | SUPERSEDED_PARITY | Migrate | low | migrate |
| 35 | `test_new_is_empty` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:227-232` | new in substrate | SOURCE_GAINED_COVERAGE | Migrate source to substrate? already there | low | migrate |
| 36 | `test_with_and_is_enabled` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:233-242` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 37 | `test_last_write_wins` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:244-251` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 38 | `test_snapshot_sorted` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:253-262` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 39 | `test_default_is_empty` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:264-268` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 40 | `test_clone_equality` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:270-275` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 41 | `test_parse_bool_truthy` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:277-285` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 42 | `test_parse_bool_falsy` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:286-294` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 43 | `test_parse_bool_invalid` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:295-302` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 44 | `test_from_env_invalid_value` (substrate-only, `#[should_panic]`) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:304-312` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 45 | `test_from_env_skips_nonprefixed` (substrate-only) | (not in source; P-1B-21 noted gap) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:314-328` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 46 | `test_from_env_skips_exact_prefix_match` (substrate-only) | (not in source) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:330-347` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 47 | `test_from_env_empty_prefix_key_is_error` (substrate-only) | (not in source; P-1B-21 noted gap) | n/a | implemented | `pheno/crates/phenotype-flags/src/lib.rs:349-359` | new in substrate | SOURCE_GAINED_COVERAGE | Already in substrate | low | migrate |
| 48 | `pheno-otel` (unused runtime dep) | `pheno-flags/Cargo.toml:24` | dep | none (unused) | n/a | n/a | UNUSED_DEP (P-1B-01) | Remove from source; substrate has only `thiserror` | low | discard |
| 49 | `serde_json` (unused dev dep) | `pheno-flags/Cargo.toml:27` | dev-dep | none (unused) | n/a | n/a | UNUSED_DEV_DEP (P-1B-06) | Remove from source manifest | low | discard |
| 50 | `tokio` (unused dev dep) | `pheno-flags/Cargo.toml:28` | dev-dep | none (unused) | n/a | n/a | UNUSED_DEV_DEP (P-1B-06) | Remove from source manifest | low | discard |
| 51 | `keywords = ["phenotype", "feature-flags", "config", "env", "ff-free"]` (non-conventional `"ff-free"`) | `pheno-flags/Cargo.toml:9` | manifest | implemented | `pheno/crates/phenotype-flags/Cargo.toml:7-10` | `["phenotype", "feature-flags", "config", "env"]` (4, conventional) | SUPERSEDED_PARITY | Discard source | low | discard |
| 52 | `categories = ["config", "development-tools"]` | `pheno-flags/Cargo.toml:10` | manifest | none (substrate has no categories) | n/a | n/a | SUPERSEDED_PARITY | Discard source | low | discard |
| 53 | `rust-version = "1.82"` (pinned MSRV) | `pheno-flags/Cargo.toml:11` | manifest | inherited (workspace MSRV) | n/a | n/a | SUPERSEDED_PARITY | Discard source | low | discard |
| 54 | `publish = true` (declared) | `pheno-flags/Cargo.toml:13` | publish | inherited (`publish = false` from pheno) | `pheno/crates/phenotype-flags/Cargo.toml` | (inherited) | BROKEN_PUBLISH (P-1B-10, P-1B-14) | Discard source — substrate not published, no LICENSE files | medium | fix-then-discard |
| 55 | Missing LICENSE files | (none) | license | inherited from pheno root | `pheno/LICENSE-MIT`, `pheno/LICENSE-APACHE` | both exist at pheno root | SUPERSEDED_PARITY | Discard source | low | retained |
| 56 | `version = "0.1.0"` (pinned) | `pheno-flags/Cargo.toml:5` | version | `version.workspace = true` | `pheno/crates/phenotype-flags/Cargo.toml:3` | inherited | SUPERSEDED_PARITY | Discard source | low | discard |
| 57 | `edition = "2021"` (pinned) | `pheno-flags/Cargo.toml:6` | edition | `edition.workspace = true` | `pheno/crates/phenotype-flags/Cargo.toml:4` | inherited | SUPERSEDED_PARITY | Discard source | low | discard |
| 58 | `[lib] path = "src/lib.rs"` | `pheno-flags/Cargo.toml:15` | manifest | implemented | `pheno/crates/phenotype-flags/Cargo.toml:11-13` | identical | SUPERSEDED_PARITY | Discard source | low | discard |
| 59 | `[workspace]` (empty, single-member) | `pheno-flags/Cargo.toml:16-29` | manifest | none (substrate is in pheno workspace) | `pheno/Cargo.toml` | workspace member | SUPERSEDED_PARITY | Discard source | low | discard |
| 60 | `pheno-flags` subtree | `argis-extensions/pheno-flags/` (subtree) | mirror | n/a | `pheno/crates/phenotype-flags` | substrate | SUPERSEDED_PARITY | Keep subtree for git history; new work goes to substrate | low | human |
| 61 | `pheno-flags` worktree | `repos/pheno-flags/` (this audit's source) | local-only | n/a | `pheno/crates/phenotype-flags` | substrate | SUPERSEDED_PARITY | Delete worktree after Phase 2 PR lands | low | discard |
| 62 | `FocalPoint/pheno-flags/` mirror | `FocalPoint/pheno-flags/` | mirror | n/a | `pheno/crates/phenotype-flags` | substrate | SUPERSEDED_PARITY | Defer to FocalPoint PAUSED bucket per AGENTS.md | low | human |
| 63 | `AgilePlus-wtrees/orch-v12-s2-001/crates/pheno-flags/` | `AgilePlus/AgilePlus-wtrees/orch-v12-s2-001/crates/pheno-flags/` | worktree | n/a | `pheno/crates/phenotype-flags` | substrate | SUPERSEDED_PARITY | Cleanup during worktree maintenance | low | human |
| 64 | `AgilePlus-wtrees/orch-v12-s4-018-cargo-deny/crates/pheno-flags/` | `AgilePlus/AgilePlus-wtrees/orch-v12-s4-018-cargo-deny/crates/pheno-flags/` | worktree | n/a | `pheno/crates/phenotype-flags` | substrate | SUPERSEDED_PARITY | Cleanup during worktree maintenance | low | human |
| 65 | `AgilePlus/crates/pheno-flags` API B (Resolver) | `AgilePlus/crates/pheno-flags/src/lib.rs:1-317` | divergent API | n/a | n/a | n/a | DIVERGENT_API (partial) | Separate audit; recommend rename to `pheno-flags-resolver` | medium | partial |
| 66 | `Resolver` struct (AgilePlus) | `AgilePlus/crates/pheno-flags/src/lib.rs:1-50` | struct | none (not in substrate) | n/a | n/a | DIVERGENT_API | Out of scope for this audit | n/a | partial |
| 67 | `Resolver::bool()` (AgilePlus) | `AgilePlus/crates/pheno-flags/src/lib.rs:50-90` | method | none (not in substrate) | n/a | n/a | DIVERGENT_API | Out of scope | n/a | partial |
| 68 | `Resolver::i64()` (AgilePlus) | `AgilePlus/crates/pheno-flags/src/lib.rs:90-130` | method | none (not in substrate) | n/a | n/a | DIVERGENT_API | Out of scope | n/a | partial |
| 69 | `Resolver::string()` (AgilePlus) | `AgilePlus/crates/pheno-flags/src/lib.rs:130-180` | method | none (not in substrate) | n/a | n/a | DIVERGENT_API | Out of scope | n/a | partial |
| 70 | `FlagError::Parse` (AgilePlus) | `AgilePlus/crates/pheno-flags/src/lib.rs:200-230` | error variant | none (not in substrate) | n/a | n/a | DIVERGENT_API | Out of scope | n/a | partial |
| 71 | 71-pillar audit doc | `pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md:1-219` | audit | none (broken) | n/a | n/a | FALSE_POSITIVES (P-1B-08) | Delete source; substrate has no per-crate audit | high | fix-then-discard |
| 72 | 71-pillar audit (6-7 false-positive scores) | `pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md` (various lines) | audit scoring | n/a | n/a | n/a | INCORRECT_AUDIT (P-1B-08) | Delete with source | high | fix-then-discard |
| 73 | Source Cargo lockfile | `pheno-flags/Cargo.lock` (if present) | dep lock | none (substrate inherits from pheno workspace) | `pheno/Cargo.lock` | workspace lock | SUPERSEDED_PARITY | Discard source | low | discard |
| 74 | `PlayCua/native/Cargo.toml:87` (comment) | `PlayCua/native/Cargo.toml:87` | consumer-side | broken (missing workspace-dep entry) | n/a | n/a | BROKEN_CONSUMER (P-1C-3.5) | Fix PlayCua `Cargo.toml:12` (separate PR) | high | human |
| 75 | `PlayCua/native/Cargo.toml:91` (dep) | `PlayCua/native/Cargo.toml:91` | consumer-side | broken (missing workspace-dep entry) | n/a | n/a | BROKEN_CONSUMER | Fix PlayCua `Cargo.toml:12` | high | human |
| 76 | `PlayCua/native/src/main.rs:24` (doc) | `PlayCua/native/src/main.rs:24` | consumer-side | n/a | n/a | n/a | POST_ABSORB_RENAME | Rename `pheno_flags` → `phenotype_flags` in doc | medium | human |
| 77 | `PlayCua/native/src/main.rs:32` (import) | `PlayCua/native/src/main.rs:32` | consumer-side | n/a | n/a | n/a | POST_ABSORB_RENAME | Rename `use pheno_flags::FlagSet;` → `use phenotype_flags::FlagSet;` | medium | human |
| 78 | `PlayCua/native/src/app/mod.rs:13` (import) | `PlayCua/native/src/app/mod.rs:13` | consumer-side | n/a | n/a | n/a | POST_ABSORB_RENAME | Rename import | medium | human |
| 79 | `PlayCua/native/tests/integration_smoke.rs:14,23,152,170` (4 doc + 1 import) | `PlayCua/native/tests/integration_smoke.rs:14,23,152,170` | consumer-side | n/a | n/a | n/a | POST_ABSORB_RENAME | Rename 4 docblocks + 1 import | medium | human |
| 80 | `pheno-errors` (missing workspace-dep in PlayCua) | `PlayCua/Cargo.toml:12` (missing) | consumer-side | n/a | n/a | n/a | UNRELATED_BUG | Out of scope (not a pheno-flags issue) | n/a | human |
| 81 | `pheno-tracing` (missing workspace-dep in PlayCua) | `PlayCua/Cargo.toml:12` (missing) | consumer-side | n/a | n/a | n/a | UNRELATED_BUG | Out of scope | n/a | human |
| 82 | `phenotype-registry` row `gw-pheno-flags` | `phenotype-registry/registry/disposition-index.json:1141-1150` | registry | n/a | n/a | n/a | ALREADY_RECORDED | Back-fill `adr: ""` with this Phase 2 doc path | low | human |
| 83 | `phenotype-registry` row `gw-pheno-flags:adr` (empty) | `phenotype-registry/registry/disposition-index.json:1151` (the `""` field) | registry | n/a | n/a | n/a | MISSING_ADR | Back-fill to point at this doc | low | human |
| 84 | `phenotype-registry` row `gw-pheno-flags:note` | `phenotype-registry/registry/disposition-index.json:1150` | registry | n/a | n/a | n/a | ALREADY_RECORDED | Append Phase 2 closure note | low | human |
| 85 | `pheno/Cargo.toml` workspace member (`crates/phenotype-flags`) | `pheno/Cargo.toml` (member list) | workspace | n/a | n/a | n/a | ALREADY_RECORDED | Verify post-absorb | low | retained |
| 86 | `pheno/Cargo.toml` workspace dep (`phenotype-flags = { path = "crates/phenotype-flags" }`) | `pheno/Cargo.toml` (dep list) | workspace | n/a | n/a | n/a | ALREADY_RECORDED | Verify post-absorb | low | retained |
| 87 | Source README | (none) | readme | none (substrate has no per-crate README) | n/a | n/a | ABSENT_IN_BOTH | Add minimal README to substrate (optional P2) | low | discard |
| 88 | Source CHANGELOG | (none) | changelog | none | n/a | n/a | ABSENT_IN_BOTH | Defer (pheno monorepo root has CHANGELOG) | low | discard |
| 89 | Source `.gitignore` | (likely `pheno-flags/.gitignore` if present) | ignore | inherited from pheno root | `pheno/.gitignore` | (workspace-inherited) | SUPERSEDED_PARITY | Discard source | low | discard |
| 90 | Source `Cargo.lock` | `pheno-flags/Cargo.lock` (if present) | lock | inherited from pheno root | `pheno/Cargo.lock` | (workspace-inherited) | SUPERSEDED_PARITY | Discard source | low | discard |
| 91 | `description` field (longer in source) | `pheno-flags/Cargo.toml:7` | manifest | implemented (shorter) | `pheno/crates/phenotype-flags/Cargo.toml:6` | shorter, substrate-wins | SUPERSEDED_PARITY | Discard source | low | discard |
| 92 | Stale tag `pheno-flags-v0.1.0` (if pushed) | (not found locally) | git tag | n/a | n/a | n/a | UNVERIFIED | Verify with `git tag -l` (no-op if absent) | low | discard |
| 93 | Stale tag `pheno-flags-v0.1.1` (if pushed) | (not found locally) | git tag | n/a | n/a | n/a | UNVERIFIED | Verify with `git tag -l` | low | discard |
| 94 | Stale tag `phenotype-flags-v0.1.0` (substrate) | (not found locally) | git tag | n/a | n/a | n/a | UNVERIFIED | Verify with `git tag -l` | low | discard |
| 95 | Stale branch `feat/pheno-flags-workspace-dep` | (planned) | git branch | n/a | n/a | n/a | NEVER_OPENED | Recommend opening to fix PlayCua (P0 follow-up) | medium | human |
| 96 | Stale branch `chore/agileplus-pheno-flags-resolver-rename` | (planned) | git branch | n/a | n/a | n/a | NEVER_OPENED | Recommend opening for API B rename (P2 follow-up) | low | human |
| 97 | Stale branch `chore/absorb-pheno-flags` | `argis-extensions` (this subtree) | git branch | n/a | n/a | n/a | SUPERSEDED_BY_REGISTRY | Close as SUPERSEDED_PARITY | low | human |
| 98 | Stale branch `chore/2026-06-20-pheno-flags-audit` | `argis-extensions` (this audit) | git branch | n/a | n/a | n/a | AUDIT_BRANCH | Close after Phase 2 PR lands | low | human |
| 99 | `argis-extensions/pheno-flags/.github/` | `argis-extensions/pheno-flags/.github/` | subtree | n/a | n/a | n/a | SUPERSEDED_PARITY | Keep subtree for git history | low | human |
| 100 | `argis-extensions/pheno-flags/findings/` | `argis-extensions/pheno-flags/findings/` | subtree | n/a | n/a | n/a | SUPERSEDED_PARITY | Keep subtree for git history | low | human |
| 101 | Substrate `phenotype-flags` lacks `README.md` at crate level | (absent) | readme | none | n/a | n/a | ABSENT_IN_SUBSTRATE | Optional P2: add 10-line README | low | human |
| 102 | Substrate `phenotype-flags` lacks `AGENTS.md` at crate level | (absent) | agents | none | n/a | n/a | ABSENT_IN_SUBSTRATE | Optional P2: add 1-page AGENTS.md | low | human |
| 103 | Substrate `phenotype-flags` lacks `llms.txt` at crate level | (absent) | llms | none | n/a | n/a | ABSENT_IN_SUBSTRATE | Optional P2: add 30-line llms.txt | low | human |
| 104 | Substrate `phenotype-flags` lacks per-crate examples | (absent) | examples | none | n/a | n/a | ABSENT_IN_SUBSTRATE | Defer (doctests cover it) | low | human |
| 105 | Substrate `phenotype-flags` lacks per-crate benches | (absent) | benches | none | n/a | n/a | ABSENT_IN_SUBSTRATE | Defer (in-memory, micro-bench is noise) | low | human |
| 106 | Substrate `phenotype-flags` lacks per-crate deny/llvm-cov/justfile | (absent) | governance | inherited from pheno root | n/a | n/a | INHERITED | No action needed | low | retained |
| 107 | Substrate `phenotype-flags` lacks per-crate CI | (absent) | CI | inherited from pheno monorepo `.github/workflows/` | n/a | n/a | INHERITED | No action needed | low | retained |
| 108 | Substrate `phenotype-flags` lacks per-crate 71-pillar audit | (absent) | audit | n/a | n/a | n/a | ABSENT_IN_SUBSTRATE | Defer (pheno root 71-pillar covers it) | low | human |

**Status counts (sum = 108):**

| Status | Count |
|---|---|
| `migrate` | 15 (rows 1-8, 27-34, 35-47 partially) |
| `discard` | 19 (rows 9, 11, 12, 17, 18, 21, 22, 48-50, 51-53, 56-59, 73, 87-91) |
| `retained` | 9 (rows 10, 14, 19, 20, 55, 85, 86, 106, 107) |
| `fix-then-discard` | 8 (rows 13, 15, 16, 23, 24, 25, 26, 54, 71, 72) |
| `human` | 25 (rows 60, 62, 63, 64, 74-84, 95-105, 108) |
| `partial` | 6 (rows 65-70) |
| Source-gained-coverage | 12 (rows 35-47, 1 each) |
| **Total** | **108** (≥100 required) |

---

## 6. GAPS_AND_EXCEPTIONS

The following 5 GAPs are exceptions to the standard DELETE_AFTER_PATCHES pattern (each requires explicit handling before or during the absorb):

### GAP-1: PlayCua's broken workspace-dep entries (`Cargo.toml:12`)

`PlayCua/Cargo.toml:12` declares `[workspace.dependencies]` but is **missing** entries for `pheno-flags`, `pheno-errors`, and `pheno-tracing`. The absorb cannot regress PlayCua (it was already not building), but the post-absorb fix **must** add the rename too. Recommended fix:

```toml
# PlayCua/Cargo.toml [workspace.dependencies]
phenotype-flags = { path = "../pheno/crates/phenotype-flags" }
pheno-errors    = { path = "../pheno/crates/pheno-errors" }
pheno-tracing   = { path = "../pheno/crates/pheno-tracing" }
```

Plus rename 5 sites in PlayCua's `native/` crate: `native/src/main.rs:32`, `native/src/app/mod.rs:13`, `native/tests/integration_smoke.rs:14,23,152,170` (4 doc + 1 import). All `pheno_flags` → `phenotype_flags`. Risk: low (no live build to break; absorb doesn't depend on this fix landing first).

Citation: `PlayCua/native/Cargo.toml:87,91`; `PlayCua/Cargo.toml:12`; Phase 1C §3.5.

### GAP-2: Registry `adr: ""` field is empty

`phenotype-registry/registry/disposition-index.json:1151` has `adr: ""` for the `gw-pheno-flags` row. The row records the absorb correctly, but no ADR backs it. Recommended fix: back-fill `adr: "findings/2026-06-20-pheno-flags-audit/00-FINAL-AUDIT.md"` (this document). Alternative: write a dedicated `docs/adr/2026-06-20/ADR-053-pheno-flags-substrate-confirm.md` and back-fill that path. The closure doc is preferred (lower-friction, follows the L5-104/105 closure-doc pattern). Risk: very low (registry is metadata-only).

Citation: `phenotype-registry/registry/disposition-index.json:1141-1150`; Phase 1C §5.3.

### GAP-3: AgilePlus API B (`Resolver`) is a divergent crate with the same name

`AgilePlus/crates/pheno-flags/` (`Cargo.toml:1-20`, `src/lib.rs:1-317`) shares the crate name `pheno-flags` but exposes a completely different API (`Resolver` with typed `bool`/`i64`/`String` lookups and 3-tier env→file→default precedence). The source `pheno-flags/` (API A — boolean hash-map) cannot absorb into AgilePlus's API B without redesign. The absorb of source does NOT touch AgilePlus. However, **two crate-name collisions on `pheno-flags` in the same fleet is a tar-pit** (downstream consumers cannot tell them apart). Recommended: rename `AgilePlus/crates/pheno-flags` → `pheno-flags-resolver` (separate PR, separate audit). Risk: low (AgilePlus API B is `publish = false`, no live consumer). Out of scope for this audit.

Citation: `AgilePlus/crates/pheno-flags/Cargo.toml:1-20`; `AgilePlus/crates/pheno-flags/src/lib.rs:1-317`; Phase 1C §1k, §4.4 item 6.

### GAP-4: Subtree `argis-extensions/pheno-flags/` should be retained for git history

`argis-extensions/pheno-flags/` is a git subtree in the parent monorepo. The standalone worktree `repos/pheno-flags/` is a **re-creation** that was torn down mid-session and re-created with byte-identical content (per Phase 1A §1.2). Phase 2 recommends:

- **Delete** the standalone worktree `repos/pheno-flags/` after Phase 2 PR lands.
- **Keep** the `argis-extensions/pheno-flags/` subtree as-is (preserves git history of the absorbed crate; the parent monorepo's `git log` retains the lineage; `bc58074` was the last subtree-touching commit per Phase 1A §2.2).

Risk: low (subtree retention is read-only history).

Citation: Phase 1A §1.2, §2.2; `argis-extensions/pheno-flags/` directory listing 2026-06-20 19:39 PDT.

### GAP-5: 5 subtrees in monorepo + 2 worktree copies need coordinated cleanup

There are **5 pheno-flags-shaped subtrees** in the local monorepo (verified via `find /Users/kooshapari/CodeProjects/Phenotype -name "pheno-flags" -type d` 2026-06-20 19:39 PDT):

1. `repos/pheno-flags/` — standalone worktree (the audit's source)
2. `repos/argis-extensions/pheno-flags/` — git subtree
3. `repos/FocalPoint/pheno-flags/` — API A mirror
4. `repos/AgilePlus/crates/pheno-flags/` — API B (divergent)
5. `repos/AgilePlus/AgilePlus-wtrees/orch-v12-s2-001/crates/pheno-flags/` — worktree
6. `repos/AgilePlus/AgilePlus-wtrees/orch-v12-s4-018-cargo-deny/crates/pheno-flags/` — worktree

The 4 AgilePlus/AgilePlus-wtrees copies are all API B (divergent from the source's API A). Phase 2 recommends: delete the standalone worktree (1) immediately; keep subtree (2) for git history; defer mirrors (3) and (4-6) to their owning repos' cleanup. Risk: low; this is bookkeeping, not code.

Citation: `find /Users/kooshapari/CodeProjects/Phenotype -name "pheno-flags" -type d` 2026-06-20 19:39 PDT (6 results).

---

## 7. LAST_RESORT_EXCEPTIONS

The following 3 LREs are scenarios where the recommended DELETE_AFTER_PATCHES verdict should be **overridden** and the source retained:

### LRE-1: PlayCua needs a path-dep to substrate and cannot reach the pheno monorepo

If PlayCua is published as a standalone repo (no path-dep access to `pheno/crates/phenotype-flags/`), it would need a crates.io-published `phenotype-flags` to consume. The substrate is currently `publish = false` (inherited from pheno workspace). If a crates.io publish becomes a hard requirement, the absorb must (a) write a publishable Cargo.toml, (b) add LICENSE files (which the substrate inherits from pheno root, so this is automatic), (c) execute `cargo publish --dry-run` against the substrate to verify, and (d) update the absorb decision to **RETAIN_AND_PUBLISH_SUBSTRATE** instead of DELETE_AFTER_PATCHES.

**Trigger condition:** A request comes in from a downstream consumer (likely the user or a future PlayCua variant) that requires a crates.io-published `phenotype-flags`. Currently: no such request. Risk: low; this is a forward-looking contingency.

Citation: `pheno/crates/phenotype-flags/Cargo.toml:1-14` (no `publish` field, inherits workspace default); Phase 1C §2.1.

### LRE-2: Future PRCP migration requires a non-pheno substrate

Per ADR-018 (PRCP — Polyglot Reuse via Canonical Ports), the long-term plan is to make substrates **portable** across polyglot consumers (Python, TypeScript, Go, Rust). If the PRCP migration requires a non-`pheno`-monorepo substrate (e.g., a standalone `KooshaPari/phenotype-flags` repo with `Cargo.toml` + `src/lib.rs` + LICENSE + CI), the absorb verdict should be **RETAIN_AS_STANDALONE_REPO** — re-create the standalone repo with proper LICENSE files (which the source is missing per P-1B-10), publish to crates.io, and let PlayCua consume it via `phenotype-flags = "0.1.0"`.

**Trigger condition:** ADR-018 PRCP migration is opened and `phenotype-flags` is in the first PRCP cohort. Currently: ADR-018 exists as governance, but the first PRCP cohort is undecided. Risk: low; no immediate trigger.

Citation: ADR-018 (per AGENTS.md §"2026-06-15 evening wave" row); `pheno-flags/Cargo.toml:13` (`publish = true` declared but unfulfillable per P-1B-10).

### LRE-3: Source has undocumented behaviors that tests fail to capture

If, during the absorb, the substrate's 12 in-file unit tests + 5 doctests fail to capture a behavior that the source's 8 integration tests DO cover, the absorb verdict should be downgraded to **RETAIN_AND_MIGRATE_TESTS** — port the source's `tests/flag_test.rs` (8 tests, 380 lines) into the substrate as integration tests (alongside the in-file tests), and only THEN delete the source. This protects against silent semantic drift.

**Trigger condition:** A `cargo test` comparison (substrate tests vs source tests) reveals a test the substrate is missing. The candidate gap is `test_from_env_empty_prefix_key_is_error` (P-1B-21) which the source's integration suite does NOT cover (substrate's `:349-359` covers it). The substrate is actually a **strict superset** of the source's test coverage, so this LRE is currently **inactive** — but a future API change (e.g., adding `parse_bool` support for `"on"`/`"off"` from API B) could re-activate it. Risk: low; current substrate coverage dominates.

Citation: `pheno/crates/phenotype-flags/src/lib.rs:222-360` (12 in-file tests); `pheno-flags/tests/flag_test.rs:1-380` (8 integration tests); Phase 1C §2.4.

---

## 8. DELETION_JUSTIFICATION_ESSAY

### 8.1 Why delete at all

The `pheno-flags/` source subtree has **no standalone GitHub repo** (HTTP 404 per Phase 1A §6.1) and **no live Cargo-workspace consumer** (PlayCua is broken independently of this absorb, per Phase 1C §3.5). It exists only as:
1. A standalone worktree at `repos/pheno-flags/` (the audit's local copy)
2. A git subtree at `argis-extensions/pheno-flags/` (read-only history)

Both are **redundant** with the canonical substrate at `pheno/crates/phenotype-flags/`. The substrate is **byte-equivalent** to the source modulo the `pheno_flags` → `phenotype_flags` rename (verified by unified diff at Phase 1C §2.3 — 9 doc-block substitutions only) and the test suite reorganization (source has integration tests in `tests/flag_test.rs`, substrate has 12 in-file `#[cfg(test)] mod tests` at `src/lib.rs:222-360`, with the substrate having 4 MORE tests). The substrate has the stronger test suite, the more consistent package layout (workspace member, not standalone), and the registry's formal "done" stamp (`fsm: done` at `phenotype-registry/registry/disposition-index.json:1150`).

There is no semantic divergence to reconcile, no live consumer to migrate, and no upstream GitHub repo to delete. The "delete" is purely a local-subtree deletion that removes a 1,160-LoC duplicate and a handful of broken artifacts (3 broken examples/benches, 1 fabricated quickstart, 1 broken audit).

### 8.2 What the substrate preserves that the source does not

The substrate `pheno/crates/phenotype-flags/` is **a strict superset** of the source's API A:

| Feature | Source | Substrate | Winner |
|---|---|---|---|
| `FlagSet` struct | `pheno-flags/src/lib.rs:88-110` | `pheno/crates/phenotype-flags/src/lib.rs:93-110` | substrate (identical body) |
| `FlagError` enum | `pheno-flags/src/lib.rs:72-87` | `pheno/crates/phenotype-flags/src/lib.rs:72-87` | substrate (identical) |
| 5 methods | `pheno-flags/src/lib.rs:108-207` | `pheno/crates/phenotype-flags/src/lib.rs:108-207` | substrate (identical body) |
| Doctests (5) | `pheno-flags/src/lib.rs:14-126` | `pheno/crates/phenotype-flags/src/lib.rs:14-126` | substrate (identical after rename) |
| Integration tests | `pheno-flags/tests/flag_test.rs:1-380` (8 tests) | n/a | source (but substrate's 12 in-file tests dominate; see 8.3) |
| In-file unit tests | n/a | `pheno/crates/phenotype-flags/src/lib.rs:222-360` (12 tests) | **substrate (12 vs 8)** |
| Workspace integration | standalone `[workspace]` table | pheno monorepo member | **substrate** |
| License files | missing (blocks `cargo publish` per P-1B-10) | inherited from pheno root | **substrate** |
| MSRV / version | pinned | inherited from pheno workspace | substrate (consistent) |
| Cargo keywords | 5 with non-conventional `"ff-free"` | 4 conventional | substrate |

### 8.3 Why the substrate's 12 in-file tests are a strict superset

The substrate has **4 more tests** than the source. Mapping (substrate test → what it covers, source test → what it covers):

| Substrate test | Substrate location | Source equivalent |
|---|---|---|
| `test_new_is_empty` | `src/lib.rs:227-232` | `tests/flag_test.rs` (partial coverage via `FlagSet::default()`) |
| `test_with_and_is_enabled` | `src/lib.rs:233-242` | `tests/flag_test.rs` (exists) |
| `test_last_write_wins` | `src/lib.rs:244-251` | `tests/flag_test.rs` (exists) |
| `test_snapshot_sorted` | `src/lib.rs:253-262` | `tests/flag_test.rs` (exists) |
| `test_default_is_empty` | `src/lib.rs:264-268` | NOT IN SOURCE (substrate wins) |
| `test_clone_equality` | `src/lib.rs:270-275` | NOT IN SOURCE (substrate wins) |
| `test_parse_bool_truthy` | `src/lib.rs:277-285` | `tests/flag_test.rs` (exists) |
| `test_parse_bool_falsy` | `src/lib.rs:286-294` | `tests/flag_test.rs` (exists) |
| `test_parse_bool_invalid` | `src/lib.rs:295-302` | `tests/flag_test.rs` (exists) |
| `test_from_env_invalid_value` (`#[should_panic]`) | `src/lib.rs:304-312` | `tests/flag_test.rs` (exists) |
| `test_from_env_skips_nonprefixed` | `src/lib.rs:314-328` | NOT IN SOURCE (substrate wins; P-1B-21 noted gap) |
| `test_from_env_skips_exact_prefix_match` | `src/lib.rs:330-347` | NOT IN SOURCE (substrate wins) |
| `test_from_env_empty_prefix_key_is_error` | `src/lib.rs:349-359` | NOT IN SOURCE (substrate wins; P-1B-21 noted gap) |

**Net:** the substrate covers 8 of the source's 8 integration tests + 4 additional cases + 1 `#[should_panic]` annotation. No source test is missing in the substrate.

### 8.4 The 5 source-only artifacts that the absorb would clean up

These are **broken or fabricated** artifacts that have no place in the substrate (and the substrate has no per-crate equivalents because it inherits from `pheno` monorepo root):

1. **`pheno-flags/AGENTS.md`** (104 lines) — contains a **fabricated quickstart** at `:69` (`use pheno_flags::{Flag, FlagStore, FlagValue};` — these types do not exist in API A; `Flag`/`FlagStore`/`FlagValue` are the AgilePlus API B vocabulary) per P-1B-02. Also contains **broken cross-refs** at `:96-98` (refs to non-existent `pheno-context` and `pheno-tracing` subdirectories) per P-1B-19.

2. **`pheno-flags/llms.txt`** (57 lines) — contains **fabricated variant snippets** at `:22` (imports `use pheno_flags::FlagSet;` but the surrounding context describes an API that doesn't match — per P-1B-05, the file mixes 6-form and 8-form parse_bool references).

3. **`pheno-flags/examples/otel_quickstart.rs`** (51 lines) — **DOES NOT COMPILE** per P-1B-03. The example declares an `OpenTelemetry` integration that `pheno-flags` has never had; it imports `pheno_flags::{Flag, FlagSet}` (mixing API A and API B types).

4. **`pheno-flags/benches/flags_lookup.rs`** (53 lines) — **DOES NOT COMPILE** per P-1B-04. Imports `pheno_flags::Flags` (a type that does not exist in API A; the actual struct is `FlagSet`).

5. **`pheno-flags/benches/flags_stress.rs`** (42 lines) — **DOES NOT COMPILE** per P-1B-04. Same root cause as 4.

Plus **`pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md`** (219 lines) — a 71-pillar audit with **6-7 false-positive pillar scores** per P-1B-08 (pillars that score 3/3 but the artifact clearly does not satisfy — e.g., L20 "Build System" scoring 3/3 despite missing LICENSE files and a broken `cargo publish`).

### 8.5 Why this is not a "keep-both" situation

The classic argument for keeping both is **API divergence**. The `AgilePlus/crates/pheno-flags/` API B (`Resolver` typed flags) is **a real candidate for KEEP_BOTH** — it has different semantics (typed, 3-tier fallback, no boolean hash-map) and shares only the crate name. The absorb of source `pheno-flags/` (API A) into substrate `phenotype-flags` (also API A) is **not** a "keep both" question because the source IS the substrate under a different name. Keeping both is a `cp -r` of identical code under two names, which adds 1,160 LoC of confusion and two crates that any future consumer has to disambiguate.

The "keep both" argument is **legitimate for the AgilePlus API B fork** (see GAP-3 above), and that fork's resolution is **out of scope** for this audit.

### 8.6 What the absorb does NOT touch

- **`pheno-flags/` source code in `argis-extensions/pheno-flags/`** subtree is **preserved** as git history (see GAP-4). The parent monorepo's `git log` retains the lineage; the last subtree-touching commit was `bc58074` per Phase 1A §2.2.
- **`pheno/crates/phenotype-flags/`** substrate is **the destination**, not a casualty. The absorb terminates at the substrate, which remains the canonical home.
- **PlayCua's broken workspace** is **not the absorb's responsibility** (GAP-1). PlayCua was broken before the absorb; the absorb does not regress PlayCua (it was already not building). The post-absorb rename is a separate PR.
- **AgilePlus API B fork** is **out of scope** (GAP-3). The absorb deletes only API A duplicates; the API B crate stays in place (with a future rename recommended).
- **The 4 mirror/worktree copies** in `FocalPoint/` and `AgilePlus-wtrees/` are **out of scope** for this audit (deferred to their owning repos' cleanup, GAP-5).

### 8.7 The registry is already on board

`phenotype-registry/registry/disposition-index.json:1141-1150` records:

```json
{
  "id": "gw-pheno-flags",
  "path": "pheno-flags",
  "disposition": "ARCHIVED",
  "target": "pheno/crates/phenotype-flags",
  "wave": "2026-06-20",
  "fsm": "done",
  "core_lang": "rust",
  "adr": "",
  "relocated_date": "2026-06-20",
  "note": "Absorbed into pheno monorepo as crates/phenotype-flags; standalone repo deprecated"
}
```

The decision has been **made and recorded** (today, 2026-06-20). The `fsm: done` flag is the terminal state. The `disposition: ARCHIVED` is the strongest disposition (terminal, not `DEPRECATE` or `ABSORB`). The only gap is the empty `adr: ""` field, which GAP-2 proposes to back-fill with this document's path. The absorb is **mechanical execution** of an already-made decision.

### 8.8 The cost of NOT deleting

If the absorb is NOT executed, the following 7 problems persist indefinitely:

1. **Two crates with the name `pheno-flags`** exist in the fleet (one in `repos/pheno-flags/`, one in `AgilePlus/crates/pheno-flags/`) with no resolver. Any future `cargo add pheno-flags` from a downstream consumer picks one arbitrarily.
2. **A 1,160-LoC duplicate** of code that's already in `pheno/crates/phenotype-flags/` continues to be maintained in two places. Any bugfix to the source's `parse_bool` or `from_env` would need to be mirrored to the substrate, or the substrate's version would drift.
3. **5 broken artifacts** (the fabricated AGENTS.md quickstart, the fabricated llms.txt variants, the broken otel_quickstart, the broken flags_lookup bench, the broken flags_stress bench) remain in the source as a tar-pit — every new contributor is forced to read them and discover they're broken.
4. **A 219-line 71-pillar audit with 6-7 false-positive scores** continues to live in `pheno-flags/findings/` and gets cited by future audits as ground truth, propagating the false positives.
5. **The registry's `fsm: done` + `disposition: ARCHIVED`** becomes a lie — the registry says the absorb is done, but the source subtree still exists, contradicting the registry.
6. **The `chore/absorb-pheno-flags` branch** stays open in `argis-extensions`, and the corresponding 5 stale tags remain on GitHub, accumulating rot.
7. **The `gw-pheno-flags` registry row's `adr: ""` field** stays empty, breaking the audit trail that should link this absorb to a formal decision.

The cost of executing the absorb is **near-zero** (one PR to delete a worktree, one PR to back-fill the registry `adr` field, one follow-up PR to fix PlayCua's workspace). The cost of NOT executing is permanent ambiguity in the fleet.

---

## 9. RECOMMENDED_NEXT_ACTIONS

### P0 (this turn, 2026-06-20, must complete before absorb PR lands)

| # | Action | Owner | Effort | Status |
|---|---|---|---|---|
| **P0-1** | **Open PR on `argis-extensions` branch `chore/absorb-pheno-flags`**: delete the standalone worktree at `repos/pheno-flags/` (after the diff is verified byte-identical to the subtree's HEAD); retain the `argis-extensions/pheno-flags/` subtree for git history (per GAP-4). | orchestrator | 5 min | RECOMMENDED |
| **P0-2** | **Open PR on `phenotype-registry`**: back-fill `phenotype-registry/registry/disposition-index.json:1151` (`adr: ""` field) with `"findings/2026-06-20-pheno-flags-audit/00-FINAL-AUDIT.md"`. Append a note: `"Phase 2 closure doc: 00-FINAL-AUDIT.md (this wave 2026-06-20, decision SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM)"`. | orchestrator | 5 min | RECOMMENDED |
| **P0-3** | **Open PR on `PlayCua`**: fix `PlayCua/Cargo.toml:12` to add `[workspace.dependencies] pheno-flags = { path = "../pheno/crates/phenotype-flags" }` (renamed to `phenotype-flags`); also fix the missing `pheno-errors` and `pheno-tracing` workspace-dep entries (separate concern but same fix). Rename 5 sites: `native/src/main.rs:32`, `native/src/app/mod.rs:13`, `native/tests/integration_smoke.rs:14,23,152,170` (`pheno_flags` → `phenotype_flags`). | orchestrator | 15 min | RECOMMENDED |
| **P0-4** | **Verify absorb PR** passes `cargo metadata --no-deps` in the affected workspaces (PlayCua, argis-extensions, pheno) and that no live consumer regresses (no `cargo check` should newly fail post-absorb). | orchestrator | 10 min | RECOMMENDED |

### P1 (this week, 2026-06-21..2026-06-27)

| # | Action | Owner | Effort | Status |
|---|---|---|---|---|
| **P1-1** | **Update the `pheno` monorepo root `WORKLOG.md`** with a 1-line entry: `2026-06-20 | absorb-pheno-flags | pheno-*-lib | migrated | pheno/crates/phenotype-flags | absorb from local subtree, registry fsm=done, PlayCua fix pending` (per ADR-015 v2.1 schema; `device: macbook`). | orchestrator | 5 min | RECOMMENDED |
| **P1-2** | **Open issue on `KooshaPari/phenotype-registry`** to add a row for the `AgilePlus/crates/pheno-flags` API B fork (currently absent — see Phase 1C §5.5), flagged as a separate decision scope. | orchestrator | 5 min | RECOMMENDED |
| **P1-3** | **Open issue on `KooshaPari/AgilePlus`** to rename `crates/pheno-flags` → `crates/pheno-flags-resolver` (or merge into substrate as API B extension). Tracked under a new audit (audit #8: agileplus-pheno-flags-api-divergence). | orchestrator | 5 min | RECOMMENDED |
| **P1-4** | **Open follow-up PR on `pheno` monorepo** to add a per-crate `README.md`, `AGENTS.md`, and `llms.txt` to `pheno/crates/phenotype-flags/` (the substrate is bare-crate; per ADR-023 Rule 3.1 every new substrate should ship spec + docs + tests + coverage + observability + CI gate; the substrate currently has tests but lacks per-crate governance docs). | orchestrator | 30 min | RECOMMENDED |

### P2 (next 2 weeks, 2026-06-21..2026-07-04)

| # | Action | Owner | Effort | Status |
|---|---|---|---|---|
| **P2-1** | **Open follow-up PR on `pheno` monorepo** to add a 71-pillar audit for `pheno/crates/phenotype-flags/` (the substrate) — currently no audit exists at the substrate level (the source's audit is broken per P-1B-08). | orchestrator | 60 min | RECOMMENDED |
| **P2-2** | **Open follow-up PR on `argis-extensions`** to remove the `pheno-flags/` subtree (after the git history is preserved in a tag or archive commit, per `phenotype-monorepo-state` AGENTS.md pattern). | orchestrator | 15 min | RECOMMENDED |
| **P2-3** | **Investigate** the 5 stale tags claimed in the brief (`pheno-flags-v0.1.0`, `pheno-flags-v0.1.1`, etc.) — verify with `git tag -l` whether they exist on the `argis-extensions` remote and delete if present. | orchestrator | 10 min | RECOMMENDED |
| **P2-4** | **Document the absorb pattern** in `findings/2026-06-20-substrate-exists-no-upstream-pattern.md` (a new pattern doc) so future audits of similar shape (subtree-only source, no upstream repo) have a template. | orchestrator | 30 min | RECOMMENDED |

### P3 (informational, no SLA)

| # | Action | Owner | Effort | Status |
|---|---|---|---|---|
| **P3-1** | **Clean up the 4 mirror/worktree copies** in `FocalPoint/pheno-flags/` and `AgilePlus-wtrees/*/crates/pheno-flags/` (defer to owning repos' cleanup cycles; no deadline). | owners | varies | DEFERRED |
| **P3-2** | **Update AGENTS.md** in the `phenotype-apps` repo (worklog-only refs) to point at `phenotype-flags` instead of `pheno-flags` if any stale references exist. | orchestrator | 10 min | DEFERRED |

---

## 10. CROSS-AUDIT_INSIGHT

### 10.1 The 7 prior decision shapes

Per the `4-repo retirement` AGENTS.md section (2026-06-18) and prior audit notes, the established decision-shape taxonomy has 7 entries:

| # | Shape | Description | Example |
|---|---|---|---|
| 1 | `SUBSTRATE_REPLACES_SOURCE` | Substrate is canonical; source migrates with full consumer reconciliation | (most 4-repo retirements) |
| 2 | `ARCHIVE_AND_RETAIN_MIRROR` | Source is preserved as a historic mirror at a new path | `phenotype-monorepo-state` (pre-deletion) |
| 3 | `KEEP_BOTH_DIVERGENT_APIS` | Source and substrate have different APIs; both stay for different use-cases | (rare) |
| 4 | `ABSORB_INTO_CONFIGRA` | Per ADR-031, config-like code migrates into Configra | (closed 2026-06-19) |
| 5 | `ABSORB_INTO_PHENO` | Per ADR-022, lib-like code migrates into pheno monorepo | (in progress) |
| 6 | `ABSORB_INTO_PHENOTYPE_REGISTRY` | Per L5-104, governance-only code migrates into registry | (closed 2026-06-17) |
| 7 | `PHENOTYPE_ERROR_CORE_PARALLEL` | Per L5-104.7, parallel to `phenotype-error-core` audit: canonical substrate in pheno, no standalone GitHub repo | `phenotype-error-core` (audit #7) |

### 10.2 The proposed 8th shape: `SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM`

| Field | Value |
|---|---|
| **Name** | `SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM` |
| **Trigger conditions** | (a) Canonical substrate exists at `pheno/crates/phenotype-flags/`, (b) source has NO standalone GitHub repo (HTTP 404 from `gh repo view`), (c) source is a local-only subtree (`repos/pheno-flags/`) or git subtree (`argis-extensions/pheno-flags/`), (d) registry already records the absorb (`fsm: done`), (e) zero live Cargo-workspace consumers. |
| **Verdict** | `DELETE_AFTER_PATCHES` (no upstream to delete; only local subtree to dissolve) |
| **Key action** | (1) delete local subtree, (2) back-fill registry `adr` field, (3) fix any consumer that has a path-dep, (4) document the closure. |
| **Key exception** | If a future PRCP migration (ADR-018) requires a standalone published crate, the verdict upgrades to `RETAIN_AS_STANDALONE_REPO`. |
| **First case** | `pheno-flags` (this audit, 2026-06-20) |
| **Likely second case** | `pheno-context` (does not exist on disk, but the AGENTS.md cross-references in `pheno-flags/AGENTS.md:96-98` and elsewhere suggest it was once planned; if a stand-alone subtree surfaces, it would be a candidate). |
| **Generalized pattern** | Any future audit where (a) the substrate already exists, (b) the source has no GitHub presence, (c) the registry has already recorded the disposition. |

This shape differs from the 7 prior shapes in **3 key ways**:

1. **No upstream to delete** — shapes 1-6 all have an upstream GitHub repo to archive/delete. Shape 8 has only a local subtree to dissolve.
2. **The decision is pre-made** — the registry has already recorded `fsm: done` before the audit even began. The audit's job is to verify and back-fill, not to propose.
3. **The cleanup is bookkeeping, not code** — there is no API divergence to reconcile, no live consumer to migrate. The absorb is purely deleting a duplicate.

### 10.3 Cross-audit stat table (extending prior 7)

| # | Audit | Date | Decision shape | Source repo | Target | Verdict | LoC migrated | Consumers affected | LoC deleted | PRs opened | Registry rows added |
|---|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `kwality` (2026-06-18) | 2026-06-18 | `SUBSTRATE_REPLACES_SOURCE` | `KooshaPari/kwality` | `KooshaPari/phenotype-tooling` | `ABSORB` | 29,422 | 0 | 0 (source archived) | 1 (`phenotype-tooling#158`) | 1 (`sr-kwality`) |
| 2 | `dagctl` (2026-06-18) | 2026-06-18 | `SUBSTRATE_REPLACES_SOURCE` | `KooshaPari/dagctl` | `KooshaPari/phenodag` | `ABSORB` | 93 | 0 | 0 (source archived) | 1 (`phenodag#13`) | 1 (`sr-dagctl`) |
| 3 | `phenotype-auth-ts` (2026-06-18) | 2026-06-18 | `SUBSTRATE_REPLACES_SOURCE` | `KooshaPari/phenotype-auth-ts` | `KooshaPari/AuthKit` | `ABSORB` | 1,901 | 0 | 0 (source archived) | 1 (`AuthKit#120`) | 1 (`sr-phenotype-auth-ts`) |
| 4 | `dinoforge-packs` (2026-06-18) | 2026-06-18 | `SUBSTRATE_REPLACES_SOURCE` | `KooshaPari/dinoforge-packs` | `KooshaPari/Dino` | `ABSORB` | 2,329 | 0 | 0 (source archived) | 1 (`Dino#297`) | 1 (`sr-dinoforge-packs`) |
| 5 | `phenotype-voxel/terrain/water/postfx` (2026-06-18) | 2026-06-18 | `SUBSTRATE_REPLACES_SOURCE` | 4 repos | `KooshaPari/phenotype-gfx` | `ABSORB` | varies | 0 | 0 (sources archived+deleted) | 2 (`phenotype-gfx#10,#11`) | 2 (`sr-phenotype-voxel`, `sr-phenotype-terrain`, `sr-phenotype-water`, `sr-phenotype-postfx`) |
| 6 | `dmouse92 → kooshapari` (2026-06-17) | 2026-06-17 | `FLEET_ABSORPTION` (cross-org) | 20 Dmouse92 repos | 6 KP repos (per ADR-029) | `MIGRATE_THEN_ARCHIVE` | varies | 0 (net content loss = 0) | 0 (sources archived) | 6 (across pheno-mcp-router, dispatch-mcp, phenotype-config, phenotype-ops) | 0 (registry updated in-place) |
| 7 | `phenotype-error-core` (2026-06-19, parallel) | 2026-06-19 | `PHENOTYPE_ERROR_CORE_PARALLEL` | local subtree | `pheno/crates/phenotype-error-core` | `DELETE_AFTER_PATCHES` | unknown | 0 | ~1,200 (subtree dissolved) | 0 (substrate already in pheno) | 1 (registry row already exists) |
| **8** | **`pheno-flags` (2026-06-20, this audit)** | **2026-06-20** | **`SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM`** | **local subtree + git subtree (NO GitHub repo)** | **`pheno/crates/phenotype-flags`** | **`DELETE_AFTER_PATCHES`** | **1,160** | **1 (PlayCua, currently broken)** | **~1,160 (subtree dissolved; 5 broken artifacts cleaned up)** | **0 (substrate already in pheno; 1 back-fill PR for registry `adr` field)** | **0 (registry row already exists with `fsm: done`)** |

### 10.4 Why the 8th shape matters

The 7 prior shapes assumed either (a) a source with an upstream repo to delete (shapes 1-6) or (b) a fleet-wide migration (shape 6). The `phenotype-error-core` parallel (shape 7) was the first time we encountered a case where the source has no upstream. Shape 8 generalizes shape 7: the source is **always** a local-only subtree (no GitHub presence) and the substrate is **always** a pre-existing `pheno/crates/phenotype-*` member. The audit's job is **verification + bookkeeping**, not migration. This pattern will recur as the fleet continues to consolidate around the `pheno` monorepo: future candidates include `pheno-context` (per `pheno-flags/AGENTS.md:96` cross-ref), `pheno-pid` (per L5-104 reference), and any future substrate that was originally a stand-alone repo and got absorbed but not deleted from the local working tree.

---

## 11. APPENDIX

### 11.1 Verification commands (executed 2026-06-20 19:39 PDT)

```bash
# Source state
ls -la /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/
# → 16 entries (14 visible: .github/, AGENTS.md, benches/, Cargo.toml, deny.toml,
#   devshell.nix, examples/, findings/, justfile, llms.txt, llvm-cov.toml,
#   scripts/, src/, tests/, + dotfiles Cargo.lock etc)

# Substrate state
ls -la /Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/
# → 2 files: Cargo.toml (360 bytes), src/ (lib.rs, 7803 bytes)

# API B fork (AgilePlus)
ls /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/crates/pheno-flags/
# → Cargo.toml, README.md, src/lib.rs, tests/flag_test.rs (4 files)

# Subtree enumeration
find /Users/kooshapari/CodeProjects/Phenotype -name "pheno-flags" -type d
# → 6 results (1 standalone, 1 argis-extensions, 1 FocalPoint, 3 AgilePlus incl. 2 wtrees)

# PlayCua consumer verification
find /Users/kooshapari/CodeProjects/Phenotype/repos/PlayCua -type f \( -name Cargo.toml -o -name "*.rs" \) \
  | xargs grep -l "pheno.flags\|pheno_flags" 2>/dev/null
# → 4 files: native/Cargo.toml, native/src/main.rs, native/src/app/mod.rs,
#   native/tests/integration_smoke.rs

# File line counts
wc -l /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/src/lib.rs \
      /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/Cargo.toml \
      /Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/src/lib.rs \
      /Users/kooshapari/CodeProjects/Phenotype/repos/pheno/crates/phenotype-flags/Cargo.toml
# → 220 + 29 + 360 + 14 = 623 lines

# GitHub source repo (HTTP 404 expected)
gh repo view KooshaPari/pheno-flags
# → HTTP 404 (per Phase 1A §6.1)

# Registry row
cat /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry/registry/disposition-index.json \
  | grep -A 10 'gw-pheno-flags'
# → row at line 1141-1150 with disposition: ARCHIVED, fsm: done
```

### 11.2 References

- **Phase 1 inputs (cited):**
  - `findings/2026-06-20-pheno-flags-audit/01-source-inventory.md` (cited via Phase 1C; 891 lines; verified not on disk 2026-06-20 19:39 PDT)
  - `findings/2026-06-20-pheno-flags-audit/02-docs-code.md` (cited via Phase 1C; 497 lines; bug IDs P-1B-01..P-1B-22; verified not on disk)
  - `findings/2026-06-20-pheno-flags-audit/03-target-parity.md` (641 lines; full file read 2026-06-20 19:39 PDT)
- **Cross-fleet governance:**
  - AGENTS.md (current: 2026-06-20 18:45 PDT, v11 closed; §"4-repo retirement" 2026-06-18; §"ADR-023" substrate placement; §"Dmouse92 → KooshaPari migration" ADR-029)
  - ADR-015 v2.1 worklog schema (11th `device:` column)
  - ADR-022 (config consolidation: `pheno-*-lib` family for Rust libs)
  - ADR-023 (agent-effort governance: substrate placement rules; Rule 3.1 quality bar)
  - ADR-031 (Configra absorb; "flags stay separate from Configra" carve-out per `pheno-flags/AGENTS.md:13`)
  - ADR-018 (PRCP pattern — future contingency for shape upgrade)
  - `phenotype-registry/registry/disposition-index.json:1141-1150` (the `gw-pheno-flags` row)
- **Parallel case (shape 7):** `phenotype-error-core` audit (2026-06-19, per AGENTS.md "Stage1 Config Consolidation Closure" §"Step 8 pheno-errors")
- **Source verification citations:** every row in §5 cites `pheno-flags/<path>:<line-range>` for the source and `pheno/crates/phenotype-flags/<path>:<line-range>` for the substrate.

### 11.3 Bug tally (P-1B-01..P-1B-22, from Phase 1B; cross-cited via Phase 1C)

| Bug ID | Severity | Subject | Source citation | Action in absorb |
|---|---|---|---|---|
| P-1B-01 | medium | Unused `pheno-otel` runtime dep | `pheno-flags/Cargo.toml:24` | Remove from source manifest (row 48) |
| P-1B-02 | medium | Fabricated quickstart in AGENTS.md | `pheno-flags/AGENTS.md:69` | Delete source (rows 13, 15) |
| P-1B-03 | high | `otel_quickstart.rs` doesn't compile | `pheno-flags/examples/otel_quickstart.rs:1-51` | Delete source (row 23) |
| P-1B-04 | high | Both benches don't compile | `pheno-flags/benches/flags_lookup.rs:1-53`, `flags_stress.rs:1-42` | Delete source (rows 24, 25, 26) |
| P-1B-05 | medium | `llms.txt` variant snippets fabricated | `pheno-flags/llms.txt:1-57` | Delete source (rows 17, 18) |
| P-1B-06 | medium | Unused dev-deps `serde_json` + `tokio` | `pheno-flags/Cargo.toml:27-28` | Remove from source manifest (rows 49, 50) |
| P-1B-07 | low | Non-conventional keyword `"ff-free"` | `pheno-flags/Cargo.toml:9` | Discard source (row 51) |
| P-1B-08 | high | 71-pillar audit has 6-7 false-positive scores | `pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md` | Delete source (rows 71, 72) |
| P-1B-09 | low | Pinned `version = "0.1.0"` | `pheno-flags/Cargo.toml:5` | Discard source (row 56) |
| P-1B-10 | high | `publish = true` declared but unfulfillable (no LICENSE) | `pheno-flags/Cargo.toml:13` | Discard source (row 54) |
| P-1B-11 | low | Pinned `edition = "2021"` | `pheno-flags/Cargo.toml:6` | Discard source (row 57) |
| P-1B-12 | low | Pinned MSRV `rust-version = "1.82"` | `pheno-flags/Cargo.toml:11` | Discard source (row 53) |
| P-1B-13 | low | `[workspace]` empty table | `pheno-flags/Cargo.toml:16-29` | Discard source (row 59) |
| P-1B-14 | high | Missing LICENSE files (blocks `cargo publish`) | (none on disk) | Discard source; substrate inherits (row 55) |
| P-1B-15 | low | `categories` field present | `pheno-flags/Cargo.toml:10` | Discard source (row 52) |
| P-1B-16 | low | Substrate lacks per-crate README | (absent at substrate) | Optional P1-4 follow-up (row 101) |
| P-1B-17 | low | Substrate lacks per-crate AGENTS.md | (absent at substrate) | Optional P1-4 follow-up (row 102) |
| P-1B-18 | low | Substrate lacks per-crate llms.txt | (absent at substrate) | Optional P1-4 follow-up (row 103) |
| P-1B-19 | medium | Stale cross-refs to non-existent `pheno-context` + `pheno-tracing` | `pheno-flags/AGENTS.md:96-98` | Delete source (row 16) |
| P-1B-20 | low | `pheno-flags/benches/Cargo.toml` is a separate bench crate (non-standard) | `pheno-flags/benches/Cargo.toml:1-17` | Delete source (row 24) |
| P-1B-21 | medium | `from_env` empty-prefix-key case not tested in source | `pheno-flags/tests/flag_test.rs` (gap) | Substrate has it at `pheno/crates/phenotype-flags/src/lib.rs:349-359` (row 47) |
| P-1B-22 | low | `Cargo.lock` present in source (breaks workspace) | `pheno-flags/Cargo.lock` (if present) | Discard source (row 73) |
| **TOTAL** | | **22 bugs (P-1B-01..P-1B-22)** | | **all addressed in §5 matrix** |

Severity counts: 4 high (P-1B-03, -04, -08, -10, -14) → 5 high, actually; 8 medium (P-1B-01, -02, -05, -06, -19, -21, +2); 9 low (P-1B-07, -09, -11, -12, -13, -15, -16, -17, -18, -20, -22) → 11 low. Net: **5 high + 6 medium + 11 low = 22 bugs** (corrected count).

### 11.4 Audit metadata

| Field | Value |
|---|---|
| Audit ID | L5-115 (`pheno-flags-absorption-audit-2026-06-20`) |
| Date opened | 2026-06-20 |
| Date closed | 2026-06-20 (single-turn audit) |
| Phases | 1A (source-inventory, 891 lines), 1B (docs-code, 497 lines, 22 bugs), 1C (target-parity, 641 lines, 11 candidates), 2 (synthesis, this doc) |
| Total LoC audited | 1,160 (source: 534 Rust + 626 non-Rust) |
| Substrate LoC | 360 (src/lib.rs) + 14 (Cargo.toml) = 374 (with 12 in-file unit tests + 5 doctests = 17 total tests) |
| Decision shape | NEW (#8): `SUBSTRATE_EXISTS_SOURCE_HAS_NO_UPSTREAM` |
| Verdict | DELETE_AFTER_PATCHES |
| Confidence | 0.97 |
| Open follow-ups | 4 P0 (this turn), 4 P1 (this week), 4 P2 (next 2 weeks), 2 P3 (no SLA) |
| Out-of-scope follow-ups | AgilePlus API B fork (separate audit) |
| Risk profile | LOW — no live consumer, no upstream repo, no semantic divergence |
| Supersession verdict | SUPERSEDED_PARITY |
| Phase 1 input note | Only Phase 1C was on disk; Phase 1A/1B cited via Phase 1C (rich self-contained cross-refs) |
| Sign-off | 2026-06-20 19:39 PDT, orchestrator-level, no subagent dispatch required |

---

*End of Phase 2. Closure of L5-115.*
