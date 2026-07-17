# WP07: SLO Monitoring Dashboard

**Feature**: 008-temporal-deployment-workflow-migration
**Phase**: 3 - Observability
**Wave**: 2
**Dependencies**: WP06 (Jaeger traces needed for latency data)
**Author**: Claude Sonnet 4.6

## Mission

Create Grafana dashboards displaying workflow-level SLOs for all Temporal and Hatchet workflows. Define alert rules for SLO breach. Alert fires within 5 minutes of threshold violation.

## Reference

- Spec: `../spec.md` — FR-TEMPORAL-008, SC-002, SC-003, SC-008
- Plan: `../plan.md` — WP07 section
- Depends on: `WP06-traces.md`

## Context

Grafana and Prometheus should already be in the planned monitoring stack. Temporal exposes Prometheus metrics at `http://localhost:9233/metrics`. Hatchet also exposes Prometheus metrics. Configure Prometheus to scrape both, then build Grafana dashboards.

Temporal's key metrics:
- `temporal_workflow_started_total` — workflows started
- `temporal_workflow_completed_total` — workflows completed
- `temporal_workflow_failed_total` — workflows failed
- `temporal_workflow_duration_seconds` — histogram of workflow duration
- `temporal_activity_duration_seconds` — histogram of activity duration
- `temporal_activity_retries_total` — activity retry count

Hatchet's key metrics:
- `hatchet_run_started_total`
- `hatchet_run_completed_total`
- `hatchet_run_failed_total`
- `hatchet_step_duration_seconds`

## What to Build

### 1. Prometheus Scrape Config

Update `infra/prometheus/prometheus.yml`:

```yaml
global:
  scrape_interval: 15s
  evaluation_interval: 15s

scrape_configs:
  # Existing targets (node_exporter, etc.)
  # ...

  # Temporal metrics
  - job_name: 'temporal'
    static_configs:
      - targets: ['temporal:9233']
        labels:
          service: temporal
          env: production

  # Hatchet metrics
  - job_name: 'hatchet'
    static_configs:
      - targets: ['hatchet:8080']
        labels:
          service: hatchet
          env: production

  # Jaeger (for trace metrics)
  - job_name: 'jaeger'
    static_configs:
      - targets: ['jaeger:14269']  # Prometheus metrics from Jaeger collector
        labels:
          service: jaeger
          env: production
```

### 2. Temporal Workflow SLO Dashboard

```json
{
  "dashboard": {
    "title": "Temporal Workflow SLOs",
    "panels": [
      {
        "title": "Workflow Completion Rate (7d)",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(temporal_workflow_completed_total[7d])) / sum(rate(temporal_workflow_started_total[7d])) * 100",
            "legendFormat": "Completion Rate %"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "red", "value": null},
                {"color": "yellow", "value": 99.0},
                {"color": "green", "value": 99.9}
              ]
            }
          }
        }
      },
      {
        "title": "p50 / p95 / p99 Latency by Workflow Type",
        "type": "timeseries",
        "targets": [
          {
            "expr": "histogram_quantile(0.50, sum(rate(temporal_workflow_duration_seconds_bucket[5m])) by (le, workflow_type))",
            "legendFormat": "p50 - {{workflow_type}}"
          },
          {
            "expr": "histogram_quantile(0.95, sum(rate(temporal_workflow_duration_seconds_bucket[5m])) by (le, workflow_type))",
            "legendFormat": "p95 - {{workflow_type}}"
          },
          {
            "expr": "histogram_quantile(0.99, sum(rate(temporal_workflow_duration_seconds_bucket[5m])) by (le, workflow_type))",
            "legendFormat": "p99 - {{workflow_type}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "s",
            "custom": {
              "lineWidth": 2
            }
          }
        }
      },
      {
        "title": "Error Rate by Workflow Type",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(temporal_workflow_failed_total[5m])) by (workflow_type) / sum(rate(temporal_workflow_started_total[5m])) by (workflow_type) * 100",
            "legendFormat": "Error Rate - {{workflow_type}}"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percent",
            "thresholds": {
              "steps": [
                {"color": "green", "value": null},
                {"color": "yellow", "value": 0.05},
                {"color": "red", "value": 0.1}
              ]
            }
          }
        }
      },
      {
        "title": "In-Progress Workflows",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(temporal_workflow_started_total) - sum(temporal_workflow_completed_total) - sum(temporal_workflow_failed_total)",
            "legendFormat": "In Progress"
          }
        ]
      },
      {
        "title": "Activity Retry Rate",
        "type": "timeseries",
        "targets": [
          {
            "expr": "sum(rate(temporal_activity_retries_total[5m])) by (activity_type)",
            "legendFormat": "{{activity_type}}"
          }
        ]
      }
    ]
  }
}
```

### 3. Hatchet Job Health Dashboard

```json
{
  "dashboard": {
    "title": "Hatchet Job Health",
    "panels": [
      {
        "title": "Job Success Rate",
        "type": "stat",
        "targets": [
          {
            "expr": "sum(rate(hatchet_run_completed_total[1h])) / sum(rate(hatchet_run_started_total[1h])) * 100"
          }
        ]
      },
      {
        "title": "Step Duration by Job",
        "type": "heatmap",
        "targets": [
          {
            "expr": "sum(rate(hatchet_step_duration_seconds_bucket[5m])) by (le, step_name, workflow)"
          }
        ]
      },
      {
        "title": "Concurrency Utilization",
        "type": "gauge",
        "targets": [
          {
            "expr": "sum(hatchet_runs_in_progress) / sum(hatchet_concurrency_limit)"
          }
        ],
        "fieldConfig": {
          "defaults": {
            "unit": "percentunit",
            "min": 0,
            "max": 1
          }
        }
      },
      {
        "title": "Failed Jobs (Last 24h)",
        "type": "table",
        "targets": [
          {
            "expr": "sum(increase(hatchet_run_failed_total[24h])) by (workflow_name)"
          }
        ]
      }
    ]
  }
}
```

### 4. Grafana Alerting Rules

```yaml
# infra/grafana/provisioning/alerting/temporal-alerts.yml
apiVersion: 1

groups:
  - orgId: 1
    name: temporal_slos
    folder: Temporal
    interval: 1m
    rules:
      - uid: slo-completion-rate
        title: Workflow Completion Rate Below SLO
        condition: C
        data:
          - refId: A
            relativeTimeRange:
              from: 300
              to: 0
            datasourceUid: prometheus
            model:
              expr: sum(rate(temporal_workflow_completed_total[5m])) / sum(rate(temporal_workflow_started_total[5m]))
          - refId: B
            model:
              expr: 0.999
              type: reduce
              reducer: last
          - refId: C
            model:
              expr: "$A < $B"
              type: math
        for: 5m
        annotations:
          summary: "Workflow completion rate dropped below 99.9%"
          description: "Current rate: {{ $values.A }}%"
        labels:
          severity: critical
          team: platform

      - uid: slo-latency-p99
        title: p99 Latency Above 5 Minutes
        condition: C
        data:
          - refId: A
            model:
              expr: histogram_quantile(0.99, sum(rate(temporal_workflow_duration_seconds_bucket{workflow_type="agent_dispatch"}[5m])) by (le))
          - refId: B
            model:
              expr: 300
              type: reduce
              reducer: last
          - refId: C
            model:
              expr: "$A > $B"
              type: math
        for: 5m
        annotations:
          summary: "Agent dispatch p99 latency exceeds 5 minutes"
        labels:
          severity: warning
          team: platform
```

### 5. Wire Alerts to Notification Channel

Add to alert annotations:
```yaml
notifications:
  - uid: slack-platform
    type: slack
    settings:
      url: "${SLACK_WEBHOOK_URL}"
      recipient: "#platform-alerts"
      title: "{{ .CommonLabels.alertname }}"
```

## Acceptance Criteria

- [ ] Temporal SLO dashboard shows live data for all workflow types
- [ ] Hatchet Job Health dashboard shows live data
- [ ] Completion rate panel shows correct percentage
- [ ] Latency histogram shows p50/p95/p99 per workflow type
- [ ] Alert fires within 5 minutes when completion rate drops below 99.9%
- [ ] Alert fires within 5 minutes when p99 latency exceeds 5 minutes
- [ ] All panels survive Grafana restart (provisioned YAML, not manually created)
