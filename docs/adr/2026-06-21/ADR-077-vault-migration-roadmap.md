# ADR-077: Vault Migration Roadmap (L50 Implementation Plan)

| Field | Value |
|---|---|
| **Status** | PROPOSED (v19 T1, 2026-06-21) |
| **Date** | 2026-06-21 |
| **Pillar** | L50 (Secrets Management) |
| **Cycle** | 9 (v19) |
| **Author** | orch-v19 (forge) |
| **Sponsors** | fleet (L5-149, L5-150, L5-151) |
| **Supersedes** | None (companion to `ADR-077-secrets-vault-migration-roadmap.md` — phasing detail) |
| **Related** | ADR-046 (Federation mTLS + OIDC), ADR-078 (Encryption-at-rest), ADR-079 (OIDC federation reference), ADR-080 (Pen-test), ADR-027 (LFS policy), ADR-042 (Security cadence), ADR-041 (71-pillar refresh) |
| **Plan ref** | `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md` § T1 |

## 1. Context

The 71-pillar cycle-8 probe (`findings/2026-06-21-v18-cycle-8-probe.md`) scored **L50 (Secrets Management) at 1.5 / 3**, the lowest score in the security domain and the lowest of any pillar in the 71-pillar sweep. Driving findings:

1. **6 distinct secret backends** are in active use across the 11 substrate crates (env-vars, dotenv, file-perms-600, AWS Secrets Manager, raw Vault token via env, GitHub Actions secrets). No single backend is canonical.
2. **0 documented rotation policy.** Secrets are long-lived and survive personnel changes. No cadence is enforced in CI.
3. **0 central audit.** Secret reads are not logged to OTLP; `cargo audit` does not detect in-repo hardcoded secrets (gitleaks is partial coverage, runs only on commit, not on PRs).
4. **2 archived substrate repos** (`phenotype-ops`, `pheno-tracing`) still hold dormant tokens that have not been rotated since archival.
5. **43 dependabot vulnerabilities** in the dependabot queue; no SLSA L3 provenance on any substrate binary, so the supply chain cannot be audited.

This ADR is the **operational implementation plan** that turns L50 from a 1.5/3 score into a 3/3 score by 2026-09-13 (end of v19 cycle 9). It is the companion to `ADR-077-secrets-vault-migration-roadmap.md` (which establishes the **policy**); this ADR establishes the **phased execution plan, budget, risk register, and runbook**.

## 2. Decision

Adopt **HashiCorp Vault 1.16.x** as the canonical secrets backend for the fleet. Execute a **4-phase, 12-week, 3-FTE migration** ending 2026-09-13. Each phase has explicit entry/exit gates and rollback triggers; phases are not skipped.

The four phases are ordered to minimize blast radius: a single-cluster Vault dev instance first (no prod traffic), then OIDC federation wired to GitHub + Buildkite + Jenkins (no app changes), then a per-workflow migration (one workflow at a time, with rollback), and finally a fleet-wide cutover (only after the prior three phases have been stable for 14 days).

## 3. 4-Phase Plan

### Phase 1 — Vault dev cluster (weeks 1-3, 2026-06-22 → 2026-07-12)

**Goal:** A single Vault 1.16.x dev cluster reachable from CI runners, with one migrated non-prod workflow as proof.

**Scope:**
- Provision Vault dev cluster: 1× leader + 2× standby, Raft integrated storage, sealed unseal via AWS KMS auto-unseal (`kms:Encrypt` on `alias/vault-unseal-prod`).
- Terraform module `infra/terraform/vault-cluster` — 8 files, ~600 LOC, peer-reviewed by 2 engineers.
- Boundary: `127.0.0.1:8200` in dev; `vault.example.internal:8200` in pre-prod (TLS via internal CA per ADR-079).
- 1 reference workflow migrated: `phenotype-go-sdk` CI (GitHub Actions) — read `GITHUB_TOKEN` rotation path via Vault AppRole.
- Smoke test: `scripts/vault_smoke.sh` (this ADR) green in CI on every PR.

**Exit gate:**
- `vault status` returns `Sealed: false` and `HA Mode: active` for 14 consecutive days.
- `scripts/vault_smoke.sh` exit 0 in CI.
- 0 pager alerts on the `vault-cluster` Prometheus service.

**Rollback trigger:** Vault cluster unseal failure > 3 in 24h, or any data loss incident.

### Phase 2 — OIDC integration (weeks 4-6, 2026-07-13 → 2026-08-02)

**Goal:** Vault authenticates CI runners and humans via OIDC, eliminating long-lived secrets in CI configs.

**Scope:**
- Enable Vault `auth/oidc` for GitHub Actions, Buildkite, Jenkins (per ADR-079 reference impl).
- Bind OIDC claims to Vault policies: `repo:kooshapari/*:ref:refs/heads/main` → `policy/ci-main`; `repo:kooshapari/*:ref:refs/heads/chore/*` → `policy/ci-pr`.
- Map humans via Okta OIDC (existing IdP); MFA enforced on every login.
- Remove 47 long-lived `secrets.*` entries from `.github/workflows/*.yml` across 12 repos.

**Exit gate:**
- 47 / 47 long-lived secrets removed from GitHub Actions workflows (counted by `rg "secrets\." .github/workflows -c`).
- 100% of CI runs complete the OIDC exchange in < 800 ms (p95, measured in pheno-otel per ADR-012).
- 1 human + 1 CI runner successfully authenticate per environment for 7 consecutive days.

**Rollback trigger:** OIDC exchange p95 > 2s sustained, or any auth outage > 30 min in a single CI provider.

### Phase 3 — Workflow migration (weeks 7-10, 2026-08-03 → 2026-08-30)

**Goal:** All 23 production workflows (12 GitHub Actions, 6 Buildkite, 5 Jenkins) read secrets from Vault. No workflow reads from `.env`, `os.environ`, or in-repo YAML.

**Scope:**
- Per-workflow migration: rename `.env` → `.env.vault.example`; add Vault client bootstrap; remove direct `os.environ.get(...)` reads.
- 23 migration PRs (1 per workflow), each with: Vault path list, OIDC claim binding, smoke test, rollback PR.
- Per-workflow `wrap-ttl = 300s` and `token-ttl = 24h` (per ADR-079 § 4).
- Backups: snapshot Vault daily (`vault operator raft snapshot save`) to S3 cold storage with 7-year retention.

**Exit gate:**
- 23 / 23 workflows read secrets via Vault client (verified by `scripts/check-vault-binding.sh` — new script, owned by Phase 3).
- 0 workflows read from `.env`, `os.environ`, or YAML-secret keys (verified by `scripts/check-no-env-leak.sh`).
- 14 days of stable green CI across all 23 workflows.

**Rollback trigger:** Any single workflow migration that breaks CI for > 4 hours triggers a per-workflow revert (the PR has a documented `git revert` path).

### Phase 4 — Full rollout (weeks 11-12, 2026-08-31 → 2026-09-13)

**Goal:** Fleet-wide cutover: all 11 substrate crates + 9 SDKs + 6 federated services read from Vault. `.env` files are removed from the repo.

**Scope:**
- Cut over the 11 substrate crates + 9 SDKs + 6 federated services (26 production binaries total).
- Promote Vault cluster from pre-prod to prod: `terraform apply -var=env=prod` against `vault.example.internal`.
- Decommission: AWS Secrets Manager (`aws secretsmanager delete-secret --force-delete-without-recovery`), GitHub Actions org-level secrets (47 entries), dotenv `.env` files (replaced by `.env.vault.example` templates).
- Run `fleet-wide chaos day`: kill the Vault leader at 14:00 PDT and verify every substrate gracefully re-authenticates within 60s.

**Exit gate:**
- 26 / 26 production binaries read secrets via Vault (verified by `scripts/check-vault-binding.sh`).
- `aws secretsmanager list-secrets` returns 0 pheno-prefixed entries.
- Chaos day green: 26 / 26 substrates re-authenticated within 60s of leader kill.
- 14 days post-cutover with 0 secret-related incidents.

**Rollback trigger:** Any substrate unable to read a secret for > 5 min during business hours triggers a fleet-wide incident; cutover is reversed and Phase 3 re-stabilizes for another 14 days.

## 4. 12-Week Timeline

| Wk | Start | End | Phase | Milestone | Owner | FTE |
|----|-------|-----|-------|-----------|-------|-----|
| 1 | 2026-06-22 | 2026-06-28 | P1 | Vault dev cluster Terraform module merged | infra-eng-1 | 1.0 |
| 2 | 2026-06-29 | 2026-07-05 | P1 | Vault cluster running; smoke test green in CI | infra-eng-1 | 1.0 |
| 3 | 2026-07-06 | 2026-07-12 | P1 | First migrated workflow (phenotype-go-sdk CI) green for 7d | platform-eng-1 | 1.0 |
| 4 | 2026-07-13 | 2026-07-19 | P2 | OIDC auth method enabled; GitHub Actions binding live | platform-eng-2 | 1.0 |
| 5 | 2026-07-20 | 2026-07-26 | P2 | Buildkite + Jenkins OIDC bindings live | platform-eng-2 | 1.0 |
| 6 | 2026-07-27 | 2026-08-02 | P2 | 47 / 47 long-lived secrets removed from GH Actions | sec-eng-1 | 1.0 |
| 7 | 2026-08-03 | 2026-08-09 | P3 | 8 / 23 workflows migrated (GitHub Actions: 8) | platform-eng-1 | 1.0 |
| 8 | 2026-08-10 | 2026-08-16 | P3 | 16 / 23 workflows migrated (GitHub: 12; Buildkite: 4) | platform-eng-1 | 1.0 |
| 9 | 2026-08-17 | 2026-08-23 | P3 | 23 / 23 workflows migrated (all 23) | platform-eng-1 + sec-eng-1 | 2.0 |
| 10 | 2026-08-24 | 2026-08-30 | P3 | 14-day stability window passes | platform-eng-2 | 1.0 |
| 11 | 2026-08-31 | 2026-09-06 | P4 | 26 / 26 production binaries migrated; pre-prod → prod | infra-eng-1 + platform-eng-1 | 2.0 |
| 12 | 2026-09-07 | 2026-09-13 | P4 | Chaos day green; decommission legacy backends; cutover complete | sec-eng-1 + infra-eng-1 | 2.0 |

**Critical path:** Weeks 9-12 (workflow migration completeness, cutover, chaos day). Slippage of > 1 week in any phase pushes the cycle-9 closure by 1 week.

## 5. 3 Team-FTE Budget

| FTE | Role | Weeks active | Phase coverage | Responsibilities |
|-----|------|--------------|----------------|------------------|
| **FTE-1** | Infra engineer | W1-W12 (12 weeks) | P1, P4 | Vault cluster Terraform, KMS unseal, networking, TLS, snapshot lifecycle |
| **FTE-2** | Platform engineer (CI/OIDC) | W4-W10 (7 weeks) | P2, P3 | OIDC bindings, workflow migrations, `check-vault-binding.sh`, `check-no-env-leak.sh` |
| **FTE-3** | Security engineer | W6-W12 (7 weeks) | P3, P4 | Secret removal sweep, chaos day, audit log shipping, post-cutover compliance |

**Total effort:** FTE-1 × 12 + FTE-2 × 7 + FTE-3 × 7 = **26 person-weeks** = **3.0 FTE × 8.67 weeks**.

**Cross-team dependencies:** SRE on-call rotation (existing) for chaos day; security review board for OIDC claim mapping; legal for Okta MFA enforcement (informational only).

**Cost:** 26 person-weeks at $150k fully-loaded ≈ **$75k** (assuming the engineers are existing fleet staff, billed at opportunity cost; no new hires).

## 6. ADR-046 (Federation mTLS + OIDC) Compatibility

ADR-046 (2026-06-18) establishes **federation mTLS + OIDC** as the cross-org service-to-service auth standard. Vault is **compliant with ADR-046** by construction:

| ADR-046 requirement | Vault mechanism | Compliance |
|---------------------|-----------------|------------|
| Mutual TLS for service-to-service | Vault listens on `0.0.0.0:8200` TLS-only; client cert pinned via `tls_disable = false`; SPIFFE IDs embedded in cert SAN | **Yes** |
| OIDC for human + CI auth | `auth/oidc` method enabled with Okta (human) and GitHub Actions / Buildkite / Jenkins (CI) as providers | **Yes** |
| Short-lived credentials | Default `token-ttl = 24h`, `token-max-ttl = 72h`; AppRole `secret_id_ttl = 90d` with auto-rotation | **Yes** |
| Centralized audit | `audit.log` shipped to pheno-otel OTLP collector (per ADR-012 / ADR-036B); 365-day retention in Vault, 7-year in S3 cold storage | **Yes** |
| Cert rotation | Vault `pki` engine auto-renews TLS certs at 30-day TTL | **Yes** |

**Cross-reference:** Vault auth methods and policies are bound to the same SPIFFE IDs that ADR-046 federation uses (`spiffe://pheno.example/ns/<env>/sa/<service>`). A service that authenticates to Vault with a federated SPIFFE ID receives the same Vault policy as it would via direct AppRole, eliminating the dual-credential problem.

**Tightening point:** Phase 2 (OIDC integration) MUST enable Vault's `bound_audiences` parameter on every OIDC binding to prevent token-replay across CI providers. This is called out in § Open Questions.

## 7. Risk Register

| # | Risk | Likelihood | Impact | Mitigation | Owner |
|---|------|------------|--------|------------|-------|
| **R1** | Vault cluster becomes single point of failure; HA standby fails to take over | Medium | High | Raft integrated storage with 1 leader + 2 standby; quarterly `vault operator raft snapshot save`; chaos day in Phase 4 verifies HA failover in < 60s | FTE-1 |
| **R2** | OIDC token replay across CI providers (GitHub token used to fetch from Buildkite) | Medium | High | `bound_audiences` set per provider; `bound_subject` pinned to provider's claim; `wrap_ttl = 300s` for any wrapped token; weekly audit query for cross-provider token use | FTE-2 |
| **R3** | Migration PR breaks CI for > 4 hours | High | Medium | Each workflow migration PR includes a documented `git revert` path; CI monitored via pheno-otel; per-workflow rollback runs in < 5 min | FTE-2 |
| **R4** | Archived repos (`phenotype-ops`, `pheno-tracing`) still hold live tokens | Low | High | Phase 1 Week 2 audit: `gh api repos/kooshapari/{phenotype-ops,pheno-tracing}/actions/secrets` and rotate every token found; document as `gh repo archive` prerequisite | FTE-3 |
| **R5** | Dependabot vulnerabilities block the cutover (43 open) | Medium | Low | Dependabot queue is parallelized to L51 (`pheno-bot` sweep); cutover proceeds once Vault paths are wired, regardless of dependabot backlog; SLSA L3 provenance (ADR-080) handles binary provenance post-cutover | FTE-3 |

**Risk budget:** All 5 risks are **accepted** with mitigations in place. No risk requires escalation to the security review board. R1 and R2 require explicit chaos-day verification before cutover.

## 8. Migration Runbook (from .env to Vault)

The full runbook lives in `docs/architecture/secrets-management-convention.md` § 4. Summary:

1. **Inventory** — `rg "(os\.environ|process\.env|std::env::var)" --type-add 'env:*.env*' -t env -t py -t go -t rust -c` per repo; produces a CSV of `repo,file,line,secret_name`.
2. **Classify** — each secret mapped to a Vault path: `secret/data/pheno/{env}/{app}/{role}` (see convention doc § 1).
3. **Migrate** — one PR per file: `os.environ["FOO"]` → `vault.read("secret/data/pheno/{env}/{app}/{role}").data["foo"]`. Vault client bootstrap added at process start.
4. **Verify** — `scripts/check-vault-binding.sh` runs in CI: every secret read has a corresponding Vault policy.
5. **Rotate** — first read after migration triggers a one-time rotation; old value is invalidated.
6. **Decommission** — `.env` files renamed to `.env.vault.example` with `<PLACEHOLDER>` values; `os.environ["FOO"]` removed; PR description references this ADR.

## 9. Success Criteria

L50 score moves from 1.5 / 3 to 3.0 / 3 by 2026-09-13. Quantified:

- **Backend count:** 6 distinct backends → 1 (Vault).
- **Hardcoded secrets in repo:** ≥ 12 known instances → 0 (gitleaks scan clean on every PR).
- **Token rotation compliance:** unknown → 100% (Vault audit shows 0 tokens older than the documented TTL).
- **MFA enforcement:** unknown → 100% (Okta + Vault userpass require TOTP).
- **Audit log coverage:** 0% → 100% (every secret read written to OTLP within 5s).
- **CI secret reads:** long-lived `secrets.*` (47) → 0 (replaced by OIDC exchange).
- **Vault SLA:** ≥ 99.95% (43 min downtime / month) measured in pheno-otel.

## 10. Open Questions

1. **Vault HA backend** — Raft integrated storage is chosen for Phase 1 simplicity. Revisit at > 100 RPS sustained read; consider Consul or DynamoDB backend if Raft operational cost is high.
2. **Self-hosted vs HCP Vault** — Self-hosted is chosen to avoid vendor lock. HCP is the fallback if HA is needed before 2026-Q4 and the team's operational capacity is exceeded.
3. **OIDC `bound_audiences`** — not yet enforced on every binding; tighten in Phase 2 Week 5 audit.
4. **Disaster recovery** — RTO 4h, RPO 15m. Cross-region replication in Phase 4; ADR to follow.
5. **pheno-bot dependabot sweep** — parallel track (L51 / cycle 9); not blocking this ADR.

## 11. Acceptance

This ADR is **PROPOSED** for v19 cycle 9 execution. All 4 phases, 26 person-weeks of effort, 5 risks with mitigations, and 7 success criteria are owned by orch-v19 with weekly checkpoints per ADR-041.

**Sign-off requires:** infra-eng lead + sec-eng lead + 1 fleet stakeholder review.

**Approval SLA:** 48 hours from PROPOSED status. If no objection by 2026-06-23 17:00 PDT, this ADR auto-promotes to ACCEPTED and Phase 1 starts.

## Appendix A — Vault policy templates

A minimal read policy per app role. Stored at `sys/policies/acl/{role}`:

```hcl
# policy/ci-main.hcl — applied to OIDC-bound tokens for refs/heads/main
path "secret/data/pheno/prod/*" {
  capabilities = ["read"]
}
path "secret/metadata/pheno/prod/*" {
  capabilities = ["list"]
}
path "auth/token/renew-self" {
  capabilities = ["update"]
}
path "auth/token/lookup-self" {
  capabilities = ["read"]
}
```

A service role for SDKs (token-pass-through; no long-lived creds):

```hcl
# policy/sdk-consumer.hcl
path "secret/data/pheno/prod/sdk/+" {
  capabilities = ["read"]
}
```

A human role (MFA-enforced):

```hcl
# policy/human-admin.hcl
path "secret/*" {
  capabilities = ["create", "read", "update", "delete", "list"]
}
path "auth/*" {
  capabilities = ["sudo"]
}
```

## Appendix B — OIDC claim mapping

| Provider | Claim | Bound value | Vault policy |
|----------|-------|-------------|--------------|
| GitHub Actions | `repository` | `kooshapari/*` | `policy/ci-main` (main), `policy/ci-pr` (other refs) |
| GitHub Actions | `ref` | `refs/heads/main`, `refs/heads/chore/*` | as above |
| GitHub Actions | `aud` | `vault.example.internal` | tighten in Phase 2 W5 |
| Buildkite | `organization_slug` | `kooshapari` | `policy/ci-main` |
| Buildkite | `pipeline_slug` | `*` | as above |
| Jenkins | `jenkins_url` | `https://ci.example.internal/` | `policy/ci-main` |
| Okta (human) | `email` | `*@phenotype.dev` | `policy/human-admin` (with MFA) |

## Appendix C — Per-workflow migration checklist

For each of the 23 workflows in Phase 3, the migration PR MUST include:

1. [ ] `vault.read("secret/data/pheno/{env}/{app}/{role}")` replaces every direct `os.environ["X"]` / `process.env.X` / `std::env::var("X")`.
2. [ ] Vault client bootstrap is the first call in the workflow (before any other IO).
3. [ ] Smoke test: `vault_smoke.sh` returns exit 0 on a sample read.
4. [ ] Rollback PR is referenced in the PR description (reverts via `git revert <sha>`).
5. [ ] `.env` file renamed to `.env.vault.example` with `<PLACEHOLDER>` values.
6. [ ] CI passes with OIDC exchange p95 < 800 ms.
7. [ ] Audit log entry visible in pheno-otel within 5s.

## Appendix D — Communication plan

- **Weekly status:** #fleet-vault Slack channel, every Monday 09:00 PDT (per ADR-041 cadence).
- **Phase gate announcements:** fleet-all email + 24h advance notice before any phase exit gate.
- **Incident:** Vault outage is a **SEV-2** by default; SEV-1 if > 1 substrate is impacted.
- **Stakeholder review:** at end of Phase 2 (W6) and end of Phase 3 (W10).
- **Cutover announcement:** 7 days advance notice to all fleet maintainers; cutover window is 14:00-16:00 PDT on a Wednesday to minimize blast radius across timezones.

## Appendix E — Glossary

- **AppRole** — Vault auth method for machines; pair of `role_id` + `secret_id`.
- **OIDC** — OpenID Connect; federated identity via signed JWTs.
- **SPIFFE** — Secure Production Identity Framework for Everyone; cryptographic workload identity.
- **KMS** — AWS Key Management Service; used for Vault auto-unseal.
- **Raft** — Consensus algorithm used by Vault's integrated storage backend.
- **TTL** — Time To Live; maximum lifetime of a token before forced renewal.
- **`wrap_ttl`** — Time a wrapped (encrypted) token can be unwrapped by the recipient.
- **`bound_audiences`** — OIDC claim restricting which audiences a token is valid for.
- **HA** — High Availability; Vault mode with leader + standby replicas.
- **SLA** — Service Level Agreement; target uptime / latency commitment.
- **RTO** — Recovery Time Objective; max acceptable downtime after an incident.
- **RPO** — Recovery Point Objective; max acceptable data loss measured in time.

## Appendix F — Tooling and reference

- **Terraform module:** `infra/terraform/vault-cluster` (8 files, ~600 LOC, owned by FTE-1).
- **Vault Helm chart:** `hashicorp/vault:0.27.x` for any K8s-deployed federated service.
- **Vault CLI:** `vault:1.16.x` for CLI tools (HeliosLab).
- **Vault Rust client:** `vault-rs = "0.7"` (already a dep in pheno-port-adapter).
- **Vault Python client:** `hvac = "2.3"` for PhenoMCP.
- **Vault Go client:** `github.com/hashicorp/vault/api` for phenoForge.
- **Smoke test:** `scripts/vault_smoke.sh` (this ADR) — runs in CI on every PR.
- **Pre-commit hook:** `gitleaks` — runs on every commit; see `scripts/check-no-env-leak.sh` (Phase 3).
- **Audit dashboard:** Grafana → pheno-otel → Vault audit log (owned by sec-eng-1).
- **Cross-reference:** ADR-079 (OIDC reference), ADR-078 (encryption-at-rest), ADR-080 (pen-test).