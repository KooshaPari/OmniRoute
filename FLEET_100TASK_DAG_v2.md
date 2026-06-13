# Phenotype Fleet 100-Task DAG v2 — SOTA + Libification Edition
# Generated: 2026-06-08
# Supersedes: FLEET_100TASK_DAG.md (hygiene-only v1)
# Width: 20 parallel lanes (max subagent cap) | Stages: 5 | Total: 100 tasks
# Shape: 20×5 rectangle | Side DAGs: 4 LIVE projects × 5 sub-tasks each = 20 sub-tasks

## Design Rationale (v1 → v2)

v1 (2026-06-08 morning) was hygiene-only: state unification, stash resolution, governance
docs. Most of that work is in-flight (289 worklog JSONs, 30+ libification candidates
identified via 36+ rounds of sweeps). v2 pivots to:

1. **State & audit per-repo** (Layer 1) — produce JSON hygiene score + 3-task mini-DAG
2. **Hygiene & SOTA foundation** (Layer 2) — fill gaps from telemetry (SSOT, yamllint,
   cargo-llvm-cov, insta, tsc-strict, mypy-strict, dependabot)
3. **SOTA & test coverage** (Layer 3) — wire 0/N gaps identified in telemetry
4. **Libification & extraction** (Layer 4) — turn 30+ candidates into actual lib crates
5. **Convergence integration** (Layer 5) — wire libified packages into the 13-repo
   convergence cluster, validate, document

Side DAGs (do not count toward 100): 4 LIVE projects × 5 deep SOTA sub-tasks = 20
overflow tasks. These run in parallel with the main 100 and complement with
project-specific polish.

## Priority 20 Repos (the universe of this DAG)

LIVE (4):     agent-user-status, agentapi-plusplus, Agentora, AgilePlus
Convergence (4): HexaKit, PhenoDevOps, Pyron, pheno
Web-stack (5): FocalPoint, HeliosCLI, helioscope, PhenoProc, PhenoKits
Multi-stack (3): localbase3, phenoRuntime, Tracera
Shared (4):   phenoShared, PhenoObservability, Tracely, thegent

---

## Layer 1: STATE & AUDIT (20 tasks — all parallel, 1 per repo)

Each task: produce `audit-{repo}.json` (hygiene score, dep summary, dup exposure,
SOTA gap list) + commit a `chore(audit): ...` PR description. Inputs: telemetry
worklogs. Output: enables Layers 2-3 to be scheduled precisely.

1.  `agent-user-status` — audit (LIVE, macOS menu-bar, already SOTA'd)
2.  `agentapi-plusplus` — audit (LIVE, Go HTTP wrapper, already SOTA'd)
3.  `Agentora` — audit (LIVE, Rust LLM agent, already SOTA'd via PR #63)
4.  `AgilePlus` — audit (LIVE, 21-crate Rust+TS, already SOTA'd)
5.  `HexaKit` — audit (multi-stack, 11 plugin-trait crates, axum+tower+chi)
6.  `PhenoDevOps` — audit (convergence, full tokio+axum+tonic stack)
7.  `Pyron` — audit (convergence, axum-extra+tower+actix-web)
8.  `pheno` — audit (convergence, largest monorepo, 21+ crates)
9.  `FocalPoint` — audit (mac focus mgmt, 21 crates, swift+rust)
10. `HeliosCLI` — audit (codex-* toolchain cluster, 12 plugin-trait crates)
11. `helioscope` — audit (HeliosCLI mirror, derive_more locked)
12. `PhenoProc` — audit (multi-stack rust+go+python, eval orchestrator)
13. `PhenoKits` — audit (axum+chi+fastapi multi-web)
14. `localbase3` — audit (vue+fastapi, local SQLite)
15. `phenoRuntime` — audit (core Pheno runtime)
16. `Tracera` — audit (Vue+FastAPI, only ML+ML-compute repo)
17. `phenoShared` — audit (shared `crates/phenotype-*` consumer)
18. `PhenoObservability` — audit (telemetry/metrics provider)
19. `Tracely` — audit (workflow tracer)
20. `thegent` — audit (biggest repo, has 4 `thegent-clean-wt-*` mirror worktrees)

---

## Layer 2: HYGIENE & SOTA FOUNDATION (20 tasks — all parallel, depends on L1)

Each task: ship a 1-3 commit PR. No filler. Each is concrete and verifiable.

21. `pheno-license-decl` — sweep + add missing `LICENSE-MIT` + `LICENSE-APACHE` to repos
    that lack it (per `license-header-audit` 102/128 = 80% gap).
22. `pheno-editorconfig-baseline` — author one canonical `.editorconfig` and PR to the
    8 multi-stack convergence repos (pheno, Pyron, PhenoProc, HexaKit, PhenoDevOps,
    PhenoKits, localbase3, thegent).
23. `pheno-dependabot-bump` — ensure `.github/dependabot.yml` exists in the 12 repos
    that lack it (per `dependabot-version-audit` 116/121 = 4% gap).
24. `pheno-changelog-template` — author canonical `CHANGELOG.md` template (Keep-a-Changelog
    1.1.0) and PR to 16 repos that lack it.
25. `pheno-issue-template-baseline` — author bug-report + feature-request YAML templates
    (per `dup-yaml` finding, 3 repos share `--bug-report.yaml`).
26. `pheno-pr-template-baseline` — author `PULL_REQUEST_TEMPLATE.md` with conventional
    commit checklist; PR to 10 repos.
27. `pheno-codeowners-baseline` — author `CODEOWNERS` covering `crates/*`, `apps/*`,
    `tools/*`; PR to the 10 repos that lack it.
28. `pheno-contributing-baseline` — author `CONTRIBUTING.md`; PR to the 7 gaps.
29. `pheno-security-md` — author `SECURITY.md` (Coordinated Disclosure v1.1); PR to 6 gaps.
30. `pheno-funder-template` — author `.github/FUNDING.yml`; PR to repos with no funding
    config (101/168 = 60% gap).
31. `pheno-yamllint-baseline` — author `.yamllint` + `.yamlfmt`; roll out to 5 repos
    (per `yaml-lint-audit` 0/169 = total gap).
32. `pheno-ci-cargo-cache` — add `Swatinem/rust-cache@v2` to the 29 repos that lack it
    (per `workflow-cache-audit` 29/134).
33. `pheno-ci-concurrency` — add `concurrency:` block to the 47+ workflows that lack it
    (per `ci-concurrency-audit`).
34. `pheno-ci-timeout` — add `timeout-minutes:` to workflows (per `timeout-audit`).
35. `pheno-ci-permissions` — harden `permissions:` block to read-only default; PR to
    50+ workflows (per `permissions-audit`).
36. `pheno-ci-sha-pin` — convert 14 tag-only Action refs to SHA-pinned (per
    `workflow-pin-audit` 14/134 = 10% gap).
37. `pheno-ossf-scorecard` — author scorecard workflow + badge; seed into 10 high-value
    repos (per `ossf-scorecard-audit` 0/139 = total gap).
38. `pheno-stale-pr-bot` — author `actions/stale` workflow with 30-day idle; PR to 100
    repos (per `stale-pr-audit`).
39. `pheno-renovate-presence` — convert 119 non-renovate repos to use `renovate.json5`
    (per `renovate-presence` 50/169 = 30% gap).
40. `pheno-secret-scan` — author `gitleaks` workflow with default ruleset; PR to 50
    highest-leverage repos (per `secret-scan` sweep).

---

## Layer 3: SOTA & TEST COVERAGE (20 tasks — all parallel, depends on L2)

Each task: measurable quality uplift. Empty repos get fresh coverage; under-coverage
repos get type-strict or stricter.

41. `pheno-rust-coverage` — wire `cargo-llvm-cov` + lcov + codecov into the 0/40 Rust
    workspaces; target 80% line coverage on the 8 convergence repos (per
    `coverage-tool-audit` 0/40 = total gap).
42. `pheno-snapshot-tests` — wire `insta` into the 0/173 Rust workspaces; add 5
    snapshot tests to each convergence repo (per `snapshot-test-audit` 0/173 = gap).
43. `pheno-doctest-rust` — add `#![warn(missing_docs)]` to lib.rs of 10 priority Rust
    crates; add 3 doc-tests each (per `doc-test-audit` 1/168).
44. `pheno-pytest-markers` — add custom pytest markers (`@slow`, `@integration`,
    `@e2e`) to the 31 pytest repos (per `test-runner-audit`).
45. `pheno-pydantic-strict` — add `model_config = ConfigDict(strict=True)` to all
    pydantic models in 10 priority repos; add `extra="forbid"` (per
    `form-validation-libs` 27 pydantic repos).
46. `pheno-zod-schemas` — author shared `@phenotype/zod-schemas` package with the 12
    common schemas (per `form-validation-libs` 12 zod repos).
47. `pheno-mypy-strict` — add `mypy --strict` to 10 priority Python repos; fix
    resulting issues (per `python-typing-strict`).
48. `pheno-pyright-config` — add `pyrightconfig.json` to 10 priority Python repos with
    `strict: ["pylance"]` (per `pyright-config`).
49. `pheno-ruff-config` — author canonical `[tool.ruff]` config; PR to 10 priority
    Python repos (per `python-ruff-config`).
50. `pheno-tsc-strict` — add `"strict": true` to 8 TS repos; fix resulting issues
    (per `tsc-strict`).
51. `pheno-eslint-strict` — add `eslint:recommended` + `tseslint:recommended` extends
    to 8 TS repos (per `eslint-strict`).
52. `pheno-vitest-config` — author canonical `vitest.config.ts`; PR to 10 vitest repos
    (per `vitest-config`).
53. `pheno-jest-config` — author canonical `jest.config.ts`; PR to 8 jest repos.
54. `pheno-go-vet-strict` — add `-vet=all` to the 14 cobra repos (per `cli-tools-audit`).
55. `pheno-e2e-base` — author shared `@phenotype/e2e-base` Playwright config; wire into
    the 12 playwright repos (per `browser-stack-audit` 12 playwright repos).
56. `pheno-async-trait-migration` — sweep the 6 repos that already use native
    `async fn` in trait and document the pattern; migrate the 2 stragglers that still
    use `async-trait` crate (per `async-trait-audit`).
57. `pheno-error-context` — add `anyhow::Context` to the 5 hotspots in each convergence
    repo; standardize on `thiserror` for libs (per `error-context`).
58. `pheno-tracing-baseline` — wire `tracing-subscriber` with `EnvFilter` +
    `tracing-appender` to the 28 repos; provide a `pheno-tracing::init()` one-liner
    (per `tracing-layered` 28 tracing-subscriber repos).
59. `pheno-observability-otel` — author `pheno-otel` crate wrapping `opentelemetry` +
    `tracing-opentelemetry`; wire into the 4 convergence repos.
60. `pheno-feature-flags` — author `pheno-flags` crate (FFI-free, no LaunchDarkly) with
    `figment` config + `tracing` instrumentation; PR to the 18 config-bearing repos.

---

## Layer 4: LIBIFICATION & EXTRACTION (20 tasks — all parallel, depends on L3)

Each task: extract a shared lib from the duplications found by telemetry. The 30+
candidates are narrowed to the 20 with strongest evidence and best ROI.

61. `pheno-cargo-template` — author `pheno-cargo-template` crate with the 5 most-common
    `[package]`, `[dependencies]`, `[features]`, `[workspace]`, `[lib]` blocks
    (per `dup-cargo-toml` 665 pairs across 76 repos = HIGHEST-LEVERAGE).
62. `pheno-phenotype-crates` — extract `crates/phenotype-errors`,
    `crates/phenotype-telemetry`, `crates/phenotype-contracts` from HexaKit,
    PhenoDevOps, Pyron, pheno, phenoShared into a shared workspace at
    `KooshaPari/phenotype-crates` (per `workspace-shared-members` 5-cluster).
63. `pheno-rust-coverage-crate` — author `pheno-coverage` with `cargo-llvm-cov`
    config presets; reduces the 40-repo gap to 1 config file.
64. `pheno-tracing-crate` — author `pheno-tracing` consolidating the 28
    tracing-subscriber + 6 tracing-appender init patterns.
65. `pheno-tower-crate` — author `pheno-tower` consolidating the 6 tower +
    3 axum-extra middleware setups; ships `tracing`, `cors`, `request-id`,
    `timeout` middleware.
66. `pheno-tokio-base-crate` — author `pheno-tokio-base` for the 65 tokio repos:
    runtime bootstrap, signal handling, graceful shutdown, `MainError` exit code.
67. `pheno-axum-stack-crate` — author `pheno-axum-stack` for the 13 axum+tower+tower-http
    cluster: opinionated `Router::new()` with `pheno-tower` + `pheno-tracing` +
    `pheno-tokio-base` wired.
68. `pheno-go-ctxkit` — author `KooshaPari/pheno-go-ctxkit` Go module: context
    helpers (24 `WithTimeout` + 18 `WithCancel` repos).
69. `pheno-fastapi-base` — author `KooshaPari/pheno-fastapi-base` Python package:
    shared `create_app()` factory + middleware (12 FastAPI repos).
70. `pheno-cli-base` — author `pheno-cli-base` Rust crate: shared clap derive macros
    + config loader + log init (60 CLI repos: 35 clap + 14 cobra + 11 typer).
71. `pheno-shared-helpers` — author `pheno-shared-helpers` Rust crate: top-15 helpers
    (`acquire_lock` 7, `acquire` 6, `actor` 6, etc.) as trait-based pluggable utils
    (per `dup-helper-fns` 2967 candidates).
72. `pheno-ci-templates` — extract `.github/workflows/ci.yml`, `zap-dast.yml`,
    `rust-ci.yml` to `KooshaPari/pheno-ci-templates` (per `dup-gh-workflows` 127
    near-dups, 9-repo `zap-dast.yml` cluster).
73. `pheno-ssot-template` — author `KooshaPari/pheno-ssot-template` repo with the
    canonical `docs/SSOT.md` schema (per `ssot-docs-audit` 0/168 = total gap).
74. `pheno-plugin-registry` — author `pheno-plugin` Rust crate using `inventory` +
    `ctor` (the existing pattern in HeliosCLI/helioscope); consolidate the 42
    plugin-trait repos (per `plugin-trait-audit`).
75. `pheno-focus-plugin-sdk` — extract the single SDK published twice
    (`crates/focus-plugin-sdk` in both `crates/` and `FocalPoint/crates/`) into
    one canonical location (per `team-mob-4 WASM-RUNTIME`).
76. `pheno-zod-schemas-pkg` — author `KooshaPari/pheno-zod-schemas` npm package with
    the 12 shared schemas (per `form-validation-libs`).
77. `pheno-pydantic-models-pkg` — author `KooshaPari/pheno-pydantic-models` PyPI
    package with the 5 shared models (per `form-validation-libs` 27 pydantic repos).
78. `pheno-snapshot-fixtures` — author `KooshaPari/pheno-snapshot-fixtures` with
    the 10 most-shared test fixtures (per `dup-tests` `__init__.py` 17 repos,
    `Button.test.tsx`+`Input.test.tsx` 5 repos).
79. `pheno-e2e-base-pkg` — author `KooshaPari/pheno-e2e-base` Playwright config +
    helpers (per `e2e-test-audit` 21 repos).
80. `pheno-config-base` — author `pheno-config` Rust crate + `pheno-config-py` Python
    package wrapping `figment` + `dotenvy` + `pydantic-settings` behind a uniform
    facade (per `config-locator` 18 repos).

---

## Layer 5: CONVERGENCE INTEGRATION (20 tasks — all parallel, depends on L4)

Each task: wire one libified package into one or more convergence repos, validate,
document. This is the "make it stick" layer.

81. HexaKit adopts `pheno-axum-stack` + `pheno-tracing` + `pheno-tokio-base`
    (3 crates in one commit; verify with `cargo build && cargo test`).
82. PhenoDevOps adopts `pheno-axum-stack` + `pheno-tower` + `pheno-tracing` +
    `pheno-rust-coverage` (verify with `cargo llvm-cov`).
83. Pyron adopts `pheno-axum-stack` + `pheno-phenotype-crates` (errors + telemetry) +
    `pheno-snapshot-tests` via `insta`.
84. pheno adopts `pheno-axum-stack` + `pheno-phenotype-crates` + `pheno-observability-otel`
    + `pheno-cargo-template`; verify with `cargo build` and `cargo llvm-cov report`.
85. FocalPoint adopts `pheno-phenotype-crates` + `pheno-focus-plugin-sdk` (consolidates
    the dual-publish); verify with `swift build` + `cargo test`.
86. HeliosCLI adopts `pheno-plugin-registry` + `pheno-tracing` + `pheno-cli-base`;
    verify with `cargo test` and `cargo run -- --help`.
87. helioscope adopts `pheno-plugin-registry` (mirror of HeliosCLI); verify with
    `cargo test`.
88. PhenoProc adopts `pheno-axum-stack` + `pheno-fastapi-base` (its 3 stacks) +
    `pheno-tracing`; verify with `cargo test` + `pytest`.
89. PhenoKits adopts `pheno-axum-stack` + `pheno-fastapi-base` + `pheno-observability-otel`;
    verify with `cargo test` + `pytest`.
90. localbase3 adopts `pheno-fastapi-base` + `pheno-zod-schemas` + `pheno-pydantic-models`
    + `pheno-e2e-base`; verify with `npm test` + `pytest`.
91. phenoRuntime adopts `pheno-phenotype-crates` + `pheno-tracing` + `pheno-tokio-base`;
    verify with `cargo test`.
92. Tracera adopts `pheno-fastapi-base` + `pheno-zod-schemas` + `pheno-pydantic-models`
    + `pheno-observability-otel`; verify with `pytest` + `npm test`.
93. phenoShared adopts `pheno-phenotype-crates`; verify with `cargo test` + `cargo publish --dry-run`.
94. PhenoObservability adopts `pheno-observability-otel` + `pheno-tracing`; verify with
    `cargo test` + `cargo llvm-cov`.
95. Tracely adopts `pheno-tracing` + `pheno-observability-otel`; verify with `cargo test`.
96. thegent adopts `pheno-go-ctxkit` + `pheno-tracing` + collapses its 4
    `thegent-clean-wt-*` worktrees via `git worktree move` (per `dup-gh-workflows`).
97. agent-user-status adopts `pheno-observability-otel`; verify with `swift build` +
    `pytest`.
98. agentapi-plusplus adopts `pheno-go-ctxkit` (Go) + `pheno-tracing` (Rust side);
    verify with `go test` + `cargo test`.
99. Agentora adopts `pheno-axum-stack` + `pheno-tracing` + `pheno-observability-otel`;
    verify with `cargo test` + `cargo llvm-cov report`.
100. FINAL: update `PHENOTYPE_5REPO_MODERNIZATION_PLAN.md` + `WORKFLOW_HYGIENE_20260606.md`
     with a `## Phase 8: 100-Task DAG v2` section + commit a `pheno-ssot` index
     page to the 20 priority repos linking back to `FLEET_100TASK_DAG_v2.md`.

---

## Side DAGs (complementary, not part of 100)

These run in parallel with the main 100, increasing the work-per-tick to ~40. Each
sub-DAG targets one LIVE project with project-specific SOTA polish. They feed back
into the main DAG via the integration tasks in Layer 5.

### Side DAG 1: agent-user-status (macOS) — 5 tasks
- SD1.1: `feat(swift): native status bar item + menu`
- SD1.2: `feat(py): async status emitter (asyncio + structlog)`
- SD1.3: `chore(ci): macOS-latest matrix + notarization stub`
- SD1.4: `docs: write USER-GUIDE.md + DEVELOPER-GUIDE.md`
- SD1.5: `test: add 20 integration tests (LaunchAgent + IPC)`

### Side DAG 2: agentapi-plusplus (Go) — 5 tasks
- SD2.1: `feat(api): chi v5 migration + middleware order audit`
- SD2.2: `feat(observability): OpenTelemetry SDK init`
- SD2.3: `perf: sync.Pool for HTTP client (reduce alloc)`
- SD2.4: `chore(deps): upgrade coder/agentapi to v0.7.x`
- SD2.5: `docs: write ARCHITECTURE.md + sequence diagrams`

### Side DAG 3: Agentora (Rust LLM) — 5 tasks
- SD3.1: `feat(agent): implement `rig-rs/rig` adapter for unified LLM backend`
- SD3.2: `feat(telemetry): add `tracing` spans for every agent step`
- SD3.3: `feat(tooling): add `cargo bench` + 5 micro-benchmarks`
- SD3.4: `feat(security): add `secrecy` wrapper for API keys`
- SD3.5: `docs: write CONTRIBUTING.md with agent-template walkthrough`

### Side DAG 4: AgilePlus (21-crate Rust+TS) — 5 tasks
- SD4.1: `feat(workspace): migrate to `pheno-phenotype-crates` for errors+telemetry`
- SD4.2: `feat(observability): OpenTelemetry across all 21 crates`
- SD4.3: `feat(test): 80% line coverage on `crates/focus-*` and `crates/connector-*``
- SD4.4: `feat(ci): matrix build (ubuntu-latest + macos-latest)`
- SD4.5: `docs: write CARGO-WORKSPACE.md + per-crate README`

---

## Dependency Graph

```
Layer 1 (audit)  ──┐
                   ├──>  Layer 2 (hygiene)  ──┐
                                              ├──>  Layer 3 (SOTA)  ──┐
                                                                          ├──>  Layer 4 (libify)  ──>  Layer 5 (integrate)
                                                                          │
Side DAG 1-4 (LIVE project polish)  ──────────────────────────────────────┘
```

Total: 5 sequential stages + 4 parallel side DAGs. The critical path is L1 → L2 →
L3 → L4 → L5. Side DAGs are independent and can be picked up at any time.

## Per-Task Acceptance Criteria

For every task in this DAG, the subagent must produce:
1. **Code change** — minimum 1 commit on a `chore/...` or `feat/...` branch
2. **Verification** — `cargo test`, `pytest`, `npm test`, `swift build`, or
   equivalent passes
3. **Worklog** — `/tmp/dag-v2-{task-id}.json` with status, commit SHA, files changed
4. **PR description** — follows conventional commit format with rationale

## How to Run

The main agent dispatches 20 subagents in parallel for the current layer, waits for
all 20 to complete, then dispatches the next layer. Side DAGs are dispatched whenever
the main fleet has spare capacity (target: 20 main + 5 side = 25 max concurrent).

```bash
# Layer 1 dispatch (20 subagents, one per repo)
for repo in $(cat /tmp/top-20-repos.txt); do
  task_id=$(echo $repo | tr '[:upper:]' '[:lower:]')
  dispatch-subagent --task "audit-$task_id" --prompt "..." &
done
wait
```

## Progress Tracker (run after every layer)

| Layer | Dispatched | Completed | Failed | % Done |
|-------|------------|-----------|--------|--------|
| 1     | _/20_      | _/20_     | _/20_  | _%_    |
| 2     | _/20_      | _/20_     | _/20_  | _%_    |
| 3     | _/20_      | _/20_     | _/20_  | _%_    |
| 4     | _/20_      | _/20_     | _/20_  | _%_    |
| 5     | _/20_      | _/20_     | _/20_  | _%_    |
| **Total** | **_/100_** | **_/100_** | **_/100_** | **_%_** |

---

## Reference

- **FLEET_100TASK_DAG.md (v1, hygiene-only)** — superseded by this file
- **PHENOTYPE_5REPO_MODERNIZATION_PLAN.md** — Phase 0-7 (in-flight; 6A + 6B complete)
- **WORKFLOW_HYGIENE_20260606.md** — 36+ rounds of telemetry, 289+ worklog JSONs
- **`.claude/agent-assignments-2026-06-08.md`** — per-repo audit/duplication reports
- **Top 20 priority repos**: `/tmp/top-20-repos.txt`
- **30+ libification candidates** identified in rounds 25-36
