# ADR-ECO-022: Compute/Infra subtree — registry status correction for BytePort and nanovms

**Status:** Accepted (2026-06-23)
**Deciders:** forge session (Phase 1 of `plans/2026-06-22-compute-infra-dag-v1.md`)
**Refs:** [ADR-ECO-007](./ADR-ECO-007-gateway-merge-superset.md) (Gateway
merge — PhenoCompose/nanovms are AFFIRM in `phenotype-tooling`),
`phenotype-registry/ECOSYSTEM_MAP.md` (canonical index),
`phenotype-registry/BOUNDARY_OWNERS.md` (capability SSOT),
[ADR-ECO-018](./ADR-ECO-018-phenotype-infra-path-dep-hygiene.md)
(path-dep hygiene — sibling),
[ADR-ECO-019](./ADR-ECO-019-nanovms-sandbox-hardening.md) (nanovms
sandbox hardening).

## Context

`phenotype-registry/ECOSYSTEM_MAP.md` (line 47) lists BytePort and
nanovms in the `superseded/archived` row. ADR-ECO-007 (2026-06-17)
explicitly **AFFIRM**'d both:

> ### Engine / isolation layer (keep separate)
> | **PhenoCompose** | `platform` | **AFFIRM** NVMS + process-compose isolation owner |
> | **nanovms** | `platform` | **AFFIRM** in `phenotype-tooling` (archived standalone repo) |

The 2026-06-22 audit confirmed that the live code is healthy:

- **BytePort**: 13 GitHub Actions workflows, Tauri 2.x desktop
  binary, live `backend/` Go 1.25 module, 236MB of source
  (incl. vendored deps). The BP-001 hygiene pass removed
  -445 LOC of dead code and hardened `tauri.conf.json`. Net
  commit `ceb703df` (235+/445-).
- **nanovms**: Go 1.23 module builds cleanly (`go build ./...`
  GREEN), all 10 packages pass tests, the AGENTS.md is now
  accurate, the path-dep + sandbox hardening is in commit
  `fb44633` + `5307653` + `dd7e7b0`. The `cmd/nanovms/`
  multi-platform CLI is the **active** entry point; the
  `cmd/nvms/` legacy single-tier CLI is the **deprecated**
  one (deprecation tracked in ADR-035).
- **PhenoCompose**: 5 GitHub Actions workflows, hex port
  library with `#![forbid(unsafe_code)]` and
  `#![deny(missing_docs)]`, FFI surface, driver, TS
  packages, Mojo/Zig experimental bindings. The PC-001
  cuda-feature cleanup is in commit `aebf3be`.
- **phenotype-infra**: 4 active daemons, 5-crate iac
  workspace, all builds + tests green (commit `b53bbe3`).

The `superseded/archived` row in ECOSYSTEM_MAP.md is therefore
**inconsistent with the live state** of these four repos. It was
written in 2026-06-17 as part of the broader rationalization wave
that DID archive 49 other repos (e.g. phenotype-voxel, phenoVessel,
worktree-manager) — but the four compute/infra repos in this
subtree were **not** part of that archive wave. They were
incorrectly swept into the same row by the auto-generated
rationalization script.

## Decision

1. **Remove BytePort and nanovms** from the
   `superseded/archived` row in `ECOSYSTEM_MAP.md`.
2. **Move BytePort to the `product / app` row** (line 41),
   alongside thegent, Tracera, PlayCua, Dino, etc.
3. **Move nanovms to the `shared-lib` row** (line 36), alongside
   phenokits-commons, Authvault, FocalPoint, PhenoVCS, etc.
4. **Update the count** for the `superseded/archived` row from
   49 → 47 (still 47 other repos, including the original
   phenotype-voxel etc. wave).
5. **Add a `note` field** to each of the four compute/infra
   boundary files pointing to this ADR.
6. **Add a new "Compute/Infra Subtree" section** to the
   `ECOSYSTEM_MAP.md` (or a new `docs/compute-infra-subtree.md`
   document, since ECOSYSTEM_MAP.md is already 636 lines) that
   lists the four repos as a coherent cluster with the
   cross-repo dependency graph.

## Rationale

- **Honour ADR-ECO-007's AFFIRM** — the registry's own
  authoritative decision (ADR-ECO-007) is contradicted by
  the ECOSYSTEM_MAP.md row. The registry's role split
  (line 14-23) explicitly says "when another index disagrees
  with this one about repo roles or dependencies, this file
  wins" — but in this case the index itself is wrong.
- **Match the live state** — the audit found all four repos
  active and healthy.
- **Avoid consumer confusion** — downstream agents (thegent,
  BytePort's Tauri app, the phenodag state machine) consume
  these repos. A false-archived signal would cause consumers
  to skip updates or look for substitutes that don't exist.

## Consequences

- `ECOSYSTEM_MAP.md` row counts change: `superseded/archived`
  49 → 47; `product/app` 10 → 11; `shared-lib` 22 → 23.
- `docs/compute-infra-subtree.md` is a new document.
- The four boundary files
  (`docs/boundary/{phenotype-infra,PhenoCompose,BytePort,
  nanovms}.md`) are updated.
- The `phenotype-registry/STATUS.md` and `STATUS-REPORT.md`
  may need a corresponding update (next pass).
- The `findings/2026-06-18-L5-104-*` archive-proof documents
  (which the registry cites) are not affected — they were
  about the correct archive wave (phenotype-voxel etc.),
  not these four repos.

## Alternatives considered

- **A: Archive BytePort and nanovms for real** — would
  require ripping out the Tauri app + the native VMM layer
  from the Phenotype compute mesh. The mesh relies on
  them. Rejected.
- **B: Add a new `deprecated/legacy-archived` row** — too
  fine-grained; the existing `superseded/archived` row is
  the right place. Rejected.
- **C: Leave the row as-is and add a `note:` override
  inline** — technically possible but visually noisy. The
  row count is wrong either way; better to move the rows
  cleanly.
