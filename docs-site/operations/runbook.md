---
title: Runbook
---

# Runbook

## `health` returns `503`

1. Check DB: `sqlite3 data/omniroute.db ".tables"` — should list ≥ 6 tables.
2. Check provider manifest: `omniroute providers list` — should show ≥ 1.
3. If both pass but `/health` is 503: `omniroute audit verify` to find the corruption.

## Audit chain fails to verify

1. `omniroute audit verify --since <last-known-good-sha>` to localize the break.
2. If the break is in a single append: `omniroute audit amend --reason <reason>` to roll forward.
3. If the break crosses multiple appends: escalate per Incident Response.

## Provider returns 429

Failover is on by default. Verify:

```sh
omniroute failover status
```

If no failover happens: check `failover-on-quota` feature flag.
