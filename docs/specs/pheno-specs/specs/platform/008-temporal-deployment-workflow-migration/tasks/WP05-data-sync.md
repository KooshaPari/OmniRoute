# WP05: Data Sync Workflow Migration to Hatchet

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 2 - Core Migration
**Wave**: 1
**Dependencies**: WP04 (Hatchet must be deployed first)
**Author**: Claude Sonnet 4.6

## Mission

Audit all NATS JetStream data sync consumers and migrate them to Hatchet cron workflows. Data sync pipelines should be: scheduled automatically, retried on transient failure, alerted on permanent failure, and visible in the Hatchet dashboard.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-004
- Plan: `../plan.md` — WP05 section
- Depends on: `WP04-hatchet-ci.md`

## Context

Before writing code, audit NATS for all data sync-related consumers:

```bash
# Find NATS sync-related code
grep -r "nats\|jetstream\|JetStream" --include="*.rs" --include="*.toml" -l \
  | xargs grep -l "sync\|etl\|pipeline\|consume\|subscribe" 2>/dev/null
```

Document each sync pipeline:
- Source (what DB/endpoint?)
- Destination (what DB/endpoint?)
- Sync interval (hourly/daily/manual?)
- What happens on failure (retry? alert? skip?)
- Is data loss acceptable or must it be exactly-once?

## What to Build

### Generic Data Sync Workflow Pattern

```yaml
# infra/hatchet/workflows/data-sync.yaml
# Pattern: source → transform → destination → alert

name: data-sync-{PIPELINE_NAME}
description: Sync data from {SOURCE} to {DESTINATION}

on:
  cron: "{SCHEDULE}"  # e.g., "0 */6 * * *" (every 6 hours)

concurrency:
  limit: 1  # Never run two syncs of the same pipeline concurrently

retries:
  max_attempts: 3
  initial_interval: 60s
  max_interval: 3600s
  multiplier: 2.0

steps:
  - name: extract
    run: |
      echo "Extracting from {SOURCE}..."
      # Implement source-specific extraction
    timeout: 300s
    on_failure:
      step: alert-extract-failed

  - name: transform
    run: |
      echo "Transforming data..."
      # Implement data transformation
    timeout: 600s
    on_failure:
      step: alert-transform-failed

  - name: load
    run: |
      echo "Loading to {DESTINATION}..."
      # Implement destination write
    timeout: 600s
    on_failure:
      step: alert-load-failed

  - name: verify
    run: |
      echo "Verifying sync integrity..."
      # Compare source and destination record counts
    timeout: 120s
    on_failure:
      step: alert-verify-failed

  - name: notify-success
    run: |
      echo "Sync completed successfully"
      curl -s -X POST "$SLACK_WEBHOOK_URL" \
        -H "Content-Type: application/json" \
        -d '{"text":"[{PIPELINE}] sync completed at $(date)"}'
    timeout: 30s

failure:
  step: alert-sync-failed
  run: |
    echo "Data sync failed after all retries"
    curl -s -X POST "$SLACK_WEBHOOK_URL" \
      -H "Content-Type: application/json" \
      -d '{"text":"[{PIPELINE}] data sync FAILED after all retries. Manual intervention required."}'
```

### Implement Each Sync Pipeline

Based on the NATS audit, implement each pipeline. Examples:

#### Pipeline 1: Postgres → Postgres (cross-DB sync)

```python
# hatchet/workflows/sync_pg_to_pg.py
import hatchet
from datetime import datetime
import psycopg2
import logging

@hatchet.step()
def extract():
    conn = psycopg2.connect(os.environ["SOURCE_DB_URL"])
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM events WHERE synced_at IS NULL LIMIT 10000")
    rows = cursor.fetchall()
    columns = [desc[0] for desc in cursor.description]
    conn.close()
    return {"rows": rows, "columns": columns}

@hatchet.step()
def transform(data):
    # Example: clean timestamps, normalize fields
    return {
        "cleaned": [
            {**dict(zip(data["columns"], row)), "synced_at": datetime.utcnow().isoformat()}
            for row in data["rows"]
        ]
    }

@hatchet.step()
def load(data):
    conn = psycopg2.connect(os.environ["DEST_DB_URL"])
    cursor = conn.cursor()
    for row in data["cleaned"]:
        cursor.execute(
            "INSERT INTO events_sink (SELECT * FROM jsonb_populate_record(NULL::events_sink, %s)) "
            "ON CONFLICT DO NOTHING",
            [json.dumps(row)]
        )
    conn.commit()
    conn.close()
    return {"loaded": len(data["cleaned"])}
```

## Alerting on Failure

```bash
# Cron job: check Hatchet for failed runs, escalate if not acknowledged
# scripts/check_failed_syncs.sh
#!/bin/bash
HATCHET_API="https://hatchet.internal:8080"
FAILED=$(curl -sf "$HATCHET_API/api/v1/runs?status=failed&since=1h" | jq '.total')

if [ "$FAILED" -gt 0 ]; then
  curl -s -X POST "$SLACK_WEBHOOK_URL" \
    -d "{\"text\":\"⚠️ $FAILED Hatchet sync runs failed in the last hour\"}"
fi
# Add to crontab: */15 * * * * /opt/scripts/check_failed_syncs.sh
```

## Acceptance Criteria

- [ ] All NATS data sync consumers documented and removed (or marked for WP09)
- [ ] Each sync pipeline runs on its configured cron schedule
- [ ] Failed steps retry with exponential backoff (max 3)
- [ ] After all retries exhausted: alert fires to Slack/webhook
- [ ] Sync history visible in Hatchet dashboard (success/failure, duration, record count)
- [ ] Concurrency limit of 1 per pipeline enforced (no parallel syncs of same pipeline)
- [ ] Data integrity verified: source and destination record counts match after successful sync
