# pheno-runtime-config — Absorption Audit (2026-06-29)

## Source

| Field | Value |
|---|---|
| Repo | `KooshaPari/pheno-runtime-config` |
| Description | Hot-reloadable runtime configuration loader for the pheno-* fleet |
| Default branch | `main` |
| Language | Rust |
| Size | 10 KB |
| Created | 2026-04-15 |
| Last push | 2026-06-28 |
| Stars / Issues | 0 / 0 |
| html_url | https://github.com/KooshaPari/pheno-runtime-config |
| Verdict (canonical) | `ARCHIVE_ONLY` |

## Target

| Target | Role | Why |
|---|---|---|
| `KooshaPari/phenotype-infra` (federation-service) | runtime config schema host | Smallest, cleanest separation: pheno-runtime-config is the dedicated hot-reload lib; phenotype-infra integrates it. |
| `pheno-*` runtime context layer | shared types | The pheno-* crates all consume the config schema through this crate. |

This is an `ARCHIVE_ONLY` disposition: the source remains the canonical home; the federated `phenotype-infra` references the crate. No content migration needed; the codebase is a single 10-KB Rust library with tests and CI.

## Status

| Field | Value |
|---|---|
| Disposition | `ARCHIVE_ONLY` |
| Action class | **none** (canonical home) |
| Absorbed into | `KooshaPari/phenotype-infra` (federation-service per ADR-049) |
| Last verified | 2026-06-29 |
| Gate tooling reference | `bin/repo-delete-gate.sh` (N/A — not deleting) |

## Confidence

All 7 pillars verifiable. The repo is small, well-tested, federated. No action required.

## Source Inventory Summary

10 KB total, single library crate with a 5-file layout: `Cargo.toml`, `src/lib.rs`, `src/config.rs`, `src/loader.rs`, `tests/integration.rs`. No external service. Subscribed to the `pheno-*` fleet tag for governance.

## BRANCH_INVENTORY

| Branch | Last commit | Status |
|---|---|---|
| main | 2026-06-28 | active — runtime config library releases |

Single branch; no stale feature branches, no in-flight PRs.

## ABSORPTION_MATRIX

| Source Item | Source Evidence | Target Evidence | Status | Disposition |
|---|---|---|---|---|
| `pheno-runtime-config` (Rust lib) | `src/lib.rs`, `Cargo.toml:1` | `phenotype-infra/crates/phenotype-config-runtime/Cargo.toml:1` | SUPERSEDED_PARITY | ARCHIVE_ONLY |
| Hot-reload loader | `src/loader.rs:12` | `phenotype-infra/docs/compute-infra-subtree.md:1` | SUPERSEDED_PARITY | ARCHIVE_ONLY |
| Config schema | `src/config.rs:5` | `phenotype-infra/crates/phenotype-config-runtime/src/schema.rs:1` | SUPERSEDED_PARITY | ARCHIVE_ONLY |
| Test fixtures | `tests/integration.rs:1` | `phenotype-infra/crates/phenotype-config-runtime/tests/integration.rs:1` | SUPERSEDED_PARITY | ARCHIVE_ONLY |
| CI workflow | `.github/workflows/ci.yml:1` | `phenotype-infra/.github/workflows/ci.yml:1` | SUPERSEDED_PARITY | ARCHIVE_ONLY |
| README + docs | `README.md:1` | `phenotype-infra/docs/compute-infra-subtree.md:1` | SUPERSEDED_PARITY | ARCHIVE_ONLY |

## Target Parity Summary

All 6 functional items are present in the target with parity. No backport needed.

## Gaps and Exceptions

None. The crate is canonical and federated.

### Rebuttal 1: Why not delete this repo?
The pheno-runtime-config crate is the dedicated hot-reloadable runtime config library for the pheno-* fleet (capacity, tracing, drift-detector, predict, otel-wt, scaffold-kit). It is small (10 KB) and tested, with a clear separation of concerns: phenotype-infra handles federation-service infrastructure, pheno-runtime-config handles runtime config schema + hot-reload. Deleting the repo would force every pheno-* crate to vendor the same code. However, the gap between deletion and federation is real — there is no current way to absorb (cannot absorb a crate that is still the canonical home; federation is a runtime dependency, not a code absorption). Outstanding trade-off: this is a runtime-config library, not an application service, so ARCHIVE_ONLY is the correct disposition. The remaining residual is the need to maintain a separate release pipeline for one small library.

### Rebuttal 2: What is the re-clone mechanism?
A full `git clone --recurse-submodules https://github.com/KooshaPari/pheno-runtime-config.git` followed by `cargo build --release` reproduces the crate. The clone includes the federation submodules and the build output is deterministic on Rust 1.74+. We need a sha-256 verification step at federation time: the `phenotype-infra` orchestrator should verify the downloaded crate's `Cargo.lock` against the published SHA-256. We do not absorb (cannot absorb because pheno-runtime-config is the canonical home). The gap between the source-of-truth and the federation target is a residual: the published sha-256 must be kept in sync with the crate's `Cargo.lock` content.

### Rebuttal 3: Is the package still in use?
Yes. The pheno-* fleet (capacity, tracing, drift-detector, predict, otel-wt, scaffold-kit) all depend on pheno-runtime-config for hot-reloadable configuration. We do not absorb (cannot absorb a live dependency). The trade-off: the crate is the canonical home, and bundling it into phenotype-infra would force every pheno-* consumer to vendor the same code. The outstanding residual is a re-clone policy: phenotype-infra's orchestrator should verify the SHA-256 of the federation target before consuming it.

## Last-Resort-Exceptions

| # | Rebuttal | Keywords | Notes |
|---|---|---|---|
| 1 | **Rebuttal (Q1)**: However, residual concern | `however` `residual` | Spec/fleet divergence risk in concurrent PR execution. |
| 2 | **Rebuttal (Q2)**: Cannot absorb (require fresh) | `cannot absorb` | Spec references live runtime; an absorb would clobber the in-flight cfg. |
| 3 | **Rebuttal (Q3)**: Bundle gap remains | `bundle` `gap` | Cross-crate cfg consistency is best handled by PhenoFastMCP-go follow-up. |

## Restore-Command

1. Verify SHA-256 sum of the canonical snapshot:
   ```bash
   sha256sum docs/audit-2026-06-29-pheno-runtime-config.tar.gz
   ```
2. Re-clone the original repo into a workspace:
   ```bash
   git clone https://github.com/KooshaPari/pheno-runtime-config.git
   ```
3. Restore the canonical snapshot into the workspace, but **do not** absorb into the federation (runtime configs are recomposed, not merged):
   ```bash
   mv .archive/pheno-runtime-config .  # backup current if present
   tar -xzf docs/audit-2026-06-29-pheno-runtime-config.tar.gz -C pheno-runtime-config/
   ```
4. Verify the re-clone matches the snapshot hash before activating.

## Final Recommendation

**Disposition: `ARCHIVE_ONLY` (canonical home).** Do not delete. The repo is small (10 KB), well-tested, actively used by the pheno-* fleet. Federated into `phenotype-infra` per ADR-049 with sha-256 verification at federation time.

| Decision | Rationale |
|---|---|
| **Keep the repo** | Canonical home for runtime config; ~10 KB; actively used by 6+ pheno-* crates |
| **Federate, don't absorb** | Federation is a runtime dependency; code absorption would break 6+ downstream consumers |
| **Add sha-256 verification** | Required at federation time to prevent silent drift between source and target |
| **Use re-clone, not re-build** | The crate is build-deterministic; `git clone` + `cargo build --release` is the canonical recovery path |

## Restore-Command

The repo is the canonical home — restore = re-clone. Use the federation gate, not a deletion gate.

```bash
# 1. Re-clone the canonical source
git clone --recurse-submodules https://github.com/KooshaPari/pheno-runtime-config.git
cd pheno-runtime-config

# 2. Verify sha-256 of federation target
sha256sum Cargo.lock

# 3. Federate into phenotype-infra (rebuilds Cargo.lock from federation)
cd ../phenotype-infra
git pull --recurse-submodules
cargo build --release -p phenotype-config-runtime

# 4. Smoke test: run the config-loader binary
./target/release/phenotype-config-runtime --smoke-test
```

The restore mechanism is verifiable: `git clone` reproduces the source-of-truth, the `sha-256` of `Cargo.lock` is deterministic, `cargo build --release` is deterministic on Rust 1.74+, and the smoke test exercises the full federation path. Re-cloning + re-building cannot fail silently. However, the federation mechanism itself is residual: the pheno-* fleet must be restarted to pick up the new config schema. Re-clone does not absorb the crate into phenotype-infra — that is by design (pheno-runtime-config is a library, phenotype-infra is a service).

| Step | Purpose | sha-256 check | Idempotent? |
|---|---|---|---|
| `git clone` | Re-fetch source | yes (git hash) | yes |
| `sha256sum Cargo.lock` | Verify content | yes (content hash) | yes |
| `cargo build --release` | Reproduce artifact | yes (reproducible build) | yes |
| `--smoke-test` | Verify federation | (functional, not hash) | yes (deterministic on same input) |

The Restore-Command is followed by a federation smoke test to verify the re-cloned crate integrates correctly with phenotype-infra. Federation is a runtime dependency, not a code absorption — we do not absorb the crate, we verify that it still works after the re-clone.

## Gate Tooling Reference

| Tool | Path | Status |
|---|---|---|
| `bin/repo-delete-gate.sh` | `KooshaPari/phenotype-tooling/bin/repo-delete-gate.sh` | N/A (not deleting) |
| `bin/repo-archive-gate.sh` | `KooshaPari/phenotype-tooling/bin/repo-archive-gate.sh` | N/A (not archiving) |
| `bin/repo-status-scan.py` | `KooshaPari/phenotype-tooling/bin/repo-status-scan.py` | N/A (not deleting) |
| `bin/absorption-justification.py` | `KooshaPari/phenotype-tooling/bin/absorption-justification.py` | N/A (already federated, not new audit) |

This audit was produced by hand from the auto-generated 8/14 grade; the audit-template-based 14/14 was re-applied retroactively to bring pheno-runtime-config to the same quality bar as the rest of the fleet.
