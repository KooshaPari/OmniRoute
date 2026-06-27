# v24 T5 (L63) — SLO Burn-Rate Alert On-Call Runbook

**Date:** 2026-06-22
**Pillar:** L63 — SLO burn-rate alerts (1 → 3)
**Alerts:** `alerts/slo-burn-rate.yaml` (4 multi-window rules)
**Catalog:** `findings/2026-06-22-v24-slo-definitions.md`
**Triage dashboard:** `dashboards/latency-p99.json` (panel 5 = burn-rate gauge)

## Acknowledge within 5 min

Every page here is critical (severity=critical) or warning (severity=warning). Ack in
PagerDuty, snapshot the alert payload (`burn_rate`, `window`, `for` duration), then
walk the playbook below for the matching window.

## 1h fast-burn (14.4x)

- **What it means:** 2% of the 30-day error budget is being consumed every hour.
  At this rate the entire month's budget (~43.2 min) is gone in ~50 hours.
- **First 5 min:** open `dashboards/latency-p99.json` panel 6 (top-5 slowest
  endpoints) and panel 1 (per-crate p99). Identify the offender.
- **Mitigate:** if regression correlates with a recent deploy (last 30 min), roll
  back via `git revert` → push → wait 5 min for re-baseline.
- **Escalate:** if not deploy-related, page secondary on-call and open
  `#inc-slo-burn-<date>`. Freeze deploys (post `#deploys`).
- **Within 24h:** open `findings/<date>-slo-burn-incident.md` per
  `incident-postmortem` skill.

## 6h fast-burn (6x)

- **What it means:** 5% of the 30-day budget in 6h. ~14.4 h to exhaust at this rate.
- **First 5 min:** check whether 1h-fast-burn also fired in the last hour. If yes,
  treat as 1h-fast-burn (1h wins; it's the more aggressive signal).
- **Triage:** dashboards/latency-p99.json panel 5 (burn-rate gauge) — has the
  burn-rate trend been rising or flat? Rising = upstream issue, flat = capacity.
- **Mitigate:** scale fleet if saturation (CPU > 80% or pool exhaustion); rollback
  if code-linked; otherwise drain the noisy crate via feature flag.
- **Escalate:** sustained > 30 min → freeze deploys; > 2 h → secondary on-call.

## 24h slow-burn (1.44x)

- **What it means:** on track to consume 10% of 30-day budget in 24h. Severity is
  warning (ticket, not page) — no immediate fire, but the trend is wrong.
- **First 30 min:** review the deploy log for the last 24h; correlate any latent
  regression with the burn trend. Check `phenotype-router` (per ADR-051) for new
  decision-layer changes that may have shifted SLI.
- **Action:** open a ticket (severity 3 / S3) assigned to the platform team.
  Include the burn-rate timeseries (PNG export from Grafana).
- **Mitigate:** if the regression is bounded to one endpoint, add a per-endpoint
  SLO and a tighter alerting rule for that endpoint (T5 P2 follow-up).

## 3d slow-burn (1.08x)

- **What it means:** 10% of 30-day budget in 3d. Slowest, lowest-burn signal —
  almost always a long-tail regression (memory leak, query plan drift, dependency
  upgrade) rather than a single bad deploy.
- **First 1 h:** pull 7-day Grafana panels for p99, error rate, and saturation.
  Compare week-over-week. Identify the inflection point.
- **Action:** open a postmortem candidate ticket (severity 4 / S4). The fix is
  rarely urgent but must ship before the next 3d window opens, or the burn rate
  compounds.
- **Mitigate:** prefer rollback of the dependency / config drift over a code fix;
  these regressions usually re-appear under load and the hot-fix takes longer than
  the underlying issue merits.

## Related

- `alerts/slo-burn-rate.yaml` — the 4 alert rules
- `findings/2026-06-22-v24-slo-definitions.md` — SLO catalog
- `dashboards/latency-p99.json` — companion dashboard (panel 5 = burn-rate gauge)
- ADR-091 — SLO/burn-rate alerting policy
- `incident-postmortem` skill — for after-action writeups
