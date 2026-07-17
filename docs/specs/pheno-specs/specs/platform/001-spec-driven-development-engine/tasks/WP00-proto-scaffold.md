---
work_package_id: WP00
title: Proto Repository Scaffold
lane: "done"
dependencies: []
base_branch: main
base_commit: 1d7faa3715187a2f4f41de16be4810147979105e
created_at: '2026-02-27T23:51:11.603937+00:00'
subtasks:
- T000a
- T000b
- T000c
- T000d
- T000e
- T000f
- T000f2
- T000g
phase: Phase 0 - Foundation
assignee: ''
agent: "claude-opus-reviewer"
shell_pid: "27478"
review_status: "approved"
reviewed_by: "Koosha Paridehpour"
history:
- timestamp: '2026-02-27T00:00:00Z'
  lane: planned
  agent: system
  shell_pid: ''
  action: Prompt generated via /spec-kitty.tasks
---

# Work Package Prompt: WP00 -- Proto Repository Scaffold

## IMPORTANT: Review Feedback Status

**Read this first if you are implementing this task!**

- **Has review feedback?**: Check the `review_status` field above. If it says `has_feedback`, scroll to the **Review Feedback** section immediately.
- **You must address all feedback** before your work is complete. Feedback items are your implementation TODO list.
- **Mark as acknowledged**: When you understand the feedback and begin addressing it, update `review_status: acknowledged` in the frontmatter.
- **Report progress**: As you address each feedback item, update the Activity Log explaining what you changed.

---

## Review Feedback

> **Populated by `/spec-kitty.review`** -- Reviewers add detailed feedback here when work needs changes.

*[This section is empty initially. Reviewers will populate it if the work is returned from review.]*

---

## Markdown Formatting
Wrap HTML/XML tags in backticks: `` `<div>` ``, `` `<script>` ``
Use language identifiers in code blocks: ````python`, ````bash`

---

## Implementation Command

```bash
spec-kitty implement WP00
```

---

## Objectives & Success Criteria

1. **`buf lint` passes**: `buf lint proto/` succeeds with zero warnings or errors on all 4 proto files.
2. **`buf generate` produces stubs**: `buf generate` produces Rust (tonic/prost) and Python (grpcio) stubs without errors.
3. **Rust crate compiles**: `cargo build` in `rust/` succeeds with the generated stubs included.
4. **Python package installs**: `uv sync` in `python/` completes without errors.
5. **All 3 service definitions present**: `AgilePlusCoreService` (core.proto), `AgentDispatchService` (agents.proto), `IntegrationsService` (integrations.proto).
6. **Shared message types in common.proto**: Types defined in `common.proto` are imported and used by all 3 service proto files.

---

## Context & Constraints

### Reference Documents
- **Spec**: `kitty-specs/001-spec-driven-development-engine/spec.md` -- FR requirements
- **Plan**: `kitty-specs/001-spec-driven-development-engine/plan.md` -- Project structure, dependency graph, technical context
- **Data Model**: `kitty-specs/001-spec-driven-development-engine/data-model.md` -- Entity definitions used by proto message types
- **Contracts**: `kitty-specs/001-spec-driven-development-engine/contracts/common.proto`, `contracts/core.proto`, `contracts/agents.proto`, `contracts/integrations.proto` -- Canonical proto source of truth to copy and adapt
- **Research**: `kitty-specs/001-spec-driven-development-engine/research.md` -- Technology choices and rationale

### Architectural Constraints
- **Separate repository**: `agileplus-proto` is a standalone repo, not a subdirectory of the main workspace. It is the source of truth for the gRPC contract boundary.
- **4-file proto layout**: Protos are split into `common.proto`, `core.proto`, `agents.proto`, `integrations.proto` -- do NOT merge them into a single file.
- **`buf` for linting and codegen**: Use `buf` (not raw `protoc`) as the primary build tool. `buf.yaml` and `buf.gen.yaml` control linting and generation targets.
- **Rust codegen via `prost` + `tonic`**: The `rust/` crate uses `tonic-build` in `build.rs` to generate stubs at build time.
- **Python codegen via `grpcio-tools`**: The `python/` package uses `grpcio-tools` (invoked via `buf` plugin or script) to generate Python stubs.
- **Package namespace**: All proto files use `package agileplus.v1;` and `option go_package`, `option java_package` etc. for multi-language compatibility.

### Key Dependencies
- **buf**: v2 schema; `buf lint` with STANDARD ruleset; `buf generate` with tonic and grpcio-tools plugins
- **Rust**: `prost = "0.13"`, `tonic = "0.12"`, `tonic-build` as build-dep
- **Python**: `grpcio`, `grpcio-tools`, `betterproto` (optional typed dataclasses output)
- **CI**: GitHub Actions workflow running `buf lint`, `cargo build`, `uv sync` on push

---

## Subtasks & Detailed Guidance

### Subtask T000a -- Initialize `agileplus-proto` repo with README, LICENSE, .gitignore

- **Purpose**: Establish the repository skeleton so all subsequent subtasks have a clean working tree with proper metadata and ignore rules.
- **Steps**:
  1. Create a new directory `agileplus-proto/` (or initialize the existing repo if already cloned).
  2. Create `README.md` with:
     - Project title: `agileplus-proto`
     - One-sentence description: "Protocol Buffer definitions for the AgilePlus gRPC API."
     - Sections: Overview, Repository Layout, Getting Started (buf lint, buf generate), Contributing
     - Repository layout table listing `proto/agileplus/v1/`, `rust/`, `python/`, `buf.yaml`, `buf.gen.yaml`
  3. Create `LICENSE` with MIT license text (year: 2026, holder: Phenotype).
  4. Create `.gitignore` ignoring:
     - `target/` (Rust build artifacts)
     - `__pycache__/`, `*.pyc`, `.venv/` (Python artifacts)
     - `gen/` (generated stubs if not committed)
     - `.DS_Store`, `*.swp`
  5. Initialize git if not already initialized: `git init && git add . && git commit -m "chore: initialize agileplus-proto repository"`.
- **Files**: `README.md`, `LICENSE`, `.gitignore`
- **Parallel?**: No -- this must complete first; T000b through T000g depend on the repo existing.
- **Validation**: `git status` shows clean working tree; `ls -la` shows all three files.
- **Notes**: Do NOT add any proto files or code yet. The README layout section should accurately describe the structure that subsequent subtasks will create.

### Subtask T000b -- Create `proto/agileplus/v1/common.proto` with shared message types

- **Purpose**: Define all shared message types (identifiers, timestamps, pagination, error codes, audit entries) that the three service proto files import and reuse. This must be created before the service protos.
- **Steps**:
  1. Create directory structure: `proto/agileplus/v1/`
  2. Create `proto/agileplus/v1/common.proto` based on `kitty-specs/001-spec-driven-development-engine/contracts/common.proto`. Copy the canonical contract and adapt as needed.
  3. Ensure the file includes:
     - `syntax = "proto3";`
     - `package agileplus.v1;`
     - Language-specific options (`java_package`, `java_outer_classname`, `go_package`)
     - Shared enums: `Lane`, `FeatureStatus`, `WorkPackageStatus`, `ErrorCode`
     - Shared messages: `FeatureId`, `WorkPackageId`, `Timestamp`, `PageRequest`, `PageResponse`, `AuditEntry`, `GovernanceViolation`
     - Any other types referenced across multiple service protos
  4. Run `buf lint proto/agileplus/v1/common.proto` to verify before moving on.
- **Files**: `proto/agileplus/v1/common.proto`
- **Parallel?**: No -- service protos (T000c, T000d, T000e) import this file and must wait for it.
- **Validation**: `buf lint` passes on this file alone; all imported types are defined (no forward-reference errors).
- **Notes**: Match the canonical contract at `contracts/common.proto` exactly unless buf lint requires changes. Do not add service definitions here -- this file is shared types only.

### Subtask T000c -- Create `proto/agileplus/v1/core.proto` with AgilePlusCoreService

- **Purpose**: Define the primary gRPC service that the Rust core server exposes -- covering feature lifecycle, work package management, governance checks, audit trail retrieval, and command dispatch.
- **Steps**:
  1. Create `proto/agileplus/v1/core.proto` based on `kitty-specs/001-spec-driven-development-engine/contracts/core.proto`.
  2. Import `common.proto`: `import "agileplus/v1/common.proto";`
  3. Define `service AgilePlusCoreService` with RPCs including at minimum:
     - `GetFeature(GetFeatureRequest) returns (FeatureResponse)`
     - `ListFeatures(ListFeaturesRequest) returns (ListFeaturesResponse)`
     - `CreateFeature(CreateFeatureRequest) returns (FeatureResponse)`
     - `TransitionFeature(TransitionRequest) returns (TransitionResponse)`
     - `GetWorkPackage(GetWorkPackageRequest) returns (WorkPackageResponse)`
     - `ListWorkPackages(ListWorkPackagesRequest) returns (ListWorkPackagesResponse)`
     - `TransitionWorkPackage(TransitionWorkPackageRequest) returns (TransitionResponse)`
     - `GetAuditTrail(GetAuditTrailRequest) returns (AuditTrailResponse)`
     - `CheckGovernance(GovernanceCheckRequest) returns (GovernanceCheckResponse)`
     - `DispatchCommand(CommandRequest) returns (CommandResponse)`
     - `StreamAgentEvents(AgentEventRequest) returns (stream AgentEvent)`
  4. Define all request/response message types for each RPC.
  5. Reference `agileplus.v1.FeatureId`, `agileplus.v1.AuditEntry`, etc. from common.proto using fully-qualified names.
- **Files**: `proto/agileplus/v1/core.proto`
- **Parallel?**: No -- depends on T000b (common.proto must exist for import to resolve).
- **Validation**: `buf lint proto/agileplus/v1/core.proto` passes; all message types are defined; no import errors.
- **Notes**: Match `contracts/core.proto` as the source of truth. Every RPC that exists in the canonical contract must be present here. Do not omit RPCs to simplify -- the contract is the contract.

### Subtask T000d -- Create `proto/agileplus/v1/agents.proto` with AgentDispatchService

- **Purpose**: Define the gRPC service for dispatching and monitoring autonomous agent tasks (Claude Code, Codex, etc.), including job submission, streaming event consumption, and cancellation.
- **Steps**:
  1. Create `proto/agileplus/v1/agents.proto` based on `kitty-specs/001-spec-driven-development-engine/contracts/agents.proto`.
  2. Import `common.proto`: `import "agileplus/v1/common.proto";`
  3. Define `service AgentDispatchService` with RPCs including at minimum:
     - `DispatchAgent(DispatchAgentRequest) returns (DispatchAgentResponse)`
     - `GetAgentJob(GetAgentJobRequest) returns (AgentJobResponse)`
     - `CancelAgentJob(CancelAgentJobRequest) returns (CancelAgentJobResponse)`
     - `StreamAgentOutput(StreamAgentOutputRequest) returns (stream AgentOutputEvent)`
     - `ListAgentJobs(ListAgentJobsRequest) returns (ListAgentJobsResponse)`
  4. Define enums: `AgentType` (CLAUDE_CODE, CODEX, UNKNOWN), `AgentJobStatus` (PENDING, RUNNING, COMPLETED, FAILED, CANCELLED).
  5. Define message types for all RPCs; reference common.proto types where applicable (e.g., `agileplus.v1.WorkPackageId`).
- **Files**: `proto/agileplus/v1/agents.proto`
- **Parallel?**: Yes -- can run in parallel with T000c and T000e once T000b is complete.
- **Validation**: `buf lint proto/agileplus/v1/agents.proto` passes; streaming RPC syntax is correct.
- **Notes**: Match `contracts/agents.proto`. The streaming RPC `StreamAgentOutput` is server-side streaming -- use `returns (stream AgentOutputEvent)` syntax. Bidirectional streaming is not required at this stage.

### Subtask T000e -- Create `proto/agileplus/v1/integrations.proto` with IntegrationsService

- **Purpose**: Define the gRPC service for external integrations (Linear, GitHub, Jira, GitLab) -- covering webhook ingestion, sync operations, and mapping between external IDs and internal AgilePlus entities.
- **Steps**:
  1. Create `proto/agileplus/v1/integrations.proto` based on `kitty-specs/001-spec-driven-development-engine/contracts/integrations.proto`.
  2. Import `common.proto`: `import "agileplus/v1/common.proto";`
  3. Define `service IntegrationsService` with RPCs including at minimum:
     - `SyncFromLinear(SyncFromLinearRequest) returns (SyncResponse)`
     - `SyncFromGitHub(SyncFromGitHubRequest) returns (SyncResponse)`
     - `SyncFromJira(SyncFromJiraRequest) returns (SyncResponse)`
     - `HandleWebhook(WebhookRequest) returns (WebhookResponse)`
     - `GetSyncStatus(GetSyncStatusRequest) returns (SyncStatusResponse)`
     - `MapExternalId(MapExternalIdRequest) returns (MapExternalIdResponse)`
  4. Define enums: `IntegrationProvider` (LINEAR, GITHUB, JIRA, GITLAB, UNKNOWN), `SyncStatus` (PENDING, IN_PROGRESS, COMPLETED, FAILED).
  5. Define all request/response message types. Reference common.proto types where applicable.
- **Files**: `proto/agileplus/v1/integrations.proto`
- **Parallel?**: Yes -- can run in parallel with T000c and T000d once T000b is complete.
- **Validation**: `buf lint proto/agileplus/v1/integrations.proto` passes; no import errors.
- **Notes**: Match `contracts/integrations.proto`. The webhook handler should accept a generic payload (bytes or string body + headers map) to remain provider-agnostic at the proto layer. Provider-specific parsing happens in the Rust adapter.

### Subtask T000f -- Create `buf.yaml` and `buf.gen.yaml` for linting and codegen

- **Purpose**: Configure buf as the authoritative build tool for proto linting and multi-language code generation. This replaces direct protoc invocations and ensures consistent, reproducible output.
- **Steps**:
  1. Create `buf.yaml` at repository root:
     ```yaml
     version: v2
     modules:
       - path: proto
     lint:
       use:
         - STANDARD
     breaking:
       use:
         - FILE
     ```
  2. Create `buf.gen.yaml` at repository root with two plugins:
     - **Rust (tonic/prost)**:
       ```yaml
       version: v2
       plugins:
         - remote: buf.build/community/neoeinstein-prost
           out: rust/src/gen
           opt:
             - compile_well_known_types=true
         - remote: buf.build/community/neoeinstein-tonic
           out: rust/src/gen
           opt:
             - compile_well_known_types=true
             - no_server=false
             - no_client=false
       ```
     - **Python (grpcio)**:
       ```yaml
         - remote: buf.build/protocolbuffers/python
           out: python/src/gen
         - remote: buf.build/grpc/python
           out: python/src/gen
       ```
  3. Create a `buf.lock` by running `buf dep update` (this pins remote plugin versions).
  4. Add a `Makefile` (or `justfile`) at the repo root with targets:
     - `lint`: `buf lint`
     - `generate`: `buf generate`
     - `breaking`: `buf breaking --against '.git#branch=main'`
     - `all`: `lint generate`
  5. Add `.PHONY` declarations for all Makefile targets.
- **Files**: `buf.yaml`, `buf.gen.yaml`, `buf.lock`, `Makefile`
- **Parallel?**: No -- depends on T000b through T000e (all proto files must exist for `buf lint` to pass over the full module).
- **Validation**: `buf lint` exits 0; `buf generate` produces files in `rust/src/gen/` and `python/src/gen/`; `make lint` and `make generate` succeed.
- **Notes**: Use `buf.build` remote plugins instead of local protoc plugins to avoid requiring developers to install grpcio-tools locally. If remote plugins are unavailable in CI, fall back to local plugin configuration with pinned versions.

### Subtask T000f2: buf Breaking Change Baseline

**Purpose**: Generate initial buf breaking change baseline and add CI check to prevent accidental breaking changes to proto contracts.

**Steps**:
1. Run `buf breaking` to generate initial baseline image
2. Add `buf breaking --against .git#branch=main` to CI pipeline
3. Document breaking change policy in README: breaking changes require version bump in buf.yaml

**Files**: `buf.yaml`, CI config
**Validation**: `buf breaking` passes against baseline

### Subtask T000g -- Create Rust crate in `rust/` and Python package in `python/` with codegen

- **Purpose**: Provide the language-specific packaging for the generated stubs so downstream Rust crates and Python packages can depend on `agileplus-proto` as a library dependency, not just consume raw generated files.
- **Steps**:
  1. Create `rust/` directory with:
     - `rust/Cargo.toml`:
       ```toml
       [package]
       name = "agileplus-proto"
       version = "0.1.0"
       edition = "2024"
       description = "Generated gRPC stubs for AgilePlus"
       license = "MIT"

       [dependencies]
       prost = "0.13"
       tonic = { version = "0.12", features = ["transport"] }

       [build-dependencies]
       tonic-build = "0.12"
       prost-build = "0.13"
       ```
     - `rust/build.rs`:
       ```rust
       fn main() -> Result<(), Box<dyn std::error::Error>> {
           tonic_build::configure()
               .build_server(true)
               .build_client(true)
               .compile_protos(
                   &[
                       "../proto/agileplus/v1/common.proto",
                       "../proto/agileplus/v1/core.proto",
                       "../proto/agileplus/v1/agents.proto",
                       "../proto/agileplus/v1/integrations.proto",
                   ],
                   &["../proto"],
               )?;
           Ok(())
       }
       ```
     - `rust/src/lib.rs`:
       ```rust
       //! Generated gRPC stubs for AgilePlus.
       //! Do not edit -- regenerate with `buf generate` or `cargo build`.

       pub mod agileplus {
           pub mod v1 {
               tonic::include_proto!("agileplus.v1");
           }
       }
       ```
     - `rust/src/gen/` directory (created by `buf generate`; add `.gitkeep` to track in git or add to `.gitignore` if stubs are not committed)
  2. Create `python/` directory with:
     - `python/pyproject.toml`:
       ```toml
       [project]
       name = "agileplus-proto"
       version = "0.1.0"
       description = "Generated gRPC stubs for AgilePlus"
       requires-python = ">=3.12"
       dependencies = [
           "grpcio>=1.62",
           "grpcio-tools>=1.62",
           "protobuf>=5.0",
       ]

       [build-system]
       requires = ["hatchling"]
       build-backend = "hatchling.build"

       [tool.hatch.build.targets.wheel]
       packages = ["src/agileplus_proto"]
       ```
     - `python/src/agileplus_proto/__init__.py` with re-exports of generated stub modules
     - `python/src/gen/` directory (created by `buf generate`; add `.gitkeep` or `.gitignore`)
  3. Create a CI skeleton at `.github/workflows/ci.yml`:
     ```yaml
     name: CI
     on: [push, pull_request]
     jobs:
       lint-and-generate:
         runs-on: ubuntu-latest
         steps:
           - uses: actions/checkout@v4
           - uses: bufbuild/buf-action@v1
             with:
               lint: true
               format: true
               breaking: false
           - name: Build Rust crate
             run: cd rust && cargo build
           - name: Install Python deps
             run: cd python && pip install uv && uv sync
     ```
  4. Run `cargo build` in `rust/` and `uv sync` in `python/` to validate.
- **Files**: `rust/Cargo.toml`, `rust/build.rs`, `rust/src/lib.rs`, `python/pyproject.toml`, `python/src/agileplus_proto/__init__.py`, `.github/workflows/ci.yml`
- **Parallel?**: No -- depends on T000f (buf.gen.yaml must exist; `buf generate` must have run to produce gen files, or `build.rs` handles generation at compile time).
- **Validation**: `cargo build` in `rust/` exits 0; `uv sync` in `python/` exits 0; `.github/workflows/ci.yml` is valid YAML.
- **Notes**: The Rust crate uses `build.rs` + `tonic-build` for compile-time proto generation, so generated files do not need to be committed. The Python package relies on `buf generate` having run (or a `setup.py`/script step) -- document this clearly in the README. Add `rust/src/gen/` and `python/src/gen/` to `.gitignore` if stubs are generated at build time, or commit them for simpler downstream consumption.

---

## Test Strategy

- **Primary validation**: `buf lint proto/` exits 0 on all 4 proto files
- **Codegen**: `buf generate` produces files in `rust/src/gen/` and `python/src/gen/` without errors
- **Rust build**: `cargo build` in `rust/` succeeds (exercises tonic-build proto compilation)
- **Python install**: `uv sync` in `python/` completes without dependency resolution errors
- **Service count**: `grep -r "^service " proto/` returns exactly 3 results (AgilePlusCoreService, AgentDispatchService, IntegrationsService)
- **Common import**: `grep -r 'import "agileplus/v1/common.proto"' proto/` returns 3 results (one per service file)
- **Breaking change guard**: `buf breaking --against '.git#branch=main'` passes on a clean branch (no accidental breaking changes)

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| `buf` remote plugins require network access in CI | Generate step fails in offline or restricted environments | Add fallback local plugin config using pinned `protoc-gen-prost` and `grpcio-tools` binaries; cache in CI |
| Proto package namespace mismatch between files | Import errors; codegen produces wrong package paths | Enforce `package agileplus.v1;` in all 4 files via `buf lint` PACKAGE_SAME_DIRECTORY rule |
| `tonic-build` protoc version skew | Rust build fails with cryptic protoc errors | Pin `protoc` version in CI; use `prost-build` with bundled protoc via `PROTOC` env var or `protoc-bin-vendored` |
| Generated Python stubs incompatible with `protobuf` version | Import errors at runtime | Pin `protobuf>=5.0` in pyproject.toml; test with exact version in CI matrix |
| Breaking changes to proto contract affect downstream crates | WP01 (Rust grpc crate) breaks on regenerate | Enable `buf breaking` in CI from the first merge; treat all proto changes as requiring a version bump comment |
| `common.proto` missing a type needed by service protos | Build-time import errors block T000c-T000e | Complete T000b fully and run `buf lint` before starting T000c, T000d, T000e |

---

## Review Guidance

Reviewers should verify:

1. **4 proto files exist**: `common.proto`, `core.proto`, `agents.proto`, `integrations.proto` all present under `proto/agileplus/v1/`.
2. **`buf lint` passes**: `buf lint` exits 0 with STANDARD ruleset on all files.
3. **Service names match contracts**: `AgilePlusCoreService`, `AgentDispatchService`, `IntegrationsService` -- exact names, no variation.
4. **common.proto imported by all service files**: Each of the 3 service protos has `import "agileplus/v1/common.proto";`.
5. **Package namespace consistent**: All 4 files declare `package agileplus.v1;`.
6. **Rust crate builds**: `cargo build` in `rust/` succeeds with generated stubs included.
7. **Python package installs**: `uv sync` in `python/` completes without errors.
8. **CI skeleton present**: `.github/workflows/ci.yml` exists and is valid YAML.
9. **No business logic**: This WP is proto definitions and build scaffolding ONLY. No Rust application logic, no Python MCP server logic.
10. **Contracts fidelity**: All RPCs from the canonical contract files in `kitty-specs/001-spec-driven-development-engine/contracts/` are present -- nothing omitted.

---

## Activity Log

> **CRITICAL**: Activity log entries MUST be in chronological order (oldest first, newest last).

### How to Add Activity Log Entries

**When adding an entry**:
1. Scroll to the bottom of this Activity Log section
2. **APPEND the new entry at the END** (do NOT prepend or insert in middle)
3. Use exact format: `- YYYY-MM-DDTHH:MM:SSZ – agent_id – lane=<lane> – <action>`
4. Timestamp MUST be current time in UTC
5. Lane MUST match the frontmatter `lane:` field exactly

**Valid lanes**: `planned`, `doing`, `for_review`, `done`

- 2026-02-27T00:00:00Z – system – lane=planned – Prompt created.
- 2026-02-27T23:51:11Z – claude-opus – shell_pid=96135 – lane=doing – Assigned agent via workflow command
- 2026-02-28T00:15:25Z – claude-opus – shell_pid=96135 – lane=for_review – Ready for review: 4 proto files, buf v2 config, Rust crate (cargo build passes), Python package (uv sync passes), CI skeleton, buf lint clean
- 2026-02-28T07:24:14Z – claude-opus-reviewer – shell_pid=27478 – lane=doing – Started review via workflow command
- 2026-02-28T07:27:15Z – claude-opus-reviewer – shell_pid=27478 – lane=done – Review passed: buf lint clean, cargo build passes, uv sync passes, 3 services present, cross-platform CI, breaking change detection. Fixed during review: Python cross-platform matrix, removed redundant prost-build.
- 2026-02-28T08:43:31Z – claude-opus-reviewer – shell_pid=27478 – lane=done – TODO: Replace Make with modern task runner (just/task/mise) — evaluate best DX tooling as of 2026. Track as separate work item.
