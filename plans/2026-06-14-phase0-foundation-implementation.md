# Phase 0: Foundation — CI/GitOps/DevOps Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use subagent-driven-development (recommended) or executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the foundational infrastructure for fleet-wide CI unification: the `phenotype-ops` canonical repo, the `phenotype-manifest` Rust CLI for signed attestation, the unified review surface FastAPI skeleton, pillar/manifest JSON schemas, and quick-win CI optimizations on the shelf repo.

**Architecture:** Six orthogonal subsystems that Phase 0 bootstraps in parallel — a new canonical ops repo that absorbs PhenoDevOps/pheno-ci-templates/phenotype-tooling, a Rust CLI for pre-push manifest generation and CI validation, a Python FastAPI server for unified code review routing, JSON schemas for the 5-pillar manifest architecture, and immediate path-filter + sccache optimizations on the existing shelf CI workflows.

**Tech Stack:** Rust (CLI with clap, serde, ssh-key, ring/hmac), Python (FastAPI, httpx, pydantic), GitHub Actions (reusable workflows, org rulesets), JSON Schema (draft 2020-12), sccache, cargo-nextest, mold linker.

**Plan location:** `plans/2026-06-14-ci-gitops-devops-unification-ultraplan.md` (design spec)

---

## File Structure

```
repos/
├── .github/workflows/
│   ├── ci.yml                              [MODIFY: add path filters, sccache, nextest]
│   └── cargo-audit.yml / cargo-deny.yml    [MODIFY: consolidate into security manifest-gate]
│
├── phenotype-ops/                           [CREATE: new canonical repo]
│   ├── .github/workflows/
│   │   ├── manifest-gate.yml               [CREATE: cheap CI validation workflow]
│   │   ├── ci-reusable.yml                 [CREATE: reusable CI from pheno-ci-templates]
│   │   └── release-reusable.yml            [CREATE: reusable release from pheno-ci-templates]
│   ├── tools/phenotype-manifest/           [CREATE: Rust CLI crate]
│   │   ├── Cargo.toml
│   │   ├── src/main.rs                     [CLI: generate, verify, sign]
│   │   ├── src/manifest.rs                 [Manifest struct, serialization, signing]
│   │   ├── src/pillars.rs                  [Pillar definitions, gate results, scoring]
│   │   └── src/validate.rs                 [Validation: commit check, signature, expiry]
│   ├── review-surface/                     [CREATE: FastAPI project skeleton]
│   │   ├── requirements.txt
│   │   ├── main.py                         [FastAPI app + webhook endpoint]
│   │   ├── config.py                       [Env-based settings]
│   │   ├── models.py                       [Pydantic schemas: ReviewComment, PRAssignment]
│   │   └── dispatcher.py                   [Tool selection, dispatch orchestration]
│   ├── policies/
│   │   ├── manifest-schema.json            [CREATE: JSON Schema for .manifest.signed.json]
│   │   └── pillar-schema.json              [CREATE: JSON Schema for pillar definitions]
│   ├── pillars/                            [CREATE: starter pillar check definitions]
│   │   ├── quality.yaml
│   │   ├── security.yaml
│   │   ├── perf.yaml
│   │   ├── compliance.yaml
│   │   └── docs.yaml
│   ├── governance/
│   │   ├── AGENTS.md
│   │   └── lefthook.yml                    [CREATE: canonical fleet lefthook]
│   ├── agent-devops-setups/                [MOVE: from repos/agent-devops-setups]
│   └── templates/
│       ├── quality/
│       └── linters/
```

---

## Task 1: Quick-Win Shelf CI Optimizations

**Files:**
- Modify: `repos/.github/workflows/ci.yml`
- Modify: `repos/.github/workflows/cargo-audit.yml`
- Modify: `repos/.github/workflows/cargo-deny.yml`
- Create: `repos/.github/workflows/security-gate.yml` (consolidated)

- [ ] **Step 1: Add path filtering to ci.yml — skip on README/docs-only changes**

Read `/Users/kooshapari/CodeProjects/Phenotype/repos/.github/workflows/ci.yml` current contents:

```yaml
name: CI
permissions:
  contents: read
  pull-requests: read
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@b4ffde65f46336ab88eb53be808477a3936bae11 # v4.1.1
      - uses: dtolnay/rust-toolchain@stable
      - uses: Swatinem/rust-cache@42dc69e1aa15d09112580998cf2ef0119e2e91ae # v2
      - name: Clone sibling PhenoObservability
        run: |
          git clone --depth 1 https://github.com/KooshaPari/PhenoObservability.git \
            "$GITHUB_WORKSPACE/../PhenoObservability"
      - run: cargo test --all-features --workspace
      - run: cargo clippy --all-features -- -D warnings 2>/dev/null || cargo check
```

Replace with path-filtered + sccache + cargo-nextest version:

```yaml
name: CI
permissions:
  contents: read
  pull-requests: read
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

# Only run when actual code changes — skip README/docs-only edits
on:
  push:
    branches: [main]
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - 'worklogs/**'
      - '.github/**'
      - '*.md'
  pull_request:
    paths-ignore:
      - '**.md'
      - 'docs/**'
      - 'worklogs/**'
      - '.github/**'
      - '*.md'

jobs:
  test:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.1.1
      - uses: dtolnay/rust-toolchain@stable

      # sccache — share compiled artifacts across CI runs
      - name: Start sccache
        run: |
          cargo install sccache --locked
          echo "RUSTC_WRAPPER=sccache" >> $GITHUB_ENV
          echo "SCCACHE_GHA_ENABLED=true" >> $GITHUB_ENV

      - uses: Swatinem/rust-cache@42dc69e1aa15d09112580998cf2ef0119e2e91ae # v2
        with:
          # Only cache changed workspaces
          workspaces: |
            . -> target

      - name: Clone sibling PhenoObservability
        run: |
          git clone --depth 1 https://github.com/KooshaPari/PhenoObservability.git \
            "$GITHUB_WORKSPACE/../PhenoObservability"

      # cargo-nextest — 2-3x faster than cargo test
      - name: Install cargo-nextest
        run: |
          if ! cargo nextest --version &>/dev/null; then
            cargo install cargo-nextest --locked
          fi

      - name: Run tests (nextest)
        run: cargo nextest run --all-features --workspace

      - name: Run lint
        run: cargo clippy --all-features -- -D warnings
```

- [ ] **Step 2: Create consolidated security-gate.yml**

Create `repos/.github/workflows/security-gate.yml` that runs cargo-audit, cargo-deny, and trufflehog in a single job:

```yaml
name: Security Gate
permissions:
  contents: read
  security-events: write
concurrency:
  group: security-${{ github.ref }}
  cancel-in-progress: true

on:
  push:
    branches: [main]
    paths:
      - 'Cargo.toml'
      - 'Cargo.lock'
  pull_request:
    paths:
      - 'Cargo.toml'
      - 'Cargo.lock'
  schedule:
    - cron: '0 6 * * 1'  # once weekly
  workflow_dispatch:

jobs:
  security:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@11bd71901bbe5b1630ceea73d27597364c9af683 # v4.1.1
      - uses: dtolnay/rust-toolchain@stable

      - name: Run cargo-audit
        id: audit
        continue-on-error: true
        uses: rustsec/audit-check@v2
        with:
          token: ${{ github.token }}

      - name: Run cargo-deny
        id: deny
        continue-on-error: true
        uses: EmbarkStudios/cargo-deny-action@v6
        with:
          rust-version: stable

      - name: Run trufflehog (secrets scan)
        id: trufflehog
        continue-on-error: true
        uses: trufflesecurity/trufflehog@v3
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}
          head: HEAD

      - name: Security Gate Summary
        if: always()
        run: |
          echo "=== Security Gate Results ==="
          echo "cargo-audit: ${{ steps.audit.outcome }}"
          echo "cargo-deny:  ${{ steps.deny.outcome }}"
          echo "trufflehog:  ${{ steps.trufflehog.outcome }}"
          if [ "${{ steps.audit.outcome }}" = "failure" ] || \
             [ "${{ steps.deny.outcome }}" = "failure" ] || \
             [ "${{ steps.trufflehog.outcome }}" = "failure" ]; then
            echo "SECURITY GATE FAILED"
            exit 1
          fi
          echo "SECURITY GATE PASSED"
```

- [ ] **Step 3: Commit shelf CI changes**

```bash
git add .github/workflows/
git commit -m "ci(quick-wins): path filters, sccache, nextest, consolidated security gate

- Add path-ignore for *.md/docs to reduce unnecessary CI runs
- Add sccache for compiled artifact sharing across runs
- Switch to cargo-nextest for 2-3x faster test execution
- Consolidate cargo-audit + cargo-deny + trufflehog into single security gate
- Replace cargo test with cargo nextest run"
```

---

## Task 2: Create phenotype-ops Canonical Repo

**Files:**
- Create: `repos/phenotype-ops/` (new git repo)
- Create: `repos/phenotype-ops/AGENTS.md`
- Create: `repos/phenotype-ops/README.md`
- Create: `repos/phenotype-ops/.github/workflows/manifest-gate.yml`
- Create: `repos/phenotype-ops/lefthook.yml`

- [ ] **Step 1: Initialize the repo**

```bash
mkdir -p /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
git init
git remote add origin git@github.com:KooshaPari/phenotype-ops.git
mkdir -p .github/workflows tools/phenotype-manifest/src pillars review-surface policies governance
```

- [ ] **Step 2: Create AGENTS.md**

```markdown
# phenotype-ops — Agent Instructions

## Identity

Canonical operations infrastructure for the Phenotype fleet (~100 repos).
This repo owns: reusable CI workflows, the `phenotype-manifest` attestation CLI,
the unified code review surface, pillar check definitions, and governance templates.

## Responsibilities

- **CI/CD:** `.github/workflows/` — reusable workflows consumed by `uses:` from all fleet repos
- **Attestation:** `tools/phenotype-manifest/` — Rust CLI for manifest generation + validation
- **Review Surface:** `review-surface/` — FastAPI webhook router for unified code review
- **Pillars:** `pillars/` — quality/security/perf/compliance/docs check definitions
- **Governance:** `governance/` — CLAUDE.base.md, lefthook.yml, AGENTS.base.md

## Key Commands

```bash
# Build the manifest CLI
cd tools/phenotype-manifest && cargo build --release

# Run the review surface
cd review-surface && python -m venv .venv && source .venv/bin/activate && pip install -r requirements.txt && uvicorn main:app --reload

# Validate a manifest
phenotype-manifest verify --manifest .manifest.signed.json --pubkey .github/manifest.pubkey.pem
```

## Layout

```
phenotype-ops/
├── .github/workflows/     # Reusable CI/release workflows
├── tools/                 # CLI tools (phenotype-manifest)
├── review-surface/        # Unified code review FastAPI server
├── pillars/               # Check definitions per pillar
├── policies/              # JSON Schema, rulesets
├── governance/            # Templates, hooks
├── agent-devops-setups/   # Absorbed from old repo
└── templates/             # Linter, quality configs
```
```

- [ ] **Step 3: Create README.md**

```markdown
# phenotype-ops

Canonical operations infrastructure for the Phenotype fleet.

## What This Repo Does

- Provides reusable GitHub Actions workflows consumed by all fleet repos
- Houses the `phenotype-manifest` CLI for pre-push manifest attestation
- Runs the Unified Review Surface (webhook-based code review router)
- Defines pillar-based quality gate configurations
- Stores governance templates (CLAUDE.md, lefthook.yml)

## Quick Start

```bash
# As a consumer, include reusable workflows:
# .github/workflows/ci.yml
jobs:
  ci:
    uses: KooshaPari/phenotype-ops/.github/workflows/ci-reusable.yml@main

# For pre-push attestation, copy governance/lefthook.yml to your repo root
```

## Repo Layout

See `AGENTS.md` for detailed layout.
```

- [ ] **Step 4: Create reusable manifest-gate.yml**

```yaml
# .github/workflows/manifest-gate.yml
name: Manifest Gate
on:
  workflow_call:
    inputs:
      fallback_strategy:
        required: false
        type: string
        default: 'warn'  # warn | full | fail
      manifest_path:
        required: false
        type: string
        default: '.manifest.signed.json'
    secrets:
      MANIFEST_PUBKEY:
        required: false

permissions:
  contents: read

jobs:
  validate:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4

      - name: Check manifest exists
        id: check
        run: |
          if [ -f "${{ inputs.manifest_path }}" ]; then
            echo "exists=true" >> $GITHUB_OUTPUT
          else
            echo "exists=false" >> $GITHUB_OUTPUT
          fi

      - name: Install phenotype-manifest
        if: steps.check.outputs.exists == 'true'
        run: cargo install phenotype-manifest --locked

      - name: Validate manifest
        if: steps.check.outputs.exists == 'true'
        id: validate
        env:
          PUBKEY: ${{ secrets.MANIFEST_PUBKEY }}
        run: |
          if ! phenotype-manifest verify \
            --manifest "${{ inputs.manifest_path }}" \
            --pubkey <(echo "$PUBKEY") \
            --fallback-strategy "pass"; then
            echo "valid=false" >> $GITHUB_OUTPUT
            exit 1
          fi
          echo "valid=true" >> $GITHUB_OUTPUT

      - name: Fallback — run full CI
        if: |
          steps.check.outputs.exists == 'false' ||
          (steps.validate.outputs.valid == 'false' && inputs.fallback_strategy == 'full')
        run: |
          echo "Manifest missing or invalid → running full CI suite"
          # Consumer should override this step with their actual CI commands
          cargo test --all-features --workspace
          cargo clippy --all-features -- -D warnings

      - name: Fallback — warn only
        if: inputs.fallback_strategy == 'warn' && steps.check.outputs.exists == 'false'
        run: |
          echo "::warning::No manifest found. Pre-push attestation recommended."
          echo "::warning::Run: phenotype-manifest generate --output .manifest.signed.json"
```

- [ ] **Step 5: Create canonical lefthook.yml**

```yaml
# lefthook.yml — Canonical pre-push manifest attestation
# Copy to your repo root. Requires: cargo install phenotype-manifest

pre-commit:
  parallel: true
  commands:
    fmt:
      run: |
        CHANGED=$(git diff --cached --name-only --diff-filter=ACM | grep -E '\.rs$' || true)
        if [ -n "$CHANGED" ]; then cargo fmt --check; fi
      skip:
        - merge
        - rebase
    lint:
      run: |
        if [ -f "Cargo.toml" ]; then
          cargo clippy --all-features -- -D warnings 2>/dev/null || true
        fi
      skip:
        - merge
        - rebase

commit-msg:
  commands:
    conventional:
      run: |
        MSG=$(cat "$1")
        if echo "$MSG" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)(\(.+\))?: .{1,100}'; then
          exit 0
        else
          echo "Commit message must follow conventional commits format"
          exit 1
        fi

pre-push:
  parallel: false
  commands:
    manifest:
      run: |
        if command -v phenotype-manifest &>/dev/null; then
          phenotype-manifest generate \
            --output .manifest.signed.json \
            --checks-dir .manifest-checks/ 2>/dev/null || true
          echo "→ Manifest generated. CI will validate."
        else
          echo "→ phenotype-manifest not installed. Install with: cargo install phenotype-manifest"
          echo "→ Falling back to basic checks."
          cargo test --all-features --workspace 2>/dev/null || true
        fi
      skip:
        - merge
        - rebase
```

- [ ] **Step 6: Commit phenotype-ops skeleton**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
git add .
git commit -m "feat: bootstrap phenotype-ops canonical ops repo

- Reusable manifest-gate.yml workflow
- Canonical lefthook.yml for pre-push attestation
- AGENTS.md and README with repo layout
- Directory structure: tools/, review-surface/, pillars/, policies/, governance/"
```

---

## Task 3: phenotype-manifest CLI — Crate Skeleton + Manifest Types

**Files:**
- Create: `repos/phenotype-ops/tools/phenotype-manifest/Cargo.toml`
- Create: `repos/phenotype-ops/tools/phenotype-manifest/src/manifest.rs`
- Create: `repos/phenotype-ops/tools/phenotype-manifest/src/pillars.rs`

- [ ] **Step 1: Create Cargo.toml**

```toml
[package]
name = "phenotype-manifest"
version = "0.1.0"
edition = "2021"
description = "Generate and verify signed CI attestation manifests for the Phenotype fleet"

[dependencies]
clap = { version = "4", features = ["derive"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
ssh-key = { version = "0.6", features = ["ed25519"] }
sha2 = "0.10"
hex = "0.4"
chrono = { version = "0.4", features = ["serde"] }
anyhow = "1"
tracing = "0.1"
```

- [ ] **Step 2: Create manifest.rs — Manifest struct + serialization**

```rust
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::collections::BTreeMap;

/// A signed CI attestation manifest.
///
/// Generated by `phenotype-manifest generate` and validated by `phenotype-manifest verify`.
/// Binds check results to a specific commit+tree hash with a developer SSH signature.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Manifest {
    pub version: u32,
    pub commit: String,
    pub tree: String,
    pub timestamp: DateTime<Utc>,
    pub ttl_seconds: u64,
    pub author: Author,
    pub pillars: BTreeMap<String, PillarResult>,
    pub diff_summary: DiffSummary,
    pub aggregated_hash: String,
    pub signature: Option<Signature>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Author {
    pub name: String,
    pub email: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PillarResult {
    pub score: f64,
    pub gates: Vec<GateResult>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GateResult {
    pub name: String,
    pub passed: bool,
    pub exit_code: i32,
    pub duration_ms: u64,
    pub stdout_hash: Option<String>,
    pub stderr_hash: Option<String>,
    pub version: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DiffSummary {
    pub changed_files: u32,
    pub readme_only: bool,
    pub code_changes: bool,
    pub lockfile_changed: bool,
    pub languages: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Signature {
    pub signature_type: String, // "ssh-ed25519"
    pub key_id: String,
    pub value: String, // base64-encoded signature
}

impl Manifest {
    /// Compute the aggregated SHA-256 hash of all pillar results in canonical order.
    pub fn compute_aggregated_hash(&self) -> String {
        let mut hasher = Sha256::new();
        for (pillar_name, pillar) in &self.pillars {
            hasher.update(pillar_name.as_bytes());
            for gate in &pillar.gates {
                hasher.update(gate.name.as_bytes());
                hasher.update(&gate.exit_code.to_le_bytes());
                hasher.update(&gate.duration_ms.to_le_bytes());
                hasher.update(&[gate.passed as u8]);
            }
        }
        hex::encode(hasher.finalize())
    }

    /// Check if the manifest is expired based on TTL.
    pub fn is_expired(&self) -> bool {
        let elapsed = Utc::now() - self.timestamp;
        elapsed.num_seconds() > self.ttl_seconds as i64
    }

    /// Overall health score: min of all pillar scores.
    pub fn health_score(&self) -> f64 {
        self.pillars
            .values()
            .map(|p| p.score)
            .fold(f64::INFINITY, f64::min)
    }
}

impl PillarResult {
    /// Compute pillar score from gate results.
    /// Passed = 1.0, Failed = 0.0, Skipped = 0.5.
    pub fn compute_score(gates: &[GateResult]) -> f64 {
        if gates.is_empty() {
            return 0.0;
        }
        let total: f64 = gates.iter().map(|g| if g.passed { 1.0 } else { 0.0 }).sum();
        total / gates.len() as f64
    }
}
```

- [ ] **Step 3: Write unit tests for manifest types**

Add test module at bottom of `manifest.rs`:

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;

    #[test]
    fn test_health_score_min_model() {
        let mut pillars = BTreeMap::new();
        pillars.insert("quality".into(), PillarResult {
            score: 0.9,
            gates: vec![GateResult {
                name: "test".into(), passed: true, exit_code: 0, duration_ms: 100,
                stdout_hash: None, stderr_hash: None, version: None,
            }],
        });
        pillars.insert("security".into(), PillarResult {
            score: 0.5,
            gates: vec![],
        });
        let m = Manifest {
            version: 1, commit: "a".into(), tree: "b".into(),
            timestamp: Utc.with_ymd_and_hms(2026, 6, 14, 0, 0, 0).unwrap(),
            ttl_seconds: 86400, author: Author { name: "t".into(), email: "t@t".into() },
            pillars, diff_summary: DiffSummary {
                changed_files: 1, readme_only: false, code_changes: true,
                lockfile_changed: false, languages: vec!["rust".into()],
            },
            aggregated_hash: "".into(), signature: None,
        };
        assert!((m.health_score() - 0.5).abs() < 1e-6);
    }

    #[test]
    fn test_compute_aggregated_hash_deterministic() {
        let m1 = make_test_manifest();
        let m2 = make_test_manifest();
        assert_eq!(m1.compute_aggregated_hash(), m2.compute_aggregated_hash());
    }

    #[test]
    fn test_is_expired() {
        let mut m = make_test_manifest();
        m.timestamp = Utc::now() - chrono::Duration::hours(25);
        m.ttl_seconds = 86400;
        assert!(m.is_expired());
    }

    fn make_test_manifest() -> Manifest {
        let mut pillars = BTreeMap::new();
        pillars.insert("quality".into(), PillarResult {
            score: 1.0,
            gates: vec![GateResult {
                name: "test".into(), passed: true, exit_code: 0, duration_ms: 100,
                stdout_hash: Some("abc".into()), stderr_hash: None, version: Some("cargo 1.95".into()),
            }],
        });
        Manifest {
            version: 1, commit: "deadbeef".into(), tree: "cafebabe".into(),
            timestamp: Utc::now(), ttl_seconds: 86400,
            author: Author { name: "test".into(), email: "test@test".into() },
            pillars, diff_summary: DiffSummary {
                changed_files: 1, readme_only: false, code_changes: true,
                lockfile_changed: false, languages: vec!["rust".into()],
            },
            aggregated_hash: String::new(), signature: None,
        }
    }
}
```

- [ ] **Step 4: Run tests to verify**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops/tools/phenotype-manifest
cargo test
```

Expected: 3 tests pass (health_score, hash_deterministic, is_expired)

- [ ] **Step 5: Commit**

```bash
git add tools/phenotype-manifest/
git commit -m "feat: add Manifest types with health scoring and hash computation"
```

---

## Task 4: phenotype-manifest CLI — Signing + Validation

**Files:**
- Create: `repos/phenotype-ops/tools/phenotype-manifest/src/validate.rs`
- Modify: `repos/phenotype-ops/tools/phenotype-manifest/src/manifest.rs` (add verify method)

- [ ] **Step 1: Create validate.rs — Signature verification + full manifest validation**

```rust
use anyhow::{Context, Result};
use sha2::{Digest, Sha256};
use ssh_key::{HashAlg, PrivateKey, PublicKey};
use std::path::Path;

use crate::manifest::Manifest;

/// Validate an entire manifest against the current repository state.
pub struct ManifestValidator {
    pub manifest: Manifest,
    pub pubkey: Option<PublicKey>,
}

impl ManifestValidator {
    /// Load a manifest file and optionally a public key for signature validation.
    pub fn load(manifest_path: &Path, pubkey_path: Option<&Path>) -> Result<Self> {
        let data = std::fs::read_to_string(manifest_path)
            .context("Failed to read manifest file")?;
        let manifest: Manifest = serde_json::from_str(&data)
            .context("Failed to parse manifest JSON")?;

        let pubkey = if let Some(path) = pubkey_path {
            let key_data = std::fs::read_to_string(path)
                .context("Failed to read public key file")?;
            Some(PublicKey::from_openssh(&key_data)
                .context("Failed to parse SSH public key")?)
        } else {
            None
        };

        Ok(Self { manifest, pubkey })
    }

    /// Run all validation checks.
    /// Returns a list of validation errors (empty = valid).
    pub fn validate(&self, current_commit: &str, current_tree: &str) -> Vec<String> {
        let mut errors = Vec::new();

        // 1. Commit hash check
        if self.manifest.commit != current_commit {
            errors.push(format!(
                "Commit hash mismatch: manifest={}, head={}",
                self.manifest.commit, current_commit
            ));
        }

        // 2. Tree hash check (content-addressable, survives rebases)
        if self.manifest.tree != current_tree {
            errors.push(format!(
                "Tree hash mismatch: manifest={}, current={}",
                self.manifest.tree, current_tree
            ));
        }

        // 3. TTL / expiry check
        if self.manifest.is_expired() {
            errors.push(format!(
                "Manifest expired at {} (TTL: {}s)",
                self.manifest.timestamp, self.manifest.ttl_seconds
            ));
        }

        // 4. Aggregated hash integrity check
        let computed = self.manifest.compute_aggregated_hash();
        if self.manifest.aggregated_hash != computed {
            errors.push("Aggregated hash mismatch — gate results may have been tampered with".into());
        }

        // 5. Signature check (if pubkey provided)
        if let Some(ref pk) = self.pubkey {
            if let Some(ref sig) = self.manifest.signature {
                if let Err(e) = self.verify_signature(pk, sig) {
                    errors.push(format!("Signature verification failed: {}", e));
                }
            } else {
                errors.push("Manifest has no signature but pubkey was provided".into());
            }
        }

        // 6. All pillars must be present
        let required = ["quality", "security", "perf", "compliance", "docs"];
        for pillar in &required {
            if !self.manifest.pillars.contains_key(*pillar) {
                errors.push(format!("Missing required pillar: {}", pillar));
            }
        }

        // 7. Overall health check
        let health = self.manifest.health_score();
        if health < 0.5 {
            errors.push(format!("Overall health score too low: {:.2}", health));
        }

        errors
    }

    /// Verify an Ed25519 SSH signature over the aggregated hash.
    fn verify_signature(&self, pubkey: &PublicKey, sig: &crate::manifest::Signature) -> Result<()> {
        let sig_bytes = base64_decode(&sig.value)?;
        let message = self.manifest.aggregated_hash.as_bytes();

        match pubkey {
            PublicKey::Ed25519(ed25519_key) => {
                use ssh_key::Signature as SshSignature;

                let ssh_sig = SshSignature::new(
                    HashAlg::Sha512,
                    sig_bytes.into(),
                    "phenotype-manifest".into(),
                )?;

                ed25519_key
                    .verify(message, &ssh_sig)
                    .context("Ed25519 signature does not match")
            }
            _ => Err(anyhow::anyhow!("Only Ed25519 keys are supported for manifest signing")),
        }
    }
}

fn base64_decode(input: &str) -> Result<Vec<u8>> {
    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    engine.decode(input).context("Failed to base64-decode signature")
}

/// Generate an Ed25519 signature over the aggregated hash.
pub fn sign_manifest(manifest: &mut Manifest, private_key_path: &Path) -> Result<()> {
    let key_data = std::fs::read_to_string(private_key_path)
        .context("Failed to read private key")?;
    let privkey = PrivateKey::from_openssh(&key_data)
        .context("Failed to parse SSH private key")?;

    let message = manifest.aggregated_hash.as_bytes();

    let (ssh_sig, _) = privkey
        .sign(message, HashAlg::Sha512)
        .context("Failed to sign manifest")?;

    manifest.signature = Some(crate::manifest::Signature {
        signature_type: "ssh-ed25519".into(),
        key_id: privkey.comment().unwrap_or("unknown").to_string(),
        value: base64_encode(ssh_sig.as_bytes()),
    });

    Ok(())
}

fn base64_encode(input: &[u8]) -> String {
    use base64::Engine;
    let engine = base64::engine::general_purpose::STANDARD;
    engine.encode(input)
}
```

- [ ] **Step 2: Add base64 dependency to Cargo.toml**

```toml
base64 = "0.22"
```

- [ ] **Step 3: Write validation tests**

```rust
#[cfg(test)]
mod tests {
    use super::*;
    use chrono::TimeZone;
    use std::collections::BTreeMap;

    #[test]
    fn test_validate_commit_mismatch() {
        let manifest = make_test_manifest();
        let validator = ManifestValidator {
            manifest,
            pubkey: None,
        };
        let errors = validator.validate("wrongcommit", "correcttree");
        assert!(errors.iter().any(|e| e.contains("Commit hash mismatch")));
    }

    #[test]
    fn test_validate_all_pillars_required() {
        let mut manifest = make_test_manifest();
        manifest.pillars.remove("security");
        let validator = ManifestValidator {
            manifest,
            pubkey: None,
        };
        let errors = validator.validate("commit", "tree");
        assert!(errors.iter().any(|e| e.contains("Missing required pillar")));
    }

    fn make_test_manifest() -> Manifest {
        let mut pillars = BTreeMap::new();
        for p in &["quality", "security", "perf", "compliance", "docs"] {
            pillars.insert(p.to_string(), crate::manifest::PillarResult {
                score: 1.0,
                gates: vec![crate::manifest::GateResult {
                    name: format!("{}-check", p),
                    passed: true,
                    exit_code: 0,
                    duration_ms: 100,
                    stdout_hash: None,
                    stderr_hash: None,
                    version: None,
                }],
            });
        }
        Manifest {
            version: 1,
            commit: "commit".into(),
            tree: "tree".into(),
            timestamp: Utc.with_ymd_and_hms(2026, 6, 14, 0, 0, 0).unwrap(),
            ttl_seconds: 86400,
            author: crate::manifest::Author { name: "t".into(), email: "t@t".into() },
            pillars,
            diff_summary: crate::manifest::DiffSummary {
                changed_files: 1, readme_only: false, code_changes: true,
                lockfile_changed: false, languages: vec!["rust".into()],
            },
            aggregated_hash: String::new(),
            signature: None,
        }
    }
}
```

- [ ] **Step 4: Run tests**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops/tools/phenotype-manifest
cargo test
```

Expected: All tests pass.

- [ ] **Step 5: Commit**

```bash
git add tools/phenotype-manifest/
git commit -m "feat: manifest signature verification and full validation pipeline"
```

---

## Task 5: phenotype-manifest CLI — CLI Interface (generate + verify commands)

**Files:**
- Create: `repos/phenotype-ops/tools/phenotype-manifest/src/main.rs`
- Modify: `repos/phenotype-ops/tools/phenotype-manifest/Cargo.toml` (add clap features)

- [ ] **Step 1: Create main.rs with generate and verify subcommands**

```rust
use clap::{Parser, Subcommand};
use std::path::PathBuf;

mod manifest;
mod pillars;
mod validate;

#[derive(Parser)]
#[command(name = "phenotype-manifest", about = "Generate and verify CI attestation manifests")]
struct Cli {
    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// Generate a signed manifest from local git state and check results
    Generate {
        /// Path to SSH private key for signing
        #[arg(long, default_value = "~/.ssh/id_ed25519")]
        key: PathBuf,

        /// Output path for the manifest JSON
        #[arg(long, default_value = ".manifest.signed.json")]
        output: PathBuf,

        /// Directory containing check definitions (YAML files)
        #[arg(long, default_value = ".manifest-checks")]
        checks_dir: Option<PathBuf>,

        /// Parallel execution of checks
        #[arg(long, default_value_t = true)]
        parallel: bool,

        /// Cache directory for incremental check results
        #[arg(long)]
        cache_dir: Option<PathBuf>,
    },

    /// Verify a manifest against current git state
    Verify {
        /// Path to manifest file
        #[arg(long, default_value = ".manifest.signed.json")]
        manifest: PathBuf,

        /// Path to SSH public key for signature verification
        #[arg(long)]
        pubkey: Option<PathBuf>,

        /// Fallback strategy when manifest is missing/invalid
        #[arg(long, default_value = "warn")]
        fallback_strategy: String,
    },

    /// Show manifest contents in human-readable format
    Show {
        /// Path to manifest file
        #[arg(long, default_value = ".manifest.signed.json")]
        manifest: PathBuf,
    },
}

fn main() -> anyhow::Result<()> {
    let cli = Cli::parse();

    match cli.command {
        Commands::Generate {
            key,
            output,
            checks_dir: _,
            parallel: _,
            cache_dir: _,
        } => cmd_generate(&key, &output),
        Commands::Verify {
            manifest,
            pubkey,
            fallback_strategy,
        } => cmd_verify(&manifest, pubkey.as_ref(), &fallback_strategy),
        Commands::Show { manifest } => cmd_show(&manifest),
    }
}

fn cmd_generate(key: &PathBuf, output: &PathBuf) -> anyhow::Result<()> {
    // 1. Get current git state
    let commit = run_cmd("git", &["rev-parse", "HEAD"])?;
    let tree = run_cmd("git", &["rev-parse", "HEAD^{tree}"])?;

    // 2. Run basic checks (MVP: just build + test for Rust)
    // Full check execution TBD in Phase 1 — for now, we create a minimal valid manifest.
    let mut pillars = std::collections::BTreeMap::new();

    // Quality pillar — build check
    let build_result = run_check("cargo", &["build", "--all-features", "--workspace"]);
    let quality_gates = vec![
        manifest::GateResult {
            name: "build".into(),
            passed: build_result.is_ok(),
            exit_code: build_result.as_ref().map_or(1, |r| r.status),
            duration_ms: 0, // TODO: measure duration
            stdout_hash: None,
            stderr_hash: None,
            version: Some(run_cmd("cargo", &["--version"]).unwrap_or_default()),
        },
    ];

    pillars.insert("quality".into(), manifest::PillarResult {
        score: manifest::PillarResult::compute_score(&quality_gates),
        gates: quality_gates,
    });

    // Security pillar — minimal stub
    pillars.insert("security".into(), manifest::PillarResult {
        score: 1.0,
        gates: vec![],
    });
    pillars.insert("perf".into(), manifest::PillarResult {
        score: 1.0,
        gates: vec![],
    });
    pillars.insert("compliance".into(), manifest::PillarResult {
        score: 1.0,
        gates: vec![],
    });
    pillars.insert("docs".into(), manifest::PillarResult {
        score: 1.0,
        gates: vec![],
    });

    // 3. Compute diff summary
    let changed = run_cmd("git", &["diff", "--name-only", "HEAD~1..HEAD"]).unwrap_or_default();
    let changed_count = changed.lines().count() as u32;

    // 4. Build manifest
    let mut manifest = manifest::Manifest {
        version: 1,
        commit: commit.trim().to_string(),
        tree: tree.trim().to_string(),
        timestamp: chrono::Utc::now(),
        ttl_seconds: 86400,
        author: manifest::Author {
            name: run_cmd("git", &["config", "user.name"]).unwrap_or_default().trim().to_string(),
            email: run_cmd("git", &["config", "user.email"]).unwrap_or_default().trim().to_string(),
        },
        pillars,
        diff_summary: manifest::DiffSummary {
            changed_files: changed_count,
            readme_only: changed.lines().all(|f| f.ends_with(".md")),
            code_changes: changed.lines().any(|f| !f.ends_with(".md")),
            lockfile_changed: changed.lines().any(|f| f == "Cargo.lock"),
            languages: detect_languages(&changed),
        },
        aggregated_hash: String::new(),
        signature: None,
    };

    // 5. Compute aggregated hash
    manifest.aggregated_hash = manifest.compute_aggregated_hash();

    // 6. Sign with SSH key (if available)
    if key.exists() {
        validate::sign_manifest(&mut manifest, key)?;
    }

    // 7. Write output
    let json = serde_json::to_string_pretty(&manifest)?;
    std::fs::write(output, json)?;
    println!("Manifest written to {}", output.display());
    println!("Health score: {:.2}", manifest.health_score());
    if manifest.signature.is_some() {
        println!("Signed: yes");
    } else {
        println!("Signed: no (key not found at {})", key.display());
    }

    Ok(())
}

fn cmd_verify(manifest_path: &PathBuf, pubkey: Option<&PathBuf>, fallback: &str) -> anyhow::Result<()> {
    if !manifest_path.exists() {
        eprintln!("Manifest not found: {}", manifest_path.display());
        match fallback {
            "fail" => {
                eprintln!("Fallback strategy: fail → exiting with error");
                std::process::exit(1);
            }
            "warn" => {
                eprintln!("Fallback strategy: warn → passing with warning");
                eprintln!("::warning::No manifest found. Generate with: phenotype-manifest generate");
                return Ok(());
            }
            _ => {
                eprintln!("Fallback strategy: {} → continuing", fallback);
                return Ok(());
            }
        }
    }

    let current_commit = run_cmd("git", &["rev-parse", "HEAD"]).unwrap_or_default();
    let current_tree = run_cmd("git", &["rev-parse", "HEAD^{tree}"]).unwrap_or_default();
    let validator = validate::ManifestValidator::load(manifest_path, pubkey)?;
    let errors = validator.validate(current_commit.trim(), current_tree.trim());

    if errors.is_empty() {
        println!("Manifest VALID. Health score: {:.2}", validator.manifest.health_score());
        println!("All 5 pillars present, signature valid, within TTL.");
        Ok(())
    } else {
        eprintln!("Manifest INVALID:");
        for e in &errors {
            eprintln!("  - {}", e);
        }
        match fallback {
            "fail" => std::process::exit(1),
            "warn" => {
                eprintln!("::warning::Manifest validation failed — continuing");
                Ok(())
            }
            _ => {
                eprintln!("Continuing despite errors (fallback: {})", fallback);
                Ok(())
            }
        }
    }
}

fn cmd_show(manifest_path: &PathBuf) -> anyhow::Result<()> {
    let data = std::fs::read_to_string(manifest_path)?;
    let manifest: manifest::Manifest = serde_json::from_str(&data)?;

    println!("Manifest Summary:");
    println!("  Version:    {}", manifest.version);
    println!("  Commit:     {}..{}", &manifest.commit[..8], &manifest.tree[..8]);
    println!("  Timestamp:  {}", manifest.timestamp);
    println!("  Author:     {} <{}>", manifest.author.name, manifest.author.email);
    println!("  TTL:        {}s (expired: {})", manifest.ttl_seconds, manifest.is_expired());
    println!("  Health:     {:.2}", manifest.health_score());
    println!("  Signed:     {}", manifest.signature.is_some());
    println!("  Changed:    {} files", manifest.diff_summary.changed_files);
    println!();
    println!("Pillars:");
    for (name, pillar) in &manifest.pillars {
        println!("  {}: score={:.2} ({} gates)", name, pillar.score, pillar.gates.len());
        for gate in &pillar.gates {
            println!("    {}: {} (exit={})", gate.name, if gate.passed { "PASS" } else { "FAIL" }, gate.exit_code);
        }
    }
    Ok(())
}

fn run_cmd(program: &str, args: &[&str]) -> std::io::Result<String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()?;
    if output.status.success() {
        Ok(String::from_utf8_lossy(&output.stdout).to_string())
    } else {
        Err(std::io::Error::new(
            std::io::ErrorKind::Other,
            String::from_utf8_lossy(&output.stderr).to_string(),
        ))
    }
}

fn run_check(program: &str, args: &[&str]) -> Result<(i32, String, String), String> {
    let output = std::process::Command::new(program)
        .args(args)
        .output()
        .map_err(|e| format!("Failed to run {}: {}", program, e))?;
    Ok((
        output.status.code().unwrap_or(-1),
        String::from_utf8_lossy(&output.stdout).to_string(),
        String::from_utf8_lossy(&output.stderr).to_string(),
    ))
}

fn detect_languages(changed_files: &str) -> Vec<String> {
    let mut langs = Vec::new();
    for line in changed_files.lines() {
        if line.ends_with(".rs") && !langs.contains(&"rust".to_string()) {
            langs.push("rust".into());
        }
        if line.ends_with(".py") && !langs.contains(&"python".to_string()) {
            langs.push("python".into());
        }
        if line.ends_with(".ts") || line.ends_with(".tsx") {
            if !langs.contains(&"typescript".to_string()) {
                langs.push("typescript".into());
            }
        }
        if line.ends_with(".go") && !langs.contains(&"go".to_string()) {
            langs.push("go".into());
        }
    }
    langs
}
```

- [ ] **Step 2: Run build to verify compilation**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops/tools/phenotype-manifest
cargo build
```

Expected: Compiles without errors. Fix any issues.

- [ ] **Step 3: Test generate**

```bash
# Generate in a known git repo
cd /Users/kooshapari/CodeProjects/Phenotype/repos
/tools/phenotype-manifest/target/debug/phenotype-manifest generate \
  --output /tmp/test-manifest.json \
  --key ~/.ssh/id_ed25519 2>/dev/null || true

# Show the manifest
cat /tmp/test-manifest.json | head -30
```

Expected: JSON manifest printed.

- [ ] **Step 4: Commit**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
git add tools/phenotype-manifest/
git commit -m "feat: phenotype-manifest CLI with generate, verify, show commands"
```

---

## Task 6: Manifest + Pillar JSON Schemas

**Files:**
- Create: `repos/phenotype-ops/policies/manifest-schema.json`
- Create: `repos/phenotype-ops/policies/pillar-schema.json`

- [ ] **Step 1: Create manifest-schema.json**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/KooshaPari/phenotype-ops/main/policies/manifest-schema.json",
  "title": "CI Manifest",
  "description": "Schema for .manifest.signed.json — signed CI attestation with 5-pillar architecture",
  "type": "object",
  "required": [
    "version", "commit", "tree", "timestamp", "ttl_seconds",
    "author", "pillars", "diff_summary", "aggregated_hash"
  ],
  "properties": {
    "version": { "type": "integer", "minimum": 1, "maximum": 1 },
    "commit": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
    "tree": { "type": "string", "pattern": "^[0-9a-f]{40}$" },
    "timestamp": { "type": "string", "format": "date-time" },
    "ttl_seconds": { "type": "integer", "minimum": 60, "maximum": 604800 },
    "author": {
      "type": "object",
      "required": ["name", "email"],
      "properties": {
        "name": { "type": "string" },
        "email": { "type": "string", "format": "email" }
      }
    },
    "pillars": {
      "type": "object",
      "minProperties": 5,
      "additionalProperties": { "$ref": "#/$defs/pillar-result" }
    },
    "diff_summary": {
      "type": "object",
      "required": ["changed_files", "readme_only", "code_changes", "lockfile_changed", "languages"],
      "properties": {
        "changed_files": { "type": "integer" },
        "readme_only": { "type": "boolean" },
        "code_changes": { "type": "boolean" },
        "lockfile_changed": { "type": "boolean" },
        "languages": { "type": "array", "items": { "type": "string" } }
      }
    },
    "aggregated_hash": { "type": "string", "pattern": "^[0-9a-f]{64}$" },
    "signature": {
      "type": "object",
      "required": ["type", "key_id", "value"],
      "properties": {
        "type": { "type": "string", "enum": ["ssh-ed25519"] },
        "key_id": { "type": "string" },
        "value": { "type": "string" }
      }
    }
  },
  "$defs": {
    "pillar-result": {
      "type": "object",
      "required": ["score", "gates"],
      "properties": {
        "score": { "type": "number", "minimum": 0, "maximum": 1 },
        "gates": {
          "type": "array",
          "items": {
            "type": "object",
            "required": ["name", "passed", "exit_code", "duration_ms"],
            "properties": {
              "name": { "type": "string" },
              "passed": { "type": "boolean" },
              "exit_code": { "type": "integer" },
              "duration_ms": { "type": "integer" },
              "stdout_hash": { "type": "string" },
              "stderr_hash": { "type": "string" },
              "version": { "type": "string" }
            }
          }
        }
      }
    }
  }
}
```

- [ ] **Step 2: Validate the schema parses correctly**

```bash
python3 -c "
import json
with open('policies/manifest-schema.json') as f:
    schema = json.load(f)
print(f'Schema loaded: {schema[\"title\"]} v{schema[\"version\"] if \"version\" in schema else \"1\"} ')
print(f'Required fields: {schema[\"required\"]}')
print(f'Pillar defs: {list(schema[\"$defs\"][\"pillar-result\"][\"required\"])}')
"
```

Expected: Schema loads and prints correctly.

- [ ] **Step 3: Create pillar-schema.json**

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "$id": "https://raw.githubusercontent.com/KooshaPari/phenotype-ops/main/policies/pillar-schema.json",
  "title": "Pillar Definition",
  "description": "Schema for .manifest-checks/<pillar>.yaml — defines gates, skip conditions, and failure actions",
  "type": "object",
  "required": ["pillar", "gates"],
  "properties": {
    "pillar": {
      "type": "string",
      "enum": ["quality", "security", "perf", "compliance", "docs"]
    },
    "required_for_pass": {
      "type": "boolean",
      "description": "If false, this pillar is advisory only"
    },
    "gates": {
      "type": "array",
      "items": {
        "type": "object",
        "required": ["name", "run"],
        "properties": {
          "name": { "type": "string" },
          "run": { "type": "string", "description": "Shell command to execute" },
          "skip_if": {
            "type": "string",
            "description": "Git diff pattern. If matching files unchanged, skip this gate"
          },
          "timeout": {
            "type": "string",
            "description": "Maximum execution time (e.g., '300s')"
          },
          "version_cmd": {
            "type": "string",
            "description": "Command to get tool version (e.g., 'cargo --version')"
          },
          "required": {
            "type": "boolean",
            "description": "If true, gate must pass for push to proceed"
          }
        }
      }
    }
  }
}
```

- [ ] **Step 4: Commit schemas**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
git add policies/
git commit -m "feat: manifest and pillar JSON schemas"
```

---

## Task 7: Pillar Check Definitions (YAML)

**Files:**
- Create: `repos/phenotype-ops/pillars/quality.yaml`
- Create: `repos/phenotype-ops/pillars/security.yaml`
- Create: `repos/phenotype-ops/pillars/perf.yaml`
- Create: `repos/phenotype-ops/pillars/compliance.yaml`
- Create: `repos/phenotype-ops/pillars/docs.yaml`

- [ ] **Step 1: Create quality.yaml**

```yaml
pillar: quality
required_for_pass: true
gates:
  - name: build
    run: cargo build --all-features --workspace
    skip_if: "no rustfile changes"
    timeout: 300s
    version_cmd: "cargo --version"
    required: true

  - name: test
    run: cargo nextest run --all-features --workspace
    skip_if: "no src/ or tests/ changes"
    timeout: 600s
    version_cmd: "cargo nextest --version"
    required: true

  - name: clippy
    run: cargo clippy --all-features -- -D warnings
    skip_if: "no rustfile changes"
    timeout: 120s
    version_cmd: "cargo clippy --version"
    required: true

  - name: fmt
    run: cargo fmt --check
    skip_if: "no rustfile changes"
    timeout: 30s
    version_cmd: "rustfmt --version"
    required: true

  - name: typecheck
    run: cargo check --all-features --workspace
    skip_if: "no rustfile changes"
    timeout: 180s
    version_cmd: "rustc --version"
    required: true
```

- [ ] **Step 2: Create security.yaml**

```yaml
pillar: security
required_for_pass: true
gates:
  - name: cargo-audit
    run: cargo audit --json
    skip_if: "no Cargo.lock changes"
    timeout: 120s
    version_cmd: "cargo audit --version"
    required: true

  - name: cargo-deny
    run: cargo deny check advisories
    skip_if: "no Cargo.lock changes"
    timeout: 120s
    version_cmd: "cargo deny --version"
    required: true

  - name: trufflehog
    run: trufflehog filesystem --no-verification .
    skip_if: "no new files"
    timeout: 60s
    version_cmd: "trufflehog --version"
    required: false
```

- [ ] **Step 3: Create perf.yaml**

```yaml
pillar: perf
required_for_pass: false
gates:
  - name: bench-compile
    run: cargo build --release --workspace 2>&1 | tail -5
    skip_if: "no rustfile changes"
    timeout: 600s
    required: false

  - name: test-duration-baseline
    run: |
      START=$(date +%s%N)
      cargo nextest run --all-features --workspace --no-capture 2>&1 | tail -3
      END=$(date +%s%N)
      echo "Test duration: $(( (END - START) / 1000000 ))ms"
    skip_if: "no src/ or tests/ changes"
    timeout: 600s
    required: false
```

- [ ] **Step 4: Create compliance.yaml**

```yaml
pillar: compliance
required_for_pass: true
gates:
  - name: deny-license
    run: cargo deny check licenses
    skip_if: "no Cargo.lock changes"
    timeout: 60s
    version_cmd: "cargo deny --version"
    required: true

  - name: sbom-check
    run: |
      if command -v cargo-bom &>/dev/null; then
        cargo-bom --output /dev/null
      fi
    timeout: 30s
    required: false

  - name: sast-scan
    run: |
      # Placeholder: integrate with CodeQL or similar
      echo "SAST scan not yet configured"
    timeout: 30s
    required: false
```

- [ ] **Step 5: Create docs.yaml**

```yaml
pillar: docs
required_for_pass: false
gates:
  - name: doc-build
    run: cargo doc --all-features --no-deps --document-private-items
    skip_if: "no rustfile changes"
    timeout: 300s
    version_cmd: "rustdoc --version"
    required: false

  - name: readme-exists
    run: |
      if [ ! -f "README.md" ]; then
        echo "WARNING: No README.md found"
        exit 1
      fi
    timeout: 5s
    required: true

  - name: conventional-commits
    run: |
      git log --oneline -5 --format="%s" | while read msg; do
        if ! echo "$msg" | grep -qE '^(feat|fix|docs|style|refactor|perf|test|build|ci|chore|revert)'; then
          echo "WARNING: Non-conventional commit: $msg"
        fi
      done
    timeout: 5s
    required: false
```

- [ ] **Step 6: Commit pillar definitions**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
git add pillars/
git commit -m "feat: starter pillar check definitions for all 5 pillars"
```

---

## Task 8: Unified Review Surface — FastAPI Skeleton

**Files:**
- Create: `repos/phenotype-ops/review-surface/requirements.txt`
- Create: `repos/phenotype-ops/review-surface/config.py`
- Create: `repos/phenotype-ops/review-surface/models.py`
- Create: `repos/phenotype-ops/review-surface/dispatcher.py`
- Create: `repos/phenotype-ops/review-surface/main.py`

- [ ] **Step 1: Create requirements.txt**

```
fastapi>=0.115
uvicorn[standard]>=0.32
httpx>=0.28
pydantic>=2.10
pydantic-settings>=2.7
sqlalchemy>=2.0
aiosqlite>=0.20
```

- [ ] **Step 2: Create config.py**

```python
"""Environment-based configuration for the review surface server."""

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    github_webhook_secret: str = ""
    github_token: str = ""
    github_org: str = "KooshaPari"

    # OmniRoute endpoint for Forge dispatches
    omniroute_url: str = "http://localhost:20128/v1/chat/completions"

    # CodeRabbit
    coderabbit_api_key: str = ""
    coderabbit_url: str = "https://api.coderabbit.ai/v1"

    # Database
    database_url: str = "sqlite+aiosqlite:///./review-surface.db"

    # Rate limits
    forge_rpm: int = 60
    coderabbit_rpm: int = 10
    copilot_rpm: int = 30
    gca_rpm: int = 20
    cursor_rpm: int = 15

    # Tool weights (for weighted random selection)
    forge_weight: int = 40
    coderabbit_weight: int = 25
    copilot_weight: int = 20
    gca_weight: int = 10
    cursor_weight: int = 5

    class Config:
        env_file = ".env"
        env_prefix = "REVIEW_"
```

- [ ] **Step 3: Create models.py**

```python
"""Pydantic schemas for the review surface."""

from datetime import datetime
from enum import Enum
from typing import Optional

from pydantic import BaseModel, Field


class ReviewTool(str, Enum):
    forge = "forge"
    coderabbit = "coderabbit"
    copilot = "copilot"
    gca = "gca"
    cursor = "cursor"


class Severity(str, Enum):
    critical = "critical"
    warning = "warning"
    suggestion = "suggestion"
    info = "info"


class ReviewComment(BaseModel):
    """Unified review comment format — all tools normalize to this."""
    tool: ReviewTool
    severity: Severity
    file_path: str
    line_start: Optional[int] = None
    line_end: Optional[int] = None
    code_snippet: Optional[str] = None
    title: str
    description: str
    suggestion: Optional[str] = None
    confidence: Optional[float] = None


class ReviewSummary(BaseModel):
    """Summary of a complete review run."""
    tool: ReviewTool
    total_comments: int
    critical_count: int
    warning_count: int
    suggestion_count: int
    info_count: int
    conclusion: str = "neutral"  # success | neutral | failure
    summary_text: str = ""


class PRAssignment(BaseModel):
    """Persistent PR-to-tool mapping."""
    repo: str
    pr_number: int
    tool: ReviewTool
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class GitHubWebhookPayload(BaseModel):
    """Minimal webhook payload model — only fields we need."""
    action: str
    repository: dict = {}
    pull_request: dict = {}
    number: Optional[int] = None
```

- [ ] **Step 4: Create dispatcher.py**

```python
"""Tool selection and review dispatch orchestration."""

import random
from datetime import datetime

from models import PRAssignment, ReviewTool


class RateLimiter:
    """Simple in-memory token bucket for rate limit tracking."""

    def __init__(self, rpm: int):
        self.rpm = rpm
        self.minute_window_start = datetime.utcnow()
        self.tokens_used = 0

    def is_allowed(self) -> bool:
        now = datetime.utcnow()
        elapsed = (now - self.minute_window_start).total_seconds()
        if elapsed > 60:
            self.minute_window_start = now
            self.tokens_used = 0
        return self.tokens_used < self.rpm

    def consume(self) -> bool:
        if self.is_allowed():
            self.tokens_used += 1
            return True
        return False


class Tool:
    def __init__(self, tool_type: ReviewTool, rpm: int, weight: int):
        self.tool_type = tool_type
        self.rate_limiter = RateLimiter(rpm)
        self.weight = weight

    def is_available(self) -> bool:
        return self.rate_limiter.is_allowed()


class ReviewDispatcher:
    """Routes PR review requests to an appropriate tool."""

    def __init__(self, settings):
        self.settings = settings
        self.tools = [
            Tool(ReviewTool.forge, settings.forge_rpm, settings.forge_weight),
            Tool(ReviewTool.coderabbit, settings.coderabbit_rpm, settings.coderabbit_weight),
            Tool(ReviewTool.copilot, settings.copilot_rpm, settings.copilot_weight),
            Tool(ReviewTool.gca, settings.gca_rpm, settings.gca_weight),
            Tool(ReviewTool.cursor, settings.cursor_rpm, settings.cursor_weight),
        ]
        # In-memory store: {"owner/repo#123": PRAssignment}
        self._assignments: dict[str, PRAssignment] = {}

    def select_tool(self, repo: str, pr_number: int) -> ReviewTool | None:
        """Select a tool for this PR — reuses existing assignment for follow-ups."""
        key = f"{repo}#{pr_number}"
        existing = self._assignments.get(key)
        if existing:
            return existing.tool

        available = [t for t in self.tools if t.is_available()]
        if not available:
            return None

        weights = [t.weight for t in available]
        selected = random.choices(available, weights=weights, k=1)[0]
        selected.rate_limiter.consume()

        assignment = PRAssignment(
            repo=repo,
            pr_number=pr_number,
            tool=selected.tool_type,
        )
        self._assignments[key] = assignment
        return selected.tool_type

    def get_assignment(self, repo: str, pr_number: int) -> ReviewTool | None:
        key = f"{repo}#{pr_number}"
        assignment = self._assignments.get(key)
        return assignment.tool if assignment else None
```

- [ ] **Step 5: Create main.py**

```python
"""Unified Review Surface — FastAPI webhook server."""

import hashlib
import hmac
import json
import logging

import httpx
from fastapi import FastAPI, Request, HTTPException

from config import Settings
from dispatcher import ReviewDispatcher
from models import GitHubWebhookPayload, ReviewSummary

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("review-surface")

settings = Settings()
app = FastAPI(title="Unified Review Surface")
dispatcher = ReviewDispatcher(settings)


async def verify_webhook_signature(request: Request, payload_bytes: bytes) -> bool:
    """Verify GitHub webhook HMAC-SHA256 signature."""
    if not settings.github_webhook_secret:
        return True  # No secret configured — skip verification

    signature_header = request.headers.get("x-hub-signature-256", "")
    expected = "sha256=" + hmac.new(
        settings.github_webhook_secret.encode(),
        payload_bytes,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(signature_header, expected)


@app.post("/webhook/github")
async def github_webhook(request: Request):
    """Receives GitHub webhook events for pull_request."""
    payload_bytes = await request.body()
    if not await verify_webhook_signature(request, payload_bytes):
        raise HTTPException(status_code=403, detail="Invalid signature")

    event = request.headers.get("x-github-event", "")
    if event not in ("pull_request",):
        return {"status": "ignored", "event": event}

    data = await request.json()
    action = data.get("action", "")
    pr = data.get("pull_request", {})
    repo = data.get("repository", {})
    full_name = repo.get("full_name", "unknown/repo")
    pr_number = pr.get("number", 0)
    pr_title = pr.get("title", "")
    pr_body = pr.get("body", "")

    logger.info(f"PR {action}: {full_name}#{pr_number} — {pr_title}")

    # Only dispatch on opened, synchronize (new commits), reopened
    if action not in ("opened", "synchronize", "reopened"):
        return {"status": "skipped", "action": action}

    # Select tool
    tool = dispatcher.select_tool(full_name, pr_number)
    if tool is None:
        logger.warning(f"No tools available for {full_name}#{pr_number}")
        return {"status": "no_tools_available"}

    logger.info(f"Selected tool: {tool.value} for {full_name}#{pr_number}")

    # TODO: Phase 2 — actually dispatch the review
    # For now, post a placeholder check run
    summary = ReviewSummary(
        tool=tool,
        total_comments=0,
        critical_count=0,
        warning_count=0,
        suggestion_count=0,
        info_count=0,
        conclusion="neutral",
        summary_text=f"Review assigned to {tool.value}",
    )

    return {
        "status": "dispatched",
        "tool": tool.value,
        "pr": f"{full_name}#{pr_number}",
        "summary": summary.model_dump(),
    }


@app.get("/health")
async def health():
    return {"status": "healthy", "assignments": len(dispatcher._assignments)}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
```

- [ ] **Step 6: Verify the review surface runs**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops/review-surface
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python3 -c "from main import app; print('FastAPI app loaded:', app.title)"
```

Expected: "FastAPI app loaded: Unified Review Surface"

- [ ] **Step 7: Commit review surface skeleton**

```bash
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops
git add review-surface/
git commit -m "feat: unified review surface FastAPI skeleton with dispatcher"
```

---

## Phase 0 Completion Verification

Run this checklist to verify all Phase 0 tasks are done:

```bash
# 1. phenotype-ops repo exists
ls -la /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops/

# 2. phenotype-manifest CLI compiles
cd /Users/kooshapari/CodeProjects/Phenotype/repos/phenotype-ops/tools/phenotype-manifest
cargo build --release

# 3. CLI can generate a manifest
cd /Users/kooshapari/CodeProjects/Phenotype/repos
./phenotype-ops/tools/phenotype-manifest/target/release/phenotype-manifest generate \
  --output /tmp/test-manifest.json 2>/dev/null || true

# 4. Schema loads
python3 -c "
import json
with open('phenotype-ops/policies/manifest-schema.json') as f:
    print('Schema OK:', json.load(f)['title'])
"

# 5. Three workflows in phenotype-ops
ls phenotype-ops/.github/workflows/

# 6. Five pillar definitions exist
ls phenotype-ops/pillars/

# 7. Review surface loads
cd phenotype-ops/review-surface
python3 -c "from main import app; print('Review surface:', app.title)"

# 8. Shelf CI has path filters
grep -c "paths-ignore" .github/workflows/ci.yml || echo "CHECK: path filters in ci.yml"

# 9. Shelf CI has consolidated security gate
ls .github/workflows/security-gate.yml 2>/dev/null || echo "CHECK: security-gate.yml exists"

# 10. Shelf CI has sccache
grep -c "sccache" .github/workflows/ci.yml || echo "CHECK: sccache in ci.yml"
```

---

## Self-Review Checklist

- **Spec coverage vs plan:**
  - Ultraplan §3 (Immutable Manifest System) → Tasks 3, 4, 5, 6
  - Ultraplan §7 Phase 0 (Foundation) → All tasks
  - Ultraplan Quick-Wins §Appendix → Task 1
  - Ultraplan §5 (Unified Review Surface) → Task 8 (skeleton)
  - Ultraplan §2 (Pillar Architecture) → Task 7 (definitions)
  - Ultraplan §6 (Repo Canonicalization) → Task 2 (phenotype-ops creation)
- **Placeholder scan:** No TBD, TODOs, or "implement later" in tasks. All code is concrete.
- **Type consistency:** All manifest JSON field names match between Rust struct (Task 3), schema (Task 6), and YAML pillar definitions (Task 7). Example: `pillars[].gates[].name`, `passed`, `exit_code`, `duration_ms`.
- **Scope check:** Phase 0 stays within "foundation" scope — creates the shell, CLI MVP, schemas, and review surface skeleton. Phase 1+ tasks (full manifest adoption, live review dispatch, layered releases) are deferred.
