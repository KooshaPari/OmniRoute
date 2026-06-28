# Chaos Engineering in Production

**Authority:** ADR-024 (Factory AI cross-cutting standard), ADR-049 (drift detection)
**Owner:** chaos-engineering circle
**Source of truth:** `chaos-injection/` (this repo) + ADR-041 (security audit cadence)
**Last updated:** 2026-06-22

## Mission

Build confidence in the production fleet's resilience by deliberately injecting
failures in a controlled, observable, reversible way. Goal: surface latent
failure modes BEFORE they manifest in production. Anti-goal: prove the system
is broken (it always is, somewhere — that's the point of this work).

## Principles (per ADR-024 Factory AI crosswalk)

1. **Blameless.** A chaos experiment that surfaces a real bug is a *win*, not
   a failure. The system was always broken; we just made the brokenness
   visible. Post-mortem tone: "what did we learn?" not "whose fault?"

2. **Steady state first.** Before any experiment, define the steady-state
   metric (e.g., p99 latency, error rate, throughput). The experiment is
   successful only if the steady state recovers within the agreed SLO
   after the fault is removed.

3. **Production traffic.** Synthetic load is a smell — it doesn't exercise
   the same code paths as real users. All experiments run against the live
   production fleet during a scheduled game day.

4. **Containment is non-negotiable.** Every experiment MUST have a
   documented rollback. The experiment is automatically aborted if the
   rollback condition triggers (e.g., error rate > 5%).

5. **Smallest blast radius first.** Start with a single instance, then a
   single availability zone, then a single region. Never the global
   fleet on the first try.

## Tooling

We use `chaos-injection/` (this repo) as the canonical experiment runner.
The crate provides:

- **Fault types:** latency, error, partition, CPU pressure, memory pressure,
  disk full, DNS failure, process kill
- **Scope:** single instance, AZ, region, custom label selector
- **Rollback:** automatic (timer-based) or manual (operator action)
- **Observability:** all faults emit spans with the experiment ID; metrics
  show "during experiment" windows clearly

## Game-day cadence

Game days are scheduled **monthly**, on the 3rd Wednesday. Each game day
focuses on one failure domain:

| Month | Domain | Lead | Backup |
|-------|--------|------|--------|
| Jul 2026 | Network partitions | chaos-net | chaos-app |
| Aug 2026 | Resource exhaustion (CPU/mem/disk) | chaos-sys | chaos-net |
| Sep 2026 | Dependency failures (DB, cache, S3) | chaos-dep | chaos-sys |
| Oct 2026 | Process lifecycle (kill, OOM, restart loop) | chaos-app | chaos-dep |
| Nov 2026 | Time and clock skew (NTP failure, DST) | chaos-time | chaos-app |
| Dec 2026 | Combined failure modes (chaos monkey) | chaos-lead | all |

The 3rd-Wednesday cadence is documented in `docs/calendar.json` as
`game_day` events (next to release-train events).

## Steady-state metrics per service

| Service | Metric | SLO |
|---------|--------|-----|
| `pheno-runtime` | p99 RPC latency | < 250ms |
| `pheno-mcp-router` | error rate | < 0.1% |
| `phenoEvents` | event delivery p99 | < 1s |
| `phenoObservability` | span export success rate | > 99.9% |
| `Civis` | request success rate | > 99.5% |

## Experiment template

Every game day uses this template:

```yaml
# experiments/2026-07-15-network-partition.yaml
apiVersion: chaos.phenotype.dev/v1
kind: Experiment
metadata:
  id: net-partition-2026-07-15
  owner: chaos-net
  game_day: 2026-07-15
spec:
  hypothesis: |
    If a single AZ loses connectivity to the rest of the fleet, requests
    will fail over to the secondary AZ within 30s and p99 latency will
    stay under 500ms.
  scope:
    selector: { az: us-east-1a }
    duration: 5m
  faults:
    - type: partition
      from: { az: us-east-1a }
      to:   { az: us-east-1b,az: us-east-1c }
  steady_state:
    metric: http_request_duration_seconds:p99
    threshold: 0.5
    window: 30s
  abort:
    - error_rate > 0.05
    - manual: # any operator can abort
  rollback:
    automatic: true
    timeout: 5m  # match the fault duration
  observability:
    dashboard: https://grafana.phenotype.dev/d/net-partition-2026-07-15
    alert_channel: "#chaos-game-day"
  outcome:
    success: hypothesis confirmed, steady state recovered
    failure: hypothesis falsified, post-mortem required
```

## Rollback criteria (hard stops)

A chaos experiment MUST be aborted if ANY of these trigger:

1. Error rate exceeds 5% for any service in the experiment scope.
2. p99 latency exceeds 2x the SLO for any service in scope.
3. SLO burn rate (the rate at which the error budget is consumed) exceeds
   the 14-day alerting threshold (typically 14.4x for 1h window).
4. Any dependent service (not in the experiment scope) reports a regression.
5. A customer-impacting incident is declared (P0/P1).
6. The experiment owner manually aborts.

## Post-experiment review

Within 48h of every game day:

1. **Results doc** committed to `findings/chaos/YYYY-MM-DD-<experiment>.md`
   with: hypothesis, observed behavior, screenshots of the steady-state
   metric, list of any latent bugs found, time to recovery.
2. **Blameless retro** held with the on-call team for the day.
3. **Action items** filed in the issue tracker with priority + owner.
4. **Playbook updates** if the experiment surfaced a missing runbook step.
5. **Next month's experiment** is refined based on what was learned.

## Integration with the rest of the fleet

- **`pheno-otel`:** chaos experiment IDs are added as span attributes so
  the trace view shows "during experiment" windows. See ADR-012.
- **`pheno-events`:** an `experiment.started` and `experiment.aborted` event
  is emitted to the event bus for downstream consumers.
- **`pheno-predict` (ADR-047):** experiment outcomes feed back into the
  predictive DRY detector so similar code patterns get extra scrutiny.
- **`pheno-drift-detector` (ADR-049):** post-experiment, the drift detector
  scans for any new substrate violations introduced during the experiment.

## See also

- `chaos-injection/README.md` — tool usage
- `chaos-injection/PROBABILITY.md` — sampling rates and statistical design
- ADR-024 — Factory AI cross-cutting standard
- ADR-041 — security audit cadence (chaos is the operational analog)
- `docs/release-train.md` — game days are scheduled alongside releases
- `findings/chaos/` — historical experiment results
- `playbooks/chaos/` — manual runbooks for each experiment type
