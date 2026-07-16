# L63 SLO Burn-rate specification

## Service-level objective
p99 latency ≤ 2000ms over trailing 30-day window.

## Burn-rate alert windows

| Burn rate | Window | Severity | Action |
|-----------|--------|----------|--------|
| 2× (Fast) | 1h | P1 | Page on-call |
| 1× (Slow) | 6h | P2 | File incident |
| 5% residual | 7d | P3 | Postmortem at month end |

## Alerting rules
- Error budget: 99.9% uptime → 43m 12s / month allowed breach
- Fast burn: 100% of budget consumed in 1h → immediate page (P1)
- Slow burn: 100% of budget consumed in 6h → next-business-day incident (P2)
- Multi-window: 1h + 6h firing simultaneously → P1 regardless

## Dashboard panels
1. Current p99 vs threshold (gauge, 5m refresh)
2. Burn rate gauge (rate of error budget consumption)
3. Remaining budget (percentage, Gauge)
4. Alert history (timeline, 30d)
