---
work_package_id: WP12
title: Pre-Commit & Pre-Push Hooks
lane: "done"
dependencies: [WP11]
base_branch: 002-org-wide-release-governance-dx-automation-WP11
base_commit: c1282825ba6e2260a890a658f45b2d84e1674ec9
created_at: '2026-03-01T21:44:49.584393+00:00'
subtasks: [T071, T072, T073, T074, T075, T076]
phase: Phase 3 - DX Tooling
assignee: ''
agent: "wp12-impl"
shell_pid: "51600"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP12 – Pre-Commit & Pre-Push Hooks

## Objectives & Success Criteria

**Primary Goal:** Implement git hooks for automated code quality validation and channel-aware pre-push checks, ensuring consistent commit messages and preventing broken code from reaching remote.

**Success Criteria:**
- Pre-commit hook validates conventional commits; rejects non-conforming messages
- Pre-commit hook runs fast lint checks (<5s) without blocking legitimate commits
- Pre-push hook enforces channel-aware testing (feature/* minimal, canary/* full test, rc/* full test + ROLLBACK.md check)
- Hook installation is idempotent and works standalone or with pre-commit framework
- All hooks are POSIX sh for portability (Linux, macOS, Windows-compatible)
- Hooks tested on temp git repo with multiple scenarios

## Context & Constraints

**Context:**
- WP11 established mise task standardization; WP12 hooks invoke these tasks
- Conventional commits enable automated release note generation (WP09/WP10 use this)
- Channel-aware pre-push gates (feature, canary, beta, rc, main) align with governance model
- Hook installation must be simple: pheno bootstrap will run installer automatically

**Constraints:**
- Hooks written in POSIX sh for portability; no bash, zsh, or PowerShell
- Pre-commit hook must complete <5s to avoid developer frustration
- Merge commits must bypass commit message validation (git internally adds "Merge" prefix)
- `--no-verify` must work (standard git behavior); hooks cannot be bypassed by pheno bootstrap itself
- Main branch must not accept direct pushes (enforce PR workflow)

## Subtasks & Detailed Guidance

### Subtask T071 – Pre-Commit Hook: Conventional Commits Validation (55 lines)

**Purpose:** Implement `.git/hooks/pre-commit` script to validate commit message format using conventional commits standard.

**Steps:**
1. Create shell script at `hooks/pre-commit`:
   - Read commit message from: `git diff --cached --name-only` (files only) and message from `cat "$1"` (message from git commit)
   - Actually, git pre-commit hook doesn't have access to message; use `pre-commit-msg` instead
   - **Correct approach:** Create both `hooks/pre-commit` (for file staging) and let `hooks/commit-msg` validate message
   - Wait for clarification: pre-commit vs commit-msg timing
   - **Decision:** Use `commit-msg` hook for message validation (runs after user provides message)

2. For `hooks/commit-msg`:
   - Read message from first argument: `msg="$(cat "$1")"`
   - Validate format regex: `^(feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert)(\(.+\))?!?: .{1,72}$`
     - Conventional type: feat, fix, chore, docs, refactor, test, perf, ci, build, style, revert
     - Optional scope in parentheses
     - Optional breaking-change indicator: `!`
     - Separator: `:`
     - Subject: 1–72 characters
   - Special case: merge commits (start with "Merge") → skip validation
   - On failure: print helpful error message with examples:
     ```
     ❌ Commit message does not follow conventional commits format.
     Expected format: <type>(<scope>)?: <subject (1-72 chars)>
     Examples:
       feat: add login page
       fix(auth): resolve token expiration issue
       docs: update README
       refactor!: breaking change in API
     Your message: [show user's message]
     ```
   - Exit code 1 on failure, 0 on success
   - Allow `--no-verify` (git handles this; hook is skipped)

3. Add to file handling if needed (pre-commit hook):
   - Could add a lightweight check: no large binary files, no secrets
   - For now, keep simple; T072 adds the fast lint

4. Place script at: `hooks/commit-msg` (not pre-commit)
5. Make POSIX-compliant; test on bash, sh, zsh

**Files:**
- Create: `hooks/commit-msg` (or update if exists)
- Create: `hooks/pre-commit.sh` if needed for file checks

**Parallel?** No (T072 builds on this).

**Notes:**
- Regex must be POSIX-compatible (some systems have limited regex support)
- Alternatively, use simpler regex and check type/scope separately
- Error messages should guide user without being condescending

---

### Subtask T072 – Pre-Commit Hook: Fast Lint Check (50 lines)

**Purpose:** Add fast linting to pre-commit hook (after message validation), ensuring code formatting is correct before staging.

**Steps:**
1. Update or extend `hooks/pre-commit` script:
   - After commit-msg validation passes, run format/lint check
   - Invoke: `mise run format -- --check` (or repo's equivalent)
   - Goal: complete in <5s (measured)
   - If lint fails: show diff of what needs formatting
   - Exit code 1 on failure, 0 on success

2. Optimization for speed:
   - Check only staged files, not entire repo: use `git diff --cached --name-only` to get staged files
   - Pass file list to mise task: `mise run format -- --check -- <file list>`
   - This requires lint task to support file arguments (add to reference configs in WP11)
   - Fallback: run full repo lint if task doesn't support file filtering

3. On failure, show:
   - Which files need formatting
   - Command to auto-fix: `mise run format`
   - User can run `mise run format`, then re-stage and retry commit

4. Allow `--no-verify` to skip (git handles this)

5. Make POSIX-compliant; handle tools gracefully if mise not installed

**Files:**
- Update: `hooks/pre-commit`
- Reference task: T065–T068 (add `--check` flag support to format tasks)

**Parallel?** Yes, after T071 complete.

**Notes:**
- Pre-commit timing is critical; if exceeds 5s, consider making it optional or async
- Document in error message how to bypass if needed: `git commit --no-verify` (educate, don't enable by default)
- Test on repos with 1000+ files to ensure performance

---

### Subtask T073 – Pre-Push Hook: Channel-Aware Testing (65 lines)

**Purpose:** Implement `.git/hooks/pre-push` to enforce channel-specific quality gates before pushing to remote.

**Steps:**
1. Create `hooks/pre-push` script:
   - Git provides input on stdin: local refs, remote refs, local SHAs, remote SHAs
   - Read from stdin: `while IFS=' ' read -r local_ref local_sha remote_ref remote_sha; do`
   - Extract branch name from local_ref: `branch_name="${local_ref#refs/heads/}"`

2. Implement branch pattern detection and associated gates:
   - `feature/*` → run `mise run lint` only (developers should test locally; this is fast check)
   - `canary/*` or `beta/*` → run `mise run test` (integration testing required)
   - `rc/*` → run `mise run test` AND verify ROLLBACK.md exists in repo root
     - If ROLLBACK.md missing: print warning and block push
     - Message: "RC release must include rollback instructions. Add ROLLBACK.md and try again."
   - `main` → block all direct pushes
     - Message: "Direct pushes to main are blocked. Use PR workflow: create feature branch, open PR, get approval, merge via GitHub."
   - `*` (default) → run `mise run lint` (safe default)

3. Exit behavior:
   - If any gate fails: exit 1 (push blocked), show which check failed
   - If all pass: exit 0 (push allowed)

4. Error messaging:
   - Show which check failed (lint, test, ROLLBACK.md verification)
   - Suggest remediation: run `mise run lint` locally, run `mise run test`, etc.
   - Keep concise; developer already has details from local runs

5. Make POSIX-compliant; handle missing mise gracefully

**Files:**
- Create: `hooks/pre-push`
- Reference: ROLLBACK.md template (document structure for RC releases)

**Parallel?** Yes, after T071 complete.

**Notes:**
- Pre-push hooks often fail silently; test thoroughly
- Git pre-push hook input format: `<local-ref> <local-sha> <remote-ref> <remote-sha>`
- Document why main is blocked: enforces PR review process
- Consider allowing `--no-verify` for emergency pushes (rare, but document)

---

### Subtask T074 – Pre-Commit Framework Config Template (40 lines)

**Purpose:** Create `.pre-commit-config.yaml` template for repos choosing to use the pre-commit framework instead of standalone installer.

**Steps:**
1. Understand pre-commit framework:
   - YAML config that manages hooks from various sources
   - Can integrate local hooks (our shell scripts) or external hooks
   - Runs hooks in dependency order; easy to add/remove hooks per repo

2. Create `.pre-commit-config.yaml` template:
   ```yaml
   repos:
     - repo: local
       hooks:
         - id: commit-msg
           name: Conventional commit message validation
           entry: hooks/commit-msg
           language: script
           stages: [commit-msg]
         - id: pre-commit
           name: Fast lint check
           entry: hooks/pre-commit
           language: script
           stages: [commit]
         - id: pre-push
           name: Channel-aware pre-push testing
           entry: hooks/pre-push
           language: script
           stages: [push]
   ```

3. Add documentation:
   - How to use: `pre-commit install` and `pre-commit run --all-files`
   - How to update hooks: `pre-commit autoupdate`
   - Advantage: centralized hook management, easy to add external hooks (e.g., reuse from popular repos)
   - Disadvantage: requires pre-commit framework (Python-based, not always installed)

4. Include migration guide:
   - If repo already using pre-commit framework: use this template
   - If not: use standalone installer (T075) for simplicity

**Files:**
- Create: `.pre-commit-config.yaml` (template)
- Reference: hooks from T071–T073

**Parallel?** Yes, after T071–T073.

**Notes:**
- pre-commit framework is optional; pheno bootstrap will default to standalone installer
- This template provided for teams already using pre-commit framework
- Document in pheno bootstrap: "If .pre-commit-config.yaml exists, use pre-commit; else use standalone installer"

---

### Subtask T075 – Hook Installation Script (50 lines)

**Purpose:** Create `hooks/install.sh` for standalone installation of hooks (no framework required).

**Steps:**
1. Create `hooks/install.sh` script:
   - Copy `hooks/commit-msg` to `.git/hooks/commit-msg`
   - Copy `hooks/pre-commit` to `.git/hooks/pre-commit`
   - Copy `hooks/pre-push` to `.git/hooks/pre-push`
   - Make all executable: `chmod +x .git/hooks/*`
   - Idempotent: safe to run multiple times (overwrites existing)
   - Exit 0 on success, 1 on error

2. Add `--uninstall` flag:
   - Removes `.git/hooks/commit-msg`, `.git/hooks/pre-commit`, `.git/hooks/pre-push`
   - Idempotent: doesn't fail if hooks not present
   - Preserve other hooks (e.g., husky, custom hooks)
   - Only remove our 3 hooks

3. Add pre-commit framework detection:
   - Check if `.pre-commit-config.yaml` exists
   - If yes: recommend `pre-commit install` instead: "pre-commit framework detected. Run `pre-commit install` instead."
   - If no: proceed with standalone installation

4. Add error handling:
   - Check if `.git` directory exists (fail if not a git repo)
   - Check if `hooks/` directory exists with expected scripts (fail if not)
   - Provide helpful error messages

5. Script runs automatically via pheno bootstrap

**Files:**
- Create: `hooks/install.sh`
- Reference: pheno bootstrap integration (WP09/WP10 or later)

**Parallel?** Yes, after T071–T073.

**Notes:**
- Make script POSIX-compliant (works on all OSes)
- Provide clear success message: "Hooks installed in .git/hooks/"
- Document in pheno bootstrap: "Run `hooks/install.sh` after cloning"

---

### Subtask T076 – Hook Testing & Validation (70 lines)

**Purpose:** Create comprehensive test suite for hooks, validating all scenarios and measuring performance.

**Steps:**
1. **Setup test environment:**
   - Create temporary git repo: `mkdir test-repo && cd test-repo && git init`
   - Copy hooks: `cp -r ../hooks .git/hooks/` or `bash hooks/install.sh`
   - Make hooks executable

2. **Test commit-msg hook (T071):**
   - Valid conventional commits should pass:
     - `feat: add login page`
     - `fix(auth): resolve token expiration`
     - `docs: update README`
     - `refactor!: breaking change in API`
   - Invalid commits should fail:
     - `add login page` (missing type)
     - `feat add login page` (missing colon)
     - `feat: add login page that is very long and exceeds seventy two characters` (exceeds 72 chars)
   - Merge commits should bypass: `Merge branch 'develop' into main` (should pass)
   - Test `--no-verify` bypass: `git commit --no-verify -m "invalid message"` (should succeed)

3. **Test pre-commit hook (T072):**
   - Create unformatted file (e.g., badly formatted code)
   - Stage file: `git add file.js`
   - Attempt commit: should fail with formatting error
   - Run `mise run format`, re-stage, retry: should succeed
   - Measure timing: <5s for repo with 100+ files

4. **Test pre-push hook (T073):**
   - Feature branch: create `feature/test-feature`, commit, attempt push → lint runs
   - Canary branch: create `canary/v1.0.0`, commit, attempt push → test runs
   - RC branch: create `rc/v1.0.0`, commit, attempt push → test + ROLLBACK.md check
     - First without ROLLBACK.md: push should fail
     - Add ROLLBACK.md, retry: push should succeed
   - Main branch: attempt `git push origin main` → blocked
   - Test requires mock remote or use `git push --no-verify` to bypass

5. **Performance measurement:**
   - Time pre-commit hook on repos of varying sizes (10 files, 100 files, 1000+ files)
   - Document baseline times
   - Alert if any hook exceeds expected time (pre-commit <5s, pre-push <10s)

6. **Cross-platform validation:**
   - Test on bash, sh, zsh shells
   - Test on Linux, macOS (Windows via Git Bash)
   - Document any platform-specific issues

**Files:**
- Create: `tests/hooks-test.sh` (comprehensive test suite)
- Create: `tests/fixtures/` (sample files for testing)
- Document: `TESTING.md` (how to run tests)

**Parallel?** No (depends on T071–T075).

**Notes:**
- Test suite should be runnable in CI/CD pipeline
- Validate error messages are clear and actionable
- Common failure mode: pre-push hook not invoked because test fails before push is attempted

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Hooks fail silently (esp. pre-push) | T076 comprehensive testing; validate error messages |
| Pre-commit hook exceeds 5s timeout, frustrating developers | T072 measure performance; optimize to run only on staged files |
| Merge conflicts with other hook systems (husky, pre-commit) | T075 detects pre-commit framework; T074 provides pre-commit config; pheno bootstrap runs installer only if needed |
| POSIX compatibility issues across shells | T076 cross-shell testing (bash, sh, zsh); use POSIX subset only |
| Developers frequently use `--no-verify` to bypass checks | Document in error messages that this is unsafe; educate rather than forbid |
| ROLLBACK.md check for RC fails silently | T076 tests RC push with and without ROLLBACK.md; verify error message is clear |

## Review Guidance

**Reviewers should verify:**
- [ ] commit-msg hook validates conventional commits correctly (T071)
- [ ] Pre-commit hook runs <5s and shows helpful error messages (T072)
- [ ] Pre-push hook enforces channel-specific gates (T073)
- [ ] Pre-commit framework config provided for teams using it (T074)
- [ ] Standalone installer is idempotent and has `--uninstall` flag (T075)
- [ ] Comprehensive test suite covers all scenarios (T076)
- [ ] All hooks are POSIX-compliant (no bash-isms)
- [ ] Error messages are clear and actionable

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created.
- 2026-03-01T21:44:49Z – wp12-impl – shell_pid=51600 – lane=doing – Assigned agent via workflow command
- 2026-03-01T21:46:17Z – wp12-impl – shell_pid=51600 – lane=for_review – Ready: git hooks with conventional commits and channel-aware checks
- 2026-03-01T21:46:38Z – wp12-impl – shell_pid=51600 – lane=done – Complete
