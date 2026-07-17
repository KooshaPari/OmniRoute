---
work_package_id: WP08
title: CLI Audit & Matrix Commands
lane: "done"
dependencies:
- WP01
base_branch: 002-org-wide-release-governance-dx-automation-WP01
base_commit: 50c5fe5c522c6cec9f56b7d88f9628b7ff80b5cc
created_at: '2026-03-01T18:23:09.101661+00:00'
subtasks: [T044, T045, T046, T047, T048]
phase: Phase 2 - CLI Commands
assignee: ''
agent: "wp08-audit"
shell_pid: "18552"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP08 – CLI Audit & Matrix Commands

## Objectives & Success Criteria

This work package implements discovery, visibility, and reporting tools for multi-repository release status. Success means:

- `pheno audit` command scans repositories, detects packages, queries registries, and produces human-readable and JSON status tables
- `pheno matrix` command generates markdown release governance matrix matching org-wide release planning templates
- Repo discovery correctly identifies packages in subdirectories, respects exclusion patterns, and is configurable
- Audit table shows per-package status with version, channel, publication status, and links to registries
- Matrix markdown includes all required columns (Initiative, Channel, Layer, PR, Dependencies, Owner, Rollback Plan, Risk, Acceptance Criteria, Status, Blockers)
- Registry queries are memoized to avoid repeated lookups for the same package
- All tests cover repo discovery, audit output formats, and matrix generation
- Implementation command: `spec-kitty implement WP08 --base WP05`

## Context & Constraints

- Builds on WP01 (Package Model), WP02 (Registry Adapters), WP03 (Config), WP04 (Error Handling), WP05 (Workspace)
- Must support scanning from parent directory (default) or single repo (--repo flag)
- Must respect config `repos_dir` setting and honor .gitignore-like exclusion patterns
- Registry queries (checking published versions) are I/O-intensive; cache results per session
- Audit table is multi-format: table (human), JSON (CI), CSV (export)
- Matrix markdown must match `RELEASE_MATRIX_TEMPLATE.md` format from spec
- No external web calls; all package discovery is local filesystem and CLI tool invocation

## Subtasks & Detailed Guidance

### Subtask T044 – Audit Command Implementation
- **Purpose**: Create the `pheno audit` command to discover packages and query their registry status
- **Steps**:
  1. Create `cmd/audit.go` with Cobra command definition:
     ```go
     var auditCmd = &cobra.Command{
         Use:   "audit [flags]",
         Short: "Audit package registry status",
         Long:  "Scan repositories and query registries to show publication status",
         RunE:  runAudit,
     }

     func init() {
         auditCmd.Flags().StringVar(&reposDir, "repos-dir", "", "Directory containing repositories (default: parent dir)")
         auditCmd.Flags().StringVar(&singleRepo, "repo", "", "Audit a single repository")
         auditCmd.Flags().StringVar(&outputFormat, "format", "table", "Output format: table|json|csv")
         rootCmd.AddCommand(auditCmd)
     }
     ```
  2. Implement `runAudit` function flow:
     - Determine scan root (use --repo if provided, else --repos-dir or config.repos_dir)
     - Call `discover.FindRepositories(reposDir)` to list all repos (see T047)
     - For each repo: call package discovery from WP01
     - For each package: query registry adapter to get current published versions
     - Build audit status table with results (see T045)
     - Render output in requested format (table/json/csv)
  3. Error handling:
     - If no repos found: warn "No repositories found in repos_dir"
     - If repo discovery fails: error with cause
     - If registry query times out: mark package as "unknown" with note
  4. Output success: show table or JSON depending on format flag
  5. Support progress indicator for long scans (spinner per repo being scanned)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/audit.go`
- **Parallel?**: No (prerequisite for T045)
- **Notes**: Reuse config system from WP07; handle missing repos gracefully; ensure registry queries use caching (see T048)

### Subtask T045 – Audit Status Table Formatting
- **Purpose**: Implement Lipgloss table and alternate format renderers for audit results
- **Steps**:
  1. Create `internal/audit/formatter.go` to define output structures
  2. Define AuditResult struct to capture per-package status:
     ```go
     type AuditResult struct {
         Package        *Package
         Language       string
         Registry       string
         Channel        string  // Latest published channel
         Version        string  // Latest published version
         RegistryURL    string  // Link to package in registry
         Status         string  // "published" | "unpublished" | "blocked"
         LastPublished  time.Time
         Error          string  // Non-empty if query failed
     }

     type AuditReport struct {
         Timestamp  time.Time
         Repos      int
         Packages   int
         Results    []AuditResult
         Duration   time.Duration
     }
     ```
  3. Implement `FormatLipglossTable` function:
     ```go
     func FormatLipglossTable(report *AuditReport) string {
         // Create Lipgloss table with columns:
         // Package | Language | Registry | Channel | Version | Status | URL
         //
         // Color coding:
         // - Channel: green (prod), yellow (rc/beta), orange (canary/alpha), gray (unpublished)
         // - Status: ✓ green, ✗ red, ? yellow
         //
         // Example row:
         // auth-service | go | custom-pkg | prod | v1.2.3 | ✓ | https://pkg.example.com/auth-service
     }
     ```
  4. Implement `FormatJSON` function:
     ```go
     func FormatJSON(report *AuditReport) (string, error) {
         // Serialize AuditReport as pretty-printed JSON
         // Include metadata: timestamp, scan duration, counts
     }
     ```
  5. Implement `FormatCSV` function:
     ```go
     func FormatCSV(report *AuditReport) (string, error) {
         // CSV format with headers: Package, Language, Registry, Channel, Version, Status, URL
         // Escape special chars in package names
     }
     ```
  6. Add summary section to Lipgloss output showing totals:
     - Total repos scanned
     - Total packages found
     - Published (prod): N, Staged (beta/rc): N, Alpha (alpha/canary): N, Unpublished: N
     - Scan duration

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/audit/formatter.go`
- **Parallel?**: Yes (after T044)
- **Notes**: Use consistent color palette from WP07; ensure CSV escaping is RFC 4180 compliant; truncate long URLs with ellipsis in table view

### Subtask T046 – Release Matrix Generation
- **Purpose**: Generate markdown-formatted release governance matrix matching org template
- **Steps**:
  1. Create `cmd/matrix.go` with Cobra command definition:
     ```go
     var matrixCmd = &cobra.Command{
         Use:   "matrix [flags]",
         Short: "Generate release governance matrix",
         Long:  "Generate markdown release matrix from spec and config",
         RunE:  runMatrix,
     }

     func init() {
         matrixCmd.Flags().StringVar(&outputFile, "output", "", "Output file (default: stdout)")
         matrixCmd.Flags().StringVar(&specFile, "spec", "", "Path to spec file (auto-detect if omitted)")
         rootCmd.AddCommand(matrixCmd)
     }
     ```
  2. Implement `runMatrix` function flow:
     - Load spec from spec file or auto-detect (look for `*-spec.md` in current dir)
     - Parse spec to extract work packages and initiatives (if not already in structured format)
     - Call `FindRepositories` to scan for packages
     - For each package: look up metadata (channel, version, owner, risk profile)
     - Build matrix data structure (see T046 table structure below)
     - Render markdown table
     - Write to file or stdout
  3. Markdown table structure matching RELEASE_MATRIX_TEMPLATE.md:
     ```markdown
     | Initiative | Channel | Layer | PR | Depends-On | Owner | Rollback Plan | Risk | Acceptance Criteria | Status | Blockers |
     |---|---|---|---|---|---|---|---|---|---|---|
     | WP01 - Package Model | alpha | core | | | @user | | low | model complete, tests pass | in progress | none |
     | WP02 - Registry Adapters | alpha | core | #123 | WP01 | @user | | medium | 4 adapters, integration tests pass | pending | none |
     ```
  4. Auto-populate fields from config and discovery:
     - Initiative: from spec WP/phase
     - Channel: from current package status (alpha/beta/prod)
     - Layer: infer from dependencies (core, platform, app)
     - PR: from git (look for open PR with WP keyword)
     - Depends-On: from spec dependencies
     - Owner: from .pheno.toml or config default
     - Risk: from config risk_profile
     - Status: from audit (published/pending)
  5. Support manual overrides via config file (allow editing matrix before final render)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/matrix.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/matrix/generator.go`
- **Parallel?**: Yes (after T044)
- **Notes**: Auto-detect spec file by scanning cwd and parent dirs; support both `.md` and `.json` spec formats; document template column meanings in inline comments

### Subtask T047 – Repository Discovery Engine
- **Purpose**: Implement filesystem scanning to locate repositories and filter them based on rules
- **Steps**:
  1. Create `internal/discover/repos.go` with discovery logic:
     ```go
     type RepositoryInfo struct {
         Path     string  // Absolute path to repo root
         Name     string  // Directory name
         HasGit   bool    // .git folder present
         Packages []*Package
     }

     func FindRepositories(rootDir string) ([]RepositoryInfo, error) {
         // Scan rootDir for subdirectories matching repo patterns
         // Return list of RepositoryInfo
     }
     ```
  2. Implement repo detection heuristics:
     - Must contain one of: `.git`, `package.json`, `setup.py`, `Cargo.toml`, `go.mod`, `.gitignore`
     - May be single repo (has manifest) or monorepo (subdirs have manifests)
  3. Implement exclusion rules (skip scanning):
     - Hidden directories (start with `.`)
     - `node_modules`, `venv`, `target`, `vendor`, `dist`, `build`, `.next`, `__pycache__`
     - Worktree directories (match pattern `*-wtrees/*`)
     - Directories listed in config `exclude_dirs`
  4. Implement recursive scanning:
     - If directory has multiple manifests, treat as single repo
     - If directory has subdirs with manifests, recurse (monorepo case)
     - Configurable max depth (default: 3)
  5. Handle symlinks: follow them (configurable)
  6. Caching: memoize results per session to avoid re-scanning

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/discover/repos.go`
- **Parallel?**: No (prerequisite for T044)
- **Notes**: Use `filepath.WalkDir` for efficient directory traversal; respect `.gitignore` patterns if available; ensure symlink handling is safe (prevent infinite loops)

### Subtask T048 – Audit Tests & Caching
- **Purpose**: Comprehensive tests for discovery, audit formatting, and registry query caching
- **Steps**:
  1. Create `internal/discover/repos_test.go`:
     ```go
     func TestFindRepositories(t *testing.T) {
         // Create temp dir with nested repos
         // Test that repos are discovered correctly
         // Test that hidden dirs and node_modules are skipped
         // Test monorepo detection
     }

     func TestRepositoryExclusion(t *testing.T) {
         // Test that *-wtrees directories are skipped
         // Test custom exclude_dirs config
         // Test that .git is detected correctly
     }
     ```
  2. Create `internal/audit/formatter_test.go`:
     ```go
     func TestFormatLipglossTable(t *testing.T) {
         // Create sample AuditReport with mixed statuses
         // Render table and verify output contains all columns
         // Verify color codes are present
     }

     func TestFormatJSON(t *testing.T) {
         // Render JSON and verify it's valid and parseable
         // Verify all fields present
     }

     func TestFormatCSV(t *testing.T) {
         // Render CSV and verify RFC 4180 compliance
         // Test escaping of special chars
     }
     ```
  3. Create `cmd/audit_test.go`:
     ```go
     func TestAuditCommand(t *testing.T) {
         // Setup: temp workspace with repos
         // Mock registry queries
         // Run "pheno audit --format table"
         // Verify output contains expected packages and statuses
     }
     ```
  4. Implement registry query caching:
     ```go
     type QueryCache struct {
         mu    sync.RWMutex
         cache map[string]*RegistryQueryResult
     }

     func (qc *QueryCache) Get(pkg *Package) (*RegistryQueryResult, error) {
         key := pkg.Language + ":" + pkg.Name
         qc.mu.RLock()
         if result, ok := qc.cache[key]; ok {
             qc.mu.RUnlock()
             return result, nil
         }
         qc.mu.RUnlock()

         // Query registry
         result := adapter.Query(pkg)
         qc.mu.Lock()
         qc.cache[key] = result
         qc.mu.Unlock()
         return result, nil
     }
     ```
  5. Test caching behavior: verify cache hits and misses
  6. Ensure tests run in <10 seconds (mock all registry calls)

- **Files**: `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/discover/repos_test.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/internal/audit/formatter_test.go`, `/Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus/cmd/audit_test.go`
- **Parallel?**: Yes (after T044–T046)
- **Notes**: Use testutil package for common fixtures; mock `registry.Adapter` to return predictable results; isolate cache between tests; test both hit and miss paths

## Risks & Mitigations

| Risk | Likelihood | Mitigation |
|------|------------|-----------|
| Repo discovery too slow for large directory trees | Medium | Implement caching, max depth limit, and early termination; add progress spinner for long scans |
| Registry queries cause timeout and block audit | Medium | Implement query timeout (5s default), cache results, mark failed queries as "unknown" and continue |
| Audit output table too wide for terminal | Low | Truncate columns intelligently, wrap long text, test at 80/120/160 char widths |
| Matrix generation has incomplete or incorrect data | Medium | Validate that all matrix columns are populated; provide manual override mechanism via config |

## Review Guidance

When reviewing WP08 completion:

1. **Audit Command**: Verify `pheno audit` scans repos, discovers packages, queries registries, and produces correct output format. Test all three output formats (table, JSON, CSV).
2. **Audit Table**: Render sample output with mixed publish statuses; verify colors are readable; check that URLs are correct and truncated appropriately.
3. **Matrix Generation**: Generate markdown matrix and compare to RELEASE_MATRIX_TEMPLATE.md format. Verify all columns present and populated.
4. **Repo Discovery**: Create test directory structure with hidden dirs, node_modules, worktrees, and verify correct repos are found. Test monorepo detection.
5. **Caching**: Verify registry query cache works by running audit twice and checking that second run is faster; verify cache keys are correct.
6. **Tests**: Run full test suite; verify coverage >80%; check that all output formats tested and all discovery patterns covered.

## Activity Log

- 2026-03-01T13:00:00Z – system – lane=planned – Prompt created via /spec-kitty.tasks
- 2026-03-01T18:23:09Z – wp08-audit – shell_pid=18552 – lane=doing – Assigned agent via workflow command
- 2026-03-01T19:26:23Z – wp08-audit – shell_pid=18552 – lane=for_review – Ready for review
- 2026-03-01T20:27:26Z – wp08-audit – shell_pid=18552 – lane=for_review – Ready: audit and matrix commands
- 2026-03-01T21:40:13Z – wp08-audit – shell_pid=18552 – lane=done – Implementation complete, reviewed
