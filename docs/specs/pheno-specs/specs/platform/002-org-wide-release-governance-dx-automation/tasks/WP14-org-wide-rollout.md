---
work_package_id: WP14
title: Org-Wide Rollout Automation
lane: "done"
dependencies: [WP13]
base_branch: 002-org-wide-release-governance-dx-automation-WP13
base_commit: a6a8034b581668fac33bbfb53d4d1d41c68c7f8a
created_at: '2026-03-01T21:44:23.062256+00:00'
subtasks: [T083, T084, T085, T086, T087]
phase: Phase 4 - Bootstrap + Rollout
assignee: ''
agent: "wp14-impl"
shell_pid: "50769"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP14 – Org-Wide Rollout Automation

## Objectives & Success Criteria

**Primary Goal:** Automate bootstrapping and governance infrastructure deployment across all 47 Phenotype repos, with manifest-driven configuration, bulk operations, and automated PR creation.

**Success Criteria:**
- `pheno bootstrap --all` flag implemented and tested on sample directory
- Repository manifest (`repos.toml`) generation automated with auto-detection and override support
- Bulk bootstrap with dry-run capability working on full repo directory
- Automated PR creation via `gh pr create` with standardized template
- Cross-org audit and release matrix generation working on all 47 repos
- No manual intervention required for bulk operations
- Error handling and progress reporting working correctly
- Performance acceptable for 47-repo scale (estimated <30 mins)

## Context & Constraints

**Context:**
- WP13 pilot validated pheno bootstrap on 4 repos; WP14 scales to all 47 repos
- Manifest-driven approach: repos.toml specifies language, registry, risk profile, and publish settings
- Automation reduces toil and ensures consistency across org
- PR creation enables review and approval process before merging infrastructure changes

**Constraints:**
- Bulk operations must have dry-run mode to preview before applying
- Rate limiting: GitHub API limits PR creation; must batch with delays
- 47 repos span 4+ languages; each may have unique structure
- Manifest must be auto-generated with manual override support (some repos may not fit auto-detect)
- Error handling: if one repo fails, must report but continue (fail-safe)
- Performance: org-wide bootstrap should complete in reasonable time (<30 mins)

## Subtasks & Detailed Guidance

### Subtask T083 – Implement `--all` Flag for Bootstrap (60 lines)

**Purpose:** Add `--all` flag to `pheno bootstrap` command to automatically discover and bootstrap all repos in a directory.

**Steps:**
1. **Command signature:**
   - `pheno bootstrap --all --repos-dir <path> [--dry-run] [--skip <repo1>,<repo2>...]`
   - `--all`: enable bulk mode
   - `--repos-dir <path>`: directory containing subdirectories to bootstrap (default: current directory)
   - `--dry-run`: preview what would happen; don't modify repos
   - `--skip <repos>`: comma-separated list of repo names to skip (e.g., `--skip archived-repo,experimental`)

2. **Repo discovery:**
   - Scan `repos-dir` for subdirectories
   - For each subdirectory, check if it's a git repo: `test -d .git`
   - Skip non-git directories silently
   - Create list of repos to bootstrap

3. **Dry-run output:**
   - Print header: "Dry-run mode. Will bootstrap N repos:"
   - For each repo, print:
     ```
     agileplux (TypeScript) – private
     tokenledger (Rust) – publish to crates.io
     thegent (Python) – publish to PyPI
     agentapi-plusplus (Go) – publish to go proxy
     ```
   - Ask for confirmation before proceeding (in dry-run or real mode?)
   - Actually, dry-run should just show; don't ask. Real mode should ask if >10 repos.

4. **Progress tracking:**
   - Use Lipgloss progress bar library (Go-based; already in pheno dependencies)
   - Display: `[====>    ] 15/47 repos bootstrapped`
   - Update on each repo completion

5. **Error handling:**
   - If repo bootstrap fails: log error and continue with next repo
   - Collect all errors; report summary at end
   - Exit code: 0 if all succeed, 1 if any fail

6. **Output format:**
   - Verbose mode (default): show details for each repo
   - Quiet mode: only show progress bar
   - Very verbose (--debug): show all commands being run

**Files:**
- Update: pheno CLI bootstrap command (main.rs or equivalent)
- Reference: Lipgloss docs for progress bar

**Parallel?** No (blocks T084–T086).

**Notes:**
- Dry-run is critical safety feature; users will trust it if reliable
- Progress bar improves UX for long-running bulk operations
- Error collection and summary reporting helps users prioritize fixes

---

### Subtask T084 – Repository Manifest Generation (65 lines)

**Purpose:** Create command `pheno manifest generate` to auto-detect repo metadata and produce `repos.toml` with override support.

**Steps:**
1. **Command signature:**
   - `pheno manifest generate --repos-dir <path> --output <file> [--override <repo:field=value>...]`
   - Scans `repos-dir` for git repos
   - Auto-detects: language, registry, risk profile, publish settings
   - Outputs `repos.toml`

2. **Auto-detection logic:**
   - **Language:** check for signature files in order of likelihood:
     - Rust: `Cargo.toml` → rust
     - Python: `pyproject.toml` or `setup.py` → python
     - TypeScript/JavaScript: `package.json` → typescript (check for `.ts` files; otherwise javascript)
     - Go: `go.mod` → go
     - Ruby: `Gemfile` → ruby
     - Java: `pom.xml` or `build.gradle` → java
     - Fallback: unknown
   - **Registry:** based on language and Cargo.toml/pyproject.toml/package.json:
     - Rust Cargo.toml has `[package]`: crates.io
     - Python pyproject.toml has `[project]`: pypi
     - TypeScript package.json: npm (by default; check scopes for other registries)
     - Go go.mod: go-proxy
   - **Private:** check if repo root has `PRIVATE` marker file or `.phenorc.toml` with `private=true`:
     - If `package.json` missing `"name"` or `private: true`: mark private
     - If Cargo.toml missing `[package]` or no name: mark private
   - **Risk profile:** heuristic based on repo name and size:
     - Contains "critical" or "core": high
     - Otherwise: low (can be overridden)

3. **Output format: `repos.toml`:**
   ```toml
   [[repos]]
   name = "agileplux"
   language = "typescript"
   registry = "npm"
   risk_profile = "low"
   private = true

   [[repos]]
   name = "tokenledger"
   language = "rust"
   registry = "crates.io"
   risk_profile = "low"
   private = false

   [[repos]]
   name = "thegent"
   language = "python"
   registry = "pypi"
   risk_profile = "low"
   private = false

   [[repos]]
   name = "agentapi-plusplus"
   language = "go"
   registry = "go-proxy"
   risk_profile = "medium"
   private = false
   ```

4. **Override support:**
   - Command-line override: `--override tokenledger:risk_profile=high`
   - Multiple overrides: `--override repo1:field1=val1 --override repo2:field2=val2`
   - Overrides applied after auto-detection
   - Document in manifest as comment: `# risk_profile overridden by user`

5. **Validation:**
   - Check all required fields present
   - Validate language is in known list
   - Validate registry is valid
   - Validate risk_profile is low/medium/high
   - Print warnings for unknown repos or fields

6. **Idempotency:**
   - If `repos.toml` already exists: warn user, optionally backup
   - Allow overwrite with `--force` flag

**Files:**
- Create: pheno CLI `manifest generate` subcommand
- Output: `repos.toml` at specified path
- Reference: pheno bootstrap language detection logic

**Parallel?** Yes, with T085 after T083 complete.

**Notes:**
- Auto-detection heuristics may have edge cases; override support handles them
- Risk profile is subjective; document decision criteria
- Manifest validation should be strict to prevent downstream issues

---

### Subtask T085 – Bulk Bootstrap with Dry-Run (60 lines)

**Purpose:** Execute bulk bootstrap on all repos in directory with dry-run preview.

**Steps:**
1. **Workflow:**
   - User runs: `pheno bootstrap --all --repos-dir ~/CodeProjects/Phenotype/repos/ --dry-run`
   - Pheno discovers all repos in directory (T083)
   - For each repo, preview what would happen (don't actually bootstrap)
   - Output format (example):
     ```
     Dry-run: Bootstrap 47 repos

     agileplux (TypeScript) – private
       - Create: mise.toml
       - Create: .phenorc.toml
       - Generate: .github/workflows/ci.yml
       - Install: git hooks

     tokenledger (Rust)
       - Create: mise.toml
       - Create: .phenorc.toml
       - Generate: .github/workflows/ci.yml
       - Generate: .github/workflows/release.yml
       - Install: git hooks

     [... 45 more repos ...]

     Total changes: 47 repos modified (0 skipped, 0 errors in dry-run)
     ```
   - User reviews output; if satisfied, runs without `--dry-run`

2. **Actual bootstrap (without dry-run):**
   - Run: `pheno bootstrap --all --repos-dir ~/CodeProjects/Phenotype/repos/`
   - For each repo:
     - Check if already bootstrapped (look for `mise.toml`)
     - If already bootstrapped: skip or update based on user preference
     - Run bootstrap (T077–T080 logic)
     - Report success/failure with error details
   - Progress bar shows N/47 repos completed
   - Collect errors; report summary at end

3. **Error recovery:**
   - If a repo fails (e.g., invalid Cargo.toml syntax):
     - Log error to file: `bootstrap-errors.log`
     - Continue with next repo
     - Don't fail entire operation
   - Print at end: "3 repos failed. See bootstrap-errors.log"
   - User can fix issues and re-run (idempotent)

4. **Performance optimization:**
   - Parallelize bootstrap: run up to 4 repos in parallel (assuming 4 CPU cores)
   - Use goroutines for concurrency
   - Maintain order in output (show results in original repo order)

5. **Output verbosity:**
   - Default: show progress bar + summary
   - `--verbose`: show each repo's bootstrap steps
   - `--quiet`: only show errors
   - `--debug`: show all commands being executed

**Files:**
- Update: pheno CLI bootstrap `--all` implementation
- Reference: T083 repo discovery and progress tracking

**Parallel?** Yes, with T086–T087 after T084 complete.

**Notes:**
- Dry-run is the safety valve; ensure it's accurate so users trust it
- Error logging to file is critical for troubleshooting on 47-repo scale
- Parallelization helps but must be careful not to overload system

---

### Subtask T086 – Automated PR Creation (55 lines)

**Purpose:** For each bootstrapped repo, create GitHub PR with standardized template summarizing changes.

**Steps:**
1. **Workflow:**
   - After successful bootstrap of a repo, create PR automatically
   - Use `gh pr create` (GitHub CLI; must be installed and authenticated)
   - Command: `gh pr create --title "chore: add release governance infrastructure" --body <template>`

2. **PR title:**
   - Consistent title: `chore: add release governance infrastructure`
   - Or per-repo variation: `chore: bootstrap governance infrastructure (mise, hooks, CI/CD)`

3. **PR body template (heredoc):**
   ```markdown
   ## Summary
   This PR adds release governance infrastructure to [repo-name], including:
   - **mise.toml**: Standardized task runner configuration for [language]
   - **Git hooks**: Pre-commit (conventional commits, fast lint) and pre-push (channel-aware testing)
   - **CI/CD workflows**: GitHub Actions for lint, test, build, and release channels
   - **.phenorc.toml**: Release governance configuration (registry: [registry], language: [language])

   ## Changes
   - Added `mise.toml` with standardized tasks (lint, test, build, format, audit, release:*)
   - Added `.git/hooks/commit-msg`, `pre-commit`, `pre-push` (or .pre-commit-config.yaml)
   - Generated `.github/workflows/ci.yml` and `.github/workflows/release.yml`
   - Added `.phenorc.toml` with project metadata

   ## How to Review
   1. Review `mise.toml` for correctness of task definitions
   2. Review git hooks for security and correctness
   3. Verify CI workflows align with project needs
   4. Test locally: `git pull`, `mise run lint`, `mise run test`

   ## Testing
   - [ ] `mise run lint` passes
   - [ ] `mise run test` passes
   - [ ] `mise run build` succeeds
   - [ ] Git hooks work correctly (test commit, test push)

   ---
   Generated by pheno bootstrap. Questions? See [link to governance docs].
   ```

4. **Batch operations:**
   - After bootstrapping all repos, create PRs in batch
   - Add 5-second delay between PR creations to avoid GitHub rate limits
   - Report PR URLs as created

5. **Error handling:**
   - If PR creation fails (e.g., repo already has PR):
     - Log error and continue
     - Don't fail entire rollout
   - Report which repos failed to create PR

6. **PR tracking:**
   - Output summary: "Created 47 PRs. Track at: [link to repo]"
   - Save PR URLs to file for easy access: `pr-links.txt`

**Files:**
- Update: pheno CLI to call `gh pr create` after each bootstrap
- Reference: GitHub CLI documentation

**Parallel?** Yes, with T085, T087 after T084 complete.

**Notes:**
- Requires `gh` CLI to be installed and authenticated
- Rate limiting: 5-second delay is conservative; adjust if GitHub allows faster
- Error handling is critical; don't let one failed PR block others

---

### Subtask T087 – Post-Rollout Validation & Matrix (60 lines)

**Purpose:** After rollout, run org-wide audit and generate release matrix to verify all repos are correctly configured.

**Steps:**
1. **Org-wide audit:**
   - Command: `pheno audit --repos-dir ~/CodeProjects/Phenotype/repos/`
   - Scans all repos, detects packages/modules, reports current versions and channels
   - Output: table with columns:
     ```
     Repo                 | Language | Package/Module     | Version        | Channel | Registry      | Private
     ================================================================================
     agileplux            | ts       | (internal)         | (none)         | (none)  | (none)         | true
     tokenledger          | rust     | tokenledger        | 0.1.0-alpha.1  | alpha   | crates.io      | false
     thegent              | python   | thegent            | 0.2.0a1        | alpha   | pypi           | false
     agentapi-plusplus    | go       | agentapi-plusplus  | v1.0.0-alpha.1 | alpha   | go-proxy       | false
     [... 43 more repos ...]
     ```

2. **Validation:**
   - All publishable repos (private=false) should have a package detected
   - All should have bootstrap infrastructure (mise.toml, .phenorc.toml)
   - Version parsing should be accurate for all registries
   - No errors or missing data

3. **Release matrix:**
   - Command: `pheno matrix`
   - Shows all repos, current version, next promotable versions, release readiness
   - Example output:
     ```
     Release Readiness Matrix

     Repo                 | Current    | → Alpha    | → Beta | → RC | → Stable
     ========================================================================================
     tokenledger          | 0.1.0      | 0.1.0-a1   | 0.1.1 | ...  | (not ready)
     thegent              | 0.2.0      | 0.2.0a1    | 0.2.1 | ...  | (not ready)
     agentapi-plusplus    | v1.0.0     | v1.0.0-a1  | ...   | ...  | (not ready)
     [... 44 more repos ...]
     ```

4. **Error reporting:**
   - If any repo fails to parse/audit: list with error message
   - Suggest remediation: "Run `pheno bootstrap` to fix"

5. **Performance baseline:**
   - Document timing for full org-wide audit
   - Establish as baseline for future runs
   - Alert if future audits significantly slower

6. **Summary output:**
   - Total repos: 47
   - Publishable: 46
   - Private: 1
   - Errors: 0
   - Status: ✓ Ready for production

**Files:**
- Update: pheno CLI `audit --repos-dir` subcommand (if not exists)
- Create: pheno CLI `matrix` subcommand
- Reference: org-wide rollout results

**Parallel?** No (depends on T083–T086 completion).

**Notes:**
- Matrix is a visualization tool; helps stakeholders understand release readiness at a glance
- Audit performance on 47 repos is important baseline; may need optimization
- Error reporting will guide teams on which repos need fixes

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Bulk bootstrap fails midway; unclear which repos succeeded | T085 collect errors; output summary at end; save log file |
| Dry-run doesn't match actual behavior; users don't trust it | T085 implement dry-run carefully; test extensively on subset |
| Rate limiting on GitHub PR creation | T086 add 5-second delay between PRs; batch in groups if needed |
| Auto-detection misclassifies repo language/registry | T084 manifest validation + override support; manual fixes via manifest |
| 47-repo bootstrap takes too long (>30 mins) | T085 implement parallelization; measure baseline and optimize |
| Some repos don't bootstrap due to non-standard structure | T085 fail-safe: report errors, continue; teams can fix manually |
| Post-rollout audit shows missing or incorrect packages | T087 audit validation; flag repos that need attention; support team with remediation |

## Review Guidance

**Reviewers should verify:**
- [ ] `--all` flag implemented with dry-run and `--skip` support (T083)
- [ ] Manifest generation auto-detects language, registry, risk profile (T084)
- [ ] Bulk bootstrap works with dry-run; error handling and progress bar present (T085)
- [ ] PR creation works with 5-second rate limit; PR template is clear (T086)
- [ ] Org-wide audit and matrix generation working on all 47 repos (T087)
- [ ] No critical errors blocking production rollout
- [ ] Performance acceptable for 47-repo scale

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created.
- 2026-03-01T21:44:23Z – wp14-impl – shell_pid=50769 – lane=doing – Assigned agent via workflow command
- 2026-03-01T21:47:54Z – wp14-impl – shell_pid=50769 – lane=for_review – Ready: org-wide rollout with manifest and bulk bootstrap
- 2026-03-01T21:48:17Z – wp14-impl – shell_pid=50769 – lane=done – Complete
