# v25 T3 — L29 SBOM Diff Spec (CycloneDX per-release diff + CVE gate)

**Date:** 2026-06-22
**Pillar:** L29 (Supply chain — SBOM diff per release)
**Track:** v25 cycle-15 P1 reduction, T3 of 7
**Status:** SPEC (workflow + spec doc)
**Branch:** `chore/v25-71-pillar-cycle-15-p1-2026-06-22`

## Summary

Per-release CycloneDX SBOM diff: when a GitHub release is `published`, the
workflow generates a fresh SBOM, downloads the SBOM asset attached to the
previous release, computes the package + vulnerability delta, and posts a
markdown summary as a release comment. Any **new** HIGH/CRITICAL CVE
(CVSS >= 7.0) introduced by the diff is flagged as a `::error::` annotation
and surfaces in the PR/release checks UI for triage.

This complements the existing **per-PR** SBOM diff gate at
`pheno-port-adapter/.github/workflows/sbom-diff.yml` (L48, v21-T1): the
per-PR gate blocks dependency drift before merge; this per-release gate
catches what slips through (post-merge CVEs, base-image bumps, transitive
additions).

## Tooling

| Layer | Tool | Pinned version |
|---|---|---|
| SBOM generation | `cargo-cyclonedx` (subcommand of `cargo-cyclonedx-bom`) | `0.5.7` (per ADR-048 substrate graduation pin) |
| SBOM diff | `cyclonedx-diff` (Python pkg, wraps `cyclonedx-python-lib`) | `cyclonedx-python-lib >= 6,<7` |
| Severity gate | `osv-scanner` (OSV.dev CVE feed) | `1.6.x` |
| Output format | CycloneDX 1.5 JSON (`application/vnd.cyclonedx+json`) | n/a |
| Diff consumer | `actions/github-script@v7` (release-comment poster) | n/a |

## Storage

- **Asset name:** `sbom-<version>.cdx.json` (e.g. `sbom-v1.2.3.cdx.json`)
- **Upload target:** `gh release upload <tag> sbom-<version>.cdx.json`
- **Storage location:** GitHub Release asset (free, immutable, addressable by tag)
- **Retention:** Permanent (release assets are not auto-pruned)
- **Retrieval:** `gh release download <previous-tag> --pattern 'sbom-*.cdx.json'`

The asset name convention is stable across releases so the previous-SBOM
fetcher doesn't need to know the tag ahead of time.

## Gate semantics

| Diff state | Action |
|---|---|
| Empty diff (no changes) | Silent pass; comment "SBOM unchanged from vX.Y.Z" |
| Added/upgraded only, no new CVE | Comment "X added, Y upgraded, no new CVEs" |
| Downgraded only, no new CVE | `::warning::` annotation + comment naming downgrades |
| **New HIGH/CRITICAL CVE (CVSS >= 7.0)** | `::error::` annotation + release fails check + comment names CVE + affected component |
| Removed packages | `::warning::` annotation + comment (potential supply-chain attack vector) |

CVSS threshold matches the fleet-wide convention established in
`findings/2026-06-21-v18-T4-L46-L55-security-p1-deepening.md` §3 (HIGH = 7.0-8.9,
CRITICAL = 9.0-10.0).

## Why per-release (not per-PR)

The v21-T1 per-PR gate (L48) diffs against `origin/main` at merge-base. This
catches direct additions in a PR but misses:

1. **Transitive dep drift** between releases (deps of deps that change with
   no direct PR to the dependency manifest).
2. **Post-merge CVEs** discovered after the PR merged (e.g. a CVE published
   the day after release).
3. **Base-image bumps** in containerized builds (e.g. `phenotype-ops` llama-cpp
   Dockerfile bumps `python:3.12-slim` → `python:3.13-slim` for security;
   not visible in any Rust Cargo.lock diff).

Per-release diff against the **previous release's SBOM** catches all three
because the previous release is a stable, immutable artifact (not a moving
merge-base).

## Workflow (`.github/workflows/sbom-diff.yml`)

Triggered by `release: types: [published]`. Steps:

1. `actions/checkout@v4` (fetch-depth 0; needed for tag resolution)
2. `dtolnay/rust-toolchain@stable` (for `cargo`)
3. `cargo install cargo-cyclonedx --locked --version 0.5.7` (~3 min)
4. `cargo cyclonedx-bom --format json --output sbom-<version>.cdx.json`
5. Resolve previous release tag (`gh release list --limit 2` → second-newest)
6. `gh release download <prev-tag> --pattern 'sbom-*.cdx.json'` → `sbom-prev.cdx.json`
7. `pip install cyclonedx-python-lib` (~10s)
8. `python -m cyclonedx.diff sbom-prev.cdx.json sbom.cdx.json > diff.md`
9. `osv-scanner --sbom=sbom.cdx.json --format=json` → vulnerability report
10. Diff vulnerability reports (new CVEs only); flag HIGH/CRITICAL as `::error::`
11. `actions/github-script@v7` posts `diff.md` + CVE summary as release comment
12. `actions/upload-artifact@v4` uploads both SBOMs (90-day retention) + diff

The workflow is **non-blocking on first release** (no previous SBOM to
diff against); logs "no baseline SBOM found, treating current as baseline"
and uploads only.

## Reuse

- **`KooshaPari/phenotype-ops#2`** (llama-cpp Dockerfile + compose) —
  container builds via this PR can chain a `cyclonedx-bom` step that emits
  a container SBOM alongside the Rust SBOM; the diff workflow handles both.
- **`pheno-port-adapter/.github/workflows/sbom-diff.yml`** (v21-T1, L48) —
  shares the `cargo-cyclonedx` install step + output path conventions; copy-paste
  portable to other substrate crates.
- **`KooshaPari/pheno-tracing`** (ADR-012 / ADR-036B canonical) — OTLP
  export for the gate's annotations and execution-time metrics (per ADR-042B
  substrate quality bar).

## Cross-references

- **ADR-024** — 71-pillar audit framework (L29 = SBOM diff per release, DX/security border pillar)
- **ADR-041** — 71-pillar refresh cadence (weekly Monday 09:00 PDT cron)
- **ADR-042** — Security audit cadence (monthly `cargo audit` + `pip-audit` + `govulncheck` sweep; this gate is the per-release slice)
- **ADR-048** — Substrate graduation path (codifies tool-version pinning for CI gates; `cargo-cyclonedx = 0.5.7` per this)
- **ADR-042B** — Substrate quality bar (OTLP export via pheno-tracing; coverage gate 80% lib / 70% framework)
- **ADR-091** — v21 cycle-11 P1 reduction (L48 per-PR gate; this is the per-release complement)

## Acceptance

| Criterion | Status |
|---|---|
| Spec doc written (this file, ~150 lines) | DONE |
| `.github/workflows/sbom-diff.yml` written (~50 lines) | DONE |
| Workflow validated (yamllint, GitHub Actions schema) | DONE |
| Committed to `chore/v25-71-pillar-cycle-15-p1-2026-06-22` | DONE |
| Merged | NOT MERGED (per task: don't auto-merge; bot will self-merge per AGENTS.md "Track 8 cursor self-merge is the intended pattern") |

## Open follow-ups (deferred to v26 cycle-16)

1. **Multi-language SBOM** — Python (`cyclonedx-py`) + Go (`cyclonedx-gomod`) +
   TS (`@cyclonedx/cyclonedx-node-module`) emission in addition to Rust.
2. **Spectral diff** — track not just package add/remove but version-bump
   magnitude (e.g. minor patch auto-OK; major bump requires human review).
3. **OSV.dev webhooks** — subscribe to new CVE feeds for components we ship;
   emit a release comment retroactively if a new HIGH/CRITICAL lands.
4. **SBOM-license diff** — already covered by existing `sbom.yml` GPL/AGPL
   gate; merge into this workflow to consolidate.
5. **First-release bootstrap** — when no prior SBOM exists, currently silent
   pass; future: require explicit `--no-baseline-acknowledged` label.

## Constraint compliance

- **macbook-safe**: Yes. `cargo install cargo-cyclonedx` runs on CI (ubuntu-latest
  runner), not locally. Spec doc authoring is `device: macbook` per ADR-023.
- **No heavy-runner needed**: spec doc + workflow YAML authoring is text-only.
- **No auto-merge**: per task constraint.
- **No local workflow run**: per task constraint (needs `release: published`
  GitHub event context).