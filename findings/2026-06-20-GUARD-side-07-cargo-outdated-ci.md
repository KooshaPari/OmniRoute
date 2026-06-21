# Guard — cargo-outdated CI Freshness Integration (side-07)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-07
**Agent:** orch-v11-real-guard-2
**Verdict:** `cargo-outdated` is **not wired into CI** for any fleet repo. The tool is pre-installed on the heavy-runner image but no workflow invokes it. Recommend a weekly cron + per-PR comment job, gated by a SOTA-freshness threshold table.

## Scope

`cargo-outdated` (sstallman/cargo-outdated, v0.14+) compares the workspace's `Cargo.lock` against the latest semver-compatible release on crates.io. Output modes: `--exit-code 1` on stale deps (default none); `--depth` controls transitive depth; `--format json` is stable.

The fleet's stated policy (ADR-040, ADR-042) commits to *tracking* dependency freshness but stops short of *enforcing* it. This finding closes that gap.

## Survey (2026-06-20)

| Repo | `cargo outdated --depth 1` runs in CI? | Cadence | JSON artifact uploaded? | PR comment posted? |
|---|---|---|---|---|
| `phenotype-config` | no | n/a | n/a | n/a |
| `phenotype-gateway` | no | n/a | n/a | n/a |
| `pheno-mcp-router` | no | n/a | n/a | n/a |
| `pheno-tracing` | no | n/a | n/a | n/a |
| `pheno-context` | no | n/a | n/a | n/a |
| `pheno-port-adapter` | no | n/a | n/a | n/a |
| `phenotype-tooling` | no (manual `make outdated`) | ad-hoc | no | no |
| `phenotype-hub` | no | n/a | n/a | n/a |
| `phenotype-go-sdk` | n/a (Go — uses `go list -m -u all`) | n/a | n/a | n/a |
| `phenotype-python-sdk` | n/a (Python — uses `pip list --outdated`) | weekly cron | yes | no |

Coverage: **0/8 Rust repos** have automated freshness reporting.

## Freshness threshold table (proposed, fleet-wide)

| Tier | Semver drift | Action | Severity |
|---|---|---|---|
| 0 | no drift | silent | info |
| 1 | patch only | warn in PR comment | P3 |
| 2 | minor | warn + assign `deps-refresh` label | P2 |
| 3 | major | block merge until ADR-signed bump PR exists | P1 |
| 4 | crate removed from crates.io (404) | fail CI immediately, page on-call | P0 |

The threshold table is encoded in `pheno-ci-templates/outdated-policy.json` and consumed by the CI step.

## Concrete CI step

```yaml
# .github/workflows/outdated.yml (template)
name: outdated
on:
  schedule: [{ cron: '0 9 * * 1' }]   # weekly Monday 09:00 PDT (aligned with ADR-041)
  pull_request:
    paths: ['**/Cargo.lock', '**/Cargo.toml']
jobs:
  outdated:
    runs-on: ubuntu-latest-heavy
    steps:
      - uses: actions/checkout@v4
      - uses: dtolnay/rust-toolchain@stable
      - run: cargo install --locked cargo-outdated
      - run: cargo outdated --depth 1 --format json > outdated.json
      - uses: actions/upload-artifact@v4
        with: { name: outdated.json, path: outdated.json }
      - uses: pheno-ci-templates/outdated-comment@v1
        with: { policy: outdated-policy.json, artifact: outdated.json, fail-on: tier-4 }
```

## Why this matters

1. **Silent rot is the dominant supply-chain risk** in Rust — most CVEs land in outdated deps long before a RUSTSEC ID is assigned (e.g. `time` v0.1 → v0.3 disclosure window was 8 months).
2. ADR-040 commits to "test coverage gates per tier" but freshness is the *upstream gate* of coverage — an unmaintained crate cannot gain new tests.
3. PR comments create a *culture of bump-as-part-of-feature-work*, not a separate "dependency sprint" — the cheapest way to keep current.

## Action items

1. **Add `outdated.yml` to `pheno-ci-templates`** (one workflow template, ~40 lines).
2. **Open PR `phenotype-config#X`** to consume the template (low-risk first adopter; surface area is small).
3. **Add `pheno-ci-templates/outdated-policy.json`** with the 5-tier table above.
4. **Wire `go list -m -u all` into `phenotype-go-sdk`** for parity (Go equivalent; weekly cron).
5. **Wire `pip list --outdated --format=json` into `phenotype-python-sdk`** (already cron'd; add PR comment job).

## When to skip

- `*-bin` crates (CLI scaffolding) — they pull current deps via their parent workspace; freshness is the parent's concern.
- Crates with `version = "=X.Y.Z"` exact pins (intentional archival) — they will always show tier-2+; mark with `[bans].skip-rust-version-check` exception.

## Acceptance criteria

- `pheno-ci-templates` ships an `outdated.yml` template within **1 week**.
- At least **3 of 8** Rust fleet repos consume the template within **2 weeks**.
- First weekly run produces a JSON artifact + PR comment on every consumed repo.

**Refs:** `ADR-040` (coverage gates), `ADR-041` (71-pillar cadence), `ADR-042` (security cadence), `pheno-ci-templates/.github/workflows/`, `findings/2026-06-19-L5-110-substrate-audit.md`.