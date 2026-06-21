# SPEC.md — pheno-drift-detector

**Version:** 0.1.0
**Discipline:** L74 (App-substrate drift detection) — see `findings/71-pillar-2026-06-17-schema.md` §3.10
**ADR anchor:** ADR-049 (App-substrate drift detection discipline), ADR-044 (Drift detection policy)

---

## 1. Purpose

Scan PAUSED / CONDITIONAL / CAPSTONE app-level repos (per ADR-023 bucket
classification) for 2+ non-trivial capabilities that match the substrate pattern
(Port trait, Adapter, Tests). When such "drift" is detected — i.e., the app repo
contains capabilities that belong in a shared substrate — output a structured
drift hit that includes the suggested substrate type (`pheno-*-lib`,
`phenotype-*-sdk`, `phenotype-*-framework`, or `federated-service`) and candidate
extraction paths.

This is the **L74 (App-substrate drift detection)** tool in the 71-pillar
governance framework. It closes the loop: **predict** (L72) → **lint** (L73) →
**detect drift** (L74) → re-predict.

## 2. Inputs

- `--root PATH` — directory containing app repos (required)
- `--format {json,md,gh-issues}` — output format; default `json`
- `--out PATH` — output file (default: stdout)

Subcommand `validate`:
- `--hit PATH` — path to a hit JSON file (required)
- `--yes` — auto-confirm validation (HITL gate bypass)

## 3. Algorithm (3-pass)

### Pass 1 — Discover app repos

Walk `--root`. For each subdirectory, check if the name matches an ADR-023 bucket
via `detect_buckets()`: PAUSED, CONDITIONAL, or CAPSTONE (with glob support for
`*fitness*`-style wildcards). Schedule matching directories for scanning.

### Pass 2 — Find non-trivial capabilities

For each candidate app repo, group source files by top-level directory. A
"non-trivial capability" directory must pass all 4 criteria:

| # | Criterion | Heuristic |
|---|---|---|
| 1 | ≥ 3 source files | Count of files with code extensions (`.py`, `.rs`, `.go`, `.ts`, etc.) |
| 2 | ≥ 5 KB total | Sum of file sizes |
| 3 | ≥ 1 Port trait | Regex for `trait Foo {`, `interface Foo {`, `protocol Foo {` |
| 4 | ≥ 1 Adapter OR Test | Regex for adapter patterns or test naming conventions |

Skip dirs: `target`, `build`, `dist`, `node_modules`, `.venv`, `venv`, `env`,
`.git`, `vendor`, `__pycache__`, `.pytest_cache`, `.mypy_cache`, `.ruff_cache`,
`out`, `bin`, `obj`.

### Pass 3 — Score + suggest substrate

Drift score = `n_capabilities × 1.0 + n_ports × 0.4 + n_adapters × 0.3 + n_tests × 0.3`.
Threshold: **1.5**.

Substrate suggestion heuristic:

| Ports | Adapters | Suggested substrate |
|---|---|---|
| ≥ 2 | ≥ 2 | `phenotype-*-framework` |
| ≥ 1 | ≥ 1 | `phenotype-*-sdk` |
| ≥ 1 | — | `pheno-*-lib` |
| — | — | `pheno-*-lib` (TBD — manual review) |

## 4. Output

A JSON list of `DriftHit` objects:

```python
@dataclass
class DriftHit:
    repo: str
    bucket: str              # paused | conditional | capstone
    capabilities: list[Capability]
    drift_score: float
    candidate_paths: list[str]
    target_substrate: str
    rationale: str
    suggested_action: str
    matched_files: list[str]
    detected_at: str          # ISO-8601 UTC
```

Three format renderers:
- **`json`** — raw `DriftHit` objects, machine-readable
- **`md`** — human-readable summary table
- **`gh-issues`** — markdown formatted for `gh issue create --body-file -`

## 5. Exit codes

| Code | Meaning |
|---|---|
| 0 | Scan complete, no drift hits found |
| 1 | Scan error (bad path, bad args) |
| 2 | Drift hits found (CI can use this to flag PRs or open issues) |

## 6. Why stdlib only (no deps, no network)

- **O(n) per repo** — fast enough to scan 50+ app repos in < 10 s on a MacBook.
- **No model, no download, no GPU** — fits the substrate pattern of "one
  purpose, zero external surface area".
- **Structural signals only** — file count, naming patterns, Port trait regex.
  No AST parsing needed. False positives are acceptable (human review gate);
  false negatives are not.
- **No network calls** — runs fully offline. All state is filesystem-local.

## 7. Non-goals

- **Not an enforcement tool.** `pheno-drift-detector` detects drift and suggests
  extraction targets. Enforcement is done via `pheno-framework-lint` (L73) and
  manual PR review.
- **Not a duplicate finder.** For exact or near-duplicate code detection, use
  `pheno-predict` (L72) or `consume` / `dups` tools.
- **Not a security scanner.** The tool does not analyze dependencies, secrets,
  or vulnerability data.
