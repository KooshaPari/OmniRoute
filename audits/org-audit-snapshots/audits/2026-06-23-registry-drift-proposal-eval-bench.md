# Registry Drift Proposal — Eval/Bench/QA lane (2026-06-23)

> **Status:** READ-ONLY PROPOSAL — not a mutation of `phenotype-registry`.
> Submit to `phenotype-registry/audits/` (or PR against
> `phenotype-registry/projects/*.json`) when the lane owner has bandwidth.
>
> The lane owner respects the boundary SSOT rule: `phenotype-registry` is
> **read-only** for the eval/bench/QA lane. Drift is logged here and
> submitted via the registry's `validator-loop S9` once per wave.

## Drift observed

| Field | Current registry value | Truth (2026-06-23) | Source |
|-------|------------------------|--------------------|--------|
| `Benchora.single_crate` | `"gauge"` | `phenotype_xdd_lib` (renamed) | `Benchora/Cargo.toml:11` (`[lib] name = "phenotype_xdd_lib"`) |
| `Benchora.absorption_note` | "Single crate 'gauge' v0.2.0" | CLI binary `benchora` v0.2.0 added; `src/bin/benchora.rs` shipped; `run`/`report`/`baseline`/`compare`/`list` subcommands wired to SQLite + sha256 | `Benchora/src/bin/benchora.rs:1-7`, `Benchora/src/cli/mod.rs:1-105` |
| `portage.status` | `archived` | `active` (L7-001 propagation, `wip/2026-06-18-portage-l7-001-propagation` branch on disk) | `portage/.git/HEAD` and `git log --oneline -1` |
| `portage.disposition` | `RETIRE` | `AFFIRM` (active fork, local delta: L7-001 propagation, harbors bridge, request-id adoption) | `portage/AGENTS.md`, `portage/CLAUDE.md` |
| `portage.primary_language` | `unknown` | `python` (uv-managed, Pydantic v2, Typer CLI) | `portage/pyproject.toml:1-15` |
| `pheno-harness` (not registered) | n/a | New `pheno-harness` repo: Harbor TB2 harness, 999-file ref-pr-diff fixture bundle, eval-pillars.py, route_matrix.py, tbench.py | `pheno-harness/README.md:1-81`, `pheno-harness/eval/` |
| `heliosBench` (registry says archived 2026-06-17) | `archived` | `active` on disk — `heliosBench/pyproject.toml`, README on origin/main | `heliosBench/` |
| `nanovms` (registry says archived 2026-06-17) | `archived` | `active` on disk — Go/TS monorepo, 25 branches, tick28 lift | `nanovms/` |
| `Tracera` (registry says active but sparse) | `active`, `sparse` | `active` with `crates/tracera-core` Rust core + 4 language shells (Python/Go/TS) | `Tracera/ARCHITECTURE.md:35-58` |
| `phenodag` (registry says active) | `active` | `active` but diverged from origin (3 ahead, 10 behind) | `git -C phenodag status -sb` |

## New artifacts to register

| Artifact | Repo | Surface | Status |
|----------|------|---------|--------|
| `benchora` CLI binary | Benchora | `cargo run --bin benchora -- run --suite {core,mutation,property,contract,spec}` | shipped (closes benchora-002/003) |
| `pheno_harness_to_portage.py` | portage | `python portage/adapters/pheno_harness_to_portage.py --pheno-harness-root ../../pheno-harness --portage-datasets ./datasets/pheno-harness-ref-pr-diff` | shipped (DAG-T5) |
| `tracertm/scoring/semantic_scorer.py` | Tracera | `from tracertm.scoring.semantic_scorer import SemanticScorer; SemanticScorer().score(req, trace)` | shipped (DAG-T6) |
| `phenodag/.pre-commit-config.yaml` | phenodag | `pre-commit install && pre-commit run --all-files` | shipped (DAG-T9) |
| `audit-30-pillar-L31..L80` | phenotype-org-audits | 50 new pillars (security + observability + supply-chain + DX/Qeng/portability + eval-coverage) → 80 pillars total | shipped (DAG-T4) |

## Recommended registry deltas (for S9 validator)

```jsonc
// projects/Benchora.json
{
  "single_crate": "phenotype_xdd_lib",
  "cli_binary": "benchora",
  "cli_subcommands": ["run", "report", "baseline", "compare", "list"],
  "absorption_note": "Single crate 'phenotype_xdd_lib' v0.2.0 + benchora CLI binary (run/report/baseline/compare/list) backed by SQLite + sha256. Perf baseline matrix for all 6 owned repos. Env-gate BENCHORA_REGRESSION_THRESHOLD_PCT (DAG-T11)."
}

// projects/portage.json
{
  "status": "active",
  "disposition": "AFFIRM",
  "primary_language": "python",
  "absorption_note": "Harbor fork; L7-001 propagation branch active; helios_bench bridge; pheno-harness adapter (DAG-T5)."
}

// projects/pheno-harness.json (NEW)
{
  "name": "pheno-harness",
  "languages": ["python"],
  "primary_language": "python",
  "status": "active",
  "type": "product / app",
  "path": "repos/pheno-harness",
  "role": "eval-harness",
  "domain_role": "eval",
  "boundary": "eval-harness",
  "stack": "python",
  "gh_url": "https://github.com/KooshaPari/pheno-harness",
  "wave": "L7-001",
  "disposition": "AFFIRM",
  "rationale": "Local routing, compression stack, RLVR eval, Harbor terminal-bench for OmniRoute Main on a single-GPU (3090 Ti) operator stack. 999-file ref-pr-diff fixture bundle. Eval pillars: token burn, accuracy, speed, cost, motion, quality, safety.",
  "absorbed_into": null
}
```

## Cross-references

- DAG v2 — [`../../../plans/2026-06-23-eval-bench-qa-dag-v2.md`](../../../plans/2026-06-23-eval-bench-qa-dag-v2.md)
- 71+ pillar scorecard — [`../pillar-scores/2026-06-23.md`](../pillar-scores/2026-06-23.md)
- Lane owner: Forge (eval/bench/QA + compute/infra)
- Boundary SSOT: `phenotype-registry/BOUNDARY_OWNERS.md` (read-only)
