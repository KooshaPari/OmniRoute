---
work_package_id: WP10
title: Centralized CI Workflows
lane: "done"
dependencies: []
base_branch: main
base_commit: 6367add88d78a303bda0a6ebe96569ad9886fb41
created_at: '2026-03-01T18:23:09.124377+00:00'
subtasks: [T057, T058, T059, T060, T061, T062, T063]
phase: Phase 0 - Foundation (parallel with WP01)
assignee: ''
agent: "reviewer"
shell_pid: "34436"
review_status: "has_feedback"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP10 – Centralized CI Workflows

## Objectives & Success Criteria

This work package implements reusable GitHub Actions workflows in the `phenotypeActions` repository that orchestrate release governance tasks (publish, promote, gate checks, changelog generation). Success means:

- 5 reusable workflows are implemented: publish, gate-check, promote, changelog, audit
- Each workflow has a consistent inputs/outputs interface documented
- Workflows support language-agnostic task execution via mise tasks
- All workflows include retry logic for transient failures (429s, timeouts)
- Workflows are tested with `act` or in a test repository
- Secrets management (npm, pypi, crates tokens) is centralized and documented
- Implementation works in phenotypeActions repository, NOT pheno-cli
- Implementation command: `spec-kitty implement WP10` (note: no --base, operates on phenotypeActions)

## Context & Constraints

- Operates in `KooshaPari/phenotypeActions` repository, separate from pheno-cli
- Must support all languages: Go, Rust, Python, TypeScript (via mise tasks)
- Reusable workflows use `workflow_call` trigger
- All language-specific logic is delegated to mise tasks (no language detection in workflows)
- Secrets (NPM_TOKEN, PYPI_TOKEN, CRATES_TOKEN) are injected at workflow runtime
- Workflows must be idempotent and safe for CI/CD pipelines
- Output must be both human-readable and machine-parseable (JSON)
- No external services; all operations use built-in GitHub Actions steps and standard tools

## Subtasks & Detailed Guidance

### Subtask T057 – Publish Workflow
- **Purpose**: Create reusable `publish.yml` workflow for building and publishing packages to registries
- **Steps**:
  1. Create `.github/workflows/publish.yml` in phenotypeActions repository:
     ```yaml
     name: Publish

     on:
       workflow_call:
         inputs:
           language:
             description: "Programming language (go|rust|python|typescript)"
             required: true
             type: string
           registry:
             description: "Target registry (npm|pypi|crates|custom)"
             required: true
             type: string
           version:
             description: "Package version to publish"
             required: true
             type: string
           package_name:
             description: "Package name for display"
             required: true
             type: string
         secrets:
           NPM_TOKEN:
             required: false
           PYPI_TOKEN:
             required: false
           CRATES_TOKEN:
             required: false

     jobs:
       publish:
         name: Publish ${{ inputs.package_name }}
         runs-on: ubuntu-latest
         steps:
           - name: Checkout code
             uses: actions/checkout@v4

           - name: Setup language
             uses: actions/setup-[language]@v[x]  # varies per language

           - name: Setup mise
             uses: jdx/mise-action@v2

           - name: Build package
             run: mise run build

           - name: Publish to registry
             run: |
               case "${{ inputs.registry }}" in
                 npm)
                   npm publish --registry https://registry.npmjs.org --access public
                   ;;
                 pypi)
                   python -m twine upload dist/* --non-interactive
                   ;;
                 crates)
                   cargo publish
                   ;;
               esac
             env:
               NPM_TOKEN: ${{ secrets.NPM_TOKEN }}
               PYPI_PASSWORD: ${{ secrets.PYPI_TOKEN }}
               CARGO_REGISTRY_TOKEN: ${{ secrets.CRATES_TOKEN }}

           - name: Verify published
             run: |
               # Check registry for published version with retry logic
               for i in {1..5}; do
                 if mise run verify-publish; then
                   echo "✓ Published successfully"
                   exit 0
                 fi
                 if [ $i -lt 5 ]; then
                   echo "Retry $i/5..."
                   sleep 10
                 fi
               done
               exit 1

           - name: Report success
             run: |
               echo "::notice title=Publish::✓ Published ${{ inputs.package_name }}@${{ inputs.version }} to ${{ inputs.registry }}"
     ```
  2. Implement language setup matrix:
     - Go: `actions/setup-go@v4`
     - Rust: `actions-rust-lang/setup-rust-action@v1`
     - Python: `actions/setup-python@v4`
     - TypeScript/Node: `actions/setup-node@v3`
  3. Add retry logic with exponential backoff for:
     - Registry publish (handle 429 rate limits)
     - Version verification (wait for registry propagation)
  4. Support custom registry via env var override
  5. Output structured result (JSON) for consumption by other workflows

- **Files**: `KooshaPari/phenotypeActions/.github/workflows/publish.yml`
- **Parallel?**: No (baseline workflow)
- **Notes**: Use mise tasks to abstract language-specific build/publish logic; handle registry-specific credentials; ensure idempotent operation

### Subtask T058 – Gate Check Workflow
- **Purpose**: Create reusable `gate-check.yml` workflow for evaluating quality gates
- **Steps**:
  1. Create `.github/workflows/gate-check.yml` in phenotypeActions repository:
     ```yaml
     name: Gate Check

     on:
       workflow_call:
         inputs:
           language:
             description: "Programming language"
             required: true
             type: string
           channel:
             description: "Target release channel (alpha|canary|beta|rc|prod)"
             required: true
             type: string
           risk_profile:
             description: "Risk profile (low|medium|high)"
             required: true
             type: string
         outputs:
           passed:
             description: "Whether all gates passed"
             value: ${{ jobs.gates.outputs.passed }}
           results:
             description: "Gate results JSON"
             value: ${{ jobs.gates.outputs.results }}

     jobs:
       gates:
         name: Evaluate Gates
         runs-on: ubuntu-latest
         outputs:
           passed: ${{ steps.evaluate.outputs.passed }}
           results: ${{ steps.evaluate.outputs.results }}
         steps:
           - name: Checkout code
             uses: actions/checkout@v4

           - name: Setup language
             uses: actions/setup-[language]@v[x]

           - name: Setup mise
             uses: jdx/mise-action@v2

           - name: Evaluate gates
             id: evaluate
             run: |
               # Run gate evaluation for channel
               CHANNEL="${{ inputs.channel }}"
               RISK="${{ inputs.risk_profile }}"

               # Execute gates based on channel and risk profile
               GATES_PASSED=true

               # Alpha gates: always run
               if ! mise run lint; then GATES_PASSED=false; fi
               if ! mise run test; then GATES_PASSED=false; fi

               # Canary gates: required for canary+
               if [[ "$CHANNEL" =~ ^(canary|beta|rc|prod)$ ]]; then
                 if ! mise run test:integration; then GATES_PASSED=false; fi
                 if ! mise run audit; then GATES_PASSED=false; fi
               fi

               # Beta gates: required for beta+
               if [[ "$CHANNEL" =~ ^(beta|rc|prod)$ ]]; then
                 if ! mise run docs:build; then GATES_PASSED=false; fi
               fi

               # RC gates: required for rc+
               if [[ "$CHANNEL" =~ ^(rc|prod)$ ]]; then
                 if [ ! -f ROLLBACK.md ] || [ ! -s ROLLBACK.md ]; then GATES_PASSED=false; fi
               fi

               # Prod gates: required for prod
               if [[ "$CHANNEL" == "prod" ]]; then
                 if [ ! -f monitoring.yml ] && [ ! -f prometheus.yml ] && [ ! -f datadog.json ]; then
                   GATES_PASSED=false
                 fi
               fi

               echo "passed=$GATES_PASSED" >> $GITHUB_OUTPUT
               echo "results={\"channel\":\"$CHANNEL\",\"risk\":\"$RISK\",\"passed\":$GATES_PASSED}" >> $GITHUB_OUTPUT

           - name: Report results
             run: |
               if [[ "${{ steps.evaluate.outputs.passed }}" == "true" ]]; then
                 echo "::notice title=Gates::✓ All gates passed for ${{ inputs.channel }}"
               else
                 echo "::error title=Gates::✗ Gates failed for ${{ inputs.channel }}"
                 exit 1
               fi
     ```
  2. Implement conditional gate execution based on channel:
     - Alpha: lint, unit_tests
     - Canary+: add integration_tests, security_audit
     - Beta+: add docs_build
     - RC+: add rollback_plan
     - Prod: add monitoring_dashboards
  3. Support risk-based skipping (map to channel skips from WP06):
     - Low-risk: can skip to later gates
     - Medium-risk: must run beta gates
     - High-risk: must run all gates sequentially
  4. Output structured JSON result for downstream workflows
  5. Use GitHub Actions annotations to show results inline

- **Files**: `KooshaPari/phenotypeActions/.github/workflows/gate-check.yml`
- **Parallel?**: Yes (after T057)
- **Notes**: Delegate gate execution to mise tasks; output results as JSON for machine consumption; use GitHub workflow annotations for visibility

### Subtask T059 – Promote Workflow
- **Purpose**: Create reusable `promote.yml` workflow that combines gate-check and publish
- **Steps**:
  1. Create `.github/workflows/promote.yml` in phenotypeActions repository:
     ```yaml
     name: Promote

     on:
       workflow_call:
         inputs:
           language:
             description: "Programming language"
             required: true
             type: string
           registry:
             description: "Target registry"
             required: true
             type: string
           from_channel:
             description: "Source channel"
             required: true
             type: string
           to_channel:
             description: "Target channel"
             required: true
             type: string
           risk_profile:
             description: "Risk profile"
             required: true
             type: string
           version:
             description: "Package version"
             required: true
             type: string
         secrets:
           NPM_TOKEN:
             required: false
           PYPI_TOKEN:
             required: false
           CRATES_TOKEN:
             required: false

     jobs:
       gate-check:
         name: Check Gates
         uses: KooshaPari/phenotypeActions/.github/workflows/gate-check.yml@v1
         with:
           language: ${{ inputs.language }}
           channel: ${{ inputs.to_channel }}
           risk_profile: ${{ inputs.risk_profile }}

       publish:
         name: Publish
         needs: gate-check
         if: ${{ needs.gate-check.outputs.passed == 'true' }}
         uses: KooshaPari/phenotypeActions/.github/workflows/publish.yml@v1
         with:
           language: ${{ inputs.language }}
           registry: ${{ inputs.registry }}
           version: ${{ inputs.version }}
           package_name: ${{ github.event.repository.name }}
         secrets: inherit

       notify:
         name: Notify Result
         needs: [gate-check, publish]
         if: always()
         runs-on: ubuntu-latest
         steps:
           - name: Report promotion result
             run: |
               if [[ "${{ needs.gate-check.outputs.passed }}" == "true" ]]; then
                 echo "::notice title=Promote::✓ Promoted from ${{ inputs.from_channel }} to ${{ inputs.to_channel }}"
               else
                 echo "::error title=Promote::✗ Promotion failed: gates not passed"
                 exit 1
               fi
     ```
  2. Chain workflows: gate-check → publish
  3. Only run publish if gate-check passes
  4. Include final notification step with summary
  5. Support manual re-runs with `--force` flag (skip gates)

- **Files**: `KooshaPari/phenotypeActions/.github/workflows/promote.yml`
- **Parallel?**: Yes (after T058)
- **Notes**: Use `needs` and `if` to implement conditional execution; inherit secrets for publish; provide clear output on success/failure

### Subtask T060 – Changelog Workflow
- **Purpose**: Create reusable `changelog.yml` workflow for generating and committing changelog files
- **Steps**:
  1. Create `.github/workflows/changelog.yml` in phenotypeActions repository:
     ```yaml
     name: Changelog

     on:
       workflow_call:
         inputs:
           version:
             description: "Release version (tag)"
             required: true
             type: string

     jobs:
       changelog:
         name: Generate Changelog
         runs-on: ubuntu-latest
         steps:
           - name: Checkout code
             uses: actions/checkout@v4
             with:
               fetch-depth: 0  # Full history for git-cliff

           - name: Setup git-cliff
             uses: kenji-miyake/setup-git-cliff@v2

           - name: Generate changelog
             run: |
               git cliff ${{ inputs.version }} > CHANGELOG.md

           - name: Commit changelog
             run: |
               git config user.name "phenotype-bot"
               git config user.email "bot@phenotype.io"
               git add CHANGELOG.md
               git commit -m "docs: update changelog for ${{ inputs.version }}" || true

           - name: Push changes
             run: |
               git push origin HEAD:$(git rev-parse --abbrev-ref HEAD)

           - name: Create release
             uses: actions/create-release@v1
             env:
               GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
             with:
               tag_name: ${{ inputs.version }}
               release_name: Release ${{ inputs.version }}
               body_path: CHANGELOG.md
               draft: false
               prerelease: false
     ```
  2. Parse conventional commits using git-cliff
  3. Group commits by type (feat, fix, chore, etc.)
  4. Generate markdown changelog in CHANGELOG.md
  5. Commit changelog file (with bot credentials)
  6. Create GitHub release with changelog as body
  7. Support both commit-and-push and release-only modes

- **Files**: `KooshaPari/phenotypeActions/.github/workflows/changelog.yml`
- **Parallel?**: Yes (after T057)
- **Notes**: Use git-cliff for conventional commit parsing; set bot credentials for commits; handle case where changelog already exists (append)

### Subtask T061 – Audit Workflow (Scheduled)
- **Purpose**: Create scheduled `audit.yml` workflow to periodically scan release status
- **Steps**:
  1. Create `.github/workflows/audit.yml` in phenotypeActions repository:
     ```yaml
     name: Audit

     on:
       schedule:
         - cron: '0 9 * * 1'  # Weekly, Monday 9 AM UTC
       workflow_dispatch:  # Allow manual trigger

     jobs:
       audit:
         name: Audit Release Status
         runs-on: ubuntu-latest
         steps:
           - name: Checkout phenotypeActions
             uses: actions/checkout@v4

           - name: Setup pheno CLI
             run: |
               # Build or download pheno CLI
               # (assumes pheno-cli is built and available)
               go install github.com/KooshaPari/pheno-cli@latest

           - name: Run audit
             run: |
               pheno audit --format json > audit-results.json

           - name: Process results
             run: |
               # Parse JSON results
               # Count published/unpublished/blocked
               cat audit-results.json | jq '.[] | select(.status == "unpublished")'

           - name: Create issue
             uses: actions/github-script@v6
             with:
               script: |
                 const fs = require('fs');
                 const results = JSON.parse(fs.readFileSync('audit-results.json'));
                 const unpublished = results.filter(r => r.status === 'unpublished');

                 if (unpublished.length > 0) {
                   github.rest.issues.create({
                     owner: context.repo.owner,
                     repo: context.repo.repo,
                     title: `[Audit] ${unpublished.length} unpublished packages`,
                     body: `Unpublished packages:\n${unpublished.map(p => `- ${p.package}`).join('\n')}`,
                     labels: ['audit', 'release']
                   });
                 }

           - name: Upload results
             uses: actions/upload-artifact@v3
             with:
               name: audit-results
               path: audit-results.json
     ```
  2. Schedule weekly audit (configurable cron)
  3. Allow manual trigger via `workflow_dispatch`
  4. Parse JSON audit results
  5. Create GitHub issue if unpublished packages found
  6. Upload results as artifact for inspection
  7. Support Slack/email notifications (future enhancement)

- **Files**: `KooshaPari/phenotypeActions/.github/workflows/audit.yml`
- **Parallel?**: Yes (after implementation of pheno-cli audit command)
- **Notes**: Schedule is UTC; configurable via cron expression; use GitHub API to create issues; support optional notifications

### Subtask T062 – Workflow Schema & Documentation
- **Purpose**: Document consistent inputs/outputs interface across all workflows
- **Steps**:
  1. Create `README.md` in phenotypeActions with workflow documentation:
     ```markdown
     # Phenotype Actions

     Reusable GitHub Actions workflows for release governance and CI/CD.

     ## Workflows

     ### publish.yml
     Builds and publishes packages to registries.

     **Inputs:**
     - `language` (string, required): go|rust|python|typescript
     - `registry` (string, required): npm|pypi|crates|custom
     - `version` (string, required): Package version
     - `package_name` (string, required): Display name

     **Secrets:**
     - `NPM_TOKEN` (optional): npm authentication
     - `PYPI_TOKEN` (optional): PyPI authentication
     - `CRATES_TOKEN` (optional): crates.io authentication

     **Example:**
     ```yaml
     - uses: KooshaPari/phenotypeActions/.github/workflows/publish.yml@v1
       with:
         language: rust
         registry: crates
         version: v1.2.3
         package_name: my-package
       secrets: inherit
     ```

     ### gate-check.yml
     Evaluates quality gates for channel promotion.

     **Inputs:**
     - `language` (string, required)
     - `channel` (string, required): alpha|canary|beta|rc|prod
     - `risk_profile` (string, required): low|medium|high

     **Outputs:**
     - `passed` (string): true|false
     - `results` (string): JSON with gate results

     **Example:**
     ```yaml
     - uses: KooshaPari/phenotypeActions/.github/workflows/gate-check.yml@v1
       with:
         language: python
         channel: beta
         risk_profile: low
     ```

     (repeat for promote, changelog, audit)

     ## Secrets Management

     Store registry credentials as repository secrets:
     - `NPM_TOKEN`: from npm registry
     - `PYPI_TOKEN`: from PyPI
     - `CRATES_TOKEN`: from crates.io

     Use `secrets: inherit` to pass to reusable workflows.

     ## Contributing

     To add a new workflow:
     1. Create `workflows/[name].yml`
     2. Document inputs/outputs in README
     3. Test with `act` or test repository
     4. Tag release version
     ```

  2. Document each workflow's purpose, inputs, outputs, and example usage
  3. Include troubleshooting section (common failures and fixes)
  4. Document secrets setup per registry
  5. Add version pinning guidance (v1, v1.2.3, @main)
  6. Include migration guide for teams moving from custom workflows

- **Files**: `KooshaPari/phenotypeActions/README.md`, `.github/WORKFLOW_SCHEMA.md`
- **Parallel?**: Yes (after T057–T061)
- **Notes**: Use consistent schema format for all workflows; include example usage for each; document input validation rules

### Subtask T063 – Workflow Testing & Validation
- **Purpose**: Test workflows locally and in a test repository
- **Steps**:
  1. Install and use `act` (local GitHub Actions runner):
     ```bash
     # Test gate-check workflow locally
     act --job gate-check --input language=go --input channel=alpha --input risk_profile=low
     ```
  2. Create `tests/workflows_test.sh` script:
     ```bash
     #!/bin/bash
     # Test all reusable workflows

     set -e

     echo "Testing gate-check.yml..."
     act --job gates -W .github/workflows/gate-check.yml \
       --input language=go --input channel=alpha --input risk_profile=low

     echo "Testing publish.yml..."
     act --job publish -W .github/workflows/publish.yml \
       --input language=go --input registry=custom --input version=v1.0.0 \
       --input package_name=test-pkg

     echo "Testing promote.yml..."
     act --job gate-check -W .github/workflows/promote.yml \
       --input language=go --input registry=custom --input from_channel=alpha \
       --input to_channel=beta --input risk_profile=low --input version=v1.0.0

     echo "All tests passed!"
     ```
  3. Create test repository with sample Go/Rust/Python/TypeScript projects
  4. Push changes and verify workflows trigger correctly
  5. Verify outputs and artifacts are generated
  6. Test error cases:
     - Gate failure → publish not triggered
     - Missing secret → publish fails with clear error
     - Invalid input → workflow fails early
  7. Document test procedures in TESTING.md

- **Files**: `KooshaPari/phenotypeActions/tests/workflows_test.sh`, `TESTING.md`
- **Parallel?**: Yes (after T057–T061)
- **Notes**: Use `act` for fast local testing; set up test repos for end-to-end validation; verify secrets are masked in logs; test both success and failure paths

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Workflows timeout on slow registries or large builds | Medium | Add configurable timeouts; implement retry with backoff; pre-build and cache dependencies |
| Secrets leaked in logs or workflow output | Medium | Use GitHub Actions secrets masking; avoid logging tokens; use `secrets: inherit` carefully |
| Workflows become out of sync as pheno-cli evolves | Medium | Version workflows with semantic versioning; document breaking changes; support multiple versions |
| Cross-language workflows fail due to tool differences | Medium | Delegate all tool invocation to mise tasks; test each language in gate-check; document tool requirements |

## Review Guidance

When reviewing WP10 completion:

1. **Publish Workflow**: Verify successful build and publish to mock registry; test retry logic on transient failure; check credentials are handled securely.
2. **Gate-Check Workflow**: Verify gates execute per channel; test risk-based skipping; check output JSON is valid and parseable; verify gate failure blocks publish.
3. **Promote Workflow**: Test full chain (gates → publish); verify conditional execution (`if: needs.gate-check.outputs.passed`); check output is clear on success/failure.
4. **Changelog Workflow**: Verify conventional commits parsed correctly; check CHANGELOG.md formatted well; verify release created with body.
5. **Audit Workflow**: Test scheduled trigger; verify issue created for unpublished packages; check artifact uploaded; test manual trigger.
6. **Documentation**: Review README for clarity and completeness; check example usage is copy-paste ready; verify schema document is machine-parseable.
7. **Testing**: Run `act` tests locally; create test repository and trigger workflows; verify all success and failure paths tested.

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created via /spec-kitty.tasks
- 2026-03-01T18:23:09Z – wp10-ci – shell_pid=18544 – lane=doing – Assigned agent via workflow command
- 2026-03-01T20:39:54Z – wp10-ci – shell_pid=18544 – lane=for_review – Ready: centralized CI workflows
- 2026-03-01T20:40:16Z – reviewer – shell_pid=34436 – lane=doing – Started review via workflow command
- 2026-03-01T20:57:45Z – reviewer – shell_pid=34436 – lane=planned – Moved to planned
- 2026-03-01T21:40:05Z – reviewer – shell_pid=34436 – lane=for_review – Ready for review
- 2026-03-01T21:40:24Z – reviewer – shell_pid=34436 – lane=done – Implementation complete
