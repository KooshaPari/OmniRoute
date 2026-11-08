# Bifrost Tier-1 Router Migration Playbook (B7)

**Status**: DRAFT (2026-06-19)
**Owner**: @KooshaPari/core
**Tracks**: v8.1 Bifrost track, B7 of [PLAN.md](../../PLAN.md) § 2.5.2
**Refs**: ADR-031, BIFROST-BACKEND.md, trafficShadow.ts, bifrost.ts

---

## Table of Contents

1. [What this playbook is for](#1-what-this-playbook-is-for)
2. [Architecture summary](#2-architecture-summary)
3. [Phase 1: Shadow (B6) — DONE](#3-phase-1-shadow-b6--done)
4. [Phase 2: Gradual rollout (5% → 25% → 100%)](#4-phase-2-gradual-rollout-5--25--100)
5. [Phase 3: Full cut-over](#5-phase-3-full-cut-over)
6. [Rollback procedure](#6-rollback-procedure)
7. [Monitoring & decision review](#7-monitoring--decision-review)
8. [Post-migration cleanup](#8-post-migration-cleanup)
9. [Troubleshooting](#9-troubleshooting)
10. [Checklist](#10-checklist)

---

## 1. What this playbook is for

This playbook documents the **safe cut-over from OmniRoute's legacy TypeScript dispatch (`chatCore`) to the Bifrost Tier-1 Go router**. It is the operator's step-by-step guide for B6→B7 rollout.

**Do not run this unless B6 shadow data has been collected and the 30-day decision review (ADR-031 § Decision Review) has concluded with a "commit" verdict.**

Prerequisites:
- B1–B6 infrastructure landed in `main` (✅ all done per [PLAN.md § 2.5.2](../../PLAN.md))
- At least 14 days of B6 shadow data collected (5% → 25% → 100% mirror)
- 30-day decision review completed with "commit" verdict
- Post-#89 merge: `trafficShadow.ts`, `bifrostShadow.ts`, `bifrost.ts` wired in main

---

## 2. Architecture summary

```
┌──────────────┐     /v1/chat/completions     ┌──────────────┐
│  OmniRoute   │ ────────────────────────────► │   Bifrost    │
│  (TS / SSE)  │                               │   (Go, 340MB)│
│              │◄────────────────────────────   │              │
│  Tier-2:     │     response + metadata        │  Tier-1:     │
│  A2A, MCP,   │                               │  routing,    │
│  skills,     │                               │  provider    │
│  policy,     │                               │  dispatch,   │
│  dashboard   │                               │  load-bal    │
└──────────────┘                               └──────────────┘
```

- **Tier-1 (Bifrost)**: Go binary, ~6k LOC, 24+ providers, MIT, MCP-native. Runs as a sidecar next to OmniRoute.
- **Tier-2 (OmniRoute)**: TypeScript engine. Adds A2A skills, MCP-router, cost analysis, policy engine, virtual-key minting, dashboard.
- **Shadow mode**: OmniRoute sends requests to both `chatCore` (control) and Bifrost (shadow). The shadow response is logged but the control response is returned to the client.

Bifrost is **not** a fork replacement for OmniRoute. It is the *router substrate*. OmniRoute *always* stays in front.

---

## 3. Phase 1: Shadow (B6) — DONE

B6 is already deployed via [PR #89](https://github.com/KooshaPari/OmniRoute/pull/89). The shadow infrastructure is in `open-sse/services/trafficShadow.ts`.

### What was done

| Component | File | Purpose |
|---|---|---|
| Shadow service | `open-sse/services/trafficShadow.ts` | Orchestrates mirror/swap modes, percentage selection |
| Shadow executor | `open-sse/executors/bifrostShadow.ts` | Dual-writes to Bifrost, records outcome |
| Shadow DB | `src/lib/db/bifrostShadow.ts` | Tracks shadow decisions + outcomes |
| Shadow migration | `src/lib/db/migrations/101_bifrost_shadow.sql` | Schema for shadow tracking |
| SLO targets | `ops/slos.yaml` | p99 < 500ms, error rate < 0.1%, cost parity within 10% |

### Shadow states (from trafficShadow.ts)

```
off      → no shadow (default)
mirror   → dispatch to both, return chatCore, log Bifrost for comparison
swap     → return Bifrost result, shadow chatCore for comparison
```

### Activating shadow

```bash
# Set environment
export OMNIROUTE_SHADOW_MODE=mirror
export OMNIROUTE_SHADOW_PERCENTAGE=100

# Or via API
curl -X POST http://localhost:3000/admin/shadows/config \
  -H "Content-Type: application/json" \
  -d '{"mode": "mirror", "percentage": 100}'
```

Once shadow is active at 100% for at least 14 days, collect:
- p99 latency (Bifrost vs chatCore)
- Error rate (4xx, 5xx, timeout)
- Token cost
- Response quality (structural equivalence check)

---

## 4. Phase 2: Gradual rollout (5% → 25% → 100%)

After the decision review concludes **commit**, the rollout proceeds in controlled steps.

### Step 2a — 5% swap (3 days)

```bash
# Phase 2 — 5% of requests go through Bifrost
export OMNIROUTE_SHADOW_MODE=swap
export OMNIROUTE_SHADOW_PERCENTAGE=5
```

**Checklist before proceeding:**
- [ ] Bifrost binary running (health via `/health`)
- [ ] Shadow mode `mirror` at 100% for ≥14 days with acceptable metrics
- [ ] Bifrost model cache populated (`bifrost_models` table non-empty)
- [ ] Virtual-key minting configured per [[VIRTUAL-KEYS.md](../frameworks/VIRTUAL-KEYS.md)]

**Monitor:**
- p99 latency delta < 100ms
- Error rate delta < 0.05%
- Cost delta < 10%

**If any metric regresses >20% vs mirror baseline → roll back to `mirror` mode immediately (see §6).**

### Step 2b — 25% swap (5 days)

```bash
export OMNIROUTE_SHADOW_PERCENTAGE=25
```

**Checklist before proceeding:**
- [ ] 72h of 5% swap with no regressions
- [ ] SRE on-call briefed
- [ ] Rollback plan verified (can instant-revert to chatCore)

**Monitor:** Same metrics as step 2a.

### Step 2c — 100% swap (7 days)

```bash
export OMNIROUTE_SHADOW_PERCENTAGE=100
```

**Checklist before proceeding:**
- [ ] 120h of 25% swap with no regressions
- [ ] Bifrost binary resource usage profiled (CPU < 1 core, memory < 500 MB)
- [ ] Full monitoring dashboard green
- [ ] Load tested at 2x peak production traffic

---

## 5. Phase 3: Full cut-over

After 7 days of 100% swap with stable metrics, Bifrost becomes the **default** path.

### Step 3a — Make Bifrost the default (not swap)

The executor (`open-sse/executors/bifrost.ts`) already has the dual-path architecture:
- `BIFROST_ENABLED=true` + `BIFROST_SHADOW_MODE=off` → Bifrost is the *only* path, chatCore is not called
- `BIFROST_ENABLED=true` + `BIFROST_SHADOW_MODE=mirror` → dual-write (current B6 state)
- `BIFROST_ENABLED=false` → legacy chatCore only (rollback)

**To cut over:**
```bash
export BIFROST_ENABLED=true
export BIFROST_SHADOW_MODE=off
```

### Step 3b — Deprecate shadow tables

After 7 days with no rollbacks, run:

```bash
# Archive shadow decisions
pg_dump -t bifrost_shadow_decisions -t bifrost_shadow_metrics > /backup/shadow-archive-$(date +%Y%m%d).sql

# Drop shadow tables
echo "DROP TABLE IF EXISTS bifrost_shadow_decisions, bifrost_shadow_metrics;" | psql $DATABASE_URL
```

### Step 3c — Remove shadow conditionals from bifrost.ts

Open `open-sse/executors/bifrost.ts` and remove:
- The legacy shadow-mode override conditional
- The `shadowConfig` initialization
- The `isShadowEnabled`, `shouldShadowRequest`, `recordShadowOutcome` calls

These are now dead code. This is a separate PR to keep the diff clear.

---

## 6. Rollback procedure

### Emergency rollback (instant, < 1 minute)

```bash
# Immediate rollback — bypass Bifrost entirely
export BIFROST_ENABLED=false
export BIFROST_SHADOW_MODE=off
```

No restart needed. The executor re-reads env on each request. Existing connections drain within 60s.

### Graceful rollback (planned, < 5 minutes)

```bash
# Step 1: Drain Bifrost connections (wait for in-flight requests to complete)
curl -X POST http://localhost:3000/admin/shadow/drain

# Step 2: Disable Bifrost
export BIFROST_ENABLED=false
export BIFROST_SHADOW_MODE=off

# Step 3: Verify no requests are reaching Bifrost
grep "bifrost_redirect" /var/log/omniroute/access.log
```

### Post-rollback

After any rollback:

1. **Collect diagnostics** before restarting Bifrost:
   ```bash
   bifrost-http --version --json
   curl http://localhost:8080/health
   curl http://localhost:8080/v1/models
   ```

2. **File a bug report** with:
   - Timestamp of when metrics regressed
   - Bifrost version + OmniRoute commit
   - Shadow metric deltas (p99, error rate, cost)
   - Flag to `@KooshaPari/core`

3. **Do not re-attempt** until the root cause is identified and fixed.

---

## 7. Monitoring & decision review

### Key metrics (documented in `ops/slos.yaml`)

| Metric | Target | Breach threshold |
|---|---|---|
| p99 latency, Bifrost path | < 500ms | > 600ms for 5 min |
| Error rate, Bifrost path | < 0.1% | > 0.3% for 5 min |
| Cost per request, Bifrost | Within 10% of chatCore | > 20% delta for 1h |
| Model cache hit rate | > 95% | < 90% for 1h |
| Bifrost binary uptime | > 99.9% | Downtime > 1 min |

### Decision review timeline (per ADR-031)

| Checkpoint | Action |
|---|---|
| **T+14d** (post 100% mirror) | Compare aggregate metrics. If any target breached → hold. |
| **T+30d** (post 100% mirror) | Final commit-or-revert decision. |
| **T+90d** (post 100% swap) | Long-term SLT agreement with maximhq, or fork-and-modify. |

### Dashboards

| Dashboard | URL |
|---|---|
| OmniRoute main dashboard | `https://koosha-pari.grafana.net/d/omniroute` |
| Bifrost shadow panel | `https://koosha-pari.grafana.net/d/bifrost-shadow` |
| Bifrost health panel | `http://localhost:3000/admin/bifrost/health` |

---

## 8. Post-migration cleanup

### Table removal

After Phase 3c is complete:

```sql
-- Drop shadow tracking tables
DROP TABLE IF EXISTS bifrost_shadow_decisions;
DROP TABLE IF EXISTS bifrost_shadow_metrics;
DROP TABLE IF EXISTS bifrost_shadow_cursors;

-- Drop migration records for shadow
DELETE FROM _migrations WHERE name LIKE '%bifrost_shadow%';
```

### Code removal

- Remove `open-sse/executors/bifrostShadow.ts` (dead executor)
- Remove shadow-related env vars from `.env.example` and deployment configs
- Optional: remove `open-sse/services/trafficShadow.ts` if no longer needed for A/B testing

### Branch stale cleanup

```bash
# Delete merged feature branches
git push origin --delete feat/l5-119-b6-traffic-shadow-2026-06-18
git push origin --delete chore/l5-110-b1-bifrost-vendor-2026-06-18
# ... etc per your cleanup cadence
```

---

## 9. Troubleshooting

### Bifrost binary not starting

**Symptom**: `just bifrost-build` succeeds but the binary exits immediately.

**Diagnosis:**
```bash
RUST_LOG=debug ./dist/bifrost/bifrost-http --config bifrost.yaml 2>&1 | head -50
```

**Common causes:**
- Config file not found or malformed (`bifrost.yaml` missing)
- Port conflict (`netstat -an | grep 8080`)
- Missing Go runtime (should not happen with static binary; verify with `file dist/bifrost/bifrost-http`)

### Model cache not populated

**Symptom**: `bifrost_models` table is empty after `just bifrost-build`.

**Diagnosis:**
```bash
# Check Bifrost is running
curl -s http://localhost:8080/health | jq

# Check Bifrost can list models
curl -s http://localhost:8080/v1/models | jq .data | head -5

# If Bifrost is running but cache is empty, trigger a manual refresh
curl -X POST http://localhost:3000/admin/bifrost/cache/refresh
```

### Shadow mode not activating

**Symptom**: `BIFROST_SHADOW_MODE=mirror` is set but no shadow metrics appear.

**Diagnosis:**
```bash
# Verify env is picked up
grep -rn "SHADOW" /proc/$(pgrep -f "node.*open-sse")/environ 2>/dev/null | tr '\0' '\n' | grep SHADOW

# Check shadow config via API
curl -s http://localhost:3000/admin/shadow/config | jq

# Check if Bifrost base URL is reachable (shadow can't work if Bifrost is down)
curl -s -o /dev/null -w "%{http_code}" http://${BIFROST_BASE_URL:-http://localhost:8080}/health

# Examine shadow decisions table
echo "SELECT * FROM bifrost_shadow_metrics ORDER BY ts DESC LIMIT 10;" | sqlite3 $DATABASE_URL
```

### Pre-push hook blocking merge

**Symptom**: `git push` fails with `husky - pre-push script failed`.

**Fix**: `git push --no-verify origin main` or fix the hook per chore/l5-117-fix-pre-push-hook.

### Provider not found in Bifrost

**Symptom**: Request returns "unknown provider" from `bifrost.ts`.

**Diagnosis:**
```bash
# Check if the provider is in the map
grep -r "my-provider" open-sse/executors/bifrostProviderMap.ts

# Check Bifrost supports the provider
curl -s http://localhost:8080/v1/models | jq '.data[].id' | grep -i my-provider
```

If the provider is missing from the map but supported by Bifrost, add a row to `bifrostProviderMap.ts` and submit a PR.

---

## 10. Checklist

### Pre-migration (Phase 1 → Phase 2 gate)

- [ ] B6 shadow at 100% mirror for ≥14 days
- [ ] 30-day decision review completed with "commit" verdict
- [ ] Bifrost model cache populated and staying populated (cache hit rate > 95%)
- [ ] Virtual-key minting configured per VIRTUAL-KEYS.md
- [ ] Bifrost binary resource-profiled (CPU < 1 core, memory < 500 MB)
- [ ] Rollback procedure verified (env toggle works, < 1 min)
- [ ] Monitoring dashboards green (p99, error rate, cost)
- [ ] SRE on-call briefed
- [ ] Migration changes code-reviewed and merged (this playbook)
- [ ] `ops/slos.yaml` committed

### Phase 2 steps

| Step | Duration | Check |
|---|---|---|
| 5% swap | 3 days | Metrics stable, no alerts |
| 25% swap | 5 days | Metrics stable, no alerts |
| 100% swap | 7 days | Metrics stable, no alerts |
| Full cut-over | — | `BIFROST_SHADOW_MODE=off` + `BIFROST_ENABLED=true` |

### Post-migration (Phase 3 cleanup)

- [ ] Drop shadow tables
- [ ] Remove shadow conditionals from `bifrost.ts`
- [ ] Remove `open-sse/executors/bifrostShadow.ts`
- [ ] Remove `open-sse/services/trafficShadow.ts`
- [ ] Stale branches cleaned up
- [ ] 90-day decision review check-in
