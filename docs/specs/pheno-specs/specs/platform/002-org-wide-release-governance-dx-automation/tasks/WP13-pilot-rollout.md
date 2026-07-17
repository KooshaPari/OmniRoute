---
work_package_id: WP13
title: Pilot Rollout — AgilePlus + 3 Repos
lane: "done"
dependencies:
- WP09
base_branch: 002-org-wide-release-governance-dx-automation-WP09
base_commit: d170e668ad5628848113077d5c00b2759fe44eed
created_at: '2026-03-01T21:41:17.524321+00:00'
subtasks: [T077, T078, T079, T080, T081, T082]
phase: Phase 4 - Bootstrap + Rollout
assignee: ''
agent: "wp13-impl"
shell_pid: "47504"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP13 – Pilot Rollout — AgilePlus + 3 Repos

## Objectives & Success Criteria

**Primary Goal:** Deploy pheno bootstrap and governance infrastructure on 4 strategically selected repos (AgilePlus, tokenledger, thegent, agentapi-plusplus), validate all components work end-to-end, and document findings for org-wide rollout.

**Success Criteria:**
- All 4 repos successfully bootstrapped with mise.toml, hooks, and CI workflows
- AgilePlus (TypeScript, private) verified with private artifact handling
- tokenledger (Rust) successfully promoted to alpha on crates.io
- thegent (Python) successfully promoted to alpha on PyPI
- agentapi-plusplus (Go) successful promoted to alpha via git tags
- `pheno audit` works across all 4 repos with accurate package detection
- All findings documented; templates adjusted if needed based on real-world feedback
- No critical issues blocking org-wide rollout

## Context & Constraints

**Context:**
- WP09/WP10 established CI/CD infrastructure and pheno CLI commands
- WP11 created language-specific task runner configs
- WP12 implemented git hooks for quality gates
- Pilot repos are strategically chosen: 1 private (AgilePlus), 3 public with different registries (crates.io, PyPI, go proxy)
- Pilot results will inform process improvements before rolling out to all 47 repos

**Constraints:**
- Publishing to registries must work end-to-end (alpha channel for pre-release testing)
- AgilePlus publishing artifacts must be suppressed (private project, no registry publish)
- All repos must follow WP11 mise.toml structure; no deviations
- Pheno CLI must be pre-installed or bootstrapped as part of process
- Pre-release versions must follow each registry's conventions:
  - Rust crates.io: `0.1.0-alpha.1` (semver with prerelease)
  - Python PyPI: `0.2.0a1` (PEP 440 format)
  - Go go proxy: `v1.0.0-alpha.1` via git tag and push
- No merges to canonical repos during pilot; use worktrees if testing is needed

## Subtasks & Detailed Guidance

### Subtask T077 – Bootstrap AgilePlus (TypeScript, VitePress) (65 lines)

**Purpose:** Deploy pheno bootstrap on AgilePlus (TypeScript/VitePress project), verify mise.toml creation, hook installation, and CI workflows; validate private artifact handling.

**Steps:**
1. **Prepare AgilePlus:**
   - Ensure repo is on canonical `main` branch (from governance rules, work in worktree if modifying)
   - Verify current state: does `mise.toml` exist? If yes, backup to `mise.toml.backup`
   - Check current CI/CD: GitHub Actions workflows in `.github/workflows/`

2. **Run pheno bootstrap:**
   - Command: `pheno bootstrap --language typescript --private`
   - Expected outputs:
     - `mise.toml` created in repo root with TS config (from T067)
     - CI workflows generated in `.github/workflows/` (from WP09)
     - Git hooks installed (from T075) or .pre-commit-config.yaml created (from T074)
     - `.phenorc.toml` created with project metadata (private: true, registry: none)

3. **Verify generated files:**
   - Check `mise.toml`:
     - `[tools] node = "22"`
     - Tasks: lint, test, build, format, audit
     - Verify lint: `eslint .`, test: `vitest run`, build: `tsc` (or equivalent)
   - Check `.phenorc.toml`:
     - Verify `private = true` (no registry publish)
     - Verify `language = "typescript"`
   - Check `.github/workflows/`:
     - `ci.yml` runs lint, test, build on PR
     - `release.yml` omits publish step (private project)
     - Verify no crates.io, PyPI, or npm publish steps

4. **Run local validation:**
   - `mise run lint` → should pass (no errors, warnings OK)
   - `mise run test` → should pass (all vitest suites)
   - `mise run build` → should produce `dist/` (or `.vitepress/dist/`)
   - `mise run format --check` → should pass
   - `mise run audit` → should pass or show known issues

5. **Verify hooks:**
   - Test commit message validation: attempt invalid commit → should fail
   - Attempt valid conventional commit → should pass
   - Test pre-push on feature branch: `git push origin feature/test` → should run lint

6. **Document findings:**
   - Record any issues or adjustments needed
   - Note timing of tasks (especially `mise run build`)
   - Verify private artifact handling is correct (no publish in CI)

**Files:**
- Generated: `AgilePlus/mise.toml`
- Generated: `AgilePlus/.phenorc.toml`
- Generated: `AgilePlus/.github/workflows/*`
- Updated: `AgilePlus/.git/hooks/*` or `.pre-commit-config.yaml`

**Parallel?** No (blocks T081–T082).

**Notes:**
- AgilePlus is a key pilot because it's private; validates that publishing is correctly suppressed
- VitePress is a relatively simple project; good baseline for TS validation
- Record build output paths; may differ from standard `dist/` if VitePress uses custom config

---

### Subtask T078 – Bootstrap tokenledger (Rust) (70 lines)

**Purpose:** Deploy pheno bootstrap on tokenledger (Rust), verify mise.toml, test pre-release publishing to crates.io (alpha channel), validate topological sort for workspace dependencies.

**Steps:**
1. **Prepare tokenledger:**
   - Ensure repo is on canonical `main` branch
   - Check if workspace (multiple crates) or single crate: `cat Cargo.toml | grep -A 10 "^\[workspace\]"`
   - Current publishing setup: check `Cargo.toml` for name, version, registry config

2. **Run pheno bootstrap:**
   - Command: `pheno bootstrap --language rust`
   - Expected outputs:
     - `mise.toml` created with Rust config (from T065)
     - `.phenorc.toml` with `registry = "crates.io"`, `language = "rust"`
     - CI workflows generated (from WP09)
     - Git hooks installed (from T075)

3. **Verify generated files:**
   - Check `mise.toml`:
     - `[tools] rust = "nightly"`
     - Tasks: lint→`cargo clippy`, test→`cargo test`, build→`cargo build --release`, format→`cargo fmt`, audit→`cargo audit`
     - Verify `[env] RUSTFLAGS = "-D warnings"`
   - Check `Cargo.toml`:
     - Verify version is SemVer (e.g., `0.1.0`)
     - Verify package name is correct for crates.io

4. **Run local validation:**
   - `mise run lint` → should pass (no warnings)
   - `mise run test` → should pass
   - `mise run build` → should produce release binary
   - `mise run format --check` → should pass
   - `mise run audit` → should pass or document known issues

5. **Test pre-release publishing (alpha):**
   - Command: `pheno promote alpha`
   - Pheno should:
     - Update `Cargo.toml` version to `0.1.0-alpha.1`
     - Create git commit with message: `chore: promote to alpha`
     - Create git tag: `v0.1.0-alpha.1`
     - Dry-run publish to crates.io (or actual publish if configured)
   - Verify on crates.io: search tokenledger, confirm `0.1.0-alpha.1` appears with alpha badge
   - If dry-run: document what would be published

6. **Validate topological sort (if workspace):**
   - If tokenledger has multiple crates: verify pheno detects dependency order
   - Command: `pheno audit --repo .` should show all crates with correct versions
   - If single crate: verify topological sort is identity (trivial)

7. **Document findings:**
   - Record any issues during publish (credentials, manifest errors, etc.)
   - Note if alpha version format matches expected `0.1.0-alpha.1`
   - Verify crates.io correctly marks it as pre-release

**Files:**
- Generated: `tokenledger/mise.toml`
- Generated: `tokenledger/.phenorc.toml`
- Modified: `tokenledger/Cargo.toml` (version bump on promote)
- Generated: CI workflows

**Parallel?** Yes (with T079–T080 after bootstrap complete).

**Notes:**
- Alpha publish to crates.io is a critical test; issues here block org-wide rollout
- Topological sort is only relevant if workspace exists; single crate is simpler
- Document credentials setup: pheno must have crates.io token configured

---

### Subtask T079 – Bootstrap thegent (Python) (70 lines)

**Purpose:** Deploy pheno bootstrap on thegent (Python), verify mise.toml, test pre-release publishing to PyPI (alpha channel), validate PEP 440 version format.

**Steps:**
1. **Prepare thegent:**
   - Ensure repo is on canonical `main` branch
   - Check Python project structure: `pyproject.toml` or `setup.py`
   - Current publishing setup: verify PyPI token/credentials available

2. **Run pheno bootstrap:**
   - Command: `pheno bootstrap --language python`
   - Expected outputs:
     - `mise.toml` created with Python config (from T066)
     - `.phenorc.toml` with `registry = "pypi"`, `language = "python"`
     - CI workflows generated
     - Git hooks installed

3. **Verify generated files:**
   - Check `mise.toml`:
     - `[tools] python = "3.14"` (or current stable)
     - Tasks: lint→`ruff check .`, test→`pytest`, build→`python -m build`, format→`ruff format .`, audit→`pip-audit`
   - Check `pyproject.toml`:
     - Verify version is SemVer (e.g., `0.2.0`)
     - Verify package name is correct for PyPI

4. **Run local validation:**
   - `mise run lint` → should pass
   - `mise run test` → should pass (pytest markers configured)
   - `mise run build` → should produce `dist/*.whl` and `dist/*.tar.gz`
   - `mise run format --check` → should pass
   - `mise run audit` → should pass or document known issues

5. **Test pre-release publishing (alpha):**
   - Command: `pheno promote alpha`
   - Pheno should:
     - Update `pyproject.toml` version to `0.2.0a1` (PEP 440 format)
     - Create git commit and tag: `v0.2.0a1`
     - Dry-run or actual publish to PyPI
   - Verify on PyPI: search thegent, confirm `0.2.0a1` appears with pre-release badge
   - Verify version format matches PEP 440 (a1, not alpha.1)

6. **Validate test markers:**
   - Verify `pyproject.toml` includes pytest marker config:
     ```toml
     [tool.pytest.ini_options]
     markers = ["integration: integration tests"]
     ```
   - Verify `mise run test:integration` works if integration tests exist

7. **Document findings:**
   - Record any issues during publish (credentials, build errors, etc.)
   - Verify PEP 440 alpha format is correct (`a1` not `alpha.1`)
   - Note any dependency conflicts or pip-audit warnings

**Files:**
- Generated: `thegent/mise.toml`
- Generated: `thegent/.phenorc.toml`
- Modified: `thegent/pyproject.toml` (version bump on promote)
- Generated: CI workflows

**Parallel?** Yes (with T078, T080 after bootstrap complete).

**Notes:**
- PEP 440 versioning is strict; `a1` is correct, not `alpha.1` or `a.1`
- PyPI pre-release detection: verify wheels upload correctly with alpha marker
- Document credentials: pheno must have PyPI token configured

---

### Subtask T080 – Bootstrap agentapi-plusplus (Go) (70 lines)

**Purpose:** Deploy pheno bootstrap on agentapi-plusplus (Go), verify mise.toml, test pre-release publishing via git tags and Go proxy, validate topological sort (if multi-module).

**Steps:**
1. **Prepare agentapi-plusplus:**
   - Ensure repo is on canonical `main` branch
   - Check Go project structure: single module or multi-module setup
   - Current versioning: check if using semantic versioning with git tags

2. **Run pheno bootstrap:**
   - Command: `pheno bootstrap --language go`
   - Expected outputs:
     - `mise.toml` created with Go config (from T068)
     - `.phenorc.toml` with `registry = "go-proxy"`, `language = "go"`
     - CI workflows generated
     - Git hooks installed

3. **Verify generated files:**
   - Check `mise.toml`:
     - `[tools] go = "1.23"` (current stable)
     - Tasks: lint→`golangci-lint run`, test→`go test ./...`, build→`go build ./...`, format→`gofmt -w .`, audit→`govulncheck ./...`
   - Check `go.mod`:
     - Verify module name is correct
     - Verify version in module declaration (Go doesn't have explicit version in go.mod)

4. **Run local validation:**
   - `mise run lint` → should pass golangci-lint checks
   - `mise run test` → should pass
   - `mise run build` → should produce binary
   - `mise run format --check` → should pass
   - `mise run audit` → should pass or document vulnerabilities

5. **Test pre-release publishing (alpha):**
   - Command: `pheno promote alpha`
   - Pheno should:
     - Create git tag: `v1.0.0-alpha.1` (or appropriate version)
     - Push tag to remote: `git push origin v1.0.0-alpha.1`
     - Go proxy automatically picks up tag (no manual publish needed)
   - Verify on go.pkg.dev: search module, confirm `v1.0.0-alpha.1` tag available
   - Verify go proxy recognizes pre-release tag

6. **Validate multi-module setup (if applicable):**
   - If agentapi-plusplus has sub-modules (e.g., `./api/go.mod`, `./client/go.mod`):
     - Verify pheno detects all modules
     - Verify topological sort works (if module A depends on module B)
     - `pheno audit --repo .` should show all modules

7. **Document findings:**
   - Record any issues with tag creation or pushing
   - Verify Go proxy recognizes alpha tag (may take 5-10 mins to appear)
   - Note multi-module behavior (if applicable)

**Files:**
- Generated: `agentapi-plusplus/mise.toml`
- Generated: `agentapi-plusplus/.phenorc.toml`
- Generated: CI workflows
- Git tag created: `v1.0.0-alpha.1` (by pheno promote)

**Parallel?** Yes (with T078–T079 after bootstrap complete).

**Notes:**
- Go proxy discovery takes time (5-10 mins); don't check immediately after push
- Go versioning: no go.mod version field; rely on git tags
- Multi-module support is advanced; document if this gets complex

---

### Subtask T081 – Cross-Repo Audit & Validation (50 lines)

**Purpose:** Run `pheno audit` across all 4 repos to verify package detection, version accuracy, and no errors.

**Steps:**
1. **Single-repo audits:**
   - AgilePlus: `pheno audit --repo AgilePlus/` → verify project detected as private, no package listed
   - tokenledger: `pheno audit --repo tokenledger/` → verify crate detected, version `0.1.0-alpha.1`
   - thegent: `pheno audit --repo thegent/` → verify package detected, version `0.2.0a1`
   - agentapi-plusplus: `pheno audit --repo agentapi-plusplus/` → verify module detected, version `v1.0.0-alpha.1`

2. **Org-wide audit:**
   - Command: `pheno audit --repos-dir ~/CodeProjects/Phenotype/repos/` (or path containing all 4 repos)
   - Expected output: table with columns:
     - Repo name
     - Language
     - Package/Module name
     - Current version
     - Channel
     - Registry (if publishable)
   - Verify all 4 rows appear correctly
   - Verify no errors or missing data

3. **Validate table accuracy:**
   - Each repo should show in exactly one row
   - Versions match what's in registries or git tags
   - No duplicates or phantom entries
   - Channel column shows correct channel (alpha for all at this stage)

4. **Error handling:**
   - If any repo errors during audit: document the error and root cause
   - If table missing rows: investigate repo detection
   - If versions incorrect: verify pheno parsing of version sources

5. **Document findings:**
   - Record audit output (table screenshot or output dump)
   - Note any discrepancies between expected and actual
   - Flag issues for resolution before org-wide rollout

**Files:**
- Reference: output of `pheno audit` on all 4 repos
- Document: findings in `docs/pilot-rollout-results.md`

**Parallel?** No (depends on T077–T080 completion).

**Notes:**
- This is a comprehensive sanity check; all 4 repos should audit cleanly
- Audit timing: if repos are large, may take >1 min; document baseline
- Org-wide audit will scale to 47 repos; current performance with 4 is baseline

---

### Subtask T082 – Document Findings & Template Adjustments (60 lines)

**Purpose:** Synthesize pilot results, document what worked, identify template or process improvements, update docs/templates before org-wide rollout.

**Steps:**
1. **Compile results document: `docs/pilot-rollout-results.md`:**
   - Executive summary: all 4 repos bootstrapped successfully, no critical blockers
   - Repo summaries (T077–T080):
     - What worked well
     - Issues encountered and resolution
     - Timing measurements (bootstrap time, task execution times)
     - Pre-release publish status (crates.io alpha, PyPI alpha, go proxy tag)
   - Cross-repo findings (T081):
     - Audit output and accuracy
     - Performance metrics

2. **Template adjustments:**
   - Review each language template (T065–T068) for any corrections needed
   - Update error messages or documentation based on real-world issues
   - If any tool version mismatch: update to stable versions used
   - If any task failed: document workaround or adjust task definition

3. **Process improvements:**
   - Identify steps that were unclear or needed repeating
   - Suggest improvements to pheno bootstrap prompts/output
   - Suggest improvements to CI workflow generation
   - If pre-commit/pre-push hooks had issues: document in WP12 testing (T076)

4. **Readiness assessment:**
   - Can we proceed to org-wide rollout (WP14)?
   - Are there any blockers to address before rolling out to 47 repos?
   - If blockers: create follow-up WPs or tasks to address

5. **Update AGENTS or team tracking:**
   - Mark WP13 complete with findings
   - Assign WP14 if ready, or create blocking task

6. **Document lessons learned:**
   - Create section in governance docs about common issues
   - Add troubleshooting guide for future bootstraps

**Files:**
- Create: `docs/pilot-rollout-results.md`
- Update: `templates/rust/mise.toml`, `templates/python/mise.toml`, `templates/typescript/mise.toml`, `templates/go/mise.toml` (if corrections needed)
- Update: pheno CLI documentation or error messages (if issues found)

**Parallel?** No (depends on T077–T081 completion).

**Notes:**
- This is the gate for org-wide rollout; findings must be carefully reviewed
- If major issues found: create blocking tasks in WP14, don't proceed until resolved
- If minor issues: document as known issues and proceed

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Private project (AgilePlus) accidentally publishes to registry | T077 validates `.phenorc.toml` has `private=true`; review CI workflows for any publish steps |
| Pre-release version format incorrect for registry (crates.io vs PyPI) | T078–T080 validate alpha format for each registry; pheno promote must output correct format |
| Topological sort fails on workspace/multi-module repos | T078 (Rust) and T080 (Go) validate if applicable; document if not yet supported |
| Pheno CLI not installed or missing credentials | T077–T080 assume pheno pre-installed (from WP09); document credential setup in pheno docs |
| Publish succeeds but registry takes time to index | T078–T080 poll registry 5-10 mins after publish; document expected delay |
| Org-wide audit (T081) fails on large set of repos | WP14 will handle scaling; document baseline performance with 4 repos |

## Review Guidance

**Reviewers should verify:**
- [ ] AgilePlus bootstrapped successfully; private artifact handling correct (T077)
- [ ] tokenledger alpha version on crates.io (T078)
- [ ] thegent alpha version on PyPI with correct PEP 440 format (T079)
- [ ] agentapi-plusplus alpha tag on go proxy (T080)
- [ ] Org-wide audit runs without errors and shows all 4 repos (T081)
- [ ] Pilot results documented with findings and any template adjustments (T082)
- [ ] No critical blockers to org-wide rollout

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created.
- 2026-03-01T21:41:17Z – wp13-impl – shell_pid=47504 – lane=doing – Assigned agent via workflow command
- 2026-03-01T21:43:36Z – wp13-impl – shell_pid=47504 – lane=for_review – Ready: pilot rollout docs and validator
- 2026-03-01T21:44:57Z – wp13-impl – shell_pid=47504 – lane=done – Complete
