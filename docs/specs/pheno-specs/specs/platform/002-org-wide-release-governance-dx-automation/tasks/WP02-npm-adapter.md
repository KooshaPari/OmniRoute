---
work_package_id: WP02
title: npm Adapter
lane: "done"
dependencies: [WP01]
base_branch: 002-org-wide-release-governance-dx-automation-WP01
base_commit: 50c5fe5c522c6cec9f56b7d88f9628b7ff80b5cc
created_at: '2026-03-01T14:06:21.970286+00:00'
subtasks: [T007, T008, T009, T010, T011, T012]
phase: Phase 1 - Adapters
assignee: ''
agent: "claude-impl"
shell_pid: "44458"
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

WP02 implements the npm RegistryAdapter, enabling detection, versioning, building, publishing, and verification for npm packages. This adapter handles scoped packages (@org/name), private packages, and npm-specific publishing workflows including retry logic for rate limits and authentication errors.

**Implementation Command:** `spec-kitty implement WP02 --base WP01`

---

## T007: Implement npm Package Detection

**Objective:** Parse package.json and extract package metadata for npm registry.

**Implementation Guidance:**

1. Create `internal/adapters/npm.go` with the Detect method:

   ```go
   package adapters

   import (
     "encoding/json"
     "fmt"
     "os"
     "path/filepath"
   )

   type npmPackageJSON struct {
     Name    string `json:"name"`
     Version string `json:"version"`
     Private bool   `json:"private"`
   }

   type NpmAdapter struct{}

   func (a *NpmAdapter) Detect(repoPath string) ([]Package, error) {
     var packages []Package

     // Walk the repo to find all package.json files
     err := filepath.Walk(repoPath, func(path string, info os.FileInfo, err error) error {
       if err != nil {
         return err
       }
       if info.IsDir() {
         return nil
       }
       if info.Name() != "package.json" {
         return nil
       }

       // Skip node_modules and hidden directories
       relPath, _ := filepath.Rel(repoPath, path)
       if isExcluded(relPath) {
         return nil
       }

       data, err := os.ReadFile(path)
       if err != nil {
         return err
       }

       var pj npmPackageJSON
       if err := json.Unmarshal(data, &pj); err != nil {
         return nil // Silently skip invalid package.json
       }

       if pj.Name == "" || pj.Version == "" {
         return nil // Skip incomplete manifests
       }

       pkg := Package{
         Name:         pj.Name,
         Version:      pj.Version,
         ManifestPath: path,
         Registry:     "npm",
         Private:      pj.Private,
         Language:     "typescript",
       }
       packages = append(packages, pkg)
       return nil
     })

     if err != nil {
       return nil, err
     }
     return packages, nil
   }

   // isExcluded returns true if the path should be skipped during detection
   func isExcluded(path string) bool {
     excluded := []string{"node_modules", ".git", "dist", "build"}
     for _, exc := range excluded {
       if filepath.HasPrefix(path, exc) {
         return true
       }
     }
     return false
   }
   ```

2. Handle scoped packages correctly (@org/name format):
   - Scoped names are parsed as-is from the JSON
   - No special handling needed beyond what json.Unmarshal provides

3. Test detection with sample package.json files:
   - Standard package: `{"name": "my-lib", "version": "1.0.0"}`
   - Scoped package: `{"name": "@myorg/my-lib", "version": "1.0.0"}`
   - Private package: `{"name": "private-lib", "version": "1.0.0", "private": true}`

4. Handle edge cases:
   - Missing name or version fields (skip silently)
   - Malformed JSON (skip silently)
   - Workspace packages (monorepos with yarn/npm workspaces)

**Acceptance Criteria:**
- Detect returns all package.json files in the repo (excluding node_modules)
- Scoped packages are handled correctly
- Private flag is captured
- Malformed manifests don't cause panics
- Test shows detection of at least 3 different package types

---

## T008: Implement npm Versioning

**Objective:** Map release channels to npm dist-tags and use the base version calculator.

**Implementation Guidance:**

1. Add the Version method to NpmAdapter:

   ```go
   func (a *NpmAdapter) Version(baseVersion string, channel string, increment int) (string, error) {
     // Use the version calculator from WP01
     version, err := CalculateVersion(baseVersion, channel, increment, "npm")
     if err != nil {
       return "", err
     }
     return version, nil
   }

   // DistTag returns the npm dist-tag for a given channel
   func (a *NpmAdapter) DistTag(channel string) string {
     switch channel {
     case "alpha":
       return "alpha"
     case "canary":
       return "canary"
     case "beta":
       return "beta"
     case "rc":
       return "rc"
     case "prod":
       return "latest"
     default:
       return "latest"
     }
   }
   ```

2. Document the dist-tag mapping in a comment:
   ```
   Dist-tag mappings:
   - alpha  → "alpha" (edge pre-release)
   - canary → "canary" (nightly/unstable)
   - beta   → "beta" (late pre-release)
   - rc     → "rc" (release candidate)
   - prod   → "latest" (stable production)
   ```

3. Ensure that the Version method calls the calculator from WP01 (import the package).

**Acceptance Criteria:**
- Version method returns correct format (e.g., "1.2.3-alpha.1")
- DistTag returns correct npm dist-tag per channel
- Channel "prod" maps to "latest" (not "prod")
- All 5 channels are supported

---

## T009: Implement npm Build (npm pack)

**Objective:** Execute npm pack to create a publishable tarball.

**Implementation Guidance:**

1. Add the Build method to NpmAdapter:

   ```go
   import (
     "bytes"
     "os/exec"
     "strings"
   )

   func (a *NpmAdapter) Build(pkg Package) (*BuildResult, error) {
     // Get the directory containing package.json
     pkgDir := filepath.Dir(pkg.ManifestPath)

     // Run npm pack in the package directory
     cmd := exec.Command("npm", "pack", "--pack-destination", "/tmp")
     cmd.Dir = pkgDir

     var stdout bytes.Buffer
     cmd.Stdout = &stdout

     if err := cmd.Run(); err != nil {
       return &BuildResult{Err: err}, nil
     }

     // Parse output to get tarball filename
     // npm pack outputs: "npm notice <message>\n<tarball-name>\n<tarball-path>\n"
     output := strings.TrimSpace(stdout.String())
     lines := strings.Split(output, "\n")
     tarball := lines[len(lines)-1] // Last line is the full path

     return &BuildResult{ArtifactPath: tarball, Err: nil}, nil
   }
   ```

2. Handle npm output parsing carefully:
   - npm pack outputs multiple lines; the last line is the tarball path
   - Alternatively, use `--pack-destination` flag to specify output directory and construct path

3. Ensure the artifact path can be consumed by Publish.

4. Test with a real npm package or mock exec.

**Acceptance Criteria:**
- Build creates a valid tarball (.tgz file)
- Tarball path is returned in BuildResult.ArtifactPath
- Command runs from the correct directory (pkgDir)
- Error handling if npm is not installed or pack fails

---

## T010: Implement npm Publish with Retry Logic

**Objective:** Execute npm publish with intelligent handling of rate limits (429), auth errors (403), and EOTP prompts.

**Implementation Guidance:**

1. Add the Publish method with comprehensive error handling:

   ```go
   import (
     "fmt"
     "strconv"
     "strings"
     "time"
   )

   func (a *NpmAdapter) Publish(pkg Package, version string, creds map[string]string) (*PublishResult, error) {
     distTag := a.DistTag("") // Infer from version if needed; for now assume "latest"

     // Build npm publish command
     cmd := exec.Command(
       "npm", "publish",
       filepath.Join("/tmp", fmt.Sprintf("%s-%s.tgz", pkg.Name, version)),
       "--tag", distTag,
     )

     // Set credentials via environment variables if provided
     if token, ok := creds["npm_token"]; ok {
       cmd.Env = append(os.Environ(), fmt.Sprintf("npm_config_//registry.npmjs.org/:_authToken=%s", token))
     }

     var stdout, stderr bytes.Buffer
     cmd.Stdout = &stdout
     cmd.Stderr = &stderr

     maxRetries := 5
     retryCount := 0

     for retryCount < maxRetries {
       err := cmd.Run()
       if err == nil {
         // Success
         return &PublishResult{
           RegistryURL: fmt.Sprintf("https://www.npmjs.com/package/%s/v/%s", pkg.Name, version),
           Version:     version,
           Err:         nil,
         }, nil
       }

       errMsg := stderr.String()

       // Handle 429 Rate Limit
       if strings.Contains(errMsg, "429") || strings.Contains(errMsg, "too many requests") {
         sleepDuration := parseRetryAfter(errMsg, time.Second*60) // Default 60s
         fmt.Printf("Rate limited. Retrying after %v\n", sleepDuration)
         time.Sleep(sleepDuration)
         retryCount++
         continue
       }

       // Handle 403 Auth Error
       if strings.Contains(errMsg, "403") || strings.Contains(errMsg, "Forbidden") {
         return &PublishResult{Err: fmt.Errorf("%w: check NPM_TOKEN or granular access token", ErrAuth)}, nil
       }

       // Handle EOTP (Email One-Time Password)
       if strings.Contains(errMsg, "EOTP") || strings.Contains(errMsg, "one-time password") {
         return &PublishResult{Err: fmt.Errorf("EOTP required: configure granular token with 2FA bypass enabled")}, nil
       }

       // Other errors
       return &PublishResult{Err: fmt.Errorf("npm publish failed: %w", err)}, nil
     }

     return &PublishResult{Err: fmt.Errorf("max retries (%d) exceeded", maxRetries)}, nil
   }

   // parseRetryAfter extracts the Retry-After duration from npm output
   func parseRetryAfter(errMsg string, defaultDuration time.Duration) time.Duration {
     // Look for "retry after X seconds" pattern
     // npm typically outputs: "npm ERR! code E429\nnpm ERR! ... retry after 30 seconds"
     lines := strings.Split(errMsg, "\n")
     for _, line := range lines {
       if strings.Contains(line, "retry after") {
         parts := strings.Fields(line)
         for i, part := range parts {
           if part == "after" && i+1 < len(parts) {
             if seconds, err := strconv.Atoi(parts[i+1]); err == nil {
               return time.Duration(seconds) * time.Second
             }
           }
         }
       }
     }
     return defaultDuration
   }
   ```

2. Document the error handling strategy:
   - **429 errors**: Parse Retry-After header, sleep, retry up to 5 times
   - **403 errors**: Fail fast with credential hints
   - **EOTP errors**: Fail with instructions to enable 2FA bypass
   - **Other errors**: Fail immediately

3. Environment variable for credentials: `npm_config_//registry.npmjs.org/:_authToken`

**Acceptance Criteria:**
- Publish command executes correctly with valid artifact
- Rate limit (429) is detected and retried with proper sleep duration
- Auth error (403) fails immediately with helpful message
- EOTP error provides guidance on 2FA bypass
- Max retries is enforced (no infinite loops)
- Successful publish returns RegistryURL and Version

---

## T011: Implement npm Verification (Registry Polling)

**Objective:** Poll npm registry to confirm version availability before declaring success.

**Implementation Guidance:**

1. Add the Verify method:

   ```go
   import (
     "encoding/json"
     "net/http"
   )

   func (a *NpmAdapter) Verify(pkg Package, version string) (bool, error) {
     url := fmt.Sprintf("https://registry.npmjs.org/%s/%s", pkg.Name, version)
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

2. Use 10-second polling interval (npm is relatively fast).

3. Timeout after 5 minutes of polling.

4. Handle scoped packages correctly in the URL (`@org/name` → `%40org%2Fname`).

**Acceptance Criteria:**
- Verify polls the registry endpoint
- Returns true when version is found (200 status)
- Returns false and error after 5-minute timeout
- Handles scoped packages in URL encoding
- Respects 10-second polling interval

---

## T012: Unit Tests for npm Adapter

**Objective:** Provide comprehensive test coverage for all npm adapter methods.

**Implementation Guidance:**

1. Create `internal/adapters/npm_test.go`:

   ```go
   package adapters

   import (
     "testing"
     "os"
     "path/filepath"
   )

   func TestNpmDetect(t *testing.T) {
     tests := []struct {
       name    string
       setup   func(tmpdir string) error
       want    int
       wantErr bool
     }{
       {
         name: "detect-single-package",
         setup: func(tmpdir string) error {
           content := `{"name": "test-pkg", "version": "1.0.0"}`
           return os.WriteFile(filepath.Join(tmpdir, "package.json"), []byte(content), 0644)
         },
         want:    1,
         wantErr: false,
       },
       {
         name: "detect-scoped-package",
         setup: func(tmpdir string) error {
           content := `{"name": "@myorg/test-pkg", "version": "1.0.0"}`
           return os.WriteFile(filepath.Join(tmpdir, "package.json"), []byte(content), 0644)
         },
         want:    1,
         wantErr: false,
       },
       {
         name: "detect-private-package",
         setup: func(tmpdir string) error {
           content := `{"name": "private-pkg", "version": "1.0.0", "private": true}`
           return os.WriteFile(filepath.Join(tmpdir, "package.json"), []byte(content), 0644)
         },
         want:    1,
         wantErr: false,
       },
       {
         name: "skip-node-modules",
         setup: func(tmpdir string) error {
           nm := filepath.Join(tmpdir, "node_modules", "some-lib")
           os.MkdirAll(nm, 0755)
           content := `{"name": "some-lib", "version": "1.0.0"}`
           return os.WriteFile(filepath.Join(nm, "package.json"), []byte(content), 0644)
         },
         want:    0,
         wantErr: false,
       },
       {
         name: "skip-invalid-json",
         setup: func(tmpdir string) error {
           return os.WriteFile(filepath.Join(tmpdir, "package.json"), []byte("{invalid}"), 0644)
         },
         want:    0,
         wantErr: false,
       },
     }

     adapter := &NpmAdapter{}

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
         if len(got) != tt.want {
           t.Errorf("Detect() returned %d packages, want %d", len(got), tt.want)
         }
       })
     }
   }

   func TestNpmVersion(t *testing.T) {
     adapter := &NpmAdapter{}
     tests := []struct {
       base      string
       channel   string
       increment int
       want      string
     }{
       {"1.2.3", "prod", 0, "1.2.3"},
       {"1.2.3", "alpha", 1, "1.2.3-alpha.1"},
       {"1.2.3", "canary", 5, "1.2.3-canary.5"},
       {"1.2.3", "beta", 1, "1.2.3-beta.1"},
       {"1.2.3", "rc", 2, "1.2.3-rc.2"},
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

   func TestNpmDistTag(t *testing.T) {
     adapter := &NpmAdapter{}
     tests := []struct {
       channel string
       want    string
     }{
       {"prod", "latest"},
       {"alpha", "alpha"},
       {"beta", "beta"},
       {"rc", "rc"},
       {"canary", "canary"},
     }

     for _, tt := range tests {
       t.Run(tt.channel, func(t *testing.T) {
         got := adapter.DistTag(tt.channel)
         if got != tt.want {
           t.Errorf("DistTag(%s) = %s, want %s", tt.channel, got, tt.want)
         }
       })
     }
   }

   func TestParseRetryAfter(t *testing.T) {
     tests := []struct {
       errMsg   string
       want     int // seconds
     }{
       {"npm ERR! code E429\nnpm ERR! retry after 30 seconds", 30},
       {"npm ERR! code E429\nnpm ERR! retry after 60 seconds", 60},
       {"no retry after info", 0}, // Returns defaultDuration; test this with a helper
     }

     for _, tt := range tests {
       t.Run(tt.errMsg, func(t *testing.T) {
         duration := parseRetryAfter(tt.errMsg, 60*time.Second)
         if tt.want > 0 && duration != time.Duration(tt.want)*time.Second {
           t.Errorf("parseRetryAfter() = %v, want %v", duration, time.Duration(tt.want)*time.Second)
         }
       })
     }
   }
   ```

2. Use `t.TempDir()` for file system tests.

3. Test mocking for Build, Publish, and Verify (use `os/exec` mocking or integration tests with real npm).

4. Ensure retry logic tests validate that sleep/retry behavior works correctly.

**Acceptance Criteria:**
- Detect tests cover standard, scoped, private, and excluded packages
- Version tests cover all 5 channels
- DistTag tests verify channel→tag mapping
- Retry parsing tests validate Retry-After extraction
- All tests pass with `go test -v ./internal/adapters/...`
- Coverage > 85%

## Activity Log

- 2026-03-01T14:06:22Z – claude-impl – shell_pid=44458 – lane=doing – Assigned agent via workflow command
- 2026-03-01T14:09:51Z – claude-impl – shell_pid=44458 – lane=for_review – Ready for review: npm adapter with full lifecycle and tests
- 2026-03-01T14:10:16Z – claude-impl – shell_pid=44458 – lane=done – Review passed: npm adapter complete with 7 test cases, all passing
