# Resource Efficiency & Cost Attribution

**Last reviewed**: 2026-06-16
**Review cadence**: Quarterly

## Service-level cost breakdown

| Service / Workflow | Cloud / Runtime | Monthly cost (USD) | Per-transaction | Trend |
|---|---|---|---|---|
| _TBD - populate from cloud bill_ | | | | |

## Optimization backlog
- _None tracked yet - file via `gh issue create --label cost-opt`._

## Right-sizing
- CI runners: 2x standard Linux, no GPU.
- Storage: TBD.

## FinOps notes
- Target: keep CI cost per-merge below $0.50.
- Anomaly alert: monthly cost > 1.5x trailing 3-month avg.

> Per 30-pillar framework L25 (Resource Efficiency). Created by the org-wide 30-pillar audit on 2026-06-16.
