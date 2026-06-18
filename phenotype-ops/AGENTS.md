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
- **Agent DevOps Setups:** `agent-devops-setups/` — 6-layer policy federation, dot-agents / codex / agentops extensions, VitePress docs site. Absorbed from `KooshaPari/PhenoDevOps/agent-devops-setups/` (L5-104.5, 2026-06-18) and `KooshaPari/phenotype-ops/agent-devops-setups/llama-cpp/` ([phenotype-ops#2](https://github.com/KooshaPari/phenotype-ops/pull/2), 2026-06-15).

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
├── .github/workflows/      # Reusable CI/release workflows
├── tools/                  # CLI tools (phenotype-manifest)
├── review-surface/         # Unified code review FastAPI server
├── pillars/                # Check definitions per pillar
├── policies/               # JSON Schema, rulesets
├── governance/             # Templates, hooks
├── agent-devops-setups/    # Absorbed from old repos (PhenoDevOps L5-104.5; llama-cpp PR #2)
│   ├── llama-cpp/          # LLM serving docker setup
│   ├── policies/           # 6-layer policy federation model
│   ├── extensions/         # dot-agents, codex, agentops-ci manifests
│   ├── tools/              # Python + shell policy tooling
│   ├── docs/               # VitePress site (i18n: en, zh-CN, zh-TW, fa, fa-Latn)
│   ├── schemas/            # JSON Schemas for policy + manifest
│   ├── scripts/            # repo-devops-checker.sh, repo-push-fallback.sh
│   ├── Dockerfile, process-compose.yml, Taskfile.yml, justfile
│   └── README.md, SPEC.md, PRD.md, ADR.md, AGENTS.md, CHANGELOG.md
└── templates/              # Linter, quality configs
```

## Agent DevOps Setups quick reference

```bash
cd agent-devops-setups

# Validate a policy payload
python3 tools/validate_policy_payload.py --payload policies/system/base.json

# Federate the effective policy for a (repo, harness) tuple
python3 tools/federate_policy.py --repo default --harness claude --out /tmp/effective.json

# Run repo devops checker
bash scripts/repo-devops-checker.sh /path/to/target-repo

# Onboard a fleet of repos
bash tools/matrix_onboard.sh repos.tsv
```