# Feature Specification: Org-Wide Release Governance & DX Automation

**Feature Branch**: `002-org-wide-release-governance-dx-automation`
**Created**: 2026-03-01
**Status**: Draft
**Input**: User description: "Org-wide DX infrastructure and release governance automation: GitHub Actions publishing workflows (npm, PyPI, crates.io), pre-commit/pre-push hooks, Taskfile or CLI DX commands, experimental/dev/alpha package variants and release channels following the existing 5-tier release channel governance (alpha → canary → beta → rc → prod) as defined in STACKED_PRS_AND_RELEASE_CHANNELS.md. Should cover all repos in the Phenotype org."

---

## Context

The Phenotype organization maintains ~47 repositories spanning Rust, Python, TypeScript, Go, and Elixir. A comprehensive 5-tier release channel governance model (alpha → canary → beta → rc → prod) already exists as documentation but is only implemented in 3 of 47 repos. Publishing to package registries (npm, PyPI, crates.io) is currently manual. Only 9/47 repos have pre-commit hooks. 31/47 have task runners (Taskfile.yml) but with no standardized target set. There is no cross-repo orchestration CLI and no automated channel promotion workflow.

This feature evolves the existing governance model — keeping all 5 tiers but adapting how repos engage based on risk profile — and codifies it into reusable CI workflows, DX tooling, and automated publishing pipelines across the entire org.

---

## User Scenarios & Testing

### User Story 1 — Developer Publishes a Pre-Release Package (Priority: P1)

A developer working on a Rust crate, Python package, or npm module wants to publish a pre-release variant (e.g., `0.2.0-alpha.1`) to the appropriate registry when their feature reaches the alpha channel. The system automatically versions, builds, and publishes the pre-release artifact when the developer promotes their work to a release channel.

**Why this priority**: Publishing is the core value — every other feature builds on the ability to get packages to registries with correct versioning tied to release channels.

**Independent Test**: A developer tags or promotes a branch to `alpha` and the corresponding package appears on the registry within minutes with the correct pre-release version suffix.

**Acceptance Scenarios**:

1. **Given** a Rust crate at version `0.2.0` on the `alpha` channel, **When** the developer triggers a channel promotion to alpha, **Then** version `0.2.0-alpha.1` is published to crates.io automatically.
2. **Given** a Python package at version `0.3.0` promoted to `beta`, **When** the CI pipeline runs, **Then** version `0.3.0b1` is published to PyPI with the correct PEP 440 pre-release suffix.
3. **Given** an npm package promoted to `canary`, **When** CI completes, **Then** version `0.1.5-canary.1` is published to npm with the `canary` dist-tag.
4. **Given** a package promoted to `prod`, **When** CI completes, **Then** the stable version (no suffix) is published to the registry.
5. **Given** a package marked as private, **When** any promotion occurs, **Then** the publishing step is skipped and no registry upload is attempted.

---

### User Story 2 — Developer Runs Standardized Local DX Commands (Priority: P1)

A developer clones any Phenotype repo and immediately has access to consistent task runner commands for building, testing, linting, and promoting releases — regardless of the repo's language or build system.

**Why this priority**: Tied with publishing — local DX is the daily driver. Without consistent commands, developers waste time learning per-repo idiosyncrasies.

**Independent Test**: Clone any Phenotype repo, run the standard lint/test/build commands, and get correct results without reading repo-specific documentation.

**Acceptance Scenarios**:

1. **Given** a freshly cloned Phenotype repo with the task runner installed, **When** the developer runs the `lint` task, **Then** the appropriate language-specific linter executes and reports results.
2. **Given** any repo, **When** the developer runs the `test` task, **Then** the repo's test suite runs with correct environment setup.
3. **Given** any repo, **When** the developer runs the `build` task, **Then** the project compiles/builds successfully.
4. **Given** a publishable repo, **When** the developer runs the `release:promote <channel>` task, **Then** the promotion workflow initiates with appropriate gate checks.
5. **Given** a repo without a specific task (e.g., Rust repo has no `docs:build`), **When** the developer runs that task, **Then** a clear message indicates the task is not applicable to this repo.

---

### User Story 3 — CI Enforces Channel Promotion Gates (Priority: P2)

When a developer or automation promotes a package from one release channel to the next (e.g., canary → beta), CI automatically validates that all gate requirements for the target channel are met before allowing the promotion.

**Why this priority**: Gates prevent broken or incomplete packages from reaching higher-stability channels. Critical for quality but depends on publishing (P1) working first.

**Independent Test**: Attempt to promote a package that fails a gate requirement and verify it is blocked with clear feedback.

**Acceptance Scenarios**:

1. **Given** a package on the `canary` channel being promoted to `beta`, **When** unit tests pass but integration tests fail, **Then** the promotion is blocked with a report identifying the failing gate.
2. **Given** a package promoted to `rc`, **When** all tests pass but no rollback runbook is attached, **Then** the promotion is blocked until the runbook requirement is satisfied.
3. **Given** a high-risk feature (as classified in the risk matrix), **When** attempting to skip from `alpha` directly to `prod`, **Then** the system rejects the promotion and requires traversal through intermediate channels.
4. **Given** a low-risk utility package, **When** promoted from `alpha` to `prod`, **Then** the system allows the promotion (low-risk packages may skip intermediate channels).
5. **Given** any promotion attempt, **When** the gate check completes, **Then** a structured report is generated showing pass/fail status for each gate criterion.

---

### User Story 4 — Pre-Commit and Pre-Push Hooks Guard Quality (Priority: P2)

Developers have standardized git hooks across all repos that enforce conventional commit messages, run fast lint checks before commit, and validate channel-appropriate constraints before push.

**Why this priority**: Prevents bad commits from entering the pipeline. Dependent on the task runner (P1) for the actual lint/check commands.

**Independent Test**: Make a commit with a non-conventional message and verify it is rejected.

**Acceptance Scenarios**:

1. **Given** a developer staging changes, **When** they commit with a message not following conventional commit format, **Then** the pre-commit hook rejects the commit with a helpful error message showing the expected format.
2. **Given** a developer committing code, **When** the pre-commit hook runs, **Then** fast lint checks (formatting, encoding validation) execute in under 5 seconds.
3. **Given** a developer pushing to a `beta/*` branch, **When** the pre-push hook runs, **Then** the full test suite executes and the push is blocked if tests fail.
4. **Given** a developer pushing to a `feature/*` branch, **When** the pre-push hook runs, **Then** only fast checks run (not the full test suite) to keep the feedback loop quick.

---

### User Story 5 — Phenotype CLI Orchestrates Cross-Repo Operations (Priority: P3)

An org maintainer or release manager uses a dedicated CLI tool to audit release status across all repos, promote packages in bulk, and manage the org-wide release matrix.

**Why this priority**: Cross-repo orchestration is high-value but depends on per-repo publishing and gate infrastructure being in place first.

**Independent Test**: Run the CLI's status audit command and get a complete view of all packages, their current channels, and any blocked promotions.

**Acceptance Scenarios**:

1. **Given** the Phenotype CLI installed, **When** the maintainer runs the release status command, **Then** a table shows every publishable package, its current channel, version, and registry status.
2. **Given** multiple repos with packages ready for promotion, **When** the maintainer runs a bulk promote command for a specific channel, **Then** each package is promoted individually with its own gate checks, and a summary report is generated.
3. **Given** a package with a failed gate check, **When** the maintainer runs the audit command, **Then** the blocked package is highlighted with the specific failing gate and remediation guidance.
4. **Given** the release matrix template, **When** the maintainer runs the matrix generation command, **Then** a current-state release matrix is generated matching the format defined in the governance documentation.

---

### User Story 6 — Repo Adopts Governance via Single Command (Priority: P3)

A developer or agent onboarding a new repo (or upgrading an existing one) runs a single bootstrap command that installs the task runner config, pre-commit hooks, CI workflows, and release channel configuration appropriate to the repo's language and risk profile.

**Why this priority**: Adoption at scale requires frictionless onboarding. Without this, the 47-repo rollout would be manual and error-prone.

**Independent Test**: Run the bootstrap command on a bare repo and verify all governance artifacts are created correctly.

**Acceptance Scenarios**:

1. **Given** a Rust repo with no governance artifacts, **When** the developer runs the bootstrap command, **Then** the task runner config, pre-commit hooks, CI workflows, and release channel config are generated for Rust conventions.
2. **Given** a Python repo, **When** bootstrapped, **Then** the generated artifacts use Python-appropriate tooling (PyPI publishing, Python linters, PEP 440 versioning).
3. **Given** a multi-language repo (e.g., Rust + Python FFI), **When** bootstrapped, **Then** artifacts for all detected languages are generated with appropriate per-language publishing targets.
4. **Given** a private repo (not published to any registry), **When** bootstrapped, **Then** publishing workflows are omitted but lint/test/hook infrastructure is still installed.

---

### Edge Cases

- What happens when a registry is unreachable during automated publishing? The workflow retries with exponential backoff and alerts the maintainer after 3 failures.
- What happens when crates.io rate-limits publishing? The workflow queues remaining publishes with appropriate delays and resumes automatically.
- What happens when a workspace has interdependent packages? Publishing follows topological dependency order (leaf crates first).
- What happens when a pre-release version already exists on the registry? The version number auto-increments the pre-release suffix (e.g., `alpha.1` → `alpha.2`).
- What happens when a repo has no `main` branch? The bootstrap command detects the default branch and adapts accordingly.
- What happens when two developers promote the same package concurrently? The CI pipeline uses locking/serialization to prevent race conditions.

---

## Requirements

### Functional Requirements

**Automated Publishing**

- **FR-001**: System MUST publish packages to their respective registries (npm, PyPI, crates.io) when a release channel promotion occurs.
- **FR-002**: System MUST apply correct pre-release version suffixes per registry convention: SemVer pre-release for npm/crates.io (`-alpha.N`), PEP 440 for PyPI (`aN`, `bN`, `rcN`).
- **FR-003**: System MUST support all public packages for pre-release variant publishing from day one, regardless of maturity level.
- **FR-004**: System MUST skip publishing for packages marked as private.
- **FR-005**: System MUST publish workspace/monorepo packages in topological dependency order.
- **FR-006**: System MUST handle registry rate limits with automatic retry and backoff.
- **FR-007**: System MUST prevent publishing from dirty working trees — all automation publishes from clean, committed state only.

**Release Channel Governance**

- **FR-008**: System MUST implement the 5-tier release channel model: alpha → canary → beta → rc → prod.
- **FR-009**: System MUST enforce risk-based channel traversal: high-risk features traverse canary → beta → rc minimum; low-risk features may skip intermediate channels.
- **FR-010**: System MUST enforce per-channel gate criteria before allowing promotion (lint, tests, security, docs, rollback plan as applicable per channel).
- **FR-011**: System MUST generate structured promotion reports showing pass/fail status for each gate criterion.
- **FR-012**: System MUST support the stacked PR model with dependency-ordered merge chains.

**DX Tooling — Per-Repo Task Runner**

- **FR-013**: System MUST provide standardized task runner targets across all repos: `lint`, `test`, `build`, `format`, `release:promote`, `release:status`.
- **FR-014**: System MUST evaluate and adopt the best modern task runner for a polyglot org (candidates: mise, just, or alternatives based on 2026 ecosystem evaluation), replacing current fragmented usage.
- **FR-015**: System MUST auto-detect the repo's language(s) and configure language-appropriate tooling behind the standard task names.

**DX Tooling — Phenotype CLI**

- **FR-016**: System MUST provide a CLI tool for cross-repo operations: audit release status, bulk promote, generate release matrix, bootstrap repos.
- **FR-017**: System MUST support a bootstrap command that installs all governance artifacts (task runner config, hooks, CI workflows, release config) for a given repo based on detected language and risk profile.

**Git Hooks**

- **FR-018**: System MUST provide pre-commit hooks that enforce conventional commit message format and run fast lint/format checks.
- **FR-019**: System MUST provide pre-push hooks that run channel-appropriate validation (fast checks for feature branches, full test suite for beta+ branches).
- **FR-020**: Pre-commit hooks MUST complete in under 5 seconds for typical commits.

**CI/CD Workflows**

- **FR-021**: System MUST provide reusable CI workflow templates that repos can adopt via the bootstrap command.
- **FR-022**: System MUST run the complete gate checklist (lint, format, unit tests, integration tests, dependency checks, docs build, security checks) as defined in the existing governance documentation.
- **FR-023**: System MUST support both automatic (tag/branch-based) and manual (workflow dispatch) promotion triggers.

### Key Entities

- **Package**: A publishable unit (crate, Python package, or npm module) with a name, version, registry target, and privacy flag.
- **Release Channel**: One of the 5 tiers (alpha, canary, beta, rc, prod) with associated gate criteria and version suffix conventions.
- **Risk Profile**: Classification of a package or feature as low, medium, or high risk, determining minimum channel traversal requirements.
- **Gate Criterion**: A specific check (lint, test, security, rollback plan, etc.) required for promotion to a given channel.
- **Promotion**: The act of advancing a package from one release channel to the next, subject to gate validation.
- **Release Matrix**: An org-wide view of all packages, their current channels, versions, and promotion status.

---

## Assumptions

- All repos will eventually adopt the standardized tooling; rollout may be phased but the target is 100% coverage.
- The existing governance documentation (STACKED_PRS_AND_RELEASE_CHANNELS.md) is the authoritative source for channel definitions and gate criteria.
- Registry credentials (npm tokens, PyPI tokens, crates.io tokens) will be stored as GitHub organization secrets, not per-repo.
- The Phenotype CLI will be a standalone tool distributed via one of the supported registries.
- Repos currently using Taskfile.yml will be migrated to the chosen task runner; backward compatibility is not required.
- The task runner evaluation will be finalized during the design phase based on 2026 ecosystem state.
- git-cliff will remain the changelog generation tool (already proven in 3 repos).

---

## Success Criteria

### Measurable Outcomes

- **SC-001**: 100% of public packages can be published to their respective registries via automated CI workflow within 10 minutes of a channel promotion trigger.
- **SC-002**: Pre-release versions for all 5 channels are correctly formatted and accepted by their respective registries on first attempt.
- **SC-003**: Any developer can clone a Phenotype repo and run `lint`, `test`, `build` successfully within 2 minutes of setup, across all 47 repos.
- **SC-004**: Channel promotion gate checks block 100% of promotions that fail mandatory criteria, with zero false negatives.
- **SC-005**: Pre-commit hooks reject non-conventional commit messages 100% of the time and complete in under 5 seconds.
- **SC-006**: A new repo can be fully bootstrapped with all governance artifacts in under 1 minute via a single command.
- **SC-007**: The org-wide release status audit provides a complete view of all publishable packages and their channel status in under 30 seconds.
- **SC-008**: Reduction in manual publishing errors to zero — no more dirty-tree publishes, no more rate-limit surprises, no more missed dependency ordering.
