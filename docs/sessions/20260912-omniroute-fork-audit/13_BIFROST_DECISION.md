# ADR: Bifrost Integration — COMMIT / REVERT Decision

> **Date:** 2026-09-14
> **Deadline:** 2026-09-17 (per ADR-031, 90-day post-B6 review)
> **Status:** Decision pending benchmark results
> **Author:** Jcode (automated audit)

---

## 1. Decision Summary

| Option | Verdict | Rationale |
|--------|---------|-----------|
| **COMMIT** | **RECOMMENDED** | Bifrost is healthy, already integrated in shadow mode, Go binary is battle-tested |
| REVERT | Not recommended | Would require removing working shadow-mode code with no replacement |

---

## 2. Evidence

### 2.1 Health Check (2026-09-12)

| Metric | Value | Threshold | Status |
|--------|-------|-----------|--------|
| GitHub stars | 8,003 | >1,000 | PASS |
| Daily commits | Yes (last: 2026-09-13) | Active | PASS |
| Open issues | Low | <500 | PASS |
| License | Apache-2.0 | OSI-approved | PASS |
| npm package | @maximhq/bifrost v1.6.3 | Available | PASS |
| Binary size | 116.4 MB | <200 MB | PASS |
| Install method | npm (Go binary wrapper) | Non-invasive | PASS |

### 2.2 Integration State

- **Shadow mode:** Active on main since Phase 1-3
- **Install code:** `src/lib/services/installers/bifrost.ts` (production-ready)
- **Sidecar architecture:** HTTP gateway on 127.0.0.1:8080, Go binary
- **No Node.js SDK dependency:** Clean HTTP-only integration
- **Version pinning:** `@maximhq/bifrost@^2.1.1` (npm wrapper v1.6.3)

### 2.3 Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Bifrost abandoned | Low (8k stars, active) | Medium | Version pin, fork if needed |
| Breaking API change | Low (HTTP gateway) | Low | Pin version, test before upgrade |
| Binary incompatibility | Low (Go, cross-platform) | Medium | Test on CI before deploy |
| License change | Low (Apache-2.0) | Low | Already OSI-approved |

### 2.4 Benchmark Results

> **PENDING:** Run `docs/benchmarks/bifrost-benchmark.sh` locally with Bifrost sidecar.
> Required: Bifrost on 127.0.0.1:8080 + OmniRoute dev server on localhost:3000.
> Measures: cold start, p50/p95/p99 latency, streaming TTFB, memory usage.

---

## 3. Decision Framework

### COMMIT if ALL of the following are true:
- [x] Bifrost is healthy (stars, commits, license) — YES
- [x] Integration is already built and working — YES (shadow mode)
- [x] No critical security vulnerabilities — YES
- [ ] Benchmark shows acceptable performance — PENDING
- [ ] Team agrees on version pinning strategy — PENDING

### REVERT if ANY of the following are true:
- [ ] Benchmark shows unacceptable latency (>2x TS pipeline)
- [ ] Critical security vulnerability found
- [ ] Bifrost project abandoned (no commits for >30 days)
- [ ] Team decides to use alternative (e.g., native TS proxy)

---

## 4. Recommendation

**COMMIT with conditions:**

1. **Pin version** to `@maximhq/bifrost@^2.1.1` in installer
2. **Run benchmark** before removing shadow mode
3. **Keep shadow mode** until benchmark validates performance
4. **Document rollback** procedure (revert to TS-only proxy)

### Rollback Procedure (if needed):
```bash
# 1. Set BIFROST_ENABLED=false in env
# 2. Restart OmniRoute — falls back to TS pipeline
# 3. No code changes needed — shadow mode is designed for this
```

---

## 5. Next Steps

1. Run benchmark locally (requires Bifrost sidecar + OmniRoute dev server)
2. Document benchmark results in this file
3. Make final COMMIT/REVERT call based on results
4. If COMMIT: remove shadow mode flag, enable Bifrost in production
5. If REVERT: set BIFROST_ENABLED=false, document reason
