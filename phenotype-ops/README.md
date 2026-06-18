# phenotype-ops

> Canonical operations infrastructure for the Phenotype fleet (~100 repos)

## What This Repo Provides

| Component | Purpose | Consumed By |
|-----------|---------|-------------|
| **Reusable Workflows** | CI, security, release, attestation gates | All fleet repos via `uses: phenotype/phenotype-ops/.github/workflows/...` |
| **phenotype-manifest** | Signed attestation CLI for pre-push + CI validation | All repos (installed via cargo) |
| **Unified Review Surface** | Single webhook router for all code review tools | GitHub org webhook |
| **Pillar Definitions** | 5 pillars × check definitions with skip logic | CI workflows, manifest generator |
| **Governance Templates** | lefthook.yml, CLAUDE.base.md, AGENTS.base.md | New repo bootstrap |

## Quick Start

```bash
# Install manifest CLI
cargo install --git https://github.com/phenotype/phenotype-ops --locked phenotype-manifest

# Add to repo (run from target repo)
phenotype-manifest generate --key ~/.ssh/manifest --output .manifest.signed.json

# Verify locally
phenotype-manifest verify --manifest .manifest.signed.json
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    phenotype-ops repo                       │
├─────────────────────────────────────────────────────────────┤
│  .github/workflows/  →  Reusable CI gates (pillar-aware)    │
│  tools/phenotype-manifest/  →  Attestation CLI              │
│  review-surface/     →  Code review router (FastAPI)        │
│  pillars/            →  Quality/Security/Perf/Compliance/Docs│
│  policies/           →  JSON schemas, rulesets              │
│  governance/         →  lefthook, CLAUDE, AGENTS templates  │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
        ┌─────────────────────────────────────────────┐
        │          Fleet Repos (~100)                 │
        │  uses: phenotype/phenotype-ops/.github/...  │
        │  lefthook runs phenotype-manifest generate  │
        │  CI runs phenotype-manifest verify          │
        └─────────────────────────────────────────────┘
```

## Pillars (5)

| Pillar | Checks | Skip When |
|--------|--------|-----------|
| **Quality** | fmt, clippy, test, nextest, docs | No Rust file changes |
| **Security** | audit, deny, trufflehog, license | No Cargo.lock change + scanned <24h ago |
| **Performance** | bench, size, profile | No perf-sensitive code touched |
| **Compliance** | deny.toml, licenses, SPDX, SBOM | No dependency changes |
| **Documentation** | spellcheck, links, api-docs | No doc/** or *.md changes |

## Manifest Format

```json
{
  "schema_version": "1",
  "generated_at": "2026-06-15T14:30:00Z",
  "commit_sha": "a1b2c3d4...",
  "tree_sha": "e5f6g7h8...",
  "pillars": {
    "quality": {"passed": true, "checks": {...}, "duration_ms": 4500},
    "security": {"passed": true, "checks": {...}, "duration_ms": 3200},
    "perf": {"passed": true, "checks": {...}, "duration_ms": 800},
    "compliance": {"passed": true, "checks": {...}, "duration_ms": 1200},
    "docs": {"passed": true, "checks": {...}, "duration_ms": 600}
  },
  "health_score": 0.96,
  "expires_at": "2026-06-16T14:30:00Z",
  "signature": "ed25519:base64..."
}
```

## Migration From Old Repos

| Old Repo | Status | Migrated To |
|----------|--------|-------------|
| `PhenoDevOps` | ✅ Deprecated | `phenotype-ops` |
| `pheno-ci-templates` | ✅ Deprecated | `phenotype-ops/.github/workflows` |
| `phenotype-tooling` | ✅ Deprecated | `phenotype-ops/tools` + `governance` |
| `agent-devops-setups` | ✅ Deprecated | `phenotype-ops/agent-devops-setups` |
| `PlatformKit` | ✅ Deprecated | `phenotype-ops/templates` + `policies` |

## License

MIT — see [LICENSE](LICENSE)