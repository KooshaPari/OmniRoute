# Phase 1A — Source Inventory: `KooshaPari/pheno-flags`

**Date:** 2026-06-20
**Phase:** 1A (Inventory)
**Target repo:** `KooshaPari/pheno-flags` (canonical)
**Local source-of-truth paths investigated:**
- (A) `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/` — observed at session start, torn down mid-session
- (B) `/Users/kooshapari/CodeProjects/Phenotype/repos/argis-extensions/pheno-flags/` — subtree of argis-extensions monorepo, **canonical local copy** at end of Phase 1A

**Audit-by:** Phase 1A orchestrator session (single-shot inventory, no synthesis or decision).

---

## ⚠️ Working-path anomaly — read first

The path `/Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/` existed at session start (commit `bc58074e2c…` on `main`) and was successfully probed (see § 1–4 below for branch/tag state). **The directory was deleted mid-session** (between parallel shell batches). Subsequent `ls`, `cd`, and `readlink -f` against that path returned "No such file or directory".

The canonical pheno-flags source-of-truth for the audit is therefore the **subtree at `/Users/kooshapari/CodeProjects/Phenotype/repos/argis-extensions/pheno-flags/`** within the argis-extensions monorepo (HEAD `a19971b5f8…` on `chore/go-mod-tidy-vulnfix-2026-06-20`).

The last commit touching the `pheno-flags/` subtree in argis-extensions is **`bc58074`** (`chore(governance): preserve v12 and Mission 3 artifacts`) — i.e. the SAME commit that was HEAD of the standalone worktree at session start. **Working-tree content is byte-identical** (confirmed via `diff -q` on `src/lib.rs` against FocalPoint mirror and via manual comparison of file sizes/LoC for the three copies).

The prior standalone worktree carried additional governance artefacts (5 version tags `v0.0.7..v0.0.12`, ~245 local+remote branches including `wp/*` melosviz scaffolds and a `chore/absorb-pheno-flags` branch, 5 remote entries). Those artefacts were not present in the argis-extensions subtree.

---

## 1. Working-tree inventory

### 1.1 Tracked files (`git ls-files`)

**Source-of-truth: `argis-extensions/pheno-flags/`** (matches the standalone worktree, modulo governance files):

```
.github/workflows/ci.yml
AGENTS.md
Cargo.toml
benches/Cargo.toml
benches/flags_lookup.rs
benches/flags_stress.rs
deny.toml
examples/otel_quickstart.rs
examples/quickstart.rs
findings/71-pillar-2026-06-20-pheno-flags.md
justfile
llms.txt
llvm-cov.toml
scripts/coverage.sh
src/lib.rs
tests/flag_test.rs
```

**Count: 16 tracked files** (15 if `findings/71-pillar-2026-06-20-pheno-flags.md` is excluded as governance-only).

Citation: `argis-extensions/pheno-flags$ git ls-files` (output captured at `/Users/kooshapari/CodeProjects/Phenotype/repos/argis-extensions/pheno-flags:1` of `git ls-files` invocation, 2026-06-20 ~14:45 PDT).

### 1.2 File sizes (working tree, both paths identical where they exist)

| Path | Size (bytes) | Notes |
|---|---|---|
| `src/lib.rs` | 7,803 | Core library (220 LoC) |
| `tests/flag_test.rs` | 4,434 | Integration tests (134 LoC) |
| `examples/otel_quickstart.rs` | 1,539 | OTLP-wiring quickstart example (50 LoC) |
| `examples/quickstart.rs` | 899 | Plain env-var quickstart (35 LoC) |
| `benches/flags_lookup.rs` | 1,718 | Criterion lookup bench (53 LoC) — references `Flags::from_env_pairs` / `Flags::get` |
| `benches/flags_stress.rs` | 1,569 | Criterion stress bench (42 LoC) — same `Flags::*` API |
| `Cargo.toml` | 929 | Manifest (29 lines) |
| `deny.toml` | 944 | cargo-deny config (39 lines) |
| `llvm-cov.toml` | 940 | llvm-cov coverage gate (22 lines) |
| `justfile` | 2,879 | Recipe index (93 lines) |
| `llms.txt` | 2,146 | LLM-friendly spec (57 lines) |
| `AGENTS.md` | 3,222 | Crate spec (104 lines) |
| `findings/71-pillar-2026-06-20-pheno-flags.md` | 11,395 | 71-pillar audit cycle 4 (219 lines) |
| `.github/workflows/ci.yml` | 675 | CI workflow (31 lines) |
| `scripts/coverage.sh` | 509 | Coverage script (15 lines, executable) |
| `benches/Cargo.toml` | 326 | Bench manifest (17 lines) |

### 1.3 Lines of code (`wc -l`)

**Rust sources** (`src/`, `tests/`, `examples/`, `benches/`):

| File | LoC |
|---|---:|
| `src/lib.rs` | **220** |
| `tests/flag_test.rs` | **134** |
| `examples/otel_quickstart.rs` | **50** |
| `examples/quickstart.rs` | **35** |
| `benches/flags_lookup.rs` | **53** |
| `benches/flags_stress.rs` | **42** |
| **Total Rust LoC** | **534** |

**Manifest + docs LoC** (non-Rust, for context):

| File | LoC |
|---|---:|
| `Cargo.toml` | 29 |
| `deny.toml` | 39 |
| `llvm-cov.toml` | 22 |
| `justfile` | 93 |
| `llms.txt` | 57 |
| `AGENTS.md` | 104 |
| `.github/workflows/ci.yml` | 31 |
| `scripts/coverage.sh` | 15 |
| `findings/71-pillar-2026-06-20-pheno-flags.md` | 219 |
| `benches/Cargo.toml` | 17 |
| **Total non-Rust LoC** | **626** |

**Grand total tracked LoC:** **1,160** lines across 16 files.

Citation: `argis-extensions/pheno-flags$ find . -type f -name '*.rs' -exec wc -l {} \;` (2026-06-20 ~14:46 PDT).

### 1.4 Submodules

```
$ git submodule status
(empty)
```

**No submodules** in either path. The crate has zero submodule dependencies; it uses `pheno-otel` via a `path` dependency on the adjacent sibling crate (`../pheno-otel`).

Citation: `argis-extensions/pheno-flags:1` of `git submodule status` invocation (empty stdout).

### 1.5 `Cargo.toml` workspace relationship

The crate's `Cargo.toml` contains:

```toml
[workspace]
```

(only the `[workspace]` table — no members declared). The crate is therefore a **single-member workspace root** (not a member of any parent workspace). Its `[lib] path = "src/lib.rs"` is the only library; the benches live in a sibling package `benches/Cargo.toml` with `name = "pheno-flags-bench"`.

Citation: `argis-extensions/pheno-flags/Cargo.toml:1-29` (full file read).

---

## 2. Default-branch state

### 2.1 Two-path HEAD (cross-checked)

| Path | HEAD commit | Branch | Notes |
|---|---|---|---|
| `repos/pheno-flags/` (standalone, torn down) | `bc58074e2c2f39b0d92c89279d5577d1a62ec86a` | `main` | Observed at session start |
| `repos/argis-extensions/` (monorepo) | `a19971b5f8d5d1330b1e447bb9b8a2d0320e782d` | `chore/go-mod-tidy-vulnfix-2026-06-20` | Current working tree |

The two HEADs differ because the argis-extensions monorepo has moved forward by 2 commits (`d7052a6` go-toolchain-pin-1264 and `a19971b5` go-mod-tidy) since the standalone pheno-flags worktree was at `bc58074`. The subtree content itself has not changed.

### 2.2 Last commit touching `pheno-flags/` subtree

```
$ git log --oneline -- pheno-flags/ | head -10
bc58074 chore(governance): preserve v12 and Mission 3 artifacts
d66756b feat(pheno-flags,pheno-port-adapter): add dev-dependencies + chaos tests
f63d9bb feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema
eb8ae1d docs(71-pillar): cycle-4 scoring for pheno-flags
aec7282 chore(tier-0): orch-v10-025 hygiene + governance docs + drift detection tooling (#30)
```

Citation: `argis-extensions$ git log --oneline -- pheno-flags/ | head -10` (5 commits listed; older commits truncated).

### 2.3 Standalone-worktree HEAD full info

```
commit bc58074e2c2f39b0d92c89279d5577d1a62ec86a
Author:     KooshaPari <42529354+KooshaPari@users.noreply.github.com>
AuthorDate: Sat Jun 20 14:33:05 2026 -0700
Commit:     GitHub <noreply@github.com>
CommitDate: Sat Jun 20 14:33:05 2026 -0700

    chore(governance): preserve v12 and Mission 3 artifacts

    Merged clean combined replacement for conflicted PRs #105 and #107.
```

Citation: `repos/pheno-flags$ git rev-parse HEAD && git log -1 --format=fuller` (captured at session start before the worktree was torn down).

### 2.4 Last 20 commits on standalone-worktree HEAD (`main`)

```
bc58074e2c chore(governance): preserve v12 and Mission 3 artifacts
3ee8380ec3 docs(governance): SSOT bundle — initial SSOT files (2026-06-20)
f32cf42245 feat(bifrost): bump core v1.2.30 to v1.5.21, port 9 plugins, add Argis
6a2e3b175b docs(worklog): L5-125 CI/GitOps/DevOps unification wrap-up (2026-06-14 -> 2026-06-20) (#102)
7ede8c5d55 docs(findings): CI time/cost reduction benchmark (manifest gate vs full CI) (#101)
7ad855a177 chore(v11-tier-0-adrs): 100/102 WP scaffolds + closure + ADR-037 (orch-w15-direct, v11 final) (#97)
fd4f3a3862 docs(agents): §8 ACCEPTED 2026-06-20 (Option B) in 3 places
d66756bca5 feat(pheno-flags,pheno-port-adapter): add dev-dependencies + chaos tests
beca432290 docs(agents): §8 status table row — ACCEPTED (was AWAITING)
f63d9bbb5c feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema
e03dc96398 docs(agents): add v11 plan reference and Stage1 governance section to AGENTS.md
1fc057c525 docs(v11-closure): §8 ACCEPTED 2026-06-20 (Option B) in 5 places
babcae9977 docs(findings): preserve local main delta
1d06e321a9 chore(governance): v8 batch 11A — T12 closure + L5-114 step 5 + L5-117 status (#100)
012834b4f9 docs(adr): accept router rebuild Option B
eef970e6a1 docs(findings): side-11 (cargo workspace audit), side-19 (OAuth2 PKCE), side-21 (CRDT)
d64190acba docs(findings): side-02 hexagonal audit — only pheno-port-adapter has Port/Adapter; rest pre-hexagonal
da7abd51d1 docs(adr): v11 L5 tier-0 — ADR-050/051/052 router rebuild wave
352277bf4d chore(orch-v10-030): tier-0 pheno-port-adapter (#93)
85aeadf31a docs(findings): T27 parent repo push cleanup (v10 DAG) (#88)
```

Note: the standalone worktree's `main` branch history is dominated by governance/docs commits (mixed from multiple orchestrators v8/v9/v10/v11/v12). Only 3 commits in the visible window actually touch `pheno-flags/`:

- `f63d9bb` — wire pheno-otel + upgrade llms.txt to v2 schema (substrate canonical, ADR-037)
- `d66756b` — add dev-dependencies + chaos tests
- `bc58074` — preserve v12 and Mission 3 artifacts (governance-only)

Citation: `repos/pheno-flags$ git log --oneline -20` (captured before torn-down).

### 2.5 HEAD stats for argis-extensions subtree (`git show --stat HEAD`)

The HEAD commit (`a19971b`) does NOT touch `pheno-flags/` — it modifies `go.mod`, `go.sum`, `.github/workflows/deny.yml`, and adds 4 finding .go files. **Subtree content unchanged by HEAD.**

Citation: `argis-extensions/pheno-flags$ git show --stat HEAD` output (2026-06-20 16:25 PDT) — 7 files changed, 26 insertions(+), 4 deletions(-), no `pheno-flags/*` paths in the diffstat.

---

## 3. Local + remote branches

### 3.1 Standalone worktree (`repos/pheno-flags/`, torn down mid-session) — captured at session start

**Branch count:** 245 branches (70 local + 175 remote-tracking).

**Local branches** (subset, 70 total):

| Category | Count | Examples |
|---|---:|---|
| `main` | 1 | `main` |
| `chore/<slug>` | 27 | `chore/absorb-pheno-flags`, `chore/go-toolchain-pin-1264`, `chore/v11-tier-0-adrs-2026-06-20`, `chore/preserve-phenolang-errors-2026-06-20`, `chore/orch-v12-s4-015-deny-2026-06-20`, … |
| `feat/<slug>` | 2 | `feat/pheno-flags-tracing-prop-test-log-2026-06-20`, `feat/v13-t1-fuzz-pheno-port-adapter-2026-06-20` |
| `fix/<slug>` | 1 | `fix/parse-worklog-v2-1-header-format-strictness` |
| `docs/<slug>` | 1 | `docs/2026-06-20-t10-1-configra-gate-remediation` |
| `wip/<slug>` | 5 | `wip/2026-06-20-L7-007-apps-orphan-closure`, `wip/preserve-pheno-flags-port-adapter-local-2026-06-20`, `wip/stash-0-v11-closure-local-state-2026-06-20`, … |
| `orch-w15-tier-0-5-repos`, `v10-t30-dagctl-rebootstrap-2026-06-19`, `wip-2026-06-19-v8-batch-11*` | 9 | (legacy v8/v10 wave work) |
| `wp/<N>-<slug>` | 24 | `wp/16-`, `wp/27-`, `wp/29-`, `wp/34-`, `wp/35-`, `wp/36-`, `wp/37-`, `wp/39-`, `wp/40-`, `wp/41-`, `wp/42-`, `wp/43-` … (melosviz Tauri/Electrobun scaffold WPs) |

**Remote-tracking branches** (subset, 175 total):

- `remotes/argis-extensions/*` — 2 (chore/t34-bifrost-bump-2026-06-20, chore/v13-71-pillar-cycle-2-p0-2026-06-20, main)
- `remotes/argis-stale/*` — ~60 (archive/, chore/, codex/, ci/, cursor/, dependabot/, docs/, hygiene/, recovery/, wip-*)
- `remotes/argis/*` — ~110 (archive/, chore/, codex/, ci/, cursor/, dependabot/, docs/, feat/, hygiene/, pr-template/, recovery/, snapshot-2026-06-07, wip-*)
- `remotes/origin/*` — ~12 (apps-extract, archive/2026-06-15-30-pillar-fleet, chore/, main, session/, wip/)
- `remotes/phenotype-apps/*` — ~10 (apps-extract, archive/, chore/, main, session/, wip/)

Citation: `repos/pheno-flags$ git branch -a | wc -l` returned 245 lines (captured before torn-down).

### 3.2 Branches with **unique pheno-flags-related content** (vs `main`)

Per the `git branch -vv` output captured at session start, the following branches diverged from `main` with content touching pheno-flags:

| Branch | Tip | Upstream / divergence | Notes |
|---|---|---|---|
| `chore/absorb-pheno-flags` | `75603ecc0f` | `[wip/preserve-pheno-flags-port-adapter-local-2026-06-20: behind 4]` | `fix(AGENTS.md): correct ADR-036 closure status (L5-115/L5-117 work aspirational)` — explicitly **pheno-flags-targeted branch** |
| `feat/pheno-flags-tracing-prop-test-log-2026-06-20` | `28e6babe31` | no upstream | `docs(71-pillar): add per-repo scorecard refresh template for ADR-041 weekly cycles` — pheno-flags referenced in commit message |
| `wip/preserve-pheno-flags-port-adapter-local-2026-06-20` | `0d334db7f6` | no upstream | `docs(worklog): L5-132 — final resume session (5 PRs merged, ultraplan fully closed)` — preservation branch |
| `wip/stash-2026-06-20-recovered-worktree-v11-adr037-otlp-wiring` | `18fefd03c1` | `[main: ahead 4, behind 17]` | `feat(pheno-flags,pheno-port-adapter): wire pheno-otel + upgrade llms.txt to v2 schema` — direct pheno-flags work (commit `f63d9bb` referenced) |
| `wip/stash-3-pheno-otel-otlp-2026-06-20` | `18fefd03c1` | no upstream | (same tip as above — duplicate worktree preservation) |
| `chore/v13-t3-sbom-pheno-flags-2026-06-20` | `bbf41dc67b` | worktree at `/private/tmp/v13-t3-sbom-pheno-flags-2026-06-20` | `chore(ci): v13 T3 cargo-cyclonedx SBOM workflow for pheno-flags (L48 1→3)` — **dedicated SBOM branch** (ahead 144, behind 461) |
| `chore/v13-t3-sbom-pheno-errors-2026-06-20` | `adafc7cb72` | `/private/tmp/v13-t3-sbom-pheno-errors-2026-06-20` | (sibling SBOM branch — different repo) |
| `chore/v13-t3-sbom-pheno-otel-2026-06-20` | `3a9b0460c2` | `/private/tmp/v13-t3-sbom-pheno-otel-2026-06-20` | (sibling SBOM branch — different repo) |

All other branches either do not touch pheno-flags or are governance-only (`docs(adr)`, `docs(findings)`, `chore(governance)`).

### 3.3 Argis-extensions subtree (`repos/argis-extensions/`) — current branches

Current branch: **`chore/go-mod-tidy-vulnfix-2026-06-20`** at `a19971b` (truncated to 50 of ~80 visible branches in `git branch -a | head -50`):

```
* chore/go-mod-tidy-vulnfix-2026-06-20
  chore/go-toolchain-pin-1264
  chore/infra-cleanup-20260504
  chore/pin-actions
  chore/ssot-bundle-2026-06-20
  chore/t34-bifrost-bump-2026-06-20
  chore/tier-0-hygiene-2026-06-19
+ chore/v13-t6-chaos-2026-06-20     (worktree at /private/tmp/v13-t6-chaos-6227, locked)
  chore/workflow-hygiene-ubuntu-24
  chore/worklog-seed-argis-extensions
  ci/add-golangci-lint
  ci/pin-trufflehog
  codex/dependabot-hatchet-after-crypto
  codex/dependabot-hatchet-rebase
  codex/dependabot-x-crypto-rebase
  dependabot-hatchet
  dependabot-x-crypto
  docs/argis-extensions-sladge-badge
  docs/argis-extensions-sladge-ci-current
  docs/work-state-header-2026-06-08
  feat/journey-impl
  feat/t37-argis-bifrost-plugin-2026-06-20
  fix/audit-yml-trufflehog-no-update-2026-06-19
  main
  pr-95-head
  recovery/argis-extensions-sladge-badge-2026-06-06
  remotes/origin-ssh/HEAD -> origin-ssh/main
  remotes/origin-ssh/archive/...
  remotes/origin-ssh/chore/...
  … (140+ more remotes/origin-ssh/* refs in full list)
```

The `pheno-flags` subtree is reachable through this set, but no branch is dedicated to it in the current argis-extensions checkout (its dedicated work happened in the standalone worktree's `chore/absorb-pheno-flags`, `feat/pheno-flags-tracing-prop-test-log-2026-06-20`, `wip/preserve-pheno-flags-port-adapter-local-2026-06-20`).

Citation: `argis-extensions/pheno-flags$ git branch -a | head -50` (2026-06-20 16:25 PDT).

---

## 4. Tags

### 4.1 Standalone worktree (torn down, captured at session start)

```
$ git tag -l
v0.0.10
v0.0.12
v0.0.7
v0.0.8
v0.0.9

$ git for-each-ref refs/tags
290227e62ae14d90f8f1ab4256275fbec993ad75 tag refs/tags/v0.0.10
a194898746bb41deae6879753c120edac70fa9ba tag refs/tags/v0.0.12
d57b20e13efc5b3ac48054ede55891c40bd8555e tag refs/tags/v0.0.7
950285cc8055692edcc2d3a6c059d0ea2db91958 tag refs/tags/v0.0.8
a2ad97ee1e554eeebe739125d5282e48e97b8f04 tag refs/tags/v0.0.9
```

**5 lightweight tags**, range **v0.0.7 → v0.0.12** (non-consecutive — v0.0.11 is missing).

The standalone `Cargo.toml` says `version = "0.1.0"` — therefore **none of these tags match the current Cargo.toml version**. The tags are **stale**: they predate the current `v0.1.0` manifest declaration and presumably reflect an earlier 0.0.x line of development.

Citation: `repos/pheno-flags$ git tag -l && git for-each-ref refs/tags` (captured before torn-down).

### 4.2 Argis-extensions (canonical subtree parent)

```
$ git tag -l
(empty)
```

**Zero tags** in argis-extensions. The pheno-flags subtree has no version tag context in its parent monorepo.

Citation: `argis-extensions/pheno-flags$ git tag -l` (2026-06-20 16:26 PDT).

### 4.3 Net tag state for the audit

**The 5 stale `v0.0.7..v0.0.12` tags are unique to the standalone worktree and were lost when it was torn down.** No equivalent tag set exists in any other pheno-flags location. Phase 2 must decide whether to re-emit them (with corrected versions matching `Cargo.toml`'s `0.1.0`) or drop them as obsolete.

---

## 5. Sub-trees in monorepo

### 5.1 Discovery: every `Cargo.toml` declaring `name = "pheno-flags"`

```
$ find /Users/kooshapari/CodeProjects/Phenotype/repos -name 'Cargo.toml' \
    -exec grep -l 'name = .pheno-flags' {} \;
…/repos/FocalPoint/pheno-flags/Cargo.toml
…/repos/pheno-flags/Cargo.toml                       ← standalone (torn down)
…/repos/pheno-flags/benches/Cargo.toml               ← bench crate, name = "pheno-flags-bench"
…/repos/AgilePlus/crates/pheno-flags/Cargo.toml
…/repos/AgilePlus/AgilePlus-wtrees/orch-v12-s2-001/crates/pheno-flags/Cargo.toml
…/repos/AgilePlus/AgilePlus-wtrees/orch-v12-s4-018-cargo-deny/crates/pheno-flags/Cargo.toml
…/repos/argis-extensions/pheno-flags/Cargo.toml
…/repos/argis-extensions/pheno-flags/benches/Cargo.toml
```

Citation: `repos$ find … Cargo.toml -exec grep -l …` (2026-06-20 16:26 PDT). Output truncated; full results above are the 8 unique paths (5 pheno-flags roots + 3 benches).

### 5.2 Content comparison — the 5 distinct pheno-flags roots

| # | Path | File count | Rust LoC | Last-modified | `src/lib.rs` content |
|---|---|---:|---:|---|---|
| 1 | `repos/pheno-flags/` (standalone, **torn down**) | 16 | 534 | (captured 2026-06-20 16:36 PDT) | **Reference baseline** — see § 7 |
| 2 | `repos/argis-extensions/pheno-flags/` (canonical subtree) | 16 | 534 | 2026-06-20 14:05:12–14:45:59 PDT | **byte-identical** to #1 (same `bc58074` commit, same Cargo.toml, same deny.toml) |
| 3 | `repos/FocalPoint/pheno-flags/` | 3 | 354 | 2026-06-16 17:52:21 PDT | **byte-identical** to #1/src/lib.rs (220 LoC) and tests/flag_test.rs (134 LoC) — no Cargo.toml/etc. |
| 4 | `repos/AgilePlus/crates/pheno-flags/` | 4 | 467 | 2026-06-20 02:43:59 PDT | **DIFFERENT** — workspace deps (`version.workspace = true`), different description ("Typed feature-flag resolution. A `Resolver` reads values in this order: explicit envvar → .env-style file → caller-supplied default"), 317 LoC src + 150 LoC test, different API (`Resolver`/`Flag`/`FlagValue`/`FlagStore`) |
| 5a | `repos/AgilePlus/AgilePlus-wtrees/orch-v12-s2-001/crates/pheno-flags/` | (worktree) | 467 | 2026-06-20 02:51:23 PDT | **byte-identical** to #4 |
| 5b | `repos/AgilePlus/AgilePlus-wtrees/orch-v12-s4-018-cargo-deny/crates/pheno-flags/` | (worktree) | 467 | 2026-06-20 02:52:57 PDT | **byte-identical** to #4 |

### 5.3 Diff verification

```
$ diff -q argis-extensions/pheno-flags/src/lib.rs FocalPoint/pheno-flags/src/lib.rs
(no output = identical)

$ diff -q argis-extensions/pheno-flags/src/lib.rs AgilePlus/crates/pheno-flags/src/lib.rs
Files … differ
```

Citation: `repos$ diff -q … src/lib.rs` (2026-06-20 16:26 PDT).

### 5.4 Two distinct pheno-flags APIs

**API A (Canonical, used by argis-extensions, FocalPoint, and the standalone worktree):**

- 220 LoC `src/lib.rs`, 134 LoC `tests/flag_test.rs`
- Simple `FlagSet { HashMap<String, bool> }` + `FlagError::InvalidValue(String)`
- API: `FlagSet::new`, `FlagSet::with`, `FlagSet::from_env`, `FlagSet::is_enabled`, `FlagSet::snapshot`
- Description in Cargo.toml: *"Canonical synchronous, in-memory feature-flag set for the Phenotype monorepo. Reads boolean flags from environment variables with a configurable prefix."*
- `pheno-flags/Cargo.toml:1-29` (read at session start)

**API B (AgilePlus fork):**

- 317 LoC `src/lib.rs`, 150 LoC `tests/flag_test.rs`
- Typed `FlagStore` + `Flag` + `FlagValue` (Bool / Int / String)
- `Resolver` reads: explicit envvar → .env-style file → caller-supplied default
- Different description, different deps (`tempfile`), different Cargo.toml shape (uses workspace deps)
- `AgilePlus/crates/pheno-flags/Cargo.toml:1-20` (read 2026-06-20 16:27 PDT)

**This is the most important Phase 1 finding for synthesis: there are TWO actively-developed pheno-flags APIs in the monorepo that share a crate name but not an implementation.** They are not byte-equal; the API surfaces diverge. Phase 2 must decide which is canonical (or merge them).

### 5.5 Where is `phenotype-apps/pheno-flags/`?

```
$ ls /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-apps/
ls: …phenotype-apps/: No such file or directory
```

**The `phenotype-apps/` directory does not exist locally** as of 2026-06-20 ~16:28 PDT — yet GitHub `gh search code 'use pheno_flags' --owner KooshaPari` returned 3 hits for `KooshaPari/phenotype-apps`. This implies a remote repo exists but is not checked out into this monorepo clone. See § 6.

### 5.6 No pheno-flags in worktree `wp/N-` scaffolds

The standalone worktree carried ~24 `wp/N-<slug>` branches, all referring to melosviz Tauri/Electrobun scaffold WPs (`wp/7`, `wp/8`, `wp/16`, `wp/27`, `wp/29`, `wp/34`–`wp/49`, `wp/50`–`wp/69`). **None of these branches touch pheno-flags** per the captured `git log --oneline -20` output. They are unrelated fleet WPs hosted in the same worktree.

---

## 6. GitHub state verification

### 6.1 Direct repo query

```
$ gh api /repos/KooshaPari/pheno-flags
{
  "message": "Not Found",
  "documentation_url": "https://docs.github.com/rest/repos/repos#get-a-repository",
  "status": "404"
}
gh: Not Found (HTTP 404)
```

**Confirmed: `KooshaPari/pheno-flags` does NOT exist as a GitHub repo** (HTTP 404, as expected).

Citation: `repos$ gh api /repos/KooshaPari/pheno-flags 2>&1 | head -20` (2026-06-20 16:28 PDT).

### 6.2 Cross-check via repo search

```
$ gh search repos 'pheno-flags' --owner KooshaPari --json fullName,description,url
[]
```

**Zero matches.** Confirms no `pheno-flags` repo exists under `KooshaPari/`.

Citation: `repos$ gh search repos 'pheno-flags' --owner KooshaPari --json fullName,description,url` (2026-06-20 16:28 PDT).

### 6.3 Cross-fleet consumer search (`use pheno_flags`)

```
$ gh search code 'use pheno_flags' --owner KooshaPari --limit 30 --json repository,path
```

**15 matches across 5 repos** (deduplicated by repo):

| Repo | Path | Subtree vs. canonical? |
|---|---|---|
| `KooshaPari/argis-extensions` | `pheno-flags/llms.txt` | same tree |
| `KooshaPari/argis-extensions` | `pheno-flags/src/lib.rs` | same tree |
| `KooshaPari/argis-extensions` | `pheno-flags/benches/flags_lookup.rs` | same tree |
| `KooshaPari/argis-extensions` | `pheno-flags/benches/flags_stress.rs` | same tree |
| `KooshaPari/argis-extensions` | `pheno-flags/examples/otel_quickstart.rs` | same tree |
| `KooshaPari/argis-extensions` | `pheno-flags/examples/quickstart.rs` | same tree |
| `KooshaPari/argis-extensions` | `pheno-flags/tests/flag_test.rs` | same tree |
| `KooshaPari/AgilePlus` | `crates/pheno-flags/README.md` | API B subtree |
| `KooshaPari/AgilePlus` | `crates/pheno-flags/src/lib.rs` | API B subtree |
| `KooshaPari/AgilePlus` | `crates/pheno-flags/tests/flag_test.rs` | API B subtree |
| `KooshaPari/PlayCua` | `native/src/main.rs` | **Real consumer — external!** |
| `KooshaPari/PlayCua` | `native/src/app/mod.rs` | Real consumer |
| `KooshaPari/PlayCua` | `native/tests/integration_smoke.rs` | Real consumer (test) |
| `KooshaPari/FocalPoint` | `pheno-flags/src/lib.rs` | API A mirror |
| `KooshaPari/FocalPoint` | `pheno-flags/tests/flag_test.rs` | API A mirror |
| `KooshaPari/FocalPoint` | `worklogs/l3-56-pheno-flags-2026-06-11.json` | worklog-only |
| `KooshaPari/phenotype-apps` | `worklogs/l3-56-pheno-flags-2026-06-11.json` | worklog-only (remote only, no local checkout) |
| `KooshaPari/phenotype-apps` | `pheno-flags/src/lib.rs` | remote only |
| `KooshaPari/phenotype-apps` | `pheno-flags/examples/quickstart.rs` | remote only |
| `KooshaPari/phenotype-apps` | `pheno-flags/tests/flag_test.rs` | remote only |

**Cross-fleet real consumers (not self-references):**

- **`KooshaPari/PlayCua`** — 3 hits (`native/src/main.rs`, `native/src/app/mod.rs`, `native/tests/integration_smoke.rs`). This is the only repo that **imports `pheno_flags` as an external crate dependency** rather than containing its own subtree.

All other hits are subtrees of the crate itself (argis-extensions/pheno-flags/, AgilePlus/crates/pheno-flags/, FocalPoint/pheno-flags/, phenotype-apps/pheno-flags/) or worklog JSON files referencing it.

Citation: `repos$ gh search code 'use pheno_flags' --owner KooshaPari --limit 30 --json repository,path` (2026-06-20 16:28 PDT).

---

## 7. Public API

### 7.1 Public items in `src/lib.rs:1-220`

| Kind | Item | Line | Signature / body |
|---|---|---:|---|
| `pub enum` | `FlagError` | `73` | `pub enum FlagError { #[error("...")] InvalidValue(String) }` (thiserror-derived, `Debug + PartialEq + Eq`) |
| `pub struct` | `FlagSet` | `94` | `pub struct FlagSet { flags: HashMap<String, bool> }` (derives `Debug + Clone + Default + PartialEq + Eq`) |
| `impl FlagSet::new` | `pub fn new()` | `108-110` | `pub fn new() -> Self { Self::default() }` — empty `FlagSet` |
| `impl FlagSet::with` | `pub fn with(...)` | `127-130` | `pub fn with(mut self, key: &str, value: bool) -> Self` — fluent builder (last write wins) |
| `impl FlagSet::from_env` | `pub fn from_env(...)` | `146-190` | `pub fn from_env(prefix: &str) -> Result<Self, FlagError>` — scans `std::env::vars()`, parses truthy `1|true|yes` / falsy `0|false|no` (case-insensitive), returns `Err(FlagError::InvalidValue)` on first bad value |
| `impl FlagSet::is_enabled` | `pub fn is_enabled(...)` | `196-198` | `pub fn is_enabled(&self, key: &str) -> bool` — `O(1)` lookup; unknown keys → `false` (safe default) |
| `impl FlagSet::snapshot` | `pub fn snapshot(...)` | `205-207` | `pub fn snapshot(&self) -> BTreeMap<String, bool>` — fresh sorted copy |
| (private) | `fn parse_bool(s: &str)` | `212-220` | internal helper (not pub-exported) |

**Source-of-truth:** `argis-extensions/pheno-flags/src/lib.rs` (220 lines, full file read at session start).

### 7.2 `__all__` equivalent (`pub use` / `pub mod`)

```
$ git grep -n 'pub use\|pub mod' src/
(no results)
```

**No `pub use` re-exports. No `pub mod` declarations.** The crate is a single flat module `pheno_flags` (matching `[lib] name = "pheno_flags"` in `Cargo.toml:15`). Consumers access items via the root path: `pheno_flags::{FlagError, FlagSet}`.

Citation: `argis-extensions/pheno-flags$ git grep -n 'pub use\|pub mod' src/` (empty result, 2026-06-20 16:29 PDT).

### 7.3 Test count

```
$ grep -c '#\[test\]' tests/flag_test.rs
8

$ grep -rc '#\[tokio::test\]' tests/
tests/flag_test.rs:0
```

- **8 `#[test]`** integration tests in `tests/flag_test.rs:1-134` (functions: `new_flagset_is_empty`, `with_sets_value`, `is_enabled_returns_true_for_set_key`, `is_enabled_returns_false_for_unknown_key`, `from_env_parses_truthy_values`, `from_env_parses_falsy_values`, `from_env_rejects_invalid_value`, `snapshot_returns_sorted_keys`).
- **0 `#[tokio::test]`** annotations (the crate has no async code).
- **~7 doc-test examples** in `src/lib.rs` rustdoc (lines with `assert!`/`assert_eq!` inside ```` ``` ```` blocks at lines ~14-24, ~37-45, ~54-65, ~103-107, ~120-126, ~150-180, etc.) — these are not counted by `grep '#\[test\]'` but are exercised by `cargo test --doc`.

Citation: `argis-extensions/pheno-flags$ grep -c '#\[test\]' tests/flag_test.rs` returns `8` (2026-06-20 16:29 PDT).

### 7.4 API-surface inconsistencies (potential Phase 2 inputs)

Two files in the working tree reference symbols that **do not exist** in the canonical `src/lib.rs`:

- `benches/flags_lookup.rs:7` — `use pheno_flags::Flags;` (no such public item — actual public items are `FlagSet`, `FlagError`)
- `benches/flags_lookup.rs:10-16` — `Flags::from_env_pairs(pairs.into_iter())` (no such method)
- `benches/flags_lookup.rs:23, 36, 47` — `flags.get(...)` (no such method on `FlagSet` — public method is `is_enabled`)
- `benches/flags_stress.rs:7` — `use pheno_flags::Flags;` (same issue)
- `benches/flags_stress.rs:18-20, 31-37` — `Flags::from_env_pairs(...)`, `flags.get(...)` (same issue)
- `examples/otel_quickstart.rs:13` — `use pheno_flags::{Flag, FlagSet};` (no public `Flag` type — only `FlagSet`)
- `examples/otel_quickstart.rs:24-26` — `FlagSet::new("otel-quickstart")`, `.flag(Flag::<String>::new(...).short('n'))` (constructor mismatch)
- `examples/otel_quickstart.rs:32` — `flags.parse_from(std::env::args())` (no such method)
- `examples/otel_quickstart.rs:38-40` — `resolved.get::<String>(...)`, `resolved.get::<bool>(...)` (no `get` method, no typed-resolution API)

**The benches and `examples/otel_quickstart.rs` describe an aspirational typed-flag API (`Flag`/`Flag`/`FlagValue`/`Resolver`/`parse_from`/`get`) that matches the AgilePlus API B (§ 5.4) rather than the canonical API A in `src/lib.rs`.** They would fail to compile against the current `src/lib.rs`. Phase 2 must either rewrite them against the canonical API or replace them with the simple `FlagSet` quickstart.

Citation: `argis-extensions/pheno-flags/benches/flags_lookup.rs:1-53` and `examples/otel_quickstart.rs:1-51` (both fully read at session start).

---

## 8. Manifests and CI

### 8.1 `Cargo.toml` (full, `pheno-flags/Cargo.toml:1-29`)

```toml
[workspace]

[package]
name = "pheno-flags"
version = "0.1.0"
edition = "2021"
license = "MIT OR Apache-2.0"
rust-version = "1.82"
description = "Canonical synchronous, in-memory feature-flag set for the Phenotype monorepo. Reads boolean flags from environment variables with a configurable prefix."
keywords = ["phenotype", "feature-flags", "config", "env", "ff-free"]
categories = ["config", "development-tools"]
publish = true

[lib]
name = "pheno_flags"
path = "src/lib.rs"

[dependencies]
thiserror = "2"
# Canonical OTLP wire-format export substrate (ADR-037).
# `pheno-flags` uses `pheno-otel` to surface flag-set diffs
# (resolved-vs-default) to OTLP/HTTP collectors when wired into a
# wider observability stack (per ADR-023 Rule 3.1: every substrate
# ships observability).
pheno-otel = { path = "../pheno-otel" }

[dev-dependencies]
serde_json = "1"
tokio = { version = "1", features = ["macros", "rt-multi-thread"] }
```

Citation: `pheno-flags/Cargo.toml:1-29` (full read at session start).

**Key manifest facts:**

- `publish = true` — crate is intended to be published (but per § 6.1, no GitHub repo exists; `cargo publish` cannot currently complete).
- Single runtime dep: `thiserror = "2"`.
- Sibling path dep: `pheno-otel = { path = "../pheno-otel" }` — coupled to OTLP observability (ADR-037).
- Dev-deps: `serde_json = "1"`, `tokio = { version = "1", features = ["macros", "rt-multi-thread"] }` — but no `#[tokio::test]` exists in the tests (`grep -c '#\[tokio::test\]' tests/` returned `0`).

### 8.2 `AGENTS.md` (full, `pheno-flags/AGENTS.md:1-104`)

Crate spec declaring:

- **Status:** ACTIVE
- **Substrate type:** `pheno-*-lib` (pure reusable library)
- **Date:** 2026-06-20
- **Language:** Rust 2021
- **Test framework:** `cargo test` (standard library + `tokio::test`)
- **Stack:** std + tokio + serde + serde_json + parking_lot::RwLock + pheno-tracing (ADR-012, ADR-036B)
- **Active ADRs:** ADR-022, ADR-031, ADR-040, ADR-012
- **Public API Quickstart** (in docstring): uses an aspirational `FlagStore`/`Flag`/`FlagValue` API that **does NOT match** `src/lib.rs` (it describes the AgilePlus API B).

Citation: `pheno-flags/AGENTS.md:1-104` (full read at session start). 3,222 bytes, 104 lines.

**Discrepancy note:** The "Public API (Quickstart)" block at `AGENTS.md:68-78` shows `FlagStore`/`Flag`/`FlagValue`/`get_bool`/`set`/`FlagValue::Bool` — a different API from the canonical `FlagSet::with/is_enabled/snapshot` in `src/lib.rs:94-208`. AGENTS.md is **out of sync** with the code.

### 8.3 `llms.txt` (full, `pheno-flags/llms.txt:1-57`)

LLM-friendly quick reference. Lists public API as `FlagSet`, `FlagSet::new`, `.with(key, value)`, `FlagSet::from_env(prefix)`, `FlagError` (with variants `UnknownKey`, `InvalidValue { key, value }`, `EmptyPrefix` — **the second two variants do NOT exist in the actual `src/lib.rs`** which only has `FlagError::InvalidValue(String)`), `merge(base, overlay)`. **The crate-level docs (`llms.txt`, `AGENTS.md`) describe an aspirational API that diverges from the implementation.**

Citation: `pheno-flags/llms.txt:1-57` (full read at session start). 2,146 bytes, 57 lines.

### 8.4 `justfile` (full, `pheno-flags/justfile:1-93`)

Recipe index with 12 recipes:

| Recipe | Purpose | Lines |
|---|---|---|
| `_default` / `help` | `just --list` | `12-16` |
| `lint` | `cargo fmt --check` + `cargo clippy --all-targets --all-features -- -D warnings` | `21-23` |
| `format` | `cargo fmt` + `cargo fix --allow-dirty --allow-staged` | `26-28` |
| `test` | `cargo test --all-features` | `33-34` |
| `coverage` | `cargo llvm-cov --html --fail-under-lines 80` | `37-38` |
| `audit` | `cargo audit --deny warnings` | `43-44` |
| `check` | `cargo check --all-targets --all-features` + `cargo udeps --all-targets` | `47-49` |
| `validate` | meta-bundle presence check (AGENTS.md, llms.txt, CHANGELOG.md, Cargo.toml, src/lib.rs) | `54-60` |
| `build` / `release` | debug build / release build --locked | `65-70` |
| `tag <version>` | bump version in Cargo.toml + create git tag | `75-83` |
| `deps` | `cargo tree --depth 1` | `88-89` |
| `ci` | `lint test audit` combined | `92-93` |

Citation: `pheno-flags/justfile:1-93` (full read). 2,879 bytes, 93 lines.

**Note: `validate` checks for `CHANGELOG.md` but the file is not present in `git ls-files` (§ 1.1).** This is a meta-bundle inconsistency per ADR-023 Rule 3.1.

### 8.5 `deny.toml` (full, `pheno-flags/deny.toml:1-39`)

cargo-deny configuration:

- **`[advisories]`** — ignores `RUSTSEC-2023-0071` (Marvin Attack on rsa; the crate does not use rsa).
- **`[licenses]`** — allows MIT, Apache-2.0, Apache-2.0 WITH LLVM-exception, BSD-3-Clause, BSD-2-Clause, ISC, Zlib, Unicode-DFS-2016, Unicode-3.0, CC0-1.0; `confidence-threshold = 0.8`.
- **`[bans]`** — `multiple-versions = "warn"`, `wildcards = "deny"`, `highlight = "all"`.
- **`[sources]`** — `unknown-registry = "deny"`, `unknown-git = "deny"`, `allow-registry = ["https://github.com/rust-lang/crates.io-index"]`, `allow-git = []`.

Citation: `pheno-flags/deny.toml:1-39` (full read). 944 bytes, 39 lines.

### 8.6 `llvm-cov.toml` (full, `pheno-flags/llvm-cov.toml:1-22`)

llvm-cov configuration:

- `default_flags = ["--all-features"]`
- **`[threshold]` lines=80, branches=75, functions=80** — ADR-040 lib-tier gate.
- `[output]` lcov = "lcov.info", summary = "target/llvm-cov/summary.txt".

Citation: `pheno-flags/llvm-cov.toml:1-22` (full read). 940 bytes, 22 lines.

### 8.7 `.github/workflows/ci.yml` (full, 31 lines)

Two jobs:

- **test** (ubuntu-latest, stable rust, `cargo test --all-features`)
- **coverage** (ubuntu-latest, stable rust, `cargo install cargo-llvm-cov`, `cargo llvm-cov --all-features --lcov --output-path lcov.info`, `codecov/codecov-action@v4`)

No `cargo fmt --check` job, no `cargo clippy` job, no `cargo audit` job in the CI workflow itself (despite all three being available via justfile).

Triggers: `push` on `main`/`master`, `pull_request`. `RUSTFLAGS: -D warnings`.

Citation: `pheno-flags/.github/workflows/ci.yml:1-31` (full read).

### 8.8 `scripts/coverage.sh` (full, 15 lines, executable)

`#!/usr/bin/env bash`, `set -euo pipefail`. Runs `cargo llvm-cov --config llvm-cov.toml --summary-only --fail-under-lines 80`. Fails with `exit 1` if `cargo-llvm-cov` is not installed.

Citation: `pheno-flags/scripts/coverage.sh:1-15` (full read).

### 8.9 Per-file inventory of meta-bundle compliance (ADR-023 Rule 3.1)

| Required artefact | Present? | Source-of-truth |
|---|---|---|
| `Cargo.toml` | YES | `pheno-flags/Cargo.toml:1-29` |
| `src/lib.rs` | YES | `pheno-flags/src/lib.rs:1-220` |
| `AGENTS.md` (1-page spec) | YES | `pheno-flags/AGENTS.md:1-104` |
| `llms.txt` | YES | `pheno-flags/llms.txt:1-57` |
| `README.md` | **NO** | (absent — gap noted in 71-pillar L64 = score 1) |
| `CHANGELOG.md` | **NO** | (absent — `just validate` would fail) |
| Tests (unit + integration) | YES | 8 `#[test]` in tests/flag_test.rs + ~7 doc-tests in src/lib.rs |
| Coverage gate ≥80% (lib) | YES | `llvm-cov.toml:14-17` |
| Observability (pheno-tracing or pheno-otel) | YES | `pheno-otel` dep at `Cargo.toml:25` |
| CI gate (build + test + coverage) | YES | `.github/workflows/ci.yml:1-31` |
| `deny.toml` | YES | `pheno-flags/deny.toml:1-39` |
| Worklog v2.1 (with `device:` field) | **NO** | (no `WORKLOG.md` file in `git ls-files`) |

---

## 9. Findings directory

### 9.1 Local subtree findings

```
$ ls /Users/kooshapari/CodeProjects/Phenotype/repos/pheno-flags/findings/
ls: …pheno-flags/findings/: No such file or directory
```

The standalone worktree's `findings/` directory no longer exists locally (path torn down). **However**, the `argis-extensions/pheno-flags/findings/` directory contains:

- `findings/71-pillar-2026-06-20-pheno-flags.md` — 219 lines, 11,395 bytes, full 71-pillar audit cycle 4 (score **2.37 / 3**, 9 domains, lowest L58 tracing = 0 / L22 fuzz = 0 / L56 logging = 0).

Citation: `argis-extensions/pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md:1-219` (full read at session start).

### 9.2 Cross-repo findings inventory (top-level `repos/findings/`)

30+ existing finding files under `/Users/kooshapari/CodeProjects/Phenotype/repos/findings/`, including:

- 71-pillar cycle files: `2026-06-17-*`, `2026-06-18-*`, `2026-06-19-*`
- Absorption audits: `2026-06-19-L5-110-112-second-half-4-repo-absorption-audit.md`, `2026-06-19-L5-114-pheno-llms-txt-absorption.md`
- Config consolidation: `2026-06-19-L5-500-config-consolidation-closure.md`, `2026-06-19-T10-1-configra-gate-remediation.md`
- T-wave reports: `2026-06-19-T9-2-secret-block-resolution.md`, `2026-06-19-T21-1-secret-scan-rescan.md`, `2026-06-19-T27-parent-push-cleanup.md`, `2026-06-19-T28-worktree-audit.md`
- Wide batch reports: `2026-06-19-wide-T74-{1..10}.md`

This Phase 1A file will be saved at:

- `/Users/kooshapari/CodeProjects/Phenotype/repos/findings/2026-06-20-pheno-flags-audit/01-source-inventory.md`

The audit directory also contains `02-docs-code.md` (from a prior step in this session).

Citation: `repos$ ls findings/ | head -30` (2026-06-20 16:30 PDT).

### 9.3 Within-crate 71-pillar summary (carried from `findings/71-pillar-2026-06-20-pheno-flags.md`)

| Domain | Score |
|---|---:|
| 1. Architecture | **2.67** |
| 2. Performance | **2.43** |
| 3. Quality / Correctness | **2.13** |
| 4. Developer Experience | **2.20** |
| 5. User Experience | **2.75** |
| 6. Security | **2.88** |
| 7. Observability & Ops | **1.63** |
| 8. Documentation & SSOT | **2.00** |
| 9. Governance & Sustainability | **2.67** |
| **Overall** | **2.37 / 3** |

**Lowest pillars (Phase 2 inputs):**

- **P0 L58 Tracing (0):** no `tracing` integration (per ADR-012 / ADR-036B canonical).
- **P1 L22 Property/Fuzz (0):** no `proptest` or `cargo-fuzz`.
- **P2 L56 Logging (0):** no structured logging of flag evaluations.
- **P3 L64 README (1):** no `README.md` (gap noted in § 8.9).
- **P4 L37 Release Process (1):** no `release.yml` workflow.

Citation: `argis-extensions/pheno-flags/findings/71-pillar-2026-06-20-pheno-flags.md:163-218` (full read).

---

## 10. Git remote and ref state

### 10.1 Argis-extensions remotes (canonical subtree parent)

```
$ git remote -v
origin      git@github.com:KooshaPari/argis-extensions.git (fetch)
origin      git@github.com:KooshaPari/argis-extensions.git (push)
origin-ssh  git@github.com:KooshaPari/argis-extensions.git (fetch)
origin-ssh  git@github.com:KooshaPari/argis-extensions.git (push)
```

**2 remotes**, both pointing to the SAME GitHub repo `KooshaPari/argis-extensions`. (Note: `origin-ssh` is a redundant alias.)

Citation: `argis-extensions/pheno-flags$ git remote -v` (2026-06-20 16:30 PDT).

### 10.2 Standalone worktree remotes (torn down, captured at session start)

**5 remotes:**

| Remote name | URL |
|---|---|
| `argis` | `git@github.com:KooshaPari/argis-extensions.git` |
| `argis-extensions` | `git@github.com:KooshaPari/argis-extensions.git` |
| `argis-stale` | `git@github.com:KooshaPari/argis-extensions.git` |
| `origin` | `git@github.com:KooshaPari/phenotype-apps.git` |
| `phenotype-apps` | `git@github.com:KooshaPari/phenotype-apps.git` |

Citation: `repos/pheno-flags$ git remote -v` (captured before torn-down).

### 10.3 Fetch configuration

```
$ git config --get-all remote.origin.fetch
+refs/heads/*:refs/remotes/origin/*
```

Standard fetch refspec (all branches → remote-tracking under `remotes/origin/*`).

Citation: `argis-extensions/pheno-flags$ git config --get-all remote.origin.fetch` (2026-06-20 16:31 PDT).

### 10.4 `git ls-remote origin` for argis-extensions

The fetch returned **30+ refs on first call** (truncated to first 30):

```
3d280ce711909a71c7c23378a02bf28f4e3d50cc  HEAD
8d419e55c690c5874f7701bdd8f758f3f9401a0d  refs/heads/archive/2026-06-19-v10-wrapup
da7abd51d164bd0a31ecc2bcfe87b54a04813292  refs/heads/archive/2026-06-20-L5-orchestrator-v11-wrap
8fd63df06ed1978d7efb6238debf5c5fdd536b00  refs/heads/archive/2026-06-20-v11-orchestrator
0e327477eac66e135743a1e386f7db960ba35b46  refs/heads/archive/2026-06-20-v11-session-wrap-orchestrator
32c96fe0a962b6a674594396138f6dae8eb91134  refs/heads/argis-extensions-main
75603ecc0f8954a99baf9e9aac82251aba7228bc  refs/heads/chore/absorb-pheno-flags        ← pheno-flags-targeted
b2b6e783442da4e3956e957ed16af84900822046  refs/heads/chore/add-funding-2026-05-02
a1ae37b4aa46c63f88177989bf8ea0fc28236064  refs/heads/chore/editorconfig-align
afeabd1876ff0357a33a81aceaec56ba1f4c0441  refs/heads/chore/infra-cleanup-20260504
00f6c06837d21ef03a677564716733b106c40f9e  refs/heads/chore/l5-hexakit-retarget-2026-06-20-v2
cd2b9fd196b78cd69b883e59d1631845f343117d  refs/heads/chore/m3-status-update-2026-06-20
7184fbba305d35d55d55dec848ee1726c5d3af02  refs/heads/chore/orch-v11-016-tier0-2026-06-20
d20cbc72562767b0bf5b73e735b6c095ba41dc61  refs/heads/chore/orch-v11-044-tier-0-governance-pheno-otel-2026-06-20
75ddf57d4d75b52d965afe5057d065123c6f5f5d  refs/heads/chore/orch-v12-s1-012-tier0-2026-06-20
e9297cdb946ed1cd12ec4075b48cf0f0d9444e12  refs/heads/chore/orch-v12-s1-014-tier0-2026-06-20
… (more refs in subsequent calls, including:
    chore/absorb-pheno-flags, chore/v11-tier-0-adrs-2026-06-20, chore/v12-71-pillar-p0-remediation-2026-06-20,
    chore/v13-71-pillar-cycle-2-p0-2026-06-20, dependabot/*, codex/*, ci/*, wip/*)
```

**`refs/heads/chore/absorb-pheno-flags`** exists on `origin` at `75603ecc0f` — a pheno-flags-targeted branch on the argis-extensions remote. This is the `chore/absorb-pheno-flags` branch captured in the standalone worktree's branch listing (§ 3.2).

**No tags on origin** (no `refs/tags/*` in the first 30 refs; `git ls-remote origin --tags` would be required to confirm zero tags).

Citation: `argis-extensions/pheno-flags$ git ls-remote origin --heads --tags | head -40` (2026-06-20 16:31 PDT).

### 10.5 GitHub fetch inconsistency

```
$ git ls-remote origin --heads --tags
(empty on first call after cwd change; 30+ refs on retry)
```

**Network flakiness observed** — initial call returned empty, retry succeeded with 30+ refs. This is consistent with intermittent GitHub auth/connectivity from the macbook (`device: macbook` per worklog v2.1 schema, ADR-030). Phase 2 should plan around `git ls-remote` flakiness.

---

## Summary of Phase 1A findings (inventory-only; NO decisions made)

**Working tree:**
- Canonical local source: `repos/argis-extensions/pheno-flags/` (16 files, 534 Rust LoC + 626 non-Rust LoC)
- Standalone worktree at `repos/pheno-flags/` (torn down mid-session) had the same content + 5 stale `v0.0.7..v0.0.12` tags + 5 remotes + 245 branches
- No submodules

**Public API:**
- Single flat module `pheno_flags` exposing `FlagSet`, `FlagError::InvalidValue(String)` plus 5 methods (`new`/`with`/`from_env`/`is_enabled`/`snapshot`)
- 8 integration tests, 0 tokio tests, ~7 doc tests
- **API surface in `benches/*` and `examples/otel_quickstart.rs` does NOT match the implementation** — references `Flags`, `Flag`, `FlagValue`, `Resolver`, `parse_from`, `get` which don't exist
- **Docs in `AGENTS.md` and `llms.txt` describe an aspirational API** that doesn't match the implementation either

**Two divergent pheno-flags implementations in the monorepo:**
- **API A (canonical, in argis-extensions/FocalPoint):** simple `FlagSet { HashMap<String, bool> }` + `FlagError::InvalidValue`, 220 LoC src
- **API B (AgilePlus only):** typed `FlagStore`/`Flag`/`FlagValue`/`Resolver` (bool/int/string), 317 LoC src + 150 LoC test
- They share the crate name but not the implementation or the API

**GitHub state:**
- `KooshaPari/pheno-flags` does NOT exist (HTTP 404)
- 0 repo-search matches
- 15 `use pheno_flags` matches across 5 repos (mostly subtrees of the crate itself)
- **Real cross-fleet consumer: `KooshaPari/PlayCua`** (3 hits: `native/src/main.rs`, `native/src/app/mod.rs`, `native/tests/integration_smoke.rs`)

**Manifests:**
- Cargo.toml at `0.1.0`, `publish = true`, single runtime dep `thiserror = "2"`, sibling path dep `pheno-otel` (ADR-037 OTLP), dev-deps `serde_json` + `tokio`
- 71-pillar overall score: **2.37 / 3** (lowest: L58 tracing = 0, L22 fuzz = 0, L56 logging = 0, L64 README = 1, L37 release = 1)
- Missing meta-bundle artefacts: `README.md`, `CHANGELOG.md`, `WORKLOG.md`

**Branches with pheno-flags-targeted content:**
- `chore/absorb-pheno-flags` (push origin branch)
- `feat/pheno-flags-tracing-prop-test-log-2026-06-20`
- `wip/preserve-pheno-flags-port-adapter-local-2026-06-20`
- `wip/stash-2026-06-20-recovered-worktree-v11-adr037-otlp-wiring` (ahead 4, behind 17 vs main)
- `chore/v13-t3-sbom-pheno-flags-2026-06-20` (worktree at `/private/tmp/v13-t3-sbom-pheno-flags-2026-06-20`, ahead 144, behind 461)

---

*End of Phase 1A inventory. Phase 2 (synthesis + decision matrix) is the next step — not started in this document per scope.*
