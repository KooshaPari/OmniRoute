---
repo: "PhenoVCS"
role: vcs
status: archived
last_boundary_review: 2026-07-17
review_cadence: dormant
in_scope:
  - "Self-declared VCS primitives workspace (Rust 2021, edition 1.75)"
  - "airlock-v2: conservative git auto-commit/push daemon (Rust port of airlock-v2.py)"
  - "worktree-manager: git worktree automation CLI (wtm binary)"
  - "phenovcs-observability: thin re-export of pheno-tracing substrate"
out_of_scope:
  - "pheno-vcs-core (stub crate; only contains an assert!(true) test, no real primitives)"
  - "phenotype-infrastructure (sibling name collides with pheno/crates/phenotype-infrastructure)"
  - "VCS primitives consumed by pheno (those already live in pheno's phenotype-git-core / agileplus-git / pheno-plugins-git / agileplus-github)"
depends_on: []
depended_on_by: []
---

# Boundary — PhenoVCS

## Decision (2026-07-17): ARCHIVE_ONLY (no absorption into pheno monorepo)

PhenoVCS was audited against the planned absorption into `pheno/crates/pheno-vcs/`
on 2026-07-17 and **the absorption was rejected**. The source repo is archived on
GitHub and the registry row is set to `fsm=absorbed`, `disposition=ARCHIVE_ONLY`,
`target=phenotype-registry`. No code from PhenoVCS is moved into the pheno monorepo.

## Why absorption failed

Both fallback conditions from the absorption runbook were met, so the
ARCHIVE_ONLY disposition was chosen:

### 1. pheno already has overlapping VCS crates

`pheno/crates/` already contains four VCS/git-adjacent crates, each with a
clear, owned scope:

| pheno crate | Owns |
| --- | --- |
| `phenotype-git-core` | Canonical git primitives shared across the workspace |
| `agileplus-git` | AgilePlus domain git operations |
| `agileplus-github` | GitHub-API adapter for AgilePlus |
| `pheno-plugins-git` | Plugin-host git transport |

A new `crates/pheno-vcs` would create ambiguity about ownership of git
primitives, worktree management, and remote adapters. Adding a fifth crate
to clarify work would only obscure the existing boundaries.

### 2. PhenoVCS is not absorbable as a single `pheno-vcs` crate

The absorption task assumed `PhenoVCS/src`, `PhenoVCS/tests`, and
`PhenoVCS/Cargo.toml` were the inputs for a single-crate copy. That
assumption does not hold:

- `PhenoVCS/Cargo.toml` is a **workspace manifest** with five member
  crates (`airlock-v2`, `pheno-vcs-core`, `phenotype-infrastructure`,
  `phenovcs-observability`, `worktree-manager`). There is no `PhenoVCS/src/`
  or `PhenoVCS/tests/` at the repo root.
- The only crate matching the target name, `pheno-vcs-core`, is a **stub**:
  nine lines of code with a single `assert!(true)` test and zero VCS logic.
  Copying it would copy nothing meaningful.
- `crates/phenotype-infrastructure/` (a PhenoVCS member) collides on name
  with `pheno/crates/phenotype-infrastructure/` and is itself empty (just a
  `Cargo.lock` file).
- `crates/worktree-manager/Cargo.toml` declares `pheno-tracing.workspace = true`
  and `phenovcs-observability = { path = "../phenovcs-observability" }`, but
  `pheno-tracing` is **not** declared in `PhenoVCS/[workspace.dependencies]`,
  so the workspace cannot resolve.
- `PhenoVCS/[workspace.dependencies]` pins `clap-ext = { git = "https://github.com/KooshaPari/clap-ext", tag = "v0.1.0" }`,
  a vendored git dep with no path-replacement story in pheno.

Net effect: a literal `cargo check -p pheno-vcs` would fail because there is
no crate to check; the planned `cp -r PhenoVCS/src PhenoVCS/tests` would
fail because those paths do not exist.

## What was actually in PhenoVCS (for historical record)

| Member | LoC (src) | Purpose |
| --- | --- | --- |
| `airlock-v2` | ~1836 (lib.rs + autocommit + cleanup + cli + git_ops + registry + main) | Conservative auto-save / push daemon for git repos; Rust port of `airlock-v2.py`; must remain byte-compatible with the live Python registry at `~/.airlock/v2/registry.json`. |
| `worktree-manager` | ~132 (main) + 15 (mod.rs entry) | Git worktree automation CLI; hexagonal architecture; `wtm` binary. |
| `phenovcs-observability` | ~76 | Thin re-export of `pheno_tracing::{adapters, port, compat}`; depends on `pheno-tracing` (not declared in workspace deps — broken). |
| `pheno-vcs-core` | 9 | Stub. `assert!(true)` in a test module. |
| `phenotype-infrastructure` | 0 | Empty directory containing only `Cargo.lock`. |

## Where each capability lives now

| PhenoVCS capability | Canonical home | Why |
| --- | --- | --- |
| Git primitives (commits, refs, diff) | `pheno/crates/phenotype-git-core` | Already exists; mature; used by agileplus-git and pheno-plugins-git. |
| GitHub HTTP API | `pheno/crates/agileplus-github` | Already exists; owner of GitHub-specific surface. |
| Git worktree management | `pheno/crates/agileplus-git` (proposed extension point) | Substrate shares the same hexagonal pattern; no need for a sibling crate. |
| Airlock auto-commit/push daemon (Python) | (unchanged) | Python engine at `~/.airlock/v2/` remains authoritative; the Rust port in PhenoVCS was never running in production. |
| Rust re-export of pheno-tracing | `pheno/crates/phenotype-observability` (already imports `pheno_tracing`) | The substrate is already vendored into pheno. No gap to fill. |

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| `crates/pheno-vcs` | (does not exist) | This absorption was rejected; no crate was created. |
| Rust port of airlock-v2 | (does not exist in pheno) | Python engine is the production daemon; the Rust port was never deployed. Re-evaluate only if the Python engine is retired. |
| `worktree-manager` CLI (`wtm`) | (does not exist in pheno) | Existing `agileplus-git` covers domain worktree ops; CLI tools belong with the agileplus CLI. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| (none) | — | — | — |

No live edges into or out of PhenoVCS remain. The repo is archived; all
functionality that was nominally in PhenoVCS is either unused, already
present in pheno, or remains with the Python engine.

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (absorption audit, batch4)
**Worklog / finding:** `registry/disposition-index.json` row `repo-PhenoVCS`
**Decisions:**

- Pivoted from `ABSORB` (target: `pheno (crates/pheno-vcs)`) to
  `ARCHIVE_ONLY` (target: `phenotype-registry`) — both fallback conditions
  from the absorption runbook were met.
- Did not run the literal `cp -r PhenoVCS/src PhenoVCS/tests PhenoVCS/Cargo.toml
  PhenoVCS/README.md pheno/crates/pheno-vcs/` step, because `PhenoVCS/src`
  and `PhenoVCS/tests` do not exist (PhenoVCS is a workspace, not a single
  crate) and the only matching member (`pheno-vcs-core`) is a stub.
- Did not run `cargo check -p pheno-vcs` because no `pheno-vcs` crate was
  registered; the failure mode is "no such crate" rather than a build
  error.
- Did not fabricate a successful `crates/pheno-vcs` import.

**Source of truth for the rejected absorption:**

- `projects/PhenoVCS.json` — disposition updated to `ARCHIVE_ONLY`,
  `absorbed_into` updated to `phenotype-registry`, note appended with
  `[ABSORBED 2026-07-17]`.
- `catalog/registry.yaml` — `phenovcs` substrate entry updated to mirror
  the rejected absorption.
- `registry/disposition-index.json` — row `repo-PhenoVCS` updated.
- `docs/boundary/PhenoVCS.md` — this document.

**Next review:** none — repo is archived. If a future need for a
`crates/pheno-vcs` arises (e.g., the Python airlock engine is retired or
agileplus-git loses worktree ownership), this boundary doc should be
reopened and the absorption re-attempted against a single-crate source.