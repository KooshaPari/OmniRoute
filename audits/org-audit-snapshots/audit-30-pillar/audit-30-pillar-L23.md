# L23 — Audit log & compliance

## Scope
Append-only audit trail, tamper-evident logging, SOC 2 / HIPAA / GDPR evidence, and log retention policy across the Phenotype bloc (AgilePlus + thegent + Tracely + Tracera + satellites).

## SOTA 2026
- **Append-only at the storage layer:** WORM (write-once-read-many) bucket/object-lock (S3 Object Lock, GCS Bucket Lock), or DB-level triggers that `RAISE` on `UPDATE`/`DELETE` (Postgres `REVOKE UPDATE/DELETE`, SQLite trigger + `INSTEAD OF` view).
- **Tamper-evidence:** hash chain (each event `prev_hash = sha256(prev_event_id || payload)`), Merkle-tree anchor, or signed-log (Ed25519/RSA over `event_hash`) with periodic checkpoint to an external witness (transparency log, e.g. Rekor/Sigstore; or public anchor like RFC 3161 timestamp).
- **Compliance mappings:** SOC 2 CC7.2 (system monitoring), CC7.3 (security event detection), CC8.1 (change management); HIPAA §164.312(b) (audit controls); GDPR Art. 30 (records of processing activities) and Art. 32 (security of processing).
- **Retention:** SOC 2 minimum 1 year, HIPAA 6 years, GDPR "no longer than necessary" (typically 6 years for financial, varies). Default practice: 7 years.
- **Remote / WORM sync:** at-rest encryption + off-host append-only sink (S3 Object Lock, Azure Blob Immutable Storage, GCS Bucket Lock).
- **References:** NIST SP 800-92 (Guide to Computer Security Log Management), ISO 27001 A.12.4, SOC 2 Trust Services Criteria §CC7.

## Phenotype state

| Crate | File:Line | What | Status |
|---|---|---|---|
| `agileplus-governance` | `agileplus-governance/src/audit.rs:16-67` | `AuditEvent` struct — 25 fields incl. id, timestamp, level, action, category, message, user_id, client_ip, user_agent, session_id, request_id, resource, resource_id, method, endpoint, parameters, result, error_code, error_message, duration_ms, metadata, stack_trace, synced_at, created_at | ✓ rich event shape |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:69-205` | `AuditEvent` builder (`success`/`warn`/`error` + `with_*` chain) | ✓ ergonomic |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:207-274` | `AuditFilter` — action/category/level/result/user/resource/time/unsynced/pagination | ✓ queryable |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:277-304` | `AuditLogger` — `new(db_path, retention_days)` / `in_memory()` | ✓ plumbed |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:307-359` | `init_schema` — single `audit_events` SQLite table, 3 indexes (timestamp, action, synced_at) | △ base schema; **no triggers for append-only** (see Gap 1) |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:362-404` | `log(&AuditEvent)` — plain `INSERT INTO audit_events` | ✗ **no `prev_hash` / signature** (see Gap 2) |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:407-521` | `query(&AuditFilter)` — parameterized `SELECT` with pagination | ✓ safe (no string concat into SQL — only bound params) |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:524-582` | `stats()` — total / today / errors / by-level / top-10 actions | ✓ |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:585-603` | `mark_synced(&[id])` — sets `synced_at` for remote-sync bookkeeping | △ ready for remote sync, but no actual remote sink (see Gap 5) |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:606-616` | `cleanup()` — `DELETE FROM audit_events WHERE timestamp < cutoff` (cutoff = now − retention_days) | ✓ retention enforced; **but no WORM — admin can also call `DELETE` directly** |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:619-630` | `unsynced_count()` | ✓ |
| `agileplus-governance` | `agileplus-governance/src/audit.rs:633-668` | 2 tests — round-trip and stats | △ thin — no concurrency test, no tampered-event test |
| `agileplus-governance` | `agileplus-governance/src/config.rs:74,167` | `retention_days: u32 = 90` (env override `AGILEPLUS_LOCAL_RETENTION_DAYS`) | △ **90 days is below SOC 2 (1y) / HIPAA (6y) / GDPR (6y)** defaults (see Gap 4) |
| `agileplus-governance` | `agileplus-governance/src/client.rs:13,25,35,229-253` | `GovernanceClient` wraps `AuditLogger`, exposes `log_audit`, `query_audit`, `stats`, `unsynced_count` | ✓ |
| `agileplus-governance` | `agileplus-governance/src/client.rs:119,148,188` | Audit calls from rate-limit / policy / channel paths | ✓ instrumentation in place |
| `agileplus-subcmds` | `agileplus-subcmds/src/audit.rs:14-24` | `AuditEntry` struct — timestamp, command, phase, agent, feature_slug, args, result | ✓ simple shape |
| `agileplus-subcmds` | `agileplus-subcmds/src/audit.rs:26-31` | `AuditPhase::{PreDispatch, PostDispatch}` | ✓ |
| `agileplus-subcmds` | `agileplus-subcmds/src/audit.rs:40-134` | `AuditLog` — JSONL file at `.agileplus/audit.jsonl`, `OpenOptions::new().create(true).append(true)` | △ file is "append-only" by virtue of the open mode; **truncate is not prevented at FS level** (see Gap 1, 2) |
| `agileplus-subcmds` | `agileplus-subcmds/src/audit.rs:122-133` | `append(&AuditEntry)` — `writeln!(file, "{json}")` per entry | ✗ **no hash chain, no signature** (see Gap 2) |
| `agileplus-subcmds` | `agileplus-subcmds/src/audit.rs:196-209` | test `audit_log_append_only` — 5 entries, read back in order | △ name is misleading — file is open-append, not tamper-evident |
| `phenoShared` | `phenoShared/crates/phenotype-testing/src/lib.rs:24` | `use phenotype_governance::{AuditEvent, AuditLog, …}` — note: `phenotype-governance` (different crate!) | ✗ import is **unused** per compiler warning (build diagnostic); suggests a second governance crate diverged (see Gap 6) |
| `thegent` | `thegent/THEGENT_MOBILE_AUTOMATION_PRD.md:147,249,293,703,705-706,827` | "SOC2 audit ready", "GDPR ready", "HIPAA device compliance" — claims in PRD | △ claims without code evidence; no compliance-tagged code path (see Gap 4) |
| `thegent` | `thegent/THEGENT_MOBILE_AUTOMATION_PRD.md:825-827` | RC2 milestone: "SOC2 audit ready" | △ no acceptance test, no auditor evidence bundle |

## Gaps

1. **No DB-level append-only enforcement** — `agileplus-governance/src/audit.rs:307-359`
   - The schema is a plain `CREATE TABLE IF NOT EXISTS audit_events (...)` with no `CREATE TRIGGER … BEFORE UPDATE/DELETE ON audit_events BEGIN RAISE(ABORT, 'append-only');` and no `REVOKE UPDATE, DELETE` (SQLite supports neither — needs trigger).
   - Anyone with `INSERT` rights (e.g. via a compromise of the SQLite file's owning process) can rewrite history.
   - **Effort:** S. Add a `BEFORE UPDATE` and `BEFORE DELETE` trigger that `RAISE(ABORT, 'audit_events is append-only')`. Document the constraint. Add a CI test that asserts `UPDATE` and `DELETE` on the table fail with the expected error.

2. **No hash chain, no event signature, no Merkle anchor** — `agileplus-governance/src/audit.rs:362-404`, `agileplus-subcmds/src/audit.rs:122-133`
   - Both audit sinks store events as plain rows / plain JSON lines. There is no `prev_hash` column, no `event_hash` column, and no `signature` column.
   - Tampering with one row (or one line) leaves no trace — a SOC 2 CC7.2 evidence reviewer will flag this immediately.
   - **Effort:** M. Add `prev_hash CHAR(64)`, `event_hash CHAR(64)`, `signature CHAR(64)` (or `signature` variable-length) columns. On `INSERT`, compute `event_hash = sha256(prev_hash || canonical_json(event))`; sign `event_hash` with the future `thegent-crypto` Ed25519 path (see L22 Gap 1). Ship a `verify_chain()` method that walks the table and raises on the first mismatch. Add a `MerkleRoot` checkpoint table and a `checkpoint_to_rekor()` method (or stub the integration point for Rekor).

3. **No compliance-tagged event categories or compliance metadata** — `agileplus-governance/src/types.rs:9,237,244` (only `AuditEventId`)
   - `ActionCategory` exists in the `AuditEvent` struct (`audit.rs:28`) but I see no enum definition in the governance crate — needs `grep` for `ActionCategory::` to confirm enum is present. (To be re-verified.)
   - There is no `compliance_frameworks: Vec<ComplianceFramework>` field, no `data_subject_id` (GDPR Art. 30), no `pii_categories` field, no `control_id` (SOC 2 CC-mapping).
   - **Effort:** M. Define `ComplianceFramework::{SOC2, HIPAA, GDPR, FedRAMP, PCIDSS}` and add an optional `compliance: Option<ComplianceContext>` to `AuditEvent`. Tag events at log sites. Add a `query_by_compliance(framework)` filter.

4. **Retention default (90 days) is below SOC 2 / HIPAA / GDPR minimums** — `agileplus-governance/src/config.rs:74,167`
   - SOC 2 (TSC §CC7.2) commonly requires ≥ 1 year; HIPAA §164.316(b)(2)(i) requires ≥ 6 years; GDPR "no longer than necessary" — typical retention for security audit is 6–7 years.
   - 90 days is fine for an early-stage product, not for a regulated deployment.
   - **Effort:** S. Add `retention_days_min: u32 = 2555` (≈ 7 years) as the production default, gated by a `compliance_mode: Standard | HIPAA | SOC2 | GDPR | FedRAMP` config field. Refuse to start with a sub-minimum retention when `compliance_mode != Standard`.

5. **No remote WORM sink** — `agileplus-governance/src/audit.rs:585-603`
   - `synced_at` is updated locally, but `mark_synced` does not actually push to anything. There is no S3 Object Lock uploader, no Rekor log submission, no GCS Bucket Lock sink.
   - **Effort:** M. Implement a `RemoteSync` trait with `S3ObjectLockSync` (uses `aws-sdk-s3` with `ObjectLockMode=COMPLIANCE`, `ObjectLockRetainUntilDate`) and a `RekorSync` (uses `rekor-cli` or the HTTP API). Wire into `mark_synced`.

6. **Diverged governance crate in `phenoShared`** — `phenoShared/crates/phenotype-testing/src/lib.rs:24` (compiler warning visible in `tracera/target/debug/.fingerprint/phenotype-testing…/output-lib-phenotype_testing:1`); see also `thegent/.venv/.../joserfc` for the `joserfc` lib hint
   - There is a `phenotype-governance` crate (different from `agileplus-governance`) that exposes `AuditLog` and `AuthzEngine`. The `phenotype-testing` crate imports it but the import is unused, suggesting either a parallel implementation or a planned migration.
   - This risks audit-log divergence — two implementations, two schemas, two retention policies.
   - **Effort:** S. Audit: is `phenotype-governance` a wrapper, a fork, or a successor? Consolidate to one crate. File: open a `phenotype-governance-vs-agileplus-governance.md` decision doc.

7. **`agileplus-subcmds` audit log is "append-only" in name only** — `agileplus-subcmds/src/audit.rs:122-133, 196-209`
   - The file is opened with `OpenOptions::create(true).append(true)` — fine, but the file is a regular file on the project FS. A `truncate` (`> audit.jsonl`) wipes history; an `edit` rewrites a line. No fsync (line 131: `writeln!(file, "{json}")?` — no `.sync_all()`).
   - The test at line 196 is named `audit_log_append_only` but only checks write+read order, not tamper-evidence.
   - **Effort:** S. Add `file.sync_all()?` after each write. Rename the test to `audit_log_writes_in_order`. Implement the hash-chain + signature from Gap 2 and add a `verify()` method.

8. **No load / soak / concurrency tests on the audit log** — `agileplus-governance/src/audit.rs:633-668` (only 2 tests)
   - Only `test_audit_log` (round-trip) and `test_audit_stats`. No test for: concurrent writers, large volume (10k events), crash mid-insert, `cleanup()` correctness, hash-chain integrity.
   - **Effort:** S. Add `tests/audit_stress.rs`: 1k concurrent writers via `tokio::spawn`, verify count. Add `tests/audit_cleanup.rs`: insert 1k old + 1k new, call `cleanup()`, assert only new remain. Add `tests/audit_chain.rs`: insert 100 events, mutate one row, assert `verify_chain()` returns Err.

## Recommendations
1. **(P0)** Add append-only DB triggers on `audit_events` (`BEFORE UPDATE`/`BEFORE DELETE` → `RAISE(ABORT)`). Add a CI test that asserts the triggers fire. Effort: 0.5 day.
2. **(P0)** Add `prev_hash` / `event_hash` / `signature` columns and a `verify_chain()` method. Wire signing to the future `thegent-crypto` Ed25519 (see L22 Gap 1). Effort: 1 week.
3. **(P1)** Add `ComplianceFramework` enum + `ComplianceContext` field to `AuditEvent`. Tag events at log sites. Add `query_by_compliance()`. Effort: 2 days.
4. **(P1)** Add `compliance_mode: Standard|HIPAA|SOC2|GDPR|FedRAMP` config, enforce minimum retention (2555d for SOC2/HIPAA/GDPR). Refuse boot otherwise. Effort: 1 day.
5. **(P1)** Add a `RemoteSync` trait + S3 Object Lock backend. Add a periodic background task that pushes unsynced events. Effort: 3 days.
6. **(P2)** Consolidate `agileplus-governance` and `phenotype-governance` into one crate; pick the more complete implementation. Effort: 1 day (audit + decision) + 1 day (migration).
7. **(P2)** Add stress / cleanup / chain tests in `agileplus-governance/tests/`. Effort: 1 day.
8. **(P3)** Add `sync_all()` on the JSONL audit sink (`agileplus-subcmds/src/audit.rs:131`). Rename the `append_only` test. Effort: 0.5 hour.
