# Work Packages: phenotype-infrakit Stabilization — Consolidate 19 Infrastructure Crates

**Inputs**: Design documents from `kitty-specs/013-phenotype-infrakit-stabilization/`
**Prerequisites**: spec.md, access to all 19 crate repositories, Rust toolchain
**Scope**: phenotype-infrakit workspace (Rust) + related Python/TypeScript/Zig crates

---

## WP-001: Audit All 19 Infrastructure Crates — Categorize Production-Ready vs Stubs

- **State:** planned
- **Sequence:** 1
- **File Scope:** 19 crate repositories (phenotype-go-kit, phenotype-config, phenotype-shared, phenotype-gauge, phenotype-nexus, phenotype-forge, phenotype-cipher, phenotype-xdd-lib, Authvault, Tokn, Zerokit, PolicyStack, Quillr, Httpora, Apisync, phenotype-cli-core, phenotype-middleware-py, phenotype-logging-zig, phenotype-auth-ts)
- **Acceptance Criteria:**
  - Audit report for all 19 crates with: API surface size, test coverage %, documentation quality, dependency count, maturity rating
  - Each crate categorized: production-ready, needs-stabilization, or stub/deprecate
  - Dependency graph mapping all inter-crate and external dependencies
  - Language fit assessment for Zig and Python crates
  - Duplicated functionality matrix identifying overlapping concerns
- **Estimated Effort:** M

Conduct a comprehensive audit of all 19 infrastructure crates across Rust, Python, TypeScript, and Zig ecosystems. Each crate is evaluated for API stability, test coverage, documentation quality, and maturity. The audit produces a categorized inventory and identifies duplicated functionality for consolidation planning.

### Subtasks
- [ ] T001 Clone all 19 crate repositories and verify buildability
- [ ] T002 Measure API surface for each crate (public types, functions, traits)
- [ ] T003 Run test coverage analysis on all crates (cargo tarpaulin for Rust, pytest-cov for Python, etc.)
- [ ] T004 Assess documentation quality: README completeness, rustdoc coverage, examples
- [ ] T005 Map dependency graph: internal (between crates) and external (third-party)
- [ ] T006 Identify duplicated functionality: config, auth, logging, metrics, error handling
- [ ] T007 Assess language fit for phenotype-logging-zig (Zig) and phenotype-middleware-py (Python)
- [ ] T008 Categorize each crate: production-ready, needs-stabilization, or stub/deprecate
- [ ] T009 Produce audit report with findings, recommendations, and consolidation roadmap

### Dependencies
- None (starting WP for this spec)

### Risks & Mitigations
- Some crates may not build: Document build failures separately, do not block audit
- Incomplete test coverage data: Use multiple tools (tarpaulin, llvm-cov) for cross-validation

---

## WP-002: phenotype-infrakit Workspace Consolidation — Merge Scattered Crates

- **State:** planned
- **Sequence:** 2
- **File Scope:** phenotype-infrakit workspace (root Cargo.toml), all 19 crate source trees
- **Acceptance Criteria:**
  - Unified Cargo workspace with all Rust crates as members
  - Workspace-level dependency management in root Cargo.toml
  - phenotype-shared merged into phenotype-contracts (no duplicate types)
  - PolicyStack merged into phenotype-policy-engine (single policy crate)
  - All crates build successfully within workspace (`cargo build --workspace`)
  - Zero clippy warnings across all crates (`cargo clippy --workspace -- -D warnings`)
- **Estimated Effort:** L

Consolidate all Rust infrastructure crates into a single phenotype-infrakit workspace. This involves restructuring the crate layout, merging duplicate crates (phenotype-shared → phenotype-contracts, PolicyStack → phenotype-policy-engine), establishing workspace-level dependency management, and ensuring all crates build cleanly together.

### Subtasks
- [ ] T010 Design unified workspace structure: crate grouping, feature flags, dependency versions
- [ ] T011 Create root Cargo.toml with workspace members and shared dependency versions
- [ ] T012 Migrate phenotype-config into workspace with existing tests and docs
- [ ] T013 Migrate phenotype-gauge, phenotype-nexus, phenotype-forge into workspace
- [ ] T014 Migrate phenotype-cipher, Authvault, Tokn, Zerokit into workspace
- [ ] T015 Merge phenotype-shared into phenotype-contracts: reconcile types, remove duplicates
- [ ] T016 Merge PolicyStack into phenotype-policy-engine: unify policy evaluation logic
- [ ] T017 Migrate Quillr, Httpora, Apisync, phenotype-cli-core into workspace
- [ ] T018 Establish consistent error handling patterns across all crates (thiserror with #[from])
- [ ] T019 Run `cargo build --workspace` and fix all compilation errors
- [ ] T020 Run `cargo clippy --workspace -- -D warnings` and fix all warnings
- [ ] T021 Run `cargo fmt --check` and fix all formatting issues

### Dependencies
- WP-001 (audit complete, consolidation targets identified)

### Risks & Mitigations
- Breaking changes during merge: Careful type reconciliation, deprecation periods for renamed types
- Dependency version conflicts: Workspace-level version pinning resolves conflicts

---

## WP-003: Stabilize API Surfaces — Add Tests, Docs, Version Pinning

- **State:** planned
- **Sequence:** 3
- **File Scope:** All workspace crates (public API surfaces), test modules, documentation
- **Acceptance Criteria:**
  - All public types implement Debug and Clone where practical
  - No `impl Trait` in public APIs unless necessary and documented
  - ≥80% test coverage across all crates
  - Comprehensive rustdoc for all public items
  - Semver version pins for all crates (0.1.0 initial stable release)
  - All quality checks passing: clippy, tests, fmt
- **Estimated Effort:** L

Stabilize the API surfaces of all consolidated crates. This includes adding missing test coverage, writing comprehensive documentation, enforcing type constraints (Debug, Clone), and establishing semver versioning discipline. Each crate receives a stable API contract that downstream consumers can rely on.

### Subtasks
- [ ] T022 Audit public APIs: enforce Debug + Clone, remove unnecessary impl Trait
- [ ] T023 Write unit tests for phenotype-config (target: ≥80% coverage)
- [ ] T024 Write unit tests for phenotype-cipher, Authvault, Tokn (crypto/auth crates, target: ≥90%)
- [ ] T025 Write unit tests for phenotype-gauge, phenotype-nexus, phenotype-forge
- [ ] T026 Write unit tests for Quillr, Httpora, Apisync, phenotype-cli-core
- [ ] T027 Write integration tests for cross-crate interactions
- [ ] T028 Add rustdoc for all public items with examples
- [ ] T029 Create API stability guarantees document per crate
- [ ] T030 Set semver versions: 0.1.0 for initial stable release, CHANGELOG.md per crate
- [ ] T031 Run `cargo test --workspace` and verify all tests pass
- [ ] T032 Verify ≥80% test coverage with cargo tarpaulin

### Dependencies
- WP-002 (workspace consolidation complete, all crates building together)

### Risks & Mitigations
- Test coverage gaps in complex crates: Prioritize crypto/auth crates (≥90%), accept lower for utility crates
- API instability: Document breaking changes in CHANGELOG, use deprecation attributes

---

## WP-004: Publish to crates.io/PyPI/npm — Set Up CI/CD for Publishing

- **State:** planned
- **Sequence:** 4
- **File Scope:** CI/CD configurations, crate publish scripts, registry configurations
- **Acceptance Criteria:**
  - All Rust crates published to crates.io with correct metadata
  - phenotype-middleware-py published to PyPI
  - phenotype-auth-ts published to npm
  - CI/CD pipeline automates publish on version tag
  - Published packages installable and functional
  - Phenotype org credentials configured securely in CI
- **Estimated Effort:** M

Publish all stabilized crates to their respective package registries. Rust crates go to crates.io, the Python crate to PyPI, and the TypeScript crate to npm. CI/CD pipelines are configured to automate publishing on version tags, with proper credential management and verification steps.

### Subtasks
- [ ] T033 Configure crates.io API token in CI secrets for Phenotype org
- [ ] T034 Add publish metadata to each Rust crate: license, repository, documentation, keywords
- [ ] T035 Publish phenotype-contracts, phenotype-config, phenotype-cipher to crates.io
- [ ] T036 Publish Authvault, Tokn, Zerokit, phenotype-gauge to crates.io
- [ ] T037 Publish phenotype-nexus, phenotype-forge, Httpora, Apisync to crates.io
- [ ] T038 Publish Quillr, phenotype-cli-core, phenotype-policy-engine to crates.io
- [ ] T039 Configure PyPI API token and publish phenotype-middleware-py
- [ ] T040 Configure npm token and publish phenotype-auth-ts
- [ ] T041 Set up CI/CD publish pipeline: trigger on version tag, run tests, then publish
- [ ] T042 Verify all published packages install correctly in fresh environments
- [ ] T043 Evaluate phenotype-logging-zig (Zig): decide publish to Zig package registry or deprecate

### Dependencies
- WP-003 (API surfaces stabilized, tests passing, versions set)

### Risks & Mitigations
- Registry name conflicts: Check name availability early, reserve names if needed
- CI credential exposure: Use encrypted secrets, scoped tokens with minimal permissions

---

## WP-005: Cross-Crate Dependency Audit and Deduplication

- **State:** planned
- **Sequence:** 5
- **File Scope:** All workspace Cargo.toml files, phenotype-middleware-py pyproject.toml, phenotype-auth-ts package.json
- **Acceptance Criteria:**
  - Zero duplicate dependencies across crates (shared via workspace-level deps)
  - Dependency tree audited for security vulnerabilities (cargo audit, npm audit, pip-audit)
  - No circular dependencies between crates
  - MSRV (Minimum Supported Rust Version) documented and tested in CI
  - Dependency update policy documented
- **Estimated Effort:** S

Perform a final cross-crate dependency audit to eliminate duplication, resolve security vulnerabilities, and establish dependency management policies. This ensures the workspace is clean, secure, and maintainable before the initial stable release.

### Subtasks
- [ ] T044 Audit workspace dependency tree: identify duplicates, version conflicts
- [ ] T045 Consolidate shared dependencies to workspace-level [workspace.dependencies]
- [ ] T046 Run cargo audit for Rust security vulnerabilities, fix or document acceptances
- [ ] T047 Run pip-audit for Python dependencies, fix vulnerabilities
- [ ] T048 Run npm audit for TypeScript dependencies, fix vulnerabilities
- [ ] T049 Verify no circular dependencies between crates
- [ ] T050 Document MSRV and add CI check for minimum supported Rust version
- [ ] T051 Create dependency update policy: cadence, review process, breaking change handling
- [ ] T052 Final quality gate: `cargo test --workspace`, `cargo clippy --workspace -- -D warnings`, `cargo fmt --check`

### Dependencies
- WP-004 (all crates published, dependency tree stable)

### Risks & Mitigations
- Security vulnerabilities in transitive deps: Document acceptances for unfixable, plan upgrades
- Breaking dependency updates: Pin versions, test upgrades in isolated branch

---

## Dependency & Execution Summary

```
WP-001 (Audit 19 crates) ───────────── first, no deps
WP-002 (Workspace consolidation) ────── depends on WP-001
WP-003 (Stabilize APIs + tests) ─────── depends on WP-002
WP-004 (Publish to registries) ──────── depends on WP-003
WP-005 (Dependency audit + dedup) ───── depends on WP-004
```

**Parallelization**: Strictly sequential — each WP builds on the previous. WP-002 crate migrations (T012-T017) can be parallelized across different crate groups.

**MVP Scope**: WP-001 + WP-002 produces a consolidated workspace. WP-003 adds tests and docs for stability.
