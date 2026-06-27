# v28-T1 — L25 Metrics-to-Dashboard Migration Plan

**Pillar:** L25 (metrics-to-dashboard) — scored 2.0/3. Target: 2.5/3.

## Current State

The fleet has 5 Grafana dashboards defined in `dashboards/latency-p99.json` plus 4 more spread across `pheno-otel` and `pheno-port-adapter`. However:

1. Dashboards are **static JSON** — no automated refresh when new metrics are added
2. No **dashboard-as-code** convention — provisioning is manual (import JSON via Grafana UI)
3. Some dashboards are **stale** (reference removed metrics or renamed adapters)

## Migration Strategy

### Phase 1: Dashboard Registry (Week 1)
- Create `dashboards/registry.json` — canonical list of all dashboards with metric sources, refresh interval, and owner
- Wire `scripts/dashboard-sync.sh` to import/export dashboards via Grafana HTTP API

### Phase 2: Dashboard-as-Code (Week 2)
- Convert `dashboards/latency-p99.json` into a **Jinja2 template** with dynamic metric references
- Auto-generate derived dashboards (per-adapter, per-crate) from the template

### Phase 3: CI Gate (Week 3)
- Add `.github/workflows/dashboard-sync.yml` — validates dashboard JSON against `registry.json` on every PR
- Posts diff summary as PR comment showing added/removed panels

## Acceptance Criteria

1. `dashboards/registry.json` covers all 7 active dashboards
2. `scripts/dashboard-sync.sh` can export any dashboard via Grafana API
3. Dashboard CI gate catches stale references before merge
4. No manual dashboard creation after Phase 2

## Pillar Score Lift

L25: 2.0 → 2.5 (v28 T1, cycle-18 P0)
