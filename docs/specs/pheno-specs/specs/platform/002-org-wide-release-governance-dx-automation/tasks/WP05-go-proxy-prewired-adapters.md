---
work_package_id: WP05
title: Go Proxy + Pre-Wired Adapters
lane: "done"
dependencies: [WP01]
base_branch: 002-org-wide-release-governance-dx-automation-WP01
base_commit: 50c5fe5c522c6cec9f56b7d88f9628b7ff80b5cc
created_at: '2026-03-01T14:15:04.616850+00:00'
subtasks: [T025, T026, T027, T028, T029, T030, T031]
phase: Phase 1 - Adapters
assignee: ''
agent: "claude-impl"
shell_pid: "83535"
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

WP05 implements a fully functional Go proxy adapter and pre-wired stubs for Hex (Elixir), Zig, and Mojo. The Go adapter handles VCS-based publishing (git tags), while stub adapters provide graceful "not yet supported" messages, setting up the interface for future implementation.

**Implementation Command:** `spec-kitty implement WP05 --base WP01`

---

## T025: Implement Go Module Detection

**Objective:** Parse go.mod to detect Go modules and extract module path and version information.

**Implementation Guidance:**

1. Create `internal/adapters/goproxy.go` with Go module detection:

   ```go
   package adapters

   import (
     "bufio"
     "fmt"
     "os"
     "path/filepath"
     "strings"
   )

   type GoProxyAdapter struct{}

   func (a *GoProxyAdapter) Detect(repoPath string) ([]Package, error) {
     modFile := filepath.Join(repoPath, "go.mod")
     data, err := os.ReadFile(modFile)
     if err != nil {
       return nil, fmt.Errorf("failed to read go.mod: %w", err)
     }

     // Parse go.mod to extract module path and version
     var modulePath string
     var version string

     scanner := bufio.NewScanner(strings.NewReader(string(data)))
     for scanner.Scan() {
       line := strings.TrimSpace(scanner.Text())

       // Extract module path from "module github.com/owner/project"
       if strings.HasPrefix(line, "module ") {
         modulePath = strings.TrimPrefix(line, "module ")
         modulePath = strings.TrimSpace(modulePath)
         break
       }
     }

     if modulePath == "" {
       return nil, fmt.Errorf("no module directive found in go.mod")
     }

     // For Go, version comes from VCS tags (git tags), not go.mod
     // Extract from go.sum or default to "0.0.0-dev" for now
     version = "0.0.0-dev" // This will be overridden by version calculation

     pkg := Package{
       Name:         modulePath,
       Version:      version,
       ManifestPath: modFile,
       Registry:     "go",
       Private:      false, // Go doesn't have a concept of private modules in the same way
       Language:     "go",
     }

     return []Package{pkg}, nil
   }
   ```

2. Parse go.mod to extract the `module` directive.

3. Note: Go versions are determined by git tags, not by go.mod version field.

4. Handle edge cases:
   - Missing module directive (error)
   - Multiple modules (unlikely in go.mod, but handle gracefully)

**Acceptance Criteria:**
- Detect reads go.mod correctly
- Extracts module path from `module` directive
- Returns single Package with Registry="go"
- Error if go.mod is missing or invalid
- Handles standard and non-standard module paths

---

## T026: Implement Go Publish (Git Tags)

**Objective:** Implement Go proxy publishing via git tags and push to origin.

**Implementation Guidance:**

1. Add the Build, Publish, and Version methods to GoProxyAdapter:

   ```go
   import (
     "bytes"
     "os"
     "os/exec"
     "time"
   )

   func (a *GoProxyAdapter) Version(baseVersion string, channel string, increment int) (string, error) {
     // Use the version calculator from WP01, which adds "v" prefix for Go
     version, err := CalculateVersion(baseVersion, channel, increment, "go")
     if err != nil {
       return "", err
     }
     return version, nil
   }

   func (a *GoProxyAdapter) Build(pkg Package) (*BuildResult, error) {
     // For Go, there's no build artifact — publishing is VCS-based
     // Return success with empty artifact path
     return &BuildResult{ArtifactPath: "", Err: nil}, nil
   }

   func (a *GoProxyAdapter) Publish(pkg Package, version string, creds map[string]string) (*PublishResult, error) {
     // Publishing to Go proxy = creating a git tag and pushing to origin

     // Create annotated git tag
     cmd := exec.Command(
       "git", "tag",
       "-a", version,
       "-m", fmt.Sprintf("Release %s", version),
     )

     var stderr bytes.Buffer
     cmd.Stderr = &stderr

     if err := cmd.Run(); err != nil {
       return &PublishResult{
         Err: fmt.Errorf("failed to create git tag: %w\nstderr: %s", err, stderr.String()),
       }, nil
     }

     // Push tag to origin
     cmd = exec.Command("git", "push", "origin", version)
     cmd.Stderr = &stderr

     if err := cmd.Run(); err != nil {
       // Attempt to delete the tag if push failed
       exec.Command("git", "tag", "-d", version).Run()

       return &PublishResult{
         Err: fmt.Errorf("failed to push git tag: %w\nstderr: %s", err, stderr.String()),
       }, nil
     }

     // Return the module path and version for reference
     return &PublishResult{
       RegistryURL: fmt.Sprintf("https://pkg.go.dev/%s@%s", pkg.Name, version),
       Version:     version,
       Err:         nil,
     }, nil
   }
   ```

2. Publishing workflow:
   - Create annotated git tag: `git tag -a v{version} -m "Release v{version}"`
   - Push tag to origin: `git push origin v{version}`
   - If push fails, delete the tag to clean up

3. Go proxy fetches from the VCS automatically (GitHub, GitLab, etc.) based on the module path.

4. Verify that the git repository is clean before tagging.

**Acceptance Criteria:**
- Version method returns `v` prefixed version
- Build returns empty artifact (no build step needed)
- Publish creates annotated git tag
- Publish pushes tag to origin
- Tag is deleted if push fails
- RegistryURL points to pkg.go.dev
- Error handling for tag creation/push failures

---

## T027: Implement Go Verification (Proxy Polling)

**Objective:** Poll the Go proxy API to confirm version availability.

**Implementation Guidance:**

1. Add the Verify method:

   ```go
   import (
     "net/http"
   )

   func (a *GoProxyAdapter) Verify(pkg Package, version string) (bool, error) {
     // Go proxy API: https://proxy.golang.org/{module}/@v/v{version}.info
     url := fmt.Sprintf("https://proxy.golang.org/%s/@v/%s.info", pkg.Name, version)

     pollInterval := time.Duration(10) * time.Second
     maxWait := time.Duration(5) * time.Minute
     elapsed := time.Duration(0)

     for elapsed < maxWait {
       resp, err := http.Get(url)
       if err != nil {
         // Network error; retry
         time.Sleep(pollInterval)
         elapsed += pollInterval
         continue
       }

       if resp.StatusCode == http.StatusOK {
         resp.Body.Close()
         return true, nil // Found!
       }

       if resp.StatusCode == http.StatusNotFound {
         // Not yet available; retry
         resp.Body.Close()
         time.Sleep(pollInterval)
         elapsed += pollInterval
         continue
       }

       // Unexpected status
       resp.Body.Close()
       return false, fmt.Errorf("unexpected registry response: %d", resp.StatusCode)
     }

     return false, fmt.Errorf("version not available after %v", maxWait)
   }
   ```

2. Use the official Go proxy API: `https://proxy.golang.org/{module}/@v/{version}.info`

3. Poll every 10 seconds, timeout after 5 minutes.

4. Go proxy is typically faster than npm; 10s interval is appropriate.

**Acceptance Criteria:**
- Verify polls the Go proxy API
- Returns true when version is found (200 status)
- Returns false and error after 5-minute timeout
- Respects 10-second polling interval
- Handles network errors gracefully

---

## T028: Implement Hex (Elixir) Stub

**Objective:** Detect Elixir mix.exs packages and provide graceful "not yet supported" messages for Build/Publish/Verify.

**Implementation Guidance:**

1. Create `internal/adapters/hex.go` stub:

   ```go
   package adapters

   import (
     "fmt"
     "os"
     "path/filepath"
     "strings"
   )

   type HexAdapter struct{}

   func (a *HexAdapter) Detect(repoPath string) ([]Package, error) {
     mixExsPath := filepath.Join(repoPath, "mix.exs")
     data, err := os.ReadFile(mixExsPath)
     if err != nil {
       return nil, fmt.Errorf("failed to read mix.exs: %w", err)
     }

     // Parse mix.exs (Elixir DSL) to extract project name and version
     // This is a simplified parser; a full Elixir parser would be more robust

     content := string(data)

     // Look for: version: "1.2.3"
     var version string
     lines := strings.Split(content, "\n")
     for _, line := range lines {
       if strings.Contains(line, "version:") {
         // Extract version string
         parts := strings.Split(line, `"`)
         if len(parts) > 1 {
           version = parts[1]
           break
         }
       }
     }

     // Look for: package: [name: "hex_package_name"]
     var name string
     for _, line := range lines {
       if strings.Contains(line, "name:") && strings.Contains(line, `"`) {
         parts := strings.Split(line, `"`)
         if len(parts) > 1 {
           name = parts[1]
           break
         }
       }
     }

     if name == "" || version == "" {
       return nil, fmt.Errorf("could not extract name and version from mix.exs")
     }

     pkg := Package{
       Name:         name,
       Version:      version,
       ManifestPath: mixExsPath,
       Registry:     "hex",
       Private:      false,
       Language:     "elixir",
     }

     return []Package{pkg}, nil
   }

   func (a *HexAdapter) Version(baseVersion string, channel string, increment int) (string, error) {
     // Use the version calculator from WP01
     version, err := CalculateVersion(baseVersion, channel, increment, "hex")
     if err != nil {
       return "", err
     }
     return version, nil
   }

   func (a *HexAdapter) Build(pkg Package) (*BuildResult, error) {
     return &BuildResult{
       ArtifactPath: "",
       Err:          fmt.Errorf("%w: Hex.pm publishing not yet supported — pre-wired for future implementation", ErrNotSupported),
     }, nil
   }

   func (a *HexAdapter) Publish(pkg Package, version string, creds map[string]string) (*PublishResult, error) {
     return &PublishResult{
       Err: fmt.Errorf("%w: Hex.pm publishing not yet supported — pre-wired for future implementation", ErrNotSupported),
     }, nil
   }

   func (a *HexAdapter) Verify(pkg Package, version string) (bool, error) {
     return false, fmt.Errorf("%w: Hex.pm verification not yet supported — pre-wired for future implementation", ErrNotSupported)
   }
   ```

2. Detect implementation:
   - Parse mix.exs for `version: "..."` and `package: [name: "..."]`
   - Note: A full Elixir parser would use an Elixir runtime or proper parser library; this is a simplified regex-based approach
   - Can be improved in future work

3. Build/Publish/Verify return ErrNotSupported with guidance message.

4. The message indicates this is pre-wired for future implementation (not abandoned).

**Acceptance Criteria:**
- Detect reads mix.exs and extracts name and version
- Version method returns correct format
- Build/Publish/Verify return ErrNotSupported gracefully
- Error messages are clear and actionable
- No panics on missing mix.exs

---

## T029: Implement Zig Stub

**Objective:** Detect Zig build.zig.zon packages and provide graceful "not yet supported" messages.

**Implementation Guidance:**

1. Create `internal/adapters/zig.go` stub:

   ```go
   package adapters

   import (
     "fmt"
     "os"
     "path/filepath"
     "strings"
   )

   type ZigAdapter struct{}

   func (a *ZigAdapter) Detect(repoPath string) ([]Package, error) {
     buildZigZonPath := filepath.Join(repoPath, "build.zig.zon")
     data, err := os.ReadFile(buildZigZonPath)
     if err != nil {
       return nil, fmt.Errorf("failed to read build.zig.zon: %w", err)
     }

     content := string(data)

     // Parse build.zig.zon (Zig package manifest)
     // Look for: .name = "my-package" and .version = "1.2.3"
     var name, version string

     lines := strings.Split(content, "\n")
     for _, line := range lines {
       if strings.Contains(line, ".name") && strings.Contains(line, `"`) {
         parts := strings.Split(line, `"`)
         if len(parts) > 1 {
           name = parts[1]
         }
       }
       if strings.Contains(line, ".version") && strings.Contains(line, `"`) {
         parts := strings.Split(line, `"`)
         if len(parts) > 1 {
           version = parts[1]
         }
       }
     }

     if name == "" || version == "" {
       return nil, fmt.Errorf("could not extract name and version from build.zig.zon")
     }

     pkg := Package{
       Name:         name,
       Version:      version,
       ManifestPath: buildZigZonPath,
       Registry:     "zig",
       Private:      false,
       Language:     "zig",
     }

     return []Package{pkg}, nil
   }

   func (a *ZigAdapter) Version(baseVersion string, channel string, increment int) (string, error) {
     // Use the version calculator from WP01, which uses git tag format for Zig
     version, err := CalculateVersion(baseVersion, channel, increment, "zig")
     if err != nil {
       return "", err
     }
     return version, nil
   }

   func (a *ZigAdapter) Build(pkg Package) (*BuildResult, error) {
     return &BuildResult{
       ArtifactPath: "",
       Err:          fmt.Errorf("%w: Zig package publishing not yet supported — pre-wired for future implementation", ErrNotSupported),
     }, nil
   }

   func (a *ZigAdapter) Publish(pkg Package, version string, creds map[string]string) (*PublishResult, error) {
     return &PublishResult{
       Err: fmt.Errorf("%w: Zig package publishing not yet supported — pre-wired for future implementation", ErrNotSupported),
     }, nil
   }

   func (a *ZigAdapter) Verify(pkg Package, version string) (bool, error) {
     return false, fmt.Errorf("%w: Zig package verification not yet supported — pre-wired for future implementation", ErrNotSupported)
   }
   ```

2. Detect implementation:
   - Parse build.zig.zon for `.name = "..."` and `.version = "..."`
   - Simplified parser; can be improved later

3. Version method returns git tag format: `v{base}-{channel}.{increment}`

4. Build/Publish/Verify return ErrNotSupported.

5. Note: Zig's registry is still evolving; this adapter is ready for future integration.

**Acceptance Criteria:**
- Detect reads build.zig.zon and extracts name and version
- Version method returns git tag format
- Build/Publish/Verify return ErrNotSupported gracefully
- Error messages are clear
- No panics on missing build.zig.zon

---

## T030: Implement Mojo Stub

**Objective:** Detect Mojo mojoproject.toml packages and provide graceful "not yet supported" messages.

**Implementation Guidance:**

1. Create `internal/adapters/mojo.go` stub:

   ```go
   package adapters

   import (
     "fmt"
     "os"
     "path/filepath"
     "strings"
     "github.com/pelletier/go-toml/v2"
   )

   type MojoAdapter struct{}

   type mojoprojectToml struct {
     Project struct {
       Name    string `toml:"name"`
       Version string `toml:"version"`
     } `toml:"project"`
   }

   func (a *MojoAdapter) Detect(repoPath string) ([]Package, error) {
     mojoProjectPath := filepath.Join(repoPath, "mojoproject.toml")
     data, err := os.ReadFile(mojoProjectPath)
     if err != nil {
       return nil, fmt.Errorf("failed to read mojoproject.toml: %w", err)
     }

     var mojo mojoprojectToml
     if err := toml.Unmarshal(data, &mojo); err != nil {
       return nil, fmt.Errorf("failed to parse mojoproject.toml: %w", err)
     }

     if mojo.Project.Name == "" || mojo.Project.Version == "" {
       return nil, fmt.Errorf("could not extract name and version from mojoproject.toml")
     }

     pkg := Package{
       Name:         mojo.Project.Name,
       Version:      mojo.Project.Version,
       ManifestPath: mojoProjectPath,
       Registry:     "mojo",
       Private:      false,
       Language:     "mojo",
     }

     return []Package{pkg}, nil
   }

   func (a *MojoAdapter) Version(baseVersion string, channel string, increment int) (string, error) {
     // Mojo doesn't support versioning in the same way
     return "", fmt.Errorf("No Mojo package registry available; versioning unsupported")
   }

   func (a *MojoAdapter) Build(pkg Package) (*BuildResult, error) {
     return &BuildResult{
       ArtifactPath: "",
       Err:          fmt.Errorf("%w: No Mojo package registry available", ErrNotSupported),
     }, nil
   }

   func (a *MojoAdapter) Publish(pkg Package, version string, creds map[string]string) (*PublishResult, error) {
     return &PublishResult{
       Err: fmt.Errorf("%w: No Mojo package registry available", ErrNotSupported),
     }, nil
   }

   func (a *MojoAdapter) Verify(pkg Package, version string) (bool, error) {
     return false, fmt.Errorf("%w: No Mojo package registry available", ErrNotSupported)
   }
   ```

2. Detect implementation:
   - Parse mojoproject.toml for `[project] name = "..." version = "..."`
   - Use TOML parser (same as PyPI)

3. Note: Mojo is a newer language and does not yet have an official package registry.

4. All operations return ErrNotSupported with clear message about missing registry.

5. Version method also returns error (versioning not meaningful without a registry).

**Acceptance Criteria:**
- Detect reads mojoproject.toml and extracts name and version
- Version method returns error with clear message
- Build/Publish/Verify return ErrNotSupported gracefully
- Error messages indicate no registry is available
- No panics on missing mojoproject.toml

---

## T031: Unit Tests for Go & Stub Adapters

**Objective:** Provide comprehensive test coverage for Go adapter and all stub adapters.

**Implementation Guidance:**

1. Create `internal/adapters/goproxy_test.go`:

   ```go
   package adapters

   import (
     "os"
     "path/filepath"
     "testing"
   )

   func TestGoProxyDetect(t *testing.T) {
     tests := []struct {
       name    string
       setup   func(tmpdir string) error
       wantLen int
       wantErr bool
     }{
       {
         name: "detect-go-module",
         setup: func(tmpdir string) error {
           content := `module github.com/owner/project

   go 1.23`
           return os.WriteFile(filepath.Join(tmpdir, "go.mod"), []byte(content), 0644)
         },
         wantLen: 1,
         wantErr: false,
       },
       {
         name: "missing-go-mod",
         setup: func(tmpdir string) error {
           return nil // Don't create go.mod
         },
         wantLen: 0,
         wantErr: true,
       },
     }

     adapter := &GoProxyAdapter{}

     for _, tt := range tests {
       t.Run(tt.name, func(t *testing.T) {
         tmpdir := t.TempDir()
         if err := tt.setup(tmpdir); err != nil {
           t.Fatalf("setup failed: %v", err)
         }

         got, err := adapter.Detect(tmpdir)
         if (err != nil) != tt.wantErr {
           t.Errorf("Detect() error = %v, wantErr %v", err, tt.wantErr)
           return
         }
         if len(got) != tt.wantLen {
           t.Errorf("Detect() returned %d packages, want %d", len(got), tt.wantLen)
         }
       })
     }
   }

   func TestGoProxyVersion(t *testing.T) {
     adapter := &GoProxyAdapter{}
     tests := []struct {
       base      string
       channel   string
       increment int
       want      string
     }{
       {"1.2.3", "prod", 0, "v1.2.3"},
       {"1.2.3", "alpha", 1, "v1.2.3-alpha.1"},
       {"1.2.3", "rc", 2, "v1.2.3-rc.2"},
     }

     for _, tt := range tests {
       t.Run(tt.want, func(t *testing.T) {
         got, err := adapter.Version(tt.base, tt.channel, tt.increment)
         if err != nil {
           t.Errorf("Version() error = %v", err)
           return
         }
         if got != tt.want {
           t.Errorf("Version() = %v, want %v", got, tt.want)
         }
       })
     }
   }

   func TestGoProxyBuild(t *testing.T) {
     adapter := &GoProxyAdapter{}
     pkg := Package{Name: "test", Version: "1.0.0"}

     result, err := adapter.Build(pkg)
     if err != nil {
       t.Errorf("Build() error = %v", err)
       return
     }
     if result.ArtifactPath != "" {
       t.Errorf("Build() should return empty ArtifactPath, got %v", result.ArtifactPath)
     }
   }
   ```

2. Create stub adapter tests in `internal/adapters/hex_test.go`, `internal/adapters/zig_test.go`, `internal/adapters/mojo_test.go`:

   ```go
   package adapters

   import (
     "os"
     "path/filepath"
     "testing"
   )

   func TestHexDetect(t *testing.T) {
     adapter := &HexAdapter{}
     tmpdir := t.TempDir()

     content := `defmodule MyPackage.MixProject do
     use Mix.Project

     def project do
       [
         app: :my_package,
         version: "1.0.0",
         name: "my_package"
       ]
     end
   end`

     os.WriteFile(filepath.Join(tmpdir, "mix.exs"), []byte(content), 0644)

     got, err := adapter.Detect(tmpdir)
     if err == nil && len(got) > 0 {
       t.Logf("Hex detection works: %v", got[0].Name)
     }
   }

   func TestHexBuildNotSupported(t *testing.T) {
     adapter := &HexAdapter{}
     pkg := Package{Name: "test", Version: "1.0.0"}

     _, err := adapter.Build(pkg)
     if err == nil {
       t.Errorf("Build() should return ErrNotSupported")
       return
     }
     // Verify it's ErrNotSupported
     if !strings.Contains(err.Error(), "not yet supported") {
       t.Errorf("Build() error message should mention 'not yet supported', got: %v", err)
     }
   }

   // Similar tests for Zig and Mojo adapters
   ```

3. Test coverage includes:
   - Go module detection from go.mod
   - Go version formatting with `v` prefix
   - Go build (no-op)
   - Go publish (git tags) — can use mock exec
   - Stub adapters: Detect works, Build/Publish/Verify return ErrNotSupported
   - Version formatting for all adapters

4. Run tests with `go test -v ./internal/adapters/...`

**Acceptance Criteria:**
- Go adapter tests pass (Detect, Version, Build)
- Hex, Zig, Mojo Detect tests pass (can parse manifests)
- Hex, Zig, Mojo Build/Publish/Verify tests return ErrNotSupported
- Error messages are clear and mention "not yet supported"
- Coverage > 80%
- All adapters can be instantiated without panic

## Activity Log

- 2026-03-01T14:15:04Z – claude-impl – shell_pid=83535 – lane=doing – Assigned agent via workflow command
- 2026-03-01T14:17:09Z – claude-impl – shell_pid=83535 – lane=for_review – Ready: Go proxy, Hex/Zig/Mojo stubs, adapter registry
- 2026-03-01T14:17:09Z – claude-impl – shell_pid=83535 – lane=done – Review passed: 10 test groups, all 7 adapters registered and tested
