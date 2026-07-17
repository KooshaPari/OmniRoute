# WP10: 48-Hour Dual-Write Observation Period

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 4 - Cutover
**Wave**: 2
**Dependencies**: WP09 (NATS workflow streams removed)
**Author**: Claude Sonnet 4.6

## Mission

Run Temporal + Hatchet in production alongside the rollback branch for 48 hours. Monitor all SLOs (WP07) continuously. Declare success if zero critical failures in 48 hours, then archive the rollback branch. If any critical failure occurs, execute the rollback procedure (WP08) immediately and stop the observation period.

## Reference

- Spec: `../spec.md` — SC-003, SC-007
- Plan: `../plan.md` — WP10 section
- Depends on: `WP07-slo-dashboards.md`, `WP08-rollback.md`, `WP09-nats-cleanup.md`

## Context

The 48-hour window is based on:
- Full diurnal cycle covered (2 day/night ops periods)
- CI runs (hourly) + data syncs (every 6h) covered multiple times
- Agent dispatches (sporadic) observed over enough volume
- Temporal history retention default is 7 days — 48h is well within retention

During this period:
- Temporal is the primary workflow engine
- `rollback/nats-workflow-logic` branch is archived (not deleted)
- GitHub release tag `v1.0.0-temporal` is created on success

## What to Build

### 1. Observation Runbook

```markdown
# 48-Hour Observation Runbook

## Start Time
Record the exact start time: `date -u +"%Y-%m-%dT%H:%M:%SZ"`

## Monitoring Dashboard
Open Grafana: https://grafana.internal/d/temporal-slos

Key panels to watch:
1. Workflow Completion Rate (target: > 99.9%)
2. p99 Latency (target: < 5 minutes)
3. Error Rate by Workflow Type (target: < 0.1%)

## Alert Contacts
| Role | Name | Contact |
|------|------|---------|
| Primary On-Call | [NAME] | [SLACK/PHONE] |
| Backup On-Call | [NAME] | [SLACK/PHONE] |
| Infrastructure Lead | [NAME] | [SLACK/PHONE] |

## Checkpoints

| Time | Checkpoint | Sign-off |
|------|-----------|----------|
| T+0h | Start observation | [NAME] |
| T+4h | First checkpoint: CI run successful | [NAME] |
| T+12h | Second checkpoint: data sync successful | [NAME] |
| T+24h | Third checkpoint: 1 full day complete | [NAME] |
| T+36h | Fourth checkpoint: no issues | [NAME] |
| T+48h | Final sign-off: migration complete | [NAME] |

## Critical Failure Triggers

Rollback immediately if ANY of:
- [ ] Temporal completion rate < 95% for > 15 consecutive minutes
- [ ] NATS cannot be restored within 10 minutes (SC-007)
- [ ] Data integrity issue detected (source/dest record count mismatch)
- [ ] Temporal server down for > 30 minutes with no auto-recovery
- [ ] > 10% of workflows stuck in "running" state for > 1 hour

## Rollback Procedure

If critical failure detected:
1. Toggle `WORKFLOW_ENGINE=nats` in process-compose.yml
2. Restart workers: `docker compose up -d nats-worker-*`
3. Verify NATS accepting work: `nats sub agent.dispatch --count=1`
4. Open incident in Plane.so
5. Notify team: "ROLLBACK TRIGGERED — Temporal migration failed"

## Success Procedure

If 48 hours pass with zero critical failures:
1. Create GitHub release: `git tag v1.0.0-temporal && git push origin v1.0.0-temporal`
2. Archive rollback branch (do not delete): `git branch -m rollback/nats-workflow-logic archived/rollback/nats-workflow-logic`
3. Notify team: "Migration complete — Temporal is now primary"
4. Close Plane.so incident if one was opened
5. Update ROLLBACK.md with final status
```

### 2. Automated Checkpoint Script

```bash
#!/bin/bash
# scripts/observation-checkpoint.sh
# Run via cron: */4 * * * * /opt/scripts/observation-checkpoint.sh

set -euo pipefail

GRAFANA_URL="${GRAFANA_URL:-http://localhost:3000}"
START_TIME="${OBSERVATION_START_TIME:-}"
SLACK_WEBHOOK="${SLACK_WEBHOOK_URL:-}"

if [ -z "$START_TIME" ]; then
  echo "ERROR: OBSERVATION_START_TIME not set"
  exit 1
fi

ELAPSED=$(($(date +%s) - $(date -d "$START_TIME" +%s)))
HOURS=$((ELAPSED / 3600))

# Query completion rate from Prometheus
COMPLETION_RATE=$(curl -sf "http://localhost:9090/api/v1/query?query=sum(rate(temporal_workflow_completed_total[5m]))/sum(rate(temporal_workflow_started_total[5m]))*100" | jq -r '.data.result[0].value[1] // "0"')

# Query error rate
ERROR_RATE=$(curl -sf "http://localhost:9090/api/v1/query?query=sum(rate(temporal_workflow_failed_total[5m]))/sum(rate(temporal_workflow_started_total[5m]))*100" | jq -r '.data.result[0].value[1] // "0"')

# Query p99 latency
P99_LATENCY=$(curl -sf "http://localhost:9090/api/v1/query?query=histogram_quantile(0.99,sum(rate(temporal_workflow_duration_seconds_bucket[5m]))by(le))" | jq -r '.data.result[0].value[1] // "0"')

# Check thresholds
if (( $(echo "$COMPLETION_RATE < 95" | bc -l) )); then
  echo "🚨 CRITICAL: Completion rate below 95%: $COMPLETION_RATE%"
  curl -sf -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"🚨 OBSERVATION: Completion rate CRITICAL ($COMPLETION_RATE%)\"}" || true
  exit 1
fi

# Log checkpoint
echo "[$(date -u)] Checkpoint T+${HOURS}h: completion=${COMPLETION_RATE}% error=${ERROR_RATE}% p99=${P99_LATENCY}s"

# Notify at milestones
if [ $((HOURS % 12)) -eq 0 ] && [ $HOURS -gt 0 ]; then
  curl -sf -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"✅ Observation checkpoint T+${HOURS}h: completion=${COMPLETION_RATE}% error=${ERROR_RATE}% p99=${P99_LATENCY}s\"}" || true
fi

# Final check at 48h
if [ $HOURS -ge 48 ]; then
  echo "✅ OBSERVATION COMPLETE: 48 hours passed with no critical failures"
  curl -sf -X POST "$SLACK_WEBHOOK" -d "{\"text\":\"✅ MIGRATION SUCCESS: 48-hour observation complete. Temporal is primary.\"}" || true
  # Create release tag
  git tag v1.0.0-temporal
  git push origin v1.0.0-temporal
fi
```

### 3. Observation Dashboard Widget

Add to Grafana dashboard:

```json
{
  "title": "48-Hour Observation Status",
  "type": "stat",
  "gridPos": { "x": 0, "y": 0, "w": 24, "h": 4 },
  "targets": [
    {
      "expr": "floor((time() - $(date -d \"$OBSERVATION_START_TIME\" +%s)) / 3600)",
      "legendFormat": "Hours Elapsed"
    }
  ],
  "fieldConfig": {
    "defaults": {
      "unit": "none",
      "thresholds": {
        "steps": [
          {"color": "green", "value": null},
          {"color": "yellow", "value": 40},
          {"color": "green", "value": 48}
        ]
      }
    }
  }
}
```

### 4. Cron Job Setup

```bash
# Add to crontab (as root or appropriate user)
crontab -e

# Every 15 minutes, run observation checkpoint
*/15 * * * * /opt/scripts/observation-checkpoint.sh >> /var/log/observation.log 2>&1

# Every hour, run rollback test (lightweight health check)
0 * * * * /opt/scripts/test-rollback-health.sh >> /var/log/rollback-health.log 2>&1
```

### 5. Lightweight Rollback Health Test

```bash
#!/bin/bash
# scripts/test-rollback-health.sh
# Lightweight check: is rollback still viable?

set -euo pipefail

# Check: Temporal responding?
TEMPORAL_HEALTH=$(curl -sf http://localhost:8233/health || echo "DOWN")
if [ "$TEMPORAL_HEALTH" != "DOWN" ]; then
  echo "Temporal: OK"
else
  echo "WARNING: Temporal is DOWN"
  curl -sf -X POST "${SLACK_WEBHOOK_URL:-}" -d '{"text":"⚠️ Temporal health check FAILED"}' || true
fi

# Check: NATS responding?
NATS_HEALTH=$(curl -sf http://localhost:8222/healthz || echo "DOWN")
if [ "$NATS_HEALTH" != "DOWN" ]; then
  echo "NATS: OK"
else
  echo "WARNING: NATS is DOWN"
  curl -sf -X POST "${SLACK_WEBHOOK_URL:-}" -d '{"text":"⚠️ NATS health check FAILED"}' || true
fi

# Check: rollback branch exists and is clean
if git show-ref --quiet refs/heads/rollback/nats-workflow-logic; then
  echo "Rollback branch: EXISTS"
else
  echo "WARNING: Rollback branch missing"
fi
```

## Acceptance Criteria

- [ ] Observation runbook created and on-call team briefed
- [ ] `OBSERVATION_START_TIME` set and checkpoint script running
- [ ] Grafana dashboard shows all SLO metrics in green at T+0h
- [ ] At T+4h: first CI run observed and completed successfully
- [ ] At T+12h: first data sync observed and completed successfully
- [ ] At T+24h: completion rate still > 99.9%, zero critical failures
- [ ] At T+48h: all SLOs met, no critical failures, GitHub release tag created
- [ ] Rollback branch archived (renamed, not deleted) after success
- [ ] Plane.so incident closed with final status
