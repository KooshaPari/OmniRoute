# Known Issues

| Severity | Issue | State | Required follow-up |
|---|---|---|---|
| high | `scripts/pr-reconcile/cli.ts` exceeded the modularity target at 538 lines | resolved in `8f4ed8d2ee` | GitHub collection/pagination/current-head/event adapters now live in `scripts/pr-reconcile/github.ts`; `cli.ts` is 283 lines and `github.ts` is 272 lines |
| high | `.github/workflows/pr-reconcile.yml` previously used mutable setup action/runtime refs | resolved locally | `setup-node` is pinned to verified commit `49933ea5288caeca8642d1e84afbd3f7d6820020`; unnecessary Bun setup was removed and installs now use committed `package-lock.json` with `npm ci --ignore-scripts` |
| high | `zizmor` flags the `workflow_run` trigger as a dangerous trigger | open | complete a dedicated workflow hardening review and record an explicit trusted-trigger rationale or redesign before hosted enablement |
| high | Branch is behind moving `origin/main` | expected in preservation lane | rebase in a fresh isolated lane before review |
| medium | Duplicate-event suppression reads optional `PR_RECONCILE_SEEN_EVENT_IDS`; workflow does not persist a seen-event ledger | bounded/fail-closed | add a trusted durable ledger or workflow-level idempotency store before enabling repeated dispatch |
| medium | `RECONCILE_BOT_TOKEN` remains documentation-only metadata | open | align the payload/workflow contract with the documented agent setup, or remove the stale secret claim |
| medium | Live webhook dispatch not exercised | fail-closed by design | use sanitized staging webhook and hosted checks |
| low | `.trunk/*` untracked generated artifacts | preserved/excluded | do not stage or delete |
