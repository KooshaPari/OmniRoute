# Forward work, milestones and conditional effort

Unit: one engineer-day = six focused engineering hours including relevant validation/review preparation. Ranges are planning judgment, not observed team velocity or delivery dates. Assume existing source/PRs are reused, secure provisioning through available paths, reliable desk compute, and one integration owner. No builds on this Mac; no paid CI. External waiting and unlimited platform/provider breadth are excluded. Confidence: low-to-medium until F1 establishes actual deployed parity.

| ID                                   | Priority/dependency | Work and acceptance witness                                                                                                                                                  | Engineer-days |
| ------------------------------------ | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------: |
| F1                                   | P0 first            | Pin latest release/custom baseline and installed desk artifact; secure config/encryption/policy ownership; preserve dirty deltas; existing owner handles secure provisioning |           1-3 |
| F2                                   | P0 afterF1          | Deliberate upstream/custom disposition for used critical paths and refreshed used-provider models, including retirement/region/failure/freshness                             |           2-4 |
| F3                                   | P0 afterF1/F2       | Real authenticated client -> provider streaming/JSON, error, fallback, cancellation and usage receipt; no duplicate effect; failed targets explicit                          |           2-5 |
| F4                                   | P0 parallel thenF3  | Persistent desk service behind Access, telemetry, reboot and store backup/restore; exact image/build SHA and authenticated/unauthenticated receipts                          |           2-5 |
| **CVP / first useful gateway slice** | F1-F4               | One actual supported consumer and used provider set; no superiority/all-provider claim                                                                                       |      **7-17** |
| F5                                   | P0 afterF1          | Resolve existing quality/security/packaging gates incl757 and758; verify actual local/self-hosted enforcement and branch policy; no bypass                                   |           3-7 |
| F6                                   | P1 afterF3/F4       | Fresh install/update profile, documented failure/recovery and independent operator walkthrough; fixed provider/consumer denominator                                          |           3-6 |
| **Supported-profile MVP**            | CVP+F5/F6           | Reusable qualified service beyond one experimental connection                                                                                                                |     **13-30** |

```text
F1 -> F2 -> F3 --+-> F6
F1 -------> F4 -+
F1 -------> F5 -+   -> supported-profile MVP
```

| ID                              | Bounded mature work beyond MVP                                                    | Acceptance / scope decision                                                                            | Additional days |
| ------------------------------- | --------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------: |
| M1                              | Complete material upstream/custom delta ledger and drift/version/release contract | Every retained critical delta owned; current upstream base and distribution manifests reconcile        |             4-9 |
| M2                              | Provider/protocol and resilience correctness over chosen expanded profiles        | Frozen supported-provider/client matrix, translation/tools/media/streaming/cancel/error oracles        |           10-20 |
| M3                              | Routing/compression/accounting/guardrail/observability quality and scale          | Measured accuracy, task cost, throughput/memory and security; no fabricated coverage metric            |            8-18 |
| M4                              | Supported dashboard/Svelte-Hono parity and chosen desktop/native surfaces         | Actual task semantics, accessibility, API parity and install/update/recovery across agreed OS profiles |           10-20 |
| M5                              | Independent CPA/Bifrost/Plano/LiteLLM/practical baseline comparison plus dogfood  | Version-pinned equivalent tasks, retained failures/interventions, per-task and per-token accounting    |            6-12 |
| M6                              | Release consolidation, maintenance ownership and remaining accepted edge cases    | Enforced gates, vulnerability response, artifact/config provenance and downstream migration            |            6-15 |
| **Additional bounded maturity** | M1-M6                                                                             | Scope explicitly fixed before work                                                                     |       **44-94** |
| **MVP plus bounded maturity**   | F1-F6+M1-M6                                                                       | Does not imply a finished backend rewrite or every future provider                                     |      **57-124** |

Architecture ambition: a full production Go/Rust replacement and arbitrary polyglot edge cannot be estimated reliably from scaffold size. A separately scoped parity pilot might require 5-10 days to define contracts/profile/performance and choose adopt/wrap/build; implementation total remains UNKNOWN until then. Do not add an invented 30-50-day rewrite ceiling to the maturity total.

The prior report's six-to-twelve-week estimate covers different deletion/stub-count assumptions. This plan preserves intentions and adds provider/operational/independent acceptance, so it is not a measured schedule correction. Deletion estimates are not authorization to remove products or user-facing behavior. Starting coverage is unmeasured; floor achievement requires a frozen profile and independent negative controls, not a guessed generic test-writing duration.

Re-estimate after F1, after one real provider witness F3 and after first independent value comparisonM5. Extra providers, platforms, high-fidelity native clients or a rewritten backend must get separate ranges. If cost/reliability/maintenance outcomes do not justify the owned fork, propose a narrower adapter or retirement with preserved exports and consumer migration; do not silently sunset it.
