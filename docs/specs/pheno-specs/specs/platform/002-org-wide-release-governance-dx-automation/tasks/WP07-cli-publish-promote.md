---
work_package_id: WP07
title: CLI Publish & Promote Commands
lane: "done"
dependencies:
- WP01
base_branch: 002-org-wide-release-governance-dx-automation-WP01
base_commit: 50c5fe5c522c6cec9f56b7d88f9628b7ff80b5cc
created_at: '2026-03-01T18:23:09.128188+00:00'
subtasks: [T038, T039, T040, T041, T042, T043]
phase: Phase 2 - CLI Commands
assignee: ''
agent: "wp07-publish"
shell_pid: "18556"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP07 – CLI Publish & Promote Commands

## Objectives & Success Criteria

This work package exposes the core publication and promotion workflows through two primary Cobra commands: `publish` and `promote`. Success means:

- `pheno publish` command is fully functional with registry auto-detection, dry-run support, and workspace orchestration
- `pheno promote` command enforces gate evaluation before publishing with user-friendly reporting
- Workspace multi-package publishing respects topological order and verifies between publishes
- Both commands produce Lipgloss progress output with spinner and result tables
- Viper config system supports global and per-repo overrides with env var precedence
- Full integration tests cover publish flow with mocked adapters and promote with gate pass/fail scenarios
- Implementation command: `spec-kitty implement WP07 --base WP06`

## Context & Constraints

- Builds on WP01 (Package Model), WP02 (Registry Adapters), WP03 (Config), WP04 (Error Handling), WP05 (Workspace), WP06 (Gate Evaluation)
- Must support both single-package and workspace publishing
- Registry adapters must be selected based on language auto-detection
- Risk profile determines gate skipping behavior (see WP06)
- Dry-run mode must execute all logic except actual registry publish
- Workspace publishing must handle dependencies: publish independently-publishable packages in parallel, serialize for dependent packages
- Output must be human-friendly (Lipgloss) for CLI, but also support quiet/structured formats for CI
- Config precedence: env vars > local `.pheno.toml` > global `~/.config/pheno/config.toml` > hardcoded defaults

## Subtasks & Detailed Guidance

### Subtask T038 – Publish Command Implementation
- **Purpose**: Create the `pheno publish` command to build and publish a single package or workspace to its configured registry
- **Steps**:
  1. Create `cmd/publish.go` with Cobra command definition:
     ```go
     var publishCmd = &cobra.Command{
         Use:   "publish [flags]",
         Short: "Publish packages to registries",
         Long:  "Build and publish packages to their configured registries (npm, PyPI, crates.io, etc.)",
         RunE:  runPublish,
     }

     func init() {
         publishCmd.Flags().StringVar(&registryOverride, "registry", "", "Override auto-detected registry (npm|pypi|crates)")
         publishCmd.Flags().StringVar(&versionOverride, "version", "", "Override package version")
         publishCmd.Flags().BoolVar(&dryRun, "dry-run", false, "Simulate publish without writing to registry")
         rootCmd.AddCommand(publishCmd)
     }
     ```
  2. Implement `runPublish` function flow:
     - Detect current working directory or use `--repo` flag
     - Call package discovery (from WP01/WP05)
     - If workspace: orchestrate publishing (see T040)
     - If single package:
       a. Detect language and select adapter
       b. Override registry/version if flags provided
       c. Call adapter.Build()
       d. Call adapter.Publish() (or skip if dry-run)
       e. Verify published version exists in registry
     - Output progress with Lipgloss spinner during build/publish
  3. Error handling:
     - If package not found, error with helpful message (e.g., "No package.json or setup.py found")
     - If adapter not found, error with list of supported languages
     - If publish fails, show registry error output
  4. Success output: "✓ Published package@version to npm"
  5. Handle registry auto-detection priority: npm → pypi → crates → go (based on manifest files present)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/publish.go`
- **Parallel?**: No (prerequisite for integration tests in T043)
- **Notes**: Reuse adapter interface from WP02; handle case where multiple manifests exist in same dir (warn and use priority); ensure dry-run still performs all validation and build steps

### Subtask T039 – Promote Command Implementation
- **Purpose**: Create the `pheno promote` command to validate channel transition, run gate evaluation, and publish on gate pass
- **Steps**:
  1. Create `cmd/promote.go` with Cobra command definition:
     ```go
     var promoteCmd = &cobra.Command{
         Use:   "promote <channel> [flags]",
         Short: "Promote packages to a release channel",
         Long:  "Validate gate criteria and promote packages to a release channel (alpha, canary, beta, rc, prod)",
         Args:  cobra.ExactArgs(1),
         RunE:  runPromote,
     }

     func init() {
         promoteCmd.Flags().StringVar(&riskProfile, "risk-profile", "low", "Risk profile for gate skipping (low|medium|high)")
         promoteCmd.Flags().BoolVar(&forceSkipGates, "force", false, "Skip gate evaluation (dangerous)")
         promoteCmd.Flags().BoolVar(&dryRun, "dry-run", false, "Simulate promotion without publishing")
         rootCmd.AddCommand(promoteCmd)
     }
     ```
  2. Implement `runPromote` function flow:
     - Parse target channel argument (alpha/canary/beta/rc/prod)
     - Load current channel from package metadata or config
     - Validate transition (is fromChannel < toChannel?)
     - If not forced: call gate.Evaluate(pkg, fromChannel, toChannel, riskProfile)
     - If gates pass or forced: call publish.Publish(pkg, toChannel)
     - If gates fail: display gate results table and error
     - Update package metadata to reflect new channel
  3. Error handling:
     - Invalid channel name: list valid channels
     - Backward transition (e.g., prod→beta): error "Cannot demote"
     - Gate failure: show detailed results table; suggest rerunning with `--force` for debugging
  4. Output flow:
     - Spinner during gate evaluation
     - Lipgloss table showing gate results
     - Success: "✓ Promoted to beta (5 gates passed in 3.2s)"
  5. Dry-run behavior: skip actual publish but show what would happen

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/promote.go`
- **Parallel?**: Yes (after T038, but can run concurrently with T040)
- **Notes**: Reuse gate evaluator from WP06; handle channel detection (ask user if ambiguous); ensure dry-run still validates gates fully

### Subtask T040 – Workspace Publishing Orchestration
- **Purpose**: Implement topological dependency resolution and parallel publishing for independent packages in a workspace
- **Steps**:
  1. Create `internal/publish/orchestrator.go`
  2. Implement topological sort to order packages by dependencies:
     ```go
     type PublishOrder struct {
         Phases [][]Package  // Each phase is a list of packages to publish in parallel
     }

     func ComputePublishOrder(workspace *Workspace) (*PublishOrder, error) {
         // Build dependency graph from Package.Dependencies
         // Return phases where phase[i] has no deps on phase[j] for j > i
         // Example: [pkg_a], [pkg_b, pkg_c] means publish A first, then B and C together
     }
     ```
  3. Implement parallel publishing within a phase:
     ```go
     func PublishPhase(ctx context.Context, packages []Package, adapter registry.Adapter) error {
         var wg sync.WaitGroup
         errChan := make(chan error, len(packages))

         for _, pkg := range packages {
             wg.Add(1)
             go func(p Package) {
                 defer wg.Done()
                 result := adapter.Publish(ctx, p)
                 if result.Err != nil {
                     errChan <- result.Err
                 }
             }(pkg)
         }

         wg.Wait()
         close(errChan)

         // Check if any errors occurred
         for err := range errChan {
             if err != nil {
                 return err
             }
         }
         return nil
     }
     ```
  4. Implement verification step between phases:
     - After each phase, verify all published packages exist in registry
     - If any verification fails, halt and error (don't proceed to next phase)
     - Output: "✓ Phase 1: published pkg_a, pkg_b"
  5. Handle circular dependency detection:
     - Detect cycles in dependency graph
     - Return error with details on which packages form cycle
  6. Add progress tracking: show current phase number, total phases, packages per phase

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/publish/orchestrator.go`
- **Parallel?**: Yes (after T038/T039)
- **Notes**: Use Go's `sync.WaitGroup` for parallel publishing; ensure context cancellation propagates to all goroutines; handle partial phase failure gracefully

### Subtask T041 – Lipgloss Output & Progress Indicators
- **Purpose**: Implement human-friendly Lipgloss progress spinners and result tables for publish and promote commands
- **Steps**:
  1. Create `internal/ui/progress.go` for Lipgloss components
  2. Implement spinner component using `bubbles/spinner`:
     ```go
     import "github.com/charmbracelet/bubbles/spinner"

     type ProgressSpinner struct {
         spinner spinner.Model
         message string
     }

     func NewProgressSpinner(message string) *ProgressSpinner {
         s := spinner.New()
         s.Spinner = spinner.Dot
         s.Style = lipgloss.NewStyle().Foreground(lipgloss.Color("205"))
         return &ProgressSpinner{spinner: s, message: message}
     }

     func (ps *ProgressSpinner) Render() string {
         return ps.spinner.View() + " " + ps.message
     }
     ```
  3. Implement Lipgloss table for gate results (builds on WP06 reporter):
     ```go
     func FormatGateResultsTable(report *gate.PromotionReport) string {
         t := table.New()
         // Columns: Criterion | Status | Duration | Details
         // Green ✓ for passed, red ✗ for failed
         // Include summary row at end
     }
     ```
  4. Implement publish progress bar:
     ```go
     func FormatPublishProgress(current, total int, pkgName string) string {
         // Show "Publishing [###---] pkg_a (2/5)"
     }
     ```
  5. Implement summary box showing overall results:
     ```go
     func FormatSummary(published []Package, failed []Package, duration time.Duration) string {
         // Box style with checkmark/X counts and duration
     }
     ```
  6. Ensure all output is ANSI color-safe and readable in both light/dark terminals
  7. Add quiet mode (only success/error, no spinners)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/ui/progress.go`
- **Parallel?**: Yes (after T038/T039)
- **Notes**: Use Lipgloss color palette consistently (green=#2d7d4d, red=#d74242, yellow=#c9ab47); test output on different terminal widths; ensure spinner doesn't break in CI/non-TTY environments

### Subtask T042 – Viper Configuration System
- **Purpose**: Implement global and per-repo configuration with environment variable overrides
- **Steps**:
  1. Create `internal/config/config.go` to initialize Viper:
     ```go
     func InitConfig() error {
         viper.SetConfigName("config")
         viper.SetConfigType("toml")
         viper.AddConfigPath(os.ExpandEnv("$HOME/.config/pheno"))
         viper.AddConfigPath(".")

         // Set env prefix
         viper.SetEnvPrefix("PHENO")
         viper.AutomaticEnv()

         // Set defaults
         viper.SetDefault("repos_dir", filepath.Dir(os.Getenv("PWD")))
         viper.SetDefault("default_risk_profile", "low")

         return viper.ReadInConfig()  // Errors on missing file are acceptable
     }
     ```
  2. Define global config structure in `~/.config/pheno/config.toml`:
     ```toml
     repos_dir = "/path/to/repos"
     default_risk_profile = "low"

     [credentials]
     npm_token = ""  # Or load from env
     pypi_token = ""
     crates_token = ""
     ```
  3. Define per-repo config in `.pheno.toml` at package root:
     ```toml
     language = "go"  # Override auto-detection
     risk_profile = "medium"
     registry = "custom-npm.example.com"
     ```
  4. Implement precedence: env vars > local `.pheno.toml` > global `~/.config/pheno/config.toml` > defaults
  5. Support env var loading for sensitive values:
     - `PHENO_NPM_TOKEN` → npm credentials
     - `PHENO_PYPI_TOKEN` → PyPI credentials
     - `PHENO_CRATES_TOKEN` → crates.io credentials
  6. Add config validation: ensure required fields are present or warn
  7. Add `pheno config show` command to display current effective config
  8. Document config file format in README with example

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/config/config.go`, `internal/config/defaults.go`
- **Parallel?**: Yes (after T038/T039)
- **Notes**: Don't log sensitive values; use Viper's feature to read from env with SetEnvKeyReplacer; test config loading from both global and local files; ensure TOML format is valid and human-readable

### Subtask T043 – Integration Tests
- **Purpose**: End-to-end tests covering full publish and promote workflows with mocked adapters
- **Steps**:
  1. Create `cmd/publish_test.go` for publish command integration tests:
     ```go
     func TestPublishSinglePackage(t *testing.T) {
         // Setup: create temp dir with package.json
         // Mock npm adapter
         // Run "pheno publish --dry-run"
         // Assert: adapter.Build called, adapter.Publish called
         // Assert: spinner rendered, success message shown
     }

     func TestPublishWorkspace(t *testing.T) {
         // Setup: create temp workspace with multiple packages in dependency order
         // Mock all adapters
         // Run "pheno publish"
         // Assert: topological order respected (A before B)
         // Assert: parallel publishing within phase
         // Assert: verification done between phases
     }

     func TestPublishDryRun(t *testing.T) {
         // Setup: package ready to publish
         // Run "pheno publish --dry-run"
         // Assert: adapter.Build called, adapter.Publish NOT called
         // Assert: "would publish" message shown
     }
     ```
  2. Create `cmd/promote_test.go` for promote command integration tests:
     ```go
     func TestPromoteWithGatePass(t *testing.T) {
         // Setup: package at alpha, gate.Evaluate mocked to return pass
         // Run "pheno promote beta"
         // Assert: gate.Evaluate called with correct channels
         // Assert: publish.Publish called
         // Assert: gate results table rendered
         // Assert: success message
     }

     func TestPromoteWithGateFail(t *testing.T) {
         // Setup: package at alpha, gate.Evaluate mocked to return fail
         // Run "pheno promote beta"
         // Assert: gate results table shows failures
         // Assert: publish.Publish NOT called
         // Assert: error message suggests rerun with --force
     }

     func TestPromoteForceSkipGates(t *testing.T) {
         // Setup: package at alpha, gate.Evaluate would fail
         // Run "pheno promote beta --force"
         // Assert: gate.Evaluate NOT called
         // Assert: publish.Publish called directly
     }

     func TestPromoteInvalidTransition(t *testing.T) {
         // Setup: package at prod
         // Run "pheno promote beta"
         // Assert: error "Cannot demote"
         // Assert: publish.Publish NOT called
     }
     ```
  3. Create `internal/publish/orchestrator_test.go`:
     ```go
     func TestComputePublishOrder(t *testing.T) {
         // Test topological sort
         // Test cycle detection
         // Test parallel independence
     }
     ```
  4. Use test helpers to:
     - Create temporary workspaces with manifests
     - Mock registry adapters with predictable responses
     - Capture Lipgloss output and verify formatting
  5. Ensure tests run in <5 seconds by mocking all external I/O

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/publish_test.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/promote_test.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/publish/orchestrator_test.go`
- **Parallel?**: Yes (after all other T038–T042 subtasks)
- **Notes**: Use `testutil` package for common test fixtures; mock `exec.CommandContext` to avoid actual command execution; stub Viper config loading; verify output formatting without requiring real terminal

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Workspace topological sort has bugs, publishes in wrong order | Medium | Comprehensive test matrix covering linear, branched, and complex DAG topologies; cycle detection test |
| Parallel publishing causes race conditions or partial failure recovery is missing | Medium | Use sync.WaitGroup with explicit context cancellation; test phase rollback on partial failure |
| Lipgloss output breaks on narrow terminals or non-TTY CI | Medium | Test with multiple terminal widths (80, 120, 160 cols); detect TTY and degrade gracefully to plain text |
| Config precedence confusing or env vars not loaded correctly | Medium | Document precedence clearly; add `pheno config show` command to debug; test all precedence levels |

## Review Guidance

When reviewing WP07 completion:

1. **Publish Command**: Verify `pheno publish` detects language, selects correct adapter, builds successfully, and publishes (or dry-runs). Test workspace ordering.
2. **Promote Command**: Verify `pheno promote <channel>` validates transition, calls gate evaluation, shows results table, and publishes on pass. Test gate failure handling.
3. **Orchestrator**: Review topological sort logic; verify parallel publishing within phases; check cycle detection and partial failure handling.
4. **Lipgloss Output**: Render sample output at various terminal widths; verify colors and tables are readable; ensure non-TTY graceful degradation.
5. **Config System**: Check that `~/.config/pheno/config.toml` and `.pheno.toml` are both loaded; verify env var override works; test credential handling (ensure no secrets logged).
6. **Integration Tests**: Run full test suite; verify coverage >80%; check that all test scenarios (single/workspace, pass/fail, dry-run) are covered.

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created via /spec-kitty.tasks
- 2026-03-01T18:23:09Z – wp07-publish – shell_pid=18556 – lane=doing – Assigned agent via workflow command
- 2026-03-01T19:19:07Z – wp07-publish – shell_pid=18556 – lane=for_review – Ready for review
- 2026-03-01T19:26:02Z – wp07-publish – shell_pid=18556 – lane=for_review – Ready: publish and promote commands
- 2026-03-01T21:40:12Z – wp07-publish – shell_pid=18556 – lane=done – Implementation complete, reviewed
