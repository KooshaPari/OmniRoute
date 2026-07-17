---
work_package_id: WP11
title: Task Runner Evaluation & Standardization
lane: "done"
dependencies: [WP07]
base_branch: 002-org-wide-release-governance-dx-automation-WP07
base_commit: 2a2ac0a71d85db9a3a99626b777b233f03b7e1d5
created_at: '2026-03-01T21:41:06.727427+00:00'
subtasks: [T064, T065, T066, T067, T068, T069, T070]
phase: Phase 3 - DX Tooling
assignee: ''
agent: "wp11-impl"
shell_pid: "47185"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP11 – Task Runner Evaluation & Standardization

## Objectives & Success Criteria

**Primary Goal:** Standardize on mise for task execution across all Phenotype repos and validate language-specific reference configurations.

**Success Criteria:**
- Mise v2026.x stability confirmed across 4 language ecosystems (Rust, Python, TypeScript, Go)
- Decision documented in ADR with fallback strategy if experimental features unstable
- 4 reference `mise.toml` files validated on production repos
- All core tasks (lint, test, build, format, audit, release) working on all ecosystems
- Release promotion and status tasks unified across languages

## Context & Constraints

**Context:**
- WP07 established pheno CLI infrastructure; WP11 feeds task definitions into it
- 47 repos across 4 primary languages; current state: mix of Taskfile, npm scripts, make, and ad-hoc tooling
- Mise selected as standardized task runner; experimental monorepo features provide centralized task inheritance
- Current state: mise 2025.x deployed on some repos; v2026.x released with stability improvements

**Constraints:**
- Backward compatibility: repos currently using Taskfile.yml must migrate gracefully (pheno bootstrap handles this)
- Monorepo task inheritance must stabilize; fallback to per-repo configuration if experimental flag still required
- Reference configs must be minimal yet complete for all supported language toolchains
- Release tasks (promote/status) must integrate with pheno CLI (WP07 prerequisite)

## Subtasks & Detailed Guidance

### Subtask T064 – Final Evaluation of Mise Stability & Fallback Strategy (50 lines)

**Purpose:** Determine if mise v2026.x monorepo task inheritance has stabilized. If still experimental, document fallback to per-repo mise.toml without inheritance.

**Steps:**
1. Check mise v2026.x release notes for monorepo task deprecations or breaking changes
2. Test mise v2026.x on a sample Rust + Python polyglot repo:
   - Create temp workspace with `[dirs]` configuration
   - Define root-level task groups (lint, test, build, release)
   - Attempt to inherit these in child Rust and Python `mise.toml` files
   - Run each task from both root and subdirectory; verify paths are correct
3. Measure overhead of monorepo inheritance (cold start, warm task execution)
4. Check if experimental flag still required; if yes, evaluate:
   - moon (Rust-centric, tight monorepo support)
   - per-repo mise.toml with manual task synchronization
5. If stable: document in ADR as recommended approach
6. If unstable: add migration guidance to bootstrap templates and pheno CLI error messages

**Files:**
- Create or update: `docs/adr/001-task-runner-selection.md`
- Reference: mise v2026.x documentation and release notes

**Parallel?** No (blocks T065–T070).

**Notes:**
- Stability is the gate; if 2026.x is production-ready, no fallback needed
- Document any environment-specific issues (macOS vs Linux vs Windows)

---

### Subtask T065 – Rust Reference Mise Configuration (65 lines)

**Purpose:** Create validated `mise.toml` template for Rust repos with standard task definitions and environment configuration.

**Steps:**
1. Create base template at `templates/rust/mise.toml`:
   ```toml
   [env]
   RUSTFLAGS = "-D warnings -W clippy::all"
   RUST_BACKTRACE = "1"

   [tools]
   rust = "nightly"

   [tasks]
   lint = "cargo clippy -- -D warnings"
   test = "cargo test"
   test:integration = "cargo test --features integration"
   build = "cargo build --release"
   format = "cargo fmt"
   audit = "cargo audit"
   release:promote = "pheno promote"
   release:status = "pheno audit --repo ."
   ```
2. Add detailed comments for each section:
   - `[env]`: explain RUSTFLAGS for strict linting, RUST_BACKTRACE for debugging
   - `[tools]`: nightly default; document pinning specific version if needed
   - Task naming: explain `<action>:<qualifier>` convention
3. Include conditional logic for optional features:
   - If workspace detected: add `[tasks.workspace:sync]` to validate all crate versions
4. Test on an actual Rust repo (tokenledger planned for T078)
5. Document migration path: "If you have Taskfile.yml, replace with this template and remove Taskfile.yml"

**Files:**
- Create: `templates/rust/mise.toml`
- Create: `templates/rust/MIGRATION.md` (if Taskfile.yml exists)

**Parallel?** Yes, with T066–T068 after T064 complete.

**Notes:**
- nightly may require weekly updates; consider pinning to stable if preferred
- Document cargo features and how to extend task:subtask nesting

---

### Subtask T066 – Python Reference Mise Configuration (60 lines)

**Purpose:** Create validated `mise.toml` template for Python repos with standard task definitions.

**Steps:**
1. Create base template at `templates/python/mise.toml`:
   ```toml
   [env]
   PYTHONUNBUFFERED = "1"

   [tools]
   python = "3.14"

   [tasks]
   lint = "ruff check ."
   test = "pytest"
   test:integration = "pytest -m integration"
   build = "python -m build"
   format = "ruff format ."
   audit = "pip-audit"
   release:promote = "pheno promote"
   release:status = "pheno audit --repo ."
   ```
2. Add environment setup guidance:
   - Virtual environment creation (if needed; modern Python tools often handle this)
   - Ruff vs Black decision (use ruff as unified linter + formatter)
   - Pytest marker configuration (integration marker defined in `pyproject.toml`)
3. Include pyproject.toml snippet for pytest configuration
4. Document dependency management: pip vs uv vs poetry (pheno bootstrap will handle defaults)
5. Test on actual Python repo (thegent planned for T079)

**Files:**
- Create: `templates/python/mise.toml`
- Create: `templates/python/pyproject.toml` (snippet for pytest config)

**Parallel?** Yes, with T065, T067–T068 after T064 complete.

**Notes:**
- Python 3.14 is forward-looking; adjust to 3.13 if 3.14 not yet stable at implementation time
- Document common pip-audit issues (license scanning vs vulnerability scanning)

---

### Subtask T067 – TypeScript Reference Mise Configuration (60 lines)

**Purpose:** Create validated `mise.toml` template for TypeScript/Node repos.

**Steps:**
1. Create base template at `templates/typescript/mise.toml`:
   ```toml
   [env]
   NODE_ENV = "development"

   [tools]
   node = "22"

   [tasks]
   lint = "eslint ."
   test = "vitest run"
   build = "tsc"
   format = "prettier --write ."
   audit = "npm audit"
   release:promote = "pheno promote"
   release:status = "pheno audit --repo ."
   ```
2. Include package.json snippet:
   - devDependencies: eslint, vitest, typescript, prettier
   - scripts section (optional; prefer mise tasks)
3. Document ESLint configuration (eslint.config.js or .eslintrc.json)
4. Vitest vs Jest decision (vitest recommended for monorepos and faster iteration)
5. Test on actual TypeScript repo (AgilePlus planned for T077)

**Files:**
- Create: `templates/typescript/mise.toml`
- Create: `templates/typescript/eslint.config.js` (starter config)
- Create: `templates/typescript/vitest.config.ts` (starter config)

**Parallel?** Yes, with T065–T066, T068 after T064 complete.

**Notes:**
- Node 22 aligns with LTS; verify it's stable at implementation time
- Document npm audit limitations (optional dependencies, false positives)

---

### Subtask T068 – Go Reference Mise Configuration (60 lines)

**Purpose:** Create validated `mise.toml` template for Go repos.

**Steps:**
1. Create base template at `templates/go/mise.toml`:
   ```toml
   [env]
   CGO_ENABLED = "1"

   [tools]
   go = "1.23"

   [tasks]
   lint = "golangci-lint run"
   test = "go test ./..."
   build = "go build ./..."
   format = "gofmt -w ."
   audit = "govulncheck ./..."
   release:promote = "pheno promote"
   release:status = "pheno audit --repo ."
   ```
2. Include `.golangci.yml` starter configuration with linter rules
3. Document govulncheck integration (replaces deprecated go.vulnerabilities)
4. Document CGO requirement (if cgo-free builds preferred, comment out)
5. Test on actual Go repo (agentapi-plusplus planned for T080)

**Files:**
- Create: `templates/go/mise.toml`
- Create: `templates/go/.golangci.yml` (starter config)

**Parallel?** Yes, with T065–T067 after T064 complete.

**Notes:**
- Go 1.23 stable; adjust if newer LTS available at implementation time
- govulncheck is relatively new; ensure team is familiar or add docs/tutorial

---

### Subtask T069 – Unified Release Tasks (45 lines)

**Purpose:** Define `release:promote` and `release:status` tasks that work identically across all languages via pheno CLI.

**Steps:**
1. Define release:promote task:
   - Signature: `pheno promote <channel>` (where channel: alpha|beta|rc|stable)
   - Implemented by WP07 pheno CLI; task runner simply invokes it
   - Add to all 4 reference configs (T065–T068)
2. Define release:status task:
   - Signature: `pheno audit --repo .`
   - Shows current version, channel, next promotable versions
   - Implemented by WP07; task runner simply invokes it
   - Add to all 4 reference configs
3. Document in `docs/governance/release-channels.md`:
   - What each channel means
   - Promotion flow: dev → alpha → beta → rc → stable
   - When each channel publishes (CI/CD gates defined in WP09/WP10)
4. Add examples to release task documentation:
   - `mise run release:promote -- alpha` (sample output)
   - `mise run release:status` (sample output)

**Files:**
- Add to all templates: T065–T068 mise.toml files
- Create or update: `docs/governance/release-channels.md`

**Parallel?** No (depends on T065–T068 completion).

**Notes:**
- Pheno CLI must be installed for these tasks to work; pheno bootstrap ensures this
- Document in error message what to do if pheno is not found

---

### Subtask T070 – Validation on Production Repos (70 lines)

**Purpose:** Deploy all 4 reference configs on actual Phenotype repos and verify all tasks execute successfully.

**Steps:**
1. **Rust (tokenledger):**
   - Copy template from T065 to `tokenledger/mise.toml`
   - Run: `mise run lint` (should pass or show fixable clippy warnings)
   - Run: `mise run test` (should pass all tests)
   - Run: `mise run build` (should produce release binary)
   - Run: `mise run format --check` (should pass or show needed formatting)
   - Document any adjustments (e.g., platform-specific build flags)

2. **Python (thegent):**
   - Copy template from T066 to `thegent/mise.toml`
   - Ensure `pyproject.toml` includes pytest markers
   - Run: `mise run lint` (should pass or show fixable ruff issues)
   - Run: `mise run test` (should pass all tests)
   - Run: `mise run build` (should produce wheel)
   - Document any adjustments (e.g., Python version, test markers)

3. **TypeScript (AgilePlus):**
   - Copy template from T067 to `AgilePlus/mise.toml`
   - Run: `mise run lint` (should pass or show fixable eslint issues)
   - Run: `mise run test` (should pass all vitest suites)
   - Run: `mise run build` (should produce dist/)
   - Document any adjustments (e.g., build output paths, test configuration)

4. **Go (agentapi-plusplus):**
   - Copy template from T068 to `agentapi-plusplus/mise.toml`
   - Run: `mise run lint` (should pass golangci-lint checks)
   - Run: `mise run test` (should pass all tests)
   - Run: `mise run build` (should produce binary)
   - Document any adjustments (e.g., build flags, cgo settings)

5. **Cross-repo validation:**
   - All 4 repos should support: `mise run lint`, `mise run test`, `mise run build`, `mise run format`, `mise run audit`
   - All 4 repos should support: `mise run release:promote` and `mise run release:status` (if pheno CLI available)

6. **Document findings:**
   - Create `docs/task-runner-reference.md` summarizing results
   - List any language-specific quirks or workarounds
   - Flag any templates needing adjustment

**Files:**
- Update: T065–T068 templates based on real-world testing
- Create: `docs/task-runner-reference.md` (results summary)
- Update: Each of 4 repos with mise.toml

**Parallel?** No (depends on T065–T069 completion).

**Notes:**
- This is the critical validation step; issues found here drive template fixes
- Measure task execution times; if any task exceeds 30s, document why and optimizations

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Mise monorepo features still experimental in 2026.x | T064 fallback to per-repo config; document in bootstrap templates |
| Language-specific toolchain quirks not caught in templates | T070 validation on all 4 production repos; adjust templates based on findings |
| Reference configs out of sync after deployment | Establish ownership in AGENTS file; quarterly review cycle |
| Pre-existing Taskfile.yml/npm scripts conflict with mise | Pheno bootstrap removes old configs; document migration in templates |
| Performance regression in task execution times | T070 measures baseline; alert if any task exceeds 30s |

## Review Guidance

**Reviewers should verify:**
- [ ] Mise v2026.x stability assessment complete (T064)
- [ ] All 4 language reference configs exist and match expected structure (T065–T068)
- [ ] Release tasks (promote/status) included in all configs (T069)
- [ ] All 4 production repos tested successfully (T070)
- [ ] No performance regressions in task execution
- [ ] Migration documentation exists for repos using Taskfile.yml or npm scripts

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created.
- 2026-03-01T21:41:07Z – wp11-impl – shell_pid=47185 – lane=doing – Assigned agent via workflow command
- 2026-03-01T21:43:41Z – wp11-impl – shell_pid=47185 – lane=for_review – Ready: task runner standardization
- 2026-03-01T21:44:57Z – wp11-impl – shell_pid=47185 – lane=done – Complete
