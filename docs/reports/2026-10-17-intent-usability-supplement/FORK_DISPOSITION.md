# Fork delta and release disposition

Owned fork: `KooshaPari/OmniRoute`; upstream: `diegosouzapw/OmniRoute`. Latest release API returned `v3.8.51` (2026-09-30), while owned package declares `3.8.53`. Numerical version ordering does not establish the latest tagged changes were integrated. Existing fork report records a divergent comparison and cherry-pick policy; those counts are dated, not refreshed here. The all-custom-changes ledger is still unfinished.

| Delta family                                        | Proposed disposition                                           | Required proof before integration/removal                                                                                     |
| --------------------------------------------------- | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Core Next.js/open-sse routing and provider behavior | Preserve production baseline; adopt upstream fixes selectively | Pin tag/source SHAs; classify security/behavior/API/data changes; run used-consumer parity                                    |
| Provider additions/retirements and model metadata   | Retain only deliberate supported contracts; refresh authority  | Live used-provider discovery + offline/retired/region/custom-override cases; never re-add removed providers from counts alone |
| Combo/policy/retry/accounting/evaluation            | Retain differentiated behavior pending comparison              | Correctness, latency, task cost and duplicate-effect controls; no replay claim beyond measured sources                        |
| Svelte/Hono app and backend direction               | Retain intended future contract; scope parity explicitly       | Identify current consumers and accepted UI/API boundary; migrate incrementally only after product decision                    |
| Rust scaffold families                              | Scope/defer/adopt/implement decision; no automatic deletion    | Exact parity target and performance/maintenance benefit; placeholder tests not implementation proof                           |
| Go/native clients, extensions and sidecars          | Classify owned versus vendored code; preserve contracts        | Dependency/license/update owner and supported-profile receipts                                                                |
| Electron/Electrobun/untracked historical surfaces   | Preserve now; owner decides supported shell                    | Import/packaging/user references and artifact usage inventory before retirement; no assumed dead-code deletion                |
| Packaging, updates and release workflows            | Owned namespace only                                           | Source/build/artifact/config provenance, safe migration/recovery and required validation                                      |
| Upstream tracking automation                        | Keep read-only drift visibility; deliberate integration policy | No upstream PR/issue/discussion publication from this account; bounded reviewed fork changes only                             |

For each material delta, the integration owner must record path/commit, user/consumer contract, retain/adopt/patch/wrap/drop decision, rationale, owner, security/schema effect, required check and installed receipt. Family classification here is a planning index, not a claim every changed file has been reconciled.

Fork release strings should use the operator scheme `BASEVERSION-kSEMVER` when distributing an owned fork build; bind upstream base and owned delta separately. Existing plain3.8.53 and namespace declarations need a deliberate version/upgrade compatibility decision; this documentation does not rename artifacts or release anything. Owned npm/container channels and their manifests require installed provenance, not just publication workflow presence.

Dirty canonical untracked files were not staged, deleted or copied into this branch. Docs use an isolated worktree pinned to main. No history rewrite, code merge, upstream publishing or silent feature sunset is part of this plan.
