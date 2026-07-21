# Monitoring Runbook — Dispatch Binding Tiers

## Prometheus Queries

### Current tier per edge
```promql
dispatch_current_tier{edge_name="scoring.combo.scoreSimd"}
```

### Tier decision rate (per minute)
```promql
rate(dispatch_tier_decisions_total[1m])
```

### Kill-switch activations
```promql
changes(dispatch_tier_decisions_total{reason="kill_switch"}[5m]) > 0
```

### CPU-pressure downgrades
```promql
rate(dispatch_tier_decisions_total{reason="high_cpu"}[5m]) > 0
```

### Reconcile sweep duration
```promql
histogram_quantile(0.99, dispatch_reconcile_sweep_duration_seconds_bucket)
```

### FFI availability (T3 edges)
```promql
dispatch_current_tier{edge_name="scoring.combo.scoreSimd"} == "T3"
```

## Grafana Panels

### Panel 1: Edge Tier Heatmap
- Query: `dispatch_current_tier`
- Type: Heatmap (rows = edges, columns = time, color = tier)
- Alert: Any edge stuck at T1 for >5 min (except intentional kill-switch)

### Panel 2: Tier Decision Rate
- Query: `rate(dispatch_tier_decisions_total[5m])`
- Type: Time series
- Alert: >10 decisions/min indicates instability

### Panel 3: Kill-Switch Activations
- Query: `changes(dispatch_tier_decisions_total{reason="kill_switch"}[5m])`
- Type: Stat
- Alert: Any activation triggers PagerDuty P2

### Panel 4: Reconcile Sweep Latency
- Query: `histogram_quantile(0.99, dispatch_reconcile_sweep_duration_seconds_bucket)`
- Type: Time series
- Alert: p99 >500ms indicates edge count or resolveTier bottleneck

## Alert Rules (prometheus-rules.yaml)

| Alert | Condition | Severity | Action |
|---|---|---|---|
| DispatchEdgeDegraded | `dispatch_current_tier == "T1"` for 5m | warning | Check FFI cdylib availability |
| DispatchKillSwitchActive | `dispatch_tier_decisions_total{reason="kill_switch"} > 0` | critical | Page on-call; check provider health |
| DispatchHighFlipRate | `rate(dispatch_tier_decisions_total[5m]) > 10` | warning | Check CPU pressure + kill-switch state |
| DispatchReconcileStuck | `time() - dispatch_reconcile_last_success_timestamp > 300` | critical | Check reconciler goroutine + event loop |

## Operational Procedures

### Disable dispatch at deploy time (no code change)
```bash
export OMNIROUTE_DISPATCH_HOT_PATH_ENABLED=false
```

### Force all edges to T1 (emergency)
```bash
curl -X POST http://localhost:3000/api/admin/kill-switch -d '{"action":"activate"}'
```

### Restore edges to defaults
```bash
curl -X POST http://localhost:3000/api/admin/kill-switch -d '{"action":"deactivate"}'
```

### Override single edge tier
```bash
export OMNIROUTE_EDGE_TIER_scoring_combo_scoreSimd=T1
```

### Verify FFI cdylib health
```bash
node --import tsx/esm -e "import('./open-sse/rpc/ffi.ts').then(m => console.log(m.__ffiHealthCheck()))"
```
