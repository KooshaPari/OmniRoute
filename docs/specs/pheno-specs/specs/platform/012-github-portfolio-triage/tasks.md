# Work Packages: GitHub Portfolio Triage — Archive, Consolidate, Catalog

**Inputs**: Design documents from `kitty-specs/012-github-portfolio-triage/`
**Prerequisites**: spec.md, GitHub API access, portfolio inventory data
**Scope**: Shelf-level (cross-repo) — 226 repositories → ~170

---

## WP-001: Archive 25 Single-Commit Stub Repos

- **State:** planned
- **Sequence:** 1
- **File Scope:** 25 GitHub repos (phenotype-rust-*, phenotype-*-sdk, etc.)
- **Acceptance Criteria:**
  - All 25 stub repos archived via GitHub API with confirmation
  - Each archived repo has a README noting archival date, rationale, and successor repo
  - Portfolio manifest updated with archived status for all 25 repos
  - No CI/CD pipelines fire for archived repos
  - Security scanning alerts suppressed for archived repos
- **Estimated Effort:** M

Archive all 25 single-commit placeholder repositories that were created as stubs but never developed. Each repo receives an archival README documenting why it was archived and which active repo now provides the intended functionality. The GitHub API is used for bulk archival with rate-limit handling. A verification step confirms each repo shows as archived in the GitHub UI and API.

### Subtasks
- [ ] T001 Query GitHub API for all 25 stub repos to confirm current state (commit count, last activity)
- [ ] T002 Create archival README template with fields: archival_date, rationale, successor_repo, contact
- [ ] T003 Archive phenotype-rust-core, phenotype-rust-ffi, phenotype-rust-wasm, phenotype-rust-async, phenotype-rust-cli
- [ ] T004 Archive phenotype-go-sdk, phenotype-python-sdk, phenotype-node-sdk
- [ ] T005 Archive phenotype-rust-macros, phenotype-rust-proto, phenotype-rust-test, phenotype-rust-bench, phenotype-rust-docs
- [ ] T006 Archive phenotype-rust-auth, phenotype-rust-config, phenotype-rust-logging, phenotype-rust-metrics, phenotype-rust-tracing
- [ ] T007 Archive phenotype-rust-health, phenotype-rust-policy, phenotype-rust-cache, phenotype-rust-events, phenotype-rust-state, phenotype-rust-errors, phenotype-rust-shared
- [ ] T008 Verify all 25 repos show as archived via GitHub API
- [ ] T009 Update portfolio manifest with archived status and successor mappings
- [ ] T010 Confirm CI/CD pipelines and security scans are suppressed for archived repos

### Dependencies
- None (starting WP for this spec)

### Risks & Mitigations
- Accidental archival of active repo: Manual verification of commit count (must be 1) before each archival
- GitHub API rate limits: Batch operations with 1-second delays between requests

---

## WP-002: Archive ~15 Legacy Odin Projects

- **State:** planned
- **Sequence:** 2
- **File Scope:** ~15 GitHub repos (odin-*)
- **Acceptance Criteria:**
  - All ~15 Odin legacy repos archived via GitHub API
  - Migration notes document which modern repo replaces each Odin project
  - Portfolio manifest updated with archival records
  - No broken references in active tooling to archived Odin repos
- **Estimated Effort:** M

Archive approximately 15 legacy Odin projects that are obsolete and no longer relevant to the current Rust/TypeScript/Python technology stack. Each archived repo includes migration notes identifying the modern replacement. Cross-reference with active repos to ensure no tooling depends on these legacy projects.

### Subtasks
- [ ] T011 Inventory all odin-* repos with metadata (last commit, size, language breakdown)
- [ ] T012 Map each Odin project to its modern replacement (Authvault, Temporal, heliosCLI, etc.)
- [ ] T013 Archive odin-auth-service, odin-api-gateway, odin-user-service, odin-notification-service, odin-scheduler
- [ ] T014 Archive odin-data-pipeline, odin-config-server, odin-service-mesh, odin-monitoring, odin-cli-tool
- [ ] T015 Archive odin-web-framework, odin-template-service, odin-event-bus, odin-cache-layer, odin-policy-engine
- [ ] T016 Add migration notes to each archived repo README
- [ ] T017 Audit active repos for imports/references to archived Odin repos
- [ ] T018 Update portfolio manifest with Odin archival records and migration paths

### Dependencies
- WP-001 (archive process established, portfolio manifest template in use)

### Risks & Mitigations
- Active code references Odin repos: Audit step (T017) catches these before archival
- Stakeholder disagreement on archival: Clear rationale documentation per repo, appeal process available

---

## WP-003: Clean Up 2 Orphaned DB Entries

- **State:** planned
- **Sequence:** 3
- **File Scope:** AgilePlus database, portfolio tracking system
- **Acceptance Criteria:**
  - DB-0047 (phenotype-legacy-adapter) removed from database
  - DB-0089 (odin-migration-tool) removed from database
  - No dependent systems break after cleanup
  - Cleanup logged in audit trail with rationale
- **Estimated Effort:** S

Remove two orphaned database entries that reference non-existent repositories. DB-0047 references phenotype-legacy-adapter (deleted), and DB-0089 references odin-migration-tool (archived and deleted). Test cleanup in staging first, then apply to production with audit logging.

### Subtasks
- [ ] T019 Locate DB-0047 and DB-0089 in the portfolio tracking database
- [ ] T020 Document all foreign key relationships and dependent records for both entries
- [ ] T021 Test removal in staging environment, verify no cascade failures
- [ ] T022 Remove DB-0047 (phenotype-legacy-adapter) from production database
- [ ] T023 Remove DB-0089 (odin-migration-tool) from production database
- [ ] T024 Verify automated tooling that queries portfolio no longer errors on missing repos
- [ ] T025 Log cleanup actions in audit trail with rationale and timestamps

### Dependencies
- WP-002 (Odin archival complete, confirms odin-migration-tool status)

### Risks & Mitigations
- DB cleanup breaks dependent systems: Staging test (T021) validates before production
- Orphaned child records: Document relationships (T020) and clean up cascading records

---

## WP-004: Create Consolidated Repo Inventory and Update Documentation

- **State:** planned
- **Sequence:** 4
- **File Scope:** Portfolio manifest, AgilePlus documentation, cross-repo references
- **Acceptance Criteria:**
  - Comprehensive portfolio manifest covering all ~170 remaining repos
  - Each repo documented with: name, language, status (active/archived), purpose, owner
  - Archived repos section with rationale and successor mappings
  - Triage policy documented for ongoing maintenance
  - All internal tooling references updated to reflect new portfolio state
- **Estimated Effort:** M

Produce the final deliverable: a comprehensive portfolio manifest documenting every repository's status after triage. This includes the reduced active portfolio (~170 repos), the archived repo catalog with rationale, and a triage policy to prevent future accumulation. Update all internal tooling that references the portfolio.

### Subtasks
- [ ] T026 Generate complete repo inventory from GitHub API (all repos with metadata)
- [ ] T027 Classify each repo: active, archived (stub), archived (legacy), or unknown
- [ ] T028 Build portfolio manifest with sections: active repos, archived stubs, archived legacy, unknown
- [ ] T029 Document triage policy: criteria for archival, review cadence, stakeholder approval process
- [ ] T030 Update AgilePlus documentation with new portfolio state
- [ ] T031 Audit internal tooling (CI configs, monitoring, dashboards) for references to archived repos
- [ ] T032 Update tooling configs to exclude archived repos from scans and alerts
- [ ] T033 Final verification: portfolio count matches target (~170), all archival confirmed, docs complete

### Dependencies
- WP-001 (stub repos archived)
- WP-002 (Odin repos archived)
- WP-003 (DB entries cleaned up)

### Risks & Mitigations
- Incomplete inventory: GitHub API pagination handled with full iteration
- Tooling references missed: Systematic audit of CI configs, monitoring, and dashboard definitions

---

## Dependency & Execution Summary

```
WP-001 (Archive 25 stub repos) ────── first, no deps
WP-002 (Archive ~15 Odin projects) ── depends on WP-001 (process established)
WP-003 (Clean up 2 orphaned DB entries) ── depends on WP-002 (Odin status confirmed)
WP-004 (Consolidated inventory + docs) ── depends on WP-001, WP-002, WP-003
```

**Parallelization**: WP-001 and WP-002 can run in parallel after the archival process is established. WP-003 can start independently of WP-001/WP-002. WP-004 is the final integration step.

**MVP Scope**: WP-001 alone reduces portfolio by 25 repos and establishes the archival process.
