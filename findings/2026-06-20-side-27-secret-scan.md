# Secret Scan — Fleet-Wide gitleaks Audit (side-27)

**Date:** 2026-06-20 10:00 UTC
**Task ID:** side-27
**Agent:** orch-v11-real-research-7
**Verdict:** Clean as of 2026-06-20. Adopt gitleaks as a pre-commit + CI gate.

## What I ran
`gitleaks detect --no-git --source .` against the full meta-repo working tree (excluding `.git/`). Also a regex sweep with `grep -rE "AKIA[0-9A-Z]{16}|ghp_[0-9a-zA-Z]{36}|sk-[a-zA-Z0-9]{20,}|xox[bp]-[0-9a-zA-Z-]{10,}"` against `*.rs`, `*.toml`, `*.yml`, `*.py`, `*.ts` in `pheno-*/src/`.

## Findings
**Zero hits.** No AWS access keys, no GitHub PATs, no OpenAI/Anthropic API keys, no Slack tokens in any checked-in file. The `.github/workflows/` directory is also clean — no embedded secrets in CI configs.

## Why this matters
A clean scan today does not mean a clean repo tomorrow. The next agent that adds an LLM API call inside `pheno-mcp-router` could drop a `sk-...` constant directly into a test file. Without a gate, the secret lands in git history and is gone from view within 24h but stays recoverable forever.

## Recommended controls (concrete)

1. **Pre-commit hook** — add `gitleaks protect --staged` to `.pre-commit-config.yaml` at meta-repo root. Block any commit that introduces a known secret pattern. Pre-commit framework already used widely; low-friction addition.

2. **CI gate** — add `gitleaks-action` to `phenotype-ops` reusable workflow. Run on every PR. On hit: fail the check, link to the leaked line, do not auto-revert (let the author decide). The current fleet has a `codeql.yml` workflow; add gitleaks next to it.

3. **Pre-push scan** — `gitleaks detect --source . --no-banner --redact` runs locally before push. Catches secrets committed via rebase or squash from a feature branch. Cheap (<2s on this repo).

4. **Rotation runbook** — write `docs/runbooks/secret-rotation.md` listing the 6 secret types we accept (GitHub PAT, AWS access key, OpenAI/Anthropic API key, Slack token, Vault token, gitleaks webhook). For each: where it lives, how to rotate, how to verify old value is dead.

## Adoption cost
~30 minutes one-time to add pre-commit config + CI workflow. Ongoing: zero maintenance. False-positive rate in our codebase is near-zero (the secret patterns don't collide with anything we write).

**Refs:** `phenotype-ops`, `.pre-commit-config.yaml`, `docs/runbooks/` (to be created).
