---
work_package_id: WP04
title: Domain Model — Governance & Audit
lane: "done"
dependencies:
- WP03
base_branch: 001-spec-driven-development-engine-WP01
base_commit: 2b52a5788fccbf64376696c76a8460fb630a4032
created_at: '2026-02-28T09:22:19.192831+00:00'
subtasks:
- T018
- T019
- T020
- T021
- T022
- T023
- T024
- T024b
- T024c
- T024d
phase: Phase 1 - Domain
assignee: ''
agent: "claude-wp04"
shell_pid: "29799"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP04 -- Domain Model: Governance & Audit

## IMPORTANT: Review Feedback Status

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_status` field above. If it says `has_feedback`, scroll to the **Review Feedback** section immediately.
- **You must address all feedback** before your work is complete.
- **Mark as acknowledged**: Update `review_status: acknowledged` when you begin addressing feedback.
- **Report progress**: Update the Activity Log as you address each item.

---

## Review Feedback

> **Populated by `/spec-kitty.review`** -- Reviewers add detailed feedback here when work needs changes.

*[This section is empty initially.]*

---

## Markdown Formatting
Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`, ````bash`

---

## Implementation Command

```bash
spec-kitty implement WP04 --base WP03
```

---

## Objectives & Success Criteria

1. **GovernanceContract struct complete**: Versioned rules, bound to features, immutable once created, with JSON rule schema matching data-model.md.
2. **AuditEntry with hash chain**: SHA-256 hash chain where each entry's `prev_hash` links to the previous entry's `hash`. Genesis entry uses all-zeros prev_hash.
3. **hash_entry() deterministic**: Given identical inputs, always produces the same hash. Field ordering is fixed: `id || timestamp || actor || transition || evidence_refs || prev_hash`.
4. **verify_chain() correct**: Sequential scan detects any tampered entry; returns `Ok(count)` for valid chain or `Err` with first invalid entry ID.
5. **Evidence struct complete**: Links functional requirements (FR IDs) to artifact paths, with type classification.
6. **PolicyRule evaluates**: Domain-based rules (quality/security/reliability) can be evaluated against evidence to produce pass/fail.
7. **Unit tests exhaustive**: 25+ tests covering chain integrity, tamper detection, evidence linking, policy evaluation, and edge cases.

---

## Context & Constraints

### Reference Documents
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- AuditEntry (lines 149-166), GovernanceContract (lines 126-148), Evidence (lines 168-182), PolicyRule (lines 184-197)
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- Audit chain design (lines 213-224), governance contract model
- **Spec**: `kitty-specs/001-spec-driven-development-engine/spec.md` -- FR-016 (hash-chained audit), FR-018 (governance contracts), FR-020 (policy rules), FR-021 (evidence linking)

### Architectural Constraints
- **Pure domain logic**: Lives in `agileplus-core`. No I/O, no file access, no database calls.
- **sha2 crate**: Use `sha2::Sha256` for all hashing. No custom crypto.
- **Deterministic hashing**: The hash function must produce identical output across platforms, Rust versions, and serialization contexts. Use byte concatenation with fixed separators, NOT serde_json serialization (JSON key ordering is not guaranteed).
- **Immutable contracts**: A `GovernanceContract` cannot be modified after `bound_at` is set. New versions create new records.
- **serde_json for rules**: The `rules` field in GovernanceContract is stored as `serde_json::Value` for flexibility, but validated against a schema at bind time.

### Dependency on WP03
- WP03 provides `Feature`, `FeatureState`, `StateTransition`, `WorkPackage`, and `WpState` types.
- `AuditEntry.transition` uses the `StateTransition` type from WP03.
- `Evidence.wp_id` references `WorkPackage.id` from WP03.
- `GovernanceContract.feature_id` references `Feature.id` from WP03.

---

## Subtasks & Detailed Guidance

### Subtask T018 -- Implement `GovernanceContract` struct with versioned rules (FR-018)

- **Purpose**: Define the governance contract that specifies what evidence is required for each state transition. Contracts are versioned and immutable -- once bound to a feature, they cannot be changed. New rules require a new version.
- **Steps**:
  1. Open `crates/agileplus-core/src/domain/governance.rs` (stub from WP01).
  2. Implement `GovernanceContract`:
     ```rust
     use chrono::{DateTime, Utc};
     use serde::{Deserialize, Serialize};
     use serde_json::Value;

     /// Governance contract defining evidence requirements for state transitions.
     /// Immutable once bound (new versions create new records).
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct GovernanceContract {
         pub id: i64,
         pub feature_id: i64,
         pub version: i32,
         pub rules: Vec<GovernanceRule>,
         pub bound_at: DateTime<Utc>,
     }
     ```
  3. Define `GovernanceRule`:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct GovernanceRule {
         /// The state transition this rule applies to (e.g., "implementing -> validated").
         pub transition: String,
         /// Evidence requirements that must be satisfied.
         pub required_evidence: Vec<EvidenceRequirement>,
         /// References to policy rules that must pass.
         pub policy_refs: Vec<String>,
     }

     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct EvidenceRequirement {
         /// Functional requirement ID (e.g., "FR-001").
         pub fr_id: String,
         /// Required evidence type.
         pub evidence_type: EvidenceType,
         /// Type-specific threshold (e.g., min_coverage for test_result).
         pub threshold: Option<Value>,
     }
     ```
  4. Implement `GovernanceContract::new()` constructor.
  5. Implement `GovernanceContract::validate_rules(&self) -> Result<(), DomainError>`:
     - Check that all transitions reference valid `FeatureState` pairs
     - Check that evidence types are valid enum variants
     - Check that policy_refs are non-empty strings
  6. Implement `GovernanceContract::rules_for_transition(&self, transition: &StateTransition) -> Vec<&GovernanceRule>`:
     - Returns all rules applicable to a given transition
     - Used by the validate command to check evidence completeness
- **Files**: `crates/agileplus-core/src/domain/governance.rs`
- **Parallel?**: Yes -- can run alongside T019-T021 (audit chain). Both start from WP03 types.
- **Validation**: Contract can be created, rules validated, rules queried by transition.
- **Notes**: The `rules` field uses structured Rust types (not raw `serde_json::Value`) for type safety. The data-model.md shows JSON storage, but in Rust domain code we use typed structs. Serde handles the JSON conversion for storage. The `threshold` field remains as `Value` since it varies by evidence type.

### Subtask T019 -- Implement `AuditEntry` struct with SHA-256 hash chain (FR-016)

- **Purpose**: Define the immutable audit entry that records every state transition. Entries form a hash chain where each entry includes the hash of the previous entry, creating a tamper-evident log.
- **Steps**:
  1. Open `crates/agileplus-core/src/domain/audit.rs` (stub from WP01).
  2. Implement `AuditEntry`:
     ```rust
     use chrono::{DateTime, Utc};
     use serde::{Deserialize, Serialize};

     /// Immutable audit entry forming a hash-chained log.
     /// Each entry's hash covers its own fields + the previous entry's hash.
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct AuditEntry {
         /// Sequential ID (auto-increment).
         pub id: i64,
         /// Related feature.
         pub feature_id: i64,
         /// Related work package (None for feature-level transitions).
         pub wp_id: Option<i64>,
         /// UTC timestamp of the event.
         pub timestamp: DateTime<Utc>,
         /// Actor identifier: "user", "agent:claude-code", "agent:codex", "system".
         pub actor: String,
         /// State transition description (e.g., "specified -> researched").
         pub transition: String,
         /// References to evidence records backing this transition.
         pub evidence_refs: Vec<EvidenceRef>,
         /// SHA-256 hash of the previous entry (all zeros for genesis).
         pub prev_hash: [u8; 32],
         /// SHA-256 hash of this entry's contents.
         pub hash: [u8; 32],
     }

     /// Lightweight reference to an evidence record.
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct EvidenceRef {
         pub evidence_id: i64,
         pub fr_id: String,
     }
     ```
  3. Implement `AuditEntry::genesis(feature_id: i64, actor: &str) -> Self`:
     - Creates the first entry in a chain
     - `prev_hash` is `[0u8; 32]`
     - `transition` is `"genesis"`
     - Hash is computed via `hash_entry()` (T020)
  4. Implement `AuditEntry::new(...)` that takes all fields except `hash` and computes it.
  5. Implement custom `PartialEq` that compares by `hash` only (hash equality implies content equality).
- **Files**: `crates/agileplus-core/src/domain/audit.rs`
- **Parallel?**: Yes -- can run alongside T018 (governance). Both build on WP03 types independently.
- **Validation**: Genesis entry has zero prev_hash; regular entries link to previous; hash is 32 bytes.
- **Notes**: The `[u8; 32]` type for hashes requires a custom serde serializer for JSON representation (hex string). Implement `mod hex_bytes { ... }` with `#[serde(with = "hex_bytes")]`. The `evidence_refs` field is a Vec, not a JSON string -- serde serializes it to JSON for storage automatically.

### Subtask T020 -- Implement `hash_entry()` function: SHA-256(id + timestamp + actor + transition + evidence_refs + prev_hash)

- **Purpose**: The deterministic hash function that creates the chain links. Correctness here is paramount -- any deviation means chain verification will fail.
- **Steps**:
  1. In `audit.rs`, implement the hash function:
     ```rust
     use sha2::{Sha256, Digest};

     /// Compute SHA-256 hash for an audit entry.
     /// Input: id || timestamp || actor || transition || evidence_refs || prev_hash
     /// Fields are separated by 0x00 bytes to prevent ambiguity.
     pub fn hash_entry(
         id: i64,
         timestamp: &DateTime<Utc>,
         actor: &str,
         transition: &str,
         evidence_refs: &[EvidenceRef],
         prev_hash: &[u8; 32],
     ) -> [u8; 32] {
         let mut hasher = Sha256::new();

         // Fixed-format fields with null byte separators
         hasher.update(id.to_be_bytes());
         hasher.update(b"\x00");
         hasher.update(timestamp.to_rfc3339().as_bytes());
         hasher.update(b"\x00");
         hasher.update(actor.as_bytes());
         hasher.update(b"\x00");
         hasher.update(transition.as_bytes());
         hasher.update(b"\x00");

         // Evidence refs: sorted by evidence_id for determinism
         let mut sorted_refs = evidence_refs.to_vec();
         sorted_refs.sort_by_key(|r| r.evidence_id);
         for eref in &sorted_refs {
             hasher.update(eref.evidence_id.to_be_bytes());
             hasher.update(eref.fr_id.as_bytes());
             hasher.update(b"\x00");
         }

         hasher.update(prev_hash);

         let result = hasher.finalize();
         let mut hash = [0u8; 32];
         hash.copy_from_slice(&result);
         hash
     }
     ```
  2. Key design decisions:
     - **Big-endian** for integer encoding (platform-independent)
     - **RFC 3339** for timestamp serialization (deterministic format)
     - **Null byte separators** between fields to prevent field-boundary attacks
     - **Sorted evidence_refs** by evidence_id for deterministic ordering
  3. Implement `AuditEntry::compute_hash(&self) -> [u8; 32]` convenience method that calls `hash_entry` with self's fields.
  4. Implement `AuditEntry::verify_hash(&self) -> bool` that recomputes and compares.
- **Files**: `crates/agileplus-core/src/domain/audit.rs`
- **Parallel?**: No -- depends on T019 for the `AuditEntry` struct.
- **Validation**: Same inputs always produce same hash; changing any field changes the hash; hash is exactly 32 bytes.
- **Notes**: DO NOT use `serde_json::to_string()` for hashing -- JSON key ordering is implementation-defined and may change between serde versions or platforms. The explicit byte concatenation with separators is more robust. The `to_be_bytes()` call on `id` ensures consistent byte ordering across architectures (big-endian). The evidence_refs sort ensures the same set of references always produces the same hash regardless of insertion order.

### Subtask T021 -- Implement `verify_chain()` function: sequential scan validating prev_hash linkage

- **Purpose**: Verify the integrity of an entire audit chain. This is called by the `validate` command and can detect if any entry has been tampered with, deleted, or inserted out of order.
- **Steps**:
  1. Implement in `audit.rs`:
     ```rust
     /// Verify the integrity of an audit chain.
     ///
     /// Returns Ok(count) if the chain is valid, or Err with the first invalid entry.
     pub fn verify_chain(entries: &[AuditEntry]) -> Result<usize, AuditChainError> {
         if entries.is_empty() {
             return Ok(0);
         }

         // First entry must have zero prev_hash
         let first = &entries[0];
         if first.prev_hash != [0u8; 32] {
             return Err(AuditChainError::InvalidGenesis {
                 entry_id: first.id,
                 expected_prev_hash: [0u8; 32],
                 actual_prev_hash: first.prev_hash,
             });
         }

         // Verify first entry's own hash
         if !first.verify_hash() {
             return Err(AuditChainError::HashMismatch {
                 entry_id: first.id,
                 expected: first.compute_hash(),
                 actual: first.hash,
             });
         }

         // Verify chain linkage
         for i in 1..entries.len() {
             let prev = &entries[i - 1];
             let curr = &entries[i];

             // prev_hash must match previous entry's hash
             if curr.prev_hash != prev.hash {
                 return Err(AuditChainError::BrokenLink {
                     entry_id: curr.id,
                     expected_prev_hash: prev.hash,
                     actual_prev_hash: curr.prev_hash,
                 });
             }

             // Entry's own hash must be valid
             if !curr.verify_hash() {
                 return Err(AuditChainError::HashMismatch {
                     entry_id: curr.id,
                     expected: curr.compute_hash(),
                     actual: curr.hash,
                 });
             }

             // IDs must be sequential
             if curr.id != prev.id + 1 {
                 return Err(AuditChainError::NonSequentialId {
                     entry_id: curr.id,
                     expected_id: prev.id + 1,
                 });
             }
         }

         Ok(entries.len())
     }
     ```
  2. Define `AuditChainError` enum:
     ```rust
     #[derive(Debug, thiserror::Error)]
     pub enum AuditChainError {
         #[error("invalid genesis entry {entry_id}: prev_hash is not zero")]
         InvalidGenesis { entry_id: i64, expected_prev_hash: [u8; 32], actual_prev_hash: [u8; 32] },
         #[error("hash mismatch at entry {entry_id}")]
         HashMismatch { entry_id: i64, expected: [u8; 32], actual: [u8; 32] },
         #[error("broken link at entry {entry_id}: prev_hash does not match")]
         BrokenLink { entry_id: i64, expected_prev_hash: [u8; 32], actual_prev_hash: [u8; 32] },
         #[error("non-sequential ID at entry {entry_id}, expected {expected_id}")]
         NonSequentialId { entry_id: i64, expected_id: i64 },
     }
     ```
  3. Implement `AuditChain` convenience wrapper:
     ```rust
     pub struct AuditChain {
         entries: Vec<AuditEntry>,
     }

     impl AuditChain {
         pub fn new() -> Self { Self { entries: vec![] } }
         pub fn append(&mut self, ...) -> Result<AuditEntry, DomainError> { ... }
         pub fn verify(&self) -> Result<usize, AuditChainError> { verify_chain(&self.entries) }
         pub fn len(&self) -> usize { self.entries.len() }
         pub fn last_hash(&self) -> [u8; 32] { ... }
     }
     ```
- **Files**: `crates/agileplus-core/src/domain/audit.rs`
- **Parallel?**: No -- depends on T019 and T020.
- **Validation**: Valid chains verify; tampered entries detected; missing entries detected; non-sequential IDs caught.
- **Notes**: The `verify_chain` function takes a slice, not a reference to the AuditChain struct, so it can be used with entries loaded from any source (SQLite, git JSONL, etc.). The `AuditChain` wrapper provides the convenient `append` method that automatically sets `prev_hash` and computes `hash`. Empty chains are valid (return `Ok(0)`).

### Subtask T022 -- Implement `Evidence` struct with FR-to-evidence linking (FR-021)

- **Purpose**: Define the evidence artifact type that proves a functional requirement has been satisfied. Evidence is linked to both a work package (producer) and a functional requirement (what it proves).
- **Steps**:
  1. In `governance.rs`, implement `Evidence`:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct Evidence {
         pub id: i64,
         pub wp_id: i64,
         pub fr_id: String,
         pub evidence_type: EvidenceType,
         pub artifact_path: String,
         pub metadata: Option<serde_json::Value>,
         pub created_at: DateTime<Utc>,
     }

     #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
     #[serde(rename_all = "snake_case")]
     pub enum EvidenceType {
         TestResult,
         CiOutput,
         ReviewApproval,
         SecurityScan,
         LintResult,
         ManualAttestation,
     }
     ```
  2. Implement `Evidence::new()` constructor.
  3. Implement `Evidence::satisfies_requirement(&self, req: &EvidenceRequirement) -> bool`:
     - Check `evidence_type` matches `req.evidence_type`
     - Check `fr_id` matches `req.fr_id`
     - If threshold present, check metadata against threshold (e.g., coverage >= min_coverage)
  4. Implement `EvidenceType::from_str()` and `Display` for parsing and display.
  5. Implement helper: `check_evidence_completeness(evidence: &[Evidence], rules: &[GovernanceRule]) -> Vec<MissingEvidence>`:
     - For each rule's required_evidence, check if a matching Evidence exists
     - Returns list of unsatisfied requirements
- **Files**: `crates/agileplus-core/src/domain/governance.rs`
- **Parallel?**: Yes -- can run alongside T019-T021 (audit chain).
- **Validation**: Evidence matches requirements correctly; missing evidence detected; threshold comparison works.
- **Notes**: The `metadata` field is `Option<serde_json::Value>` because different evidence types carry different metadata. `TestResult` might have `{"coverage_pct": 87.5}`, while `SecurityScan` might have `{"critical": 0, "high": 2}`. The threshold comparison in `satisfies_requirement` should handle numeric comparisons (>=, <=, ==) based on evidence type.

### Subtask T023 -- Implement `PolicyRule` struct with domain-based evaluation (quality/security/reliability) (FR-020)

- **Purpose**: Define configurable policy rules that are evaluated during the validate command. Policies are domain-scoped (quality, security, reliability) and can be enabled/disabled.
- **Steps**:
  1. In `governance.rs`, implement:
     ```rust
     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct PolicyRule {
         pub id: i64,
         pub domain: PolicyDomain,
         pub rule: PolicyDefinition,
         pub active: bool,
         pub created_at: DateTime<Utc>,
         pub updated_at: DateTime<Utc>,
     }

     #[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
     #[serde(rename_all = "snake_case")]
     pub enum PolicyDomain {
         Quality,
         Security,
         Reliability,
     }

     #[derive(Debug, Clone, Serialize, Deserialize)]
     pub struct PolicyDefinition {
         /// Human-readable rule name.
         pub name: String,
         /// Description of what this rule checks.
         pub description: String,
         /// The check to perform.
         pub check: PolicyCheck,
     }

     #[derive(Debug, Clone, Serialize, Deserialize)]
     #[serde(tag = "type", rename_all = "snake_case")]
     pub enum PolicyCheck {
         /// Minimum test coverage percentage.
         MinCoverage { threshold: f64 },
         /// Maximum number of critical security findings.
         MaxCriticalFindings { threshold: u32 },
         /// Required evidence types that must be present.
         RequiredEvidenceTypes { types: Vec<EvidenceType> },
         /// All lints must pass (zero warnings in strict mode).
         LintClean { strict: bool },
         /// Review must be approved (no outstanding change requests).
         ReviewApproved,
     }
     ```
  2. Implement `PolicyRule::evaluate(&self, evidence: &[Evidence]) -> PolicyResult`:
     ```rust
     #[derive(Debug, Clone)]
     pub enum PolicyResult {
         Pass,
         Fail { reason: String },
         Skip { reason: String },  // rule inactive or not applicable
     }
     ```
  3. Implement each `PolicyCheck` variant's evaluation logic:
     - `MinCoverage`: find TestResult evidence, extract coverage from metadata, compare
     - `MaxCriticalFindings`: find SecurityScan evidence, extract critical count, compare
     - `RequiredEvidenceTypes`: check that all required types exist in evidence set
     - `LintClean`: find LintResult evidence, check for zero warnings/errors
     - `ReviewApproved`: find ReviewApproval evidence, check it exists
  4. Implement `evaluate_all_policies(policies: &[PolicyRule], evidence: &[Evidence]) -> Vec<(PolicyRule, PolicyResult)>`:
     - Convenience function to evaluate all active policies against evidence
- **Files**: `crates/agileplus-core/src/domain/governance.rs`
- **Parallel?**: Yes -- can run alongside T019-T021 and T022.
- **Validation**: Each policy check variant produces correct pass/fail; inactive policies skipped; threshold comparisons correct.
- **Notes**: The `PolicyCheck` enum uses `#[serde(tag = "type")]` for clean JSON representation. This allows policies to be stored as JSON in SQLite and loaded back into typed Rust structs. New policy check types can be added to the enum as needed. The `evaluate` method should never panic -- unknown metadata fields return `Fail` with a descriptive reason.

### Subtask T024 -- Write unit tests: chain integrity, tamper detection, evidence completeness, policy evaluation

- **Purpose**: Comprehensive testing of the governance and audit subsystem. These tests guard the integrity of the governance enforcement model.
- **Steps**:
  1. Create test module(s) in `audit.rs` and `governance.rs`.
  2. **Audit chain tests (10+ tests)**:
     ```rust
     #[test]
     fn test_genesis_entry_has_zero_prev_hash() { ... }

     #[test]
     fn test_chain_of_three_entries_verifies() {
         let mut chain = AuditChain::new();
         chain.append(1, "user", "created -> specified", &[], Utc::now()).unwrap();
         chain.append(1, "agent:claude-code", "specified -> researched", &[], Utc::now()).unwrap();
         chain.append(1, "system", "researched -> planned", &[], Utc::now()).unwrap();
         assert_eq!(chain.verify(), Ok(3));
     }

     #[test]
     fn test_tampered_entry_detected() {
         // Build valid chain, then modify an entry's actor field
         // verify_chain should return HashMismatch error
     }

     #[test]
     fn test_deleted_entry_detected() {
         // Build 3-entry chain, remove middle entry
         // verify_chain should return BrokenLink error
     }

     #[test]
     fn test_inserted_entry_detected() {
         // Build chain, insert extra entry between existing ones
         // verify_chain should return BrokenLink or NonSequentialId error
     }

     #[test]
     fn test_empty_chain_valid() {
         assert_eq!(verify_chain(&[]), Ok(0));
     }

     #[test]
     fn test_hash_determinism() {
         // Same inputs produce same hash across two calls
     }

     #[test]
     fn test_hash_changes_with_any_field() {
         // Verify that changing id, timestamp, actor, transition,
         // evidence_refs, or prev_hash each produce a different hash
     }
     ```
  3. **Evidence tests (5+ tests)**:
     ```rust
     #[test]
     fn test_evidence_satisfies_matching_requirement() { ... }

     #[test]
     fn test_evidence_fails_wrong_type() { ... }

     #[test]
     fn test_evidence_fails_below_threshold() { ... }

     #[test]
     fn test_completeness_check_finds_missing() { ... }

     #[test]
     fn test_completeness_check_all_satisfied() { ... }
     ```
  4. **Policy evaluation tests (8+ tests)**:
     ```rust
     #[test]
     fn test_min_coverage_passes_above_threshold() { ... }

     #[test]
     fn test_min_coverage_fails_below_threshold() { ... }

     #[test]
     fn test_max_critical_findings_passes_at_zero() { ... }

     #[test]
     fn test_max_critical_findings_fails_above_threshold() { ... }

     #[test]
     fn test_required_evidence_types_all_present() { ... }

     #[test]
     fn test_required_evidence_types_missing_one() { ... }

     #[test]
     fn test_inactive_policy_skipped() { ... }

     #[test]
     fn test_evaluate_all_policies_mixed_results() { ... }
     ```
  5. **Governance contract tests (3+ tests)**:
     ```rust
     #[test]
     fn test_contract_rules_for_transition() { ... }

     #[test]
     fn test_contract_validation_rejects_invalid_transition() { ... }

     #[test]
     fn test_contract_versioning() { ... }
     ```
  6. Consider proptest for hash determinism and chain integrity properties.
- **Files**: `crates/agileplus-core/src/domain/audit.rs` (inline tests), `crates/agileplus-core/src/domain/governance.rs` (inline tests), or `crates/agileplus-core/tests/`
- **Parallel?**: No -- depends on T018-T023 being complete.
- **Validation**: `cargo test -p agileplus-core` passes 25+ tests with 0 failures.
- **Notes**: The tamper detection tests are the most critical. Build a valid chain, then mutate a single byte in one entry, and verify that `verify_chain` catches it. Test all mutation targets: id, timestamp, actor, transition, evidence_refs, prev_hash, and hash itself. For evidence threshold tests, construct Evidence with metadata JSON containing coverage/finding counts and verify the comparison logic.

### Subtask T024b: Property-Based Tests for Audit Chain

**Purpose**: Use proptest to verify hash chain integrity invariants.

**Steps**:
1. Write property tests: any chain of N entries verifies correctly
2. Write property tests: tampering with any single entry breaks chain verification
3. Write property tests: governance evaluation is deterministic for same inputs

**Files**: `crates/agileplus-domain/src/domain/audit.rs`, `governance.rs` (tests modules)
**Validation**: proptest generates 256+ cases, all pass

### Subtask T024c: Mutation Testing for Audit & Governance

**Purpose**: Verify audit/governance test suite catches mutations (≥90%).

**Steps**:
1. Run `cargo mutants -p agileplus-domain -- --test audit --test governance`
2. Verify mutation score ≥90% for audit.rs and governance.rs
3. Fix gaps with targeted tests

**Validation**: cargo-mutants ≥90% killed for both modules

### Subtask T024d: Import Phenotype Governance Patterns

**Purpose**: Import and extend existing Phenotype governance patterns (FR-028, FR-029).

**Steps**:
1. Analyze existing governance from parpour, civ, thegent repos
2. Extract reusable patterns: worktree discipline, quality gates, agent workflow rules
3. Encode as default governance contract templates in domain crate
4. Ensure templates are extensible per-project

**Files**: `crates/agileplus-domain/src/domain/governance.rs`
**Validation**: Default governance contracts include Phenotype baseline rules

---

## Test Strategy

- **Unit tests**: 25+ tests across audit.rs and governance.rs
- **Property-based tests**: Recommended for hash determinism and chain integrity
- **Command**: `cargo test -p agileplus-core -- --nocapture`
- **Coverage**: `cargo tarpaulin -p agileplus-core` targeting >95% on domain/audit.rs and domain/governance.rs
- **Focus areas**:
  - Hash chain: build, verify, tamper, rebuild
  - Evidence: matching, threshold comparison, completeness
  - Policy: each check variant, active/inactive, edge cases

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Hash non-determinism across platforms | Chain verification fails when rebuilt on different OS | Use big-endian bytes, RFC 3339 timestamps, sorted evidence refs; test on macOS + Linux |
| Timestamp precision differences | Same logical event produces different hashes | Use `DateTime<Utc>` with fixed RFC 3339 format (no nanoseconds unless needed) |
| serde_json key ordering in metadata | Hash changes between serde versions | Hash function uses explicit byte concatenation, NOT serde_json serialization |
| Policy evaluation edge cases | False pass on security-critical checks | Test every PolicyCheck variant with boundary values (exactly at threshold) |
| Evidence metadata schema drift | satisfies_requirement fails on valid evidence | Use `Option<Value>` and handle missing fields gracefully (return Fail, not panic) |
| Chain performance at scale | verify_chain slow for 10k+ entries | O(n) scan is acceptable; add early-exit on first error |

---

## Review Guidance

Reviewers should verify:

1. **Hash determinism**: `hash_entry()` uses byte concatenation with null separators, NOT JSON serialization.
2. **Big-endian integers**: `id.to_be_bytes()` used for platform independence.
3. **Chain verification**: All error cases covered -- broken link, hash mismatch, non-sequential ID, invalid genesis.
4. **Tamper detection tests**: At least one test per mutation target (id, timestamp, actor, etc.).
5. **Evidence matching**: `satisfies_requirement` checks type AND fr_id AND threshold.
6. **Policy evaluation**: Every `PolicyCheck` variant has pass and fail tests.
7. **No I/O**: All code is pure domain logic. No file reads, no network, no database.
8. **Immutability**: GovernanceContract has no `&mut self` methods (immutable after creation).
9. **Error quality**: All error types have descriptive messages with context (entry IDs, expected vs actual).

---

## Activity Log

> **CRITICAL**: Activity log entries MUST be in chronological order (oldest first, newest last).

### How to Add Activity Log Entries

**When adding an entry**:
1. Scroll to the bottom of this Activity Log section
2. **APPEND the new entry at the END** (do NOT prepend or insert in middle)
3. Use exact format: `- YYYY-MM-DDTHH:MM:SSZ – agent_id – lane=<lane> – <action>`
4. Timestamp MUST be current time in UTC
5. Lane MUST match the frontmatter `lane:` field exactly

**Valid lanes**: `planned`, `doing`, `for_review`, `done`

- 2026-02-27T00:00:00Z – system – lane=planned – Prompt created.
- 2026-02-28T09:22:19Z – claude-wp04 – shell_pid=29799 – lane=doing – Assigned agent via workflow command
- 2026-02-28T09:29:39Z – claude-wp04 – shell_pid=29799 – lane=for_review – Ready for review: GovernanceContract, AuditEntry hash chain, Evidence, PolicyRule evaluation, 43 tests passing including proptest
- 2026-02-28T09:30:46Z – claude-wp04 – shell_pid=29799 – lane=done – Review passed: governance contracts, hash-chained audit, evidence, policy evaluation, 43 tests, clean clippy
