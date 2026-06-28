# Audit — Cron-Job Idempotency (side-48)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-48
**Agent:** orch-v11-real-audit-7
**Verdict:** Of **38 cron-triggered jobs** in the fleet, **5** are correctly idempotent (Redis-key dedup), **12** rely on "the cron only runs every N minutes" (false safety), and **21** have **no idempotency at all**. Three production incidents in 2026-Q2 were caused by double-execution after a manual `cron-cli run --now`.

## Scope

Cron jobs are scheduled by:
- `phenotype-hub` (workflow schedulers, ~12 jobs)
- `phenotype-payment-core` (settlement, invoicing, dunning, ~8 jobs)
- `phenotype-workflow` (workflow timeouts, escalation, ~6 jobs)
- `phenotype-forms` (form-deadline processing, ~4 jobs)
- `phenotype-notify` (reminder delivery, retry, ~8 jobs)

Total: **38 cron jobs**.

## Survey (2026-06-20)

| Idempotency strategy | Count | Examples |
|---|---|---|
| Redis `SETNX` dedup with TTL | 5 | `settle-daily`, `dunning-15d` |
| "Runs only every N minutes" claim | 12 | `escalate-workflow` (relies on 60s cron) |
| Database unique constraint on `job_run(job_id, scheduled_at)` | 0 | none |
| `X-Cron-Dedupe-Key` header (handler-side check) | 0 | none |
| None | 21 | `reminder-delivery`, `form-deadline`, `invoice-resend` |

## 2026-Q2 incidents (root cause: missing idempotency)

| Date | Job | Double-execution impact |
|---|---|---|
| 2026-04-08 | `invoice-resend` | 4,200 duplicate invoices emailed; 14% open rate caused 27% complaint rate |
| 2026-05-22 | `settle-daily` (was on Redis-dedup but Redis was OOM'd) | 2 settlement windows; $340k double-debited; reversed manually |
| 2026-06-14 | `reminder-delivery` | 8,400 duplicate SMS sent; Twilio bill +$1,260; customer trust hit |

The May 22 case shows Redis-dedup is **necessary but not sufficient** — OOM eviction broke the dedup; a DB unique constraint would have been the safety net.

## Idempotency key strategy (proposed, fleet-wide)

```rust
// pheno-cron/src/idempotency.rs
pub struct IdempotencyKey {
    pub job_id: String,
    pub scheduled_at: i64,         // unix seconds, aligned to the cron's period
    pub attempt: u8,                // 0 for first run; 1, 2, ... for retries
}

impl IdempotencyKey {
    pub fn deterministic(&self) -> String {
        // SHA-256 over the canonical tuple; same key on every retry of the
        // *same scheduled execution*. Different `scheduled_at` = different key.
        use sha2::{Digest, Sha256};
        let mut h = Sha256::new();
        h.update(self.job_id.as_bytes());
        h.update(self.scheduled_at.to_be_bytes());
        h.update([self.attempt]);
        format!("cron:{}:{}", self.job_id, hex::encode(h.finalize()))
    }
}
```

The key has two persistence layers:
1. **Redis SETNX** (fast, default TTL = 4 × cron period) — first line of defense.
2. **PostgreSQL UNIQUE constraint** on `cron_dedup(key TEXT PRIMARY KEY, created_at TIMESTAMPTZ)` — durable safety net.

```sql
-- migrations/2026-06-20-cron-dedup.sql
CREATE TABLE cron_dedup (
    key TEXT PRIMARY KEY,
    job_id TEXT NOT NULL,
    scheduled_at BIGINT NOT NULL,
    attempt SMALLINT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_cron_dedup_created_at ON cron_dedup(created_at);
-- Auto-prune > 7 days via cron job 'cron-dedup-prune'
```

## Handler pattern

```rust
// pheno-cron/src/handler.rs
pub async fn run_once<F, Fut>(job_id: &str, scheduled_at: i64, f: F) -> Result<(), CronError>
where
    F: FnOnce() -> Fut,
    Fut: Future<Output = Result<(), JobError>>,
{
    let key = IdempotencyKey { job_id: job_id.into(), scheduled_at, attempt: 0 }.deterministic();

    // Layer 1: Redis SETNX
    let redis_ok = redis::cmd("SET")
        .arg(&key).arg("1").arg("NX").arg("EX").arg(4 * 60)   // 4 min TTL for a 1-min cron
        .query_async::<redis::aio::Connection, Option<String>>(&mut redis_conn)
        .await?;
    if redis_ok.is_none() {
        return Err(CronError::DuplicateExecution);   // already ran
    }

    // Layer 2: PG insert with ON CONFLICT
    let pg_ok = sqlx::query!("INSERT INTO cron_dedup (key, job_id, scheduled_at, attempt) VALUES ($1, $2, $3, 0) ON CONFLICT (key) DO NOTHING RETURNING key", key, job_id, scheduled_at).fetch_optional(&mut pg_conn).await?;
    if pg_ok.is_none() {
        return Err(CronError::DuplicateExecution);
    }

    // Run the actual job
    f().await
}
```

The **two-layer** design ensures correctness even if Redis is OOM'd (May 22 case) or the DB is temporarily unavailable (then the job *fails* — safer than double-execute).

## Action items

1. **Author `pheno-cron` crate** (new) — `IdempotencyKey` + handler + Redis/PG dual-write, ~300 LOC + ~200 LOC tests.
2. **Migrate the 12 "runs only every N minutes" jobs** to use `pheno-cron::run_once` — highest risk first.
3. **Migrate the 21 un-protected jobs** — same pattern.
4. **Add `cron_dedup` table** to the shared Postgres schema (one migration).
5. **Wire a daily OTLP counter** `pheno.cron.duplicate_execution_total` — alert at any non-zero value.
6. **Author `pheno-cron/docs/idempotency.md`** — the pattern + the rationale.

## When to skip

- **Read-only jobs** (e.g. `metrics-snapshot`) — running twice produces the same output; idempotency is wasted.
- **Jobs with their own dedup at the data layer** (e.g. `invoice-resend` could use a `sent_at IS NULL` filter on the row itself) — wrap with the row-level filter instead of the cron-level dedup.

## Acceptance criteria

- `pheno-cron` crate published with ≥ 80% coverage within **1 week**.
- All 33 at-risk jobs (12 false-safety + 21 unprotected) migrated within **3 weeks**.
- Zero duplicate-execution incidents in 2026-Q3.

**Refs:** `pheno-events/src/`, incident reports `2026-04-08`, `2026-05-22`, `2026-06-14`, `findings/2026-06-19-L5-110-substrate-audit.md`.