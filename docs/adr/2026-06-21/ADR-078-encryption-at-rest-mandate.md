# ADR-078: Encryption-at-Rest Mandate (L52)

| Field | Value |
|---|---|
| **Status** | PROPOSED (v19 T2, 2026-06-21) |
| **Date** | 2026-06-21 |
| **Pillar** | L52 (Encryption at Rest) |
| **Cycle** | 9 (v19) |
| **Author** | orchestrator (v19 wave-2 fill) |
| **Sponsors** | fleet (L5-150 encryption track) |
| **Supersedes** | None (first encryption-at-rest ADR) |
| **Related** | ADR-077 (Vault migration), ADR-079 (OIDC federation), ADR-080 (pen-test), ADR-042 (security cadence), NIST SP 800-111, OWASP ASVS V1.14 §2.4, SOC2 CC6.1, ISO 27001 A.10.1 |
| **Plan ref** | `plans/2026-06-21-v19-71-pillar-cycle-9-p0.md` § T2 |

## 1. Context

The 71-pillar cycle-8 probe (`findings/2026-06-21-v18-cycle-8-probe.md`) scored **L52 (Encryption at Rest) at 1.0 / 3** — a critical gap in the security domain. Driving findings:

1. **0 encryption-at-rest policy** documented anywhere in the fleet. No `.adr/2026-*` ADR covers L52, no `SECURITY.md` section, no operational runbook.
2. **3 distinct at-rest stores** are in use across the 11 substrate crates with no canonical configuration:
   - **PostgreSQL** (6 services, e.g. `phenotype-registry`, `phenotype-ops`, `pheno-observability`): default cluster encryption is **off** in 4/6 deployments (verified via `SHOW server_version;` + checking `pgcrypto` extension presence).
   - **S3-compatible object storage** (4 buckets, e.g. `pheno-otel-trace-exporter`, `phenotype-bus-event-archive`): SSE-S3 (AES-256) enabled in 1/4, SSE-KMS in 0/4, bucket-default-encryption unset in 3/4.
   - **Local-disk caches** (Tasken `~/.taskkit/cache.json`, pheno-tracing `~/.pheno-tracing/spans/`, hexa-kit tmp dirs): **0 of 11** are encrypted. All hold potentially-sensitive data (cache keys include provider names, trace payloads can include user content).
3. **2 archived substrate repos** (`phenotype-ops`, `pheno-tracing`) hold unencrypted S3 buckets still public-readable in 1 case (verified via public S3 listing).
4. **No KMS key rotation** cadence. Keys in use for 18+ months without rotation. No alert on key age.
5. **No `truck-roll key`** procedure. If a KMS key is compromised, the playbook is undefined.
6. **5 customer contracts** signed in 2026-Q1 reference "encryption at rest for all customer data" — we are out of compliance on at least 2 of those (the unencrypted PostgreSQL deployments).

This ADR mandates encryption-at-rest for all fleet storage surfaces, with phased rollout that minimizes blast radius and aligns with the Vault migration in ADR-077 (so we don't double-pay for KMS integration).

## 2. Decision

Adopt **envelope encryption with AWS KMS (or compatible)** for all at-rest data, in 3 phases over 14 weeks. The mandate covers:

### 2.1 In-scope (mandated)

1. **PostgreSQL** — `pgcrypto` extension required, transparent data encryption (TDE) via `pgcrypto` for columns holding PII (user_id, email, api_key). Cluster-level disk encryption via AWS RDS storage encryption (already standard in our Terraform, but verified).
2. **S3-compatible object storage** — bucket-default-encryption set to **SSE-KMS** (not SSE-S3), with a per-environment KMS key. Default-deny on unencrypted PUTs via bucket policy.
3. **Local-disk caches** — encrypted at the application level using `aes-gcm` with a per-user key derived from the user's Vault token. Cache file format gains a `MAGIC` header (`PHENO-CACHE-v1`) and an AEAD seal.
4. **Container ephemeral storage** — `tmpfs` only (no disk-backed `/tmp` writes for sensitive payloads).
5. **Backups** — same encryption posture as primary store. Backups inherit the source key unless explicitly cross-region replicated (then re-encrypted with a destination-region key).
6. **Snapshots** (RDS, EBS, EFS) — encrypted with the same KMS key class as the live data.

### 2.2 Out-of-scope (explicitly NOT mandated by this ADR)

- **In-transit encryption** (L51) — covered by separate ADR / SOC2 evidence automation (v18 T3 closed).
- **Key ceremony / HSM** for KMS root keys — AWS-managed keys are sufficient for current SOC2 / ISO 27001 A.10.1 controls. Re-evaluate if customer MSA requires customer-managed HSM.
- **Field-level encryption in application code** beyond the L52 columns — current application code does not store raw PII outside PostgreSQL.
- **Homomorphic encryption / confidential compute** — overkill for current customer contracts.

### 2.3 KMS strategy

- **One KMS key per environment** (`alias/pheno-prod`, `alias/pheno-staging`, `alias/pheno-dev`).
- **One KMS key per customer tenant** for multi-tenant SaaS services (deferred — current tenants share the prod key; explicit follow-up ADR if/when a customer requires tenant-isolated keys).
- **Auto-rotation: 365 days** (AWS KMS default). Alert via PagerDuty if `KeyRotationStatus` is not `ON` or `KeyLastRotated` > 365 days.
- **Key access via Vault transit** for the 6 substrate crates that already use Vault (per ADR-077 phase-3).

## 3. Phased Rollout (14 weeks)

### Phase 1 — Audit + baseline (weeks 1-2, 2026-06-22 → 2026-07-05)

- Run `aws rds describe-db-instances` + `aws s3api get-bucket-encryption` across all 3 prod accounts.
- Per-store `ENCRYPTION-STATUS` table written to `findings/2026-06-22-L52-baseline.md`.
- Identify the 4 services with unencrypted PostgreSQL deployments; add to a 6-week migration list.

**Exit gate:** baseline doc published, all stores inventoried, owner assigned per store.

### Phase 2 — S3 SSE-KMS rollout (weeks 3-5, 2026-07-06 → 2026-07-26)

- Apply `aws s3api put-bucket-encryption` (SSE-KMS) to all 4 buckets.
- Apply bucket policy: `Deny: PutObject if x-amz-server-side-encryption is absent`.
- One-week soak per bucket with a non-prod write workload.
- 0 customer-visible downtime (SSE-KMS is in-place transparent).

**Exit gate:** all 4 buckets encrypted, 0 PutObject denials in non-prod (proof: bucket access logs), 1 week soak complete per bucket.

### Phase 3 — PostgreSQL pgcrypto + TDE (weeks 6-11, 2026-07-27 → 2026-09-06)

- For each of the 4 unencrypted deployments: enable `pgcrypto` extension, add column-level encryption for `user_id`, `email`, `api_key` columns via `pgp_sym_encrypt` with a Vault-stored data key.
- Per-table migration: 1 schema migration + 1 read-path change + 1 write-path change.
- Per-service rollout: 1 service per week (4 services, 4 weeks), with read-replica → writer cutover (no downtime).
- **Backfill** the existing 2.3M user rows in `phenotype-registry` with encrypted values; offline migration via `UPDATE ... SET user_id_enc = pgp_sym_encrypt(user_id, current_setting('app.kek'))` batched at 10k rows/batch.
- **Key rotation** procedure: rotate the KEK (key-encryption key) on the 4 services via Vault transit (per ADR-077 phase-3); re-encrypt data keys in place.

**Exit gate:** all 4 services use `pgcrypto`, 0 plaintext PII rows in `pg_dump`, `pg_dump` size growth < 5%.

### Phase 4 — Local-disk cache encryption + final audit (weeks 12-14, 2026-09-07 → 2026-09-28)

- For each of the 11 substrate crates: introduce `pheno-encryption-cache` (or reuse `pheno-config`'s secrets module) for AEAD-sealed local cache files.
- Cache file migration: read existing plaintext cache, write encrypted version, delete plaintext.
- 14-day soak: 0 cache corruption, 0 decryption failure.
- **Final audit** by an independent contractor (separate from the v19 T5 pen-test vendor — see ADR-080).

**Exit gate:** all 11 caches encrypted, audit report ≤ 1 P0 finding, ADR published.

## 4. KMS Key Management

- **Key class:** AWS KMS Symmetric, `ENCRYPT_DECRYPT` usage.
- **Key policy:** least-privilege — only the IAM role for the relevant service can use the key; `kms:Decrypt` requires a `ViaService` condition (so a stolen key can't be used from outside the service).
- **Audit:** every `kms:Decrypt` call emits a CloudTrail event; the audit circle reviews daily. PagerDuty alert on `kms:Decrypt` count > 5σ from baseline.
- **Disaster recovery:** KMS keys are region-isolated; cross-region failover keys are pre-provisioned but not auto-enabled (manual step in the IR runbook).

## 5. Compliance Mapping

| Control | Standard | Mapping |
|---|---|---|
| **CC6.1** | SOC2 | Logical access controls include encryption of data at rest. ✅ Post-rollout. |
| **A.10.1.1** | ISO 27001 | Policy on the use of cryptographic controls. ✅ This ADR. |
| **A.10.1.2** | ISO 27001 | Key management. ✅ ADR-077 + §4 above. |
| **§2.4.1** | OWASP ASVS V1.14 | Verify that regulated data is stored encrypted at rest. ✅ Post-rollout. |
| **PW.4.4** | NIST SSDF | Use cryptographic mechanisms to prevent unauthorized access. ✅ Post-rollout. |

## 6. Risks

| Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|
| **pgcrypto performance regression** on hot-path reads | M | M | Benchmark in week 7; pgcrypto is in-process, expected < 5% regression. Fall back to application-level encryption if > 10%. |
| **Key compromise** | L | H | KMS key policy + ViaService condition; truck-roll procedure in IR runbook; quarterly key rotation drill. |
| **Backfill row corruption** during phase 3 | L | H | Batched UPDATE at 10k rows/batch; reversible via `pgcrypto` decrypt; full pg_dump before each batch. |
| **Local-disk cache migration breaks a hot path** | M | M | 1-week feature flag rollout per crate; canary at 1% → 10% → 50% → 100%. |
| **Customer data residency** changes (e.g. EU customer demands EU-only key) | M | M | KMS keys are region-bound; per-tenant keys (deferred to follow-up ADR) would handle. |
| **AWS KMS outage** | L | H | Application caches plaintext data keys (with short TTL); KMS read-through pattern. |
| **Insider with `kms:Decrypt` on prod key** | L | H | CloudTrail alert on `kms:Decrypt` from non-canonical IAM principal; quarterly access review. |

## 7. Alternatives Considered

### 7.1 HashiCorp Vault transit only (no AWS KMS)

**Rejected.** Vault transit is great for application-level envelope encryption, but for the 3 S3 buckets and 4 PostgreSQL clusters we already have AWS-native encryption paths (SSE-KMS, RDS storage encryption). Using Vault-only would mean re-implementing bucket-default-encryption and RDS storage encryption in Vault, which is a downgrade in integration depth with the AWS IAM/KMS/CloudTrail stack we already operate.

### 7.2 Per-row application-level encryption (no DB-level TDE)

**Partially adopted.** For the 4 PostgreSQL deployments with PII columns, we layer **both** pgcrypto (DB-level) and an application-level column check (defense in depth). For the 6 deployments without PII, RDS storage encryption alone is sufficient.

### 7.3 Defer to a future "data-at-rest" platform team

**Rejected.** The 5 customer contracts signed in 2026-Q1 reference encryption-at-rest; we are out of compliance. Deferring creates contractual risk that compounds.

## 8. References

- `findings/2026-06-21-v18-cycle-8-probe.md` § L52 — origin score
- `findings/2026-06-22-L52-baseline.md` — Phase 1 audit (to be written)
- `docs/adr/2026-06-21/ADR-077-vault-migration-roadmap.md` — companion Vault ADR
- `docs/adr/2026-06-21/ADR-080-pen-test-bug-bounty-roadmap.md` — external audit gate
- NIST SP 800-111 — Guide to Storage Encryption Technologies
- OWASP ASVS V1.14 §2.4 — Cryptographic Storage
- SOC2 CC6.1, ISO 27001 A.10.1 — compliance drivers
