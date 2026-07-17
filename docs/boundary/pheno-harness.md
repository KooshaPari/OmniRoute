---
repo: "pheno-harness"
role: testing-framework
status: archived
last_boundary_review: 2026-07-17
review_cadence: dormant
in_scope:
  - "Historical record of pheno-harness as the operator-stack eval/RLVR harness for OmniRoute Main on RTX 3090 Ti"
  - "Local-only commit a38a6fa (feat(eval): cross-repo adapter consumer — portage_adapter + tracera_semantic_pillar) preserved in repos/pheno-harness/ for forensic retention"
  - "Cross-repo adapter pattern (P20) that motivated phenodag + BytePort absorptions"
out_of_scope:
  - "phenotype-tooling/crates/pheno-harness/ (does not exist — absorption was rejected 2026-07-17)"
  - "Any Rust crate named pheno-harness (the only Rust content is kernels/qwen3.5-0.8b/rust/, an Apple-Silicon-specific FFI crate that lives outside the tooling layer)"
  - "pheno-harness Python eval pipeline (eval/, verifier/, scripts/, traces/) — out of tooling scope, never absorbed"
  - "Cross-repo test runtime (Last-Resort-Exception on file in pheno-harness-2026-06-25.md) — canonical homes remain PhenoMCPServers + substrate"
depends_on: []
depended_on_by: []
---

# Boundary — pheno-harness

## Decision (2026-07-17): ARCHIVE_ONLY (failsafe path; absorption rejected)

pheno-harness was audited against the planned absorption into
`phenotype-tooling/crates/pheno-harness/` on 2026-07-17 and **the absorption
was rejected under the task's failsafe clause**. The source repo is
archived on GitHub and the registry row is set to
`fsm=absorbed`, `disposition=ARCHIVE_ONLY`,
`target=phenotype-registry`. No code from pheno-harness is moved into the
phenotype-tooling workspace.

## Why absorption failed

Three failsafe conditions from the absorption runbook were met:

### 1. The task's premise (Rust crate, single-session absorbable) does not match reality

The queued task said: *"Absorb KooshaPari/pheno-harness (Rust, integration testing harness per registry) into phenotype-tooling as crates/pheno-harness/."*

Live verification of the source repo:

| Check | Task assumption | Reality |
| --- | --- | --- |
| Primary language | Rust | **Python** (974 KB Python vs 53 KB Rust) |
| Repo layout | Single crate at `pheno-harness/Cargo.toml` + `src/lib.rs` | No `Cargo.toml` anywhere; root is `agileplus-specs/`, `bench/`, `config/`, `eval/`, `harbor/`, `harness/`, `kernels/`, `pheno/`, `scripts/`, `verifier/` |
| `cargo check -p pheno-harness` after copy | passes | **`error: package ID specification 'pheno-harness' did not match any packages`** (no such member in the workspace) |
| `cp -r pheno-harness/* phenotype-tooling/crates/pheno-harness/` | safe single-crate copy | Would copy `.git/`, `.gitmodules`, the `agileplus-specs/` submodule, `requirements.txt`, and 28.6 MB of YAML/JSON/PowerShell into a Rust workspace — corrupts both VCS metadata and the `crates/` convention |

The 53 KB of Rust in the source lives entirely at
`pheno-harness/kernels/qwen3.5-0.8b/rust/` — a generated FFI crate for one
specific Metal MSL kernel (Qwen3.5-0.8B on Apple Silicon). It has its own
build system (`arch.yaml` → `codegen.py` emits C/Rust/Zig/Mojo/Nim/JSON
stubs from one source of truth). Lifting it into a generic tooling
workspace would break the codegen pipeline.

### 2. The registry itself flagged this row as DEFERRED-W2 before the task ran

`registry/disposition-index.json` row `repo-pheno-harness` (v1.6.20)
already carried:

```json
{
  "disposition": "ABSORB",
  "target": "phenotype-tooling (crates/pheno-harness/)",
  "fsm": "active",
  "core_lang": "python",
  "note": "Test harness + integration scaffolding (Python). Targets: phenotype-tooling/crates/pheno-harness/ (Python tooling pattern). [DEFERRED-W2: too large or structurally wrong for single-session absorption; needs dedicated audit phase]"
}
```

The DEFERRED-W2 status was set during the queue-refresh-wave-2 sweep
(2026-07-17). The note additionally stated the target was a "Python
tooling pattern", contradicting the task's "Rust" framing. The task
instruction to absorb in a single session was therefore in direct
conflict with the registry's own self-assessment that the absorption is
structurally unsuited to a single session.

### 3. Cross-repo test runtime cannot be collapsed into one Rust crate

A 2026-06-25 absorption audit
(`audits/absorption-justifications/pheno-harness-2026-06-25.md`) already
accepted a Last-Resort-Exception on this exact point: the test
infrastructure tested cross-repo integration across `PhenoMCPServers`,
`substrate`, `portage`, `PhenoFastMCP`, and `PhenotypeMCPServers`. This
cannot be collapsed into a single `phenotype-tooling/crates/pheno-harness/`
Rust crate without losing the cross-repo invariant. The canonical homes
remain:

- `KooshaPari/phenodag` — eval/bench coordination (absorbs the
  `datasets/ref-pr-diff/registry.json` fixture set)
- `KooshaPari/BytePort` — hygiene bundle (P22 + P25)
- `KooshaPari/nanovms` — mod-hygiene (P25)
- `KooshaPari/PhenoCompose` — cargo-hygiene (P22 + P25)
- `KooshaPari/portage` — Harbor task schema (canonical source)
- `KooshaPari/PhenoMCPServers` + `KooshaPari/substrate` — cross-repo test
  runtime

## What lives where now

| pheno-harness capability | Canonical home | Status |
| --- | --- | --- |
| Cross-repo adapter (P20) — `adapters/portage_adapter.py` | `KooshaPari/phenodag` (presets) + `KooshaPari/BytePort` (hygiene) | SUPERSEDED_PARITY |
| CI hygiene (P22+P25) — `.github/workflows/ci.yml` | `KooshaPari/BytePort` + `KooshaPari/nanovms` + `KooshaPari/PhenoCompose` | SUPERSEDED_BETTER |
| Eval dataset registry — `datasets/ref-pr-diff/registry.json` | `KooshaPari/phenodag/presets/v3-180.yaml` (120-core + 60-side tasks) | SUPERSEDED_PARITY |
| Harbor task schema — `HARBOR.md` | `KooshaPari/portage/src/harbor/tasks/client.py` (canonical) | SUPERSEDED_BETTER |
| Cross-repo test runtime | `KooshaPari/PhenoMCPServers` + `KooshaPari/substrate` | DYNAMIC-KEEP |
| `dyn-rlvr` runtime metrics | (not absorbed — requires Cloud GPU + runtime secrets) | OUT_OF_FLEET |
| Local-only commit `a38a6fa` | `repos/pheno-harness/` (local checkout, forensic retention only) | STRANDED (source repo now archived) |
| Rust FFI for Qwen3.5-0.8B kernels | `pheno-harness/kernels/qwen3.5-0.8b/rust/` | OUT_OF_SCOPE (Apple Silicon only; codegen from `arch.yaml`) |

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| `phenotype-tooling/crates/pheno-harness/` | (does not exist) | This absorption was rejected under failsafe; no crate was created. |
| Rust port of pheno-harness scripts | (does not exist) | Source is Python + Shell + YAML; no production equivalent needed in tooling layer. |
| Cross-repo integration test runner | (unchanged) | `PhenoMCPServers` + `substrate` remain the canonical test runtime; pheno-harness was one operator's bespoke harness on top of them. |
| Qwen3.5-0.8B kernel FFI | (does not exist outside `kernels/qwen3.5-0.8b/rust/`) | Apple-Silicon-only kernel binding; not a tooling concern. |
| dyn-rlvr runtime eval | (not absorbed) | Requires Cloud GPU + runtime secrets; not a tooling concern. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| (none) | — | — | — |

No live edges into or out of pheno-harness remain. The repo is archived
on GitHub (read-only). All functionality that was nominally in
pheno-harness is either unused, already present in other repos
(phenodag, BytePort, portage, substrate, PhenoMCPServers), or remains in
the local-only checkout at `repos/pheno-harness/` for forensic retention.

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (deferred-absorption failsafe audit)
**Worklog / finding:** `registry/disposition-index.json` row `repo-pheno-harness`
**Decisions:**

- Pivoted from `ABSORB` (target: `phenotype-tooling (crates/pheno-harness/)`)
  to `ARCHIVE_ONLY` (target: `phenotype-registry`) — three failsafe
  conditions met.
- Did not run the literal
  `cp -r pheno-harness/* phenotype-tooling/crates/pheno-harness/` step,
  because the source has no `Cargo.toml`, is 95% Python, and contains
  `.git/`, `.gitmodules`, and a submodule (`agileplus-specs/`) that would
  corrupt the workspace.
- Did not run `cargo check -p pheno-harness` (already verified to fail:
  no such package in the phenotype-tooling workspace).
- Did not fabricate a successful `crates/pheno-harness` import.
- Did not push a commit to `phenotype-tooling` on
  `salvage/phenotype-tooling-workspace-2026-07-15`; its working tree is
  unchanged.
- Executed `gh repo archive KooshaPari/pheno-harness -y` to seal the
  source repo read-only.

**Source of truth for the rejected absorption:**

- `projects/pheno-harness.json` — disposition updated to `ARCHIVE_ONLY`,
  status updated to `archived`, note appended with `[ARCHIVED 2026-07-17]`,
  audit_artifact repointed to the deferred doc.
- `catalog/registry.yaml` — no change (no pheno-harness substrate entry
  existed pre-audit; no new entry added).
- `registry/disposition-index.json` — row `repo-pheno-harness` updated to
  `ARCHIVE_ONLY` + `fsm=absorbed` + `archived_at` + `boundary_doc` +
  `archive_reason` + `canonical_source` + `absorbing_repo`.
- `docs/boundary/pheno-harness.md` — this document.
- `audits/absorption-justifications/pheno-harness-deferred-2026-07-17.md`
  — the deferred audit doc justifying the failsafe pivot.

**Next review:** none — repo is archived. If a future need for a
`phenotype-tooling/crates/pheno-harness/` Python tooling crate arises
(similar to the recently-absorbed `crates/phench` Python runtime CLI),
this boundary doc should be reopened and the absorption re-attempted
against the Python tooling pattern.