# Known Issues

| Severity | Issue | State | Required follow-up |
|---|---|---|---|
| high | `scripts/pr-reconcile/cli.ts` is 538 lines | preserved as WIP | extract collection, pagination, and dispatch adapters; target <=350 lines |
| high | `.github/workflows/pr-reconcile.yml` uses mutable `actions/setup-node@v4` and `oven-sh/setup-bun@v2` refs | open | pin both actions to reviewed immutable commit SHAs before hosted enablement |
| high | Branch is behind moving `origin/main` | expected in preservation lane | rebase in a fresh isolated lane before review |
| medium | Duplicate-event suppression reads optional `PR_RECONCILE_SEEN_EVENT_IDS`; workflow does not persist a seen-event ledger | bounded/fail-closed | add a trusted durable ledger or workflow-level idempotency store before enabling repeated dispatch |
| medium | `validationCommands` and `RECONCILE_BOT_TOKEN` remain documentation-only metadata | open | align the payload/workflow contract with the documented agent setup, or remove stale claims |
| medium | Live webhook dispatch not exercised | fail-closed by design | use sanitized staging webhook and hosted checks |
| low | `.trunk/*` untracked generated artifacts | preserved/excluded | do not stage or delete |
