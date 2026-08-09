# OmniRoute Operations Runbook (WP-023)

**Status**: ACTIVE
**Owner**: @KooshaPari/core
**Last reviewed**: 2026-08-08
**Audit ref**: [`100-PILLAR-AUDIT-REPORT.md`](../audit/100-PILLAR-AUDIT-REPORT.md) § C12 Operations (L133, L134)

This runbook is the on-call operator's reference for OmniRoute in production. It complements the per-feature playbooks in this directory (e.g. `bifrost-migration.md`) by covering the cross-cutting incident response, triage, and recovery procedures that apply regardless of which subsystem is affected.

---

## Table of Contents

1. [Severity classification](#1-severity-classification)
2. [First-response checklist](#2-first-response-checklist)
3. [Common failure modes](#3-common-failure-modes)
4. [Diagnostic commands](#4-diagnostic-commands)
5. [Rollback procedures](#5-rollback-procedures)
6. [Database recovery](#6-database-recovery)
7. [Encryption-key recovery](#7-encryption-key-recovery)
8. [Communication templates](#8-communication-templates)
9. [Postmortem process](#9-postmortem-process)

---

## 1. Severity classification

Use this matrix to triage within 5 minutes of detection. When in doubt, classify one level higher and downgrade later.

| Sev | User impact | Examples | First-response SLA |
| --- | --- | --- | --- |
| **SEV-1** | Total outage, data loss, security breach | API returning 5xx >50%, DB corruption, exposed secrets, ransomware | Page on-call, acknowledge in 5 min, status page update in 15 min |
| **SEV-2** | Major degradation, subset of users blocked | Single provider 100% failing, encryption decrypt errors >1%, auth broken | Acknowledge in 15 min, status page update in 30 min |
| **SEV-3** | Minor degradation, workaround available | Elevated latency p99 >2s for one route, single API key quota miscalc | Acknowledge in 1h, ticket in business hours |
| **SEV-4** | Cosmetic, no functional impact | Typo in docs, broken non-critical link, dashboard widget misalignment | Next-business-day ticket |

### Escalation path

```
on-call engineer → @KooshaPari/core (15 min) → @KooshaPari/owner (30 min)
```

For SEV-1 and SEV-2, post in `#incident` (if configured) and open an incident channel `#inc-YYYY-MM-DD-slug` immediately — do not wait for confirmation.

---

## 2. First-response checklist

Run these steps in order. Stop and escalate as soon as you have enough information to act.

- [ ] **1. Acknowledge** the alert in the on-call tool (Opsgenie / PagerDuty / equivalent).
- [ ] **2. Classify** severity using §1.
- [ ] **3. Open** an incident ticket: `incident-YYYY-MM-DD-<short-slug>` in Linear / GitHub Issues.

- [ ] **4. Snapshot** the current state before changing anything:

  ```bash
  ts=$(date -u +%Y%m%dT%H%M%SZ)
  mkdir -p /var/log/omniroute/incidents/$ts
  docker logs omniroute --since 1h > /var/log/omniroute/incidents/$ts/app.log 2>&1
  docker logs omniroute-db --since 1h > /var/log/omniroute/incidents/$ts/db.log 2>&1
  cp .env /var/log/omniroute/incidents/$ts/env.snapshot
  ```

- [ ] **5. Health check** using §4 diagnostics. Note: do not restart anything yet.
- [ ] **6. Match symptoms** against §3 failure modes. If a known playbook applies (e.g. `bifrost-migration.md` §6), follow it.
- [ ] **7. Decide**: fix forward, rollback (§5), or escalate.
- [ ] **8. Communicate** using §8 templates.
- [ ] **9. Resolve** the alert once metrics return to baseline for 15 minutes.
- [ ] **10. Schedule** the postmortem (§9) within 24h of SEV-1/SEV-2 closure.

---

## 3. Common failure modes

### 3.1 Database locked / contention

**Symptoms**: `SQLITE_BUSY` errors in logs, `app.db-journal` growing, request latency spike.

**Root causes**:

- Long-running migration held a write transaction.
- Backup process competing for the WAL.
- Circuit breaker opened but request fan-out continues (write amplification).

**Triage**:

```bash
docker exec omniroute-db sqlite3 /data/omniroute.db "PRAGMA wal_checkpoint(TRUNCATE);"
# If still busy after 30s:
docker exec omniroute-db lsof /data/omniroute.db
```

**Fix**: identify the holder, kill the offending connection, set `SQLITE_BUSY_TIMEOUT=5000` if not already.

### 3.2 Encryption failures

**Symptoms**: `EncryptionRuntimeError` or `EncryptionDecryptionError` in logs, decrypt returning `{ ok: false, error: "auth-tag-failure" }`.

**Root causes**:

- `ENCRYPTION_KEY` rotated without re-encrypting existing rows.
- Backup restored from before a key rotation.
- Corrupt ciphertext (disk corruption, partial write).

**Triage**: see `docs/encryption-error-handling-migration.md` for the full classification taxonomy.

**Fix**:

- If auth-tag-failure on a single row → log and quarantine, continue serving others.
- If auth-tag-failure on >1% of rows → STOP, page @KooshaPari/core. Do not attempt to "fix" data.
- If `ENCRYPTION_KEY` env var unset → startup canary will exit; check `.env`.

### 3.3 Provider 5xx cascade

**Symptoms**: All traffic to one provider failing, breaker open, retry queue growing.

**Triage**:

```bash
# Check breaker state per provider
curl -s http://localhost:20128/admin/breakers | jq '.[] | select(.state=="open")'
```

**Fix**: breakers auto-recover. If persistent >5 min:

1. Disable provider in `providerRegistry.ts` (toggle `enabled: false`).
2. Open PR with rollback.
3. Page provider if public status page doesn't already explain.

### 3.4 High memory usage

**Symptoms**: RSS >2 GB on a 1 GB-provisioned container, OOM kills, GC pauses.

**Root causes**:

- Embedding cache unbounded growth (`vectorStore.ts`).
- Large in-flight response streaming buffer (compression pipelines).
- Memory leak in provider adapter (see git log for recent changes).

**Triage**:

```bash
docker stats omniroute --no-stream
docker exec omniroute node -e "require('v8').writeHeapSnapshot('/tmp/heap.heapsnapshot')"
```

**Fix**: short-term restart + reduce `MAX_CONCURRENT_STREAMS`. Long-term: profile with `clinic.js`.

---

## 4. Diagnostic commands

### 4.1 Health endpoints

```bash
# Liveness (always returns 200 if process is up)
curl -fsS http://localhost:20128/healthz

# Readiness (checks DB, encryption, OTEL)
curl -fsS http://localhost:20128/readyz

# Breaker state
curl -fsS http://localhost:20128/admin/breakers | jq

# Rate limiter state (per provider)
curl -fsS http://localhost:20128/admin/ratelimit | jq
```

### 4.2 Logs

```bash
# Tail structured logs (pino JSON)
docker logs -f omniroute 2>&1 | npx pino-pretty

# Filter for errors only
docker logs omniroute --since 1h 2>&1 | jq 'select(.level >= 50)'

# Encryption-related
docker logs omniroute --since 1h 2>&1 | jq 'select(.msg | test("encrypt|decrypt"; "i"))'
```

### 4.3 Database inspection

```bash
# Open a read-only shell (does not lock the DB)
docker exec -it omniroute-db sqlite3 -readonly /data/omniroute.db

# Inspect schema
.schema

# Check table sizes
SELECT name, (SELECT COUNT(*) FROM pragma_table_info(name)) AS cols
FROM sqlite_master WHERE type='table';

# Recent audit events
SELECT * FROM mcp_audit ORDER BY id DESC LIMIT 50;
```

### 4.4 Process inspection

```bash
# Top by CPU / memory
docker exec omniroute top -bn1 | head -20

# Active connections
docker exec omniroute ss -tan | head -20

# Open file descriptors (leak detection)
docker exec omniroute ls /proc/$(pgrep -f node)/fd | wc -l
```

---

## 5. Rollback procedures

### 5.1 Application rollback (Next.js standalone)

```bash
# List available versions (kept in /var/lib/omniroute/releases/)
ls /var/lib/omniroute/releases/

# Atomic symlink swap
ln -sfn /var/lib/omniroute/releases/v3.8.49-koosha.0 /var/lib/omniroute/current
docker restart omniroute

# Verify
curl -fsS http://localhost:20128/healthz && \
  curl -fsS http://localhost:20128/version | jq
```

### 5.2 Database migration rollback

Use the expand-contract pattern. Migrations are forward-only — to "rollback" a migration, ship a new migration that reverses the schema change.

```bash
# Identify last applied migration
docker exec omniroute-db sqlite3 /data/omniroute.db \
  "SELECT * FROM schema_migrations ORDER BY id DESC LIMIT 5;"

# See docs/db-migration-author.md for authoring a down-migration.
```

### 5.3 Configuration rollback

`.env` is version-controlled under `deploy/env-templates/`. To rollback:

```bash
# Diff current vs known-good
git -C deploy/env-templates/ log --all -p .env.production | less

# Restore
cp deploy/env-templates/.env.production@<good-sha> .env
docker restart omniroute
```

### 5.4 Full stack rollback

When the application and DB are entangled (e.g. schema changed and code depends on it):

1. **Stop** traffic: `docker compose stop omniroute`
2. **Restore DB** from the pre-migration backup (§6)
3. **Restore app** to the last release before the migration
4. **Verify** with §4 health endpoints
5. **Restart** traffic: `docker compose start omniroute`

---

## 6. Database recovery

### 6.1 From auto-backup

`DISABLE_SQLITE_AUTO_BACKUP=false` keeps hourly snapshots in `/var/lib/omniroute/backups/`.

```bash
# List available backups
ls -lh /var/lib/omniroute/backups/

# Pick the most recent good one and verify
sqlite3 /var/lib/omniroute/backups/omniroute-20260808T120000.db "PRAGMA integrity_check;"

# Restore (container must be stopped)
docker compose stop omniroute
cp /var/lib/omniroute/backups/omniroute-20260808T120000.db /data/omniroute.db
docker compose start omniroute
```

### 6.2 From WAL corruption

If `PRAGMA integrity_check` returns non-OK but the backup is also corrupt:

```bash
# Salvage what you can from the WAL
sqlite3 /data/omniroute.db ".recover" > /tmp/dump.sql 2>&1
sqlite3 /data/omniroute-recovered.db < /tmp/dump.sql
```

### 6.3 When all else fails

Last-resort: rebuild from upstream PR merge state using `scripts/db/rebuild-from-migrations.ts` (regenerates an empty DB and replays schema migrations). **All data is lost** — escalate to @KooshaPari/owner before running.

---

## 7. Encryption-key recovery

> **WARNING**: Rotating `ENCRYPTION_KEY` without re-encrypting existing rows makes all encrypted data permanently unreadable. There is no recovery path for data encrypted under a lost key.

### 7.1 Confirm the situation

```bash
# Are decrypts failing in bulk?
docker logs omniroute --since 10m 2>&1 | \
  jq 'select(.classification=="auth-tag-failure") | .ciphertextPrefix' | \
  sort | uniq -c | sort -rn | head
```

If >1% of rows are failing, STOP and escalate. The key is wrong or data is corrupted.

### 7.2 If the key was lost

There is no recovery. Restore from a backup taken when the key was known (see §6).

### 7.3 If the key was rotated intentionally

1. Decrypt all rows with the old key.
2. Re-encrypt with the new key.
3. Use the `scripts/db/reencrypt-all.ts` helper (kept off-path; ask @KooshaPari/core).
4. Verify zero failures: `docker logs omniroute --since 5m 2>&1 | jq 'select(.classification)' | wc -l`

---

## 8. Communication templates

### 8.1 Status page (SEV-1, SEV-2)

```
[INVESTIGATING] 2026-08-08T12:34Z — Elevated error rates on chat completions.
We are investigating. Updates every 15 minutes.

[IDENTIFIED] 2026-08-08T12:49Z — Root cause: provider X returning 503s due to upstream
capacity issue. Failover to provider Y is active.

[MONITORING] 2026-08-08T13:04Z — Error rates returned to baseline (<0.1%). Continuing
to monitor for 30 minutes before marking resolved.

[RESOLVED] 2026-08-08T13:34Z — Incident resolved at 13:04Z. Postmortem to follow
within 24 hours.
```

### 8.2 Internal escalation

```
@here SEV-2 incident — chat completions degraded.

What: 35% of requests to provider X failing with 503.
When: Started 2026-08-08T12:30Z, detected via PagerDuty alert.
Impact: ~200 customers, chat completion endpoint only.
Current action: Failover enabled, error rate dropping.
Decision needed: Hold for monitor or rollback?
Docs: https://github.com/KooshaPari/OmniRoute/issues/<n>
```

---

## 9. Postmortem process

For every SEV-1 and SEV-2, a blameless postmortem is required within 24h of resolution.

### 9.1 Template

Use the standard blameless structure (see `~/.claude/skills/incident-postmortem/SKILL.md` if available):

1. **Summary** — one-paragraph user-facing description.
2. **Impact** — duration, affected requests, revenue (if applicable), customers affected.
3. **Timeline** — UTC timestamps of detection, escalation, mitigation, resolution.
4. **Root cause** — the technical chain of events (not "human error").
5. **Contributing factors** — what made this worse or easier to miss.
6. **What went well** — detection, response, communication.
7. **What went poorly** — same dimensions.
8. **Action items** — owner + due date for each.
9. **Lessons** — patterns that apply to other systems.

### 9.2 Storage

Postmortems live at `docs/postmortems/YYYY-MM-DD-<slug>.md`. Each must be linked from `docs/index.md` and the corresponding GitHub issue closed with a comment linking to it.

### 9.3 Action item tracking

Action items become Linear/GitHub issues with label `postmortem-action`. They are reviewed in the weekly on-call retro.

---

## Appendix A — Quick reference

| Need | Look here |
| --- | --- |
| Service won't start | §4.1 health, §3.2 encryption canary, `.env` validation |
| Provider failing | §3.3 cascade, `bifrost-migration.md` §9 troubleshooting |
| DB issue | §6 recovery, `docs/db-migration-author.md` |
| Encryption issue | §7, `docs/encryption-error-handling-migration.md` |
| Roll back a release | §5.1 app, §5.2 DB, §5.3 config |
| Write a postmortem | §9, `~/.claude/skills/incident-postmortem/SKILL.md` |
| Add an alert | `deploy/monitoring/` (Prometheus rules) |
| Change severity scheme | This file, §1 + linked issue |

## Appendix B — Related documents

- [`bifrost-migration.md`](./bifrost-migration.md) — Bifrost tier-1 cut-over playbook (more detailed rollout procedure)
- [`journey-traceability.md`](./journey-traceability.md) — How user journeys map to system components (for impact assessment)
- [`../encryption-error-handling-migration.md`](../encryption-error-handling-migration.md) — Encryption error taxonomy
- [`../security/SIGNED_COMMITS.md`](../security/SIGNED_COMMITS.md) — Commit signing requirements
- [`../security/COMPLIANCE.md`](../security/COMPLIANCE.md) — Compliance audit trail (event types)
- [`../audit/100-PILLAR-AUDIT-REPORT.md`](../audit/100-PILLAR-AUDIT-REPORT.md) — Original audit that identified the runbook gap
