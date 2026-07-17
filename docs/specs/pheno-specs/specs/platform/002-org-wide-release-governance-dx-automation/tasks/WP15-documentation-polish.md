---
work_package_id: WP15
title: Documentation & Polish
lane: "done"
dependencies:
- WP07
base_branch: 002-org-wide-release-governance-dx-automation-WP07
base_commit: 2a2ac0a71d85db9a3a99626b777b233f03b7e1d5
created_at: '2026-03-01T21:41:32.950798+00:00'
subtasks: [T088, T089, T090, T091, T092, T093]
phase: Phase 5 - Polish
assignee: ''
agent: "wp15-impl"
shell_pid: "47925"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP15 – Documentation & Polish

## Objectives & Success Criteria

**Primary Goal:** Create comprehensive, user-friendly documentation for pheno CLI and governance model, with architecture decision records and error message polish, enabling smooth adoption across organization.

**Success Criteria:**
- pheno CLI README covers installation, quick start, all commands, configuration, and adapter status
- Governance model documentation explains 5-tier channel system, risk profiles, and promotion workflow
- Contributor quickstart guides new developers through bootstrap-to-publish workflow
- Two ADRs document task runner selection and registry adapter architecture
- All user-facing error messages are clear, actionable, and no raw stack traces
- Documentation is linked from main README and discovery is straightforward
- All docs follow consistent formatting and tone (friendly, not condescending)

## Context & Constraints

**Context:**
- WP07 established pheno CLI commands; documentation needed to guide users
- WP11 standardized task runners; need to explain why and how to use
- WP13 pilot validated bootstrap; feedback should inform documentation
- 47-repo org requires clear governance model explanation
- Architecture decisions (task runner, registry adapter) should be documented for future reference

**Constraints:**
- Documentation must be in `pheno-cli` repository (separate from specs)
- ADRs follow standard format (Status, Context, Decision, Consequences)
- Error messages must be user-facing; developers should not see stack traces
- Documentation should be accessible to users with varying technical backgrounds (contributors vs ops)
- Links must be durable; avoid hardcoding version numbers or paths that change frequently

## Subtasks & Detailed Guidance

### Subtask T088 – pheno CLI README (65 lines)

**Purpose:** Write comprehensive README.md in pheno-cli repo root, documenting installation, usage, commands, configuration, and adapter status.

**Steps:**
1. **Structure:**
   - Title: "pheno – Release Governance CLI"
   - Tagline: "Standardize release processes across polyglot organizations"
   - Table of contents with quick links

2. **Installation section:**
   - Binary download (GitHub Releases)
   - Homebrew (if available/planned)
   - Go install: `go install github.com/phenotype-org/pheno-cli@latest`
   - Docker (optional, for CI/CD)
   - Verify installation: `pheno version`

3. **Quick Start section (5 mins):**
   - Scenario: User has new repo, wants to add governance infrastructure
   - Steps:
     ```
     1. Install: go install github.com/phenotype-org/pheno-cli@latest
     2. Install mise (task runner)
     3. Clone repo: git clone ...
     4. Bootstrap: cd repo && pheno bootstrap --language rust
     5. Run tasks: mise run lint && mise run test
     6. Promote pre-release: pheno promote alpha
     7. Publish: (handled by CI/CD)
     ```
   - Expected output at each step (what success looks like)
   - Common issues and how to fix

4. **Commands section:**
   - Each command has subsection with:
     - Description (one sentence)
     - Usage: `pheno <command> [flags]`
     - Flags: description, type, default, examples
     - Examples: 2-3 realistic examples
   - Commands to document:
     - `bootstrap`: initialize repo with governance infrastructure
     - `promote`: advance version to next channel (alpha → beta → rc → stable)
     - `audit`: inspect package/module metadata and current version
     - `manifest generate`: auto-detect and generate repos.toml
     - `matrix`: visualize release readiness across repos

5. **Configuration section:**
   - `.phenorc.toml` format with all fields explained
   - Environment variables: `PHENO_REGISTRY`, `PHENO_CREDENTIALS`, etc.
   - Credentials management: where to store API tokens (GitHub Secrets for CI/CD, local .env for dev)
   - Config file search order: `.phenorc.toml` in repo, env vars, defaults

6. **Adapter Status table:**
   ```
   | Registry    | Status      | Notes                        |
   |-------------|-------------|------------------------------|
   | crates.io   | ✓ Supported | Rust packages                |
   | PyPI        | ✓ Supported | Python packages              |
   | npm         | ✓ Supported | JavaScript/TypeScript        |
   | Go proxy    | ✓ Supported | Go modules                   |
   | GitHub      | Planned     | GitHub Releases via Actions  |
   | GitLab      | Not planned | Community contribution       |
   ```

7. **Troubleshooting section:**
   - Common errors and solutions
   - "pheno: command not found" → verify installation
   - "missing credentials" → setup guide for each registry
   - "publish failed" → check registry status, credentials, network
   - "git tree is dirty" → commit changes before promoting

8. **Contributing section:**
   - Link to CONTRIBUTING.md
   - Link to ADRs (T091–T092)
   - Development setup (Go 1.23+, make, pre-commit hooks)

**Files:**
- Create/update: `pheno-cli/README.md`
- Reference: pheno CLI source code for accurate command docs

**Parallel?** No (depends on WP07 commands finalized).

**Notes:**
- README should be readable in 10 minutes (skim, don't read every word)
- Code examples should copy-paste without modification
- Links to detailed docs (governance, ADRs) for deeper dives
- Use emoji sparingly (one per section max); keep professional tone

---

### Subtask T089 – Governance Model Overview (70 lines)

**Purpose:** Create comprehensive document explaining the evolved 5-tier release governance model, risk profiles, channel gates, and promotion workflow.

**Steps:**
1. **Document: `docs/governance/GOVERNANCE_MODEL.md`:**
   - Target audience: teams evaluating if/how to adopt, contributors understanding the flow
   - Length: ~2000 words (can skim in 15 mins, detailed read in 30 mins)

2. **Sections:**

   **Overview:**
   - Problem statement: 47 repos, 4 languages, inconsistent release practices
   - Solution: unified governance model with channels and risk-based gates
   - Benefits: consistency, reduced human error, faster releases, traceability

   **5-Tier Channel System:**
   - Each version moves through: Dev → Alpha → Beta → RC → Stable
   - Explanation of each:
     - Dev: in-development, commits to branches (not published)
     - Alpha: pre-release, early testers, breaking changes OK
     - Beta: feature-complete, bug fixes, limited breaking changes
     - RC: ready for production, final validation, no changes
     - Stable: production release, guaranteed backward compatibility

   **Risk Profiles:**
   - Low risk: internal tools, dashboards, experimental projects
   - Medium risk: libraries used by <10 internal projects
   - High risk: critical services, security-sensitive, used by >10 projects
   - How risk affects gates:
     - Low: minimal gates (lint, test)
     - Medium: standard gates (lint, test, changelog)
     - High: strict gates (lint, test, security audit, approval)

   **Promotion Workflow (with mermaid diagram):**
   ```
   dev (main branch)
        ↓ [run promote alpha]
   alpha (0.1.0-alpha.1, tagged)
        ↓ [integration testing, feedback from alpha users]
   beta (0.1.0-beta.1, tagged)
        ↓ [stabilization, security audit]
   rc (0.1.0-rc.1, tagged)
        ↓ [final validation]
   stable (0.1.0, tagged)
   ```

   **Gate Criteria per Channel:**
   - Alpha: lint + test (5 mins) → publish immediately
   - Beta: lint + test + changelog → publish next day (manual approval)
   - RC: full test suite + security audit + ROLLBACK.md + approval → hold for release day
   - Stable: same as RC + no new issues reported → publish

   **How Promotion Works:**
   - User runs: `pheno promote alpha`
   - Pheno checks: working tree clean, lint passes, tests pass
   - Pheno bumps version (SemVer + prerelease), creates commit and tag
   - CI/CD detects tag, runs gates, publishes
   - User gets notification: "Published 0.1.0-alpha.1 to crates.io"

   **Version Schemes per Registry:**
   - SemVer (most common): MAJOR.MINOR.PATCH[-PRERELEASE][+BUILD]
   - Rust crates.io: 0.1.0-alpha.1 (SemVer, prerelease)
   - Python PyPI: 0.1.0a1 (PEP 440, alpha = a)
   - Go go proxy: v1.0.0-alpha.1 (go version pseudo-versions)
   - JavaScript npm: 0.1.0-alpha.1 (SemVer, npm-specific conventions)
   - How pheno normalizes: internally SemVer, output per-registry convention

   **Rollback Plan:**
   - If critical issue found after promotion: `pheno rollback`
   - Returns version to previous channel (stable → rc → beta → alpha)
   - Creates issue for investigation
   - Document post-incident in ROLLBACK.md

   **Exceptions & Overrides:**
   - Emergency hotfix: bypass alpha/beta, jump to RC
   - Security fix: expedited release
   - How to request: create issue, security team approves, then `pheno promote --force`

3. **Visuals:**
   - Mermaid diagram of channel flow
   - Timeline diagram: alpha release → user feedback → beta → rc → stable
   - Table: risk profile vs gate criteria

4. **Examples:**
   - Example alpha promotion for Rust crate
   - Example beta promotion for Python package
   - Example RC validation for critical service

5. **Related documents:**
   - Link to pheno CLI README for commands
   - Link to task runner reference (WP11 output)
   - Link to CI/CD setup (WP09/WP10)

**Files:**
- Create: `docs/governance/GOVERNANCE_MODEL.md`
- Create: mermaid diagrams (embedded in markdown)

**Parallel?** Yes, after T088 started.

**Notes:**
- Tone: educational, explain reasoning behind decisions
- Avoid jargon; define terms on first use
- Use examples from real repos (tokenledger, thegent, etc.)
- This doc is foundational; reference it from other docs

---

### Subtask T090 – Contributor Quickstart (60 lines)

**Purpose:** Create step-by-step guide for new contributors to onboard with pheno, mise, and governance workflow.

**Steps:**
1. **Document: `CONTRIBUTING.md` (at repo root or docs/):**
   - Target audience: developers new to pheno governance
   - Length: ~1200 words (15 mins to read and understand)

2. **Sections:**

   **Prerequisites:**
   - Install Go 1.23+
   - Install Git (latest)
   - Install mise: https://mise.jdx.dev
   - Install pheno: `go install github.com/phenotype-org/pheno-cli@latest`

   **Step 1: Clone & Setup (2 mins):**
   ```
   git clone https://github.com/phenotype-org/<repo>
   cd <repo>
   pheno bootstrap  # (if not already done)
   mise install     # install dependencies
   ```

   **Step 2: Verify Setup (3 mins):**
   ```
   mise run lint    # should pass
   mise run test    # should pass
   mise run build   # should pass
   ```

   **Step 3: Make Changes (varies):**
   - Use conventional commit format: `feat: add feature` or `fix: resolve issue`
   - Pre-commit hook will validate format
   - If format is wrong: hook rejects, shows example
   - Fix format and retry

   **Step 4: Run Tests Locally (5 mins):**
   ```
   mise run test               # run all tests
   mise run test:integration   # if available
   ```

   **Step 5: Push & Create PR (5 mins):**
   ```
   git push origin feature-branch
   # Open PR on GitHub (link provided by git)
   ```
   - CI runs: `mise run lint`, `mise run test`, `mise run build`
   - Pre-push hook already ran locally; expect CI to pass
   - If CI fails: review logs, fix locally, push again

   **Step 6: Review & Merge:**
   - Team reviews code
   - Maintainer merges to main
   - CI runs release gate

   **Step 7: (Maintainer Only) Promote & Release:**
   ```
   pheno promote alpha          # bump to pre-release
   # (after testing)
   pheno promote stable         # release to production
   ```

   **Troubleshooting:**
   - `mise run format` to auto-fix formatting
   - `git commit --no-verify` to skip hooks (not recommended, but available)
   - `pheno --help` for command details
   - Ask in Slack or open issue

3. **Conventions:**
   - Commit message format (link to governance docs)
   - Branch naming: `feature/foo`, `bugfix/bar`, `docs/baz`
   - Code style: per-language (linting enforced by mise tasks)
   - Documentation: update README if user-facing changes

4. **Key concepts (short explanations):**
   - mise: task runner, defined in `mise.toml`, standardized across repos
   - Git hooks: pre-commit validates format, pre-push checks tests
   - pheno: release CLI, promotes versions through channels
   - Governance: ensures consistent, reliable releases

5. **Quick reference table:**
   | Task | Command | Time |
   |------|---------|------|
   | Install | `mise install` | 2m |
   | Lint | `mise run lint` | 30s |
   | Test | `mise run test` | varies |
   | Format | `mise run format` | 30s |
   | Build | `mise run build` | varies |

**Files:**
- Create/update: `CONTRIBUTING.md` (at repo root)
- Reference: WP11 task definitions, governance model

**Parallel?** Yes, with T089.

**Notes:**
- This is the onboarding document; should be discoverable from README
- Use language appropriate for junior developers (no jargon)
- Include copy-paste commands (users will thank you)
- Link to deeper docs for each section (governance, mise config, etc.)

---

### Subtask T091 – ADR: Task Runner Selection (45 lines)

**Purpose:** Document the decision to standardize on mise as the task runner across all repos.

**Steps:**
1. **Document: `docs/adr/001-task-runner-selection.md`:**
   - Format: use ADR template (Title, Status, Context, Decision, Consequences, Alternatives)

2. **Content:**

   **Title:** Use mise as Organization's Standard Task Runner

   **Status:** Accepted (as of 2026-03-01)

   **Context:**
   - Phenotype organization maintains 47 repositories across 4 primary languages (Rust, Python, TypeScript, Go)
   - Current state: mix of Taskfile.yml, npm scripts, make, shell scripts
   - Need for standardization: improve developer experience, reduce toil, enable tooling (like pheno CLI)
   - Candidates evaluated: mise, moon (Rust-specific), gradle (Java-heavy), explicit make
   - mise strengths:
     - Language-agnostic (works with any language/tool)
     - Polyglot-friendly (single config for Rust + Python + Node + Go repos)
     - Active development, good documentation
     - Monorepo support (experimental but stabilizing in v2026.x)
     - Shell-friendly (tasks are shell commands, no DSL overhead)

   **Decision:**
   - Adopt mise v2026.x as standard task runner
   - Define reference `mise.toml` configurations per language (Rust, Python, TypeScript, Go)
   - Include standard task set: lint, test, build, format, audit, release:promote, release:status
   - Roll out via pheno bootstrap starting with pilot 4 repos

   **Consequences:**
   - Positive:
     - Consistent task interface across all languages/repos
     - Lower friction for developers switching between repos
     - pheno CLI can assume mise tasks exist
     - Easier to build org-wide tooling (manifest, audit, matrix commands)
   - Negative:
     - Teams using Taskfile/npm scripts must migrate (pheno bootstrap handles this)
     - Mise monorepo features still experimental (may have edge cases)
     - Need to train teams on mise (documentation, examples provided)
   - Risks:
     - Mise 2026.x monorepo instability could require fallback to per-repo config
     - Mise maintenance/updates could lag behind ecosystem (mitigated by active community)

   **Alternatives Considered:**
   - **moon:** Rust-native monorepo tool. Rejected: not polyglot, overly complex for non-Rust repos.
   - **Gradle:** JVM-based. Rejected: Java-centric, not suitable for Rust/Python/Go.
   - **Explicit make:** POSIX standard. Rejected: verbose, no environment management, not user-friendly.
   - **No standardization:** Status quo. Rejected: increases toil, prevents org-wide automation.

   **Follow-up:**
   - Monitor mise v2027+ for monorepo stability improvements
   - Quarterly review of task definitions to keep them current
   - Collect feedback from teams on pain points

**Files:**
- Create: `docs/adr/001-task-runner-selection.md`
- Reference: mise documentation, pheno CLI

**Parallel?** Yes, with T092.

**Notes:**
- ADR is for documentation and future reference (why decisions were made)
- Status should be "Accepted"; if later superseded, mark as "Superseded"
- Alternatives section is important; shows decision-making process

---

### Subtask T092 – ADR: Registry Adapter Architecture (50 lines)

**Purpose:** Document the design of pheno's registry adapter system to support multiple package registries.

**Steps:**
1. **Document: `docs/adr/002-registry-adapter-architecture.md`:**

   **Title:** Registry Adapter Architecture for Multi-Registry Support

   **Status:** Accepted (as of 2026-03-01)

   **Context:**
   - Phenotype repos publish to different registries: crates.io (Rust), PyPI (Python), npm (JavaScript), go-proxy (Go)
   - Each registry has different:
     - Version format (SemVer vs PEP 440 vs go pseudo-versions)
     - Publish mechanism (API token auth, git tag-based)
     - Metadata requirements (Cargo.toml vs pyproject.toml vs package.json vs go.mod)
   - pheno needs to support current 4 registries and be extensible for future registries
   - Current state: hardcoded logic for each registry (not scalable)

   **Decision:**
   - Implement registry adapter as Go interface:
     ```go
     type Adapter interface {
       ParseVersion() (Version, error)
       GetMetadata() (Metadata, error)
       PublishRelease(version string) error
       RollbackRelease(version string) error
     }
     ```
   - Each registry implements Adapter:
     - CratesIoAdapter (Rust)
     - PyPiAdapter (Python)
     - NpmAdapter (JavaScript)
     - GoProxyAdapter (Go)
   - pheno registry detection logic selects appropriate adapter based on `language` field in `.phenorc.toml`
   - Version logic centralized in Adapter: handles language-specific conventions
   - pheno.go calls adapter methods; no registry-specific logic in main flow

   **Consequences:**
   - Positive:
     - New registry support: just implement Adapter interface
     - Consistent pheno UX across all registries
     - Easier testing: mock adapters for unit tests
     - Extensibility: easy to add GitLab, Artifactory, etc.
   - Negative:
     - Each adapter must be tested thoroughly (API mocks, integration tests)
     - Adapter implementations must keep up with registry API changes
   - Risks:
     - Adapter API discovery (how to detect registry endpoint, credentials)
     - Registry API rate limits and error handling (must be robust)

   **Alternatives Considered:**
   - **Strategy pattern:** Similar to adapter; chosen because "adapter" terminology clearer for external systems
   - **Plugin system:** Too heavyweight for current scope; revisit if >10 adapters needed
   - **Monolithic pheno:** All registry logic in one file. Rejected: unmaintainable, hard to extend.

   **Follow-up:**
   - Monitor registry API changes; update adapters as needed
   - Collect feedback on adapter usability from teams adding new registries

**Files:**
- Create: `docs/adr/002-registry-adapter-architecture.md`
- Reference: pheno CLI source code (adapter implementations)

**Parallel?** Yes, with T091.

**Notes:**
- This ADR explains why pheno is structured a certain way
- Helps future developers understand the design and make consistent extensions
- Links to actual code are helpful (point to file/function)

---

### Subtask T093 – Error Message Audit & Polish (70 lines)

**Purpose:** Review all user-facing error messages in pheno CLI, ensure clarity and actionability, remove raw stack traces.

**Steps:**
1. **Inventory:**
   - Search pheno CLI source code for error messages:
     - stderr output
     - error handling (log.Fatal, fmt.Errorf, etc.)
     - Collect all user-facing error messages
     - Create spreadsheet: error type, current message, suggested improvement

2. **Error message criteria:**
   - **Problem description:** Clear, specific, not generic
   - **Root cause:** Why did this happen?
   - **Suggested remediation:** What should user do?
   - **No stack traces:** User doesn't need to see Go internals
   - **Tone:** Helpful, not condescending
   - **Length:** 1–3 sentences (concise)

3. **Common error scenarios:**
   - Missing credentials (crates.io token, PyPI token, etc.)
   - Network errors (registry unreachable, git push timeout)
   - Rate limits (GitHub API, npm registry)
   - Dirty working tree (uncommitted changes)
   - Version conflict (version already exists in registry)
   - Invalid manifest (`.phenorc.toml` parse error)
   - Missing configuration (no `.phenorc.toml`)
   - Unsupported language/registry combination
   - Git errors (detached HEAD, wrong branch, etc.)

4. **Example improvements:**
   - **Before:** `error: crates token not found`
   - **After:** `Publishing to crates.io requires authentication. Set CRATES_TOKEN env var or configure in ~/.config/pheno/credentials. See pheno login --help for details.`

   - **Before:** `Network error: connection refused`
   - **After:** `Failed to reach crates.io (connection refused). Check your network connection. If using a proxy, set HTTP_PROXY env var. Retry in a few moments.`

   - **Before:** `git status failed`
   - **After:** `Git error: working tree has uncommitted changes. Commit or stash changes before promoting. Run 'git status' to see what's pending.`

5. **Implementation:**
   - Update pheno CLI error handling:
     - Replace generic error messages with detailed ones
     - Add remediation suggestions where applicable
     - Remove stack traces (unless --debug flag)
     - Test error messages on common failure scenarios

6. **Testing:**
   - Test common failure modes:
     - Run pheno without credentials → check error message
     - Run pheno on dirty working tree → check error message
     - Run pheno on wrong branch → check error message
     - Run pheno on unsupported language → check error message
   - Verify error messages are clear and actionable
   - Verify no stack traces in normal mode

7. **Documentation:**
   - Create `docs/troubleshooting.md` with common errors and solutions
   - Link error messages to troubleshooting guide where applicable
   - Example:
     ```
     Error: crates token not found
     See: docs/troubleshooting.md#crates-token-setup
     ```

**Files:**
- Update: pheno CLI error handling (multiple files)
- Create: `docs/troubleshooting.md`
- Create: error message audit spreadsheet (internal reference)

**Parallel?** Yes, after other docs started (T088–T092).

**Notes:**
- This is polish work; not critical for MVP but improves user experience significantly
- Error message quality is often the difference between users trusting a tool or abandoning it
- Test error messages as thoroughly as success cases

---

## Risks & Mitigations

| Risk | Mitigation |
|------|-----------|
| Documentation becomes outdated as pheno evolves | Establish documentation ownership in AGENTS file; quarterly review cycle |
| Users don't find documentation (poor discoverability) | Link from README, CLI help, error messages; consider searchable docs site (wiki, etc.) |
| ADRs become obsolete (decisions change) | Mark ADRs as "Superseded" when needed; link to replacement ADR |
| Error messages still unclear (not caught in audit) | User testing during beta; collect feedback and iterate |
| Governance model too complex for newcomers | Provide simplified quickstart (T090); use T089 for deeper understanding |
| Documentation doesn't match implementation | Keep docs and code in sync; tests verify examples are correct |

## Review Guidance

**Reviewers should verify:**
- [ ] pheno CLI README covers installation, quick start, all commands, config, adapter status (T088)
- [ ] Governance model document explains 5-tier system, risk profiles, promotion flow with diagrams (T089)
- [ ] Contributor quickstart is clear, copy-paste commands work, covers full workflow (T090)
- [ ] ADR 001 (task runner) documents decision, context, consequences, alternatives (T091)
- [ ] ADR 002 (registry adapter) explains architecture and extensibility (T092)
- [ ] Error messages are clear, actionable, no raw stack traces; troubleshooting guide exists (T093)
- [ ] All docs linked from README and discoverable
- [ ] Tone is professional, helpful, non-condescending

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created.
- 2026-03-01T21:41:33Z – wp15-impl – shell_pid=47925 – lane=doing – Assigned agent via workflow command
- 2026-03-01T21:44:53Z – wp15-impl – shell_pid=47925 – lane=for_review – Ready: docs, governance model, error messages
- 2026-03-01T21:45:12Z – wp15-impl – shell_pid=47925 – lane=done – Complete
