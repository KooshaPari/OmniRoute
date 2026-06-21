# Audit — Audit-Chain Hash Verification on Startup (side-20)

**Date:** 2026-06-20 18:50 PDT
**Task ID:** side-20
**Agent:** orch-v11-real-audit-3
**Verdict:** The audit-chain (`pheno-audit::Chain`) writes a hash-linked sequence of events to append-only storage, but **does not verify the chain on startup**. A corrupted chain (database tampering, partial restore, bit rot) goes undetected until a downstream consumer trips on a missing event. Recommend a `verify_on_boot()` pass with bounded duration.

## Scope

The audit-chain is consumed by:
- `phenotype-payment-core` (PCI-DSS audit trail)
- `phenotype-hub` (workflow + RBAC audit)
- `phenotype-workflow` (workflow transition history)
- `phenotype-forms` (form-submission history)

Storage: append-only `audit_events` table (PostgreSQL 16) plus a local WAL file (`/var/log/phenotype/audit.wal`). The chain shape: each event contains `prev_hash` (SHA-256 of the previous event's canonical bytes) and `self_hash` (SHA-256 of `prev_hash || canonical_bytes`).

## Current state

`Chain::append()` writes and returns; `Chain::verify_range(start, end)` exists as a public API but **is never called at startup**. There is no scheduled verification job.

## Threat model

| Scenario | Detection today | Impact |
|---|---|---|
| Bit rot on the WAL file | none (silent) | audit gap; PCI-DSS violation |
| Restore from a partial backup | none (silent) | audit gap; forensic failure |
| Malicious DBA deletes a row | none (silent) | compliance failure |
| Disk corruption on `/var/log/phenotype` | none (silent) | audit gap |

PCI-DSS v4.0 §10.5.2 requires "audit log integrity verification" at a frequency that suits risk — for `phenotype-payment-core`, that's *per-restart* minimum.

## Proposed implementation

```rust
// pheno-audit/src/chain.rs
impl Chain {
    /// Verify the entire chain. Bounded-duration (chunked by `chunk_size`).
    /// Returns the index of the first invalid event, or Ok(()) on success.
    pub fn verify_on_boot(&self, chunk_size: usize) -> Result<(), ChainError> {
        let total = self.len();
        let mut prev_hash = [0u8; 32];   // genesis

        for start in (0..total).step_by(chunk_size) {
            let end = (start + chunk_size).min(total);
            let chunk = self.read_range(start, end)?;
            for (i, event) in chunk.iter().enumerate() {
                let idx = start + i;
                if event.prev_hash != prev_hash {
                    return Err(ChainError::HashMismatch { idx, expected: prev_hash, actual: event.prev_hash });
                }
                let expected = Self::hash_event(&event.canonical_bytes(), &prev_hash);
                if event.self_hash != expected {
                    return Err(ChainError::SelfHashMismatch { idx });
                }
                prev_hash = event.self_hash;
            }
            // Yield to scheduler to keep startup non-blocking on long chains
            tokio::task::yield_now().await;
        }
        Ok(())
    }
}
```

## Boot integration

```rust
// phenotype-payment-core/src/main.rs
#[tokio::main]
async fn main() -> Result<()> {
    let chain = Chain::open("/var/log/phenotype/audit.wal").await?;

    // Verify the chain before accepting traffic. Bounded at 5s; log warning if exceeded.
    let verify_start = Instant::now();
    tokio::time::timeout(
        Duration::from_secs(5),
        chain.verify_on_boot(chunk_size: 1024),
    ).await??;
    tracing::info!(elapsed_ms = verify_start.elapsed().as_millis(), "audit chain verified");

    // ... accept traffic ...
}
```

5-second budget is a starting point; tune after measurement. The chain verification should be **non-blocking on the event loop** — `tokio::task::yield_now()` between chunks keeps the runtime responsive.

## Telemetry

- `pheno.audit.verify.duration_ms` (histogram, label: `result=ok|fail`)
- `pheno.audit.verify.last_idx` (gauge — index of last verified event at boot)
- `pheno.audit.verify.failure_total` (counter — alert at any non-zero value)

P0 alert (PagerDuty) on any verification failure.

## Action items

1. **Add `Chain::verify_on_boot()`** to `pheno-audit` — ~80 LOC + 4 unit tests (empty chain, valid chain, mid-chain corruption, end-of-chain corruption).
2. **Wire into `phenotype-payment-core`** — highest blast radius (PCI-DSS).
3. **Wire into `phenotype-hub`, `phenotype-workflow`, `phenotype-forms`** — same pattern, ~5 LOC each.
4. **Emit OTLP metrics** via `pheno-tracing` (ADR-012).
5. **Document in `pheno-audit/docs/boot-verification.md`** — operator-facing runbook.

## When to skip

- **Test / dev environments** — gate the verification on `env::var("PHENO_AUDIT_VERIFY_ON_BOOT")` so it's a no-op by default; enabled in staging + prod.
- **Cold-start latency-sensitive binaries** (< 50ms boot budget) — defer verification to first request via `OnceCell<Future>`; *not* applicable to the audit-bearing services here.

## Acceptance criteria

- `Chain::verify_on_boot()` ships with 4 unit tests + 1 property test (chain mutation → detection) within **1 week**.
- All 4 audit-bearing services call the verifier within **2 weeks**.
- A dashboard panel in Grafana shows `pheno.audit.verify.duration_ms` p50/p99, with P0 alert on failure.

**Refs:** `ADR-012` (tracing), `pheno-audit/src/chain.rs:144-220`, PCI-DSS v4.0 §10.5.2, `findings/2026-06-19-L5-110-substrate-audit.md`.