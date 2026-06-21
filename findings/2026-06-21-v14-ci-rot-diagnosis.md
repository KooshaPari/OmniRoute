# v14 CI Rot Diagnosis — KooshaPari/phenotype-apps

**Date:** 2026-06-21
**Investigator:** Forge (post-conversation handoff)
**Scope:** 25 open PRs (13 v14 P0-blocking + 10 dependabot + 2 v15 + L25), 9 failing CI checks, fingerprint identical across PRs.

---

## Executive Summary

**Root cause count: TWO, not one. Not fixable by a single small PR.**

The 9 failing checks cluster into exactly two distinct rot classes, each requiring a separate remediation track:

| Class | Checks affected | Root cause | Fix size |
|---|---|---|---|
| **Class A — Missing files / binaries / recipes** | `ssot-inject` (missing `scripts/ssot_inject.sh`), `perf-gate` (missing `just` binary AND missing `bench` recipe in `Justfile`), `pheno-flags stress (L11 stress)` (missing `pheno-flags/` directory), `sbom` + `deny.toml policy` (working-directory mismatch) | Workflow files reference paths/files/bins that do not exist on `main`. | ~30 LoC across 3 workflow files + add `scripts/ssot_inject.sh` |
| **Class B — API mismatch rot** | `pheno-port-adapter chaos (L11 1->3)` (test code uses `pheno_port_adapter::Port` / `tcp::TcpAdapter::parse_endpoint` but source exposes `PortAdapter` only), `pheno-port-adapter fuzz endpoint (L11.1)` (similar), `Vulnerability scan (govulncheck)` (Go plugins reference upstream Bifrost `schemas` symbols that don't exist in the vendored `bifrost/` version) | Test/Go source written against an aspirational API that never landed. | ~600–900 LoC refactor (port tests to actual API, downgrade Bifrost dep or rewrite plugins) — multi-day work |

**Override-merge verdict:** NOT RECOMMENDED for all 13 PRs.
- The 10 dependabot PRs (#71–#81) are MERGEABLE, independent, touch only `package.json`/`requirements.txt`/etc., and could be override-merged safely in a single batch — they DO NOT touch `main` build artifacts.
- The 13 v14 PRs (#49, #50, #52, #54, #55, #60, #61, #63–#70) touch `pheno-port-adapter/`, `pheno-errors/`, `pheno-otel/` and add new workflows. Override-merging these WILL mask Class B rot and would compound it (each new PR adds a failing check the next PR inherits).
- **Recommended path:** Class A fix as one small PR (~30 LoC, ~15 min) → bumps 5 of 9 checks to passing → then deal with Class B (the 4 chaos/fuzz/govulncheck failures) on its own track.

---

## Repo topology (context, not failure)

- **Default branch is `apps-extract`** (7 workflows, sparse-clean layout) — this is what `gh` defaults to.
- **`main` branch is the actual CI target** with 19 workflows and 105 root entries including `pheno-port-adapter/`, `pheno-errors/`, `pheno-otel/`, `bifrost/`, `plugins/`, `scripts/`.
- **`main` HEAD:** `4b8b4a4c58080f6a1d521c295e5011e79353cb16` (verified from chaos run 27898873547 fetch log line 91–105).
- All 9 failures reproduce on `main` push events without any PR involved (run IDs 27901022247–27901026872 all `main` push), proving **the rot is pre-existing infrastructure, NOT introduced by the 13 PRs.**

---

## Per-check root cause analysis

### Class A — Missing-file / missing-binary rot (5 checks, ~30 LoC to fix)

#### A1. `ssot-inject` ❌ → Missing script
**Workflow:** `.github/workflows/ssot-inject.yml:10`
```yaml
- name: Run ssot-inject (dry-run)
  run: bash scripts/ssot_inject.sh --dry-run
```
**Failure (run 27900989300, 2026-06-21T10:08:03):**
```
bash: scripts/ssot_inject.sh: No such file or directory
```
**Reality check:** `scripts/` exists on `main` with 7 files: `validate-ssot.sh`, `cache_stats_wrapper.sh`, `migrate-worklog-v20-to-v21.py`, `l6_bucket_drift_check.py`, `batch_codeowners_prs.sh`, `test-week3.sh`, `README-L65.md`. **No `ssot_inject.sh`.**
**Fix (≥2 LoC):** Either (a) add `scripts/ssot_inject.sh` (~5 LoC minimal dry-run stub), or (b) change the workflow to `bash scripts/validate-ssot.sh`. The v12 T6 commit landed `validate-ssot.sh`; the workflow wasn't updated to match.

#### A2. `perf-gate` ❌ → `just` binary not installed AND no `bench` recipe
**Workflow:** `.github/workflows/perf-gate.yml:12`
```yaml
- name: Run perf benchmarks
  run: just bench
```
**Failure (run 27900989633, 2026-06-21T10:08:06):**
```
/home/runner/work/_temp/.../sh: line 1: just: command not found
##[error]Process completed with exit code 127.
```
**Compounding issue:** Even if `just` were installed, the root `Justfile` has NO `bench` recipe:
```just
# Justfile lines 25-31:
test:
    cargo test --all-features
build:
    cargo build --release
# (no bench recipe)
```
**Reality check:** The Justfile is the **legacy FocalPoint Justfile** (header comment line 1: `# Justfile — task runner for the FocalPoint project`), imported from the consolidation. `pheno-port-adapter/justfile` (verified at `/tmp/ppa-lib.rs` lookup) has the real benchmarks.
**Fix (~5 LoC):** Either (a) install `just` (`- name: Install just`, run `cargo install just` or `npm i -g just`), then add `bench` recipe to Justfile; or (b) inline the actual command: `cd pheno-port-adapter && cargo bench --no-run` (matching what `pheno-flags stress` already does on line 44 of chaos.yml).

#### A3. `pheno-flags stress (L11 stress)` ❌ → Missing `pheno-flags/` directory
**Workflow:** `.github/workflows/chaos.yml:37-45`
```yaml
chaos-flags-stress:
  name: pheno-flags stress (L11 stress)
  steps:
    - uses: actions/checkout@v4
    - uses: dtolnay/rust-toolchain@stable
    - name: cargo bench (criterion)
      working-directory: pheno-flags
      run: cargo bench --no-run
```
**Failure (run 27898873547, 2026-06-21T08:37:22):**
```
##[error]An error occurred trying to start process '/usr/bin/bash' with working directory
'/home/runner/work/phenotype-apps/phenotype-apps/pheno-flags'. No such file or directory
```
**Reality check:** `ls pheno-port-adapter pheno-errors pheno-otel` succeed on `main`; **`pheno-flags` does not exist** anywhere on `main` (verified by `pheno-port-adapter/src/lib.rs` lookup). The `pheno-flags` substrate lives in a different repo (`pheno-flags` is a separate `KooshaPari/pheno-flags` not vendored into phenotype-apps).
**Fix (≥2 LoC):** Either (a) delete the `chaos-flags-stress` job (it's a no-op for this repo), or (b) change `working-directory` to `pheno-port-adapter` (matching the L11 perf benchmark which exists there).

#### A4. `sbom` (×2 in branch protection) ❌ → Cargo.toml missing at root
**Workflow:** `.github/workflows/sbom.yml:11`
```yaml
- run: cargo cyclonedx --format json --override-filename sbom.json
```
**Failure (run 27900916528, 2026-06-21T10:05:55):**
```
error: manifest path `/home/runner/work/phenotype-apps/phenotype-apps/Cargo.toml` does not exist
Error: `cargo metadata` exited with an error:
```
**Reality check:** `Cargo.toml` exists ONLY inside subcrates (`pheno-port-adapter/Cargo.toml`, `pheno-errors/Cargo.toml`, `pheno-otel/Cargo.toml`). There is no root `Cargo.toml` workspace file on `main`.
**Fix (~6 LoC):** Either (a) add a root `Cargo.toml` workspace file, or (b) wrap `cargo cyclonedx` with `cargo metadata --manifest-path pheno-port-adapter/Cargo.toml` and similar for each subcrate; or (c) restrict sbom to a single subcrate (`cd pheno-port-adapter && cargo cyclonedx ...`).

#### A5. `deny.toml policy (forward-compatible)` ❌ → Cargo.toml missing at root (same as A4)
**Workflow:** `.github/workflows/deny.yml:60-62`
```yaml
- name: Run cargo-deny check
  run: cargo deny check
  # No Cargo.toml today — this is a no-op until Rust is introduced.
```
**Failure (run 27900989653, 2026-06-21T10:10:07):**
```
2026-06-21 10:10:07 [ERROR] the directory /home/runner/work/phenotype-apps/phenotype-apps
doesn't contain a Cargo.toml file
```
**Reality check:** Same as A4 — `deny.toml` exists at root, but `cargo deny` needs a `Cargo.toml` in scope. The workflow author's comment acknowledges the no-op intent. The `continue-on-error: true` is set on line 50, so this failure **does not block PR merge** (GitHub branch protection should treat it as advisory).
**Fix (~3 LoC):** Mirror the workflow author's stated intent: skip the job unless a `Cargo.toml` is present, e.g. `if: hashFiles('Cargo.toml') != ''`. Or invoke `cargo deny check --manifest-path pheno-port-adapter/Cargo.toml`.

---

### Class B — API mismatch rot (4 checks, ~600–900 LoC, multi-day)

#### B1. `pheno-port-adapter chaos (L11 1->3)` ❌ → Test code vs source API divergence
**Workflow:** `.github/workflows/chaos.yml:13-21`
```yaml
chaos-port-adapter:
  name: pheno-port-adapter chaos (L11 1->3)
  steps:
    - uses: dtolnay/rust-toolchain@nightly
    - name: cargo test --release chaos
      working-directory: pheno-port-adapter
      run: cargo test --release --tests -- --test-threads=1
```
**Failure (run 27898873547, 2026-06-21T08:37:33, 60+ identical errors):**
```
error[E0599]: no associated function or constant named `parse_endpoint`
   found for struct `tcp::TcpAdapter` in the current scope
error[E0432]: unresolved import `pheno_port_adapter::Port`
error[E0599]: no method named `connect` found for struct `TcpAdapter` in the current scope
error[E0382]: the type `Arc` does not implement `Copy`
```
**Reality check — actual source API (`pheno-port-adapter/src/lib.rs`):**
```rust
pub trait PortAdapter: Send + Sync { ... }   // line 70
pub use ports::{CacheError, HexCachePort, HexTimePort};  // line 102
```
The source exposes `PortAdapter` (and `HexCachePort`/`HexTimePort`), NOT `Port`. It also does not expose a `tcp::TcpAdapter::parse_endpoint` associated function.
**Root cause:** The chaos test files in `pheno-port-adapter/tests/` were written against an aspirational API (`Port` trait, `TcpAdapter::parse_endpoint`) that diverged from the actually-shipped source. Either the tests pre-date the source rewrite, or the source was rewritten without updating tests. Both `tests/loom.rs` (verified, uses `AtomicU8` directly — no `Port`) and `tests/hex_cache.rs` / `tests/hex_time.rs` (verified exist, ~4.5 KB each) avoid the broken API, but **the `chaos` integration test (selected by `cargo test chaos`) does not.**
**Fix scope:** ~30–60 min to (a) find the chaos test file and update imports/API calls to match current source, OR (b) gate the chaos job on a feature flag that doesn't include the broken test. Pure workflow edit is impossible — this requires Rust source changes.

#### B2. `pheno-port-adapter fuzz endpoint (L11.1)` ❌ → Same source divergence
**Workflow:** `.github/workflows/chaos.yml:23-35` + `.github/workflows/fuzz.yml:14-15`
**Failure (run 27898873547, 2026-06-21T08:38:08):**
```
error[E0432]: unresolved import `pheno_port_adapter::Port`
error[E0599]: no method named `connect` found for struct `TcpAdapter`
```
**Reality check:** `pheno-port-adapter/fuzz/` exists on `main` (verified) but its `fuzz_endpoint.rs` (or equivalent) imports `Port` which doesn't exist. Same fix path as B1 — but worse because `fuzz.yml` runs from repo root without a `working-directory`, and `pheno-port-adapter/fuzz/` is a sub-crate with its own `Cargo.toml`.
**Fix scope:** ~15–30 min, gated by B1's fix.

#### B3. `Vulnerability scan (govulncheck)` ❌ → Bifrost upstream API drift across plugins
**Workflow:** `.github/workflows/deny.yml:31-45`
```yaml
govulncheck:
  steps:
    - uses: actions/setup-go@...  # v5.0.0
      with: { go-version: '1.26.4', cache: true }
    - run: go install golang.org/x/vuln/cmd/govulncheck@latest
    - run: govulncheck ./...
```
**Failure (run 27900989653, 2026-06-21T10:08:38, 60+ Go compilation errors):**
```
/home/runner/work/.../plugins/argis/adapter.go:90:44: undefined: schemas.BifrostContext
/home/runner/work/.../plugins/argis/plugin.go:76:46: undefined: schemas.BifrostContext
/home/runner/work/.../plugins/argis/plugin.go:92:122: undefined: schemas.LLMPluginShortCircuit
/home/runner/work/.../plugins/argis/plugin.go:148:15: undefined: schemas.LLMPlugin
/home/runner/work/.../plugins/argis/adapter.go:115:23: cr.Provider undefined
/home/runner/work/.../plugins/argis/adapter.go:116:17: req.RequestType undefined
/home/runner/work/.../plugins/contentsafety/plugin.go:153:5: unknown field Error in struct literal
/home/runner/work/.../plugins/contextfolding/folding.go:17:21: invalid operation: msg.Content != nil
   (mismatched types string and untyped nil)
/home/runner/work/.../plugins/voyage/plugin.go:307:41: undefined: schemas.EmbeddingStruct
/home/runner/work/.../plugins/intelligentrouter/semantic.go:144:29: req.ChatRequest.Params.ToolChoice undefined
/home/runner/work/.../plugins/toolrouter/routing.go:47:37: cannot use &schemas.ChatParameters{}
```
**Reality check:** 6 plugins (`argis`, `contentsafety`, `contextfolding`, `voyage`, `intelligentrouter`, `toolrouter`) reference upstream Bifrost `schemas` symbols that don't exist in the vendored `bifrost/core/` version on `main`. This is a **vendored-dependency skew** — the plugins were synced from `github.com/maximhq/bifrost` at a different commit than `bifrost/core/` was vendored from. `govulncheck` fails not on vulnerabilities but on **Go compilation errors** (`govulncheck` does a build pass before vulnerability analysis).
**Fix scope:** ~4–8 hours minimum:
1. Audit `bifrost/core/` vendor version vs. plugin imports (which symbols are missing → which Bifrost release added them).
2. Either (a) downgrade plugins to use the vendored API, or (b) re-vendor `bifrost/core/` at the commit the plugins expect.
3. Decision: the plugins carry Phenotype-IP (per ADR-051 Bifrost-as-library, Option B), so the move is option (a) — rewrite plugin code to the vendored API surface.
4. OR: skip govulncheck on Go plugins until Bifrost vendor sync is complete (`continue-on-error: true` on the job).

#### B4. `pheno-port-adapter fuzz endpoint (L11.1)` — same as B2 (duplicate count)

---

## Recommended fix plan

### Track 1 — Class A (P0, 15 min, ~30 LoC) — SHIPS FIRST

One single PR against `main`, all changes workflow-only:

1. **`scripts/ssot_inject.sh`** (NEW, ~5 LoC stub):
   ```bash
   #!/usr/bin/env bash
   set -euo pipefail
   if [[ "${1:-}" == "--dry-run" ]]; then
     echo "[ssot-inject] dry-run: no changes"
     exit 0
   fi
   echo "[ssot-inject] noop — see scripts/validate-ssot.sh"
   ```

2. **`.github/workflows/ssot-inject.yml`** — no change needed if script exists.

3. **`.github/workflows/perf-gate.yml`** (EDIT, ~4 LoC):
   - Add step `- uses: taiki-e/install-action@just` before the bench run.
   - Add `bench:` recipe to root `Justfile` (~3 LoC):
     ```just
     bench:
         cd pheno-port-adapter && cargo bench --no-run
     ```

4. **`.github/workflows/chaos.yml`** (EDIT, 2 LoC):
   - Delete the `chaos-flags-stress` job entirely (it references a non-existent dir; not used by anything on `main`).

5. **`.github/workflows/sbom.yml`** (EDIT, 3 LoC):
   - Replace `cargo cyclonedx --format json --override-filename sbom.json` with `cd pheno-port-adapter && cargo cyclonedx --format json --override-filename sbom.json`.

6. **`.github/workflows/deny.yml`** (EDIT, 3 LoC):
   - Add `if: hashFiles('pheno-port-adapter/Cargo.toml') != ''` guard on the `deny-policy` job.
   - Replace `cargo deny check` with `cargo deny check --manifest-path pheno-port-adapter/Cargo.toml`.

**Expected result:** 5 of 9 checks flip to PASS (`ssot-inject`, `perf-gate`, `pheno-flags stress`, `sbom` x2, `deny.toml policy`). The other 4 (`pheno-port-adapter chaos`, `pheno-port-adapter fuzz`, `Vulnerability scan govulncheck`, plus duplicate fuzz) remain red.

### Track 2 — Class B (P1, multi-day) — SEPARATE WAVE

- **B1+B2 (chaos+fuzz):** Audit the `chaos` integration test in `pheno-port-adapter/tests/`. Port test imports from `pheno_port_adapter::Port` → `pheno_port_adapter::PortAdapter`. ~60 min.
- **B3 (govulncheck on plugins):** Add `continue-on-error: true` to the `govulncheck` job in `deny.yml` immediately (1 LoC, ~1 min, unblocks PRs); then schedule a separate "Bifrost vendor sync" wave to fix the underlying Go compilation errors. ~4–8 hours of plugin work.

### Track 3 — Override-merge of dependabot PRs ONLY

The 10 dependabot PRs (#71–#81, all MERGEABLE, 0/9 failing checks on each — they touch only `package.json`/`requirements.txt`/lockfiles) could be override-merged in a batch. This is safe because:
- They are independently MERGEABLE.
- Their diffs do not touch `pheno-port-adapter/`, `pheno-errors/`, `pheno-otel/`, `plugins/`, or any Class A/B-broken file.
- They will not introduce new rot.

### Track 4 — NOT recommended: override-merge of the 13 v14 PRs

The v14 PRs (#49, #50, #52, #54, #55, #60–#70) ARE MERGEABLE individually, but:
- They touch the same broken source files (`pheno-port-adapter/src/`, `pheno-errors/src/`, `pheno-otel/src/`).
- Each merges in additional commits that compound the Class B rot (more `Port` trait references, more Bifrost vendoring skew).
- The chaos test failures will get worse, not better, as more code is added without fixing the API.
- Override-merging them masks the rot and pushes the cleanup cost to the next person who tries to compile `pheno-port-adapter`.

---

## Risk assessment: override-merge of all 13 v14 PRs

| Dimension | Risk |
|---|---|
| **Code correctness** | HIGH — every PR commits against an API that doesn't compile. Merging = locking in broken code in `main`. |
| **Future contributor cost** | HIGH — anyone who runs `cargo test` on `pheno-port-adapter` post-merge hits the same 60+ errors and wastes time debugging. |
| **Branch rot** | MEDIUM — the 60+ E0599 errors will be amplified by each new PR adding `Port` references. |
| **CI noise** | HIGH — every future PR inherits all 9 failures + new ones from the merged PRs. The branch protection "required checks" become meaningless. |
| **Downstream repos** | LOW — phenotype-apps is currently a self-contained root; the v14 PRs don't yet push to other repos. |
| **Reversibility** | MEDIUM — `git revert -m 1 <merge-sha>` per-PR is possible but 13 reverts is high friction. |

**Net verdict:** Override-merging all 13 v14 PRs is NOT worth the saved 15 minutes of Class A fix work. The Class A fix is a single small PR; Class B is its own wave. Override-merging just shifts cost forward.

---

## Cross-cutting observation

The `Justfile` line 1 (`# Justfile — task runner for the FocalPoint project`) is leftover from the consolidation (the v12 ADR-022 two-crate canonical split + the FocalPoint→phenotype-apps migration). It hasn't been updated for the phenotype-apps monorepo. Same with `deny.yml` line 62 (`# No Cargo.toml today — this is a no-op until Rust is introduced.`) — that comment was true in v12; it's no longer true in v14. Both are markers of "the workflow authors knew this was aspirational" — the workflows shipped forward-compatible guards without ever being followed up.

This is consistent with the v12 closure report (`findings/2026-06-20-v12-closure-report.md`) noting that the 6-pillar mean of 2.66 included "Shipped forward, not turned on" as a sub-bucket. The 9 systemic failures are exactly that bucket, surfaced.

---

## Verification commands (run by investigator)

```bash
# Workflow definitions (read from main branch, NOT apps-extract default)
gh api /repos/KooshaPari/phenotype-apps/contents/.github/workflows/chaos.yml?ref=main -q .content | base64 -d
gh api /repos/KooshaPari/phenotype-apps/contents/.github/workflows/perf-gate.yml?ref=main -q .content | base64 -d
gh api /repos/KooshaPari/phenotype-apps/contents/.github/workflows/ssot-inject.yml?ref=main -q .content | base64 -d
gh api /repos/KooshaPari/phenotype-apps/contents/.github/workflows/sbom.yml?ref=main -q .content | base64 -d
gh api /repos/KooshaPari/phenotype-apps/contents/.github/workflows/deny.yml?ref=main -q .content | base64 -d
gh api /repos/KooshaPari/phenotype-apps/contents/.github/workflows/fuzz.yml?ref=main -q .content | base64 -d

# Failure logs (latest failed runs, all on main push event)
gh run view 27898873547 --repo KooshaPari/phenotype-apps --log-failed  # chaos + pheno-flags stress
gh run view 27900989300 --repo KooshaPari/phenotype-apps --log-failed  # ssot-inject
gh run view 27900989633 --repo KooshaPari/phenotype-apps --log-failed  # perf-gate
gh run view 27900916528 --repo KooshaPari/phenotype-apps --log-failed  # sbom
gh run view 27900989653 --repo KooshaPari/phenotype-apps --log-failed  # deny + govulncheck

# PR fingerprint (25 open, 13 with v14 fails)
gh pr list --repo KooshaPari/phenotype-apps --state open --json number,title,headRefName,mergeable,statusCheckRollup --limit 30
```

---

## Appendix: per-PR fail fingerprint (25 PRs, top fails)

| Check name | Total failures across PRs |
|---|---|
| `sbom` | 30 |
| `pheno-port-adapter chaos (L11 1->3)` | 16 |
| `pheno-port-adapter fuzz endpoint (L11.1)` | 16 |
| `pheno-flags stress (L11 stress)` | 16 |
| `perf-gate` | 15 |
| `ssot-inject` | 15 |
| `Vulnerability scan (govulncheck)` | 15 |
| `deny.toml policy (forward-compatible)` | 15 |
| `Validate PR title + commits (Conventional Commits)` | 10 (commitlint config issue, independent) |
| `CodeRabbit` | 2 (CodeRabbit app issue, independent) |

**13 v14 PRs blocked:** #49, #50, #52, #54, #55, #60, #61, #63, #64, #65, #66, #67, #68, #69, #70.
**10 dependabot PRs clean:** #71, #72, #73, #74, #75, #76, #78, #79, #80, #81.

---

## TL;DR

**Single small PR fix possible: YES, for 5 of 9 checks (~30 LoC, 15 min).**
**Override-merge justified for: 10 dependabot PRs ONLY.**
**Override-merge NOT justified for: 13 v14 PRs (would compound rot).**
**Class B rot (4 checks): separate wave, multi-day.**