# Stash Audit - 2026-06-10

Source command attempted first:
`git submodule foreach --recursive 'printf "__REPO__ %s\\n" "$displaypath"; git status --porcelain'`

Result: blocked by stale submodule metadata:
`fatal: No url found for submodule path '.claude/worktrees/agent-tpm-coord' in .gitmodules`

Fallback used for this audit: top-level child Git working trees under `/Users/kooshapari/CodeProjects/Phenotype/repos`, each checked with `git status --porcelain` and an 8 second per-repo timeout.

| Repo | Dirty file count | Decision |
|---|---:|---|
| `agent-platform` | 6 | stash - untracked-only changes need owner review |
| `AgilePlus` | 10 | stash - local audit/worktree/session artifacts |
| `agslag-docs` | 1 | stash - transient/generated local artifacts |
| `Apisync` | 16 | commit - coherent tracked source/config changes |
| `apps` | 0 | stash - status timed out; inspect before committing |
| `AtomsBot-2nd` | 23 | commit - coherent tracked source/config changes |
| `AtomsBot-3rd` | 21 | commit - coherent tracked source/config changes |
| `AtomsBot-5th` | 22 | commit - coherent tracked source/config changes |
| `AtomsBot` | 1 | stash - local audit/worktree/session artifacts |
| `AuthKit` | 4 | commit - coherent tracked source/config changes |
| `bare-cua` | 35 | commit - coherent tracked source/config changes |
| `BytePort` | 4 | stash - local audit/worktree/session artifacts |
| `cheap-llm-mcp` | 1 | stash - transient/generated local artifacts |
| `Civis` | 23 | commit - coherent tracked source/config changes |
| `Conft` | 1 | stash - transient/generated local artifacts |
| `dinoforge-packs` | 3 | commit - coherent tracked source/config changes |
| `dispatch-mcp` | 1 | stash - local audit/worktree/session artifacts |
| `Eidolon` | 2 | commit - coherent tracked source/config changes |
| `eyetracker` | 3 | commit - coherent tracked source/config changes |
| `FocalPoint` | 1 | stash - local audit/worktree/session artifacts |
| `forgecode` | 3 | commit - coherent tracked source/config changes |
| `heliosBench` | 3 | stash - local audit/worktree/session artifacts |
| `HeliosCLI` | 1 | stash - local audit/worktree/session artifacts |
| `HexaKit` | 42 | commit - coherent tracked source/config changes |
| `KaskMan` | 5 | stash - transient/generated local artifacts |
| `KDesktopVirt` | 13 | commit - coherent tracked source/config changes |
| `KWatch-docs` | 1 | stash - transient/generated local artifacts |
| `localbase3` | 1 | stash - transient/generated local artifacts |
| `MCPForge` | 1 | commit - coherent tracked source/config changes |
| `melosviz` | 1 | stash - local audit/worktree/session artifacts |
| `nanovms` | 1 | commit - coherent tracked source/config changes |
| `OmniRoute-2nd` | 1 | commit - coherent tracked source/config changes |
| `OmniRoute` | 1 | stash - local audit/worktree/session artifacts |
| `Parpoura-5th` | 1 | commit - coherent tracked source/config changes |
| `PhenoCompose` | 1 | stash - local audit/worktree/session artifacts |
| `PhenoDevOps` | 40 | commit - coherent tracked source/config changes |
| `PhenoHandbook` | 1 | stash - untracked-only changes need owner review |
| `PhenoKits` | 1 | stash - untracked-only changes need owner review |
| `PhenoMCP-2nd` | 4 | stash - conflicted worktree; resolve before committing |
| `PhenoProc` | 1 | commit - coherent tracked source/config changes |
| `PhenoProject` | 1 | stash - local audit/worktree/session artifacts |
| `PhenoRuntime` | 1 | stash - local audit/worktree/session artifacts |
| `PhenoSchema` | 2 | stash - untracked-only changes need owner review |
| `phenoShared` | 2 | stash - local audit/worktree/session artifacts |
| `phenotype-dep-guard` | 1 | stash - untracked-only changes need owner review |
| `phenotype-hub` | 4 | stash - untracked-only changes need owner review |
| `phenotype-infra` | 3 | stash - local audit/worktree/session artifacts |
| `phenotype-journeys` | 1 | stash - untracked-only changes need owner review |
| `phenotype-omlx` | 1 | commit - coherent tracked source/config changes |
| `phenotype-ops-mcp` | 17 | commit - coherent tracked source/config changes |
| `phenotype-tooling` | 3 | stash - untracked-only changes need owner review |
| `PlayCua` | 1 | stash - local audit/worktree/session artifacts |
| `portage` | 1 | commit - coherent tracked source/config changes |
| `ResilienceKit` | 1 | commit - coherent tracked source/config changes |
| `thegent-security-fixes` | 1 | commit - coherent tracked source/config changes |

## Dirty Repos

### agent-platform

- Dirty file count: 6
- Decision: stash - untracked-only changes need owner review

```text
?? .gitignore
?? CODEOWNERS
?? LICENSE
?? README.md
?? docs/
?? python/
```

### AgilePlus

- Dirty file count: 10
- Decision: stash - local audit/worktree/session artifacts

```text
 M .github/CODEOWNERS
D  CONTRIBUTING.md
?? .editorconfig
?? AgilePlus-wtrees/
?? CODEOWNERS
?? CODE_OF_CONDUCT.md
?? CONTRIBUTING.md
?? FUNDING.yml
?? LICENSE
?? SPEC.md
```

### agslag-docs

- Dirty file count: 1
- Decision: stash - transient/generated local artifacts

```text
?? FLEET_DAG.db
```

### Apisync

- Dirty file count: 16
- Decision: commit - coherent tracked source/config changes

```text
 M Cargo.toml
 M src/adapters/graphql/schema.rs
 M src/adapters/graphql/server.rs
 M src/adapters/mod.rs
 M src/adapters/rest/hyper_server.rs
 M src/adapters/rest/mod.rs
 M src/adapters/websocket/mod.rs
 M src/adapters/websocket/server.rs
 M src/application/handler.rs
 M src/application/router.rs
 M src/domain/middleware.rs
 M src/domain/mod.rs
 M src/endpoints.rs
 M src/infrastructure/logging.rs
 M src/infrastructure/mod.rs
 M src/lib.rs
```

### apps

- Dirty file count: 0
- Decision: stash - status timed out; inspect before committing

```text
STATUS_TIMEOUT
```

### AtomsBot-2nd

- Dirty file count: 23
- Decision: commit - coherent tracked source/config changes

```text
 D CITATION.cff
 M src/github/tests/README.md
 M tests/README.md
 M tests/__mocks__/@octokit/graphql.ts
 M tests/__mocks__/@octokit/rest.ts
 M tests/__mocks__/discord.js.ts
 M tests/__mocks__/jira.js.ts
 M tests/__mocks__/winston.ts
 M tests/examples/modalFormManager.test.ts
 M tests/fixtures/index.ts
 M tests/integration/mockIntegration.test.ts
 M tests/matchers.ts
 M tests/mocks/better-sqlite3.ts
 M tests/mocks/commands.ts
 M tests/mocks/discord.ts
 M tests/mocks/github.ts
 M tests/mocks/jira.ts
 M tests/mocks/modalFormManager.ts
 M tests/mocks/store.ts
 M tests/mocks/winston.ts
 M tests/utils/database-test-isolation.ts
 M tests/utils/testFactories.ts
 M tests/utils/testUtils.ts
```

### AtomsBot-3rd

- Dirty file count: 21
- Decision: commit - coherent tracked source/config changes

```text
 M tests/README.md
 M tests/__mocks__/@octokit/graphql.ts
 M tests/__mocks__/@octokit/rest.ts
 M tests/__mocks__/discord.js.ts
 M tests/__mocks__/jira.js.ts
 M tests/__mocks__/winston.ts
 M tests/examples/modalFormManager.test.ts
 M tests/fixtures/index.ts
 M tests/integration/mockIntegration.test.ts
 M tests/matchers.ts
 M tests/mocks/better-sqlite3.ts
 M tests/mocks/commands.ts
 M tests/mocks/discord.ts
 M tests/mocks/github.ts
 M tests/mocks/jira.ts
 M tests/mocks/modalFormManager.ts
 M tests/mocks/store.ts
 M tests/mocks/winston.ts
 M tests/utils/database-test-isolation.ts
 M tests/utils/testFactories.ts
 M tests/utils/testUtils.ts
```

### AtomsBot-5th

- Dirty file count: 22
- Decision: commit - coherent tracked source/config changes

```text
 M src/github/tests/README.md
 M tests/README.md
 M tests/__mocks__/@octokit/graphql.ts
 M tests/__mocks__/@octokit/rest.ts
 M tests/__mocks__/discord.js.ts
 M tests/__mocks__/jira.js.ts
 M tests/__mocks__/winston.ts
 M tests/examples/modalFormManager.test.ts
 M tests/fixtures/index.ts
 M tests/integration/mockIntegration.test.ts
 M tests/matchers.ts
 M tests/mocks/better-sqlite3.ts
 M tests/mocks/commands.ts
 M tests/mocks/discord.ts
 M tests/mocks/github.ts
 M tests/mocks/jira.ts
 M tests/mocks/modalFormManager.ts
 M tests/mocks/store.ts
 M tests/mocks/winston.ts
 M tests/utils/database-test-isolation.ts
 M tests/utils/testFactories.ts
 M tests/utils/testUtils.ts
```

### AtomsBot

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? AtomsBot-wtrees/
```

### AuthKit

- Dirty file count: 4
- Decision: commit - coherent tracked source/config changes

```text
 M go
 M python/pheno-auth
 M python/pheno-security
?? .github/workflows/audit.yml
```

### bare-cua

- Dirty file count: 35
- Decision: commit - coherent tracked source/config changes

```text
 M .github/CODEOWNERS
 D .github/SECURITY.md
?? .devcontainer/
?? .editorconfig
?? .gitattributes
?? .github/FUNDING.yml
?? .github/ISSUE_TEMPLATE/
?? .github/PULL_REQUEST_TEMPLATE.md
?? .github/dependabot.yml
?? .github/workflows/
?? .gitignore
?? .pre-commit-config.yaml
?? AGENTS.md
?? CHANGELOG.md
?? CITATION.cff
?? CLAUDE.md
?? CODE_OF_CONDUCT.md
?? CONTRIBUTING.md
?? Cargo.toml
?? LICENSE
?? PLAN.md
?? README.md
?? SECURITY.md
?? SPEC.md
?? STATUS.md
?? Taskfile.yml
?? VERSION
?? bindings/
?? cliff.toml
?? clippy.toml
?? contracts/
?? deny.toml
?? docs/
?? justfile
?? native/
```

### BytePort

- Dirty file count: 4
- Decision: stash - local audit/worktree/session artifacts

```text
 M .github/workflows/ci.yml
 M .github/workflows/scorecard.yml
?? .github/workflows/audit.yml
?? STATUS_2026_06_10.md
```

### cheap-llm-mcp

- Dirty file count: 1
- Decision: stash - transient/generated local artifacts

```text
 M .tmp-pr48-review
```

### Civis

- Dirty file count: 23
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/cargo-audit.yml
 M .github/workflows/cargo-deny.yml
 M .github/workflows/cargo-machete.yml
 M .github/workflows/cargo-semver-checks.yml
 M .github/workflows/codeql-rust.yml
 M .github/workflows/doc-links.yml
 M .github/workflows/docs-site.yml
 M .github/workflows/fr-coverage.yml
 M .github/workflows/journey-gate.yml
 M .github/workflows/legacy-tooling-gate.yml
 M .github/workflows/pages-deploy.yml
 M .github/workflows/pages.yml
 M .github/workflows/policy-gate.yml
 M .github/workflows/pr-governance-gate.yml
 M .github/workflows/quality-gate.yml
 M .github/workflows/quality.yml
 M .github/workflows/release.yml
 M .github/workflows/scorecard.yml
 M .github/workflows/security-guard.yml
 M .github/workflows/self-merge-gate.yml
 M .github/workflows/trufflehog.yml
 M .github/workflows/unreal-build.yml
 M Cargo.lock
```

### Conft

- Dirty file count: 1
- Decision: stash - transient/generated local artifacts

```text
?? .serena/
```

### dinoforge-packs

- Dirty file count: 3
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/ci.yml
 M .github/workflows/scorecard.yml
?? .github/workflows/audit.yml
```

### dispatch-mcp

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? DISPATCH_MCP_REGISTERED_2026_06_10.md
```

### Eidolon

- Dirty file count: 2
- Decision: commit - coherent tracked source/config changes

```text
 M crates/eidolon-core/src/lib.rs
?? crates/eidolon-core/src/virtual_stage.rs
```

### eyetracker

- Dirty file count: 3
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/scorecard.yml
?? .github/workflows/audit.yml
?? .github/workflows/ci.yml
```

### FocalPoint

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? PR_AUDIT_2026_06_10.md
```

### forgecode

- Dirty file count: 3
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/ci.yml
?? .github/workflows/audit.yml
?? .github/workflows/scorecard.yml
```

### heliosBench

- Dirty file count: 3
- Decision: stash - local audit/worktree/session artifacts

```text
?? SPEC.md
?? docs/specs/
?? worklogs/
```

### HeliosCLI

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? repos/
```

### HexaKit

- Dirty file count: 42
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/ai-testing-orchestration.yml
 M .github/workflows/audit.yml
 M .github/workflows/benchmark.yml
 M .github/workflows/cargo-audit.yml
 M .github/workflows/cargo-deny.yml
 M .github/workflows/cargo-machete.yml
 M .github/workflows/cargo-semver-checks.yml
 M .github/workflows/changelog.yml
 M .github/workflows/ci.yml
 M .github/workflows/codeql-rust.yml
 M .github/workflows/deploy.yml
 M .github/workflows/docs.yml
 M .github/workflows/evidence-capture.yml
 M .github/workflows/fuzzing.yml
 M .github/workflows/gate-check.yml
 M .github/workflows/iac-scan.yml
 M .github/workflows/journey-gate.yml
 M .github/workflows/libs-activation-ci.yml
 M .github/workflows/license-compliance.yml
 M .github/workflows/policy-gate.yml
 M .github/workflows/publish.yml
 M .github/workflows/quality-gate.yml
 M .github/workflows/release.yml
 M .github/workflows/rust-quality.yml
 M .github/workflows/rust-release.yml
 M .github/workflows/sast-full.yml
 M .github/workflows/sast-quick.yml
 M .github/workflows/sbom.yml
 M .github/workflows/scorecard.yml
 M .github/workflows/security-guard.yml
 M .github/workflows/security-scan.yml
 M .github/workflows/security.yml
 M .github/workflows/snyk-scan.yml
 M .github/workflows/sonarcloud.yml
 M .github/workflows/spec-validation.yml
 M .github/workflows/sync-canary.yml
 M .github/workflows/traceability-gate.yml
 M .github/workflows/trivy-scan.yml
 M .github/workflows/trufflehog.yml
 M .github/workflows/workflow-maintenance.yml
 M .github/workflows/workflow-sync.yml
 M .github/workflows/zap-dast.yml
```

### KaskMan

- Dirty file count: 5
- Decision: stash - transient/generated local artifacts

```text
 M .grade-reports/coverage.raw
 M .grade-reports/install.raw
 M .grade-reports/test-e2e.raw
 M .grade-reports/test-perf.raw
 M .grade-reports/test-unit.raw
```

### KDesktopVirt

- Dirty file count: 13
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/ci.yml
 M Cargo.lock
 M Cargo.toml
 M SECURITY_IMPLEMENTATION.md
 M docs/AUDIO_VIDEO_SYSTEM.md
 M docs/adr/ADR-001-automation-engine.md
 M examples/advanced_workflow.rs
 M examples/audio_video_demo.rs
 M examples/basic_automation.rs
 M src/bin/demo.rs
 M src/bin/server.rs
 M src/bin/tui.rs
 M src/main.rs
```

### KWatch-docs

- Dirty file count: 1
- Decision: stash - transient/generated local artifacts

```text
?? .grade-reports/
```

### localbase3

- Dirty file count: 1
- Decision: stash - transient/generated local artifacts

```text
?? localbase-frontend/tsconfig.tsbuildinfo
```

### MCPForge

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/go.yml
```

### melosviz

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? plans/
```

### nanovms

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M package-lock.json
```

### OmniRoute-2nd

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M justfile
```

### OmniRoute

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? OMNIROUTE_DISPATCH_HEALTH_2026_06_10.md
```

### Parpoura-5th

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 D CITATION.cff
```

### PhenoCompose

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? STATUS_2026_06_10.md
```

### PhenoDevOps

- Dirty file count: 40
- Decision: commit - coherent tracked source/config changes

```text
 M .github/workflows/alert-sync-issues.yml
 M .github/workflows/audit.yml
 M .github/workflows/benchmark.yml
 M .github/workflows/cargo-deny.yml
 M .github/workflows/changelog.yml
 M .github/workflows/ci.yml
 M .github/workflows/codeql.yml
 M .github/workflows/deploy.yml
 M .github/workflows/doc-links.yml
 M .github/workflows/docs.yml
 M .github/workflows/evidence-capture.yml
 M .github/workflows/fr-coverage.yml
 M .github/workflows/fuzzing.yml
 M .github/workflows/gate-check.yml
 M .github/workflows/iac-scan.yml
 M .github/workflows/license-compliance.yml
 M .github/workflows/lint.yml
 M .github/workflows/policy-gate.yml
 M .github/workflows/publish.yml
 M .github/workflows/quality-gate.yml
 M .github/workflows/release-drafter.yml
 M .github/workflows/release.yml
 M .github/workflows/sast-full.yml
 M .github/workflows/sast-quick.yml
 M .github/workflows/sbom.yml
 M .github/workflows/security-guard-hook-audit.yml
 M .github/workflows/security-guard.yml
 M .github/workflows/security.yml
 M .github/workflows/self-merge-gate.yml
 M .github/workflows/snyk-scan.yml
 M .github/workflows/sonarcloud.yml
 M .github/workflows/spec-validation.yml
 M .github/workflows/stale.yml
 M .github/workflows/sync-canary.yml
 M .github/workflows/tag-automation.yml
 M .github/workflows/trivy-scan.yml
 M .github/workflows/trufflehog.yml
 M .github/workflows/workflow-maintenance.yml
 M .github/workflows/workflow-sync.yml
 M .github/workflows/zap-dast.yml
```

### PhenoHandbook

- Dirty file count: 1
- Decision: stash - untracked-only changes need owner review

```text
?? patterns/sota-research.md
```

### PhenoKits

- Dirty file count: 1
- Decision: stash - untracked-only changes need owner review

```text
?? tests/snapshots.rs
```

### PhenoMCP-2nd

- Dirty file count: 4
- Decision: stash - conflicted worktree; resolve before committing

```text
UU .editorconfig
M  .gitignore
M  README.md
M  integration-tests/run-all.sh
```

### PhenoProc

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M Evalora
```

### PhenoProject

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? PhenoProject-wtrees/
```

### PhenoRuntime

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? PhenoRuntime-wtrees/
```

### PhenoSchema

- Dirty file count: 2
- Decision: stash - untracked-only changes need owner review

```text
?? pheno-xdd-lib/
?? pheno-xdd/
```

### phenoShared

- Dirty file count: 2
- Decision: stash - local audit/worktree/session artifacts

```text
?? phenoShared-wtrees/
?? phenotype-retry-WIP-preserved/
```

### phenotype-dep-guard

- Dirty file count: 1
- Decision: stash - untracked-only changes need owner review

```text
?? SPEC.md
```

### phenotype-hub

- Dirty file count: 4
- Decision: stash - untracked-only changes need owner review

```text
?? SPEC.md
?? docs/.vitepress/
?? docs/index.md
?? docs/specs/
```

### phenotype-infra

- Dirty file count: 3
- Decision: stash - local audit/worktree/session artifacts

```text
?? SPEC.md
?? worklogs/2026-06-09-iac-state-backend-decision.md
?? worklogs/2026-06-09-r5-specs-progress.md
```

### phenotype-journeys

- Dirty file count: 1
- Decision: stash - untracked-only changes need owner review

```text
?? SPEC.md
```

### phenotype-omlx

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M omlx/server.py
```

### phenotype-ops-mcp

- Dirty file count: 17
- Decision: commit - coherent tracked source/config changes

```text
 M .github/CODEOWNERS
 M .github/workflows/ci.yml
 M .github/workflows/codeql.yml
 M .github/workflows/doc-links.yml
 M .github/workflows/fr-coverage.yml
 M .github/workflows/manifest-check.yml
 M .github/workflows/quality-gate.yml
 M .github/workflows/scorecard.yml
 M .github/workflows/secrets-scan.yml
 M .github/workflows/trufflehog.yml
 M CLAUDE.md
?? .editorconfig
?? .github/workflows/lint.yml
?? .golangci.yml
?? Justfile
?? LICENSE-APACHE
?? LICENSE-MIT
```

### phenotype-tooling

- Dirty file count: 3
- Decision: stash - untracked-only changes need owner review

```text
?? LICENSE-APACHE
?? LICENSE-MIT
?? SPEC.md
```

### PlayCua

- Dirty file count: 1
- Decision: stash - local audit/worktree/session artifacts

```text
?? STATUS_2026_06_10.md
```

### portage

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M benchmark_adapters/reasoning/satbench/template/tests/verify.py
```

### ResilienceKit

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
 M rust/Cargo.toml
```

### thegent-security-fixes

- Dirty file count: 1
- Decision: commit - coherent tracked source/config changes

```text
M  dotfiles/git/gitconfig
```

