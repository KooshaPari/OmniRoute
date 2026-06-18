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