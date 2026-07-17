---
work_package_id: WP01
title: CLI Scaffold & Adapter Interface
lane: "done"
dependencies: []
base_branch: main
base_commit: e75697d89280a7fb808c10da1002897d2a75ec4c
created_at: '2026-03-01T13:57:08.720265+00:00'
subtasks: [T001, T002, T003, T004, T005, T006]
phase: Phase 0 - Foundation
assignee: ''
agent: "claude-review"
shell_pid: "42741"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-03-01T13:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

## Overview

WP01 establishes the foundational CLI structure and adapter interface that all downstream work packages depend on. This phase creates the scaffolding, Cobra command skeleton, and the abstract RegistryAdapter contract that implementations (npm, PyPI, Cargo, Go, etc.) will fulfill.

---

## T001: Init Go Module & Core Dependencies

**Objective:** Initialize the Go project with required dependencies for CLI, TUI, and configuration management.

**Implementation Guidance:**

1. Create a new Go module at the root of the AgilePlus repository:
   ```bash
   cd /Users/kooshapari/CodeProjects/Phenotype/repos/AgilePlus
   go mod init github.com/KooshaPari/pheno-cli
   ```

2. Install core dependencies (Go 1.23+):
   - `go get github.com/spf13/cobra@v1.8+` — CLI command framework
   - `go get github.com/spf13/viper@v1.19+` — Configuration management
   - `go get github.com/charmbracelet/lipgloss@v1.0+` — Terminal styling
   - `go get github.com/charmbracelet/bubbles@v0.20+` — TUI components for future use

3. Run `go mod tidy` to validate the go.mod and go.sum files.

4. Create directory structure:
   ```
   .
   ├── cmd/
   │   ├── root.go
   │   └── main.go
   ├── internal/
   │   ├── adapters/
   │   ├── version/
   │   ├── detect/
   │   └── config/
   ├── go.mod
   ├── go.sum
   └── Makefile
   ```

5. Verify the module initializes correctly with `go mod verify`.

**Acceptance Criteria:**
- go.mod exists with correct module path and dependencies pinned
- `go mod verify` passes
- All four core packages are available and can be imported
- Directory structure matches specification

---

## T002: Create Cobra Root Command & Subcommand Stubs

**Objective:** Wire up the root command and all planned subcommands with placeholder implementations.

**Implementation Guidance:**

1. Create `cmd/root.go` with Cobra's root command:
   ```go
   package cmd

   import (
     "fmt"
     "github.com/spf13/cobra"
   )

   var rootCmd = &cobra.Command{
     Use:   "pheno",
     Short: "Phenotype release governance CLI",
     Long: `pheno is the command-line interface for org-wide release governance.
   It detects packages, calculates versions, and publishes across all registries.`,
     RunE: func(cmd *cobra.Command, args []string) error {
       return cmd.Help()
     },
   }

   func Execute() error {
     return rootCmd.Execute()
   }
   ```

2. Create subcommand stubs in separate files under `cmd/`:
   - `cmd/publish.go` — `publish` command
   - `cmd/promote.go` — `promote` command
   - `cmd/audit.go` — `audit` command
   - `cmd/bootstrap.go` — `bootstrap` command
   - `cmd/matrix.go` — `matrix` command
   - `cmd/config.go` — `config` command

3. Each subcommand stub prints "not yet implemented":
   ```go
   var publishCmd = &cobra.Command{
     Use:   "publish",
     Short: "Publish packages to their registries",
     RunE: func(cmd *cobra.Command, args []string) error {
       fmt.Println("publish command: not yet implemented")
       return nil
     },
   }

   func init() {
     rootCmd.AddCommand(publishCmd)
   }
   ```

4. Wire all subcommands in `cmd/root.go` via `init()` blocks (or centralized registration).

5. Create `cmd/main.go` (or let main.go live at root):
   ```go
   package main

   import (
     "github.com/KooshaPari/pheno-cli/cmd"
   )

   func main() {
     cmd.Execute()
   }
   ```

6. Build and test:
   ```bash
   go build -o pheno cmd/main.go
   ./pheno --help
   ./pheno publish --help
   ```

**Acceptance Criteria:**
- Root command displays help and does not error
- All 6 subcommands are registered and respond to `--help`
- `go build` succeeds without warnings
- Each subcommand prints "not yet implemented" when invoked

---

## T003: Define RegistryAdapter Interface & Error Types

**Objective:** Define the abstract contract that all registry implementations must fulfill.

**Implementation Guidance:**

1. Create `internal/adapters/adapter.go` with the interface and supporting types:

   ```go
   package adapters

   import "errors"

   // Package represents a detected package across all registries
   type Package struct {
     Name          string   // e.g., "my-package", "@scope/pkg", "my_package"
     Version       string   // semantic version from registry manifest
     ManifestPath  string   // path to manifest file (package.json, Cargo.toml, etc.)
     Registry      string   // "npm", "pypi", "crates", "go", "hex", "zig", "mojo"
     Private       bool     // private/unpublished flag
     Language      string   // "typescript", "python", "rust", "go", "elixir", "zig", "mojo"
     WorkspaceDeps []string // list of workspace member names this package depends on
   }

   // BuildResult represents the output of a build operation
   type BuildResult struct {
     ArtifactPath string // path to built artifact (tarball, wheel, .crate, etc.)
     Err          error
   }

   // PublishResult represents the outcome of publishing
   type PublishResult struct {
     RegistryURL string // URL to published package (e.g., npmjs.org link)
     Version     string // confirmed published version
     Err         error
   }

   // RegistryAdapter is the interface all registry implementations must satisfy
   type RegistryAdapter interface {
     // Detect scans the repository and returns all packages for this registry
     Detect(repoPath string) ([]Package, error)

     // Version calculates the next version based on channel and increment
     Version(baseVersion string, channel string, increment int) (string, error)

     // Build compiles/packages the artifact (e.g., npm pack, cargo package)
     Build(pkg Package) (*BuildResult, error)

     // Publish uploads to the registry (e.g., npm publish, cargo publish)
     Publish(pkg Package, version string, creds map[string]string) (*PublishResult, error)

     // Verify polls the registry to confirm the version is available
     Verify(pkg Package, version string) (bool, error)
   }

   // Error type definitions
   var (
     ErrRateLimited      = errors.New("registry rate limit exceeded")
     ErrAuth             = errors.New("authentication failed")
     ErrNetwork          = errors.New("network error communicating with registry")
     ErrAlreadyPublished = errors.New("version already published")
     ErrPrivatePackage   = errors.New("package is marked private")
     ErrDirtyWorkTree    = errors.New("work tree contains uncommitted changes")
     ErrNotSupported     = errors.New("operation not supported by this registry")
   )
   ```

2. Consider adding a registry factory function for future use:
   ```go
   type AdapterFactory interface {
     Create(registry string) (RegistryAdapter, error)
   }
   ```

3. Document the contract expectations:
   - **Detect**: Should be idempotent and fast (< 1s)
   - **Version**: Return string formatted per registry rules (no validation needed; validation is adapter's responsibility)
   - **Build**: Must create a valid artifact that can be published
   - **Publish**: Must handle auth and rate-limiting errors gracefully
   - **Verify**: Must poll until timeout; return false only after exhausting retries

**Acceptance Criteria:**
- Interface compiles without errors
- All 7 error types are defined and exported
- Package and Result structs are well-documented
- Interface can be imported by downstream adapters

---

## T004: Implement Version Calculator

**Objective:** Create versioning logic that handles registry-specific version formatting rules.

**Implementation Guidance:**

1. Create `internal/version/calculator.go`:

   ```go
   package version

   import (
     "fmt"
     "strings"
   )

   // CalculateVersion returns the next version string formatted per registry rules
   // baseVersion: semantic version without pre-release (e.g., "1.2.3")
   // channel: "alpha", "canary", "beta", "rc", "prod"
   // increment: sequence number for pre-releases (e.g., 1, 2, 3...)
   // registry: target registry (determines format)
   func CalculateVersion(baseVersion, channel string, increment int, registry string) (string, error) {
     base := strings.TrimPrefix(baseVersion, "v")

     switch registry {
     case "npm", "crates", "hex":
       return npmStyleVersion(base, channel, increment), nil
     case "go":
       return "v" + npmStyleVersion(base, channel, increment), nil
     case "pypi":
       return pypiStyleVersion(base, channel, increment), nil
     case "zig":
       return "v" + npmStyleVersion(base, channel, increment), nil
     case "mojo":
       return "", fmt.Errorf("Mojo has no package registry; versioning unsupported")
     default:
       return "", fmt.Errorf("unknown registry: %s", registry)
     }
   }

   // npmStyleVersion formats pre-release versions as {base}-{channel}.{increment}
   func npmStyleVersion(base, channel string, increment int) string {
     if channel == "prod" {
       return base
     }
     return fmt.Sprintf("%s-%s.%d", base, channel, increment)
   }

   // pypiStyleVersion formats per PEP 440 rules
   // alpha -> {base}a{increment}
   // canary -> {base}.dev{increment}
   // beta -> {base}b{increment}
   // rc -> {base}rc{increment}
   // prod -> {base}
   func pypiStyleVersion(base, channel string, increment int) string {
     switch channel {
     case "alpha":
       return fmt.Sprintf("%sa%d", base, increment)
     case "canary":
       return fmt.Sprintf("%s.dev%d", base, increment)
     case "beta":
       return fmt.Sprintf("%sb%d", base, increment)
     case "rc":
       return fmt.Sprintf("%src%d", base, increment)
     case "prod":
       return base
     default:
       return ""
     }
   }
   ```

2. Document the versioning rules in a comment block at the top of the file, keyed by registry.

3. Test edge cases: version "0.0.1" with all channels, version "1.0.0" with increments 1 and 5.

**Acceptance Criteria:**
- CalculateVersion handles all 7 registries
- PyPI formatting matches PEP 440
- npm/crates/hex format is consistent
- Go uses `v` prefix
- Zig uses git tag format `v{base}-{channel}.{increment}`
- Mojo returns an error
- No panics on edge cases

---

## T005: Implement Language Detection

**Objective:** Scan the repository and detect which package managers/languages are present, then delegate to the correct adapters.

**Implementation Guidance:**

1. Create `internal/detect/detector.go`:

   ```go
   package detect

   import (
     "os"
     "path/filepath"
     "github.com/KooshaPari/pheno-cli/internal/adapters"
   )

   type Language string

   const (
     Rust       Language = "rust"
     Python     Language = "python"
     TypeScript Language = "typescript"
     Go         Language = "go"
     Elixir     Language = "elixir"
     Zig        Language = "zig"
     Mojo       Language = "mojo"
   )

   // DetectLanguages scans the repo root for manifest files and returns detected languages
   func DetectLanguages(repoPath string) []Language {
     var detected []Language
     manifests := map[string]Language{
       "Cargo.toml":       Rust,
       "pyproject.toml":   Python,
       "package.json":     TypeScript,
       "go.mod":           Go,
       "mix.exs":          Elixir,
       "build.zig.zon":    Zig,
       "mojoproject.toml": Mojo,
     }

     for manifest, lang := range manifests {
       if _, err := os.Stat(filepath.Join(repoPath, manifest)); err == nil {
         detected = append(detected, lang)
       }
     }
     return detected
   }

   // DetectPackages scans the repo and returns all detected packages across all registries
   func DetectPackages(repoPath string) []adapters.Package {
     var packages []adapters.Package

     // TODO: instantiate adapters based on detected languages
     // For each adapter, call Detect(repoPath) and append results

     return packages
   }
   ```

2. Implement logic to instantiate adapters based on detected languages (can be a simple factory for now).

3. Document how workspace detection will work (workspaces = multiple manifests detected per language).

**Acceptance Criteria:**
- DetectLanguages returns correct list of languages
- All 7 language/manifest pairs are recognized
- DetectPackages can be called without panic
- Works on repos with zero detected languages (returns empty slice)

---

## T006: Unit Tests for Version Calculator

**Objective:** Provide comprehensive test coverage for version calculation across all registries and channels.

**Implementation Guidance:**

1. Create `internal/version/calculator_test.go` with table-driven tests:

   ```go
   package version

   import "testing"

   func TestCalculateVersion(t *testing.T) {
     tests := []struct {
       name      string
       base      string
       channel   string
       increment int
       registry  string
       want      string
       wantErr   bool
     }{
       // npm tests
       {"npm-prod", "1.2.3", "prod", 0, "npm", "1.2.3", false},
       {"npm-alpha-1", "1.2.3", "alpha", 1, "npm", "1.2.3-alpha.1", false},
       {"npm-canary-5", "1.2.3", "canary", 5, "npm", "1.2.3-canary.5", false},
       {"npm-beta-1", "1.2.3", "beta", 1, "npm", "1.2.3-beta.1", false},
       {"npm-rc-2", "1.2.3", "rc", 2, "npm", "1.2.3-rc.2", false},

       // Go tests
       {"go-prod", "1.2.3", "prod", 0, "go", "v1.2.3", false},
       {"go-alpha-1", "1.2.3", "alpha", 1, "go", "v1.2.3-alpha.1", false},

       // PyPI tests
       {"pypi-prod", "1.2.3", "prod", 0, "pypi", "1.2.3", false},
       {"pypi-alpha-1", "1.2.3", "alpha", 1, "pypi", "1.2.3a1", false},
       {"pypi-canary-1", "1.2.3", "canary", 1, "pypi", "1.2.3.dev1", false},
       {"pypi-beta-1", "1.2.3", "beta", 1, "pypi", "1.2.3b1", false},
       {"pypi-rc-2", "1.2.3", "rc", 2, "pypi", "1.2.3rc2", false},

       // Crates tests
       {"crates-prod", "1.2.3", "prod", 0, "crates", "1.2.3", false},
       {"crates-rc-1", "1.2.3", "rc", 1, "crates", "1.2.3-rc.1", false},

       // Hex tests
       {"hex-prod", "1.2.3", "prod", 0, "hex", "1.2.3", false},

       // Zig tests
       {"zig-prod", "1.2.3", "prod", 0, "zig", "v1.2.3", false},
       {"zig-alpha-1", "1.2.3", "alpha", 1, "zig", "v1.2.3-alpha.1", false},

       // Edge cases
       {"edge-0-0-1-prod", "0.0.1", "prod", 0, "npm", "0.0.1", false},
       {"edge-0-0-1-alpha", "0.0.1", "alpha", 1, "npm", "0.0.1-alpha.1", false},
       {"edge-1-0-0-rc-5", "1.0.0", "rc", 5, "npm", "1.0.0-rc.5", false},
       {"edge-v-prefix", "v1.2.3", "alpha", 1, "npm", "1.2.3-alpha.1", false},

       // Mojo error
       {"mojo-unsupported", "1.2.3", "prod", 0, "mojo", "", true},

       // Unknown registry
       {"unknown-registry", "1.2.3", "prod", 0, "unknown", "", true},
     }

     for _, tt := range tests {
       t.Run(tt.name, func(t *testing.T) {
         got, err := CalculateVersion(tt.base, tt.channel, tt.increment, tt.registry)
         if (err != nil) != tt.wantErr {
           t.Errorf("CalculateVersion() error = %v, wantErr %v", err, tt.wantErr)
           return
         }
         if got != tt.want {
           t.Errorf("CalculateVersion() = %v, want %v", got, tt.want)
         }
       })
     }
   }

   func BenchmarkCalculateVersion(b *testing.B) {
     for i := 0; i < b.N; i++ {
       CalculateVersion("1.2.3", "alpha", 1, "npm")
     }
   }
   ```

2. Ensure test coverage includes all combinations:
   - 7 registries × 5 channels = 35 core cases
   - Plus 5+ edge cases
   - Total: 40+ test cases

3. Run tests with `go test -v ./internal/version/...` and ensure all pass.

4. Generate coverage report: `go test -cover ./internal/version/...`

**Acceptance Criteria:**
- All 40+ test cases pass
- Coverage > 95%
- All registry/channel combinations are tested
- Edge cases (version 0.0.1, v-prefix, increment 5) are included
- Benchmark runs without error

## Activity Log

- 2026-03-01T13:57:09Z – claude-opus – shell_pid=21643 – lane=doing – Assigned agent via workflow command
- 2026-03-01T14:01:11Z – claude-opus – shell_pid=21643 – lane=for_review – Ready for review: CLI scaffold with adapter interface, version calculator (with tests), and language detector
- 2026-03-01T14:05:49Z – claude-review – shell_pid=42741 – lane=doing – Started review via workflow command
- 2026-03-01T14:06:10Z – claude-review – shell_pid=42741 – lane=done – Review passed: CLI scaffold, adapter interface, version calculator with 21 passing tests, language detector.
