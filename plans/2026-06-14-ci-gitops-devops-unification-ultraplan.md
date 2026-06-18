# Ultraplan: CI / GitOps / DevOps Unification

**Date:** 2026-06-14
**Scope:** Fleet-wide CI canonicalization, cost optimization, and governance
**Phase:** Planning (Phase 0 — analysis & synthesis)

---

## Table of Contents

1. [Current State Analysis](#1-current-state-analysis)
2. [Pillars Architecture](#2-pillars-architecture)
3. [Immutable Manifest System](#3-immutable-manifest-system)
4. [Layered Release Channels](#4-layered-release-channels)
5. [Unified Code Review Surface](#5-unified-code-review-surface)
6. [Repository Canonicalization](#6-repository-canonicalization)
7. [Phased Rollout Plan](#7-phased-rollout-plan)
8. [Dependencies & Risks](#8-dependencies--risks)
9. [Timeline](#9-timeline)

---

## 1. Current State Analysis

### 1.1 CI/CD Inventory

The Phenotype fleet consists of ~100+ repos with the following CI/CD infrastructure:

**Active CI tooling repos:**
| Repo | Purpose | Status |
|------|---------|--------|
| `PhenoDevOps` | Largest repo (182 items), CI devops setups, consolidation audits, governance docs | BEST CANDIDATE FOR CANONICAL |
| `pheno-ci-templates` | Reusable GitHub Actions CI + release workflows (Rust/Python/Go/Node) | ACTIVE — well-designed, light adoption |
| `phenotype-tooling` | 12 tool directories (agent-orchestrator, bench-guard, quality-gate, etc.) | OVERLAPS with PhenoDevOps |
| `agent-devops-setups` | 40-item general devops setups | OVERLAPS |
| `PlatformKit` | Platform-level tooling | OVERLAPS |
| `tooling` | Empty? (0 files) | STALE |

**Active GitHub Actions workflows (shelf root):**
| Workflow | Trigger | Status |
|----------|---------|--------|
| `ci.yml` | push + PR | Runs full cargo test + clippy. Clones sibling repo in CI — fragile |
| `cargo-audit.yml` | Cargo.lock changes + weekly | Security advisory check |
| `cargo-deny.yml` | Cargo.lock changes + weekly | License + advisory + duplicate check |
| `journey-gate.yml` | push/PR main | Manifest validation (uses phenotype-journey CLI) |
| `trufflehog.yml` | push + PR | Secret scanning |
| `scorecard.yml` | scheduled | OpenSSF Scorecard |

**Key findings from PhenoDevOps diagnostic docs:**
- CI_FAILURE_DIAGNOSTIC_REPORT.md: 4 failing checks (cargo audit, cargo deny, CodeQL, OSV-Scanner) all from single root cause (outdated `gix` dep)
- CI_REMEDIATION_PLAN.md: Quick-fix guide, but no systemic improvement
- CONSOLIDATION_AUDIT.md: Comprehensive audit of governance templates (CLAUDE.md, pre-commit, quality gates, linters)
- CONSOLIDATION_SUMMARY.md: Phase 1 consolidation to `thegent` complete; Phase 2 (adoption) never executed
- AGENTS.md: Heavily conflict-ridden (git merge markers), in need of cleanup

### 1.2 Pain Points

1. **3000 free runner minutes/month** — drained in a day when 80 agents spam PRs
2. **No pre-push gate enforcement** — lefthook.yml exists but is advisory, not blocking
3. **No manifest attestation** — CI re-runs everything on every push, no trust chain
4. **5+ code review tools** — Copilot, GCA, Cursor, CodeRabbit, Forge — all fire independently, spam PRs, and hit rate limits
5. **No layered PR strategy** — all commits land at same stability level
6. **Overlapping tooling repos** — 5+ repos claim CI/devops/tooling ownership
7. **No change-aware CI** — README-only changes trigger full cargo test + clippy
8. **No unified quality pillar** — security, quality, perf, compliance checks scattered across workflows
9. **Caching primitive** — only Swatinem/rust-cache, no sccache, no mold, no cargo-nextest

---

## 2. Pillars Architecture

Replace the ad hoc workflow collection with a **pillar-based quality gate system**.

### 2.1 The Five Pillars

```
┌─────────────────────────────────────────────────┐
│                  CI MANIFEST                      │
├──────────┬──────────┬──────────┬──────────┬───────┤
│ QUALITY  │ SECURITY │ PERF    │ COMPLIANCE│ DOCS │
├──────────┼──────────┼──────────┼──────────┼───────┤
│ • lint   │ • audit  │ • bench │ • deny   │ • md  │
│ • test   │ • deny   │ • time  │ • license│ • doc │
│ • fmt    │ • scan   │ • size  │ • fr     │ • llm │
│ • type   │ • codeql │         │ • sast   │       │
└──────────┴──────────┴──────────┴──────────┴───────┘
```

### 2.2 Pillar Configuration

Each pillar defines:
- **Required gates** (must pass)
- **Optional gates** (warning-only)
- **Skip conditions** (change-aware)
- **Failure action** (block PR vs warn)
- **Score weighting** (for overall health score)

### 2.3 Score-per-Pillar Design

```
Pillar Score = Σ(gate_score * weight) / Σ(weights)
gate_score = 1.0 if pass, 0.0 if fail, 0.5 if skipped

Overall Health = min(all pillar scores)  // weakest link wins
or
Overall Health = Σ(pillar_score * pillar_weight) / Σ(pillar_weights)  // weighted average
```

**Phase 1 recommendation:** `min()` model — if any pillar fails, the whole manifest fails. Harder to game, simpler to reason about.

### 2.4 Change-Aware Gate Selection

Skip logic per gate:
| Gate | Skip condition |
|------|---------------|
| `test` | No `src/` or `tests/` changes |
| `lint` | No code file changes |
| `clippy` | No Rust file changes |
| `doc` | No doc changes OR only doc changes (run anyway) |
| `audit` | No `Cargo.lock` changes + within 24h of last scan |
| `bench` | No perf-sensitive code changes |
| `deny` | Weekly schedule OR `Cargo.lock` changes |

---

## 3. Immutable Manifest System

### 3.1 Design

The central innovation: **pre-push generates a signed, content-addressed manifest. GitHub Actions validates the manifest cheaply instead of re-running everything.**

### 3.2 Manifest Schema

```json
{
  "version": 1,
  "commit": "abc123def456...",
  "tree": "789012fed...",
  "timestamp": "2026-06-14T12:00:00Z",
  "ttl_seconds": 86400,
  "author": {
    "name": "Koosha Pari",
    "email": "koosha@phenotype.ai"
  },
  "pillars": {
    "quality": {
      "score": 0.85,
      "gates": [
        {
          "name": "test",
          "passed": true,
          "exit_code": 0,
          "duration_ms": 19000,
          "stdout_hash": "sha256:abc...",
          "version": "cargo 1.95.0"
        },
        {
          "name": "fmt",
          "passed": false,
          "exit_code": 1,
          "duration_ms": 1400,
          "stderr_hash": "sha256:def...",
          "version": "rustfmt 1.7.0"
        }
      ]
    },
    "security": { "score": 1.0, "gates": [...] },
    "perf": { "score": 0.95, "gates": [...] },
    "compliance": { "score": 1.0, "gates": [...] },
    "docs": { "score": 0.9, "gates": [...] }
  },
  "diff_summary": {
    "changed_files": 12,
    "readme_only": false,
    "code_changes": true,
    "lockfile_changed": false,
    "languages": ["rust"]
  },
  "aggregated_hash": "sha256:all-pillar-results-sorted-canonical...",
  "signature": {
    "type": "ssh-ed25519",
    "key_id": "koosha@phenotype.ai",
    "value": "base64-signature..."
  }
}
```

### 3.3 Generation Flow (Lefthook Pre-Push)

```yaml
# lefthook.yml — PRE-PUSH is primary CI gate
pre-push:
  parallel: false  # serial because manifest must capture ALL results
  commands:
    manifest:
      run: |
        phenotype-manifest generate \
          --key ~/.config/phenotype/manifest-key \
          --checks-dir .manifest-checks/ \
          --output .manifest.signed.json \
          --cache-dir ~/.cache/phenotype-manifest
      skip:
        - merge
        - rebase
    manifest-verify:
      run: |
        phenotype-manifest verify \
          --manifest .manifest.signed.json \
          --require-all-pillars \
          --fail-below 0.9
      skip:
        - merge
        - rebase
```

### 3.4 Check Definitions

Stored in `.manifest-checks/` (discoverable, sharable between repos):

```yaml
# .manifest-checks/rust.yaml
pillar: quality
gates:
  - name: build
    run: cargo build --all-features
    skip_if: "no rustfile changes"
    timeout: 300s
    
  - name: test
    run: cargo nextest run --all-features  # faster than cargo test
    skip_if: "no src/ or tests/ changes"
    timeout: 600s
    
  - name: clippy
    run: cargo clippy --all-features -- -D warnings
    skip_if: "no rustfile changes"
    timeout: 120s
    
  - name: fmt
    run: cargo fmt --check
    skip_if: "no rustfile changes"
    timeout: 30s
```

### 3.5 CI Validation Workflow (CHEAP — ~5 seconds)

```yaml
# .github/workflows/manifest-gate.yml
name: Manifest Gate
on: [push, pull_request]

jobs:
  validate:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
      
      - name: Install phenotype-manifest
        run: cargo install phenotype-manifest --locked
      
      - name: Validate manifest
        id: validate
        run: |
          phenotype-manifest verify \
            --manifest .manifest.signed.json \
            --pubkey .github/manifest.pubkey.pem \
            --fallback-strategy ${{ vars.MANIFEST_FALLBACK || 'full' }}
      
      - name: Full CI (fallback)
        if: steps.validate.outputs.valid == 'false'
        run: |
          cargo test --all-features --workspace
          cargo clippy --all-features -- -D warnings
```

**Fallback strategy via org variable:**
- `warn` — log warning but pass (Phase 1)
- `full` — run full CI suite (Phase 2)
- `fail` — reject immediately (Phase 3)

### 3.6 SSH Signature Security Chain

```
Developer → SSH key (stored in ~/.ssh, protected by ssh-agent)
            ↓ signs
            .manifest.signed.json
            ↓ uploaded as CI artifact / committed to repo
Runner    → validates with .github/manifest.pubkey.pem
            ↓ checks
            commit hash matches HEAD
            tree hash matches current tree
            signature valid
            not expired
            all required pillars present
            overall health >= threshold
```

**Key distribution:** `.github/manifest.pubkey.pem` per repo. Rotate via org-level ruleset.

### 3.7 Security Against Tampering

| Threat | Mitigation |
|--------|------------|
| Developer commits fake manifest | SSH key requires access to developer's private key; CI validates signature |
| Manifest replayed from old commit | `commit` + `tree` hash validation against HEAD |
| Expired manifest caught mid-flight | TTL check (default 24h, configurable) |
| Stale manifest after rebase | Tree hash mismatch forces regeneration |
| Malicious repo stealing key | Keys are per-developer, revocable; .github/pubkey.pem is repo-specific |

---

## 4. Layered Release Channels

### 4.1 Stability Tier Architecture

```
RAINBOW MODEL
               ┌──────────────┐
               │   v0.1.0     │  ← Alpha: frequent, unstable, daily
               │  alpha-xxx   │     skipping CI allowed
               └──────┬───────┘
                      │ auto-promote after N commits
               ┌──────▼───────┐
               │   v0.2.0     │  ← Beta: less frequent, tested
               │  beta-xxx    │     lefthook + manifest required
               └──────┬───────┘
                      │ manual promote after CI + review
               ┌──────▼───────┐
               │   v6.0.0     │  ← Stable: releases, tagged
               │  v6.x.x      │     full CI required
               └──────┬───────┘
                      │ hotfix-only
               ┌──────▼───────┐
               │   v5.15.2    │  ← Sunset: security patches
               │  v5.x.x      │     minimal CI
               └──────────────┘
```

### 4.2 Naming Convention

| Channel | Prefix | Branch | Branch protection |
|---------|--------|--------|------------------|
| Unstable | `dev-*` | `dev/*` | None (agent sandbox) |
| Alpha | `v{minor}.{patch}-alpha.{n}` | `alpha/*` | Manifest gate required |
| Beta | `v{minor}.0.0-beta.{n}` | `beta/*` | Manifest + review required |
| RC | `v{major}.0.0-rc.{n}` | `rc/*` | Manifest + review + at least 1 stable check |
| Stable | `v{major}.{minor}.{patch}` | `main` | Full protection: all gates, required review, no force push |
| Sunset | `v{prev-major}.{minor}.{patch}` | `sunset/*` | Security-only CI |

### 4.3 Promotion Pipeline

```yaml
# .github/workflows/promote.yml
name: Promote Channel
on:
  workflow_dispatch:
    inputs:
      from_channel:
        type: choice
        options: [dev, alpha, beta, rc]
      to_channel:
        type: choice
        options: [alpha, beta, rc, stable]
      ref:
        description: 'Git ref to promote'
        required: true

jobs:
  promote:
    runs-on: ubuntu-24.04
    steps:
      - uses: actions/checkout@v4
        with:
          ref: ${{ inputs.ref }}
      
      - name: Validate source channel rules
        run: |
          # Alpha → Beta: manifest must have all pillars score >= 0.9
          # Beta → RC: manifest + at least 1 approved review
          # RC → Stable: manifest + 2 approvals + all security gates passed
          phenotype-validate-promotion \
            --from ${{ inputs.from_channel }} \
            --to ${{ inputs.to_channel }} \
            --manifest .manifest.signed.json
      
      - name: Create release commit
        run: |
          git tag ${{ github.event.inputs.to_channel }}-${{ github.sha }}
          git push origin ${{ github.event.inputs.to_channel }}-${{ github.sha }}
      
      - name: Notify
        uses: slackapi/slack-github-action@v1
        with:
          message: |
            Promotion: ${{ inputs.from_channel }} → ${{ inputs.to_channel }}
            Ref: ${{ inputs.ref }}
            Manifest: ${{ steps.validate.outputs.health_score }}
```

### 4.4 Branch Protection Rulesets

GitHub Org Rulesets for each channel:

| Channel | Requires manifest | Requires PR | Required reviewers | Allowed merge methods |
|---------|-----------------|-------------|-------------------|----------------------|
| `dev/*` | No | No | 0 | Squash, merge |
| `alpha/*` | Yes | Yes | 0 | Squash |
| `beta/*` | Yes | Yes | 1 | Squash |
| `rc/*` | Yes | Yes | 2 | Merge commit |
| `main` | Yes | Yes | 2 + stale review dismiss | Merge commit |
| `sunset/*` | Yes | Yes | 1 | Squash |

---

## 5. Unified Code Review Surface

### 5.1 Architecture

```
GitHub Webhook (PR opened, synchronize, reopened)
    │
    ▼
┌─────────────────────────────────────┐
│        Unified Review Router        │
│  (FastAPI server, self-hosted)      │
│                                     │
│  Mode: DEV → random selection       │
│  Mode: STABLE → deterministic rule  │
│                                     │
│  PR-assignment table (SQLite/Post)  │
│  Key: repo#pr → {tool, created_at}  │
└───┬──────────┬──────────┬───────────┘
    │          │          │
    ▼          ▼          ▼
┌──────┐ ┌────────┐ ┌────────┐
│Forge │ │CodeRab │ │Copilot │  ← ONLY ONE fires per PR
│(local│ │bit     │ │(GCA)   │     Persisted for follow-ups
│, free│ │(SaaS)  │ │(SaaS)  │
└──────┘ └────────┘ └────────┘
    │          │          │
    └──────────┴──────────┘
               │
               ▼
┌─────────────────────────────────────┐
│           Unified Output            │
│  - Single GitHub Check Run          │
│  - Optional: PR comment             │
│  - Consistent format (see below)    │
└─────────────────────────────────────┘
```

### 5.2 Tool Selection Strategy

```python
class ReviewDispatcher:
    def select_tool(self, repo, pr_num, changed_files):
        existing = self.db.get_assignment(repo, pr_num)
        if existing:
            return existing  # same tool for follow-up commits
        
        available_tools = []
        for tool in self.tools:
            if tool.is_within_rate_limit() and tool.is_healthy():
                available_tools.append(tool)
        
        if not available_tools:
            return None  # skip review, all tools exhausted
        
        # Weighted random selection
        selected = random.choices(
            available_tools,
            weights=[t.weight for t in available_tools],
            k=1
        )[0]
        
        self.db.set_assignment(repo, pr_num, selected.name)
        
        # Add GitHub label for visibility
        self.github.add_label(repo, pr_num, f"reviewer:{selected.name}")
        
        return selected
```

### 5.3 Unified Output Format

```markdown
## Unified Review: {tool_name}

### Summary
- **Files reviewed:** 12
- **Severity:** 3 critical, 5 suggestions, 2 info
- **Overall:** Needs improvement

### Critical Issues
1. **SEC-001: Unvalidated input in `auth.rs:45`**
   - User input flows to SQL query without sanitization
   - Suggestion: Use parameterized queries
   - Confidence: 0.95

### Suggestions
1. **PERF-003: Redundant allocation in `loop.rs:88`**
   - `Vec::new()` inside hot loop; pre-allocate outside
   - Suggestion: `let mut v = Vec::with_capacity(n);`
   - Confidence: 0.80

### Files Changed
- `src/auth.rs` — 2 issues (1 critical, 1 suggestion)
- `src/loop.rs` — 1 issue (suggestion)

### Attribution
Review by: **{tool_name}** via Unified Review Surface
```

### 5.4 Rate Limit Budget

| Tool | RPM limit | Daily limit | Monthly limit | Cost profile |
|------|-----------|-------------|---------------|--------------|
| Forge (local) | 60 | 1440 | ∞ | Free (local compute) |
| Copilot | 30 (throttled) | Soft | Soft | Included in license |
| CodeRabbit | 10 | 240 | 7500 | Paid tier |
| GCA (autofix) | 20 | Soft | Soft | Included in license |
| Cursor | 15 | 360 | 10000 | Agent tokens |

**Cost optimization:** Forge as primary (free), CodeRabbit as overflow, Copilot/GCA as last resort.

### 5.5 Self-Hosted Runner Setup

```
GitHub Webhook ──── ngrok/Cloudflare Tunnel ──── localhost:8000
                                                    │
                                            Unified Review Server
                                                    │
                                                    ├── Forge/OmniRoute (localhost:20128)
                                                    ├── CodeRabbit API (cloud)
                                                    └── GitHub API (cloud)
```

Or for production: dedicated $10-20/mo VM with Caddy/Traefik reverse proxy.

---

## 6. Repository Canonicalization

### 6.1 Current Overlap

```
PhenoDevOps (182 items, largest)
  ├── ci/                      # CI scripts
  ├── agent-devops-setups/     # → should absorb this
  ├── agileplus/               # standalone
  ├── platform/                # → should absorb this
  ├── templates/               # quality, linter templates
  ├── dotfiles/                # governance, hooks
  └── docs/                    # architecture, governance docs

pheno-ci-templates (reusable workflows)
  ├── .github/workflows/ci.yml
  └── .github/workflows/release.yml

phenotype-tooling (12 tools)
  ├── quality-gate/
  ├── bench-guard/
  ├── commit-msg-check/
  ├── target-pruner/
  └── sbom-gen/ ...

agent-devops-setups (40 items)
  ├── tools/
  ├── policies/
  └── schemas/ ...

PlatformKit
  └── src/ ...

tooling (empty)
```

### 6.2 Canonical Layout

```
phenotype-ops/                    # ← NEW canonical name (absorbs PhenoDevOps, pheno-ci-templates, etc.)
├── .github/workflows/            # → from pheno-ci-templates (canonical reusable workflows)
│   ├── manifest-gate.yml
│   ├── ci-reusable.yml
│   ├── release-reusable.yml
│   └── promote.yml
├── policies/                     # → from PhenoDevOps
│   ├── branch-protection.ruleset.json
│   ├── manifest-schema.json
│   └── org-rulesets/             # GitHub Org-level rulesets as code
├── pillars/                      # → NEW: pillar check definitions
│   ├── quality/
│   ├── security/
│   ├── perf/
│   ├── compliance/
│   └── docs/
├── tools/                        # → from phenotype-tooling
│   ├── phenotype-manifest/       # Rust CLI for manifest generation/validation
│   ├── bench-guard/
│   ├── sbom-gen/
│   └── target-pruner/
├── templates/                    # → from PhenoDevOps (existing)
│   ├── quality/
│   └── linters/
├── review-surface/               # → NEW: unified review webhook server
│   ├── main.py
│   ├── dispatcher.py
│   └── config.py
├── governance/                   # → from PhenoDevOps/dotfiles
│   ├── CLAUDE.base.md
│   └── AGENTS.base.md
├── agent-devops-setups/          # → absorbed (existing)
├── docs/
│   ├── architecture/
│   ├── governance/
│   └── adr/
├── AGENTS.md
└── lefthook.yml                  # → canonical lefthook config for all repos
```

### 6.3 Migration Strategy

| Phase | Action | Timeline |
|-------|--------|----------|
| 0 | Create `phenotype-ops` repo | Week 1 |
| 1 | Absorb `pheno-ci-templates` | Week 1 |
| 2 | Absorb `phenotype-tooling` | Week 2 |
| 3 | Absorb `PhenoDevOps` (non-conflicting parts) | Week 2-3 |
| 4 | Absorb `agent-devops-setups` | Week 3 |
| 5 | Deprecate old repos with NOTICE.md | Week 3-4 |
| 6 | Move all CI workflows to point at `phenotype-ops` | Week 4-6 |

---

## 7. Phased Rollout Plan

### Phase 0 — Foundation (Week 1)
- [ ] Create `phenotype-ops` repo
- [ ] Build `phenotype-manifest` Rust CLI (MVP: generate + verify)
- [ ] Define pillar schema + manifest schema
- [ ] Set up GitHub org-level rulesets for layered channels
- [ ] Create `review-surface` FastAPI project skeleton

### Phase 1 — Pre-Push Manifest Gate (Weeks 2-3)
- [ ] Roll out lefthook.yml with manifest generation to 5 pilot repos
- [ ] Deploy manifest validation CI workflow (fallback: `warn`)
- [ ] Monitor: measure pre-push failure rate, CI skip rate, false positives
- [ ] Collect feedback, iterate on schema
- [ ] Switch to `full` fallback after 2 weeks of stability

### Phase 2 — Unified Review Surface (Weeks 3-4)
- [ ] Deploy review-surface server (ngrok tunnel + local FastAPI)
- [ ] Wire Forge as primary reviewer (OmniRoute integration)
- [ ] Add CodeRabbit as secondary/overflow
- [ ] Monitor: review quality, latency, rate limit usage
- [ ] Add deterministic tool selection per PR

### Phase 3 — Pillar Adoption (Weeks 4-6)
- [ ] Define all 5 pillars with check definitions
- [ ] Build change-aware gate skip logic
- [ ] Add performance benchmarks as pillar checks
- [ ] Add compliance checks (license, deny, SBOM)
- [ ] Add documentation linting to docs pillar

### Phase 4 — Layered Releases (Weeks 6-8)
- [ ] Define release channel branch hierarchy
- [ ] Create promotion workflow (alpha→beta→rc→stable)
- [ ] Add sunset channel for old major versions
- [ ] Document channel rules and expectations

### Phase 5 — Fleet Rollout (Weeks 8-12)
- [ ] Deprecate all old tooling repos
- [ ] Point all CI workflows at `phenotype-ops` reusable workflows
- [ ] Enforce manifest gate org-wide (fallback: `fail`)
- [ ] Monitor: runner minute usage (target: 90% reduction)
- [ ] Retrospective: what worked, what didn't

---

## 8. Dependencies & Risks

### 8.1 Dependencies

| Dependency | Status | Notes |
|------------|--------|-------|
| `phenotype-manifest` CLI | NOT STARTED | Rust CLI, crate to be created in phenotype-ops |
| `phenotype-ops` repo | NOT STARTED | New canonical repo |
| OmnIRoute local instance | RUNNING | `http://localhost:20128` — used for Forge reviews |
| GitHub webhook access | EXISTS | Need to add org-level webhook |
| SSH key management | EXISTS | Per-developer keys for manifest signing |
| GitHub Org Rulesets | NOT CONFIGURED | Requires org admin access |

### 8.2 Risks

| Risk | Severity | Mitigation |
|------|----------|------------|
| SSH key compromise allows fake manifests | HIGH | Key rotation policy, TTL on manifests, Sigstore as phase 2 improvement |
| Adoption resistance — teams skip pre-push | MEDIUM | Start with `warn` fallback, gather data on skip rate, escalate to `full` |
| OrG rulesets not available (GitHub Free) | HIGH | Fall back to branch protection rules + probot |
| Webhook downtime breaks review surface | LOW | Queue-based retry, PR label as fallback state |
| Manifest generation on large monorepos | LOW | `--cache-dir` for incremental checks, skip unchanged crates |
| Cargo build times on free runners | MEDIUM | sccache + mold + cargo-nextest as immediate wins |

---

## 9. Timeline

```
Week 1  ████████░░░░░░░░░░░░░░░░  Phase 0: Foundation
Week 2  ████████████░░░░░░░░░░░░  Phase 1: Pre-push (pilot)
Week 3  ████████████████░░░░░░░░  Phase 1: Pre-push (org) + Phase 2 start
Week 4  ████████████████████░░░░  Phase 2: Review surface + Phase 3 start
Week 6  ████████████████████████  Phase 3: Pillars + Phase 4 start
Week 8  ████████████████████████  Phase 4: Releases + Phase 5 start
Week 12 ████████████████████████  Phase 5: Fleet rollout complete
```

---

## Appendix: Quick-Win Optimizations

These can be done today without waiting for phases:

1. **Add path filters to existing CI workflows** — `ci.yml` should skip on `*.md` only
2. **Switch to `cargo nextest` from `cargo test`** — 2-3x faster test execution
3. **Add `sccache` to CI** — share compiled artifacts across runs
4. **Add `mold` linker** — faster binary linking in CI
5. **Consolidate cargo-audit + cargo-deny + trufflehog into one security gate** — single workflow, single failure point
6. **Clean up PhenoDevOps/AGENTS.md merge conflicts** — prevents confusion
7. **Set up GitHub org rulesets for `dev/*`, `alpha/*`, `beta/*` branches** — lightweight enforcement
8. **Add `.manifest-checks/` directory to the shelf root** — start defining check configurations
