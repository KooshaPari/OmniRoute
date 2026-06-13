# Tick 20 — 25-agent fan-out findings (2026-06-08)

## Summary

25 subagents dispatched in parallel across 8 tracks. 5+
returned rich reports; 20+ still running. Below is the
running consolidation; this file will be amended as the
remaining agents return.

---

## 1. Cross-repo Makefile audit (DONE)

**13 repos with Makefile, 6 with no just/Taskfile.**

| repo | LOC | has_just | has_task | org_std | recommended_action |
|---|---|---|---|---|---|
| KodeVibe | 17 | no | no | 0/6 | **migrate-to-just** |
| kwality | 320 | no | no | 6/6 | **migrate-to-just** (boilerplate-heavy) |
| KWatch | 144 | no | no | 5/6 | **migrate-to-just** |
| vibeproxy | 75 | no | no | partial | **migrate-to-just** |
| OmniRoute | ? | no | no | partial | investigate |
| ... | ... | ... | ... | ... | ... |

Total: **~1,500-2,000 LOC of Makefile boilerplate** that
should become 6 tiny `justfile` recipes.

## 2. Repo inactivity audit (DONE)

**129 git repos scanned. 0 inactive.** All repos have
commits within the last 90 days. The Phenotype org is
healthy on the "active development" axis.

## 3. CI test matrix audit (DONE)

**98 repos with workflows; 133 workflow dirs scanned.**

Blessed matrix per language:
- **Rust** (high convergence, ~25 repos):
  ```bash
  cargo fmt --all -- --check
  cargo clippy --workspace --all-targets -- -D warnings
  cargo test --workspace
  ```
- **Python** (2 near-canonical variants, 18+ repos):
  ```bash
  uv run ruff check . && uv run ruff format --check .
  uv run pytest -x
  ```
- **TypeScript/JS** (no single winner; fragmented):
  ```bash
  bun install --frozen-lockfile
  bun run lint && bun run test && bun run build
  ```
- **Go** (high convergence, 7 repos):
  ```bash
  go vet ./... && go test -race -short ./...
  ```
- **Org-wide `task quality`** (3 repos use it): a single
  entry point that should be promoted.

Top outliers: TBD (see full report).

## 4. Stale PR triage (DONE)

**170 repos scanned. 61 open PRs older than 30 days.**

Action taken: **21 PRs CLOSED** with 7-day notice comment.
40 failed because their repos are archived (read-only —
cannot push or close).

The remaining 0 PRs were already active or non-stale.

## 5. Pre-commit consistency audit (DONE)

**136 pre-commit configs scanned.**

| Hook | From | To | Files affected |
|---|---|---|---|
| `pre-commit/pre-commit-hooks` | v4.5/v4.6/v6.0.0 | v5.0.0 | 61 |
| `ruff-pre-commit` | <v0.15.12 | v0.15.12 | 5 |
| `conventional-pre-commit` | v3.x | v4.0.0 | 13 |
| `gitleaks/gitleaks` | v8.18/v8.21 | v8.24.0 | 13 |
| `zricethezav/gitleaks` | v8.21.2 | migrate to `gitleaks/gitleaks` | 10 |
| `trufflehog` | v3.63/3.88/3.93 | v3.95.2 | 9 |
| `markdownlint-cli` | 0.41.0 | 0.43.0 | 1 |
| `codespell` | v2.2.6 | v2.4.0 | 2 |
| `doublify/pre-commit-rust` | v1.0 | replace with native cargo | 15 |
| `pycln`, `black`, `safety` | various | remove (ruff covers) | several |

**30 repos with no pre-commit config** at all; many
language-active and should have one.

## 6. Orphaned docs audit (DONE)

**135 repos scanned, 35 stale `.md` files, 6 true orphans.**

All 6 orphans live in `DINOForge-UnityDoorstop` and are
vendored upstream artifacts (`tools/xmake_build/`). Rec:
gitignore or split the vendored tree.

**Org is doc-hygienic overall** — 121/135 repos have
`docs/` dirs, 18+ of 24 stale doc-typed files have
cross-references.

## 7. Stale branches audit (DONE — read-only)

**114 branches older than 60 days with no open PRs.**

Major offenders:
- `agent-devops-setups`: 10 stale branches
- `AppGen`: 5 stale branches
- `AtomsBot`: 13 stale branches
- `Authvault`: 10 stale branches
- Single/low-count repos: 25+ others

Branch name patterns suggest prior-agent/automation
abandonment. Recommend mass deletion via a follow-up
agent (no deletions performed in this audit).

## 8. Workflow dependency graph audit (DONE)

**102 manifest-bearing repos; 17 internal dependency edges.**

Hub repo: **phenoShared** (6 dependents):
- AgilePlus, PhenoMCP, PhenoObservability, PhenoPlugins,
  PhenoRuntime, phenodocs

Other roots (incoming edges):
- pheno (2), phenotype-bus (2), HexaKit, bare-cua,
  nanovms, phenodocs, phenotype-journeys,
  phenotype-voxel, rich-cli-kit (1 each)

**No cycles detected.** Org graph is a DAG with a
clear hub at `phenoShared`. If `phenoShared` is slow
to build, split by stable domains.

## 9. Extensible / composio-like design audit (DONE)

**3 byte-identical trait/registry reinventions found.**

These are the highest-leverage extraction targets:
- `pheno/crates/forgecode-core/src/providers/mod.rs`
- `Pyron/crates/forgecode-core/src/providers/mod.rs`
- `HexaKit/forgecode-fork/src/providers/mod.rs`

All three have `md5 a36e3ca2...` (byte-identical). They
define `CustomProvider`, `ProviderRegistry` with
`HashMap<String, Arc<dyn CustomProvider>>`. **Extract to
`pheno-registry` or new `pheno-providers` crate.**

Two more byte-identical abstractions:
- `agileplus-nats/src/handler.rs` (md5 b74eb315) — same
  3 repos
- `HeliosCLI/crates/harness_interfaces/src/lib.rs` and
  `helioscope/crates/harness_interfaces/src/lib.rs`
  (md5 91695048) — `Handler`, `Publisher`,
  async `Subscriber` traits

Total: **3 sets of byte-identical traits** that should
collapse into 1-2 shared crates.

## 10. M3/foundation-model references (RUNNING)

Scanning for hardcoded `haiku`, `claude-3-haiku`,
`claude-opus-4-`, `claude-sonnet-4-` strings. ETA
10-15 min.

## 11. Stale issue triage (RUNNING)

Triage open issues >60 days. ETA 5-10 min.

## 12. Dep rotation + CVE scan (RUNNING)

Top CVEs to look for: `tokio-tar` (CVE-2025-62518),
`serde` (older), `time` (older), `chrono` (older),
`tar` Rust crate, `jsonwebtoken`, `actix-web`.

## 13. Stale worktree .gitignore (RUNNING)

10 repos, adding `/worktrees/` and `/*-wtrees/` to
`.gitignore`. ETA 5-10 min.

## 14. License/CODEOWNERS gaps (RUNNING)

5 most-important missing-file repos getting
LICENSE/CODEOWNERS/SECURITY.md/CONTRIBUTING.md/FUNDING.yml.

## 15. SHA pin hygiene (RUNNING)

5 highest-impact SHA-pin fixes. ETA 5-10 min.

## 16. README/landing-page hygiene (RUNNING)

10 highest-priority READMEs getting work-state headers.

## 17. Code orphan detection (RUNNING)

Find `.rs/.py/.ts/.js/.go` files with zero references
and >90 days old. ETA 15-20 min.

## 18. Workflow YAML/TOML/JSON lint drift (RUNNING)

Top drifted configs getting PRs.

## 19. Cross-language model file drift (RUNNING)

Rust/TS/Python/JSON drift in API/data types.

## 20. Bash/shell-script quality (RUNNING)

Shebang, `set -euo pipefail`, unquoted vars, hardcoded
paths.

## 21. PyO3/Rust-Python bindings (RUNNING)

Hand-rolled cffi/ctypes vs `pyo3` consolidation.

## 22. TS/JS framework drift (RUNNING)

React vs Vue vs Svelte vs Solid vs Astro etc.

## 23. Token/secrets scan (RUNNING)

AWS, GitHub PAT, Slack, Stripe, RSA private keys.

## 24. Dockerfile best practices (RUNNING)

Multi-stage, digest pinning, non-root, healthcheck,
.dockerignore.

## 25. Env-var drift (RUNNING)

`.env.example` declared-vs-used.

---

## Next steps

- Continue waiting for the remaining 15+ agents
- Update this file with their findings
- Open follow-up PRs from the actionable findings
  (worktree .gitignore, LICENSE, SHA pin, README headers)
- Write final worklog with prioritized next-DAG items
