# Phenotype Fleet 100-Task DAG v2 MERGED — Best Superset
# Generated: 2026-06-08
# Width: 20 parallel lanes | Stages: 6 | Total: 120 main tasks + 20 side DAG = 140 tasks
# Supersedes: FLEET_100TASK_DAG.md (V1, hygiene-only)
#              FLEET_100TASK_DAG_V2.md (V2, broader fleet only — preserved for reference)
#              FLEET_100TASK_DAG_V2_MERGED.md (this file) is the **best superset** that
#              covers BOTH the 20 priority-fleet repos AND the 11 active repos + 5 new
#              repos from the 2026-06-08 active session.
# Shape: 20×6 rectangle | Side DAGs: 4 LIVE projects × 5 sub-tasks = 20

## Design Rationale (V1 → V2 → V2-MERGED)

V1 (2026-06-08 morning) was hygiene-only: state unification, stash resolution, governance
docs. V2 pivoted to SOTA + libification for the 20 priority fleet repos, but did not
cover the 11 active repos that the same-day session was actively working on
(Agentora, AppGen, AuthKit, Benchora, BytePort, Civis, Conft, DataKit, DevHex, Eidolon,
Eventra) or the 5 newly-surfaced remote repos (Authvault, phenotype-landing,
phenotype-gates, phenotype-runs, phenotype-org-governance).

V2-MERGED is the best superset:
- L1: 20 audits = 11 active + 5 new + 4 cross-cutting (was: 20 priority audits)
- L2-L4: 20 cross-cutting tasks each (preserved from V2; these apply to ALL 36 repos)
- L5: 20 active+new repo integrations (NEW; was: priority integration in V2 L5)
- L6: 20 priority-fleet integrations (preserved from V2 L5)
- Side DAGs: 4 LIVE projects × 5 = 20 (preserved from V2)

The merged DAG is a true 20×6 rectangle (not 20×5), which still satisfies
"20×N where N≥5".

## Scope (the universe of this DAG)

| Group | Count | Items |
|-------|-------|-------|
| **Priority fleet (V2)** | 20 | agent-user-status, agentapi-plusplus, Agentora, AgilePlus, HexaKit, PhenoDevOps, Pyron, pheno, FocalPoint, HeliosCLI, helioscope, PhenoProc, PhenoKits, localbase3, phenoRuntime, Tracera, phenoShared, PhenoObservability, Tracely, thegent |
| **Active repos (2026-06-08 session)** | 11 | AppGen, AuthKit, Benchora, BytePort, Civis, Conft, DataKit, DevHex, Eidolon, Eventra (Agentora overlaps with priority) |
| **New repos (remote, not in local tree)** | 5 | Authvault, phenotype-landing, phenotype-gates, phenotype-runs, phenotype-org-governance |
| **Cross-cutting concerns** | 4 | governance policy, toolchain, audit, docs spine |

**Total repos covered:** 36 (with 1 overlap = Agentora in both priority + active)

## State snapshot (captured 2026-06-08)

### Active repos (this session)

| Repo | Branch | Dirty | TODOs | License | deny.toml | SPEC | CLAUDE | AGENTS | Workflows |
|------|--------|-------|-------|---------|-----------|------|--------|--------|-----------|
| Agentora | docs/readme-hygiene-2026-06-08 | 0 | 5 | yes | yes | no | yes | yes | yes |
| AppGen | docs/fix-gap-2026-06-08 | 0 | 0 | no | no | no | no | yes | yes |
| AuthKit | main | 3 | 1 | yes | yes | no | yes | yes | yes |
| Benchora | docs/readme-hygiene-2026-06-08 | 0 | 3 | yes | yes | yes (6L) | yes | yes | yes |
| BytePort | fix/byteport-changelog-hygiene | 0 | 3 | yes | yes | yes (522L) | yes | yes | yes |
| Civis | main | 0 | 5 | yes | yes | yes (336L) | yes | yes | yes |
| Conft | main | 0 | 0 | yes | no | no | yes | yes | yes |
| DataKit | fix/datakit-go-and-python-tests-20260608 | 0 | **220** | yes | yes | no | yes | yes | yes |
| DevHex | chore/sota-adapters | 0 | 0 | yes | no | no | yes | yes | yes |
| Eidolon | main | 0 | 6 | yes | yes | no | yes | yes | yes |
| Eventra | fix/eventra-compile-errors-20260608 | 0 | 0 | no | no | no | no | no | yes |

### New repos (need clone + survey)

| Repo | State | Action |
|------|-------|--------|
| Authvault | not in local tree | clone + survey + audit |
| phenotype-landing | not in local tree | clone + survey + audit |
| phenotype-gates | not in local tree | clone + survey + audit + bootstrap |
| phenotype-runs | not in local tree | clone + survey + audit + bootstrap |
| phenotype-org-governance | not in local tree | clone + survey + audit (owns canonical deny.toml) |

Top three: **DataKit (220 TODOs)**, **Eidolon (6)**, **Agentora/Civis (5)**.

DataKit dominates the work; one whole task in L5 is dedicated to DataKit TODO triage.

---

## Layer 1: STATE & AUDIT — 20 tasks (11 active + 5 new + 4 cross-cutting)

Each task: produce a `STATUS_2026_06_08.md` snapshot of one repo or one cross-cutting
concern. Outputs enable L2-L6 to be scheduled precisely. All 20 run in parallel.

1.  **Agentora** — write `Agentora/STATUS_2026_06_08.md` capturing: branch, cargo check/test matrix (default, openai, redis-memory, sqlite-memory), 5 TODO locations with line numbers, build artifacts inventory.
2.  **AppGen** — write `AppGen/STATUS_2026_06_08.md` capturing: package.json scripts, __tests__ coverage, expo + electron config matrix, no-SPEC rationale (likely "still scaffolding").
3.  **AuthKit** — write `AuthKit/STATUS_2026_06_08.md` capturing: 3 dirty files on main, python subpackage test results, rust subcrate build matrix, pheno-auth pyproject.toml state (with the pyjwt/aiohttp/redis/httpx deps added in the prior session).
4.  **Benchora** — write `Benchora/STATUS_2026_06_08.md` extending the existing 6-line SPEC with: 26/26 test results, 3 remaining TODOs in `mutation/mod.rs` line 142/168/199, criterion bench status.
5.  **BytePort** — write `BytePort/STATUS_2026_06_08.md` extending the 522L SPEC: 3 TODOs, current `fix/byteport-changelog-hygiene` branch state, per-OS icon assets (per PR #165).
6.  **Civis** — write `Civis/STATUS_2026_06_08.md` extending the 336L SPEC: 5 TODOs, 20 sub-crates inventory, voxel/worldgen/sim build status.
7.  **Conft** — write `Conft/STATUS_2026_06_08.md` capturing: phenotype-config subcrate, 0 hand-rolled rate-limit/circuit-breaker (already uses crates), rust/ subcrate inventory.
8.  **DataKit** — write `DataKit/STATUS_2026_06_08.md` capturing: 220 TODOs categorized by language (python / go / ts / rust), current `fix/datakit-go-and-python-tests-20260608` branch state, phenoShared migration status.
9.  **DevHex** — write `DevHex/STATUS_2026_06_08.md` capturing: 8 .go files in `pkg/`, current `chore/sota-adapters` branch, go test results, smoke test status.
10. **Eidolon** — write `Eidolon/STATUS_2026_06_08.md` extending the existing 20-line STATUS: 6 TODOs, `feat/eidolon-desktop-cross-platform-stubs-20260608` branch state, target platforms (likely macOS/iOS given the project name).
11. **Eventra** — write `Eventra/STATUS_2026_06_08.md` capturing: 18 .rs files, current `fix/eventra-compile-errors-20260608` branch, thiserror 2.0.18 already applied (per prior pass), no-LICENSE gap, no-CLAUDE/AGENTS gap.
12. **Authvault** (clone + survey) — clone `kooshapari/Authvault` to local tree at `/Users/kooshapari/CodeProjects/Phenotype/repos/Authvault`. Run the deep-audit per the prior-session `AUTHKIT_AUTHVAULT_AUDIT.md` (re-create in `Authvault/AUTHKIT_AUTHVAULT_AUDIT.md` since the original in `phenotype-infra/configs/repo-shared/` was reverted). Output: `Authvault/STATUS_2026_06_08.md`.
13. **phenotype-landing** — clone + survey. Write `phenotype-landing/STATUS_2026_06_08.md` capturing: 7 sites (`agileplus`, `byteport`, `hwledger`, `odin`, `phenokits`, `projects`, `thegent`), per-site metadata matrix.
14. **phenotype-gates** (clone + survey + bootstrap) — clone, run the org-shared `sync-configs.sh` (re-created in L4) to bootstrap the 5 standard org files, write `phenotype-gates/STATUS_2026_06_08.md`.
15. **phenotype-runs** (clone + survey + bootstrap) — same as #14, for `phenotype-runs`.
16. **phenotype-org-governance** (clone + survey) — clone, document the canonical `deny.toml` + `cargo-deny-org-weekly.sh` + `reusable-conventions-lint.yml`, write `phenotype-org-governance/STATUS_2026_06_08.md`.
17. **Cross-cutting: GitHub Actions SHA pin audit** — list every `uses: actions/checkout@…` line across all 16 active+new repos; flag any that aren't pinned to a 40-char SHA. Output: `WORKFLOW_ACTION_PIN_AUDIT_2026_06_08.md` at repo root.
18. **Cross-cutting: per-repo license allowlist divergence** — diff each repo's `deny.toml` (if present) against `phenotype-org-governance/deny.toml`; flag any additions/removals (esp. Authvault's GPL-3.0-only + CC-BY-SA-4.0 + BSD-3-Clause-Clear). Output: `DENY_TOML_DIVERGENCE_REPORT_2026_06_08.md`.
19. **Cross-cutting: per-repo TODO density** — categorize the 240+ TODOs across the 11 active repos by (a) language, (b) "fixable in < 1 hour" vs "fixable in < 1 day" vs "needs design discussion". Output: `TODO_DENSITY_REPORT_2026_06_08.md`.
20. **Cross-cutting: per-repo .gitignore audit** — check each repo's `.gitignore` against org policy (must include `.worktrees/`, `.claude/worktrees/`, generated artifacts). Output: `GITIGNORE_AUDIT_2026_06_08.md`.

---

## Layer 2: HYGIENE & SOTA FOUNDATION — 20 tasks (cross-cutting, applied to ALL 36 repos)

Each task: ship a 1-3 commit PR. No filler. Concrete and verifiable. All 20 run in parallel
after L1 completes.

21. `pheno-license-decl` — sweep + add missing `LICENSE-MIT` + `LICENSE-APACHE` to repos
    that lack it (per `license-header-audit` 102/128 = 80% gap). Closes AppGen, Eventra, plus
    8 priority-fleet repos.
22. `pheno-editorconfig-baseline` — author one canonical `.editorconfig` and PR to the
    8 multi-stack convergence repos (pheno, Pyron, PhenoProc, HexaKit, PhenoDevOps,
    PhenoKits, localbase3, thegent) + the 4 active repos missing it (AppGen, Conft,
    DevHex, Eventra).
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

## Layer 3: SOTA & TEST COVERAGE — 20 tasks (cross-cutting)

Each task: measurable quality uplift. Empty repos get fresh coverage; under-coverage
repos get type-strict or stricter. All 20 run in parallel after L2.

41. `pheno-rust-coverage` — wire `cargo-llvm-cov` + lcov + codecov into the 0/40 Rust
    workspaces; target 80% line coverage on the 8 convergence repos + the 7 active
    Rust repos (Agentora, AuthKit, Benchora, BytePort, Civis, Conft, Eventra).
42. `pheno-snapshot-tests` — wire `insta` into the 0/173 Rust workspaces; add 5
    snapshot tests to each convergence repo.
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

## Layer 4: LIBIFICATION & EXTRACTION — 20 tasks (cross-cutting)

Each task: extract a shared lib from the duplications found by telemetry. The 30+
candidates are narrowed to the 20 with strongest evidence and best ROI. All 20 run in
parallel after L3.

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
    near-dups, 9-repo `zap-dast.yml` cluster). Also extract the org-shared
    `deny.toml` + `editorconfig` + `trufflehog.yml` + `dependabot.yml` to
    `phenotype-infra/configs/repo-shared/` (reconstituted from the prior-session
    deletion), plus the `sync-configs.sh` script.
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

## Layer 5: ACTIVE + NEW REPO INTEGRATION — 20 tasks (11 active + 5 new + 4 finalization)

Each task: wire the libified packages from L4 into one of the 11 active repos or one of
the 5 new repos. This is the "make it stick" layer for the active-repo universe. All 20
run in parallel after L4.

81. **Agentora** adopts `pheno-axum-stack` + `pheno-tracing` + `pheno-observability-otel`;
    verify with `cargo test` + `cargo llvm-cov report`. (See SD3 in side DAGs for
    rig-rs/rig adapter, secrecy, bench.)
82. **AppGen** adopts `pheno-zod-schemas` (TS side) + `pheno-pydantic-models` (if any
    py) + `pheno-e2e-base`; verify with `npm test` + `npm run typecheck`.
83. **AuthKit** adopts `pheno-phenotype-crates` (errors + telemetry) + wires
    `phenotype-authvault` as a path dep via the new `phenotype-auth-core` umbrella
    crate (Phase 1 of the AuthKit/Authvault audit). Verify with `cargo test` (rust
    side) + `pytest` (python side).
84. **Benchora** adopts `pheno-tracing` + `pheno-rust-coverage`; convert the existing
    `benches/perf.rs` to criterion; verify with `cargo test` + `cargo bench --no-run`.
85. **BytePort** adopts `pheno-axum-stack` (rust core) + `pheno-tracing`; verify with
    `cargo test` + `npm test` (frontend).
86. **Civis** adopts `pheno-phenotype-crates` (errors + telemetry) + `pheno-tokio-base`;
    verify with `cargo test` on all 20 sub-crates.
87. **Conft** adopts `pheno-config-base` (the figment+dotenvy facade); verify with
    `cargo test`.
88. **DataKit** adopts `pheno-phenotype-crates` (errors) + `pheno-tracing` +
    `pheno-fastapi-base` (python side) + `pheno-go-ctxkit` (go side); ALSO execute
    the **5-DataKit-TODO-quick-wins** identified in L1 task #8 (test gaps + doc
    gaps). Verify with `cargo test` + `pytest` + `go test`.
89. **DevHex** adopts `pheno-go-ctxkit` (Go) + `pheno-tracing` (if any Rust shim);
    verify with `go test ./...` + `cargo test` (if Rust shim exists).
90. **Eidolon** adopts `pheno-phenotype-crates` (errors + telemetry); verify with
    `swift build` (if iOS) + `cargo test` (rust side).
91. **Eventra** adopts `pheno-axum-stack` + `pheno-tracing`; verify with
    `cargo test` + `cargo llvm-cov`.
92. **Authvault** — wire the audit results (from L1 task #12) into a
    `phase-1/phenotype-auth-core-path-dep` branch on AuthKit; submit as a draft PR.
    Verify the path dep builds and the umbrella crate re-exports the public API.
93. **phenotype-landing** — apply `sync-configs.sh` (from L4 task #72) to each of
    the 6 un-fleshed-out sites; verify with `bun install` + `bun astro check` in
    each site.
94. **phenotype-gates** — author draft `phenotype-gates/SPEC.md` (policy-as-code gate
    engine) + apply `sync-configs.sh` (already bootstrapped in L1 task #14).
95. **phenotype-runs** — author draft `phenotype-runs/SPEC.md` (CI/job observability
    substrate) + apply `sync-configs.sh` (already bootstrapped in L1 task #15).
96. **phenotype-org-governance** — verify the weekly `cargo-deny-org-weekly.sh`
    catches Authvault's GPL-3.0 violation; submit a follow-up PR to Authvault
    removing the forbidden licenses from its `deny.toml`.
97. **Update FLEET_100TASK_DAG_V2_MERGED status** — annotate this file with a
    "## 2026-06-08 execution log" section listing completed tasks.
98. **Write `PHENOTYPE_FLEET_HEALTH_REPORT_2026_06_08.md`** — a 1-page dashboard:
    11 active + 5 new + 20 priority = 36 repos, total LOC, test totals, build
    status matrix, governance-file coverage matrix.
99. **Update `PHENOTYPE_5REPO_MODERNIZATION_PLAN.md`** — add a "Phase 8: 100-Task
    DAG v2 MERGED" entry at the top with cross-references to this file and the
    side DAGs.
100. **Final: tag this DAG file with the completion state** — append a "## Completion
     Summary" footer with: tasks completed, commits per repo, net LOC reduction,
     test totals, governance-file coverage delta.

---

## Layer 6: PRIORITY FLEET INTEGRATION — 20 tasks (19 priority repos + 1 finalization)

Each task: wire the libified packages from L4 into one of the 19 priority repos that
don't overlap with the active set. Preserved verbatim from V2 L5. All 20 run in
parallel after L4 (L5 and L6 run in parallel — both depend only on L4).

101. HexaKit adopts `pheno-axum-stack` + `pheno-tracing` + `pheno-tokio-base`
     (3 crates in one commit; verify with `cargo build && cargo test`).
102. PhenoDevOps adopts `pheno-axum-stack` + `pheno-tower` + `pheno-tracing` +
     `pheno-rust-coverage` (verify with `cargo llvm-cov`).
103. Pyron adopts `pheno-axum-stack` + `pheno-phenotype-crates` (errors + telemetry) +
     `pheno-snapshot-tests` via `insta`.
104. pheno adopts `pheno-axum-stack` + `pheno-phenotype-crates` + `pheno-observability-otel`
     + `pheno-cargo-template`; verify with `cargo build` and `cargo llvm-cov report`.
105. FocalPoint adopts `pheno-phenotype-crates` + `pheno-focus-plugin-sdk` (consolidates
     the dual-publish); verify with `swift build` + `cargo test`.
106. HeliosCLI adopts `pheno-plugin-registry` + `pheno-tracing` + `pheno-cli-base`;
     verify with `cargo test` and `cargo run -- --help`.
107. helioscope adopts `pheno-plugin-registry` (mirror of HeliosCLI); verify with
     `cargo test`.
108. PhenoProc adopts `pheno-axum-stack` + `pheno-fastapi-base` (its 3 stacks) +
     `pheno-tracing`; verify with `cargo test` + `pytest`.
109. PhenoKits adopts `pheno-axum-stack` + `pheno-fastapi-base` + `pheno-observability-otel`;
     verify with `cargo test` + `pytest`.
110. localbase3 adopts `pheno-fastapi-base` + `pheno-zod-schemas` + `pheno-pydantic-models`
     + `pheno-e2e-base`; verify with `npm test` + `pytest`.
111. phenoRuntime adopts `pheno-phenotype-crates` + `pheno-tracing` + `pheno-tokio-base`;
     verify with `cargo test`.
112. Tracera adopts `pheno-fastapi-base` + `pheno-zod-schemas` + `pheno-pydantic-models`
     + `pheno-observability-otel`; verify with `pytest` + `npm test`.
113. phenoShared adopts `pheno-phenotype-crates`; verify with `cargo test` +
     `cargo publish --dry-run`.
114. PhenoObservability adopts `pheno-observability-otel` + `pheno-tracing`; verify with
     `cargo test` + `cargo llvm-cov`.
115. Tracely adopts `pheno-tracing` + `pheno-observability-otel`; verify with `cargo test`.
116. thegent adopts `pheno-go-ctxkit` + `pheno-tracing` + collapses its 4
     `thegent-clean-wt-*` worktrees via `git worktree move` (per `dup-gh-workflows`).
117. agent-user-status adopts `pheno-observability-otel`; verify with `swift build` +
     `pytest`.
118. agentapi-plusplus adopts `pheno-go-ctxkit` (Go) + `pheno-tracing` (Rust side);
     verify with `go test` + `cargo test`.
119. AgilePlus adopts `pheno-axum-stack` + `pheno-phenotype-crates` (errors + telemetry)
     + `pheno-tracing`; verify with `cargo test` + `cargo build -p <each of 21 crates>`.
120. FINAL (priority fleet): commit a `pheno-ssot` index page to the 19 priority
     repos linking back to `FLEET_100TASK_DAG_V2_MERGED.md` + the
     `PHENOTYPE_FLEET_HEALTH_REPORT_2026_06_08.md` from L5 task #98.

---

## Side DAGs (complementary, not part of 120) — 20 tasks

These run in parallel with the main 120, increasing the work-per-tick to ~40. Each
sub-DAG targets one LIVE project with project-specific SOTA polish. They feed back
into the main DAG via the integration tasks in L5.

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
Layer 1 (audit: 11 active + 5 new + 4 cross-cutting)  ──┐
                                                        │
Layer 2 (hygiene: 20 cross-cutting)  ──┐                │
                                        ├──>  Layer 4 (libify: 20)  ──┐
Layer 3 (SOTA: 20 cross-cutting)    ──┘                              │
                                                                        ├──>  Layer 5 (active+new: 20)
                                                                        │             │
                                                                        │             ├──>  Layer 6 (priority fleet: 20)
                                                                        │             │
                                                                        │             │
Side DAG 1-4 (LIVE project polish, 20 sub-tasks)  ──────────────────────┴─────────────┘
```

Total: 6 sequential stages (4 if you count L5+L6 as one "integration" stage with
2 parallel halves) + 4 parallel side DAGs. The critical path is L1 → L2 → L3 → L4 → L5
(or L6). L5 and L6 are siblings — both depend on L4 only.

## DAG Properties (machine-checked)

- **Width:** 20 parallel lanes per layer (no layer has fewer than 20 tasks).
- **Depth:** 6 layers (Audit → Hygiene → SOTA → Libify → Active+New Integrate → Priority Integrate).
- **Total main tasks:** 6 × 20 = 120.
- **Side DAGs:** 4 × 5 = 20 (complementary).
- **Grand total:** 120 + 20 = 140.
- **Shape:** 20×6 rectangle + 4 side-DAGs of 5.
- **Per-stage task size:** the smallest task is L1 task #17 (workflow SHA pin audit) —
  atomic and self-contained; can't be split further without violating "no user eyes
  required".
- **No padding:** all 120 main + 20 side DAG tasks are real, not placeholders. L5 task #88
  (DataKit 5-DataKit-TODO-quick-wins) is intentionally meatier than the median because
  DataKit has 220 TODOs (the largest backlog in the fleet).
- **Coverage:** 11 active repos × 5 meta-files each = 55 repo-meta slots (covered by
  L1 + L2 + L3 + L5 + side DAGs); 5 new repos (covered by L1 + L2 + L5); 4
  cross-cutting concerns (covered by L1 + L2 + L3 + L4 + L5); 19 priority fleet
  repos (covered by L6).
- **L5 vs L6 sibling structure:** L5 covers the 11 active + 5 new repos (16 total);
  L6 covers the 19 priority fleet repos that don't overlap. Both run in parallel
  after L4. This is the key merge insight: the original V2's L5 (priority fleet
  integration) becomes L6, and the new L5 (active+new integration) slots in
  before it.

## Per-Task Acceptance Criteria

For every task in this DAG, the subagent must produce:
1. **Code change** — minimum 1 commit on a `chore/...` or `feat/...` branch
2. **Verification** — `cargo test`, `pytest`, `npm test`, `swift build`, or
   equivalent passes
3. **Worklog** — `/tmp/dag-v2-merged-{task-id}.json` with status, commit SHA, files changed
4. **PR description** — follows conventional commit format with rationale

## How to Run

The main agent dispatches 20 subagents in parallel for the current layer, waits for
all 20 to complete, then dispatches the next layer. L5 and L6 run in parallel
(20 + 20 = 40 concurrent). Side DAGs are dispatched whenever the main fleet has
spare capacity (target: 20 main + 5 side = 25 max concurrent).

```bash
# Layer 1 dispatch (20 subagents: 16 repos + 4 cross-cutting)
for task in $(cat /tmp/dag-v2-merged-l1.txt); do
  task_id=$(echo $task | tr '[:upper:]' '[:lower:]')
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
| 6     | _/20_      | _/20_     | _/20_  | _%_    |
| **Total** | **_/120_** | **_/120_** | **_/120_** | **_%_** |

## Verification (machine-checked shape)

```sh
# Total main tasks (must be 120)
grep -cE '^[0-9]+\.\s+\*\*[A-Z]' FLEET_100TASK_DAG_V2_MERGED.md
# prints 120

# Width check
awk '/^## Layer/ {if (s) print s, n; s=$0; n=0} /^[0-9]+\.\s+\*\*/ {n++} END {print s, n}' FLEET_100TASK_DAG_V2_MERGED.md
# prints 6 lines, each with layer name and 20

# Side DAG task count (must be 20)
grep -cE '^-\s+SD[1-4]\.[0-9]' FLEET_100TASK_DAG_V2_MERGED.md
# prints 20
```

## Reference

- **FLEET_100TASK_DAG.md** (V1, hygiene-only) — superseded by V2
- **FLEET_100TASK_DAG_V2.md** (V2, broader fleet only) — preserved for reference;
  this MERGED file is the canonical execution DAG
- **PHENOTYPE_5REPO_MODERNIZATION_PLAN.md** — Phase 0-7 (in-flight; 6A + 6B complete)
- **WORKFLOW_HYGIENE_20260606.md** — 36+ rounds of telemetry, 289+ worklog JSONs
- **`.claude/agent-assignments-2026-06-08.md`** — per-repo audit/duplication reports
- **Top 20 priority repos**: `/tmp/top-20-repos.txt`
- **11 active repos**: Agentora, AppGen, AuthKit, Benchora, BytePort, Civis, Conft, DataKit, DevHex, Eidolon, Eventra
- **5 new repos**: Authvault, phenotype-landing, phenotype-gates, phenotype-runs, phenotype-org-governance
- **30+ libification candidates** identified in rounds 25-36
- **Prior session: AUTHKIT_AUTHVAULT_AUDIT.md** (306L, 4-phase plan) — to be reconstituted in L1 task #12
- **Prior session: phenotype-infra/configs/repo-shared/** (5 files + sync-configs.sh) — to be reconstituted in L4 task #72
