---
work_package_id: WP06
title: Gate Evaluation Engine
lane: "done"
dependencies: [WP01]
base_branch: 002-org-wide-release-governance-dx-automation-WP01
base_commit: 50c5fe5c522c6cec9f56b7d88f9628b7ff80b5cc
created_at: '2026-03-01T15:30:09.801450+00:00'
subtasks: [T032, T033, T034, T035, T036, T037]
phase: Phase 2 - CLI Commands
assignee: ''
agent: "wp06-agent"
shell_pid: "11318"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP06 – Gate Evaluation Engine

## Objectives & Success Criteria

This work package implements the core gate evaluation engine that enforces quality gates based on channel promotion rules and risk profiles. Success means:

- Gate criteria data model is defined and integrated with the Package model
- Gate evaluator can execute configured commands and capture results
- Risk-based promotion rules enforce channel traversal constraints (low skips, high must traverse all tiers)
- Gate results are formatted as Lipgloss tables for CLI output and JSON for CI integration
- All default gate criteria are implemented and callable
- Unit tests cover risk-based skipping, invalid transitions, and report generation
- Implementation command: `spec-kitty implement WP06 --base WP01`

## Context & Constraints

- Builds on WP01 (Package Model & Multi-Language Registry Adapter): Uses Package and Channel definitions
- Must integrate with the 5-channel promotion model: Alpha → Canary → Beta → RC → Prod
- Risk profiles (Low, Medium, High) determine valid channel skipping rules
- Must support flexible gate criteria (both built-in and custom command-based)
- All gate commands are execd and stdout/stderr captured
- Output format must support both human (Lipgloss table) and machine (JSON) consumption
- No external gate service; all evaluation is local CLI execution

## Subtasks & Detailed Guidance

### Subtask T032 – Gate Criteria Data Model
- **Purpose**: Define the structure for configurable quality gates that can be evaluated per channel
- **Steps**:
  1. Create `internal/gate/criteria.go`
  2. Define the `Channel` type as a constant iota:
     ```go
     package gate

     type Channel int

     const (
         Alpha Channel = iota
         Canary
         Beta
         RC
         Prod
     )

     func (c Channel) String() string {
         switch c {
         case Alpha:
             return "alpha"
         case Canary:
             return "canary"
         case Beta:
             return "beta"
         case RC:
             return "rc"
         case Prod:
             return "prod"
         default:
             return "unknown"
         }
     }
     ```
  3. Define the `GateCriterion` struct with fields: ID (string, unique key), Name (human-readable), Command (shell command to execute), RequiredFrom (Channel where this gate activates)
     ```go
     type GateCriterion struct {
         ID           string
         Name         string
         Command      string
         RequiredFrom Channel
     }
     ```
  4. Create a map of default gate criteria:
     ```go
     var DefaultGates = map[string]GateCriterion{
         "lint": {
             ID:           "lint",
             Name:         "Code Linting",
             Command:      "mise run lint",
             RequiredFrom: Alpha,
         },
         "unit_tests": {
             ID:           "unit_tests",
             Name:         "Unit Tests",
             Command:      "mise run test",
             RequiredFrom: Alpha,
         },
         "integration_tests": {
             ID:           "integration_tests",
             Name:         "Integration Tests",
             Command:      "mise run test:integration",
             RequiredFrom: Canary,
         },
         "security_audit": {
             ID:           "security_audit",
             Name:         "Security Audit",
             Command:      "mise run audit",
             RequiredFrom: Canary,
         },
         "docs_build": {
             ID:           "docs_build",
             Name:         "Documentation Build",
             Command:      "mise run docs:build",
             RequiredFrom: Beta,
         },
         "rollback_plan": {
             ID:           "rollback_plan",
             Name:         "Rollback Plan Review",
             Command:      "",  // Special handling in T036
             RequiredFrom: RC,
         },
         "monitoring_dashboards": {
             ID:           "monitoring_dashboards",
             Name:         "Monitoring Dashboards",
             Command:      "",  // Special handling in T036
             RequiredFrom: Prod,
         },
     }
     ```
  5. Add a `GateSet` type to represent a collection of gates filtered for a target channel:
     ```go
     type GateSet struct {
         Criteria []GateCriterion
     }

     func FilterGatesForChannel(target Channel) GateSet {
         var filtered []GateCriterion
         for _, gate := range DefaultGates {
             if gate.RequiredFrom <= target {
                 filtered = append(filtered, gate)
             }
         }
         return GateSet{Criteria: filtered}
     }
     ```

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/criteria.go`
- **Parallel?**: No (prerequisite for T033–T036)
- **Notes**: Ensure Channel ordering is meaningful for gate filtering; GateCriterion struct must be serializable for config files (use struct tags for YAML/JSON)

### Subtask T033 – Gate Evaluator Implementation
- **Purpose**: Implement the core evaluation logic that executes each gate criterion and records results
- **Steps**:
  1. Create `internal/gate/evaluator.go`
  2. Define the `GateResult` struct to capture the outcome of a single criterion:
     ```go
     type GateResult struct {
         CriterionID string
         CriterionName string
         Passed      bool
         Output      string  // stdout + stderr
         DurationMs  int64
         Error       string  // non-empty if command failed
     }
     ```
  3. Define the `PromotionReport` struct summarizing the full evaluation:
     ```go
     type PromotionReport struct {
         Package       *Package
         FromChannel   Channel
         ToChannel     Channel
         Results       []GateResult
         Passed        bool
         EvaluatedAt   time.Time
         TotalDuration int64  // milliseconds
     }
     ```
  4. Implement the `Evaluate` function signature (see T034 for full logic):
     ```go
     type RiskProfile string

     const (
         RiskLow    RiskProfile = "low"
         RiskMedium RiskProfile = "medium"
         RiskHigh   RiskProfile = "high"
     )

     func Evaluate(ctx context.Context, pkg *Package, fromChannel, toChannel Channel, riskProfile RiskProfile) (*PromotionReport, error)
     ```
  5. Implement gate criterion execution:
     - Accept target channel, return filtered gate set
     - For each criterion, spawn `exec.CommandContext` with timeout (default 5m)
     - Capture combined stdout/stderr using `io.Pipe`
     - Record start/end times, calculate duration
     - Store result in `GateResult` struct
  6. Aggregate results into `PromotionReport` with overall `Passed` flag (true only if all required gates pass)
  7. Add helper function to retrieve a single gate result by criterion ID for error reporting

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/evaluator.go`
- **Parallel?**: No (builds on T032; T034 refines logic)
- **Notes**: Use context with timeout to prevent hanging gates; log each criterion execution; return error if Package is nil or channels invalid; consider stderr as non-fatal (only fail if command exits non-zero)

### Subtask T034 – Risk-Based Promotion Rules
- **Purpose**: Enforce risk-profile-dependent channel traversal constraints
- **Steps**:
  1. Add risk-based promotion validation logic to `Evaluate` function in T033
  2. Define channel transition rules:
     ```go
     // Low risk: can skip Canary, skip Beta, go directly Alpha → Beta or Beta → Prod
     // Medium risk: must do at minimum Canary → Beta → RC, cannot skip Beta
     // High risk: must traverse all 5 tiers in order: Alpha → Canary → Beta → RC → Prod
     ```
  3. Implement validation before gate evaluation:
     ```go
     func ValidateChannelTransition(from, to Channel, risk RiskProfile) error {
         // Check that 'from' < 'to' (monotonic progression)
         if from >= to {
             return fmt.Errorf("invalid transition: %s → %s (must go forward)", from, to)
         }

         // Calculate channel distance
         distance := to - from

         switch risk {
         case RiskLow:
             // Can skip up to 2 tiers (alpha→prod is allowed)
             if distance > 5 { // Actually all distances <= 4 for 5 tiers
                 return fmt.Errorf("low-risk skips exceeded")
             }
         case RiskMedium:
             // Must not skip Beta (index 2), so transitions like Alpha→RC invalid
             if from == Alpha && to > Beta {
                 return fmt.Errorf("medium-risk must include Beta gate")
             }
             if distance > 3 { // Max 3-tier jump
                 return fmt.Errorf("medium-risk skips exceeded")
             }
         case RiskHigh:
             // Must do sequential promotion: only allow distance == 1
             if distance != 1 {
                 return fmt.Errorf("high-risk requires sequential promotion")
             }
         }

         return nil
     }
     ```
  4. Call `ValidateChannelTransition` at the start of `Evaluate`, returning error if invalid
  5. Document the rules in code comments with examples
  6. Add integration points with `Evaluate` to check risk before running gates

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/evaluator.go` (additions)
- **Parallel?**: No (part of T033 flow)
- **Notes**: Reject invalid transitions early to fail fast; include helpful error messages; consider that "skip" means moving more than one tier; validate that risk profile is not empty string

### Subtask T035 – Structured Report Formatting
- **Purpose**: Generate human-readable Lipgloss tables and machine-readable JSON output for gate evaluation results
- **Steps**:
  1. Create `internal/gate/reporter.go`
  2. Implement `FormatLipglossTable` function to render `PromotionReport` as a Lipgloss table:
     ```go
     import "github.com/charmbracelet/lipgloss"

     func FormatLipglossTable(report *PromotionReport) string {
         // Create table with columns: Criterion, Status (✓/✗), Duration (ms), Output
         // Use Lipgloss colors: green for passed, red for failed
         // Example row: "lint    │ ✓ pass   │ 245ms   │ No issues found"
         // Summary row at end: "Overall │ PASSED   │ 3.2s    │"
     }
     ```
  3. Implement `FormatJSON` function to serialize `PromotionReport` as structured JSON:
     ```go
     func FormatJSON(report *PromotionReport) (string, error) {
         data := map[string]interface{}{
             "package":     report.Package.Name,
             "from_channel": report.FromChannel.String(),
             "to_channel":   report.ToChannel.String(),
             "passed":      report.Passed,
             "evaluated_at": report.EvaluatedAt.ISO8601(),
             "duration_ms": report.TotalDuration,
             "results": []map[string]interface{}{
                 // one entry per GateResult
             },
         }
         return json.MarshalIndent(data, "", "  ")
     }
     ```
  4. Add helper to render individual `GateResult` with status indicator (✓/✗)
  5. Handle very long output (cap at 100 chars or ellipsize)
  6. Ensure both formats are valid, parseable, and machine-consumable

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/reporter.go`
- **Parallel?**: Yes (after T033 completes)
- **Notes**: Use Lipgloss `table.New()` with style chain for borders and colors; JSON must be valid and escape special chars; ensure timestamps are RFC3339 format

### Subtask T036 – Default Gate Criterion Implementation
- **Purpose**: Implement built-in handlers for each default gate criterion, including special logic for file-based gates
- **Steps**:
  1. Extend `internal/gate/criteria.go` or create `internal/gate/builtin.go` for special handlers
  2. Implement each built-in gate as a callable command:
     ```
     lint                → mise run lint
     unit_tests          → mise run test
     integration_tests   → mise run test:integration
     security_audit      → mise run audit
     docs_build          → mise run docs:build
     rollback_plan       → custom logic (check for ROLLBACK.md)
     monitoring_dashboards → custom logic (check for monitoring config)
     ```
  3. For `rollback_plan`, add custom evaluation logic that:
     - Checks for existence of `ROLLBACK.md` in the package root
     - If file exists and is > 100 bytes, consider it a pass
     - Return appropriate GateResult with output explaining status
  4. For `monitoring_dashboards`, add custom evaluation logic that:
     - Checks for presence of monitoring config file (e.g., `prometheus.yml`, `datadog.json`, or similar)
     - Return pass if file exists; fail if missing
  5. In `Evaluate`, call special handler for rollback_plan and monitoring_dashboards instead of exec
  6. Document the special handling in code comments

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/criteria.go` or `internal/gate/builtin.go`
- **Parallel?**: Yes (after T033)
- **Notes**: Ensure rollback and monitoring checks are robust to different file locations; use package root as base directory; if a mise task doesn't exist, exec will fail naturally and that's acceptable

### Subtask T037 – Gate Evaluation Unit Tests
- **Purpose**: Comprehensive test coverage for gate evaluation logic, risk-based skipping, and invalid transitions
- **Steps**:
  1. Create `internal/gate/evaluator_test.go`
  2. Mock `exec.CommandContext` or use `testutil.MockExec` to avoid actual command execution:
     ```go
     type mockExecFunc func(ctx context.Context, name string, arg ...string) *exec.Cmd
     ```
  3. Test risk-based channel skipping:
     - Test low-risk: Alpha→Prod succeeds (skips all intermediate)
     - Test medium-risk: Alpha→Beta→RC succeeds; Alpha→RC fails (skips Beta)
     - Test high-risk: Alpha→Canary succeeds; Alpha→Beta fails (tries to skip)
  4. Test invalid channel transitions:
     - Regression: Prod→RC should fail (backward)
     - Same channel: Alpha→Alpha should fail
  5. Test report generation:
     - All gates pass → `report.Passed == true`
     - One gate fails → `report.Passed == false`
     - Duration calculation is accurate (use `time.Mock` or fixed durations)
  6. Test JSON/Lipgloss output is valid and parseable
  7. Test edge cases:
     - Empty gate set (no gates required for target channel)
     - Gate command timeout (context cancellation)
     - Gate command stderr (should not fail if exit code is 0)
  8. Add benchmarks for gate evaluation with varying numbers of gates

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/evaluator_test.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/gate/reporter_test.go`
- **Parallel?**: Yes (after T033–T036)
- **Notes**: Use `testing.T` and `testify/assert` for assertions; isolate mocks to avoid cross-test contamination; test both success and failure paths for each gate type

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Gate commands hang or timeout indefinitely | Medium | Set exec context timeout (5m default, configurable), use explicit cancellation |
| Risk-based rules are ambiguous or allow incorrect skips | Medium | Document rules clearly with examples in code; comprehensive test matrix covering all transitions |
| Lipgloss table formatting breaks on very long output | Low | Truncate/ellipsize long output; test with realistic command output sizes |
| Gate criteria hard-coded instead of extensible | Low | Design gate criteria as pluggable; document how to add custom criteria |

## Review Guidance

When reviewing WP06 completion:

1. **Model Integrity**: Verify that Channel is an ordered enum (Alpha < Canary < Beta < RC < Prod) and comparison operators work correctly
2. **Evaluator Logic**: Check that `Evaluate` function actually spawns subprocesses and captures output; verify context timeout is applied
3. **Risk Rules**: Step through test cases for each risk profile; confirm that low-risk can skip, medium-risk can't skip Beta, high-risk must be sequential
4. **Output Formats**: Render a sample Lipgloss table and JSON output; verify both are parseable and complete
5. **Default Gates**: Confirm all 7 default gates are defined and that rollback/monitoring have custom handlers
6. **Test Coverage**: Check that test file has >80% coverage for evaluator; all risk profiles tested; all channel transitions validated

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created via /spec-kitty.tasks
- 2026-03-01T15:30:10Z – wp06-agent – shell_pid=11318 – lane=doing – Assigned agent via workflow command
- 2026-03-01T19:25:57Z – wp06-agent – shell_pid=11318 – lane=for_review – Ready: gate evaluation engine
- 2026-03-01T19:26:19Z – wp06-agent – shell_pid=11318 – lane=for_review – Ready for review
- 2026-03-01T21:40:11Z – wp06-agent – shell_pid=11318 – lane=done – Implementation complete, reviewed
