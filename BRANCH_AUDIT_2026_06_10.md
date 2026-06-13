# Branch Audit - 2026-06-10

Scope: local repository at /Users/kooshapari/CodeProjects/Phenotype/repos, including local branches and all remote-tracking branches from git branch -a / git for-each-ref.

Sources used:
- git branch -a / git for-each-ref refs/heads refs/remotes for branch inventory.
- git for-each-ref --merged=origin/main for merged-into-main classification.
- git log --all for local PR-number evidence.
- gh pr list --repo KooshaPari/FocalPoint --state all --limit 300 --json ... was attempted, but GitHub API access failed with: error connecting to api.github.com. Closed-PR remnant values below are inferred from local branch/log evidence, not live GitHub state.

Total refs audited: 167

| Branch | Kind | Tip | Date | Merged into main? | Closed-PR remnant? | Typo variants? | Keep/delete decision |
|---|---:|---:|---:|---:|---|---|---|
| argis | remote | ca2552f5b0 | 2026-06-08 | no | no | no | KEEP - protected main/default ref |
| argis/chore/add-funding-2026-05-02 | remote | b2b6e78344 | 2026-05-02 | no | possible: log references PR #56 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| argis/chore/infra-cleanup-20260504 | remote | afeabd1876 | 2026-05-03 | no | no | no | KEEP - not merged into origin/main |
| argis/chore/pin-action-shas-1777072729-9961 | remote | 290ac6dc70 | 2026-04-24 | no | no | no | KEEP - not merged into origin/main |
| argis/chore/sha-pin-2026-06-08 | remote | e56bb01d75 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| argis/chore/workflow-hygiene-ubuntu-24 | remote | 6bb08f52fa | 2026-05-28 | no | no | no | KEEP - not merged into origin/main |
| argis/ci/add-golangci-lint | remote | 6bb08f52fa | 2026-05-28 | no | no | no | KEEP - not merged into origin/main |
| argis/ci/pin-trufflehog | remote | a8a0efc440 | 2026-05-05 | no | no | no | KEEP - not merged into origin/main |
| argis/ci/strip-json-error-rot | remote | 475b524eeb | 2026-06-07 | no | no | no | KEEP - not merged into origin/main |
| argis/codex/dependabot-hatchet-after-crypto | remote | 2d8c716ce9 | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| argis/codex/dependabot-hatchet-rebase | remote | ec138ddc70 | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| argis/codex/dependabot-x-crypto-rebase | remote | 3ce642e4d5 | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| argis/cursor/codeql-workflow-version-skew-7ccb | remote | 4ae2925d2d | 2026-04-24 | no | no | no | KEEP - not merged into origin/main |
| argis/cursor/project-configuration-issues-fe5c | remote | 851e74403b | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| argis/cursor/trufflehog-scan-range-5fc7 | remote | adbef2759e | 2026-06-07 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot-hatchet | remote | 5b7f71e5ba | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot-x-crypto | remote | a6fc4fabda | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot/go_modules/github.com/fsnotify/fsnotify-1.10.1 | remote | b27d598ccb | 2026-05-05 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot/go_modules/github.com/hatchet-dev/hatchet-0.86.5 | remote | 52e4953a48 | 2026-05-11 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot/go_modules/github.com/nats-io/nats.go-1.52.0 | remote | d5c7ce5206 | 2026-05-08 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot/go_modules/github.com/valyala/fasthttp-1.71.0 | remote | 5eceff7ad2 | 2026-05-05 | no | no | no | KEEP - not merged into origin/main |
| argis/dependabot/go_modules/golang.org/x/crypto-0.51.0 | remote | 2e453b9fcd | 2026-05-11 | no | no | no | KEEP - not merged into origin/main |
| argis/docs/argis-extensions-sladge-ci-current | remote | eca79cd8a2 | 2026-05-07 | no | no | yes: likely badge spelling variant | KEEP - not merged into origin/main |
| argis/feat/journey-impl | remote | 524f19356f | 2026-05-02 | no | no | no | KEEP - not merged into origin/main |
| argis/hygiene/20260430-ad10fc1 | remote | ad10fc1a57 | 2026-04-28 | no | possible: log references PR #44 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| argis/hygiene/preserve-canonical-20260605 | remote | 505a24b5ee | 2026-05-06 | no | no | no | KEEP - not merged into origin/main |
| argis/hygiene/trufflehog-sha-pin-20260605 | remote | aa98b70b7f | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| argis/main | remote | ca2552f5b0 | 2026-06-08 | no | no | no | KEEP - protected main/default ref |
| argis/pr-template/bootstrap | remote | 89a7c6e90a | 2026-04-30 | no | no | no | KEEP - not merged into origin/main |
| argis/snapshot-2026-06-07 | remote | 35a04ef3e8 | 2026-06-07 | no | no | no | KEEP - not merged into origin/main |
| backup/main-stray-20260609-233423 | local | 7a39f728da | 2026-06-08 | no | possible: log references PR #30 | no | KEEP - backup branch not merged into origin/main |
| chore-feature-agileplus | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - already merged into origin/main |
| chore/audit-HeliosCLI-2026-06-08 | local | 1a9e035c6f | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| chore/audit-Pyron-2026-06-08 | local | dc4f5921b2 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| chore/focalpoint-housekeeping | local | cd56404907 | 2026-06-08 | no | no | yes: same normalized name/commit as origin/chore/focalpoint-housekeeping | KEEP - not merged into origin/main |
| chore/pin-actions-20260605 | local | 9673d0ba5a | 2026-06-10 | no | no | yes: same normalized name/commit as origin/chore/pin-actions-20260605 | KEEP - not merged into origin/main |
| ci/sha-pin-checkout-20260606 | local | 96ec73c204 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| fix/repos-status-md-restoration-20260608 | local | d2213e12c4 | 2026-06-09 | no | no | no | KEEP - not merged into origin/main |
| main | local | 7b78b5d051 | 2026-06-08 | yes | no | yes: same normalized name/commit as origin/main | KEEP - protected main/default ref |
| origin | remote | 7b78b5d051 | 2026-06-08 | yes | no | no | KEEP - protected main/default ref |
| origin/chore-feature-FocalPoint | remote | 53bde68af8 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore-icons-focalpoint | remote | bb958ea871 | 2026-06-04 | no | possible: log references PR #78 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| origin/chore-stabilize-FocalPoint | remote | bcb8c63cce | 2026-06-02 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/audit-safe-workflows-0605 | remote | 5080492183 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/audit-safe-workflows-0605-r2 | remote | 8bfaddad49 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/audit-safe-workflows-0605-r4 | remote | f0d6c4768b | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/focalpoint-housekeeping | remote | cd56404907 | 2026-06-08 | no | no | yes: same normalized name/commit as chore/focalpoint-housekeeping | KEEP - not merged into origin/main |
| origin/chore/focalpoint-ios-untrack-build-artifacts | remote | 417defb35f | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/focalpoint-unblock-stack | remote | 512fff2550 | 2026-06-06 | no | possible: log references PR #92, #93 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| origin/chore/focalpoint-workflow-hygiene-20260528 | remote | 6e6568c547 | 2026-06-10 | no | possible: log references PR #71 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| origin/chore/hygiene-bundle-2026-06-08 | remote | 7173f974b0 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/pin-actions | remote | 69e53ace12 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/pin-actions-20260605 | remote | 9673d0ba5a | 2026-06-10 | no | no | yes: same normalized name/commit as chore/pin-actions-20260605 | KEEP - not merged into origin/main |
| origin/chore/remove-status-2026-06-08 | remote | 534de1ebe8 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/renovate-2026-06-08 | remote | 7dcaac56e6 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/stale-pr-bot-2026-06-08 | remote | b84bae8762 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/sync-main-stabilize-20260608 | remote | 96ec73c204 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/tokio-tighten | remote | 0048c90b36 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/workflow-hygiene-ubuntu-24 | remote | 4a25032c98 | 2026-05-28 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/worklog-seed-FocalPoint | remote | e7342bc22d | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/chore/yamllint-2026-06-08 | remote | 8437e3b3c5 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/ci/cargo-deny-add-workflow-dispatch | remote | 97c7342c52 | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| origin/ci/pin-trufflehog | remote | 830034ef69 | 2026-05-20 | no | no | no | KEEP - not merged into origin/main |
| origin/cursor/cli-and-template-issues-dcae | remote | df1a6b568a | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/cursor/journey-manifest-test-names-35bd | remote | dcc72d571e | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/cursor/missing-timestamps-sync-fallback-0e76 | remote | 2a54521b2e | 2026-06-06 | no | no | no | KEEP - not merged into origin/main |
| origin/cursor/notion-status-completion-parsing-5b89 | remote | 4435f79854 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/cursor/workflow-permissions-conflict-1779 | remote | e2e2fe4306 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/docs/security-md-policy | remote | 0ced36c194 | 2026-05-07 | no | no | no | KEEP - not merged into origin/main |
| origin/docs/work-state-header | remote | db7535b3d2 | 2026-06-02 | no | no | no | KEEP - not merged into origin/main |
| origin/feat/cargo-deny | remote | 18c822c2d2 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/feat/focalpoint-core-sources | remote | 220a857d7c | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/feat/journey-impl | remote | 65d55e3f79 | 2026-05-01 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/build5-untrack | remote | ba7c78a108 | 2026-05-20 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/ci-checkout-phenoobservability | remote | 4da4eff313 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/ci-sibling-repo-20260605 | remote | 839106fe59 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/connector-test-fixtures-20260605 | remote | db615c6f6a | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/focalpoint-changelog-hygiene | remote | 29a728c70e | 2026-05-06 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/focalpoint-observably-vendor | remote | 7cd298bbce | 2026-06-10 | no | possible: log references PR #80 | yes: likely Observability spelling variant | KEEP - unmerged branch with PR evidence; verify before deletion |
| origin/fix/json-macro-and-msrv-clean | remote | 4a25032c98 | 2026-05-28 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/mcp-tools-private-access-20260529 | remote | 0865782caf | 2026-06-10 | no | possible: log references PR #87 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| origin/fix/notion-readwise-parsers-20260529 | remote | d9ea52ef36 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/observably-macros-git-dep | remote | 8197255122 | 2026-06-05 | no | possible: log references PR #73, #76, #77, #78 | yes: likely Observability spelling variant | KEEP - unmerged branch with PR evidence; verify before deletion |
| origin/fix/openssl-update | remote | e60711cc9f | 2026-05-28 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/trufflehog-setup-pin-0605 | remote | d5398cdadd | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/websocket-msg-text-20260605 | remote | a4cf360c8c | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/fix/worktree-cleanup-0605 | remote | 18277a6e14 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| origin/gh-pages | remote | c239071218 | 2026-04-26 | no | no | no | KEEP - not merged into origin/main |
| origin/hygiene/canonical-cleanup | remote | 8ca842066d | 2026-05-28 | no | no | no | KEEP - not merged into origin/main |
| origin/hygiene/preserve-changes | remote | f331d96731 | 2026-06-06 | no | no | no | KEEP - not merged into origin/main |
| origin/json-macro-and-msrv | remote | ca4087fc4b | 2026-05-07 | no | no | no | KEEP - not merged into origin/main |
| origin/main | remote | 7b78b5d051 | 2026-06-08 | yes | no | yes: same normalized name/commit as main | KEEP - protected main/default ref |
| origin/phenotype-unity/migration-guide | remote | e6a55b648d | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| origin/scratch-clean | remote | e4b248ec6c | 2026-05-07 | no | no | no | KEEP - not merged into origin/main |
| origin/spec/per-os-icons | remote | bcdde86fb9 | 2026-06-04 | no | no | no | KEEP - not merged into origin/main |
| pheno | remote | c3aee3361f | 2026-06-08 | no | possible: log references PR #163 | no | KEEP - protected main/default ref |
| pheno/chore/add-makefile | remote | f4cb531e44 | 2026-04-02 | no | no | no | KEEP - not merged into origin/main |
| pheno/chore/gitignore-worktrees-2026-04-26 | remote | 4edf6fb456 | 2026-04-26 | no | no | no | KEEP - not merged into origin/main |
| pheno/chore/phenoshared-merge-all-primitives-20260608 | remote | cb9986a82c | 2026-06-10 | no | no | no | KEEP - not merged into origin/main |
| pheno/chore/remove-niche-subcrates | remote | c755303dc6 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| pheno/chore/trufflehog-phenoshared | remote | 9607dbebd8 | 2026-05-02 | no | no | no | KEEP - not merged into origin/main |
| pheno/ci/add-reusable-workflows-audit-186 | remote | dc74d4aec5 | 2026-04-24 | no | possible: log references PR #186 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| pheno/cursor/contracts-dependency-metrics-61e1 | remote | 5e30ff2a11 | 2026-04-26 | no | no | no | KEEP - not merged into origin/main |
| pheno/cursor/github-workflow-issues-76e2 | remote | 5e6c1f05d6 | 2026-04-24 | no | no | no | KEEP - not merged into origin/main |
| pheno/cursor/misleading-alert-close-reason-2150 | remote | c5e8e0493c | 2026-04-25 | no | no | no | KEEP - not merged into origin/main |
| pheno/cursor/release-workflow-issues-0513 | remote | 00e7a5440f | 2026-04-24 | no | no | no | KEEP - not merged into origin/main |
| pheno/cursor/security-guard-checkout-version-8774 | remote | 2409bfbf06 | 2026-04-24 | no | no | no | KEEP - not merged into origin/main |
| pheno/cursor/workflow-permissions-issues-5011 | remote | 496ed0453f | 2026-04-24 | no | no | no | KEEP - not merged into origin/main |
| pheno/dependabot/cargo/tracing-opentelemetry-0.33 | remote | 9bb0c51a1c | 2026-05-19 | no | no | no | KEEP - not merged into origin/main |
| pheno/feat/journey-impl | remote | 08f630f8af | 2026-05-01 | no | no | no | KEEP - not merged into origin/main |
| pheno/fix/deny-toml-duplicate-allow-registry | remote | 1ec803fda8 | 2026-05-03 | no | no | no | KEEP - not merged into origin/main |
| pheno/fix/deny-toml-duplicate-key | remote | afb1d8e592 | 2026-05-03 | no | no | no | KEEP - not merged into origin/main |
| pheno/fix/docs-deploy-reusable-path-2026-04-27 | remote | 0155bd20b4 | 2026-04-27 | no | no | no | KEEP - not merged into origin/main |
| pheno/fix/reqwest-tls-feature-name | remote | eb27f1282f | 2026-04-26 | no | possible: log references PR #123 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| pheno/fix/version-align-latest-tag | remote | 782182b2e7 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| pheno/lockfile-retry | remote | eb27f1282f | 2026-04-26 | no | possible: log references PR #123 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| pheno/main | remote | c3aee3361f | 2026-06-08 | no | possible: log references PR #163 | no | KEEP - protected main/default ref |
| pheno/pr-128 | remote | 0155bd20b4 | 2026-04-27 | no | yes: local PR ref #128 | no | KEEP - not merged into origin/main |
| pheno/pr-42 | remote | bf2c65ac77 | 2026-04-30 | no | yes: local PR ref #42 | no | KEEP - not merged into origin/main |
| pheno/releases/stable | remote | 2ed2d57f0b | 2026-03-29 | no | possible: log references PR #66 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| phenotype-unity/design-docs | local | 876c9f9813 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| phenotype-unity/migration-guide | local | c342fd5ae0 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| pr30 | local | 1b99688628 | 2026-04-27 | no | yes: local PR ref #30 | no | KEEP - not merged into origin/main |
| pr31 | local | 7da7a161a2 | 2026-04-27 | yes | yes: local PR ref #31 | no | DELETE - merged PR remnant |
| pr71 | local | 8ca842066d | 2026-05-28 | no | yes: local PR ref #71 | no | KEEP - not merged into origin/main |
| voxel | remote | 0c0c76aa2d | 2026-06-09 | no | possible: log references PR #30, #34 | no | KEEP - protected main/default ref |
| voxel/canonical/d15-merge-prs | remote | 9594541744 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/chore-feature-phenotype-voxel | remote | 0b4d7c08be | 2026-06-06 | no | possible: log references PR #19 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| voxel/chore-icons-phenotype-voxel | remote | a3ccfd2e07 | 2026-06-06 | no | possible: log references PR #19 | no | KEEP - unmerged branch with PR evidence; verify before deletion |
| voxel/chore-lint-cleanup-voxel | remote | 2eb1a2977b | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| voxel/chore-stabilize-phenotype-voxel | remote | 524a9ed454 | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| voxel/chore/add-org-files-2026-06-08 | remote | 4382e7aab8 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/chore/editorconfig-2026-06-08 | remote | 587c6f7a78 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/chore/editorconfig-align | remote | 56d3f81686 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/docs/readme-hygiene-2026-06-08 | remote | 2f6addf980 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/docs/work-state-2026-06-08 | remote | dd486c1b61 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/docs/work-state-header | remote | 303b7d079b | 2026-06-05 | no | no | no | KEEP - not merged into origin/main |
| voxel/fix/cargo-workspace-opt-out | remote | 71abdfdf8b | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/fix/voxel-d13-d16-clippy-fmt | remote | 599223e6d1 | 2026-06-08 | no | no | no | KEEP - not merged into origin/main |
| voxel/main | remote | 0c0c76aa2d | 2026-06-09 | no | possible: log references PR #30, #34 | no | KEEP - protected main/default ref |
| voxel/spec/per-os-icons | remote | 9c7ee81175 | 2026-06-06 | no | possible: log references PR #19 | yes: same normalized name/commit as voxel/spec/per-os-icons-fix | KEEP - unmerged branch with PR evidence; verify before deletion |
| voxel/spec/per-os-icons-fix | remote | 9c7ee81175 | 2026-06-06 | no | possible: log references PR #19 | yes: same normalized name/commit as voxel/spec/per-os-icons | KEEP - unmerged branch with PR evidence; verify before deletion |
| worktree-agent-a0029279854c3f890 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a022027cc9fe1036f | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a178937d3dc56ca4d | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a24d2c59c30002a08 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a28374593de90ccbf | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a29c3210f9a6887c8 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a30aac04b38b425c8 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a3d086f6974a02a4f | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a44ea94ae915df6d2 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a5a6df8d5a148ed6c | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a6853e8146360639c | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a6c6c92e9f7315937 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a788f8feaa4cbbf14 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a7c71a1edf63226f3 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a83d5663800769672 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a8c0e544e6c6c9916 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-a976b6608d449832c | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-aa26a5ffd4a1cbf4d | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-aaba70db5c25ff50d | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-abe32574a5dedae85 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-ac0c0cf360d022946 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-ac22a8137857c6197 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-ace79dbaf53d57b08 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-ae5921478b394aa83 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
| worktree-agent-ae975baf71236bd16 | local | 7b78b5d051 | 2026-06-08 | yes | no | no | DELETE - merged disposable worktree branch |
