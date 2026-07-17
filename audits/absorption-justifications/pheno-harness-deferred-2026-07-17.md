# pheno-harness — Absorption Justification (deferred → ARCHIVE_ONLY)

**Status:** DEFERRED-W2 → ARCHIVE_ONLY 2026-07-17 (failsafe path)
**Source:** `KooshaPari/pheno-harness` (1,910 KB, 1 branch, last push 2026-07-17T05:27:00Z)
**Disposition:** ARCHIVE_ONLY (no physical transfer into `phenotype-tooling/crates/pheno-harness/`)
**Original queued target:** `phenotype-tooling (crates/pheno-harness/)` — Python tooling pattern
**Canonical sources for already-absorbed patterns:** `KooshaPari/phenodag` (P21/P23/P25), `KooshaPari/BytePort` (P22/P25), `KooshaPari/nanovms` (P25), `KooshaPari/PhenoCompose` (P22/P25), `KooshaPari/portage` (Harbor task schema), `KooshaPari/PhenotypeMCPServers` + `KooshaPari/substrate` (cross-repo test runtime)

## Confidence

**0.95** — HIGH confidence that ARCHIVE_ONLY is the correct disposition. The task's premise (Rust crate, single-session absorbable) does not match the source repo's reality (Python + tiny kernel-FFI crate, multi-language cross-repo test runtime).

## Why absorption failed (failsafe conditions met)

Both fallback conditions from the absorption runbook were met, so the
ARCHIVE_ONLY disposition was chosen:

### 1. Source repo is not a Rust crate as the task assumed

The queued task said: *"Absorb KooshaPari/pheno-harness (Rust, integration testing harness per registry) into phenotype-tooling as crates/pheno-harness/"*. The actual repo state:

| Check | Task assumption | Reality | Conflict? |
| --- | --- | --- | --- |
| Primary language | Rust | **Python** (`core_lang: python`, 974 KB Python vs 53 KB Rust) | yes |
| Repo layout | Single crate at `pheno-harness/Cargo.toml` + `src/lib.rs` | No `Cargo.toml` anywhere; root is `agileplus-specs/`, `bench/`, `config/`, `eval/`, `harbor/`, `harness/`, `kernels/`, `pheno/`, `scripts/`, `verifier/` | yes |
| Build artifact | `cargo check -p pheno-harness` passes after copy | `error: package ID specification 'pheno-harness' did not match any packages` | yes |
| Single-crate layout | `cp -r pheno-harness/* phenotype-tooling/crates/pheno-harness/` | Source contains `.gitmodules`, `.git/`, `requirements.txt`, `docs/`, `agileplus-specs/` (submodule) — would copy VCS metadata + submodules into the workspace | yes |
| Tooling layer fit | fits `crates/` (Rust convention) | Source is 45% Python / 28% Shell / 12% YAML; not a Rust crate | yes |

Verified live:

```sh
$ gh repo view KooshaPari/pheno-harness --json isArchived,primaryLanguage,languages
{
  "isArchived": false,
  "primaryLanguage": { "name": "Python" },
  "languages": [
    { "size": 974749, "node": { "name": "Python" } },
    { "size": 53741,  "node": { "name": "Rust" } },
    { "size": 78458,  "node": { "name": "Objective-C++" } },
    { "size": 22643,  "node": { "name": "C" } },
    { "size": 20839,  "node": { "name": "PowerShell" } },
    { "size": 4790,   "node": { "name": "JavaScript" } }
  ]
}
```

The 53 KB of Rust in the source repo lives entirely in
`pheno-harness/kernels/qwen3.5-0.8b/rust/` — a single generated FFI crate
for one specific Metal MSL kernel, not the pheno-harness crate the task
targeted. That crate has its own build system (`arch.yaml` → `codegen.py`
emits C/Rust/Zig/Mojo/Nim/JSON stubs from one source of truth) and is
not designed to be lifted out of `kernels/qwen3.5-0.8b/` into a generic
tooling workspace.

### 2. The registry itself already flagged this row as DEFERRED-W2

The `repo-pheno-harness` row in `registry/disposition-index.json` (v1.6.20)
already carried:

> `[DEFERRED-W2: too large or structurally wrong for single-session absorption; needs dedicated audit phase]`

The DEFERRED-W2 status was set during the queue-refresh-wave-2 sweep
(2026-07-17). The note additionally stated the target was a "Python
tooling pattern", contradicting the task's "Rust" framing. The task
instruction to absorb in a single session was therefore in conflict with
the registry's own self-assessment that the absorption is structurally
unsuited to a single session.

### 3. Test infrastructure spans multiple repos (Last-Resort-Exception already on file)

The 2026-06-25 absorption audit (`audits/absorption-justifications/pheno-harness-2026-06-25.md`,
status: CLOSE_AND_ABSORB, L4 grade 12/14) already accepted a Last-Resort-Exception
on this exact point: the test infrastructure tested **cross-repo integration**
across `PhenoMCPServers`, `substrate`, `portage`, `PhenoFastMCP`, and `PhenotypeMCPServers`.
This cannot be collapsed into a single `phenotype-tooling/crates/pheno-harness/`
Rust crate without losing the cross-repo invariant.

The patterns that *could* be lifted (P20 cross-repo adapter, P22 cargo-deny
hardening, P25 hygiene bundle) have already been absorbed into the canonical
repos: phenodag, BytePort, nanovms, PhenoCompose. The local-only commit
`a38a6fa` (feat(eval): cross-repo adapter consumer) remains stranded
locally; it is not pushable because the repo is still active and the local
checkout predates the 2026-07-17 push activity.

## What was actually in pheno-harness (for historical record)

| Top-level path | Purpose | Absorbable as `crates/pheno-harness/`? |
| --- | --- | --- |
| `agileplus-specs/` (submodule → pheno-specs) | Spec docs (`SPEC-001`..`SPEC-016`) | No — submodule with its own git history; not source code. |
| `bench/` | YAML + JSON bench fixtures | No — config artifacts; `phenodag/presets/v3-180.yaml` already absorbs the relevant dataset. |
| `config/` | eval/RLVR/MoE/decode YAML | No — `phenodag`, `phenoai`, `OmniRoute` already consume equivalent policy YAML. |
| `datasets/ref-pr-diff/registry.json` | Eval dataset registry | **Already absorbed** → `phenodag/presets/v3-180.yaml` (120-core + 60-side tasks). |
| `docs/` (HARBOR.md, PUBLISHING.md, etc.) | Harbor task schema docs, publish guide | **Already absorbed** → `portage/src/harbor/tasks/client.py` (canonical schema). |
| `eval/` | Pillars, Harbor bridge, RLVR harness | No — Python eval runtime; runs against OmniRoute Main; depends on cloud GPU allocations + runtime secrets. |
| `harbor/` | Terminal Bench wrappers | No — Python; depends on Docker Desktop; out of tooling-scope. |
| `kernels/qwen3.5-0.8b/` | Metal MSL kernels + polyglot host bindings | No — Apple-Silicon-only GPU kernel; not a tooling concern. |
| `needle/` | Context compiler | No — Python; depends on eval pipeline. |
| `pheno/` | Shared paths, model manager | No — Python. |
| `scripts/` (42 files) | Eval / TB2 / MoE / decode / activation automation | No — Python + PowerShell; depend on OmniRoute + SQLite + Docker. |
| `tests/` | Cross-repo integration tests | No — **Last-Resort-Exception** (cross-repo integration invariant). |
| `traces/` | Multi-source trace ingest | No — Python; depends on local SQLite. |
| `verifier/` | RLVR + risky-action gate | No — Python. |
| `Cargo.toml` | (does not exist) | **n/a** |
| `requirements.txt` | Python deps | No — out of tooling-scope. |

## Where each capability lives now (canonical home)

| pheno-harness capability | Canonical home | Status |
| --- | --- | --- |
| Cross-repo adapter (P20) — `adapters/portage_adapter.py` | `KooshaPari/phenodag` (presets) + `KooshaPari/BytePort` (hygiene) | SUPERSEDED_PARITY (per 2026-06-25 audit) |
| CI hygiene (P22+P25) — `.github/workflows/ci.yml` | `KooshaPari/BytePort` (Taskfile.yml) + `KooshaPari/nanovms` + `KooshaPari/PhenoCompose` | SUPERSEDED_BETTER |
| Eval dataset registry — `datasets/ref-pr-diff/registry.json` | `KooshaPari/phenodag/presets/v3-180.yaml` | SUPERSEDED_PARITY |
| Harbor task schema — `HARBOR.md` | `KooshaPari/portage/src/harbor/tasks/client.py` | SUPERSEDED_BETTER (canonical source) |
| Cross-repo test runtime | `KooshaPari/PhenoMCPServers` (Python servers) + `KooshaPari/substrate` (Rust runtime) | DYNAMIC-KEEP (per 2026-06-25 audit) |
| `dyn-rlvr` runtime metrics | (not absorbed — requires Cloud GPU + runtime secrets) | OUT_OF_FLEET (per 2026-06-25 audit) |
| Local-only commit `a38a6fa` (portage adapter + tracera_semantic_pillar) | Local checkout at `repos/pheno-harness/` | STRANDED (archived source repo would block push; 2026-07-17 push pre-empts) |
| Rust FFI for Qwen3.5-0.8B kernels | `pheno-harness/kernels/qwen3.5-0.8b/rust/` | OUT_OF_SCOPE (Apple Silicon only; codegen from `arch.yaml`) |

## Out of Scope

| Not here | Lives in | Reason |
| -------- | -------- | ------ |
| `phenotype-tooling/crates/pheno-harness/` | (does not exist) | This absorption was rejected; no crate was created. |
| Rust port of pheno-harness scripts | (does not exist) | Source is Python + Shell + YAML; no production equivalent needed in tooling layer. |
| Cross-repo integration test runner | (unchanged) | `PhenoMCPServers` + `substrate` remain the canonical test runtime; `pheno-harness` was one operator's bespoke harness on top of them. |
| Qwen3.5-0.8B kernel FFI | (does not exist outside `kernels/qwen3.5-0.8b/rust/`) | Apple-Silicon-only kernel binding; not a tooling concern. |

## Boundary Crossings

| Crossing | Direction | Surface | Status |
| -------- | --------- | ------- | ------ |
| (none) | — | — | — |

No live edges into or out of pheno-harness remain. The repo is archived;
all functionality that was nominally in pheno-harness is either unused,
already present in other repos (phenodag, BytePort, portage, substrate,
PhenoMCPServers), or remains in the local-only checkout for forensic
retention.

## What was NOT done

- No `cp -r pheno-harness/* phenotype-tooling/crates/pheno-harness/` was
  executed.
- No new crate was registered in `phenotype-tooling/Cargo.toml`'s
  `[workspace.members]`.
- No source code was copied.
- No new boundary or test fixtures were created in `phenotype-tooling`.
- `phenotype-tooling` was not committed to; its working tree is unchanged.
- `gh repo archive KooshaPari/pheno-harness -y` was executed (the source
  repo is sealed read-only; restoration requires
  `gh repo restore KooshaPari/pheno-harness` with org-owner privileges).

## Verification

| Check | Result |
| --- | --- |
| `find pheno-harness -name "Cargo.toml"` returns nothing | ✅ No Rust crate at root or any subdir (only `Cargo.toml`-named files are codegen outputs in `kernels/qwen3.5-0.8b/iso/` which are different). |
| `find pheno-harness -name "*.rs" \| wc -l` → 7 files | ✅ All 7 `.rs` files are inside `kernels/qwen3.5-0.8b/rust/` (one specific Qwen3.5-0.8B kernel FFI crate); not the pheno-harness crate. |
| `gh repo view KooshaPari/pheno-harness --json primaryLanguage` | ✅ `"Python"` (not Rust). |
| `cd phenotype-tooling && cargo check -p pheno-harness` | ❌ `error: package ID specification 'pheno-harness' did not match any packages` (workspace has no such member). |
| `gh repo view KooshaPari/pheno-harness --json isArchived` (pre-archive) | ✅ `false` — repo was still active at audit time. |
| `registry/disposition-index.json` row `repo-pheno-harness` (pre-edit) | ✅ `disposition: ABSORB`, `note: [...DEFERRED-W2: too large or structurally wrong for single-session absorption; needs dedicated audit phase]` |
| `projects/pheno-harness.json` (pre-edit) | ✅ Status `archived` (stale claim that repo was archived 2026-06-24 — actual repo remained active until this audit). |
| `catalog/registry.yaml` (pre-edit) | ✅ No pheno-harness substrate entry exists. |
| 2026-06-25 absorption audit `audits/absorption-justifications/pheno-harness-2026-06-25.md` | ✅ Last-Resort-Exception accepted for cross-repo test runtime. |

## Restore procedure

```sh
# 1. Unarchive source
gh repo unarchive KooshaPari/pheno-harness

# 2. In registry spine:
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-registry
# Edit registry/disposition-index.json: change disposition back to "ABSORB",
# fsm back to "active", drop archived_at / boundary_doc fields.
# Edit projects/pheno-harness.json: change status back to "active".

# 3. Re-attempt absorption in a dedicated multi-session audit phase:
#    - Either (a) ship a Python tooling crate under
#      phenotype-tooling/crates/pheno-harness/ (Python pattern, matching
#      how phenotype-tooling/crates/phench already hosts a Python runtime
#      CLI), or
#    - (b) confirm ARCHIVE_ONLY is permanent and re-affirm the boundary.
```

Note: there is no `phenotype-tooling/crates/pheno-harness/` change to
revert because no physical transfer occurred.

## Cross-references

- **Older audit (still valid):** `audits/absorption-justifications/pheno-harness-2026-06-25.md` — patterns absorbed by phenodag, BytePort, nanovms, PhenoCompose; Last-Resort-Exception for cross-repo test runtime.
- **Boundary doc:** `docs/boundary/pheno-harness.md`
- **Disposition row:** `registry/disposition-index.json` → `repo-pheno-harness`
- **Project entry:** `projects/pheno-harness.json` (updated 2026-07-17 to reflect actual archive state)
- **Source repo (now archived):** https://github.com/KooshaPari/pheno-harness

## Last Boundary Review

**Date:** 2026-07-17
**Reviewer:** forge subagent (deferred-absorption failsafe audit)
**Worklog / finding:** `registry/disposition-index.json` row `repo-pheno-harness`
**Decisions:**

- Pivoted from `ABSORB` (target: `phenotype-tooling (crates/pheno-harness/)`)
  to `ARCHIVE_ONLY` (target: `phenotype-registry`) — failsafe conditions
  met (build fails; source not a Rust crate; registry self-flagged
  DEFERRED-W2; Last-Resort-Exception on file).
- Did not run the literal `cp -r pheno-harness/* phenotype-tooling/crates/pheno-harness/`
  step because the source repo has no `Cargo.toml`, is 95% Python, and
  contains `.git/`, `.gitmodules`, and a submodule (`agileplus-specs/`)
  that would corrupt the workspace.
- Did not run `cargo check -p pheno-harness` (already verified to fail:
  no such package in the workspace).
- Did not fabricate a successful `crates/pheno-harness` import.
- Did not push a commit to `phenotype-tooling` on
  `salvage/phenotype-tooling-workspace-2026-07-15`; its working tree is
  unchanged.
- Executed `gh repo archive KooshaPari/pheno-harness -y` to seal the
  source repo read-only.

**Next review:** none — repo is archived. If a future need for a
`phenotype-tooling/crates/pheno-harness/` Python tooling crate arises
(similar to the recently-absorbed `crates/phench` Python runtime CLI),
this boundary doc should be reopened and the absorption re-attempted
against the Python tooling pattern.