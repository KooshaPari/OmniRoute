# ADR-041: Governance tools cluster (L72/L73/L74) — colocate in `phenotype-org-audits/audits/`

Three of the four v8-sweep governance tools (ADR-047/L72, ADR-048/L73, ADR-049/L74) were each spun up as separate single-file Python repos (`pheno-predict`, `pheno-framework-lint`, `pheno-drift-detector`) on 2026-06-18. On 2026-06-19, all three were absorbed into `KooshaPari/phenotype-org-audits` under `audits/<tool-slug>/` and the source repos archived. This ADR formalizes the colocation policy: the L72/L73/L74 trio lives under `phenotype-org-audits`, not as separate repos.

**Status:** Accepted
**Date:** 2026-06-19
**Author:** orchestrator (claude opus 4.7, via direct execution after subagent DB-lock)
**Track:** v8 T19 (governance tooling consolidation)
**L5-112** (umbrella for the 3 governance-tool absorptions)

## Context

The 3 governance tools were created on 2026-06-18 as part of the v8 sweep:

| Tool | Repo | ADR | Layer | Purpose |
|---|---|---|---|---|
| `pheno_predict.py` | `KooshaPari/pheno-predict` | ADR-047 | L72 (Predictive DRY) | Fleet-wide Jaccard shingle scanner |
| `pheno_framework_lint.py` | `KooshaPari/pheno-framework-lint` | ADR-048 | L73 (Substrate graduation) | Tier-convention linter |
| `pheno_drift_detector.py` | `KooshaPari/pheno-drift-detector` | ADR-049 | L74 (App-substrate drift) | 3-pass drift detector |

Each was a single-file stdlib-Python tool with a `README.md` + `SPEC.md` + `AGENTS.md` + `CHANGELOG.md` + `tests/test_smoke.py` + governance boilerplate. They were standalone repos for ~24 hours before being absorbed on 2026-06-19.

The natural home for all 3 tools is `KooshaPari/phenotype-org-audits` because:

1. **Existing repo structure** — `audits/<topic>/` is the established pattern (e.g., `audits/docs-site/`, `audits/2026-06-18_ADR-040-deletion-recipe.md`).
2. **Cron integration** — the weekly Monday 09:00 PDT cron that runs the L72/L73/L74 scanners is hosted in `phenotype-org-audits/audits/cron/` (per ADR-041B substrate-audit-cadence). The scanner scripts and the cron that drives them should be in the same repo.
3. **Issue-creation target** — the L74 drift detector posts GitHub issues to `phenotype-org-audits` (per its own README). Source and destination of issue-creation must be the same repo.
4. **CI consolidation** — `phenotype-org-audits` CI runs pytest on `audits/` subdirs; the 3 tools' smoke tests run for free.
5. **Provenance** — `MANIFEST.md` per absorbed tool with SHA-256 hashes preserves "where did this come from" answerability.

## Decision

**The L72/L73/L74 governance-tools trio is canonical in `KooshaPari/phenotype-org-audits/audits/<tool-slug>/`.** The 3 source repos (`pheno-predict`, `pheno-framework-lint`, `pheno-drift-detector`) are archived and will be deleted via GitHub UI after the 90-day window (2026-09-17).

### The colocation pattern

For each of the 3 tools, the absorbed content is structured as:

```
phenotype-org-audits/audits/<tool-slug>/
├── <script>.py            # the main stdlib-Python tool (active content)
├── README.md              # copy + 5-line migration header prepended
├── SPEC.md                # copy
├── AGENTS.md              # copy
├── CHANGELOG.md           # copy
├── tests/
│   ├── __init__.py        # re-created
│   └── test_smoke.py      # copy
├── MANIFEST.md            # new: source SHA-256 hashes for provenance
└── governance/            # source-repo-specific governance files (DIFFER from target's)
    ├── CODE_OF_CONDUCT.md # (when DIFFERS)
    ├── CONTRIBUTING.md    # (when DIFFERS)
    ├── SECURITY.md        # (when DIFFERS)
    ├── .gitignore         # (when DIFFERS)
    ├── deny.toml          # (vestigial, preserved as snapshot)
    └── .github/CODEOWNERS, .github/ISSUE_TEMPLATE/*  # (source-specific)
```

### What migrates vs what is intentionally excluded

| Disposition | Files | Reason |
|---|---|---|
| `DONE` (active content) | script, README, SPEC, AGENTS, CHANGELOG, smoke test, MANIFEST, tests/__init__.py | tool is functional; needs discoverable docs |
| `PARTIAL` (governance snapshot) | CODE_OF_CONDUCT, CONTRIBUTING, SECURITY, .gitignore, deny.toml, .github/* (when DIFFERS from target) | source-repo-specific governance preserved for fleet-history provenance |
| `INTENTIONALLY_DEPRECATED` (excluded) | LICENSE-MIT, LICENSE-APACHE, .safety-policy.yml (when byte-identical to target); .github/CODEOWNERS, .github/ISSUE_TEMPLATE/* (when target has its own); pyproject.toml (single-file cron tool) | target has the canonical version; preserving would duplicate |
| `NO_MERIT` (excluded) | `deny.toml` (vestigial Rust-deps policy in a Python repo); `*.egg-info/*` (build artifacts) | pre-existing bug or generated content |

### The 3 absorbed tools (verdicts)

| Tool | Source | Target | Verdict | Confidence | Audit |
|---|---|---|---|---|---|
| `pheno-predict` | `KooshaPari/pheno-predict` (13 files) | `audits/predict-dry/` | `DELETE_AFTER_PATCHES` | 9/10 | [findings/2026-06-19-L5-112-predict-dry-absorption.md](../../findings/2026-06-19-L5-112-predict-dry-absorption.md) |
| `pheno-framework-lint` | `KooshaPari/pheno-framework-lint` (26 files) | `audits/framework-lint/` | `DELETE_AFTER_PATCHES` | 9/10 | [findings/2026-06-19-L5-112-framework-lint-absorption.md](../../findings/2026-06-19-L5-112-framework-lint-absorption.md) |
| `pheno-drift-detector` | `KooshaPari/pheno-drift-detector` (21 files) | `audits/drift-detector/` | `DELETE_AFTER_PATCHES` | 9/10 | [findings/2026-06-19-L5-112-drift-detector-absorption.md](../../findings/2026-06-19-L5-112-drift-detector-absorption.md) |

All 3 PRs are open:

| PR | Source repo | Status |
|---|---|---|
| [#45](https://github.com/KooshaPari/phenotype-org-audits/pull/45) | `pheno-predict` → `audits/predict-dry/` | OPEN |
| [#46](https://github.com/KooshaPari/phenotype-org-audits/pull/46) | `pheno-framework-lint` → `audits/framework-lint/` | OPEN |
| [#47](https://github.com/KooshaPari/phenotype-org-audits/pull/47) | `pheno-drift-detector` → `audits/drift-detector/` | OPEN |

All 3 source repos are already `archived: true` (2026-06-19 08:37:56 UTC, automated process — pre-empted the explicit `gh api -X PATCH` archive step in the recipe).

### Cron / runtime migration notes

The 3 tools are invoked from a weekly Monday 09:00 PDT cron. The original cron entries (from each tool's README) used a global `pheno-predict`, `pheno-framework-lint`, `pheno-drift-detector` symlink. The new invocations are direct script paths:

```cron
# Old (per tool's README)
0 9 * * 1 cd /path/to/repos && pheno-predict scan --root . --format md --out /tmp/...

# New (post-ADR-041)
0 9 * * 1 cd /path/to/repos && python3 phenotype-org-audits/audits/predict-dry/pheno_predict.py scan --root . --format md --out /tmp/...
```

The cron definitions themselves live in `phenotype-org-audits/audits/cron/` (per ADR-041B). This ADR does not modify the cron definitions; it just notes that the post-absorption invocations are direct script paths, not global symlinks.

## Consequences

### Positive

- **Single weekly cron** for all 3 L72/L73/L74 scanners, hosted in the same repo as the cron definitions.
- **Single CI surface** — `phenotype-org-audits` pytest runs all 3 tools' smoke tests.
- **Provenance** — `MANIFEST.md` per tool preserves source-file SHA-256 hashes; "where did this come from" is answerable.
- **Zero new repos** — colocation absorbs 3 repos into 1, reducing fleet surface area (per ADR-028 hybrid-with-staging-repo).

### Negative

- **Cron-invocation migration** — operators must update from `pheno-predict` symlink to `python3 audits/predict-dry/pheno_predict.py`. (Documented in this ADR.)
- **Governance-file drift** — source-repo-specific governance files (CODE_OF_CONDUCT, etc.) are preserved as snapshots in `audits/<tool-slug>/governance/`. They are NOT authoritative for `phenotype-org-audits` (which has its own), but they remain visible for fleet-history. If operators expect to find a tool's governance docs in its old location, they will need to be re-pointed to `phenotype-org-audits/audits/<tool-slug>/governance/`.
- **README migration header** — each absorbed tool's README has a 5-line migration header prepended (pointing to the original source URL and the audit artifact). This is intentional provenance, not a bug.

### Neutral

- **3 source repos are now archived, not deleted** — manual GitHub-UI delete is the user's call (per ADR-040 5-step recipe). 90-day window: 2026-06-19 → 2026-09-17.

## Alternatives considered

### Option A: Keep 3 separate repos

- **Pro:** Each tool's repo stands alone; cron invocations unchanged.
- **Con:** Contradicts ADR-028 (zero new repos), creates 3 cron targets instead of 1, fragments provenance across 3 READMEs.
- **Verdict:** Rejected. ADR-028 + ADR-040 both favor consolidation.

### Option B: Move to a new `pheno-governance-tools` umbrella repo

- **Pro:** Clean naming; isolates governance tools from `phenotype-org-audits`.
- **Con:** Creates a new repo (contradicts ADR-028); `phenotype-org-audits` already has the `audits/<topic>/` pattern; splits the cron entry-point across 2 repos.
- **Verdict:** Rejected. `phenotype-org-audits` is the natural home; no new repo needed.

### Option C: Move into `pheno-ci-templates` (CI workflow collection)

- **Pro:** Already a governance/infra repo.
- **Con:** `pheno-ci-templates` is GitHub Actions workflow YAML; Python scripts don't fit its scope.
- **Verdict:** Rejected. Wrong repo for Python source code.

## Related

- **ADR-040** — 5-step deletion recipe (followed for each of the 3 absorptions)
- **ADR-028** — Monorepo architecture eval: hybrid-with-staging-repo (favors colocation over new repos)
- **ADR-047** — Predictive DRY discipline (L72)
- **ADR-048** — Substrate graduation path (L73)
- **ADR-049** — App-substrate drift detector (L74)
- **ADR-041B** — Substrate audit cadence (bi-weekly substrate health audit; weekly cron host)

## Implementation status

| Step | Action | Status |
|---|---|---|
| 1 | Author 3 audit artifacts in monorepo `findings/` | ✅ DONE 2026-06-19 (3 files) |
| 2 | Open 3 PRs to `phenotype-org-audits` | ✅ DONE 2026-06-19 (PRs #45, #46, #47) |
| 3 | Archive 3 source repos | ✅ DONE 2026-06-19 08:37:56 UTC (automated, pre-empted the explicit `gh api -X PATCH` step) |
| 4 | Update `AGENTS.md` | N/A (3 repos not listed in `AGENTS.md` file-list) |
| 5 | Manual GitHub-UI delete | ⏳ Pending user action; 90-day window 2026-06-19 → 2026-09-17 |
