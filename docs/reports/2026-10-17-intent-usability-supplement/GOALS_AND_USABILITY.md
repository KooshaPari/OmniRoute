# Goals and current consumer journey

Recovered product request: deliberately reconcile custom build against latest upstream release; disposition every local change; refresh provider models; verify real routing; deploy persistently on desk behind Access; compare CPA, OmniRoute and practical alternatives by cost per task as well as per-token prices. Longer-term owned fork intent is Svelte/Hono with Go/Rust backend and a polyglot edge. CPA remains the chosen preceding routing layer for the Agents environment, not a reason to pretend OmniRoute's product obligations disappeared.

| Goal                                           | Current classification                                                 | Remaining acceptance                                                                                                                             |
| ---------------------------------------------- | ---------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| Unified provider request/response API          | Implemented source                                                     | Actual supported client/provider request, translation, response and errors on exact installed artifact                                           |
| Streaming routing/fallback/cancellation        | Implemented source; runtime unqualified here                           | No duplicate effect/charge under retries; bounded fallback, cancellation cleanup, partial stream/truncated/error distinction                     |
| Provider model catalog                         | Static/discovery/cache/custom-model implementation                     | Every used provider matched against live authority; freshness, retirement and custom override receipts; counts do not prove currency             |
| Security and persistent setup                  | Auth/SQLite/encryption source; historical local configuration concerns | Provision through existing secure path; encryption before storage; authenticated and unauthenticated Access witnesses; no private agent exposure |
| Latest upstream plus intentional custom deltas | Version text present; disposition incomplete                           | Tagged ancestry/delta proof, accepted port/adapt/drop per custom contract, preserved untracked work                                              |
| Svelte/Hono + Go/Rust direction                | Partial app/BFF source, reported Rust scaffolds                        | Approved parity and migration contract; current Next.js engine remains actual product baseline                                                   |
| Evaluation/value                               | Evaluation source exists                                               | Frozen comparable workload, success/latency/task-cost accounting and independent oracle; no assumed superiority                                  |
| Install/deploy/update/recovery                 | Packaging/workflows source; acceptance unknown                         | Desk service identity, restart, backup/restore and fresh install/update receipt                                                                  |

```text
Secure setup -> discover models -> choose policy -> send request
 -> provider dispatch -> streamed/JSON result -> usage/error receipts
 -> restart/update -> same safe configuration and routing contract
```

| Journey checkpoint             | Concrete source / dated evidence                                                                  | Usability gap / negative witness                                                                                               |
| ------------------------------ | ------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| Sign in and inspect dashboard  | Existing report records local login/dashboard 200 after42f50de195 client-bundle fix               | Not a fresh desk deployment or universal page witness                                                                          |
| Add a used-provider connection | Provider model route handles registry/static/discovery/custom/cached metadata and outbound guards | Secrets must flow through secure provisioning; no user-secret blocker inferred from old local env state                        |
| Select actual model            | Unified catalog route delegates to catalog producer                                               | A listed model may still be unavailable/retired or mismatched to credential region/capability                                  |
| Chat from real consumer        | Chat route validates/admission-controls, resolves aliases/retirement and delegates handler        | Existing report's ALL_TARGETS_SKIPPED is a valid failure diagnostic, not successful provider execution                         |
| Recover from overload/failure  | Combo/retry/circuit state implemented                                                             | Provider outage, rate reset, invalid key, client disconnect and streamed partial response need independent assertions          |
| Read accounting and compare    | Router-eval entry imports reporting and has database replay source types                          | Loader source is beyond old JSONL-only historical notes; actual dataset/replay correctness and live outcome not exercised here |
| Keep working after restart     | SQL-backed configuration source                                                                   | Reboot, encrypted record retention, migration/restore and installed SHA need exact receipts                                    |

UI source, test-file existence, a router trace or broad provider count are individually useful but do not establish the full journey. Experimental use can expose diagnostics; qualified daily use requires the controlled used-provider witness and operational guardrails below.
