---
work_package_id: WP09
title: CLI Bootstrap Command
lane: "done"
dependencies:
- WP01
base_branch: 002-org-wide-release-governance-dx-automation-WP01
base_commit: 50c5fe5c522c6cec9f56b7d88f9628b7ff80b5cc
created_at: '2026-03-01T18:23:09.121447+00:00'
subtasks: [T049, T050, T051, T052, T053, T054, T055, T056]
phase: Phase 3 - DX Tooling
assignee: ''
agent: "wp09-bootstrap"
shell_pid: "18560"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP09 – CLI Bootstrap Command

## Objectives & Success Criteria

This work package implements the `pheno bootstrap` command to automate DX scaffolding for new or existing repositories. Success means:

- `pheno bootstrap` detects language(s) and generates all required configuration artifacts
- Templates are language-aware and support Rust, Python, TypeScript, and Go (extensible)
- Generated `mise.toml` includes standardized task definitions per language
- Pre-commit and pre-push hooks enforce conventional commits and formatting rules
- CI workflow templates integrate with phenotypeActions reusable workflows
- `cliff.toml` template enables automatic changelog generation
- Dry-run mode shows what would be generated without writing files
- Full integration test creates temp repo and verifies all expected files
- Implementation command: `spec-kitty implement WP09 --base WP01`

## Context & Constraints

- Builds on WP01 (Package Model) and WP10 (Centralized CI Workflows)
- Must auto-detect supported languages from existing manifests (package.json, setup.py, Cargo.toml, go.mod)
- Templates use Go `text/template` with embedded files (no external file dependencies)
- Task definitions must match mise task syntax and be idempotent
- Pre-commit/pre-push hooks are shell scripts with minimal dependencies (only git and installed tools)
- CI workflows reference `KooshaPari/phenotypeActions` repository reusable workflows
- Should support overwriting existing files with `--force` flag
- Dry-run mode must show all files that would be created without modifying filesystem

## Subtasks & Detailed Guidance

### Subtask T049 – Bootstrap Command Implementation
- **Purpose**: Create the `pheno bootstrap` command with language detection and artifact generation
- **Steps**:
  1. Create `cmd/bootstrap.go` with Cobra command definition:
     ```go
     var bootstrapCmd = &cobra.Command{
         Use:   "bootstrap [flags]",
         Short: "Bootstrap project with DX configuration",
         Long:  "Generate mise.toml, pre-commit hooks, CI workflows, and other DX artifacts",
         RunE:  runBootstrap,
     }

     func init() {
         bootstrapCmd.Flags().StringVar(&languageOverride, "language", "", "Override language detection (go|rust|python|typescript)")
         bootstrapCmd.Flags().StringVar(&riskProfile, "risk-profile", "low", "Default risk profile (low|medium|high)")
         bootstrapCmd.Flags().BoolVar(&dryRun, "dry-run", false, "Show what would be generated without writing")
         bootstrapCmd.Flags().BoolVar(&force, "force", false, "Overwrite existing files")
         rootCmd.AddCommand(bootstrapCmd)
     }
     ```
  2. Implement `runBootstrap` function flow:
     - Detect languages in current directory (or use --language override)
     - For each language: generate language-specific templates (see T051–T055)
     - Generate common artifacts (pre-commit, pre-push, .gitignore)
     - If dry-run: print file list and exit
     - If not dry-run:
       a. Check for existing files (warn if not --force)
       b. Write all files
       c. Make shell scripts executable (chmod +x)
       d. Run `git add` on generated files (optional, configurable)
     - Output: "✓ Generated 7 files (mise.toml, pre-commit, pre-push, ci.yml, release.yml, cliff.toml, .pre-commit-config.yaml)"
  3. Language detection heuristics:
     - Go: presence of `go.mod`
     - Rust: presence of `Cargo.toml`
     - Python: presence of `setup.py`, `pyproject.toml`, or `requirements.txt`
     - TypeScript/JavaScript: presence of `package.json` with type field or `tsconfig.json`
  4. Error handling:
     - No manifests found: error "Could not detect language. Use --language to override."
     - Template loading fails: error with details
     - File write fails: error with path and reason
  5. Support interactive mode (future): prompt for choices if ambiguous

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/bootstrap.go`
- **Parallel?**: No (prerequisite for T050–T055)
- **Notes**: Use `os.Stat` to check if files exist before writing; provide clear error messages; respect existing configurations when possible (merge rather than overwrite)

### Subtask T050 – Template System with Embedded Files
- **Purpose**: Implement Go template system with embedded template files
- **Steps**:
  1. Create `internal/templates/templates.go` to manage template loading and rendering:
     ```go
     package templates

     import (
         "embed"
         "text/template"
     )

     //go:embed files/*.toml files/*.sh files/*.yml files/*.yaml
     var templateFS embed.FS

     type TemplateContext struct {
         RepoName     string
         Language     string
         Registry     string
         RiskProfile  string
         Author       string
         Email        string
     }

     func RenderTemplate(name string, ctx TemplateContext) (string, error) {
         tmpl, err := template.ParseFS(templateFS, "files/"+name)
         if err != nil {
             return "", err
         }
         var buf bytes.Buffer
         err = tmpl.Execute(&buf, ctx)
         return buf.String(), err
     }
     ```
  2. Create `internal/templates/files/` directory for template files:
     - `files/mise.toml.tpl` (see T051)
     - `files/pre-commit.sh.tpl` (see T052)
     - `files/pre-push.sh.tpl` (see T053)
     - `files/ci.yml.tpl` (see T054)
     - `files/release.yml.tpl` (see T054)
     - `files/cliff.toml.tpl` (see T055)
  3. Implement template variable substitution:
     - `{{ .RepoName }}` → package name or directory name
     - `{{ .Language }}` → detected language
     - `{{ .Registry }}` → auto-detected or configured (npm, pypi, crates)
     - `{{ .RiskProfile }}` → from --risk-profile flag
     - `{{ .Author }}` → from git config or env
     - `{{ .Email }}` → from git config or env
  4. Template functions for common operations:
     - `{{ upper .Language }}` → uppercase language name
     - `{{ eq .Language "go" }}` → conditional rendering per language
  5. Error handling: wrap template errors with file name and context

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/templates.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/*.tpl`
- **Parallel?**: No (prerequisite for T051–T055)
- **Notes**: Use `//go:embed` to embed files at compile time; ensure template files are valid Go templates; test template rendering with sample contexts

### Subtask T051 – Mise Task Templates
- **Purpose**: Generate language-specific mise task definitions
- **Steps**:
  1. Create `internal/templates/files/mise.toml.tpl` with common tasks:
     ```toml
     [tasks.format]
     description = "Format code"
     {{- if eq .Language "go" }}
     run = "gofmt -w ."
     {{- else if eq .Language "rust" }}
     run = "cargo fmt"
     {{- else if eq .Language "python" }}
     run = "ruff format ."
     {{- else if eq .Language "typescript" }}
     run = "prettier --write ."
     {{- end }}

     [tasks.lint]
     description = "Lint code"
     {{- if eq .Language "go" }}
     run = "golangci-lint run"
     {{- else if eq .Language "rust" }}
     run = "cargo clippy -- -D warnings"
     {{- else if eq .Language "python" }}
     run = "ruff check ."
     {{- else if eq .Language "typescript" }}
     run = "eslint ."
     {{- end }}

     [tasks.test]
     description = "Run unit tests"
     {{- if eq .Language "go" }}
     run = "go test ./..."
     {{- else if eq .Language "rust" }}
     run = "cargo test"
     {{- else if eq .Language "python" }}
     run = "pytest"
     {{- else if eq .Language "typescript" }}
     run = "vitest run"
     {{- end }}

     [tasks.build]
     description = "Build package"
     {{- if eq .Language "go" }}
     run = "go build ./..."
     {{- else if eq .Language "rust" }}
     run = "cargo build --release"
     {{- else if eq .Language "python" }}
     run = "python -m build"
     {{- else if eq .Language "typescript" }}
     run = "tsc"
     {{- end }}

     {{- if or (eq .Language "python") (eq .Language "typescript") }}
     [tasks."test:integration"]
     description = "Run integration tests"
     {{- if eq .Language "python" }}
     run = "pytest tests/integration"
     {{- else if eq .Language "typescript" }}
     run = "vitest run tests/integration"
     {{- end }}

     [tasks.audit]
     description = "Security audit"
     {{- if eq .Language "python" }}
     run = "bandit -r . || true"
     {{- else if eq .Language "typescript" }}
     run = "npm audit --audit-level=moderate || true"
     {{- end }}
     {{- end }}

     {{- if eq .Language "rust" }}
     [tasks."test:integration"]
     description = "Run integration tests"
     run = "cargo test --test '*' --release"

     [tasks.audit]
     description = "Security audit"
     run = "cargo audit || true"
     {{- end }}

     {{- if eq .Language "go" }}
     [tasks."test:integration"]
     description = "Run integration tests"
     run = "go test -tags=integration ./..."

     [tasks.audit]
     description = "Security audit"
     run = "gosec -no-fail ./... || true"
     {{- end }}

     [tasks."docs:build"]
     description = "Build documentation"
     {{- if eq .Language "go" }}
     run = "go doc -html ./... > docs/index.html"
     {{- else if eq .Language "rust" }}
     run = "cargo doc --no-deps"
     {{- else if eq .Language "python" }}
     run = "sphinx-build docs docs/_build"
     {{- else if eq .Language "typescript" }}
     run = "typedoc --out docs ."
     {{- end }}

     [tasks."release:promote"]
     description = "Promote package to next channel"
     run = "pheno promote"

     [tasks."release:status"]
     description = "Show release status"
     run = "pheno audit --repo ."
     ```
  2. Ensure all tasks are language-appropriate and use standard tooling
  3. Include common tasks: format, lint, test, build, audit, docs:build
  4. Include release tasks: release:promote, release:status
  5. Validate that tasks are idempotent (can run multiple times without issues)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/mise.toml.tpl`
- **Parallel?**: Yes (after T050)
- **Notes**: Use conditional rendering (if/else) to generate language-specific tasks; ensure all referenced tools are either built-in or commonly installed; test generated file is valid TOML

### Subtask T052 – Pre-Commit Hook Template
- **Purpose**: Generate shell script that enforces conventional commit format and runs fast formatting checks
- **Steps**:
  1. Create `internal/templates/files/pre-commit.sh.tpl`:
     ```bash
     #!/bin/bash
     # Pre-commit hook: Enforce conventional commit format and fast linting

     set -e

     # Get the commit message
     COMMIT_MSG=$(git diff --cached --name-only -z | git status -z --porcelain)

     # Conventional commit regex: (feat|fix|chore|...) = permitted prefixes
     COMMIT_REGEX="^(feat|fix|chore|docs|refactor|test|perf|ci|build|style|revert)(\(.+\))?!?: .+"

     if ! echo "$COMMIT_MSG" | grep -qE "$COMMIT_REGEX"; then
         echo "❌ Commit message does not follow conventional format"
         echo "Format: <type>(<scope>): <subject>"
         echo "Example: feat(auth): add JWT support"
         exit 1
     fi

     # Run format check (non-blocking)
     echo "🔍 Checking formatting..."
     if ! mise run format -- --check 2>/dev/null; then
         echo "⚠️  Format issues found. Run 'mise run format' to fix."
     fi

     echo "✓ Commit message valid"
     exit 0
     ```
  2. Ensure regex pattern matches common conventional commit types (feat, fix, chore, docs, refactor, test, perf, ci, build, style, revert)
  3. Support optional scope in parentheses: `feat(api): add endpoint`
  4. Support breaking change indicator (!): `feat!: breaking change`
  5. Ensure hook is executable and has proper shebang
  6. Test with sample commit messages (both valid and invalid)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/pre-commit.sh.tpl`
- **Parallel?**: Yes (after T050)
- **Notes**: Use basic POSIX shell commands to avoid dependencies; handle quoted commit messages correctly; be lenient on format check failure (don't block commit)

### Subtask T053 – Pre-Push Hook Template
- **Purpose**: Generate shell script that enforces linting and testing based on branch pattern
- **Steps**:
  1. Create `internal/templates/files/pre-push.sh.tpl`:
     ```bash
     #!/bin/bash
     # Pre-push hook: Run tests and linting based on branch pattern

     set -e

     # Get current branch
     BRANCH=$(git rev-parse --abbrev-ref HEAD)

     echo "📤 Pre-push check for branch: $BRANCH"

     # Main branch: block direct push
     if [[ "$BRANCH" == "main" ]] || [[ "$BRANCH" == "master" ]]; then
         echo "❌ Cannot push directly to $BRANCH. Use a pull request."
         exit 1
     fi

     # Feature branches: lint only
     if [[ "$BRANCH" =~ ^feature/.* ]]; then
         echo "🔍 Running lint check..."
         if ! mise run lint; then
             echo "❌ Lint errors found. Fix and try again."
             exit 1
         fi
         echo "✓ Lint check passed"
         exit 0
     fi

     # Beta/RC branches: full test suite
     if [[ "$BRANCH" =~ ^(beta|rc)/.* ]]; then
         echo "🧪 Running full test suite..."
         if ! mise run test; then
             echo "❌ Tests failed. Fix and try again."
             exit 1
         fi
         echo "✓ Tests passed"
         exit 0
     fi

     # Default: lint only
     echo "🔍 Running lint check..."
     if ! mise run lint; then
         echo "❌ Lint errors found. Fix and try again."
         exit 1
     fi
     echo "✓ Lint check passed"
     exit 0
     ```
  2. Detect branch name and apply rules:
     - `feature/*` → run lint only
     - `beta/*` or `rc/*` → run full test suite
     - `main` or `master` → block push with helpful message
     - Other → run lint only (safe default)
  3. Ensure hook is executable and has proper shebang
  4. Handle case where mise tasks don't exist (graceful fallback)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/pre-push.sh.tpl`
- **Parallel?**: Yes (after T050)
- **Notes**: Use POSIX-compatible regex syntax; handle missing tasks gracefully (warn but don't fail); ensure hook doesn't interfere with automated pushes (CI/CD systems)

### Subtask T054 – CI Workflow Templates
- **Purpose**: Generate GitHub Actions workflow files that integrate with phenotypeActions reusable workflows
- **Steps**:
  1. Create `internal/templates/files/ci.yml.tpl`:
     ```yaml
     name: CI

     on:
       push:
         branches: [main, develop]
       pull_request:
         branches: [main, develop]

     jobs:
       gate-check:
         name: Gate Check
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - uses: KooshaPari/phenotypeActions/.github/workflows/gate-check.yml@v1
             with:
               language: {{ .Language }}
               channel: alpha
               risk_profile: {{ .RiskProfile }}
             secrets: inherit
     ```
  2. Create `internal/templates/files/release.yml.tpl`:
     ```yaml
     name: Release

     on:
       push:
         tags:
           - 'v*'

     jobs:
       promote:
         name: Promote to Beta
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - uses: KooshaPari/phenotypeActions/.github/workflows/promote.yml@v1
             with:
               language: {{ .Language }}
               registry: {{ .Registry }}
               from_channel: alpha
               to_channel: beta
               risk_profile: {{ .RiskProfile }}
               version: ${{ github.ref_name }}
             secrets: inherit

       changelog:
         name: Generate Changelog
         runs-on: ubuntu-latest
         needs: promote
         steps:
           - uses: actions/checkout@v4
           - uses: KooshaPari/phenotypeActions/.github/workflows/changelog.yml@v1
             with:
               version: ${{ github.ref_name }}
     ```
  3. Ensure workflows reference correct phenotypeActions workflows (from WP10)
  4. Support language variable substitution
  5. Include necessary secrets and inputs

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/ci.yml.tpl`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/release.yml.tpl`
- **Parallel?**: Yes (after T050)
- **Notes**: Use v4 of actions/checkout; reference phenotypeActions with semantic versioning; support language and registry variable substitution

### Subtask T055 – Changelog Template (cliff.toml)
- **Purpose**: Generate git-cliff configuration for automatic changelog generation
- **Steps**:
  1. Create `internal/templates/files/cliff.toml.tpl`:
     ```toml
     [changelog]
     # git-cliff configuration for changelog generation

     [git]
     # Conventional commit parsing
     conventional_commits = true
     filter_unconventional = true

     [changelog.style]
     template = """
     # Changelog

     All notable changes to this project will be documented in this file.

     {% for release in releases -%}
         {% if release.version -%}
             ## [{{ release.version }}] - {{ release.timestamp | date(format="%Y-%m-%d") }}
         {% else -%}
             ## [Unreleased]
         {% endif -%}

         {% if release.commit_group -%}
             {% for group, commits in release.commit_group | sort(attribute="title") -%}
                 ### {{ group | upper_first }}

                 {% for commit in commits -%}
                     - {% if commit.scope -%}**{{ commit.scope }}**: {% endif %}{{ commit.message }}{% if commit.breaking %} (breaking){% endif %}
                 {% endfor %}
             {% endfor %}
         {% endif -%}
     {% endfor %}
     """

     commit_processors = [
         {message_regex = "^feat", group = "Features"},
         {message_regex = "^fix", group = "Bug Fixes"},
         {message_regex = "^chore", group = "Chores"},
         {message_regex = "^docs", group = "Documentation"},
         {message_regex = "^style", group = "Style"},
         {message_regex = "^refactor", group = "Refactoring"},
         {message_regex = "^perf", group = "Performance"},
         {message_regex = "^test", group = "Testing"},
     ]
     ```
  2. Configure conventional commit parsing
  3. Group commits by type (feat, fix, chore, etc.)
  4. Include breaking changes in output
  5. Ensure output format matches semantic versioning

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/files/cliff.toml.tpl`
- **Parallel?**: Yes (after T050)
- **Notes**: Use valid TOML and git-cliff template syntax; test template with sample commits; ensure changelog output is readable and follows organization standards

### Subtask T056 – Bootstrap Integration Test
- **Purpose**: End-to-end test creating a temp repo and verifying all expected files
- **Steps**:
  1. Create `cmd/bootstrap_test.go`:
     ```go
     func TestBootstrapGoProject(t *testing.T) {
         // Create temp dir
         // Write go.mod to simulate Go project
         // Run "pheno bootstrap --language go --dry-run"
         // Verify output lists: mise.toml, pre-commit, pre-push, ci.yml, release.yml, cliff.toml
         // Verify no files written
     }

     func TestBootstrapGenerateFiles(t *testing.T) {
         // Create temp dir with package.json (TypeScript)
         // Run "pheno bootstrap --language typescript"
         // Verify all files created:
         // - mise.toml exists and is valid TOML
         // - pre-commit is executable shell script
         // - pre-push is executable shell script
         // - ci.yml exists and is valid YAML
         // - release.yml exists and is valid YAML
         // - cliff.toml exists and is valid TOML
         // Verify template variables substituted correctly
     }

     func TestBootstrapFileOverwrite(t *testing.T) {
         // Create temp dir with existing mise.toml
         // Run "pheno bootstrap" without --force
         // Verify files NOT overwritten, warning shown
         // Run "pheno bootstrap --force"
         // Verify files overwritten
     }

     func TestBootstrapLanguageDetection(t *testing.T) {
         // Test Go: create go.mod, verify language detected as go
         // Test Rust: create Cargo.toml, verify language detected as rust
         // Test Python: create setup.py, verify language detected as python
         // Test TypeScript: create tsconfig.json, verify language detected as typescript
     }

     func TestBootstrapConventionalCommitRegex(t *testing.T) {
         // Generate pre-commit script
         // Test regex against valid/invalid commit messages:
         // Valid: "feat: add feature", "fix(scope): fix bug", "chore!: breaking"
         // Invalid: "add feature", "feat : extra space"
     }
     ```
  2. Use temp directories that are cleaned up after test
  3. Verify generated files are valid (parse TOML, YAML, shell syntax)
  4. Verify template substitution works (check for {{ .Language }} is replaced)
  5. Test both dry-run and actual file generation
  6. Ensure test runs in <5 seconds

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/bootstrap_test.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/templates/templates_test.go`
- **Parallel?**: Yes (after T049–T055)
- **Notes**: Use `ioutil.TempDir` for safe temp directory creation; verify file permissions with `os.Stat`; use `bytes.Buffer` to capture command output; mock language detection if needed

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Generated tasks don't work on user's system (missing tools) | Medium | Document tool requirements per language; add warnings during bootstrap; suggest fallback commands |
| Pre-commit/push hooks break due to shell differences | Medium | Use POSIX-compatible syntax only; test on multiple shells (bash, zsh, sh) |
| Template substitution leaves unresolved variables | Low | Validate all template variables are present in context; add test to catch unreplaced variables |
| Generated CI workflows fail due to missing secrets | Medium | Document required secrets (NPM_TOKEN, etc.) in generated files; provide setup instructions |

## Review Guidance

When reviewing WP09 completion:

1. **Bootstrap Command**: Verify `pheno bootstrap` detects language, generates files, respects --dry-run, and handles overwrites correctly.
2. **Language Detection**: Test with each supported language (Go, Rust, Python, TypeScript); verify correct detection with multiple manifests.
3. **Template Generation**: Verify all templates render correctly with proper variable substitution; check that no {{ }} remain in output.
4. **Mise Tasks**: Generated `mise.toml` is valid TOML; all referenced tasks work (at least for installed tools); tasks are idempotent.
5. **Hooks**: Pre-commit and pre-push hooks are executable; conventional commit regex works correctly; hook logic matches specification.
6. **CI Workflows**: Generated workflows reference phenotypeActions correctly; inputs match WP10 signatures; secrets are documented.
7. **Tests**: Full integration test passes; language detection test covers all 4 supported languages; template test validates output correctness.

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created via /spec-kitty.tasks
- 2026-03-01T18:23:09Z – wp09-bootstrap – shell_pid=18560 – lane=doing – Assigned agent via workflow command
- 2026-03-01T20:27:19Z – wp09-bootstrap – shell_pid=18560 – lane=for_review – Ready: bootstrap command with templates
- 2026-03-01T21:40:13Z – wp09-bootstrap – shell_pid=18560 – lane=done – Implementation complete, reviewed
