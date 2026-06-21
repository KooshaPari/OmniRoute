# L18 — Secret management

**Owner:** forge-A10 (security)
**Bloc scope:** AgilePlus + thegent + Tracely + Tracera + phenotype-dep-guard + phenotype-tooling (cross-cutting reusable workflows)

## Scope

How the bloc detects, stores, distributes, and rotates secrets — across source control, CI, build artefacts, and runtime configuration. Covers pre-commit/CI secret scanning, secret-manager integration, key rotation policy, and `.env` discipline.

## SOTA 2026

- **Pre-commit secret scanning:** `gitleaks` v8 + `trufflehog` v3 (~700 detectors, `--only-verified`) on every commit and PR, federated as a reusable workflow.
- **Runtime secret backends:** HashiCorp Vault (Shamir seal/unseal, dynamic secrets, auto-unseal via AWS KMS/Azure KV/GCP CKM) and AWS Secrets Manager (cross-account resource policies, rotation Lambdas).
- **Ecosystem taxonomy:** `python-dotenv` for dev only; `pydantic-settings` / `envconfig` for typed access; `doppler`, `infisical`, `sops`+`age` for distribution; OIDC → cloud short-lived creds (no static secrets in CI).
- **Rotation:** SLO ≤90 days for human creds, ≤24h for short-lived, with rotation runbooks and GHSA-disclosed response timelines.
- **Bloc exemplar:** HashiCorp Vault (PhenoSpecs SOTA), AWS Secrets Manager rotation Lambda pattern, `SECRETS_ROTATION.md` discipline.
- **Bloc exemplar:** `phenotype-tooling/trufflehog.yml`, `phenotype-tooling/lefthook.yml`, `phenotype-tooling/Taskfile.yml` — federated secret-scan toolchain.

## Phenotype state

- `AgilePlus/.trufflehog.yml:1-56` — `exclude.paths` covers `.git/`, `target/`, `node_modules/`, lockfiles, fixtures, and `**/.minisign/`. ~700 default detectors retained. — **status △** (config present, no in-repo CI job)
- `AgilePlus/.gitleaks.toml:1-85` — extends `useDefault`, allowlists build/lockfile noise + test-fixture literals, regex-allowlists test-secret shapes. — **status △** (config present, no in-repo CI job)
- `AgilePlus/.pre-commit-config.yaml:33-36` — `gitleaks v8.21.2` pre-commit hook. — **status ✓** (gitleaks pre-commit)
- `AgilePlus/.pre-commit-config.yaml:67-72` — `trufflehog filesystem --only-verified --fail` (manual stage). — **status △** (manual stage only, not auto-run on commit)
- `AgilePlus/deny.toml` (whole file) — cargo-deny with `[advisories]` + `[licenses]` allowlist. — **status ✓** (advisories, not secrets)
- `AgilePlus/.github/workflows/deny.yml:1-50` — `cargo-deny` weekly + on PR/push. — **status ✓**
- `phenotype-dep-guard/.github/workflows/trufflehog.yml:1-14` — `reusable-trufflehog.yml` from `KooshaPari/phenotype-tooling` on push/PR. — **status ✓** (federated secret-scan)
- `phenotype-dep-guard/.github/dependabot.yml:1-12` — Dependabot for `github-actions` + `pip` weekly. — **status ✓**
- `phenotype-tooling/.github/workflows/deny.yml`, `audit.yml`, `scorecard.yml` — federated security workflows reused across the bloc. — **status ✓**
- `phenotype-tooling/trufflehog.yml`, `lefthook.yml`, `Taskfile.yml` — federation root for secret-scan config. — **status ✓**
- `thegent/.env.example:1-50` — placeholder API keys, copy-and-fill comment. — **status △** (template present, no `dotenv` enforcement policy)
- `thegent/.env.template:1-30` — minimal config template (cache, shell, scaling). — **status △**
- `thegent/.pre-commit-config.yaml` (root), `thegent/dotfiles/hooks/.pre-commit-config.base.yaml` — pre-commit baseline shipped to all derived repos. — **status △** (no `gitleaks`/`trufflehog` hook in root pre-commit, only via templates)
- `thegent/.github/workflows/backup/security.yml:13-19` — daily `Secret Detection` job, GitHub-native secret scanning on `ubuntu-24.04`. — **status ✓** (GitHub native secret scanning)
- `thegent/.github/workflows/backup/security-deep-scan.yml:33-48` — `secret-scan` job with `gitleaks`-style detection. — **status ✓**
- `thegent/.semgrep-rules/secrets-detection.yml` (whole file) — semgrep ruleset for secret detection. — **status △** (rules present, not wired into any CI workflow)
- `thegent/findings/secrets_precommit_audit_2026-05-05.md` — pre-existing audit of pre-commit secret scanning posture. — **status △** (informational, no enforcement)
- `thegent/templates/secrets/` (directory) — secret-management templates (existence verified). — **status △**
- `Tracely/.pre-commit-config.yaml:18-22` — `gitleaks v8.21.2` pre-commit hook. — **status ✓**
- `Tracely/crates/tracely-sentinel/.github/workflows/security.yml:13-22` — Secret Scanning daily cron `0 2 * * *` on `ubuntu-24.04`. — **status ✓**
- `Tracely/crates/tracely-sentinel/.github/workflows/security-deep-scan.yml:33-48` — `secret-scan` job. — **status ✓**
- `Tracely/.github/workflows/audit.yml:1-22` — CodeQL (Rust) weekly cron, `security-events: write`. — **status ✓** (CodeQL is not a secret scanner but raises complementary findings)
- `Tracely/crates/tracely-sentinel/.env.example` (existence verified) — env template for sentinel crate. — **status △**
- `Tracera/.env.example:1-50` — TraceRTM native dev config with Vault pointers (`SECURITY: In production, store credentials in Vault (set USE_VAULT=true)`). — **status △** (doc-level guidance, no `USE_VAULT=true` runtime path)
- `Tracera/.gitignore` — `.env`/`.env.local` ignored; `.env.example` committed. — **status ✓**
- `Tracely/.gitignore`, `Tracera/.gitignore`, `phenotype-dep-guard/.gitignore` — `.env`, `.env.local`, `.env.*.local` ignored; `.env.example` allowed. — **status ✓**
- `phenotype-dep-guard/src/phenotype_dep_guard/agent.py:11-43` — `LLMClient` reads `minimax-m2.7-highspeed` default, falls back to mock. No secret in code. — **status ✓** (no hard-coded secret)
- `phenotype-dep-guard/src/phenotype_dep_guard/cli.py:1-75` — CLI `scan` command with `--fail-on` gate. — **status ✓** (not a secret store; gates dep-guard CI integration)
- `phenotype-dep-guard/.github/workflows/reusable-dep-guard.yml:43-67` — federated supply-chain scan via `workflow_call` with `permissions: contents: read`. — **status ✓**
- `AgilePlus/findings/secrets_precommit_audit_2026-05-05.md` (whole file) — pre-existing audit of pre-commit secret posture. — **status △**
- `Planify/docs/SECRETS_ROTATION.md` (and 7 sibling worktree copies) — rotation runbook outside the core bloc. — **status △** (out of bloc, but template exists)
- `PhenoSpecs/research/SECRETS_MANAGERS_SOTA.md:1-50` — SOTA survey covering HashiCorp Vault, AWS Secrets Manager, Shamir seal/unseal, rotation Lambdas. — **status ✓** (research depth = SOTA-aware)
- `PhenoSpecs/research/SECRET_DISTRIBUTION_SOTA.md` (existence verified) — distribution SOTA. — **status △** (no adoption)
- `phenotype-dep-guard/SECURITY.md:1-33` — GHSA triage policy, supported versions, "no secrets in repo history" rule. — **status ✓** (policy declared, no implementation evidence)
- `.gitignore` discipline across all 5 core repos: `.env`, `.env.local`, `.env.*.local`, `*.key`, `*.pem` (latter two only in `phenotype-dep-guard` gitignore via `.env*` glob). — **status △** (key/pem globs only on some repos; rely on git + the secret-scanner to fail them)

## Gaps

1. **`Tracera/.github/dependabot.yml` missing** — no Dependabot config; secret-scanning `Tracera` has no auto-updated GitHub Actions pins, so an outdated action with a known leak vector could persist. — **effort: S** (add `.github/dependabot.yml` mirroring AgilePlus)
2. **No HashiCorp Vault / AWS Secrets Manager runtime integration** in core repos — `.env.example` files exist for 4 of 5 core repos, but no `vault`, `boto3.client('secretsmanager')`, `sops`, or `doppler` import in any production source. — **effort: L** (add a `phenotype-secret-loader` crate that wraps the chosen backend)
3. **No `SECRETS_ROTATION.md` in the core bloc** — only satellite repos (`Planify`) ship a rotation runbook. — **effort: S** (add `docs/SECRETS_ROTATION.md` per core repo + a federated `phenotype-tooling` template)
4. **`trufflehog`/`gitleaks` not on every repo's pre-commit** — `Tracera/.pre-commit-config.yaml` has no secret-scanner hook; `thegent/.pre-commit-config.yaml` (root) lacks the hook (templates add it). — **effort: S** (lift the AgilePlus pre-commit baseline into `phenotype-tooling/templates/`)
5. **No federated `reusable-trufflehog.yml` workflow for non-`phenotype-dep-guard` repos** — `phenotype-dep-guard/.github/workflows/trufflehog.yml:14` calls into `phenotype-tooling/.github/workflows/reusable-trufflehog.yml@main`, but `phenotype-tooling/.github/workflows/` does not actually contain that reusable file in the path searched. Either the ref is stale or the file is named differently — verify and align. — **effort: S**
6. **`.env*` glob in `phenotype-dep-guard/.gitignore` swallows `.env.example`** — `.env` and `.env.local` are listed, but no explicit `!.env.example` allowlist. If anyone adds `.env.example` it works, but the convention is implicit. — **effort: S** (add explicit `!.env.example`)
7. **`*.key` / `*.pem` not in every `.gitignore`** — `phenotype-dep-guard/.gitignore` only catches `.env*`; `*.key` / `*.pem` are absent. Tracely/Tracera gitignores also lack these. — **effort: S**
8. **No `policy-gate` for "no commit to history with secret literal"** — the secret scanner catches new commits, but no documented re-write-history procedure for incidents. — **effort: M** (document `git filter-repo` runbook in SECURITY.md)
9. **No federated `secret-rotation` cron** — secret-scanning runs daily, but nothing schedules the rotation itself. — **effort: M** (add `rotator.yml` callable workflow)
10. **`phenotype-dep-guard/agent.py:11-43` defaults to `forge -p`** with no env-var override for credentials — if `forge` requires auth, the LLM call will silently fall back to mock. — **effort: S** (fail loudly per global CLAUDE.md "no silent fallbacks" rule)

## Recommendations

1. **Adopt one runtime backend** (recommend Vault, see `PhenoSpecs/research/SECRETS_MANAGERS_SOTA.md:1-50`) and expose a `phenotype-secrets` crate that wraps the Vault client. Add typed access via `pydantic-settings` for Python surfaces and `config`/`figment` for Rust. Effort: L.
2. **Promote `trufflehog filesystem` from manual to `pre-commit` default** in the federated pre-commit template (`phenotype-tooling/templates/.pre-commit-config.base.yaml`) and remove the `stages: [manual]` flag in `AgilePlus/.pre-commit-config.yaml:67-72`. Effort: S.
3. **Federate `reusable-trufflehog.yml`** under `phenotype-tooling/.github/workflows/` and rewire every core repo's `.github/workflows/trufflehog.yml` to call it. Effort: S.
4. **Add a `SECRETS_ROTATION.md`** to each core repo's `docs/`, templated from `Planify/docs/SECRETS_ROTATION.md`, with SLO (≤90d human, ≤24h service) and the `git filter-repo` incident runbook. Effort: S.
5. **Tighten `.gitignore` discipline** — explicit `!.env.example` allowlist, `*.key`, `*.pem`, `*.p12`, `secrets/`, `*.secrets.yaml` across all 5 core repos. Effort: S.
6. **Replace mock fallback in `phenotype-dep-guard/agent.py:32-35`** with an explicit env-var (`PHENOTYPE_LLM_API_KEY`) and a hard failure when missing. Effort: S.
7. **Add `dependabot.yml` to `Tracera`** and verify the weekly schedule. Effort: S.
8. **Land the federated `secret-rotation` workflow** as a callable that any repo can wire in via `workflow_call`. Effort: M.
9. **Adopt OIDC for cloud short-lived creds** (`aws-actions/configure-aws-credentials@v4` OIDC) in every CI workflow that currently uses `secrets.AWS_*` static keys. Effort: M.
10. **Track VEX statements** in `phenotype-dep-guard` (see L19 gap #3) so secret-leak false positives can be silenced with auditable allowlists. Effort: M.

**Net posture:** **partial △** — strong detection (gitleaks + trufflehog + GitHub native + semgrep rules), weak distribution (no Vault/AWS SM runtime path) and weak rotation discipline (no in-bloc runbook, no rotator).
