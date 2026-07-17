# Work Packages: Org-Wide Release Governance & DX Automation

**Inputs**: Design documents from `kitty-specs/002-org-wide-release-governance-dx-automation/`
**Prerequisites**: plan.md, spec.md, research.md, data-model.md, contracts/registry-adapter.md

**Tests**: Include testing in each WP where appropriate (adapter tests, CLI tests, workflow validation).

**Organization**: Fine-grained subtasks (`Txxx`) roll up into work packages (`WPxx`). Each work package is independently deliverable and testable.

**Prompt Files**: Each WP references a prompt file in `tasks/`. Lane status in YAML frontmatter.

---

## Work Package WP01: CLI Scaffold & Adapter Interface (Priority: P0)

**Goal**: Create the `pheno-cli` Go project with Cobra skeleton, adapter interface, and version calculation logic.
**Independent Test**: `pheno --help` shows all subcommands; adapter interface compiles; version calculation unit tests pass.
**Prompt**: `tasks/WP01-cli-scaffold-adapter-interface.md`
**Estimated Size**: ~450 lines

### Included Subtasks
- [x] T001 Initialize Go module (`pheno-cli`) with Cobra + Viper + Lipgloss deps
- [x] T002 Create Cobra root command with subcommand stubs (publish, promote, audit, bootstrap, matrix, config)
- [x] T003 Define `RegistryAdapter` interface in `internal/adapters/adapter.go`
- [x] T004 Implement `internal/version/calculator.go` — version suffix logic per registry per channel
- [x] T005 [P] Implement `internal/detect/detector.go` — language/manifest auto-detection
- [x] T006 Unit tests for version calculator (all 7 registries × 5 channels)

### Implementation Notes
- Go 1.23+, use `go mod init github.com/KooshaPari/pheno-cli`
- Adapter interface: `Detect()`, `Version()`, `Build()`, `Publish()`, `Verify()`
- Version calculator is pure logic, no I/O — easy to test exhaustively

### Parallel Opportunities
- T005 (detector) can proceed in parallel with T004 (version calculator)

### Dependencies
- None (starting package)

### Risks & Mitigations
- PyPI PEP 440 edge cases (dev vs alpha ordering) → comprehensive test matrix

---

## Work Package WP02: npm Adapter (Priority: P0)

**Goal**: Implement the npm registry adapter — detect, version, build, publish, verify.
**Independent Test**: Adapter detects package.json, calculates correct npm pre-release versions, publishes with dist-tags.
**Prompt**: `tasks/WP02-npm-adapter.md`
**Estimated Size**: ~350 lines

### Included Subtasks
- [x] T007 Implement `internal/adapters/npm.go` — Detect (parse package.json, check private field)
- [x] T008 Implement npm Version (SemVer pre-release + dist-tag mapping)
- [x] T009 Implement npm Build (`npm pack`)
- [x] T010 Implement npm Publish (`npm publish --tag <channel>`) with retry/backoff
- [x] T011 Implement npm Verify (check registry API for published version)
- [x] T012 Unit + integration tests for npm adapter

### Implementation Notes
- Dist-tag mapping: alpha→alpha, canary→canary, beta→beta, rc→rc, prod→latest
- Handle scoped packages (`@org/name`)
- Private detection: `"private": true` in package.json

### Parallel Opportunities
- All of WP02 can proceed in parallel with WP03 and WP04

### Dependencies
- Depends on WP01 (adapter interface)

### Risks & Mitigations
- npm 2FA/OTP — document that CI uses granular access tokens with 2FA bypass

---

## Work Package WP03: PyPI Adapter (Priority: P0)

**Goal**: Implement the PyPI registry adapter with PEP 440 versioning.
**Independent Test**: Adapter detects pyproject.toml, applies correct PEP 440 suffixes, publishes via twine.
**Prompt**: `tasks/WP03-pypi-adapter.md`
**Estimated Size**: ~350 lines

### Included Subtasks
- [x] T013 Implement `internal/adapters/pypi.go` — Detect (parse pyproject.toml, check classifiers)
- [x] T014 Implement PyPI Version (PEP 440: alpha→aN, canary→devN, beta→bN, rc→rcN)
- [x] T015 Implement PyPI Build (`python -m build`)
- [x] T016 Implement PyPI Publish (`twine upload`) with retry/backoff
- [x] T017 Implement PyPI Verify (check PyPI JSON API for version)
- [x] T018 Unit + integration tests for PyPI adapter

### Implementation Notes
- PEP 440 normalization: `0.2.0a1` not `0.2.0-alpha.1`
- Canary maps to `devN` (sorts before alpha in PEP 440)
- Private detection: `Private :: Do Not Upload` classifier
- Support both hatchling and setuptools backends

### Parallel Opportunities
- All of WP03 can proceed in parallel with WP02 and WP04

### Dependencies
- Depends on WP01 (adapter interface)

### Risks & Mitigations
- Multiple Python build backends (hatchling, setuptools, uv_build) — adapter calls `python -m build` generically

---

## Work Package WP04: crates.io Adapter (Priority: P0)

**Goal**: Implement the crates.io registry adapter with workspace dependency ordering.
**Independent Test**: Adapter detects Cargo.toml (including workspaces), publishes crates in topological order.
**Prompt**: `tasks/WP04-crates-adapter.md`
**Estimated Size**: ~400 lines

### Included Subtasks
- [x] T019 Implement `internal/adapters/crates.go` — Detect (parse Cargo.toml, workspace members, publish field)
- [x] T020 Implement crates.io Version (SemVer pre-release: `-alpha.N`, `-beta.N`, etc.)
- [x] T021 Implement topological dependency sorting for workspace crates
- [x] T022 Implement crates.io Build (`cargo package`) and Publish (`cargo publish`) with rate-limit retry
- [x] T023 Implement crates.io Verify (check crates.io API for version availability)
- [x] T024 Unit + integration tests (including workspace ordering tests)

### Implementation Notes
- Rate limiting: crates.io returns 429 with Retry-After header — parse and honor it
- Workspace detection: parse `[workspace] members = [...]`, resolve paths
- Topological sort: build dependency graph from `[dependencies]` path deps, publish leaves first
- Never `--allow-dirty` — fail if working tree is dirty

### Parallel Opportunities
- All of WP04 can proceed in parallel with WP02 and WP03

### Dependencies
- Depends on WP01 (adapter interface)

### Risks & Mitigations
- crates.io rate limits (experienced firsthand) — retry with exponential backoff + Retry-After header

---

## Work Package WP05: Go Proxy + Pre-Wired Adapters (Priority: P1)

**Goal**: Implement the Go module proxy adapter and stub adapters for Hex.pm, Zig, and Mojo.
**Independent Test**: Go adapter detects go.mod, publishes via git tag. Stub adapters return "not yet supported" gracefully.
**Prompt**: `tasks/WP05-go-proxy-prewired-adapters.md`
**Estimated Size**: ~400 lines

### Included Subtasks
- [x] T025 Implement `internal/adapters/goproxy.go` — Detect (parse go.mod), Version (v-prefix SemVer)
- [x] T026 Implement Go Publish (git tag + push — Go proxy pulls from VCS, no upload needed)
- [x] T027 Implement Go Verify (check proxy.golang.org for module version)
- [x] T028 [P] Implement `internal/adapters/hex.go` — Pre-wired stub (Detect from mix.exs, Version from SemVer, Publish/Verify return "not yet supported")
- [x] T029 [P] Implement `internal/adapters/zig.go` — Pre-wired stub (Detect from build.zig.zon, git-tag-based versioning)
- [x] T030 [P] Implement `internal/adapters/mojo.go` — Pre-wired stub (Detect from mojoproject.toml, returns "no registry available")
- [x] T031 Unit tests for Go adapter + stub adapter behavior

### Implementation Notes
- Go proxy is unique: no "upload" step. Publishing = creating a git tag and pushing. Proxy discovers automatically.
- Stubs implement the full adapter interface but return `ErrNotSupported` for Build/Publish/Verify
- Hex adapter should parse mix.exs minimally (version, package name) even as a stub

### Parallel Opportunities
- T028, T029, T030 are fully parallel (independent stubs)

### Dependencies
- Depends on WP01 (adapter interface)

### Risks & Mitigations
- Go proxy caching delays — Verify should poll with 5-min timeout

---

## Work Package WP06: Gate Evaluation Engine (Priority: P1)

**Goal**: Build the channel promotion gate evaluation system — define criteria per channel, evaluate, generate structured reports.
**Independent Test**: Given a package and target channel, engine evaluates all gate criteria and returns pass/fail report.
**Prompt**: `tasks/WP06-gate-evaluation-engine.md`
**Estimated Size**: ~400 lines

### Included Subtasks
- [x] T032 Define gate criteria data model in `internal/gate/criteria.go` (per-channel requirements)
- [x] T033 Implement gate evaluator in `internal/gate/evaluator.go` (run criteria, collect results)
- [x] T034 Implement risk-based channel skip logic (low-risk can skip intermediates, high-risk must traverse all)
- [x] T035 Implement structured report generation (pass/fail per criterion, stdout/stderr capture, duration)
- [x] T036 Implement gate criteria: lint, unit_tests, integration_tests, security_audit, docs_build, rollback_plan
- [x] T037 Unit tests for evaluator (mock task runner commands, test risk-based skipping)

### Implementation Notes
- Gate criteria execute task runner commands (e.g., `mise run lint`, `mise run test`)
- Channel gates (from governance doc):
  - canary: lint + unit tests + security pass, flags documented
  - beta: user flows validated, default behavior unaffected
  - rc: API contract freeze, migration/rollback runbook attached, docs synced
  - prod: monitoring dashboards configured, rollback RTO met
- Risk profile read from package config or inferred from manifest

### Parallel Opportunities
- T032-T033 (data model + evaluator) sequential; T034-T036 parallel after

### Dependencies
- Depends on WP01 (adapter interface for package detection)

### Risks & Mitigations
- Gate criteria may vary per repo — make criteria configurable via repo-level config file

---

## Work Package WP07: CLI Publish & Promote Commands (Priority: P1)

**Goal**: Wire up `pheno publish` and `pheno promote` commands using adapters and gate engine.
**Independent Test**: `pheno publish` detects packages and publishes to registries. `pheno promote` runs gates then publishes.
**Prompt**: `tasks/WP07-cli-publish-promote.md`
**Estimated Size**: ~400 lines

### Included Subtasks
- [x] T038 Implement `cmd/publish.go` — detect packages, select adapter, build, publish
- [x] T039 Implement `cmd/promote.go` — validate channel transition, run gate evaluation, publish on pass
- [x] T040 Implement workspace publishing orchestration (topological order, verify between publishes)
- [x] T041 Add Lipgloss-styled progress output (publish progress, gate results table)
- [x] T042 Add Viper config loading (registry credentials, default risk profile, org settings)
- [x] T043 Integration tests (mock registries, test full publish and promote flows)

### Implementation Notes
- `pheno publish` is a direct publish (skip gates) — useful for manual intervention
- `pheno promote` is gate-guarded — validates criteria before publishing
- Config: `~/.config/pheno/config.toml` for global settings, `.pheno.toml` per repo
- Credentials: read from env vars first, then config file, then GitHub secrets

### Parallel Opportunities
- T041 (UI output) can proceed in parallel with T038-T040 (logic)

### Dependencies
- Depends on WP01 (scaffold), WP02-WP05 (adapters), WP06 (gate engine)

### Risks & Mitigations
- Credential management complexity — provide clear error messages when creds missing

---

## Work Package WP08: CLI Audit & Matrix Commands (Priority: P2)

**Goal**: Implement `pheno audit` (org-wide release status) and `pheno matrix` (release matrix generation).
**Independent Test**: `pheno audit` scans all repos and shows package/channel/version table. `pheno matrix` generates governance-formatted matrix.
**Prompt**: `tasks/WP08-cli-audit-matrix.md`
**Estimated Size**: ~350 lines

### Included Subtasks
- [x] T044 Implement `cmd/audit.go` — scan configured repos, detect packages, query registries for current versions
- [x] T045 Implement Lipgloss-styled audit table output (package, channel, version, registry URL, blocked-by)
- [x] T046 Implement `cmd/matrix.go` — generate release matrix matching RELEASE_MATRIX_TEMPLATE.md format
- [x] T047 Add repo discovery (scan directory for repos, or read from config file)
- [x] T048 Unit + integration tests for audit and matrix commands

### Implementation Notes
- Repo discovery: by default scan parent directory for repos with supported manifests
- Configurable via `~/.config/pheno/config.toml` → `repos_dir` or explicit repo list
- Audit queries registries in parallel (one goroutine per repo)
- Matrix output: markdown table matching governance template format

### Parallel Opportunities
- T044-T045 (audit) parallel with T046 (matrix)

### Dependencies
- Depends on WP01 (scaffold), WP02-WP05 (adapters for registry queries)

### Risks & Mitigations
- Registry API rate limits during audit — throttle parallel queries

---

## Work Package WP09: CLI Bootstrap Command (Priority: P2)

**Goal**: Implement `pheno bootstrap` — one-command governance onboarding for any repo.
**Independent Test**: Running `pheno bootstrap` on a bare repo creates all governance artifacts (task runner config, hooks, CI workflows, release config).
**Prompt**: `tasks/WP09-cli-bootstrap.md`
**Estimated Size**: ~450 lines

### Included Subtasks
- [x] T049 Implement `cmd/bootstrap.go` — orchestrate artifact generation based on detected languages
- [x] T050 Create Go template files in `internal/templates/` for all generated artifacts
- [x] T051 Implement mise.toml template generation (standardized tasks: lint, test, build, format, release:promote, release:status)
- [x] T052 Implement pre-commit hook template generation (conventional commits, fast lint)
- [x] T053 Implement pre-push hook template generation (channel-aware validation)
- [x] T054 Implement CI workflow wrapper templates (ci.yml, release.yml calling phenotypeActions)
- [x] T055 Implement cliff.toml template generation (git-cliff changelog config)
- [x] T056 Integration test: bootstrap a mock repo and validate all artifacts

### Implementation Notes
- Language detection from WP01's detector → determines which templates to generate
- Templates use Go `text/template` with repo-specific variables (name, language, registry, risk profile)
- Multi-language repos get merged configs (e.g., mise.toml with both Rust and Python tasks)
- Private repos: skip publishing templates but include lint/test/hook infrastructure
- Generated CI workflows reference `KooshaPari/phenotypeActions/.github/workflows/<name>.yml@v1`

### Parallel Opportunities
- T051-T055 are all parallel (independent template files)

### Dependencies
- Depends on WP01 (scaffold, detector), WP10 (centralized CI workflows to reference)

### Risks & Mitigations
- Template drift between bootstrap-generated and centralized workflows — version-pin references

---

## Work Package WP10: Centralized CI Workflows (Priority: P1)

**Goal**: Create reusable GitHub Actions workflows in `phenotypeActions` repo for publishing, gate-checking, and promotion.
**Independent Test**: Reusable workflows can be called from any repo's CI with correct inputs.
**Prompt**: `tasks/WP10-centralized-ci-workflows.md`
**Estimated Size**: ~500 lines

### Included Subtasks
- [x] T057 Create `publish.yml` reusable workflow (registry-specific publish with retry/backoff)
- [x] T058 Create `gate-check.yml` reusable workflow (run channel-specific gate criteria)
- [x] T059 Create `promote.yml` reusable workflow (orchestrate gate-check → publish)
- [x] T060 Create `changelog.yml` reusable workflow (git-cliff changelog generation on release)
- [x] T061 Create `audit.yml` scheduled workflow (org-wide release status report)
- [x] T062 Add workflow inputs/outputs schema (language, registry, channel, risk_profile, credentials)
- [x] T063 Test workflows with `act` or dry-run mode

### Implementation Notes
- All workflows use `workflow_call` trigger for reusability
- Inputs: language (rust|python|typescript|go), registry, channel, risk_profile, version
- Secrets: `NPM_TOKEN`, `PYPI_TOKEN`, `CRATES_TOKEN` from org-level secrets
- publish.yml: retry on 429 with exponential backoff (parse Retry-After header)
- gate-check.yml: run `mise run lint`, `mise run test`, etc. — fail if any gate fails
- promote.yml: composite — calls gate-check, then publish on success

### Parallel Opportunities
- T057-T061 are all parallel (independent workflow files)

### Dependencies
- None (can proceed independently; WP09 references these)

### Risks & Mitigations
- GitHub Actions reusable workflow limitations (max 4 levels of nesting) — keep flat

---

## Work Package WP11: Task Runner Evaluation & Standardization (Priority: P1)

**Goal**: Finalize task runner choice (mise recommended), create standardized task definitions for all 4 active languages.
**Independent Test**: Standard tasks (lint, test, build, format) work correctly for Rust, Python, TypeScript, and Go repos.
**Prompt**: `tasks/WP11-task-runner-standardization.md`
**Estimated Size**: ~400 lines

### Included Subtasks
- [x] T064 Final evaluation: validate mise monorepo tasks feature stability (or select alternative)
- [x] T065 Create reference mise.toml for Rust projects (cargo clippy, cargo test, cargo build, rustfmt)
- [x] T066 [P] Create reference mise.toml for Python projects (ruff check, pytest, build, ruff format)
- [x] T067 [P] Create reference mise.toml for TypeScript projects (eslint, vitest/jest, tsc, prettier)
- [x] T068 [P] Create reference mise.toml for Go projects (golangci-lint, go test, go build, gofmt)
- [x] T069 Create reference mise.toml with release:promote and release:status tasks (calls pheno CLI)
- [x] T070 Validate all reference configs on sample repos from the org

### Implementation Notes
- If mise monorepo tasks not stable by implementation time, fall back to moon or per-repo mise.toml
- Each reference config includes: lint, test, build, format, release:promote, release:status
- release:promote calls `pheno promote <channel>`; release:status calls `pheno audit --repo .`
- Tool version pinning in each mise.toml (rust, python, node, go versions)

### Parallel Opportunities
- T065-T068 are fully parallel (per-language configs)

### Dependencies
- Depends on WP07 (pheno CLI publish/promote for release tasks)

### Risks & Mitigations
- mise experimental features may be unstable — have moon fallback plan documented

---

## Work Package WP12: Pre-Commit & Pre-Push Hooks (Priority: P2)

**Goal**: Create standardized git hook infrastructure — conventional commit enforcement, fast lint, channel-aware pre-push validation.
**Independent Test**: Non-conventional commit messages are rejected in <5s. Pre-push runs channel-appropriate checks.
**Prompt**: `tasks/WP12-pre-commit-pre-push-hooks.md`
**Estimated Size**: ~350 lines

### Included Subtasks
- [x] T071 Create pre-commit hook script (conventional commit message validation)
- [x] T072 Add fast lint check to pre-commit (format check, encoding validation — <5s target)
- [x] T073 Create pre-push hook script with channel-aware logic (feature/* → fast, beta/* → full suite)
- [x] T074 Create `.pre-commit-config.yaml` template (for repos using pre-commit framework)
- [x] T075 Create standalone hook installer script (for repos not using pre-commit framework)
- [x] T076 Test hooks: conventional commit rejection, timing validation, channel branching logic

### Implementation Notes
- Pre-commit: validate `^(feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert)(\(.+\))?!?: .+`
- Fast lint: call `mise run format -- --check` (should complete in <5s for most repos)
- Pre-push channel detection: parse branch name (`feature/*` → fast, `beta/*` → full, `rc/*` → full + rollback check)
- Support both pre-commit framework (`.pre-commit-config.yaml`) and standalone scripts
- Hooks are shell scripts (POSIX sh for portability)

### Parallel Opportunities
- T071-T072 (pre-commit) parallel with T073 (pre-push)

### Dependencies
- Depends on WP11 (task runner for lint/test commands)

### Risks & Mitigations
- Pre-commit hook performance — keep under 5s; defer expensive checks to pre-push

---

## Work Package WP13: Pilot Rollout — AgilePlus + 3 Repos (Priority: P2)

**Goal**: Run `pheno bootstrap` on AgilePlus and 3 diverse repos (1 Rust, 1 Python, 1 Go) to validate end-to-end workflow.
**Independent Test**: All 4 repos have governance artifacts, hooks work, CI workflows trigger, a test publish succeeds.
**Prompt**: `tasks/WP13-pilot-rollout.md`
**Estimated Size**: ~350 lines

### Included Subtasks
- [x] T077 Bootstrap AgilePlus (TypeScript/VitePress) — validate mise.toml, hooks, CI workflows
- [x] T078 [P] Bootstrap tokenledger (Rust) — validate Rust-specific artifacts, crates.io publish test
- [x] T079 [P] Bootstrap thegent (Python) — validate Python-specific artifacts, PyPI publish test
- [x] T080 [P] Bootstrap agentapi-plusplus (Go) — validate Go-specific artifacts, Go proxy publish test
- [x] T081 Run `pheno audit` across all 4 repos — validate org-wide view
- [x] T082 Document findings and adjust templates based on pilot feedback

### Implementation Notes
- AgilePlus: private (no publish), only hooks + lint/test infrastructure
- tokenledger: already published to crates.io — test pre-release publish
- thegent: already published to PyPI — test pre-release publish
- agentapi-plusplus: Go module — test git tag-based publishing

### Parallel Opportunities
- T077-T080 are fully parallel (independent repos)

### Dependencies
- Depends on WP09 (bootstrap), WP10 (CI workflows), WP11 (task runner), WP12 (hooks)

### Risks & Mitigations
- Repos may have conflicting existing configs — bootstrap should detect and warn, not overwrite without confirmation

---

## Work Package WP14: Org-Wide Rollout Automation (Priority: P3)

**Goal**: Script the remaining ~43 repo rollout and create the bulk bootstrap tooling.
**Independent Test**: Bulk bootstrap script processes all remaining repos, generating appropriate artifacts per language.
**Prompt**: `tasks/WP14-org-wide-rollout.md`
**Estimated Size**: ~300 lines

### Included Subtasks
- [x] T083 Create bulk bootstrap script (`pheno bootstrap --all` or directory-scanning mode)
- [x] T084 Generate repo manifest (CSV/TOML listing all repos, languages, risk profiles, publish targets)
- [x] T085 Run bulk bootstrap on remaining repos (with dry-run first)
- [x] T086 Create PRs for each bootstrapped repo (automated via `gh pr create`)
- [x] T087 Validate org-wide `pheno audit` after rollout

### Implementation Notes
- `pheno bootstrap --all --repos-dir ~/CodeProjects/Phenotype/repos/` scans all subdirs
- Dry-run mode: `--dry-run` shows what would be generated without writing files
- PR creation: one PR per repo, titled "chore: add release governance infrastructure"
- Risk profiles: default to `low` unless repo manifest overrides

### Parallel Opportunities
- T085-T086 can be batched (bootstrap + PR creation per repo)

### Dependencies
- Depends on WP13 (pilot validation)

### Risks & Mitigations
- Bulk operations may hit GitHub API rate limits for PR creation — batch with delays

---

## Work Package WP15: Documentation & Polish (Priority: P3)

**Goal**: Write user-facing documentation for the pheno CLI, governance model, and contributor onboarding.
**Independent Test**: A new contributor can read the docs and successfully bootstrap a repo, run standard tasks, and publish a pre-release.
**Prompt**: `tasks/WP15-documentation-polish.md`
**Estimated Size**: ~300 lines

### Included Subtasks
- [x] T088 Write pheno CLI README.md (installation, commands, configuration)
- [x] T089 Write governance model overview (evolving the 5-tier model, risk profiles, gate criteria)
- [x] T090 Write contributor quickstart (bootstrap → develop → promote → publish)
- [x] T091 Create ADR: task runner selection rationale
- [x] T092 Create ADR: registry adapter architecture rationale
- [x] T093 Final cleanup: ensure all error messages are clear, help text is complete

### Implementation Notes
- README goes in pheno-cli repo root
- Governance overview and contributor quickstart can go in AgilePlus docs or pheno-cli docs
- ADRs go in pheno-cli `docs/adr/` per constitution requirements

### Parallel Opportunities
- T088-T092 are all parallel (independent docs)

### Dependencies
- Depends on WP07 (CLI finalized), WP11 (task runner chosen), WP13 (pilot feedback)

### Risks & Mitigations
- Docs get stale quickly — link to CLI help text rather than duplicating

---

## Dependency & Execution Summary

```
Phase 0 (Foundation):
  WP01 (CLI scaffold + adapter interface) ←── no deps
  WP10 (Centralized CI workflows) ←── no deps

Phase 1 (Adapters — all parallel after WP01):
  WP02 (npm adapter) ←── WP01
  WP03 (PyPI adapter) ←── WP01
  WP04 (crates.io adapter) ←── WP01
  WP05 (Go proxy + stubs) ←── WP01
  WP06 (Gate engine) ←── WP01

Phase 2 (CLI Commands):
  WP07 (publish + promote) ←── WP01, WP02-WP05, WP06
  WP08 (audit + matrix) ←── WP01, WP02-WP05

Phase 3 (DX Tooling):
  WP11 (Task runner) ←── WP07
  WP12 (Hooks) ←── WP11

Phase 4 (Bootstrap + Rollout):
  WP09 (Bootstrap command) ←── WP01, WP10
  WP13 (Pilot rollout) ←── WP09, WP10, WP11, WP12
  WP14 (Org-wide rollout) ←── WP13

Phase 5 (Polish):
  WP15 (Documentation) ←── WP07, WP11, WP13
```

**Parallelization highlights**:
- WP01 + WP10 can run simultaneously (Phase 0)
- WP02, WP03, WP04, WP05, WP06 can ALL run simultaneously (Phase 1)
- WP08 can start as soon as adapters are done (doesn't need gate engine)
- WP09 can start once WP01 + WP10 are done (doesn't need adapters yet — uses templates)

**MVP Scope**: WP01 → WP02-WP04 → WP07 → WP10 (CLI can publish to 3 main registries with CI workflows)

---

## Subtask Index

| ID | Summary | WP | Priority | Parallel |
|----|---------|-----|----------|----------|
| T001 | Init Go module with deps | WP01 | P0 | No |
| T002 | Cobra root + subcommand stubs | WP01 | P0 | No |
| T003 | RegistryAdapter interface | WP01 | P0 | No |
| T004 | Version calculator | WP01 | P0 | No |
| T005 | Language/manifest detector | WP01 | P0 | Yes |
| T006 | Version calculator tests | WP01 | P0 | No |
| T007 | npm Detect | WP02 | P0 | No |
| T008 | npm Version | WP02 | P0 | No |
| T009 | npm Build | WP02 | P0 | No |
| T010 | npm Publish + retry | WP02 | P0 | No |
| T011 | npm Verify | WP02 | P0 | No |
| T012 | npm tests | WP02 | P0 | No |
| T013 | PyPI Detect | WP03 | P0 | No |
| T014 | PyPI Version (PEP 440) | WP03 | P0 | No |
| T015 | PyPI Build | WP03 | P0 | No |
| T016 | PyPI Publish + retry | WP03 | P0 | No |
| T017 | PyPI Verify | WP03 | P0 | No |
| T018 | PyPI tests | WP03 | P0 | No |
| T019 | crates.io Detect (workspaces) | WP04 | P0 | No |
| T020 | crates.io Version | WP04 | P0 | No |
| T021 | Topological dependency sort | WP04 | P0 | No |
| T022 | crates.io Build + Publish | WP04 | P0 | No |
| T023 | crates.io Verify | WP04 | P0 | No |
| T024 | crates.io tests | WP04 | P0 | No |
| T025 | Go proxy Detect + Version | WP05 | P1 | No |
| T026 | Go Publish (git tag) | WP05 | P1 | No |
| T027 | Go Verify | WP05 | P1 | No |
| T028 | Hex.pm stub | WP05 | P1 | Yes |
| T029 | Zig stub | WP05 | P1 | Yes |
| T030 | Mojo stub | WP05 | P1 | Yes |
| T031 | Go + stub tests | WP05 | P1 | No |
| T032 | Gate criteria data model | WP06 | P1 | No |
| T033 | Gate evaluator | WP06 | P1 | No |
| T034 | Risk-based skip logic | WP06 | P1 | No |
| T035 | Structured report gen | WP06 | P1 | No |
| T036 | Gate criteria impls | WP06 | P1 | No |
| T037 | Gate evaluator tests | WP06 | P1 | No |
| T038 | pheno publish command | WP07 | P1 | No |
| T039 | pheno promote command | WP07 | P1 | No |
| T040 | Workspace publish orchestration | WP07 | P1 | No |
| T041 | Lipgloss progress output | WP07 | P1 | Yes |
| T042 | Viper config loading | WP07 | P1 | Yes |
| T043 | publish/promote integration tests | WP07 | P1 | No |
| T044 | pheno audit command | WP08 | P2 | No |
| T045 | Audit table output | WP08 | P2 | No |
| T046 | pheno matrix command | WP08 | P2 | Yes |
| T047 | Repo discovery | WP08 | P2 | No |
| T048 | audit/matrix tests | WP08 | P2 | No |
| T049 | pheno bootstrap command | WP09 | P2 | No |
| T050 | Go template files | WP09 | P2 | No |
| T051 | mise.toml template | WP09 | P2 | Yes |
| T052 | pre-commit template | WP09 | P2 | Yes |
| T053 | pre-push template | WP09 | P2 | Yes |
| T054 | CI workflow templates | WP09 | P2 | Yes |
| T055 | cliff.toml template | WP09 | P2 | Yes |
| T056 | Bootstrap integration test | WP09 | P2 | No |
| T057 | publish.yml reusable workflow | WP10 | P1 | Yes |
| T058 | gate-check.yml workflow | WP10 | P1 | Yes |
| T059 | promote.yml workflow | WP10 | P1 | Yes |
| T060 | changelog.yml workflow | WP10 | P1 | Yes |
| T061 | audit.yml scheduled workflow | WP10 | P1 | Yes |
| T062 | Workflow inputs/outputs schema | WP10 | P1 | No |
| T063 | Workflow testing | WP10 | P1 | No |
| T064 | Task runner final eval | WP11 | P1 | No |
| T065 | Rust reference mise.toml | WP11 | P1 | No |
| T066 | Python reference mise.toml | WP11 | P1 | Yes |
| T067 | TypeScript reference mise.toml | WP11 | P1 | Yes |
| T068 | Go reference mise.toml | WP11 | P1 | Yes |
| T069 | Release tasks mise.toml | WP11 | P1 | No |
| T070 | Validate on sample repos | WP11 | P1 | No |
| T071 | Pre-commit hook (conventional commits) | WP12 | P2 | No |
| T072 | Pre-commit fast lint | WP12 | P2 | No |
| T073 | Pre-push channel-aware hooks | WP12 | P2 | Yes |
| T074 | .pre-commit-config.yaml template | WP12 | P2 | Yes |
| T075 | Standalone hook installer | WP12 | P2 | Yes |
| T076 | Hook tests | WP12 | P2 | No |
| T077 | Bootstrap AgilePlus | WP13 | P2 | No |
| T078 | Bootstrap tokenledger | WP13 | P2 | Yes |
| T079 | Bootstrap thegent | WP13 | P2 | Yes |
| T080 | Bootstrap agentapi-plusplus | WP13 | P2 | Yes |
| T081 | Org-wide audit validation | WP13 | P2 | No |
| T082 | Pilot findings doc | WP13 | P2 | No |
| T083 | Bulk bootstrap script | WP14 | P3 | No |
| T084 | Repo manifest | WP14 | P3 | No |
| T085 | Bulk bootstrap execution | WP14 | P3 | No |
| T086 | Automated PR creation | WP14 | P3 | No |
| T087 | Org-wide audit post-rollout | WP14 | P3 | No |
| T088 | pheno CLI README | WP15 | P3 | Yes |
| T089 | Governance model docs | WP15 | P3 | Yes |
| T090 | Contributor quickstart | WP15 | P3 | Yes |
| T091 | ADR: task runner selection | WP15 | P3 | Yes |
| T092 | ADR: adapter architecture | WP15 | P3 | Yes |
| T093 | Error message cleanup | WP15 | P3 | No |
