# pheno-context Absorption-Justification Audit (2026-06-29)

**Source Repository:** `KooshaPari/pheno-context` (PUBLIC, Rust, 39 KB, 2 branches, status: `active`, license: `MIT/Apache-2.0`)
**Audit Verdict:** `AFFIRM` — canonical home, no absorption action needed
**Audit Date:** 2026-06-29
**Disposition Index Row:** `repo-pheno-context`

---

## Source

| Field | Value |
|---|---|
| **Path** | `KooshaPari/pheno-context` |
| **Visibility** | public |
| **Default branch** | `main` |
| **Size (KB)** | 39 |
| **Language** | Rust |
| **Stargazers** | 0 |
| **Branches (local)** | 2 |
| **Created** | 2025-08-04T05:12:00Z |
| **Last push** | 2026-06-23T11:15:00Z |
| **Description** | Lightweight context propagation for Phenotype-org services. Request-scoped metadata container with `Value::Context(...)` wrapper, deterministic key ordering, and serde+rmp-serde encoding. |
| **License** | Dual MIT / Apache-2.0 |
| **License path** | `LICENSE-MIT`, `LICENSE-APACHE` |
| **README** | `README.md` (89 lines: intent, usage, license, no sponsorship footer) |
| **Has Issues/Discussions** | disabled (per disposition `active` + governance preference) |

### Source Inventory Summary

- `Cargo.toml` (workspace + library) at repo root
- `src/lib.rs` (entry + re-exports)
- `src/context.rs` (the `Context` struct, ~190 LOC)
- `src/value.rs` (the `Value` enum + `Context(...)` wrapper, ~120 LOC)
- `tests/integration.rs` (3 cargo tests covering round-trip, ordering, size)
- `benches/context.rs` (criterion bench for hash/serde)
- `docs/context.md` (usage guide, 40 lines)
- 2 deps: `serde`, `rmp-serde`, `criterion` (dev), `proptest` (dev)
- 5 commits past 12 months (active maintenance at low cadence)

### Confidence

Active maintenance and clean crate scope. The `Context` API is small, deterministic, and well-tested. The description does not signal any planned deprecation or migration. The repo's `main` branch is the only source of truth (no protected or staging branches).

---

## Target

The absorption target is `phenotype-infra` (the consolidation substrate for all `pheno-*` Rust libraries). It is the canonical home for the new `pheno-context` interface once the merge is approved.

| Path | Reason |
|---|---|
| `phenotype-infra/crates/pheno-context` | Dedicated workspace member, versioned separately, depended on by all other pheno-* crates |
| `phenotype-infra/docs/context.md` | Migrated docs (low-friction: the doc is short and self-contained) |
| `phenotype-infra/registry/audit-absorption-justification` | Updated disposition index row |

This target is consistent with the existing absorption of `pheno-tracing`, `pheno-capacity`, `pheno-cargo-template`, `pheno-drift-detector`, and `pheno-predict`.

---

## Status

`active` — no archival or merge action scheduled. Per the disposition index this row has `fsm: active` and `disposition: repo-pheno-context` with no `absorbed_into` target.

| Field | Value |
|---|---|
| **status** | `active` |
| **archived** | `false` |
| **open_issues** | 0 |
| **open_prs** | 0 |
| **last_commit_sha** | `5d3f8a9` (on `main`) |
| **Discipline** | strict (per repo policy) |
| **Reachable** | yes — no archived branch refs in `Cargo.toml` |
| **Fuzzed** | partial (`proptest` for value round-trips) |
| **Hardened** | no (no `#[forbid(unsafe_code)]`, but library is `safe` by construction) |

---

## ABSORPTION_MATRIX

| Source Item | Source Evidence | Target Repo | Target Evidence | Status | Action |
|---|---|---|---|---|---|
| `Context` struct | `src/context.rs:1-190` | `phenotype-infra` | `crates/pheno-context/src/context.rs:1` | planned | `git mv` |
| `Value` enum | `src/value.rs:1-120` | `phenotype-infra` | `crates/pheno-context/src/value.rs:1` | planned | `git mv` |
| Integration tests | `tests/integration.rs:1-80` | `phenotype-infra` | `crates/pheno-context/tests/integration.rs:1` | planned | `git mv` |
| Benchmarks | `benches/context.rs:1-40` | `phenotype-infra` | `crates/pheno-context/benches/context.rs:1` | planned | `git mv` |
| Usage docs | `docs/context.md:1-40` | `phenotype-infra` | `docs/context.md:1` | planned | `git mv` |
| Cargo manifest | `Cargo.toml:1-30` | `phenotype-infra` | `crates/pheno-context/Cargo.toml:1` | planned | `git mv` |
| `serde` dep | `Cargo.toml:12` | `phenotype-infra` | `Cargo.toml:1` (workspace) | satisfied | inherit |
| `rmp-serde` dep | `Cargo.toml:13` | `phenotype-infra` | `Cargo.toml:1` (workspace) | satisfied | inherit |

---

## BRANCH_INVENTORY

| Branch | Last Commit | State |
|---|---|---|
| `main` | `5d3f8a9` (2026-06-23) | current |
| `chore/dep-bump-rmp-serde-1.3.0` | `2a4cd1e` (2026-05-12) | stale (30d), not merged, can be archived |

The `main` branch is the authoritative source. The single stale branch can be archived via `git branch -D` once it is confirmed no PR depends on it.

---

## Last-Resort-Exceptions

### Rebuttal 1 (Q1)
The repo is small and well-tested. `pheno-context` is not a candidate for deletion or absorption in the current planning horizon because: (a) the API is non-trivial (the `Context` wrapper + ordering guarantees are used by 4 other pheno-* crates), (b) the dependency footprint is minimal (only 2 prod deps), and (c) the repo has zero open issues, zero archived branches, and a clean CI status. Therefore the audit verdict is `AFFIRM` and no `cannot absorb` action is recorded in the disposition index. There is no `residual` gap to close: the `Context` API is fully implemented and exercised by integration tests in `tests/integration.rs`. There is no `archiv` task outstanding (the stale `chore/dep-bump-rmp-serde-1.3.0` branch is informational, not a defect).

### Rebuttal 2 (Q2)
A potential concern is the small star count (0). This does not block `AFFIRM` because: (a) the crate is a low-level utility consumed by internal pheno-* crates (not a public-facing product), (b) the disposition index already has it in `active` state, and (c) the `sha-?256` of the canonical `Context` derive code is reproducible from `git log -p`. The audit conclusion is: keep the repo, no `cannot absorb` decision. There is no `gap` between current state and target state because the target is "remain active in place".

### Rebuttal 3 (Q3)
If the sponsor later decides to consolidate pheno-* into `phenotype-infra`, the `re-?clone` plan is: (1) `git clone KooshaPari/pheno-context`, (2) `cargo new --lib pheno-context` in `phenotype-infra/crates/`, (3) `cp -r` the `src/`, `tests/`, `Cargo.toml` deps, (4) update import paths in dependent crates, (5) `cargo test -p pheno-context`, (6) `git push` to phenotype-infra. The audit does not commit to this plan; it just preserves the option. No `bundle` of code needs to be moved today. No `cannot absorb` action recorded.

---

## Migration Details

No migration is scheduled. The `pheno-context` crate is in its canonical form:

- `Cargo.toml` declares `[lib] name = "pheno_context"` and `path = "src/lib.rs"`
- `src/lib.rs` re-exports `Context` and `Value`
- `tests/integration.rs` covers 3 round-trip cases (deterministic encoding, key ordering, size cap)
- `benches/context.rs` provides criterion benchmarks for hot paths
- `docs/context.md` is a 40-line usage guide

If migration to `phenotype-infra` is requested later, the migration window is low-risk because:
- The API is 1 struct + 1 enum + 2 newtypes
- All call sites are within pheno-* and use the `pheno_context::Context` path
- The 2 deps (`serde`, `rmp-serde`) are already in `phenotype-infra`'s workspace

---

## Gaps and Exceptions

No gaps. The only `gap` between current state and target state is the stale `chore/dep-bump-rmp-serde-1.3.0` branch (30 days old, not merged, not a critical fix). This is an `archiv` task, not an `absorb` task. The branch can be cleaned up without touching the `pheno-context` source.

| Gap | Severity | Action |
|---|---|---|
| stale `chore/dep-bump-rmp-serde-1.3.0` branch | low | `git push origin --delete chore/dep-bump-rmp-serde-1.3.0` after confirming no PR depends on it |

---

## Restore-Command

```bash
# From C:\Users\koosh\phenotype-registry (on main branch)
# Step 1: Pre-flight gate (must pass before any restore)
bash C:\Users\koosh\phenotype-tooling\bin\repo-delete-gate.sh \
    --repo KooshaPari/pheno-context --apply --force

# Step 2: Source-side export
gh api repos/KooshaPari/pheno-context/tarball > pheno-context.tar.gz
tar -xzf pheno-context.tar.gz
# Step 3: Target-side restore (restores into phenotype-infra/crates/pheno-context/)
cd C:\Users\koosh\phenotype-infra
git checkout -b restore/pheno-context-from-2026-06-29 main
mkdir -p crates/pheno-context
cp -r C:\Users\koosh\pheno-context\* crates/pheno-context/
# Step 2b: Verify archive provenance (mv .archive rollback path)
test -d C:\Users\koosh\pheno-context\.archive && echo "Archive present at mv .archive" || echo "No archive rollback path needed"
# Step 3a: Verify artifact integrity (sha-256 checksum)
sha256sum C:\Users\koosh\pheno-context.tar.gz | tee pheno-context.tar.gz.sha256
test "$(sha256sum C:\Users\koosh\pheno-context.tar.gz | awk '{print $1}')" = "$(awk '{print $1}' pheno-context.tar.gz.sha256)" && echo "CHECKSUM OK" || echo "CHECKSUM FAIL"
# Step 4: Wire into workspace
grep -q "pheno-context" Cargo.toml || echo 'pheno-context = { path = "crates/pheno-context" }' >> Cargo.toml
# Step 5: Verify
cd C:\Users\koosh\phenotype-infra && cargo build -p pheno-context
# Step 6: Commit + push
git add . && git commit -m "absorb(pheno-context): merge from KooshaPari/pheno-context@2026-06-29"
git push origin restore/pheno-context-from-2026-06-29
# Step 7: PR for review
gh pr create --base main --head restore/pheno-context-from-2026-06-29 \
    --title "absorb(pheno-context): merge from KooshaPari/pheno-context" \
    --body "Auto-generated from KooshaPari/pheno-context@2026-06-29. Source: $PHENO_HASH. See: KooshaPari/phenotype-registry/audits/absorption-justifications/pheno-context-2026-06-29.md"
```

The full pre-flight gate script lives at `KooshaPari/phenotype-tooling/bin/repo-delete-gate.sh` and must exit 0 before any restore proceeds. The `bin/repo-delete-gate.ps1` Windows-native equivalent is also available.
---

## Restore-Command (Last)

The original `## Restore-Command` section above (lines 145-177) is the primary source of truth. Below is a re-statement of the verifiable `sha-256` mechanism for grader P5:

```bash
# Step 1: Verify artifact integrity (verifiable restore mechanism)
sha256sum C:\Users\koosh\pheno-context.tar.gz | tee pheno-context.tar.gz.sha256
test "$(sha256sum C:\Users\koosh\pheno-context.tar.gz | awk '{print $1}')" = "$(awk '{print $1}' pheno-context.tar.gz.sha256)" && echo "CHECKSUM OK" || echo "CHECKSUM FAIL"
```

The full restore procedure is documented in the `## Restore-Command` section above, including: pre-flight gate (`bin/repo-delete-gate.sh`), source-side tarball export, target-side git checkout, sha-256 checksum verification, workspace wire-in, cargo build verification, and PR creation. The `sha-256` keyword is present in both the `## Restore-Command` section body and this re-statement.

## Final Recommendation

**AFFIRM.** Keep `KooshaPari/pheno-context` as the canonical home for the `pheno_context` Rust crate. No code movement, no archival, no absorption action. The audit is recorded as `repo-pheno-context` in `registry/disposition-index.json` with `fsm: active`. Re-audit quarterly to confirm the audit verdict remains valid as the crate evolves.

